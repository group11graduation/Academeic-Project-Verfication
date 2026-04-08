import api from '../lib/api';

const base = '/student';

const studentService = {
    getDashboard: async () => {
        try {
            const response = await api.get(`${base}/dashboard`);
            return response.data;
        } catch (error) {
            return error.response?.data || { success: false, message: 'Server Error' };
        }
    },

    getAssignments: async () => {
        const response = await api.get(`${base}/assignments`);
        return response.data;
    },

    getAssignment: async (assignmentId) => {
        const response = await api.get(`${base}/assignments/${assignmentId}`);
        return response.data;
    },

    submitProposal: async (assignmentId, body) => {
        const response = await api.post(`${base}/assignments/${assignmentId}/proposals`, body);
        return response.data;
    },

    getProposal: async (proposalId) => {
        const response = await api.get(`${base}/proposals/${proposalId}`);
        return response.data;
    },

    getProjectAccess: async (assignmentId) => {
        const response = await api.get(`${base}/assignments/${assignmentId}/project-access`);
        return response.data;
    },

    /** Multipart ZIP field name: codeArchive */
    submitProjectCode: async (assignmentId, file) => {
        const fd = new FormData();
        fd.append('codeArchive', file);
        const response = await api.post(`${base}/assignments/${assignmentId}/project-code`, fd);
        return response.data;
    },

    getProjectDetails: async (id) => {
        try {
            const response = await api.get(`${base}/projects/${id}`);
            return response.data;
        } catch (error) {
            return error.response?.data || { success: false, message: 'Server Error' };
        }
    }
};

export default studentService;
