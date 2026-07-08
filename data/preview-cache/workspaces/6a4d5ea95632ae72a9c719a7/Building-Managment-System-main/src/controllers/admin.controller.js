/**
 * Admin Controller - Main admin operations
 * This file now delegates to specialized controllers for better organization
 * For manager operations, see: controllers/admin/manager.controller.js
 * For building operations, see: controllers/admin/building.controller.js
 */

const managerController = require("./admin/manager.controller");
const buildingController = require("./admin/building.controller");
const paymentController = require("./admin/payment.controller");
const adminPersonController = require("./admin/adminPerson.controller");

// --- MANAGER CONTROLLERS ---
// Delegate to manager controller
exports.getAllManagers = managerController.getAllManagers;
exports.createManager = managerController.createManager;
exports.updateManager = managerController.updateManager;
exports.deleteManager = managerController.deleteManager;
exports.getAdminPersons = managerController.getAdminPersons;

// --- BUILDING CONTROLLERS ---
// Delegate to building controller
exports.getAllBuildings = buildingController.getAllBuildings;
exports.createBuilding = buildingController.createBuilding;
exports.updateBuilding = buildingController.updateBuilding;
exports.deleteBuilding = buildingController.deleteBuilding;

// --- PAYMENT CONTROLLERS ---
// Delegate to payment controller
exports.getAllPayments = paymentController.getAllPayments;
exports.getPaymentsByBuilding = paymentController.getPaymentsByBuilding;
exports.getOverduePayments = paymentController.getOverduePayments;
exports.upsertPayment = paymentController.upsertPayment;
exports.markAsPaid = paymentController.markAsPaid;
exports.getPaymentStats = paymentController.getPaymentStats;

// --- ADMIN PERSON CONTROLLERS ---
exports.getAllAdminPersons = adminPersonController.getAllAdminPersons;
exports.getAdminPersonById = adminPersonController.getAdminPersonById;
exports.createAdminPerson = adminPersonController.createAdminPerson;
exports.updateAdminPerson = adminPersonController.updateAdminPerson;
exports.deleteAdminPerson = adminPersonController.deleteAdminPerson;
