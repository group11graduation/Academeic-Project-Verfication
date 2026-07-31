import api, { getApiOrigin } from '../lib/api';

const GUEST_KEY_STORAGE = 'sv_gallery_guest_key';

function createGuestKey() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID().replace(/-/g, '');
    }
    return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function getGalleryGuestKey() {
    if (typeof window === 'undefined') return '';
    try {
        let key = localStorage.getItem(GUEST_KEY_STORAGE) || '';
        if (!/^[a-zA-Z0-9_-]{8,80}$/.test(key)) {
            key = createGuestKey().slice(0, 80);
            localStorage.setItem(GUEST_KEY_STORAGE, key);
        }
        return key;
    } catch {
        return createGuestKey().slice(0, 32);
    }
}

const galleryService = {
    listVerifiedProjects: async (params = {}) => {
        const guestKey = getGalleryGuestKey();
        const res = await api.get('/public/verified-projects', {
            params: { ...params, guestKey },
            headers: { 'X-Gallery-Guest': guestKey },
        });
        return res.data;
    },

    getVerifiedProject: async (id) => {
        const guestKey = getGalleryGuestKey();
        const res = await api.get(`/public/verified-projects/${id}`, {
            params: { guestKey },
            headers: { 'X-Gallery-Guest': guestKey },
        });
        return res.data;
    },

    listProjectReactions: async (id, params = {}) => {
        const res = await api.get(`/public/verified-projects/${id}/reactions`, { params });
        return res.data;
    },

    toggleProjectReaction: async (id) => {
        const guestKey = getGalleryGuestKey();
        const res = await api.post(
            `/public/verified-projects/${id}/react`,
            { guestKey },
            { headers: { 'X-Gallery-Guest': guestKey } }
        );
        return res.data;
    },

    resolveMediaUrl: (pathOrUrl) => {
        if (!pathOrUrl) return null;
        if (String(pathOrUrl).startsWith('http')) return pathOrUrl;
        return `${getApiOrigin()}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
    },
};

export default galleryService;
