import api from '../lib/api';

const getStats = async () => {
    const response = await api.get('/admin/dashboard/stats');
    return response.data;
};

const adminDashboardService = {
    getStats
};

export default adminDashboardService;
