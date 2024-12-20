require("dotenv").config();
const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const passport = require("passport");
require("./utils/passport")();
const { connectMongoDB } = require("./utils/db");
const authRoute = require("./routes/auth");
const urlRoute = require("./routes/url");
const MongoStore = require("connect-mongo");

const app = express();

app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "secret290349023890",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/", authRoute);
app.use("/api", urlRoute);

const PORT = process.env.PORT || 3000;
const startServer = async () => {
  try {
    console.log("send for connection");
    await connectMongoDB(process.env.MONGO_URI);
    console.log("come from connection");
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start the server:", error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
