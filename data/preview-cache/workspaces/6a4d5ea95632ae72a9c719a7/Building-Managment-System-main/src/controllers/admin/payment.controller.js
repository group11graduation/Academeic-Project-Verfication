const paymentService = require("../../services/admin/payment.service");
const { successResponse, errorResponse } = require("../../utils/responseHandler");

exports.getAllPayments = async (req, res) => {
    try {
        const payments = await paymentService.getAllPayments();
        return successResponse(res, payments, "Payments retrieved successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};

exports.getPaymentsByBuilding = async (req, res) => {
    try {
        const payments = await paymentService.getPaymentsByBuilding(req.params.buildingId);
        return successResponse(res, payments, "Payments retrieved successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};

exports.getOverduePayments = async (req, res) => {
    try {
        const payments = await paymentService.getOverduePayments();
        return successResponse(res, payments, "Overdue payments retrieved successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};

exports.upsertPayment = async (req, res) => {
    try {
        const payment = await paymentService.upsertPayment(req.body);
        return successResponse(res, payment, "Payment record updated successfully", 201);
    } catch (error) {
        return errorResponse(res, error);
    }
};

exports.markAsPaid = async (req, res) => {
    try {
        const payment = await paymentService.markAsPaid(req.params.id, req.body.notes);
        return successResponse(res, payment, "Payment marked as paid successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};

exports.getPaymentStats = async (req, res) => {
    try {
        const stats = await paymentService.getPaymentStats();
        return successResponse(res, stats, "Payment statistics retrieved successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};
