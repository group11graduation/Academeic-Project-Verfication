/**
 * Maintenance Controller - Handles HTTP requests for maintenance operations
 * Delegates business logic to MaintenanceService
 */

const maintenanceService = require("../services/maintenance.service");
const { successResponse, errorResponse } = require("../utils/responseHandler");

/**
 * Create a maintenance request
 */
exports.createRequest = async (req, res) => {
  try {
    const request = await maintenanceService.createMaintenanceRequest(req.body, req.user);
    return successResponse(res, request, "Maintenance request created successfully", 201);
  } catch (error) {
    return errorResponse(res, error);
  }
};

/**
 * Get all maintenance requests
 */
exports.getRequests = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      priority: req.query.priority,
      building: req.query.building
    };
    const requests = await maintenanceService.getMaintenanceRequests(filters, req.user);
    return successResponse(res, requests, "Maintenance requests retrieved successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

/**
 * Get a single maintenance request by ID
 */
exports.getRequestById = async (req, res) => {
  try {
    const request = await maintenanceService.getMaintenanceRequestById(req.params.requestId);
    return successResponse(res, request, "Maintenance request retrieved successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

/**
 * Update maintenance request
 */
exports.updateRequest = async (req, res) => {
  try {
    const request = await maintenanceService.updateMaintenanceRequest(
      req.params.requestId,
      req.body,
      req.user
    );
    return successResponse(res, request, "Maintenance request updated successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

/**
 * Assign maintenance request to user
 */
exports.assignRequest = async (req, res) => {
  try {
    const request = await maintenanceService.assignMaintenance(
      req.params.requestId,
      req.body.userId,
      req.user
    );
    return successResponse(res, request, "Maintenance request assigned successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

/**
 * Delete maintenance request
 */
exports.deleteRequest = async (req, res) => {
  try {
    await maintenanceService.deleteMaintenanceRequest(req.params.requestId, req.user);
    return successResponse(res, null, "Maintenance request deleted successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};
