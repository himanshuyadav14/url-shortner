const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken");

const router = express.Router();

router.get("/", (req, res) => {
  res.send("<a href='auth/google'>Login with Google</a>");
});

router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email },
      "your-jwt-secret",
      { expiresIn: "1h" }
    );

    console.log("Generated JWT:", token);

    // Option 1: Set the token in a cookie (for browser requests)
    res.cookie("jwt", token, {
      httpOnly: true, // Secure the cookie
      maxAge: 3600000, // 1 hour
    });

    res.redirect("/profile");
  }
);

router.get("/profile", (req, res) => {
  if (!req.user) {
    return res.redirect("/");
  }
  console.log(req.cookies.jwt);
  res.send(`
      <h1>Welcome ${req.user.displayName}</h1>
      <p>Email: ${req.user.email}</p>
      <img src="${req.user.profilePicture}" alt="Profile Picture" />
      <br />
      <a href="/logout">Logout</a>
    `);
});

router.get("/logout", (req, res) => {
  req.logout(() => res.redirect("/"));
});

module.exports = router;