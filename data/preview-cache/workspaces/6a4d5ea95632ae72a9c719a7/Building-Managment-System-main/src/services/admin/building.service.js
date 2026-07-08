/**
 * Building Service - Business logic for building operations
 */

const Building = require("../../models/Building");
const Floor = require("../../models/Floor");
const Room = require("../../models/Room");
const User = require("../../models/User");
const Payment = require("../../models/Payment");
const BuildingApprovalRequest = require("../../models/BuildingApprovalRequest");
const ROLES = require("../../enums/roles.enum");
const APPROVAL_POLICY = require("../../enums/approvalPolicy.enum");
const { NotFoundError, ValidationError } = require("../../utils/errorTypes");
const { BuildingResponseDTO, BuildingListDTO } = require("../../dto/building.dto");

class BuildingService {
    /**
     * Get all buildings
     */
    async getAllBuildings() {
        // This transforms the ID into { _id, name, email }
        const buildings = await Building.find()
            .populate("manager", "name email") 
            .lean(); // .lean() makes it a plain JS object for faster DTO processing
        return new BuildingListDTO(buildings);
    }

    /**
     * Get building by ID
     */
    async getBuildingById(buildingId) {
        const building = await Building.findById(buildingId).populate("manager", "name email");
        if (!building) {
            throw new NotFoundError("Building");
        }
        return new BuildingResponseDTO(building);
    }

    /**
     * Create new building
     */
    async createBuilding(buildingData) {
        const { 
            name, 
            location, 
            managerId, 
            approvalPolicy, 
            brandingName, 
            brandingLogo, 
            floorLimit,        // Now receiving the number
            allowedRoomTypes,  // Now receiving the array of strings
            paymentDetails     // Payment details for this building
        } = buildingData;

        // 1. Validate required fields
        if (!name || !location || !managerId) {
            throw new ValidationError("Name, location, and manager are required");
        }

        // 2. Validate manager exists and has correct role
        const manager = await User.findById(managerId);
        if (!manager || manager.role !== ROLES.MANAGER) {
            throw new ValidationError("Invalid manager ID or user is not a manager");
        }

        // 3. Validate approval policy
        const validPolicies = Object.values(APPROVAL_POLICY);
        const policy = approvalPolicy || APPROVAL_POLICY.MANAGER_ONLY;
        if (!validPolicies.includes(policy)) {
            throw new ValidationError("Invalid approval policy");
        }

        // 4. If policy is BOTH, create approval request instead of building directly
        if (policy === APPROVAL_POLICY.BOTH) {
            const approvalRequest = new BuildingApprovalRequest({
                buildingData: {
                    name,
                    location,
                    managerId,
                    approvalPolicy: policy,
                    brandingName: brandingName || "",
                    brandingLogo: brandingLogo || "",
                    floorLimit: Number(floorLimit) || 0,
                    allowedRoomTypes: Array.isArray(allowedRoomTypes) ? allowedRoomTypes : []
                },
                requestedBy: requestUser?.id || managerId, // Use request user or manager
                approvalPolicy: policy,
                status: "PENDING"
            });
            await approvalRequest.save();
            return { 
                isPending: true, 
                approvalRequestId: approvalRequest._id,
                message: "Building creation request submitted. Waiting for manager and admin approval." 
            };
        }

        // 5. Create building with simple structure (for MANAGER_ONLY policy)
        const building = new Building({
            name,
            location,
            manager: managerId,
            approvalPolicy: policy,
            brandingName: brandingName || "",
            brandingLogo: brandingLogo || "",
            floorLimit: Number(floorLimit) || 0, // Ensure it's a number
            allowedRoomTypes: Array.isArray(allowedRoomTypes) ? allowedRoomTypes : []
        });

        await building.save();

        // 6. Create payment record if building has payment details
        if (paymentDetails && paymentDetails.amount && paymentDetails.frequency) {
            // Check if payment record already exists (avoid duplicates)
            let payment = await Payment.findOne({ building: building._id, manager: managerId });
            
            const paymentAmount = Number(paymentDetails.amount);
            const paymentFrequency = paymentDetails.frequency;
            
            if (!payment) {
                const nextDueDate = this.calculateNextDueDate(paymentFrequency);
                payment = new Payment({
                    building: building._id,
                    manager: managerId,
                    amount: paymentAmount,
                    frequency: paymentFrequency,
                    nextDueDate,
                    status: this.calculatePaymentStatus(nextDueDate)
                });
                await payment.save();
            } else {
                // Update existing payment record with latest details
                payment.amount = paymentAmount;
                payment.frequency = paymentFrequency;
                payment.nextDueDate = this.calculateNextDueDate(paymentFrequency);
                payment.status = this.calculatePaymentStatus(payment.nextDueDate);
                await payment.save();
            }
        }

        // Note: We removed the nested Floor.create and Room.create loops.
        // The Manager will handle this from their dashboard later.

        // 7. Populate and Return
        await building.populate("manager", "name email");
        return new BuildingResponseDTO(building);
    }

    /**
     * Update building details
     */
    async updateBuilding(buildingId, updateData) {
        const { name, location, managerId, approvalPolicy, brandingName, brandingLogo, paymentDetails } = updateData;

        // Check if building exists
        const building = await Building.findById(buildingId);
        if (!building) {
            throw new NotFoundError("Building");
        }

        // Validate manager if provided
        if (managerId) {
            const manager = await User.findById(managerId);
            if (!manager || manager.role !== ROLES.MANAGER) {
                throw new ValidationError("Invalid manager ID");
            }
            building.manager = managerId;
        }

        // Validate approval policy if provided
        if (approvalPolicy) {
            const validPolicies = Object.values(APPROVAL_POLICY);
            if (!validPolicies.includes(approvalPolicy)) {
                throw new ValidationError("Invalid approval policy");
            }
            building.approvalPolicy = approvalPolicy;
        }

        // Update fields
        if (name) building.name = name;
        if (location) building.location = location;
        if (typeof brandingName !== "undefined") building.brandingName = brandingName;
        if (typeof brandingLogo !== "undefined") building.brandingLogo = brandingLogo;
        if (typeof updateData.floorLimit !== "undefined") building.floorLimit = updateData.floorLimit;
        if (typeof updateData.allowedRoomTypes !== "undefined") building.allowedRoomTypes = updateData.allowedRoomTypes;

        // Update payment record if paymentDetails are provided in updateData
        const currentManagerId = managerId || building.manager?.toString() || building.manager;
        if (updateData.paymentDetails?.amount && updateData.paymentDetails?.frequency) {
            let payment = await Payment.findOne({ building: buildingId, manager: currentManagerId });
            
            if (payment) {
                payment.amount = Number(updateData.paymentDetails.amount);
                payment.frequency = updateData.paymentDetails.frequency;
                payment.nextDueDate = this.calculateNextDueDate(updateData.paymentDetails.frequency);
                payment.status = this.calculatePaymentStatus(payment.nextDueDate);
                // Update manager if changed
                if (managerId && managerId !== building.manager?.toString()) {
                    payment.manager = managerId;
                }
            } else {
                const nextDueDate = this.calculateNextDueDate(updateData.paymentDetails.frequency);
                payment = new Payment({
                    building: buildingId,
                    manager: currentManagerId,
                    amount: Number(updateData.paymentDetails.amount),
                    frequency: updateData.paymentDetails.frequency,
                    nextDueDate,
                    status: this.calculatePaymentStatus(nextDueDate)
                });
            }
            await payment.save();
        } else if (managerId && managerId !== building.manager?.toString()) {
            // If manager changed but no payment details provided, update existing payment's manager reference
            const payment = await Payment.findOne({ building: buildingId });
            if (payment) {
                payment.manager = managerId;
                await payment.save();
            }
        }

        await building.save();
        await building.populate("manager", "name email");
        return new BuildingResponseDTO(building);
    }

    /**
     * Delete building
     */
    async deleteBuilding(buildingId) {
        const building = await Building.findById(buildingId);
        if (!building) {
            throw new NotFoundError("Building");
        }

        await Building.findByIdAndDelete(buildingId);
        return { id: buildingId };
    }

    /**
     * Calculate next due date based on frequency
     */
    calculateNextDueDate(frequency) {
        const date = new Date();
        switch (frequency) {
            case "MONTHLY":
                date.setMonth(date.getMonth() + 1);
                break;
            case "QUARTERLY":
                date.setMonth(date.getMonth() + 3);
                break;
            case "YEARLY":
                date.setFullYear(date.getFullYear() + 1);
                break;
            default:
                date.setMonth(date.getMonth() + 1);
        }
        return date;
    }

    /**
     * Calculate payment status based on due date
     */
    calculatePaymentStatus(nextDueDate) {
        const now = new Date();
        if (nextDueDate < now) {
            return "OVERDUE";
        }
        return "PENDING";
    }
}

module.exports = new BuildingService();
