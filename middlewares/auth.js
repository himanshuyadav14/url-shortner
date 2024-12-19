const jwt = require("jsonwebtoken");
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute in milliseconds
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many URL creation requests from this IP, please try again later.',
});

const isAuthenticated = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.redirect("/"); // No token means user is not authenticated
  }
  
  try {
    const decoded = jwt.verify(token, "your-jwt-secret");
    req.user = decoded; 
    next();
  } catch (err) {
    console.error("Invalid token:", err);
    res.redirect("/");
  }
};

module.exports = { isAuthenticated ,limiter };
