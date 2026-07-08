/**
 * Building Approval Controller - Handles building approval requests
 */

const BuildingApprovalRequest = require("../../models/BuildingApprovalRequest");
const Building = require("../../models/Building");
const User = require("../../models/User");
const { successResponse, errorResponse } = require("../../utils/responseHandler");
const APPROVAL_POLICY = require("../../enums/approvalPolicy.enum");

/**
 * Get all pending building approval requests
 */
exports.getPendingBuildingApprovals = async (req, res) => {
    try {
        const requests = await BuildingApprovalRequest.find({
            status: "PENDING"
        })
        .populate("requestedBy", "name email")
        .populate("managerApprovedBy", "name email")
        .populate("adminApprovedBy", "name email")
        .sort({ createdAt: -1 });
        
        return successResponse(res, requests, "Pending building approvals retrieved successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};

/**
 * Get building approval requests for manager
 */
exports.getManagerBuildingApprovals = async (req, res) => {
    try {
        const managerId = req.user.id;
        const requests = await BuildingApprovalRequest.find({
            status: "PENDING",
            "buildingData.managerId": managerId
        })
        .populate("requestedBy", "name email")
        .populate("adminApprovedBy", "name email")
        .sort({ createdAt: -1 });
        
        return successResponse(res, requests, "Manager building approvals retrieved successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};

/**
 * Approve building creation (Manager or Admin)
 */
exports.approveBuildingCreation = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;
        const user = req.user;
        const isAdmin = user.role === "SUPER_ADMIN";
        const isManager = user.role === "MANAGER";

        const request = await BuildingApprovalRequest.findById(id);
        if (!request) {
            return errorResponse(res, { message: "Approval request not found" }, 404);
        }

        if (request.status !== "PENDING") {
            return errorResponse(res, { message: "Request is no longer pending" }, 400);
        }

        // Check if user has permission
        if (isAdmin) {
            request.adminApproved = status === "APPROVED";
            request.adminApprovedBy = status === "APPROVED" ? user.id : null;
        } else if (isManager) {
            // Verify this manager is the assigned manager for this building
            if (request.buildingData.managerId.toString() !== user.id.toString()) {
                return errorResponse(res, { message: "You are not authorized to approve this building" }, 403);
            }
            request.managerApproved = status === "APPROVED";
            request.managerApprovedBy = status === "APPROVED" ? user.id : null;
        } else {
            return errorResponse(res, { message: "Unauthorized" }, 403);
        }

        // If rejected, set status to REJECTED
        if (status === "REJECTED") {
            request.status = "REJECTED";
            request.rejectedBy = user.id;
            request.reason = reason;
            await request.save();
            return successResponse(res, request, "Building creation request rejected");
        }

        // Check if both approvals are needed and if we have at least one
        if (request.approvalPolicy === APPROVAL_POLICY.BOTH) {
            // If one approves, it's ok (as per user requirement)
            if (request.managerApproved || request.adminApproved) {
                // Create the building directly (bypass approval check since we're already approved)
                const building = new Building({
                    name: request.buildingData.name,
                    location: request.buildingData.location,
                    manager: request.buildingData.managerId,
                    approvalPolicy: request.buildingData.approvalPolicy,
                    brandingName: request.buildingData.brandingName || "",
                    brandingLogo: request.buildingData.brandingLogo || "",
                    floorLimit: Number(request.buildingData.floorLimit) || 0,
                    allowedRoomTypes: Array.isArray(request.buildingData.allowedRoomTypes) ? request.buildingData.allowedRoomTypes : []
                });
                await building.save();
                await building.populate("manager", "name email");
                
                request.status = "APPROVED";
                await request.save();
                return successResponse(res, { building, request }, "Building created successfully after approval");
            }
        } else {
            // MANAGER_ONLY policy - should not reach here, but handle it
            if (request.managerApproved) {
                const building = new Building({
                    name: request.buildingData.name,
                    location: request.buildingData.location,
                    manager: request.buildingData.managerId,
                    approvalPolicy: request.buildingData.approvalPolicy,
                    brandingName: request.buildingData.brandingName || "",
                    brandingLogo: request.buildingData.brandingLogo || "",
                    floorLimit: Number(request.buildingData.floorLimit) || 0,
                    allowedRoomTypes: Array.isArray(request.buildingData.allowedRoomTypes) ? request.buildingData.allowedRoomTypes : []
                });
                await building.save();
                await building.populate("manager", "name email");
                
                request.status = "APPROVED";
                await request.save();
                return successResponse(res, { building, request }, "Building created successfully");
            }
        }

        // Save partial approval
        await request.save();
        return successResponse(res, request, isAdmin ? "Admin approval recorded. Waiting for manager approval." : "Manager approval recorded. Waiting for admin approval.");
    } catch (error) {
        console.error("Approve building error:", error);
        return errorResponse(res, error);
    }
};
