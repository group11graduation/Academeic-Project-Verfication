import api from '../lib/api';

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
    const response = await api.post(`${API_URL}/import`, { students });
    return response.data;
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
    patchStudentPerformance,
    uploadProfileImage
};

export default adminStudentService;
