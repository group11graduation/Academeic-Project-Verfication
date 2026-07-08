const express = require("express");
const router = express.Router();

// Import the controller we discussed
const { getAdminGlobalReport } = require("../controllers/adminReport.controller");

// Import your existing middleware
const auth = require("../middleware/auth");
const role = require("../middleware/role");

/**
 * @route   GET /api/reports/admin
 * @desc    Get global building and manager performance report
 * @access  Private (Admin & Super Manager only)
 */
router.get(
  "/admin",
  auth,
  role("SUPER_ADMIN"),
  getAdminGlobalReport
);

module.exports = router;