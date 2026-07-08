/**
 * Manager Controller - Handles HTTP requests for manager operations
 * Delegates business logic to ManagerService
 */

const managerService = require("../../services/admin/manager.service");
const { successResponse, errorResponse } = require("../../utils/responseHandler");

/**
 * Get all managers
 */
exports.getAllManagers = async (req, res) => {
    try {
        const managers = await managerService.getAllManagers();
        return successResponse(res, managers, "Managers retrieved successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};

/**
 * Get manager by ID
 */
exports.getManagerById = async (req, res) => {
    try {
        const manager = await managerService.getManagerById(req.params.id);
        return successResponse(res, manager, "Manager retrieved successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};

/**
 * Create new manager
 */
exports.createManager = async (req, res) => {
    try {
        const manager = await managerService.createManager(req.body);
        return successResponse(res, manager, "Manager created successfully", 201);
    } catch (error) {
        return errorResponse(res, error);
    }
};

/**
 * Update manager
 */
exports.updateManager = async (req, res) => {
    try {
        const manager = await managerService.updateManager(req.params.id, req.body);
        return successResponse(res, manager, "Manager updated successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};

/**
 * Delete manager
 */
exports.deleteManager = async (req, res) => {
    try {
        await managerService.deleteManager(req.params.id);
        return successResponse(res, null, "Manager deleted successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};

/**
 * Get admin persons for selection
 */
exports.getAdminPersons = async (req, res) => {
    try {
        const adminPersons = await managerService.getAdminPersons();
        return successResponse(res, adminPersons, "Admin persons retrieved successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};