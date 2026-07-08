exports.canDirectUpdate = (user) => user.role === "MANAGER";
exports.canDirectDelete = (user) => user.role === "MANAGER";

exports.requiresApproval = (user) => user.role === "SUB_MANAGER";
