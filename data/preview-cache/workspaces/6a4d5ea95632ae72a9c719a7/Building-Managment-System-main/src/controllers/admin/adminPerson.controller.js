const adminPersonService = require("../../services/admin/adminPerson.service");
const { successResponse, errorResponse } = require("../../utils/responseHandler");

exports.getAllAdminPersons = async (req, res) => {
    try {
        const adminPersons = await adminPersonService.getAllAdminPersons();
        return successResponse(res, adminPersons, "Admin persons retrieved successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};

exports.getAdminPersonById = async (req, res) => {
    try {
        const adminPerson = await adminPersonService.getAdminPersonById(req.params.id);
        return successResponse(res, adminPerson, "Admin person retrieved successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};

exports.createAdminPerson = async (req, res) => {
    try {
        const adminPerson = await adminPersonService.createAdminPerson(req.body);
        return successResponse(res, adminPerson, "Admin person created successfully", 201);
    } catch (error) {
        return errorResponse(res, error);
    }
};

exports.updateAdminPerson = async (req, res) => {
    try {
        const adminPerson = await adminPersonService.updateAdminPerson(req.params.id, req.body);
        return successResponse(res, adminPerson, "Admin person updated successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};

exports.deleteAdminPerson = async (req, res) => {
    try {
        const result = await adminPersonService.deleteAdminPerson(req.params.id);
        return successResponse(res, result, "Admin person deleted successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};
