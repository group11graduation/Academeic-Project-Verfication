import api from '../lib/api';

const getClasses = async () => {
    const response = await api.get('/admin/classes');
    return response.data;
};

const getClass = async (code) => {
    const response = await api.get(`/admin/classes/${encodeURIComponent(code)}`);
    return response.data;
};

const createClass = async (classData) => {
    const response = await api.post('/admin/classes', classData);
    return response.data;
};

const updateClass = async (code, classData) => {
    const response = await api.put(`/admin/classes/${encodeURIComponent(code)}`, classData);
    return response.data;
};

const assignTeacher = async (code, payload) => {
    const response = await api.post(`/admin/classes/${encodeURIComponent(code)}/assign-teacher`, payload);
    return response.data;
};

/** Reserved for Phase 2+ (bulk account generation) */
const generateAccounts = async (code) => {
    const response = await api.post(`/admin/classes/${encodeURIComponent(code)}/generate-accounts`, {});
    return response.data;
};

const adminClassService = {
    getClasses,
    getClass,
    createClass,
    updateClass,
    assignTeacher,
    generateAccounts
};

export default adminClassService;
