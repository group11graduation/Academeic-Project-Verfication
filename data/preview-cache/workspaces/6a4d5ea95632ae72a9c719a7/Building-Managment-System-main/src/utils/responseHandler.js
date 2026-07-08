/**
 * Standardized API response handlers
 */

const successResponse = (res, data = null, message = "Success", statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

const errorResponse = (res, error, statusCode = 500) => {
    const message = error.message || "Internal server error";
    const status = error.statusCode || statusCode;

    return res.status(status).json({
        success: false,
        message,
        error: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
};

const paginatedResponse = (res, data, page, limit, total, message = "Success") => {
    return res.status(200).json({
        success: true,
        message,
        data,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
        }
    });
};

module.exports = {
    successResponse,
    errorResponse,
    paginatedResponse
};
