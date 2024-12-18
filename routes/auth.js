const express = require("express");
const passport = require("passport");

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
    res.redirect("/profile");
  }
);

router.get("/profile", (req, res) => {
  if (!req.user) {
    return res.redirect("/");
  }
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