import api from '../lib/api';

const getSemesters = async (academicYearId) => {
    const params = academicYearId ? { academicYearId } : undefined;
    const response = await api.get('/admin/semesters', { params });
    return response.data;
};

const adminSemesterService = {
    getSemesters,
};

export default adminSemesterService;
