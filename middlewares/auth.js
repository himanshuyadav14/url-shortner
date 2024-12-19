const jwt = require("jsonwebtoken");
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

module.exports = { isAuthenticated };
