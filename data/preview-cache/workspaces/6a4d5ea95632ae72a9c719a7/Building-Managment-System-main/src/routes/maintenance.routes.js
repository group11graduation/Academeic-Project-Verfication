const express = require("express");
const router = express.Router();

const {
  createRequest,
  getRequests,
  updateRequest,
  getRequestById
} = require("../controllers/maintenance.controller");

const auth = require("../middleware/auth");
const role = require("../middleware/role");

//  Manager / Sub Manager creates a maintenance request
router.post(
  "/",
  auth,
  role("MANAGER", "SUB_MANAGER"), // only managers can create
  createRequest
);

//  Manager / Sub Manager get all maintenance requests for their building
router.get(
  "/",
  auth,
  role("MANAGER", "SUB_MANAGER"),
  getRequests
);

// Manager / Sub Manager update a request (status / assign someone)
router.patch(
  "/:requestId",
  auth,
  role("MANAGER", "SUB_MANAGER"),
  updateRequest
);

//  Get a single request by ID (Manager/Sub Manager)
router.get(
  "/:requestId",
  auth,
  role("MANAGER", "SUB_MANAGER"),
  getRequestById
);

module.exports = router;
