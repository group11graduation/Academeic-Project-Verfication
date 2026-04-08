import api from '../lib/api';

const base = '/teacher';

const getDashboardStats = async () => {
    const response = await api.get(`${base}/dashboard/stats`);
    return response.data;
};

const getCatalog = async () => {
    const response = await api.get(`${base}/catalog`);
    return response.data;
};

const getMyClasses = async () => {
    const response = await api.get(`${base}/classes`);
    return response.data;
};

const getMySubjects = async () => {
    const response = await api.get(`${base}/subjects`);
    return response.data;
};

const getClassDetails = async (classId) => {
    const response = await api.get(`${base}/classes/${classId}`);
    return response.data;
};

const getClassStudents = async (classId) => {
    const response = await api.get(`${base}/classes/${classId}/students`);
    return response.data;
};

const getGroups = async (classId) => {
    const response = await api.get(`${base}/classes/${classId}/groups`);
    return response.data;
};

const generateGroups = async (classId, config) => {
    const response = await api.post(`${base}/classes/${classId}/groups/generate`, config);
    return response.data;
};

const getAllGroups = async () => {
    const response = await api.get(`${base}/groups`);
    return response.data;
};

const teacherService = {
    getDashboardStats,
    getCatalog,
    getMyClasses,
    getMySubjects,
    getClassDetails,
    getClassStudents,
    getGroups,
    generateGroups,
    getAllGroups,
    getGroupDetails: async (id) => {
        const response = await api.get(`${base}/groups/${id}`);
        return response.data;
    },

    createAssignment: async (formData) => {
        const response = await api.post(`${base}/assignments`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    /** JSON body — preferred for orchestration API */
    createAssignmentJson: async (body) => {
        const response = await api.post(`${base}/assignments`, body);
        return response.data;
    },

    getMyAssignments: async () => {
        const response = await api.get(`${base}/assignments`);
        return response.data;
    },

    getAssignmentById: async (id) => {
        const response = await api.get(`${base}/assignments/${id}`);
        return response.data;
    },

    getProposalsForAssignment: async (assignmentId) => {
        const response = await api.get(`${base}/assignments/${assignmentId}/proposals`);
        return response.data;
    },

    reviewProposal: async (proposalId, payload) => {
        const response = await api.patch(`${base}/proposals/${proposalId}/review`, payload);
        return response.data;
    },

    listGroupsForAssignment: async (assignmentId) => {
        const response = await api.get(`${base}/assignments/${assignmentId}/groups`);
        return response.data;
    },

    createGroup: async (assignmentId, body) => {
        const response = await api.post(`${base}/assignments/${assignmentId}/groups`, body);
        return response.data;
    },

    deleteAssignment: async (id) => {
        const response = await api.delete(`${base}/assignments/${id}`);
        return response.data;
    },

    submitAssignment: async (id, formData) => {
        const response = await api.post(`${base}/assignments/${id}/submit`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    startProposalPreview: async (proposalId) => {
        const response = await api.post(`${base}/proposals/${proposalId}/preview/start`);
        return response.data;
    },

    stopPreviewSession: async (sessionId) => {
        const response = await api.post(`${base}/preview-sessions/${sessionId}/stop`);
        return response.data;
    },

    getPreviewSession: async (sessionId) => {
        const response = await api.get(`${base}/preview-sessions/${sessionId}`);
        return response.data;
    }
};

export default teacherService;
