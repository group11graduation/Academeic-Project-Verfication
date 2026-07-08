const Payment = require("../../models/Payment");
const Building = require("../../models/Building");
const User = require("../../models/User");
const { NotFoundError, ValidationError } = require("../../utils/errorTypes");

class PaymentService {
    /**
     * Get all payments
     */
    async getAllPayments() {
        const payments = await Payment.find()
            .populate("building", "name location")
            .populate("manager", "name email")
            .sort({ nextDueDate: 1 })
            .lean();
        return payments;
    }

    /**
     * Get payments for a specific building
     */
    async getPaymentsByBuilding(buildingId) {
        const payments = await Payment.find({ building: buildingId })
            .populate("manager", "name email")
            .sort({ nextDueDate: 1 })
            .lean();
        return payments;
    }

    /**
     * Get overdue payments
     */
    async getOverduePayments() {
        const now = new Date();
        const payments = await Payment.find({
            nextDueDate: { $lt: now },
            status: { $ne: "PAID" }
        })
            .populate("building", "name location")
            .populate("manager", "name email")
            .sort({ nextDueDate: 1 })
            .lean();
        return payments;
    }

    /**
     * Create or update payment record
     */
    async upsertPayment(paymentData) {
        const { buildingId, managerId, amount, frequency } = paymentData;

        if (!buildingId || !managerId || !amount) {
            throw new ValidationError("Building, manager, and amount are required");
        }

        // Validate building and manager exist
        const building = await Building.findById(buildingId);
        const manager = await User.findById(managerId);

        if (!building) throw new NotFoundError("Building");
        if (!manager || manager.role !== "MANAGER") {
            throw new ValidationError("Invalid manager");
        }

        // Calculate next due date
        const nextDueDate = this.calculateNextDueDate(frequency);

        // Check if payment record exists
        let payment = await Payment.findOne({ building: buildingId, manager: managerId });

        if (payment) {
            payment.amount = amount;
            payment.frequency = frequency;
            payment.nextDueDate = nextDueDate;
            payment.status = this.calculateStatus(nextDueDate);
        } else {
            payment = new Payment({
                building: buildingId,
                manager: managerId,
                amount,
                frequency,
                nextDueDate,
                status: this.calculateStatus(nextDueDate)
            });
        }

        await payment.save();
        await payment.populate("building", "name location");
        await payment.populate("manager", "name email");
        return payment;
    }

    /**
     * Mark payment as paid
     */
    async markAsPaid(paymentId, notes = "") {
        const payment = await Payment.findById(paymentId);
        if (!payment) {
            throw new NotFoundError("Payment");
        }

        payment.status = "PAID";
        payment.lastPaidDate = new Date();
        payment.nextDueDate = this.calculateNextDueDate(payment.frequency);

        // Add to payment history
        payment.paymentHistory.push({
            amount: payment.amount,
            paidDate: new Date(),
            notes
        });

        await payment.save();
        await payment.populate("building", "name location");
        await payment.populate("manager", "name email");
        return payment;
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
     * Calculate payment status
     */
    calculateStatus(nextDueDate) {
        const now = new Date();
        if (nextDueDate < now) {
            return "OVERDUE";
        }
        const daysUntilDue = Math.ceil((nextDueDate - now) / (1000 * 60 * 60 * 24));
        if (daysUntilDue <= 7) {
            return "PENDING";
        }
        return "PENDING";
    }

    /**
     * Get payment statistics
     */
    async getPaymentStats() {
        const total = await Payment.countDocuments();
        const paid = await Payment.countDocuments({ status: "PAID" });
        const pending = await Payment.countDocuments({ status: "PENDING" });
        const overdue = await Payment.countDocuments({ status: "OVERDUE" });

        const now = new Date();
        const upcoming = await Payment.countDocuments({
            nextDueDate: { $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
            status: { $ne: "PAID" }
        });

        return { total, paid, pending, overdue, upcoming };
    }
}

module.exports = new PaymentService();
