const jwt = require("jsonwebtoken");
const isAuthenticated = (req, res, next) => {
  // console.log(req.cookies.jwt);
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  // const token = req.cookies.jwt || req.query.token; // Support both cookies and query params
  if (!token) {
    return res.redirect("/"); // No token means user is not authenticated
  }

  try {
    const decoded = jwt.verify(token, "your-jwt-secret");
    req.user = decoded; // Attach user info to req
    next();
  } catch (err) {
    console.error("Invalid token:", err);
    res.redirect("/");
  }
};

module.exports = { isAuthenticated };
