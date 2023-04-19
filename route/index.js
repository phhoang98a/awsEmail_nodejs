require('dotenv').config();
const express = require('express');
const router = express.Router();

const puppeteer = require('puppeteer')
const AWS = require('aws-sdk');
const axios = require('axios');

AWS.config.update({
  accessKeyId: process.env.AMAZON_ACCESS_KEY,
  secretAccessKey: process.env.AMAZON_SECRET_KEY,
  region: 'us-east-2'
});

const s3 = new AWS.S3();

async function clickElementUntilNotFound(page, className) {
  try {
    // Find the element by class name
    const element = await page.$(className);
    // If the element is found, click it
    if (element) {
      await element.click();
      // Wait for a short delay before continuing
      await page.waitForTimeout(1000);
      // Call the function recursively to continue clicking the element until it is not found
      await clickElementUntilNotFound();
    } else {
      console.log('Element not found. Stopping.');
    }
  } catch (error) {
    console.error('Error while clicking the element:', error);
  }
}

router.post("/send-email", async(req, res)=>{
  let {emails, content, sender, subject} = req.body;
  if (!Array.isArray(emails)){
    const listEmails = []
    emails=listEmails.push(emails);
    emails=listEmails;
  }
  let files = []
  if (req?.files){
    files = req?.files?.files;
  }
  let filesName = []
  if (files.length>0){
    for (let i=0; i<files.length; i++){
      filesName.push(files[i].name)
      const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: files[i].name,
        Body: files[i].data 
      };
      await s3.upload(params).promise();
    }
  }

  let response = await axios.post('https://6d5qn4knee.execute-api.us-east-2.amazonaws.com/prod/send-email',
        {'filenames': filesName, 'content': content, 'emails':  emails, 'sender': sender, 'subject': subject})
  if (response.data.statusCode == 200)
    res.json({ message: "Emails were sent successfully", statusCode: 200 });
  else
    res.json({ message: "Emails were not sent", statusCode: 400 });

})

router.post("/extract-email", async (req, res) => {
  const {link} = req.body;

  const browser = await puppeteer.launch({
    // Headless option allows us to disable visible GUI, so the browser runs in the "background"
    // for development lets keep this to true so we can see what's going on but in
    // on a server we must set this to true
    // headless: false,
    // This setting allows us to scrape non-https websites easier
    args: [
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--single-process",
      "--no-zygote",
      '--shm-size=3gb'
    ],
    executablePath: process.env.NODE_ENV==="production"
    ? process.env.PUPPETEER_EXECUTABLE_PATH 
    : puppeteer.executablePath(),
    ignoreHTTPSErrors: true,
  })
  let page = await browser.newPage();
  await page.setDefaultNavigationTimeout(0);
  await page.goto('https://www.linkedin.com/', {timeout: 0});
  await page.$eval('input[name=session_key]', (el, username) => el.value = username, process.env.LINKEDIN_USERNAME );
  await page.$eval('input[name=session_password]', (el, password) => el.value = password, process.env.LINKEDIN_PASSWORD );
  await page.click("button[type=submit]");
  await page.waitForNavigation()
  await page.goto(link, {timeout: 0});
  const className = '.comments-comments-list__load-more-comments-button';
  await clickElementUntilNotFound(page, className);
  const lists = await page.$x('//a [contains(@href,"mailto")][@href]');
  const emails=[]
  for (let i=0; i<lists.length; i++){
    const value = await page.evaluate(el => el.textContent, lists[i]); 
    emails.push(value);
  }
  await page.close();
  await browser.close();
  res.json({ message: "Mails extracted successfully!", emails: emails, statusCode: 200 });
});


module.exports = router