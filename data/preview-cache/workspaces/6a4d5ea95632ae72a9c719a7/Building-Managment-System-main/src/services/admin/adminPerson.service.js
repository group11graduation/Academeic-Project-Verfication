const AdminPerson = require("../../models/AdminPerson");
const { NotFoundError, ValidationError, ConflictError } = require("../../utils/errorTypes");

class AdminPersonService {
    /**
     * Get all admin persons
     */
    async getAllAdminPersons() {
        return await AdminPerson.find().sort({ createdAt: -1 });
    }

    /**
     * Get admin person by ID
     */
    async getAdminPersonById(id) {
        const adminPerson = await AdminPerson.findById(id);
        if (!adminPerson) {
            throw new NotFoundError("Admin Person");
        }
        return adminPerson;
    }

    /**
     * Create new admin person
     */
    async createAdminPerson(data) {
        const { name, email, phone, notes } = data;

        // Check if email already exists
        const existing = await AdminPerson.findOne({ email: email.toLowerCase() });
        if (existing) {
            throw new ConflictError("Email already exists");
        }

        const adminPerson = new AdminPerson({
            name,
            email: email.toLowerCase(),
            phone,
            notes
        });

        await adminPerson.save();
        return adminPerson;
    }

    /**
     * Update admin person
     */
    async updateAdminPerson(id, updateData) {
        const { name, email, phone, notes } = updateData;

        const adminPerson = await AdminPerson.findById(id);
        if (!adminPerson) {
            throw new NotFoundError("Admin Person");
        }

        // Check if email is being changed and if it's already taken
        if (email && email.toLowerCase() !== adminPerson.email) {
            const existing = await AdminPerson.findOne({ email: email.toLowerCase() });
            if (existing) {
                throw new ConflictError("Email already exists");
            }
            adminPerson.email = email.toLowerCase();
        }

        if (name) adminPerson.name = name;
        if (phone) adminPerson.phone = phone;
        if (notes !== undefined) adminPerson.notes = notes;

        await adminPerson.save();
        return adminPerson;
    }

    /**
     * Delete admin person
     */
    async deleteAdminPerson(id) {
        const adminPerson = await AdminPerson.findById(id);
        if (!adminPerson) {
            throw new NotFoundError("Admin Person");
        }

        await AdminPerson.findByIdAndDelete(id);
        return { message: "Admin Person deleted successfully" };
    }
}

module.exports = new AdminPersonService();
