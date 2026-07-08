/**
 * Maintenance Service - Business logic for maintenance request operations
 */

const Maintenance = require("../models/Maintenance");
const Building = require("../models/Building");
const User = require("../models/User");
const ROLES = require("../enums/roles.enum");
const { MAINTENANCE_STATUS } = require("../enums/status.enum");
const { NotFoundError, ValidationError, ForbiddenError } = require("../utils/errorTypes");
const { MaintenanceResponseDTO, MaintenanceListDTO } = require("../dto/maintenance.dto");

class MaintenanceService {
    /**
     * Create maintenance request
     */
    async createMaintenanceRequest(requestData, user) {
        const { title, description, building, floor, room } = requestData;

        // Validate required fields
        if (!title || !description) {
            throw new ValidationError("Title and description are required");
        }

        // Use user's building if not provided
        const buildingId = building || user.building;
        if (!buildingId) {
            throw new ValidationError("Building is required");
        }

        // Verify building exists
        const buildingExists = await Building.findById(buildingId);
        if (!buildingExists) {
            throw new NotFoundError("Building");
        }

        // Create maintenance request
        const maintenanceRequest = new Maintenance({
            title,
            description,
            building: buildingId,
            floor,
            room,
            reportedBy: user.id,
            status: MAINTENANCE_STATUS.PENDING
        });

        await maintenanceRequest.save();
        await maintenanceRequest.populate([
            { path: "building", select: "name" },
            { path: "floor", select: "floorNumber" },
            { path: "room", select: "roomNumber type" }
        ]);

        return new MaintenanceResponseDTO(maintenanceRequest);
    }

    /**
     * Get maintenance requests with filters
     */
    async getMaintenanceRequests(filters = {}, user) {
        const query = {};

        // Filter by building for managers/sub-managers
        if (user.role === ROLES.MANAGER || user.role === ROLES.SUB_MANAGER) {
            query.building = user.building;
        }

        // Apply additional filters
        if (filters.status) {
            query.status = filters.status;
        }
        if (filters.building) {
            query.building = filters.building;
        }
        if (filters.priority) {
            query.priority = filters.priority;
        }

        const requests = await Maintenance.find(query)
            .populate("building", "name")
            .populate("floor", "floorNumber")
            .populate("room", "roomNumber type")
            .populate("assignedTo", "name")
            .sort({ createdAt: -1 });

        return new MaintenanceListDTO(requests);
    }

    /**
     * Get maintenance request by ID
     */
    async getMaintenanceRequestById(requestId) {
        const request = await Maintenance.findById(requestId)
            .populate("building", "name")
            .populate("floor", "floorNumber")
            .populate("room", "roomNumber type")
            .populate("assignedTo", "name");

        if (!request) {
            throw new NotFoundError("Maintenance request");
        }

        return new MaintenanceResponseDTO(request);
    }

    /**
     * Update maintenance request
     */
    async updateMaintenanceRequest(requestId, updateData, user) {
        const { status, assignedToName } = updateData;

        // Verify user has permission
        if (![ROLES.MANAGER, ROLES.SUB_MANAGER, ROLES.ADMIN].includes(user.role)) {
            throw new ForbiddenError("Not authorized to update maintenance requests");
        }

        // Find request
        const request = await Maintenance.findById(requestId);
        if (!request) {
            throw new NotFoundError("Maintenance request");
        }

        // Update status if provided
        if (status) {
            const validStatuses = Object.values(MAINTENANCE_STATUS);
            if (!validStatuses.includes(status)) {
                throw new ValidationError("Invalid status");
            }
            request.status = status;
        }

        // Update assigned user if provided
        if (assignedToName) {
            const assignedUser = await User.findOne({ name: assignedToName });
            if (!assignedUser) {
                throw new NotFoundError("Assigned user");
            }
            request.assignedTo = assignedUser._id;
        }

        await request.save();
        await request.populate([
            { path: "building", select: "name" },
            { path: "floor", select: "floorNumber" },
            { path: "room", select: "roomNumber type" },
            { path: "assignedTo", select: "name" }
        ]);

        return new MaintenanceResponseDTO(request);
    }

    /**
     * Assign maintenance request to user
     */
    async assignMaintenance(requestId, userId, user) {
        // Verify user has permission
        if (![ROLES.MANAGER, ROLES.SUB_MANAGER, ROLES.SUPER_ADMIN].includes(user.role)) {
            throw new ForbiddenError("Not authorized to assign maintenance requests");
        }

        const request = await Maintenance.findById(requestId);
        if (!request) {
            throw new NotFoundError("Maintenance request");
        }

        const assignedUser = await User.findById(userId);
        if (!assignedUser) {
            throw new NotFoundError("User");
        }

        request.assignedTo = userId;
        request.status = MAINTENANCE_STATUS.IN_PROGRESS;
        await request.save();

        await request.populate([
            { path: "building", select: "name" },
            { path: "assignedTo", select: "name" }
        ]);

        return new MaintenanceResponseDTO(request);
    }

    /**
     * Delete maintenance request
     */
    async deleteMaintenanceRequest(requestId, user) {
        // Only admins and managers can delete
        if (![ROLES.ADMIN, ROLES.MANAGER].includes(user.role)) {
            throw new ForbiddenError("Not authorized to delete maintenance requests");
        }

        const request = await Maintenance.findById(requestId);
        if (!request) {
            throw new NotFoundError("Maintenance request");
        }

        await Maintenance.findByIdAndDelete(requestId);
        return { id: requestId };
    }
}

module.exports = new MaintenanceService();
