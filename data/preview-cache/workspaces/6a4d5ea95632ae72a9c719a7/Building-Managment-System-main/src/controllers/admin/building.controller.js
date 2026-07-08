/**
 * Building Controller - Handles HTTP requests for building operations
 * Delegates business logic to BuildingService
 */

const buildingService = require("../../services/admin/building.service");
const { successResponse, errorResponse } = require("../../utils/responseHandler");

/**
 * Get all buildings
 */
exports.getAllBuildings = async (req, res) => {
    try {
        const buildings = await buildingService.getAllBuildings();
        return successResponse(res, buildings, "Buildings retrieved successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};

/**
 * Get building by ID
 */
exports.getBuildingById = async (req, res) => {
    try {
        const building = await buildingService.getBuildingById(req.params.id);
        return successResponse(res, building, "Building retrieved successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};

/**
 * Create new building
 */
exports.createBuilding = async (req, res) => {
    try {
        // We pass req.body directly, but we can also explicitly 
        // ensure types are correct before hitting the service
        const buildingData = {
            ...req.body,
            // Ensure floorLimit is a number so the service doesn't fail validation
            floorLimit: req.body.floorLimit ? Number(req.body.floorLimit) : 0
        };

        const building = await buildingService.createBuilding(buildingData, req.user);
        
        return successResponse(
            res, 
            building, 
            "Building registered successfully. Manager can now configure rooms.", 
            201
        );
    } catch (error) {
        // Log the error for the developer to see in the terminal
        console.error("Controller Error [createBuilding]:", error);
        
        return errorResponse(res, error);
    }
};

/**
 * Update building
 */
exports.updateBuilding = async (req, res) => {
    try {
        const building = await buildingService.updateBuilding(req.params.id, req.body);
        return successResponse(res, building, "Building updated successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};

/**
 * Delete building
 */
exports.deleteBuilding = async (req, res) => {
    try {
        await buildingService.deleteBuilding(req.params.id);
        return successResponse(res, null, "Building deleted successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};
