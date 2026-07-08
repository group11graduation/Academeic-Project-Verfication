// src/routes/manager.routes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const {
  addFloor,
  updateFloor,
  deleteFloor,
  addRoom,
  updateRoom,
  deleteRoom,
  assignPerson,
  updatePerson,
  deletePerson,
  createSubManager,
  getFloors,
  getRooms,
  getPeople,
  getSubManagers,
  updateSubManager,
  deleteSubManager,
  getPendingRequests,
  reviewRequest
} = require("../controllers/manager.controller");

const paymentController = require("../controllers/manager/payment.controller");

// Floor routes - Sub-managers can create, but update/delete requires approval
router.post("/add-floor", auth, role("MANAGER","SUB_MANAGER"), addFloor);
router.patch("/update-floor/:floorId", auth, role("MANAGER","SUB_MANAGER"), updateFloor);
router.delete("/delete-floor/:floorId", auth, role("MANAGER","SUB_MANAGER"), deleteFloor);
router.get("/floors", auth, role("MANAGER","SUB_MANAGER"), getFloors);

// Room routes - Sub-managers can create, but update/delete requires approval
router.post("/add-room", auth, role("MANAGER","SUB_MANAGER"), addRoom);
router.patch("/update-room/:roomId", auth, role("MANAGER","SUB_MANAGER"), updateRoom);
router.delete("/delete-room/:roomId", auth, role("MANAGER","SUB_MANAGER"), deleteRoom);
router.get("/rooms", auth, role("MANAGER","SUB_MANAGER"), getRooms);

// Person routes - Sub-managers can create, but update/delete requires approval
router.post("/assign-person", auth, role("MANAGER","SUB_MANAGER"), assignPerson);
router.patch("/update-person/:personId", auth, role("MANAGER","SUB_MANAGER"), updatePerson);
router.delete("/delete-person/:personId", auth, role("MANAGER","SUB_MANAGER"), deletePerson);
router.get("/people", auth, role("MANAGER","SUB_MANAGER"), getPeople);

// Sub-manager routes
router.post("/create-sub-manager", auth, role("MANAGER"), createSubManager);
router.get("/sub-managers", auth, role("MANAGER"), getSubManagers);
router.patch("/Update-sub-managers/:subManagerId", auth, role("MANAGER"), updateSubManager);
router.delete("/delete-sub-managers/:subManagerId", auth, role("MANAGER"), deleteSubManager);


router.get("/approvals/pending", auth, role("MANAGER"), getPendingRequests);
router.patch("/approvals/:id", auth, role("MANAGER"), reviewRequest);

// Building Approval Routes for Manager
const buildingApprovalCtrl = require("../controllers/admin/buildingApproval.controller");
router.get("/building-approvals", auth, role("MANAGER"), buildingApprovalCtrl.getManagerBuildingApprovals);
router.patch("/building-approvals/:id/approve", auth, role("MANAGER"), buildingApprovalCtrl.approveBuildingCreation);

// Room Payment Routes (for tenant payments)
router.get("/room-payments", auth, role("MANAGER","SUB_MANAGER"), paymentController.getRoomPayments);
router.post("/room-payments", auth, role("MANAGER","SUB_MANAGER"), paymentController.createRoomPayment);
router.patch("/room-payments/:paymentId/paid", auth, role("MANAGER","SUB_MANAGER"), paymentController.markPaymentAsPaid);
router.delete("/room-payments/:paymentId", auth, role("MANAGER"), paymentController.deleteRoomPayment);
router.get("/room-payments/stats", auth, role("MANAGER","SUB_MANAGER"), paymentController.getPaymentStats);
router.post("/room-payments/auto-create", auth, role("MANAGER"), paymentController.autoCreatePayments);

module.exports = router;
