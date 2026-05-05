import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import {
    Users, GraduationCap, Calendar, Clock, Search,
    MoreVertical, Plus, ArrowLeft, Layout, BookOpen, Loader2,
    UserPlus, CheckCircle2
} from 'lucide-react';
import adminClassService from '../../../services/adminClassService';
import adminTeacherService from '../../../services/adminTeacherService';
import adminStudentService from '../../../services/adminStudentService';
import adminSubjectService from '../../../services/adminSubjectService';
import adminSemesterService from '../../../services/adminSemesterService';
import { adminAcademicService } from '../../../services/adminAcademicService';

const AdminClassDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('students');
    const [searchQuery, setSearchQuery] = useState('');

    const [classInfo, setClassInfo] = useState(null);
    const [students, setStudents] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [allTeachers, setAllTeachers] = useState([]);
    const [allStudents, setAllStudents] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);
    const [allSemesters, setAllSemesters] = useState([]);
    const [academicStructure, setAcademicStructure] = useState({ faculties: [] });
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [selectedTeacherSubjectIds, setSelectedTeacherSubjectIds] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [assigningTeacher, setAssigningTeacher] = useState(false);
    const [assigningStudent, setAssigningStudent] = useState(false);
    const [removingStudentId, setRemovingStudentId] = useState('');
    const [removingTeacherId, setRemovingTeacherId] = useState('');
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [savingClassInfo, setSavingClassInfo] = useState(false);
    const [generatingStudentPasscodeFor, setGeneratingStudentPasscodeFor] = useState('');
    const [generatedPasscodes, setGeneratedPasscodes] = useState({});
    const [classForm, setClassForm] = useState({
        name: '',
        description: '',
        faculty: '',
        department: '',
        category: 'ACADEMIC',
        semester: '',
        subjectIds: [],
    });

    const handleGenerateAccounts = async () => {
        if (!window.confirm('This will create User login accounts for all students in this class. Proceed?')) return;

        try {
            setGenerating(true);
            const res = await adminClassService.generateAccounts(id);
            if (res.success) {
                alert(res.message);
                // Refresh class details to see updated user status
                const updatedRes = await adminClassService.getClass(id);
                if (updatedRes.success) {
                    setStudents(updatedRes.data.enrolledStudents || []);
                }
            }
        } catch (error) {
            console.error("Error generating accounts:", error);
            alert("Failed to generate student accounts.");
        } finally {
            setGenerating(false);
        }
    };

    const fetchClassDetails = async () => {
        const res = await adminClassService.getClass(id);
        if (res.success) {
            setClassInfo(res.data);
            setStudents(res.data.enrolledStudents || []);
            setTeachers(res.data.assignedTeachers || []);
            setClassForm({
                name: res.data.name || '',
                description: res.data.description || '',
                faculty: res.data.faculty || '',
                department: res.data.department || '',
                category: res.data.category || 'ACADEMIC',
                semester: res.data.semesterId || '',
                subjectIds: Array.isArray(res.data.subjectIds) ? res.data.subjectIds.map(String) : [],
            });
        }
    };

    useEffect(() => {
        const load = async () => {
            try {
                await fetchClassDetails();
                const [tRes, sRes, subRes, semRes, structureRes] = await Promise.all([
                    adminTeacherService.getTeachers(),
                    adminStudentService.getStudents(),
                    adminSubjectService.getSubjects(),
                    adminSemesterService.getSemesters(),
                    adminAcademicService.getAcademicStructure(),
                ]);
                if (tRes.success) setAllTeachers(tRes.data || []);
                if (sRes.success) setAllStudents(sRes.data || []);
                if (subRes.success) setAllSubjects(subRes.data || []);
                if (semRes.success) setAllSemesters(semRes.data || []);
                if (structureRes.success) setAcademicStructure(structureRes.data || { faculties: [] });
            } catch (error) {
                console.error("Error fetching class details:", error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    const handleAssignTeacher = async () => {
        if (!selectedTeacherId) return;
        try {
            setAssigningTeacher(true);
            const res = await adminClassService.assignTeacher(id, {
                teacherId: selectedTeacherId,
                subjectIds: selectedTeacherSubjectIds,
            });
            if (!res.success) throw new Error(res.message || 'Failed to assign teacher');
            setSelectedTeacherId('');
            setSelectedTeacherSubjectIds([]);
            await fetchClassDetails();
        } catch (error) {
            console.error('Error assigning teacher:', error);
            alert(error.message || 'Could not assign teacher');
        } finally {
            setAssigningTeacher(false);
        }
    };

    const handleAssignStudent = async () => {
        if (!selectedStudentId) return;
        try {
            setAssigningStudent(true);
            const res = await adminStudentService.updateStudent(selectedStudentId, { classCode: id, classId: id });
            if (!res.success) throw new Error(res.message || 'Failed to add student to class');
            setSelectedStudentId('');
            await fetchClassDetails();
            const sRes = await adminStudentService.getStudents();
            if (sRes.success) setAllStudents(sRes.data || []);
        } catch (error) {
            console.error('Error assigning student:', error);
            alert(error.message || 'Could not add student to class');
        } finally {
            setAssigningStudent(false);
        }
    };

    const handleRemoveStudent = async (studentProfileId) => {
        if (!studentProfileId) return;
        if (!window.confirm('Remove this student from the current class?')) return;
        try {
            setRemovingStudentId(String(studentProfileId));
            const res = await adminStudentService.updateStudent(studentProfileId, { classCode: '', classId: '' });
            if (!res.success) throw new Error(res.message || 'Failed to remove student from class');
            await fetchClassDetails();
            const sRes = await adminStudentService.getStudents();
            if (sRes.success) setAllStudents(sRes.data || []);
        } catch (error) {
            console.error('Error removing student from class:', error);
            alert(error.message || 'Could not remove student from class');
        } finally {
            setRemovingStudentId('');
        }
    };

    const handleRemoveTeacher = async (teacherUserId) => {
        if (!teacherUserId) return;
        if (!window.confirm('Remove this teacher (and their subjects) from the current class?')) return;
        try {
            setRemovingTeacherId(String(teacherUserId));
            const res = await adminClassService.removeTeacher(id, teacherUserId);
            if (!res.success) throw new Error(res.message || 'Failed to remove teacher from class');
            setSelectedTeacherId('');
            setSelectedTeacherSubjectIds([]);
            await fetchClassDetails();
        } catch (error) {
            console.error('Error removing teacher from class:', error);
            alert(error.response?.data?.message || error.message || 'Could not remove teacher from class');
        } finally {
            setRemovingTeacherId('');
        }
    };

    const filteredData = activeTab === 'students'
        ? students.filter(s => (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (s.studentId || '').toLowerCase().includes(searchQuery.toLowerCase()))
        : teachers.filter(t => (t.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (t.teacherId || '').toLowerCase().includes(searchQuery.toLowerCase()));

    const assignedTeacherIds = new Set((teachers || []).map((t) => String(t.userId || t._id || '')));
    const teacherCandidates = (allTeachers || []).filter(
        (t) => !assignedTeacherIds.has(String(t.userId || t._id || ''))
    );
    // Business rule: only students without a class assignment can be added.
    // To move a student between classes, remove them from current class first.
    const studentCandidates = (allStudents || []).filter((s) => !String(s.classId || s.classCode || '').trim());
    const availableSubjects = (allSubjects || []).filter((sub) => {
        const subFaculty = String(sub.faculty || '').trim().toLowerCase();
        const subDepartment = String(sub.department || '').trim().toLowerCase();
        const facultyOk = classForm.faculty ? (subFaculty ? subFaculty === String(classForm.faculty).toLowerCase() : true) : true;
        const departmentOk = classForm.department
            ? (subDepartment ? subDepartment === String(classForm.department).toLowerCase() : true)
            : true;
        return facultyOk && departmentOk;
    });
    const departmentOptions = ((academicStructure.faculties || []).find((f) => f.name === classForm.faculty)?.departments) || [];

    const handleToggleSubject = (subjectId) => {
        setClassForm((prev) => ({
            ...prev,
            subjectIds: prev.subjectIds.includes(String(subjectId))
                ? prev.subjectIds.filter((id) => id !== String(subjectId))
                : [...prev.subjectIds, String(subjectId)],
        }));
    };
    const handleToggleTeacherSubject = (subjectId) => {
        setSelectedTeacherSubjectIds((prev) =>
            prev.includes(String(subjectId))
                ? prev.filter((id) => id !== String(subjectId))
                : [...prev, String(subjectId)]
        );
    };

    const handleSaveClassInfo = async () => {
        try {
            setSavingClassInfo(true);
            const res = await adminClassService.updateClass(id, {
                name: classForm.name,
                description: classForm.description,
                faculty: classForm.faculty,
                department: classForm.department,
                category: classForm.category,
                semester: classForm.semester || null,
                subjectIds: classForm.subjectIds,
            });
            if (!res.success) throw new Error(res.message || 'Failed to update class');
            await fetchClassDetails();
            alert('Class information updated successfully.');
        } catch (error) {
            console.error('Error updating class info:', error);
            alert(error.response?.data?.message || error.message || 'Could not update class');
        } finally {
            setSavingClassInfo(false);
        }
    };

    const handleGenerateStudentAccount = async (studentProfileId, studentLabel) => {
        try {
            setGeneratingStudentPasscodeFor(String(studentProfileId));
            const res = await adminStudentService.generatePasscode(studentProfileId);
            if (!res.success) throw new Error(res.message || 'Failed to generate account');
            const passcode = res.data?.passcode || '';
            setGeneratedPasscodes((prev) => ({ ...prev, [String(studentProfileId)]: passcode }));
            alert(`New passcode for ${studentLabel}: ${passcode}`);
            await fetchClassDetails();
        } catch (error) {
            console.error('Error generating student account:', error);
            alert(error.response?.data?.message || error.message || 'Could not generate account');
        } finally {
            setGeneratingStudentPasscodeFor('');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] dark:bg-slate-800 flex flex-col items-center justify-center transition-colors duration-300">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin mb-4" />
                <p className="text-slate-500 dark:text-slate-400 font-medium transition-colors">Loading class details...</p>
            </div>
        );
    }

    if (!classInfo) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] dark:bg-slate-800 flex flex-col items-center justify-center transition-colors duration-300">
                <p className="text-slate-500 dark:text-slate-400 font-medium transition-colors">Class not found.</p>
                <button onClick={() => navigate('/admin/classes')} className="mt-4 text-blue-500 font-bold hover:underline">
                    Back to Directory
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-10 max-w-[1600px] mx-auto min-h-screen transition-colors duration-300">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between mb-8">
                <button
                    onClick={() => navigate('/admin/classes')}
                    className="flex items-center gap-3 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 font-bold text-[14px] hover:bg-slate-50 dark:hover:bg-slate-750 hover:text-[#1D68E3] transition-all shadow-sm group"
                >
                    <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                    Back to Classes
                </button>

                <div className="relative w-[320px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <input
                        type="text"
                        placeholder="Global search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-11 pr-4 text-[14px] outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 dark:text-white transition-colors shadow-sm"
                    />
                </div>
            </div>

            {/* Header Content */}
            <div className="mb-10">
                <h1 className="text-[36px] font-black text-[#0F172A] dark:text-white tracking-tight mb-2 transition-colors">{classInfo.code}</h1>
                <p className="text-[16px] text-slate-500 dark:text-slate-400 font-medium transition-colors">{classInfo.description}</p>
            </div>

            {/* Tabs Selector */}
            <div className="flex items-center gap-10 border-b border-slate-200 dark:border-slate-700 mb-10 transition-colors">
                <button
                    onClick={() => { setActiveTab('students'); setSearchQuery(''); }}
                    className={`pb-4 text-[15px] font-bold transition-all relative ${activeTab === 'students' ? 'text-[#1D68E3]' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                    Students
                    {activeTab === 'students' && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[#1D68E3] rounded-full"></div>}
                </button>
                <button
                    onClick={() => { setActiveTab('teachers'); setSearchQuery(''); }}
                    className={`pb-4 text-[15px] font-bold transition-all relative ${activeTab === 'teachers' ? 'text-[#1D68E3]' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                    Teachers
                    {activeTab === 'teachers' && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[#1D68E3] rounded-full"></div>}
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
                {[
                    { label: 'Total Students', value: students.length },
                    { label: 'Faculty', value: classInfo.faculty },
                    { label: 'Department', value: classInfo.department || '-' },
                    { label: 'Total Teachers', value: teachers.length },
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 p-7 rounded-[24px] border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
                        <p className="text-[14px] font-bold text-slate-400 dark:text-slate-500 mb-3 transition-colors">{stat.label}</p>
                        <h3 className="text-[32px] font-black text-[#0F172A] dark:text-white tracking-tight leading-none transition-colors">{stat.value}</h3>
                    </div>
                ))}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-slate-100 dark:border-slate-700 shadow-sm p-6 mb-10">
                <h3 className="text-[18px] font-black text-[#0F172A] dark:text-white mb-4">Class Information & Subjects</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                    <input
                        value={classForm.name}
                        onChange={(e) => setClassForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Class name"
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-[14px] outline-none"
                    />
                    <select
                        value={classForm.faculty}
                        onChange={(e) =>
                            setClassForm((p) => ({ ...p, faculty: e.target.value, department: '', subjectIds: [] }))
                        }
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-[14px] outline-none"
                    >
                        <option value="">Select faculty</option>
                        {(academicStructure.faculties || []).map((f) => (
                            <option key={f.name} value={f.name}>{f.name}</option>
                        ))}
                    </select>
                    <select
                        value={classForm.department}
                        onChange={(e) => setClassForm((p) => ({ ...p, department: e.target.value, subjectIds: [] }))}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-[14px] outline-none"
                        disabled={!classForm.faculty}
                    >
                        <option value="">Select department</option>
                        {departmentOptions.map((d) => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                    <select
                        value={classForm.category}
                        onChange={(e) => setClassForm((p) => ({ ...p, category: e.target.value }))}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-[14px] outline-none"
                    >
                        <option value="ACADEMIC">Academic</option>
                        <option value="LAB BASED">Lab Based</option>
                        <option value="THEORY">Theory</option>
                        <option value="WORKSHOP">Workshop</option>
                        <option value="SEMINAR">Seminar</option>
                    </select>
                    <select
                        value={classForm.semester}
                        onChange={(e) => setClassForm((p) => ({ ...p, semester: e.target.value }))}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-[14px] outline-none"
                    >
                        <option value="">Select semester</option>
                        {allSemesters.map((s) => (
                            <option key={s._id} value={s._id}>
                                {s.academicYearLabel ? `${s.academicYearLabel} - ` : ''}{s.name}
                            </option>
                        ))}
                    </select>
                </div>
                <textarea
                    value={classForm.description}
                    onChange={(e) => setClassForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Class notes / description"
                    rows={2}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-[14px] outline-none mb-4"
                />
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 max-h-48 overflow-y-auto mb-4">
                    {availableSubjects.map((s) => (
                        <label key={s._id} className="flex items-center gap-2 text-[13px] py-1">
                            <input
                                type="checkbox"
                                checked={classForm.subjectIds.includes(String(s._id))}
                                onChange={() => handleToggleSubject(s._id)}
                            />
                            <span className="text-slate-700 dark:text-slate-300">{s.name} ({s.code})</span>
                        </label>
                    ))}
                    {availableSubjects.length === 0 && (
                        <p className="text-[13px] text-slate-500">No subjects available for selected faculty/department.</p>
                    )}
                </div>
                <button
                    onClick={handleSaveClassInfo}
                    disabled={savingClassInfo}
                    className="px-4 py-2.5 bg-[#1D68E3] text-white rounded-xl text-[14px] font-bold hover:bg-blue-600 disabled:opacity-50"
                >
                    {savingClassInfo ? 'Saving...' : 'Save Class Updates'}
                </button>
            </div>

            {/* Main Content Area */}
            <div className="bg-white dark:bg-slate-800 rounded-[32px] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden pb-8 transition-colors">

                <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <h3 className="text-[20px] font-black text-[#0F172A] dark:text-white transition-colors">
                        {activeTab === 'students' ? 'Enrolled Students' : 'Class Teachers'}
                    </h3>

                    <div className="flex items-center gap-4">
                        {activeTab === 'teachers' && (
                            <>
                                <select
                                    value={selectedTeacherId}
                                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                                    className="bg-[#F8FAFB] dark:bg-slate-900 rounded-xl py-3 px-4 text-[14px] text-slate-900 dark:text-white w-[260px] border border-slate-200 dark:border-slate-700 outline-none"
                                >
                                    <option value="">Assign teacher...</option>
                                    {teacherCandidates.map((t) => (
                                        <option key={t.userId || t._id} value={t.userId || t._id}>
                                            {t.name} ({t.teacherId || t.employeeId || 'No ID'})
                                        </option>
                                    ))}
                                </select>
                                {teacherCandidates.length === 0 && (
                                    <p className="text-[12px] text-slate-500">No unassigned teachers available.</p>
                                )}
                                <div className="bg-[#F8FAFB] dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 max-h-36 overflow-y-auto min-w-[260px] text-slate-900 dark:text-white">
                                    {(classInfo?.subjects || []).length === 0 ? (
                                        <p className="text-[12px] text-slate-500">No class subjects yet.</p>
                                    ) : (
                                        (classInfo?.subjects || []).map((s) => (
                                            <label key={s._id} className="flex items-center gap-2 text-[12px] py-1">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTeacherSubjectIds.includes(String(s._id))}
                                                    onChange={() => handleToggleTeacherSubject(s._id)}
                                                />
                                                <span>{s.name} ({s.code})</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                                <button
                                    onClick={handleAssignTeacher}
                                    disabled={!selectedTeacherId || assigningTeacher}
                                    className="flex items-center gap-2 px-4 py-3 bg-[#1D68E3] text-white rounded-xl font-bold text-[14px] hover:bg-blue-600 transition-all shadow-md disabled:opacity-50"
                                >
                                    {assigningTeacher ? 'Assigning...' : 'Assign Teacher + Subjects'}
                                </button>
                            </>
                        )}
                        {activeTab === 'students' && (
                            <>
                                <select
                                    value={selectedStudentId}
                                    onChange={(e) => setSelectedStudentId(e.target.value)}
                                    className="bg-[#F8FAFB] dark:bg-slate-900 rounded-xl py-3 px-4 text-[14px] w-[260px] border border-slate-200 dark:border-slate-700 outline-none"
                                >
                                    <option value="">Add unassigned student...</option>
                                    {studentCandidates.map((s) => (
                                        <option key={s._id || s.studentId} value={s._id || s.studentId}>
                                            {s.name} ({s.studentId})
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleAssignStudent}
                                    disabled={!selectedStudentId || assigningStudent}
                                    className="flex items-center gap-2 px-4 py-3 bg-[#1D68E3] text-white rounded-xl font-bold text-[14px] hover:bg-blue-600 transition-all shadow-md disabled:opacity-50"
                                >
                                    {assigningStudent ? 'Adding...' : 'Add Student'}
                                </button>
                            </>
                        )}
                        <button
                            onClick={handleGenerateAccounts}
                            disabled={generating}
                            className="flex items-center gap-2 px-5 py-3 bg-[#1D68E3] text-white rounded-xl font-bold text-[14px] hover:bg-blue-600 transition-all shadow-md disabled:opacity-50"
                        >
                            <UserPlus className="h-4 w-4" />
                            {generating ? 'Generating...' : 'Generate Student Accounts'}
                        </button>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                            <input
                                type="text"
                                placeholder={`Filter ${activeTab}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-[#F8FAFB] dark:bg-slate-900 border-none rounded-xl py-3 pl-11 pr-4 text-[14px] w-[280px] outline-none focus:ring-2 focus:ring-blue-500/10 dark:text-white transition-all transition-colors"
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-t border-b border-slate-50 dark:border-slate-700 uppercase tracking-widest text-[11px] font-black text-slate-400 dark:text-slate-500 transition-colors">
                                <th className="px-8 py-5">Name</th>
                                <th className="px-8 py-5">ID / Department</th>
                                <th className="px-8 py-5">{activeTab === 'students' ? 'Username / Email' : 'Faculty Email'}</th>
                                <th className="px-8 py-5">Status</th>
                                {activeTab === 'students' && <th className="px-8 py-5">Account</th>}
                                <th className="px-8 py-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                            {filteredData.map((item) => (
                                <tr key={item._id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-750/50 transition-colors">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <Link
                                                to={`/admin/${activeTab}/${activeTab === 'students' ? item.studentId : item.teacherId}`}
                                                state={{ from: location.pathname }}
                                                className="hover:scale-110 transition-transform"
                                            >
                                                <img src={item.photo || 'https://via.placeholder.com/150'} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-slate-100 dark:border-slate-700 shadow-sm transition-colors" />
                                            </Link>
                                            <div>
                                                <Link
                                                    to={`/admin/${activeTab}/${activeTab === 'students' ? item.studentId : item.teacherId}`}
                                                    state={{ from: location.pathname }}
                                                    className="text-[15px] font-bold text-[#0F172A] dark:text-white hover:text-[#1D68E3] transition-colors line-clamp-1"
                                                >
                                                    {item.name || 'Unknown User'}
                                                </Link>
                                                <p className="text-[12px] font-medium text-slate-400 dark:text-slate-500 transition-colors line-clamp-1">{item.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="text-[14px] font-bold text-slate-600 dark:text-slate-300 tracking-tight transition-colors">
                                            {activeTab === 'students' ? item.studentId : item.department}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="text-[14px] font-medium text-slate-500 dark:text-slate-400 transition-colors">
                                            {activeTab === 'students'
                                                ? (item.username ? `${item.username} / ${item.email}` : item.email)
                                                : item.email}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-black ${(item.accountStatus || 'active') === 'active' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500'} transition-colors`}>
                                            <div className={`h-1.5 w-1.5 rounded-full ${(item.accountStatus || 'active') === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                            {(item.accountStatus || 'active').charAt(0).toUpperCase() + (item.accountStatus || 'active').slice(1)}
                                        </span>
                                    </td>
                                    {activeTab === 'students' && (
                                        <td className="px-8 py-5">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-black ${(item.hasAccount ?? Boolean(item.userId)) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                {(item.hasAccount ?? Boolean(item.userId)) ? 'Has Account' : 'No Account'}
                                            </span>
                                            {generatedPasscodes[String(item._id)] && (
                                                <div className="mt-1 text-[11px] font-mono text-slate-700">
                                                    Passcode: {generatedPasscodes[String(item._id)]}
                                                </div>
                                            )}
                                        </td>
                                    )}
                                    <td className="px-8 py-5 text-right">
                                        {activeTab === 'students' ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleGenerateStudentAccount(item._id, item.name || item.studentId)}
                                                    disabled={generatingStudentPasscodeFor === String(item._id)}
                                                    className="px-3 py-2 text-[12px] font-bold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                                >
                                                    {generatingStudentPasscodeFor === String(item._id) ? 'Generating...' : 'Generate/Reset'}
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveStudent(item._id)}
                                                    disabled={removingStudentId === String(item._id)}
                                                    className="px-3 py-2 text-[12px] font-bold rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                                                >
                                                    {removingStudentId === String(item._id) ? 'Removing...' : 'Remove'}
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleRemoveTeacher(item.userId || item._id)}
                                                disabled={removingTeacherId === String(item.userId || item._id)}
                                                className="px-3 py-2 text-[12px] font-bold rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                                            >
                                                {removingTeacherId === String(item.userId || item._id) ? 'Removing...' : 'Remove'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminClassDetail;
