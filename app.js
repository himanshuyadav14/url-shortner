require("dotenv").config();
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const { connectMongoDB } = require("./utils/db");
const authRoute = require("./routes/auth");
const urlRoute = require("./routes/url");

const app = express();

app.use(express.json());
app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());

require("./utils/passport")();

app.use("/", authRoute);
app.use("/api", urlRoute);

const PORT = process.env.PORT || 3000;
const startServer = async () => {
  try {
    await connectMongoDB(process.env.MONGO_URI);

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
