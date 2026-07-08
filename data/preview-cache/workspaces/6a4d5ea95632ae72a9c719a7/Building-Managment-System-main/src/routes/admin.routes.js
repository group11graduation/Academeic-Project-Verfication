const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const adminCtrl = require("../controllers/admin.controller");
const buildingApprovalCtrl = require("../controllers/admin/buildingApproval.controller");

// All routes here require SUPER_ADMIN role
router.use(auth, role("SUPER_ADMIN"));


// Manager Routes
router.get("/managers", adminCtrl.getAllManagers);
router.get("/admin-persons-for-select", adminCtrl.getAdminPersons);
router.post("/create-manager", adminCtrl.createManager);
router.put("/manager/:id", adminCtrl.updateManager);
router.delete("/manager/:id", adminCtrl.deleteManager);

// Building Routes
router.get("/buildings", adminCtrl.getAllBuildings);
router.post("/create-building", adminCtrl.createBuilding);
router.put("/building/:id", adminCtrl.updateBuilding);
router.delete("/building/:id", adminCtrl.deleteBuilding);

// Payment Routes
router.get("/payments", adminCtrl.getAllPayments);
router.get("/payments/building/:buildingId", adminCtrl.getPaymentsByBuilding);
router.get("/payments/overdue", adminCtrl.getOverduePayments);
router.get("/payments/stats", adminCtrl.getPaymentStats);
router.post("/payments", adminCtrl.upsertPayment);
router.put("/payments/:id/paid", adminCtrl.markAsPaid);

// Admin Person Routes
router.get("/admin-persons", adminCtrl.getAllAdminPersons);
router.get("/admin-person/:id", adminCtrl.getAdminPersonById);
router.post("/admin-person", adminCtrl.createAdminPerson);
router.put("/admin-person/:id", adminCtrl.updateAdminPerson);
router.delete("/admin-person/:id", adminCtrl.deleteAdminPerson);

// Building Approval Routes
router.get("/building-approvals", buildingApprovalCtrl.getPendingBuildingApprovals);
router.patch("/building-approvals/:id/approve", buildingApprovalCtrl.approveBuildingCreation);

module.exports = router;