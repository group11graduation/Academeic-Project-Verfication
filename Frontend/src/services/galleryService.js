import api, { getApiOrigin } from '../lib/api';

const galleryService = {
    listVerifiedProjects: async (params = {}) => {
        const res = await api.get('/public/verified-projects', { params });
        return res.data;
    },

    getVerifiedProject: async (id) => {
        const res = await api.get(`/public/verified-projects/${id}`);
        return res.data;
    },

    listProjectReactions: async (id, params = {}) => {
        const res = await api.get(`/public/verified-projects/${id}/reactions`, { params });
        return res.data;
    },

    toggleProjectReaction: async (id) => {
        const res = await api.post(`/public/verified-projects/${id}/react`);
        return res.data;
    },

    resolveMediaUrl: (pathOrUrl) => {
        if (!pathOrUrl) return null;
        if (String(pathOrUrl).startsWith('http')) return pathOrUrl;
        return `${getApiOrigin()}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
    },
};

export default galleryService;
