require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const connectDB = require("./src/config/db");
const validateEnv = require("./src/config/env");
const errorHandler = require("./src/middleware/errorHandler");
const dashboardRoutes = require("./src/routes/dashboardRoutes");

const adminReportRoutes = require("./src/routes/adminReport.routes");

// ... other app.use calls
// Validate environment variables
validateEnv();

const app = express();

// Connect Database
connectDB();

// Security middleware
app.use(helmet());

// CORS configuration
// app.use(cors({
//   origin: process.env.CORS_ORIGIN || "*",
//   credentials: true
// }));
app.use(cors({
  origin: "*",
  credentials: true
}))


// Rate limiting - DISABLED FOR TESTING
// Uncomment below to re-enable general API rate limiting
/*
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later."
});
app.use("/api/", limiter);
*/

// Stricter rate limit for auth endpoints
// DISABLED FOR TESTING - Remove or comment out the skip function to re-enable
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 login attempts per windowMs (increased from 5 for demos)
  message: "Too many login attempts, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // ALWAYS SKIP RATE LIMITING - Remove this skip function to re-enable rate limiting
  skip: (req) => {
    // Always skip rate limiting (disabled for testing)
    return true;
    // To re-enable, change above to: return false;
    // Or use conditional: return process.env.NODE_ENV === 'production';
  },
  // Custom handler to return better error response
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many login attempts. Please wait a few minutes and try again.",
      retryAfter: Math.ceil(15 * 60) // 15 minutes in seconds
    });
  }
});
app.use("/api/auth/login", authLimiter);

// Logging
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Routes
app.use("/api/auth", require("./src/routes/auth.routes"));
app.use("/api/admin", require("./src/routes/admin.routes"));
app.use("/api/manager", require("./src/routes/manager.routes"));
app.use("/api/maintenance", require("./src/routes/maintenance.routes"));
app.use("/api/reports", require("./src/routes/reports.routes"));
app.use("/api/sub-manager", require("./src/routes/subManager.routes"));
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", adminReportRoutes);



// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler (must be last)
app.use(errorHandler);

// Server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
});

// Handle port already in use error
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please stop the other process or use a different port.`);
    console.error(`💡 Try: netstat -ano | findstr :${PORT} (Windows) or lsof -ti:${PORT} (Mac/Linux)`);
    process.exit(1);
  } else {
    throw err;
  }
});
