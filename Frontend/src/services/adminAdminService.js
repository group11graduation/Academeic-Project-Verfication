import api from '../lib/api';

const API_URL = '/admin/admins';

const getAdmins = async () => {
    const response = await api.get(API_URL);
    return response.data;
};

const createAdmin = async (data) => {
    const response = await api.post(API_URL, data);
    return response.data;
};

const updateAdmin = async (id, data) => {
    const response = await api.put(`${API_URL}/${id}`, data);
    return response.data;
};

const deleteAdmin = async (id) => {
    const response = await api.delete(`${API_URL}/${id}`);
    return response.data;
};

const resetPasscode = async (id) => {
    const response = await api.patch(`${API_URL}/${id}/passcode`, {});
    return response.data;
};

const adminAdminService = {
    getAdmins,
    createAdmin,
    updateAdmin,
    deleteAdmin,
    resetPasscode
};

export default adminAdminService;
