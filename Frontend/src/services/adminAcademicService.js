import api from '../lib/api';

/** Academic years, semesters, settings — Phase 1 admin API */
export const adminAcademicService = {
    getAcademicYears: async () => {
        const res = await api.get('/admin/academic-years');
        return res.data;
    },
    createAcademicYear: async (body) => {
        const res = await api.post('/admin/academic-years', body);
        return res.data;
    },
    updateAcademicYear: async (id, body) => {
        const res = await api.put(`/admin/academic-years/${id}`, body);
        return res.data;
    },
    getSemesters: async (academicYearId) => {
        const res = await api.get('/admin/semesters', {
            params: academicYearId ? { academicYearId } : undefined
        });
        return res.data;
    },
    createSemester: async (body) => {
        const res = await api.post('/admin/semesters', body);
        return res.data;
    },
    updateSemester: async (id, body) => {
        const res = await api.put(`/admin/semesters/${id}`, body);
        return res.data;
    },
    getSettings: async () => {
        const res = await api.get('/admin/settings');
        return res.data;
    },
    updateSettings: async (body) => {
        const res = await api.put('/admin/settings', body);
        return res.data;
    },
    getAcademicStructure: async () => {
        const res = await api.get('/admin/settings');
        const settings = res.data?.data || {};
        return {
            success: Boolean(res.data?.success),
            data: settings.academicStructure || { faculties: [] }
        };
    },
    updateAcademicStructure: async (structure) => {
        const cur = await api.get('/admin/settings');
        const settings = cur.data?.data || {};
        const nextSettings = {
            ...settings,
            academicStructure: structure || { faculties: [] }
        };
        const res = await api.put('/admin/settings', nextSettings);
        return {
            success: Boolean(res.data?.success),
            data: res.data?.data?.academicStructure || { faculties: [] }
        };
    }
};
