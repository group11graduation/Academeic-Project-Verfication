import api from '../lib/api';

/**
 * Legacy admin user list helper used by AdminAdmins.jsx.
 * Maps API payloads to the shape the table expects (systemId, accountStatus).
 */
const adminUserService = {
    async getUsersByRole(role) {
        if (role !== 'admin') {
            return { success: false, data: [], message: 'Only admin role supported in Phase 1' };
        }
        const res = await api.get('/admin/admins');
        if (!res.data.success) return res.data;
        const mapped = (res.data.data || []).map((a) => ({
            ...a,
            systemId: a.username || a.email || a._id,
            accountStatus: a.isActive === false ? 'DISABLED' : 'ACTIVE',
        }));
        return { success: true, data: mapped };
    },

    /** POST /admin/admins — { name, email, username?, password | passcode } */
    async createAdmin(body) {
        const res = await api.post('/admin/admins', body);
        return res.data;
    },

    async getAdmin(id) {
        const res = await api.get(`/admin/admins/${id}`);
        return res.data;
    },

    async updateAdmin(id, body) {
        const res = await api.put(`/admin/admins/${id}`, body);
        return res.data;
    },

    async deleteAdmin(id) {
        const res = await api.delete(`/admin/admins/${id}`);
        return res.data;
    },
};

export default adminUserService;
