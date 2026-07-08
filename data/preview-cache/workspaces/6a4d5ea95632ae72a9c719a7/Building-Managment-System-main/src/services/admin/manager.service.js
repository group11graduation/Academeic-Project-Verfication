/**
 * Manager Service - Business logic for manager operations
 */

const User = require("../../models/User");
const Building = require("../../models/Building");
const Payment = require("../../models/Payment");
const bcrypt = require("bcrypt");
const ROLES = require("../../enums/roles.enum");
const { NotFoundError, ConflictError, ValidationError } = require("../../utils/errorTypes");
const { UserResponseDTO, UserListDTO } = require("../../dto/user.dto");

class ManagerService {
    /**
     * Get all managers
     */
    async getAllManagers() {
        const managers = await User.find({ role: ROLES.MANAGER }).select("-password").populate("adminPerson", "name email phone");
        return new UserListDTO(managers);
    }

    /**
     * Get all admin persons for selection
     */
    async getAdminPersons() {
        const AdminPerson = require("../../models/AdminPerson");
        return await AdminPerson.find().select("name email phone _id").sort({ name: 1 });
    }

    /**
     * Get manager by ID
     */
    async getManagerById(managerId) {
        const manager = await User.findById(managerId).select("-password").populate("adminPerson", "name email phone");
        if (!manager || manager.role !== ROLES.MANAGER) {
            throw new NotFoundError("Manager");
        }
        return new UserResponseDTO(manager);
    }

    /**
     * Create new manager
     */
    async createManager(managerData) {
        const { name, email, password, phone, buildingLogo, paymentDetails, allowedRoomTypes, sections, adminPerson } = managerData;

        // Validate required fields
        if (!name || !email || !password) {
            throw new ValidationError("Name, email, and password are required");
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new ConflictError("Email already exists");
        }

        // Validate adminPerson if provided
        if (adminPerson) {
            const AdminPerson = require("../../models/AdminPerson");
            const adminPersonDoc = await AdminPerson.findById(adminPerson);
            if (!adminPersonDoc) {
                throw new ValidationError("Invalid admin person ID");
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create manager
        const manager = new User({
            name,
            email,
            password: hashedPassword,
            role: ROLES.MANAGER,
            phone,
            buildingLogo,
            paymentDetails,
            allowedRoomTypes,
            sections,
            adminPerson: adminPerson || null
        });

        await manager.save();
        await manager.populate("adminPerson", "name email");
        
        // Create payment record if manager is assigned to a building
        await this.syncPaymentRecord(manager);
        
        return new UserResponseDTO(manager);
    }

    /**
     * Update manager details
     */
    async updateManager(managerId, updateData) {
        const { name, email, phone, buildingLogo, paymentDetails, allowedRoomTypes, sections, floorLimit, adminPerson } = updateData;

        // Check if manager exists
        const manager = await User.findById(managerId);
        if (!manager || manager.role !== ROLES.MANAGER) {
            throw new NotFoundError("Manager");
        }

        // Check if email is being changed and if it's already taken
        if (email && email !== manager.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                throw new ConflictError("Email already exists");
            }
        }

        // Validate adminPerson if provided
        if (adminPerson !== undefined && adminPerson !== null && adminPerson !== "") {
            const AdminPerson = require("../../models/AdminPerson");
            const adminPersonDoc = await AdminPerson.findById(adminPerson);
            if (!adminPersonDoc) {
                throw new ValidationError("Invalid admin person ID");
            }
            manager.adminPerson = adminPerson;
        } else if (adminPerson === null || adminPerson === "") {
            manager.adminPerson = null;
        }

        // Update fields
        if (name) manager.name = name;
        if (email) manager.email = email;
        if (phone !== undefined) manager.phone = phone;
        // buildingLogo can be an empty string to clear it, or a new image
        if (buildingLogo !== undefined) manager.buildingLogo = buildingLogo || "";
        if (paymentDetails) manager.paymentDetails = paymentDetails;
        if (sections) manager.sections = sections;

        await manager.save();
        await manager.populate("adminPerson", "name email");
        
        // Sync payment record if payment details changed
        if (updateData.paymentDetails) {
            await this.syncPaymentRecord(manager);
        }
        
        return new UserResponseDTO(manager);
    }

    /**
     * Sync payment record for manager
     */
    async syncPaymentRecord(manager) {
        if (!manager.paymentDetails?.amount || !manager.paymentDetails?.frequency) {
            return;
        }

        // Find building assigned to this manager
        const building = await Building.findOne({ manager: manager._id });
        if (!building) {
            return;
        }

        // Calculate next due date
        const nextDueDate = this.calculateNextDueDate(manager.paymentDetails.frequency);

        // Create or update payment record
        let payment = await Payment.findOne({ building: building._id, manager: manager._id });
        
        if (payment) {
            payment.amount = manager.paymentDetails.amount;
            payment.frequency = manager.paymentDetails.frequency;
            payment.nextDueDate = nextDueDate;
            payment.status = this.calculatePaymentStatus(nextDueDate);
        } else {
            payment = new Payment({
                building: building._id,
                manager: manager._id,
                amount: manager.paymentDetails.amount,
                frequency: manager.paymentDetails.frequency,
                nextDueDate,
                status: this.calculatePaymentStatus(nextDueDate)
            });
        }

        await payment.save();
    }

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

    calculatePaymentStatus(nextDueDate) {
        const now = new Date();
        if (nextDueDate < now) {
            return "OVERDUE";
        }
        return "PENDING";
    }

    /**
     * Delete manager
     */
    async deleteManager(managerId) {
        const manager = await User.findById(managerId);
        if (!manager || manager.role !== ROLES.MANAGER) {
            throw new NotFoundError("Manager");
        }

        await User.findByIdAndDelete(managerId);
        return { id: managerId };
    }
}

module.exports = new ManagerService();
