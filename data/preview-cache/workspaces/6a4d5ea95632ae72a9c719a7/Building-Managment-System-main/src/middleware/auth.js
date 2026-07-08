// src/middleware/auth.js
const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  // Checks if header exists and starts with "Bearer "
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: "No token, authorization denied. Please login first." 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // This allows getRooms to use req.user
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: "Token expired. Please login again." 
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: "Invalid token. Please login again." 
      });
    }
    return res.status(401).json({ 
      success: false,
      message: "Authentication failed" 
    });
  }
};
