const APPROVAL_POLICY = {
    MANAGER_ONLY: "MANAGER_ONLY",
    MANAGER_AND_SUB: "MANAGER_AND_SUB",
    BOTH: "BOTH" // Both manager and admin need to approve (if one approves, it's ok)
};

module.exports = APPROVAL_POLICY;
