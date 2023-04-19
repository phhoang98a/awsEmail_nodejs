require("dotenv").config();

const express = require("express");
const indexRoute = require("./route/index");

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser')
const cors = require('cors');
const fileupload = require("express-fileupload");

const app = express();
app.use(fileupload());
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json());
app.use(cors());
app.use(cookieParser());

app.use("/", indexRoute);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server started on port ...${PORT}`);
});
