import React, { useState, useEffect } from 'react';
import {
    Search, Plus, BookOpen, User, GraduationCap, Link as LinkIcon, Edit2, Trash2, X, Loader2
} from 'lucide-react';
import adminSubjectService from '../../../services/adminSubjectService';
import adminClassService from '../../../services/adminClassService';
import adminTeacherService from '../../../services/adminTeacherService';
import { adminAcademicService } from '../../../services/adminAcademicService';

const AdminSubjects = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [subjects, setSubjects] = useState([]);
    const [classes, setClasses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [academicStructure, setAcademicStructure] = useState({ faculties: [] });
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        _id: null,
        name: '',
        code: '',
        faculty: '',
        department: '',
        description: '',
        teacherId: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [subRes, clsRes, techRes, structureRes] = await Promise.all([
                adminSubjectService.getSubjects(),
                adminClassService.getClasses(),
                adminTeacherService.getTeachers(),
                adminAcademicService.getAcademicStructure()
            ]);
            
            if (subRes.success) setSubjects(subRes.data);
            if (clsRes.success) setClasses(clsRes.data);
            if (techRes.success) setTeachers(techRes.data);
            if (structureRes.success) setAcademicStructure(structureRes.data || { faculties: [] });
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('Failed to load subjects data');
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setFormData({
            _id: null,
            name: '',
            code: '',
            faculty: '',
            department: '',
            description: '',
            teacherId: ''
        });
        setIsEditing(false);
        setShowModal(true);
    };

    const openEditModal = (subject) => {
        setFormData({
            _id: subject._id,
            name: subject.name,
            code: subject.code,
            faculty: subject.faculty || '',
            department: subject.department || '',
            description: subject.description || '',
            teacherId: ''
        });
        setIsEditing(true);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this subject?')) return;
        try {
            await adminSubjectService.deleteSubject(id);
            setSubjects(subjects.filter(s => s._id !== id));
        } catch (err) {
            console.error(err);
            alert('Failed to delete subject');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                _id: formData._id,
                name: formData.name,
                code: formData.code,
                faculty: formData.faculty,
                department: formData.department,
                description: formData.description,
            };

            if (isEditing) {
                await adminSubjectService.updateSubject(formData._id, payload);
            } else {
                await adminSubjectService.createSubject(payload);
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || 'Failed to save subject. Ensure code is unique.');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredSubjects = subjects.filter(sub =>
        (sub.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sub.code || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    const classMap = new Map((classes || []).map((c) => [String(c.code), c]));
    const facultyOptions = (academicStructure.faculties || []).map((f) => f.name);
    const departmentOptions = ((academicStructure.faculties || []).find((f) => f.name === formData.faculty)?.departments) || [];
    const filteredTeachersForSubject = teachers || [];
    const groupedSubjects = filteredSubjects.reduce((acc, sub) => {
        const faculty = String(sub.faculty || '').trim() || 'Unassigned Faculty';
        const department = String(sub.department || '').trim() || 'Unassigned Department';
        if (!acc[faculty]) acc[faculty] = {};
        if (!acc[faculty][department]) acc[faculty][department] = [];
        acc[faculty][department].push(sub);
        return acc;
    }, {});

    return (
        <div className="p-4 md:p-10 max-w-[1600px] mx-auto font-sans bg-[#F8FAFB] dark:bg-[#0F172A]/30 min-h-screen transition-colors">
            {/* Top Bar Area */}
            <div className="flex flex-col md:flex-row items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5 mb-6 md:mb-8 gap-4">
                <div className="relative w-full max-w-[450px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search subjects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[12px] py-3 pl-12 pr-4 text-[14px] focus:ring-2 focus:ring-blue-500/10 transition-all font-medium text-slate-700 dark:text-slate-200 outline-none"
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    <button 
                        onClick={openCreateModal}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#1D68E3] text-white rounded-[10px] font-bold text-[14px] hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                    >
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">New Course Registration</span>
                    </button>
                    <div className="text-right hidden sm:block">
                        <h1 className="text-xl md:text-2xl font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-none mb-1">Subjects / Courses</h1>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none">Grouped by Faculty</p>
                    </div>
                </div>
            </div>
            {showModal && (
                <div className="mb-8 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black text-slate-800">
                                {isEditing ? 'Edit Course / Subject' : 'New Course Registration'}
                            </h2>
                            <p className="text-slate-500 text-xs font-medium mt-1">Register course subject and map classes/teachers.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:border-slate-300"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <form id="subjectForm" onSubmit={handleSubmit} className="space-y-6">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Course / Subject Name <span className="text-rose-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Advanced Calculus"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-[12px] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 outline-none transition-colors"
                                />
                            </div>
                            <div className="w-[180px]">
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Code <span className="text-rose-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    placeholder="MATH301"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-[12px] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 outline-none transition-colors uppercase font-mono"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Faculty</label>
                            <select
                                value={formData.faculty}
                                onChange={(e) => setFormData({ ...formData, faculty: e.target.value, department: '' })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-[12px] px-4 py-3 text-sm text-slate-900 focus:border-blue-500 outline-none transition-colors"
                            >
                                <option value="">Select Faculty</option>
                                {facultyOptions.map((f) => (
                                    <option key={f} value={f}>{f}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Department</label>
                            <select
                                value={formData.department}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-[12px] px-4 py-3 text-sm text-slate-900 focus:border-blue-500 outline-none transition-colors"
                                disabled={!formData.faculty}
                            >
                                <option value="">Select Department</option>
                                {departmentOptions.map((d) => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                                Teacher (Optional)
                            </label>
                            <select
                                value={formData.teacherId}
                                onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-[12px] px-4 py-3 text-sm text-slate-900 focus:border-blue-500 outline-none transition-colors"
                            >
                                <option value="">Select Teacher...</option>
                                {filteredTeachersForSubject.map((t) => (
                                    <option key={t._id} value={t._id}>
                                        {t.name} {t.department ? `(${t.department})` : ''}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-2 text-[12px] text-slate-500">
                                Teacher assignment is optional here. You can assign/update later.
                            </p>
                        </div>

                        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-6 py-2.5 rounded-[12px] font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-8 py-2.5 rounded-[12px] font-bold text-sm bg-[#1D68E3] text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 min-w-[140px]"
                            >
                                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (isEditing ? 'Save Changes' : 'Create Subject')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
                </div>
            ) : subjects.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-[24px] p-12 text-center border border-slate-200 dark:border-slate-700">
                    <div className="bg-blue-50 dark:bg-blue-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <BookOpen className="h-8 w-8 text-[#1D68E3]" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No subjects found</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">Create subjects and map them to teachers and classes.</p>
                    <button onClick={openCreateModal} className="px-6 py-2.5 bg-[#1D68E3] text-white rounded-[10px] font-bold inline-flex items-center gap-2 hover:bg-blue-700 transition">
                        <Plus className="h-4 w-4" /> Create First Subject
                    </button>
                </div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(groupedSubjects).map(([faculty, departments]) => (
                        <section key={faculty}>
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-[18px] font-black text-slate-800 dark:text-slate-200">{faculty}</h3>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    {Object.values(departments).reduce((sum, list) => sum + list.length, 0)} subjects
                                </span>
                            </div>
                            {Object.entries(departments).map(([department, rows]) => (
                                <div key={`${faculty}-${department}`} className="mb-6">
                                    <h4 className="text-[13px] font-black uppercase tracking-wider text-slate-500 mb-3">{department}</h4>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                        {rows.map((sub) => (
                                    <div key={`${faculty}-${sub._id}`} className="bg-white dark:bg-slate-800 rounded-[24px] border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1 transition-all duration-300">
                            {/* Card Header */}
                            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1">{sub.name}</h3>
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg">
                                        {sub.code}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openEditModal(sub)} className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-[#1D68E3] transition-all">
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => handleDelete(sub._id)} className="w-8 h-8 rounded-full bg-rose-50 border border-rose-100 hover:bg-rose-100 flex items-center justify-center text-rose-400 hover:text-rose-600 transition-all">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Allocations */}
                            <div className="p-6 bg-slate-50 dark:bg-slate-900/50">
                                <h4 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-slate-500 mb-4">
                                    <LinkIcon className="h-4 w-4" /> Class Allocations ({(sub.allocations || []).length})
                                </h4>
                                <div className="space-y-3">
                                    {(sub.allocations || []).length === 0 ? (
                                        <p className="text-sm text-slate-400 italic">No classes allocated</p>
                                    ) : (
                                        (sub.allocations || []).map((alloc, idx) => (
                                            <div key={idx} className="flex items-center gap-4 bg-white dark:bg-slate-800 p-3 rounded-[12px] shadow-sm border border-slate-100 dark:border-slate-700">
                                                <div className="flex items-center gap-2 bg-[#1D68E3]/10 text-[#1D68E3] px-3 py-1.5 rounded-lg flex-shrink-0">
                                                    <GraduationCap className="h-4 w-4" />
                                                    <span className="text-[11px] font-black tracking-widest">{alloc.classId}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                                    <User className="h-4 w-4 text-slate-400" />
                                                    <span className="truncate">{alloc.teacher?.name || 'Unknown Teacher'}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                                    </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </section>
                    ))}
                </div>
            )}

            
        </div>
    );
};

export default AdminSubjects;
