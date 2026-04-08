import api from '../lib/api';

const API_URL = '/admin/subjects';

const getSubjects = async () => {
    const response = await api.get(API_URL);
    return response.data;
};

const getSubject = async (id) => {
    const response = await api.get(`${API_URL}/${id}`);
    return response.data;
};

const createSubject = async (subjectData) => {
    const response = await api.post(API_URL, subjectData);
    return response.data;
};

const updateSubject = async (id, subjectData) => {
    const response = await api.put(`${API_URL}/${id}`, subjectData);
    return response.data;
};

const deleteSubject = async (id) => {
    const response = await api.delete(`${API_URL}/${id}`);
    return response.data;
};

export default {
    getSubjects,
    getSubject,
    createSubject,
    updateSubject,
    deleteSubject
};
