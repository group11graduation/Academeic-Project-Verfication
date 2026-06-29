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
        <div className="admin-page font-sans transition-colors">
            {/* Top Bar Area */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4 gap-3">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search subjects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-2 pl-9 pr-3 text-[12px] focus:ring-2 focus:ring-blue-500/10 font-medium text-slate-700 dark:text-slate-200 outline-none"
                    />
                </div>

                <div className="flex items-center gap-2 justify-between sm:justify-end">
                    <button
                        type="button"
                        onClick={openCreateModal}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1D68E3] text-white rounded-lg font-bold text-[12px] hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">New Course</span>
                    </button>
                    <div className="text-right">
                        <h1 className="text-base font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-none">Subjects / Courses</h1>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5">Grouped by Faculty</p>
                    </div>
                </div>
            </div>
            {showModal && (
                <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-black text-slate-800">
                                {isEditing ? 'Edit Course / Subject' : 'New Course Registration'}
                            </h2>
                            <p className="text-slate-500 text-[11px] font-medium mt-0.5">Register course subject and map classes/teachers.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <form id="subjectForm" onSubmit={handleSubmit} className="space-y-3">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Course / Subject Name <span className="text-rose-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Advanced Calculus"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-900 placeholder:text-slate-400 focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div className="w-full sm:w-[140px]">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Code <span className="text-rose-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    placeholder="MATH301"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-900 placeholder:text-slate-400 focus:border-blue-500 outline-none uppercase font-mono"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Faculty</label>
                                <select
                                    value={formData.faculty}
                                    onChange={(e) => setFormData({ ...formData, faculty: e.target.value, department: '' })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-900 focus:border-blue-500 outline-none"
                                >
                                    <option value="">Select Faculty</option>
                                    {facultyOptions.map((f) => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Department</label>
                                <select
                                    value={formData.department}
                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-900 focus:border-blue-500 outline-none"
                                    disabled={!formData.faculty}
                                >
                                    <option value="">Select Department</option>
                                    {departmentOptions.map((d) => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Teacher (Optional)</label>
                            <select
                                value={formData.teacherId}
                                onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-900 focus:border-blue-500 outline-none"
                            >
                                <option value="">Select Teacher...</option>
                                {filteredTeachersForSubject.map((t) => (
                                    <option key={t._id} value={t._id}>
                                        {t.name} {t.department ? `(${t.department})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-4 py-1.5 rounded-lg font-bold text-[12px] text-slate-600 hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-5 py-1.5 rounded-lg font-bold text-[12px] bg-[#1D68E3] text-white hover:bg-blue-700 flex items-center gap-1.5 min-w-[120px] justify-center"
                            >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditing ? 'Save' : 'Create')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 text-[#1D68E3] animate-spin" />
                </div>
            ) : subjects.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center border border-slate-200 dark:border-slate-700">
                    <div className="bg-blue-50 dark:bg-blue-500/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                        <BookOpen className="h-6 w-6 text-[#1D68E3]" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">No subjects found</h3>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-4">Create subjects and map them to teachers and classes.</p>
                    <button type="button" onClick={openCreateModal} className="px-4 py-1.5 bg-[#1D68E3] text-white rounded-lg font-bold text-[12px] inline-flex items-center gap-1.5 hover:bg-blue-700">
                        <Plus className="h-3.5 w-3.5" /> Create First Subject
                    </button>
                </div>
            ) : (
                <div className="space-y-5">
                    {Object.entries(groupedSubjects).map(([faculty, departments]) => (
                        <section key={faculty}>
                            <div className="mb-2 flex items-center justify-between">
                                <h3 className="text-[13px] font-black text-slate-800 dark:text-slate-200">{faculty}</h3>
                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                    {Object.values(departments).reduce((sum, list) => sum + list.length, 0)} subjects
                                </span>
                            </div>
                            {Object.entries(departments).map(([department, rows]) => (
                                <div key={`${faculty}-${department}`} className="mb-4">
                                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">{department}</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                                        {rows.map((sub) => (
                                    <div key={`${faculty}-${sub._id}`} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-all">
                            <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start gap-2">
                                <div className="min-w-0">
                                    <h3 className="text-[13px] font-black text-slate-800 dark:text-white mb-1 truncate">{sub.name}</h3>
                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                                        {sub.code}
                                    </span>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <button type="button" onClick={() => openEditModal(sub)} className="w-7 h-7 rounded-full bg-slate-50 border border-slate-100 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-[#1D68E3]">
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button type="button" onClick={() => handleDelete(sub._id)} className="w-7 h-7 rounded-full bg-rose-50 border border-rose-100 hover:bg-rose-100 flex items-center justify-center text-rose-400 hover:text-rose-600">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-3 bg-slate-50 dark:bg-slate-900/50">
                                <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                                    <LinkIcon className="h-3 w-3" /> Class Allocations ({(sub.allocations || []).length})
                                </h4>
                                <div className="space-y-1.5">
                                    {(sub.allocations || []).length === 0 ? (
                                        <p className="text-[11px] text-slate-400 italic">No classes allocated</p>
                                    ) : (
                                        (sub.allocations || []).map((alloc, idx) => (
                                            <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                                                <div className="flex items-center gap-1 bg-[#1D68E3]/10 text-[#1D68E3] px-2 py-0.5 rounded flex-shrink-0">
                                                    <GraduationCap className="h-3 w-3" />
                                                    <span className="text-[9px] font-black tracking-wider">{alloc.classId}</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate min-w-0">
                                                    <User className="h-3 w-3 text-slate-400 shrink-0" />
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
