import api from '../lib/api';
import { getApiOrigin } from '../lib/api';

const API_URL = '/admin/teachers';

const getTeachers = async () => {
    const response = await api.get(API_URL);
    return response.data;
};

const getTeacher = async (id) => {
    const response = await api.get(`${API_URL}/${id}`);
    return response.data;
};

const registerTeacher = async (teacherData) => {
    const response = await api.post(API_URL, teacherData);
    return response.data;
};

const updateTeacher = async (id, teacherData) => {
    const response = await api.put(`${API_URL}/${id}`, teacherData);
    return response.data;
};

const deleteTeacher = async (id) => {
    const response = await api.delete(`${API_URL}/${id}`);
    return response.data;
};

const generatePasscode = async (id) => {
    const response = await api.patch(`${API_URL}/${id}/passcode`);
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

const assignClasses = async (id, classCodes) => {
    const response = await api.patch(`${API_URL}/${id}/classes`, { classes: classCodes });
    return response.data;
};

const toggleAdmin = async (id) => {
    const response = await api.patch(`${API_URL}/${id}/toggle-admin`);
    return response.data;
};

/** Absolute URL for displaying uploaded images */
export const resolveUploadUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${getApiOrigin()}${path}`;
};

const adminTeacherService = {
    getTeachers,
    getTeacher,
    registerTeacher,
    updateTeacher,
    deleteTeacher,
    generatePasscode,
    uploadProfileImage,
    assignClasses,
    toggleAdmin
};

export default adminTeacherService;
