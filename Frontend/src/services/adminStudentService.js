import api, { IMPORT_TIMEOUT_MS } from '../lib/api';

const API_URL = '/admin/students';

const getStudents = async () => {
    const response = await api.get(API_URL);
    return response.data;
};

const getStudent = async (id) => {
    const response = await api.get(`${API_URL}/${id}`);
    return response.data;
};

const registerStudent = async (studentData) => {
    const response = await api.post(API_URL, studentData);
    return response.data;
};

const updateStudent = async (id, studentData) => {
    const response = await api.put(`${API_URL}/${id}`, studentData);
    return response.data;
};

const deleteStudent = async (id) => {
    const response = await api.delete(`${API_URL}/${id}`);
    return response.data;
};

const generatePasscode = async (id) => {
    const response = await api.patch(`${API_URL}/${id}/passcode`);
    return response.data;
};

const importStudents = async (students) => {
    const response = await api.post(`${API_URL}/import`, { students }, { timeout: IMPORT_TIMEOUT_MS });
    return response.data;
};

const exportStudents = async (format = 'csv', params = {}) => {
    const response = await api.get(`${API_URL}/export`, {
        params: { ...params, format },
        responseType: 'blob',
    });
    const disposition = response.headers?.['content-disposition'] || '';
    const match = disposition.match(/filename="([^"]+)"/i);
    const ext = format === 'xlsx' ? 'xlsx' : 'csv';
    const filename = match?.[1] || `students-export.${ext}`;
    return { blob: response.data, filename };
};

/** Upserts a performance row for the student user (Mongo user id). */
const patchStudentPerformance = async (studentUserId, payload) => {
    const response = await api.patch(`${API_URL}/${studentUserId}/performance`, payload);
    return response.data;
};

const uploadProfileImage = async (file) => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await api.post('/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

const adminStudentService = {
    getStudents,
    getStudent,
    registerStudent,
    updateStudent,
    deleteStudent,
    generatePasscode,
    importStudents,
    exportStudents,
    patchStudentPerformance,
    uploadProfileImage
};

export default adminStudentService;
