import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { appAlert, appConfirm, appError, appSuccess, appWarning } from '../../../lib/appDialog';
import {
    Users, GraduationCap, Calendar, Clock, Search,
    MoreVertical, Plus, ArrowLeft, Layout, BookOpen, Loader2,
    UserPlus, CheckCircle2
} from 'lucide-react';
import adminClassService from '../../../services/adminClassService';
import adminTeacherService from '../../../services/adminTeacherService';
import adminStudentService from '../../../services/adminStudentService';
import adminSubjectService from '../../../services/adminSubjectService';
import { usePageSearch } from '../../../context/shellSearchContext';
import { matchesSearchQuery } from '../../../shared/utils/searchUtils';

function normalizeClassCode(code) {
    return String(code ?? '').trim().toUpperCase();
}

const AdminClassDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('students');
    const { query: searchQuery, setQuery: setSearchQuery } = usePageSearch('Search roster…');

    const [classInfo, setClassInfo] = useState(null);
    const [students, setStudents] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [allTeachers, setAllTeachers] = useState([]);
    const [allStudents, setAllStudents] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [selectedTeacherSubjectIds, setSelectedTeacherSubjectIds] = useState([]);
    const [pickedStudentProfileIds, setPickedStudentProfileIds] = useState(() => new Set());
    const [candidateQuery, setCandidateQuery] = useState('');
    const [assigningTeacher, setAssigningTeacher] = useState(false);
    const [assigningStudent, setAssigningStudent] = useState(false);
    const [removingStudentId, setRemovingStudentId] = useState('');
    const [removingTeacherId, setRemovingTeacherId] = useState('');
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [savingClassInfo, setSavingClassInfo] = useState(false);
    const [generatingStudentPasscodeFor, setGeneratingStudentPasscodeFor] = useState('');
    const [generatedPasscodes, setGeneratedPasscodes] = useState({});
    const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);

    const handleGenerateAccounts = async () => {
        if (!(await appConfirm('This will create User login accounts for all students in this class. Proceed?'))) return;

        try {
            setGenerating(true);
            const res = await adminClassService.generateAccounts(id);
            if (res.success) {
                await appSuccess(res.message);
                // Refresh class details to see updated user status
                const updatedRes = await adminClassService.getClass(id);
                if (updatedRes.success) {
                    setStudents(updatedRes.data.enrolledStudents || []);
                }
            }
        } catch (error) {
            console.error("Error generating accounts:", error);
            await appError("Failed to generate student accounts.");
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
            setSelectedSubjectIds(
                Array.isArray(res.data.subjectIds) ? res.data.subjectIds.map(String) : []
            );
        }
    };

    useEffect(() => {
        const load = async () => {
            try {
                await fetchClassDetails();
                const [tRes, sRes, subRes] = await Promise.all([
                    adminTeacherService.getTeachers(),
                    adminStudentService.getStudents(),
                    adminSubjectService.getSubjects(),
                ]);
                if (tRes.success) setAllTeachers(tRes.data || []);
                if (sRes.success) setAllStudents(sRes.data || []);
                if (subRes.success) setAllSubjects(subRes.data || []);
            } catch (error) {
                console.error("Error fetching class details:", error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    useEffect(() => {
        setPickedStudentProfileIds(new Set());
        setCandidateQuery('');
    }, [id]);

    const handleAssignTeacher = async () => {
        if (!selectedTeacherId) return;
        if (!selectedTeacherSubjectIds.length) {
            await appWarning('Select at least one subject for this teacher.');
            return;
        }
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
            await appError(error.message || 'Could not assign teacher');
        } finally {
            setAssigningTeacher(false);
        }
    };

    const handleAddSelectedStudents = async () => {
        const ids = [...pickedStudentProfileIds];
        if (!ids.length) return;
        const targetCode = normalizeClassCode(classInfo?.code || id || '');
        const rows = ids
            .map((pid) => (allStudents || []).find((x) => String(x._id || '') === String(pid || '')))
            .filter(Boolean);
        const movingFromOther = rows.filter((r) => {
            const c = normalizeClassCode(r.classId || r.classCode || '');
            return c && c !== targetCode;
        });
        if (movingFromOther.length > 0) {
            const okMove = await appConfirm(
                `${movingFromOther.length} student(s) are already assigned to another class on their profile (e.g. import placeholder). ` +
                    `Adding them here will move their class to ${targetCode || id}. Continue?`
            );
            if (!okMove) return;
        }
        try {
            setAssigningStudent(true);
            let ok = 0;
            const failures = [];
            for (const profileId of ids) {
                const row = (allStudents || []).find((x) => String(x._id || '') === String(profileId || ''));
                if (!row) {
                    failures.push('Skipped a missing student row');
                    continue;
                }
                const alreadyOnRoster = (students || []).some(
                    (e) =>
                        String(e._id || '').trim() === String(row._id || '').trim() ||
                        (String(row.userId || '').trim() &&
                            String(e.userId || '').trim() === String(row.userId || '').trim()),
                );
                if (alreadyOnRoster) {
                    failures.push(row.name ? `${row.name}: already in this class` : 'Already in this class');
                    continue;
                }
                const assigned = normalizeClassCode(row.classId || row.classCode || '');
                if (assigned === targetCode) {
                    failures.push(
                        row.name ? `${row.name}: already assigned to this class` : 'Already in this class'
                    );
                    continue;
                }
                try {
                    const res = await adminStudentService.updateStudent(profileId, { classCode: id, classId: id });
                    if (!res.success) failures.push(res.message || 'Failed');
                    else ok += 1;
                } catch (err) {
                    failures.push(err.response?.data?.message || err.message || 'Failed');
                }
            }
            setPickedStudentProfileIds(new Set());
            await fetchClassDetails();
            const sRes = await adminStudentService.getStudents();
            if (sRes.success) setAllStudents(sRes.data || []);
            if (failures.length) {
                await appWarning({
                    title: 'Partially assigned',
                    message: `Assigned ${ok} of ${ids.length} student(s). Some errors:\n${failures.slice(0, 8).join('\n')}${failures.length > 8 ? '\n…' : ''}`,
                });
            } else {
                await appSuccess(`Assigned ${ok} student(s) to this class.`);
            }
        } catch (error) {
            console.error('Error assigning students:', error);
            await appError(error.message || 'Could not add students to class');
        } finally {
            setAssigningStudent(false);
        }
    };

    const handleRemoveStudent = async (studentProfileId) => {
        if (!studentProfileId) return;
        if (!(await appConfirm('Remove this student from the current class?'))) return;
        try {
            setRemovingStudentId(String(studentProfileId));
            const res = await adminStudentService.updateStudent(studentProfileId, { classCode: '', classId: '' });
            if (!res.success) throw new Error(res.message || 'Failed to remove student from class');
            await fetchClassDetails();
            const sRes = await adminStudentService.getStudents();
            if (sRes.success) setAllStudents(sRes.data || []);
        } catch (error) {
            console.error('Error removing student from class:', error);
            await appError(error.message || 'Could not remove student from class');
        } finally {
            setRemovingStudentId('');
        }
    };

    const handleRemoveTeacher = async (teacherUserId) => {
        if (!teacherUserId) return;
        if (!(await appConfirm('Remove this teacher (and their subjects) from the current class?'))) return;
        try {
            setRemovingTeacherId(String(teacherUserId));
            const res = await adminClassService.removeTeacher(id, teacherUserId);
            if (!res.success) throw new Error(res.message || 'Failed to remove teacher from class');
            setSelectedTeacherId('');
            setSelectedTeacherSubjectIds([]);
            await fetchClassDetails();
        } catch (error) {
            console.error('Error removing teacher from class:', error);
            await appError(error.response?.data?.message || error.message || 'Could not remove teacher from class');
        } finally {
            setRemovingTeacherId('');
        }
    };

    const filteredData = activeTab === 'students'
        ? students.filter((s) => matchesSearchQuery(searchQuery, s.name, s.studentId, s.email))
        : teachers.filter((t) => matchesSearchQuery(searchQuery, t.name, t.teacherId, t.email));

    const assignedTeacherIds = new Set((teachers || []).map((t) => String(t.userId || t._id || '')));
    const teacherByUserId = useMemo(() => {
        const map = new Map();
        (teachers || []).forEach((t) => {
            const key = String(t.userId || t._id || '');
            if (key) map.set(key, t);
        });
        return map;
    }, [teachers]);

    const handleTeacherSelect = (teacherUserId) => {
        setSelectedTeacherId(teacherUserId);
        if (!teacherUserId) {
            setSelectedTeacherSubjectIds([]);
            return;
        }
        const assigned = teacherByUserId.get(String(teacherUserId));
        if (assigned?.subjects?.length) {
            setSelectedTeacherSubjectIds(assigned.subjects.map((s) => String(s._id)));
        } else if (assigned?.subjectIds?.length) {
            setSelectedTeacherSubjectIds(assigned.subjectIds.map((id) => String(id)));
        } else {
            setSelectedTeacherSubjectIds([]);
        }
    };

    const selectedTeacherAlreadyAssigned = Boolean(
        selectedTeacherId && assignedTeacherIds.has(String(selectedTeacherId))
    );
    // Students already in this class: match roster by profile _id and user id (covers API / list quirks).
    const enrolledProfileIds = new Set(
        (students || []).map((s) => String(s._id || '').trim()).filter(Boolean),
    );
    const enrolledUserIds = new Set(
        (students || []).map((s) => String(s.userId || '').trim()).filter(Boolean),
    );
    const currentClassCode = normalizeClassCode(classInfo?.code || id || '');
    const studentAssignedCode = (s) => normalizeClassCode(s?.classId || s?.classCode || '');

    const isStudentAlreadyInThisClass = (s) => {
        if (!s) return true;
        const pid = String(s._id || '').trim();
        const uid = String(s.userId || '').trim();
        if (pid && enrolledProfileIds.has(pid)) return true;
        if (uid && enrolledUserIds.has(uid)) return true;
        if (currentClassCode && studentAssignedCode(s) === currentClassCode) return true;
        return false;
    };

    /** Not in this class (enrolled roster or same profile class code). */
    const studentCandidates = (allStudents || []).filter((s) => s && !isStudentAlreadyInThisClass(s));

    const studentCanBeBulkAddedToThisClass = (s) => Boolean(s) && !isStudentAlreadyInThisClass(s);

    const studentProfileKey = (s) => String(s._id || s.studentId || '');

    const filteredStudentCandidates = useMemo(() => {
        const q = candidateQuery.trim().toLowerCase();
        if (!q) return studentCandidates;
        return studentCandidates.filter((s) => {
            const hay = `${s.name || ''} ${s.studentId || ''} ${s.email || ''} ${s.classCode || ''} ${s.classId || ''}`.toLowerCase();
            return hay.includes(q);
        });
    }, [studentCandidates, candidateQuery]);

    const togglePickStudent = (profileKey) => {
        if (!profileKey) return;
        const row = studentCandidates.find((x) => studentProfileKey(x) === profileKey);
        if (row && !studentCanBeBulkAddedToThisClass(row)) return;
        setPickedStudentProfileIds((prev) => {
            const next = new Set(prev);
            if (next.has(profileKey)) next.delete(profileKey);
            else next.add(profileKey);
            return next;
        });
    };

    const selectAllFilteredCandidates = () => {
        setPickedStudentProfileIds((prev) => {
            const next = new Set(prev);
            filteredStudentCandidates.forEach((s) => {
                const k = studentProfileKey(s);
                if (k && studentCanBeBulkAddedToThisClass(s)) next.add(k);
            });
            return next;
        });
    };

    const clearPickedStudents = () => setPickedStudentProfileIds(new Set());
    const availableSubjects = useMemo(() => {
        const faculty = String(classInfo?.faculty || '').trim().toLowerCase();
        const department = String(classInfo?.department || '').trim().toLowerCase();
        const source = allSubjects || [];
        if (!faculty) return source;
        const facultySubjects = source.filter(
            (sub) => String(sub.faculty || '').trim().toLowerCase() === faculty
        );
        if (!department) return facultySubjects;
        const deptSubjects = facultySubjects.filter(
            (sub) => String(sub.department || '').trim().toLowerCase() === department
        );
        return deptSubjects.length > 0 ? deptSubjects : facultySubjects;
    }, [allSubjects, classInfo?.faculty, classInfo?.department]);

    const handleToggleSubject = (subjectId) => {
        const id = String(subjectId);
        setSelectedSubjectIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
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
                subjectIds: selectedSubjectIds,
            });
            if (!res.success) throw new Error(res.message || 'Failed to update class');
            await fetchClassDetails();
            await appSuccess('Class subjects updated successfully.');
        } catch (error) {
            console.error('Error updating class subjects:', error);
            await appError(error.response?.data?.message || error.message || 'Could not update subjects');
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
            await appSuccess(`New passcode for ${studentLabel}: ${passcode}`);
            await fetchClassDetails();
        } catch (error) {
            console.error('Error generating student account:', error);
            await appError(error.response?.data?.message || error.message || 'Could not generate account');
        } finally {
            setGeneratingStudentPasscodeFor('');
        }
    };

    if (loading) {
        return (
            <div className="admin-page min-h-[40vh] flex flex-col items-center justify-center">
                <Loader2 className="h-7 w-7 text-[#1D68E3] animate-spin mb-2" />
                <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">Loading class details...</p>
            </div>
        );
    }

    if (!classInfo) {
        return (
            <div className="admin-page min-h-[40vh] flex flex-col items-center justify-center">
                <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">Class not found.</p>
                <button onClick={() => navigate('/admin/classes')} className="mt-3 text-blue-500 text-[12px] font-bold hover:underline">
                    Back to Directory
                </button>
            </div>
        );
    }

    return (
        <div className="admin-page font-sans text-[13px] transition-colors duration-300">
            <div className="flex items-center justify-between mb-3 gap-2">
                <button
                    onClick={() => navigate('/admin/classes')}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-bold text-[12px] hover:bg-slate-50 dark:hover:bg-slate-750 hover:text-[#1D68E3] transition-all group"
                >
                    <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                    Back to Classes
                </button>

                <div className="relative w-full max-w-[220px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    <input
                        type="text"
                        placeholder="Global search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 pl-9 pr-3 text-[12px] outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 dark:text-white transition-colors"
                    />
                </div>
            </div>

            <div className="mb-4">
                <h1 className="text-lg font-black text-[#0F172A] dark:text-white tracking-tight leading-none">{classInfo.code}</h1>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{classInfo.description}</p>
            </div>

            <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-700 mb-4 transition-colors">
                <button
                    onClick={() => { setActiveTab('students'); setSearchQuery(''); }}
                    className={`pb-2 text-[12px] font-bold transition-all relative ${activeTab === 'students' ? 'text-[#1D68E3]' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                    Students
                    {activeTab === 'students' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#1D68E3] rounded-full" />}
                </button>
                <button
                    onClick={() => { setActiveTab('teachers'); setSearchQuery(''); }}
                    className={`pb-2 text-[12px] font-bold transition-all relative ${activeTab === 'teachers' ? 'text-[#1D68E3]' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                    Teachers
                    {activeTab === 'teachers' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#1D68E3] rounded-full" />}
                </button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-4">
                {[
                    { label: 'Total Students', value: students.length },
                    { label: 'Faculty', value: classInfo.faculty },
                    { label: 'Department', value: classInfo.department || '-' },
                    { label: 'Total Teachers', value: teachers.length },
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1 transition-colors">{stat.label}</p>
                        <h3 className="text-base font-black text-[#0F172A] dark:text-white tracking-tight leading-tight truncate transition-colors">{stat.value}</h3>
                    </div>
                ))}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 mb-4">
                <h3 className="text-sm font-black text-[#0F172A] dark:text-white mb-3">Class Subjects</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                    Select subjects for this class from the faculty subjects list.
                </p>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 max-h-36 overflow-y-auto mb-3">
                    {availableSubjects.map((s) => (
                        <label key={s._id} className="flex items-center gap-2 text-[11px] py-0.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedSubjectIds.includes(String(s._id))}
                                onChange={() => handleToggleSubject(s._id)}
                            />
                            <span className="text-slate-700 dark:text-slate-300">
                                {s.name} ({s.code})
                                {s.department ? (
                                    <span className="text-slate-400"> — {s.department}</span>
                                ) : null}
                            </span>
                        </label>
                    ))}
                    {availableSubjects.length === 0 && (
                        <p className="text-[11px] text-slate-500">No subjects available for this class faculty.</p>
                    )}
                </div>
                <button
                    onClick={handleSaveClassInfo}
                    disabled={savingClassInfo}
                    className="px-3 py-1.5 bg-[#1D68E3] text-white rounded-lg text-[12px] font-bold hover:bg-blue-600 disabled:opacity-50"
                >
                    {savingClassInfo ? 'Saving...' : 'Save Subjects'}
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden pb-4 transition-colors">

                <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <h3 className="text-sm font-black text-[#0F172A] dark:text-white transition-colors">
                        {activeTab === 'students' ? 'Enrolled Students' : 'Class Teachers'}
                    </h3>

                    <div className="flex flex-wrap items-center gap-2">
                        {activeTab === 'teachers' && (
                            <>
                                <select
                                    value={selectedTeacherId}
                                    onChange={(e) => handleTeacherSelect(e.target.value)}
                                    className="bg-[#F8FAFB] dark:bg-slate-900 rounded-lg py-2 px-3 text-[12px] text-slate-900 dark:text-white w-full sm:w-[200px] border border-slate-200 dark:border-slate-700 outline-none"
                                >
                                    <option value="">Select teacher...</option>
                                    {(allTeachers || []).map((t) => {
                                        const uid = String(t.userId || t._id || '');
                                        const inClass = assignedTeacherIds.has(uid);
                                        return (
                                            <option key={uid} value={uid}>
                                                {t.name} ({t.teacherId || t.employeeId || 'No ID'})
                                                {inClass ? ' — in class' : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                                {(allTeachers || []).length === 0 && (
                                    <p className="text-[12px] text-slate-500">No teachers in the system yet.</p>
                                )}
                                <div className="bg-[#F8FAFB] dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 max-h-28 overflow-y-auto w-full sm:min-w-[200px] text-slate-900 dark:text-white">
                                    {(classInfo?.subjects || []).length === 0 ? (
                                        <p className="text-[12px] text-slate-500">
                                            Add subjects under Class Information above, save, then assign teachers here.
                                        </p>
                                    ) : (
                                        <>
                                            <p className="text-[11px] font-semibold text-slate-500 mb-1">
                                                Select one or more subjects (checkboxes)
                                            </p>
                                            {(classInfo?.subjects || []).map((s) => (
                                                <label key={s._id} className="flex items-center gap-2 text-[12px] py-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedTeacherSubjectIds.includes(String(s._id))}
                                                        onChange={() => handleToggleTeacherSubject(s._id)}
                                                    />
                                                    <span>{s.name} ({s.code})</span>
                                                </label>
                                            ))}
                                        </>
                                    )}
                                </div>
                                <button
                                    onClick={handleAssignTeacher}
                                    disabled={
                                        !selectedTeacherId ||
                                        !selectedTeacherSubjectIds.length ||
                                        assigningTeacher ||
                                        !(classInfo?.subjects || []).length
                                    }
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1D68E3] text-white rounded-lg font-bold text-[11px] hover:bg-blue-600 transition-all disabled:opacity-50"
                                >
                                    {assigningTeacher
                                        ? 'Saving...'
                                        : selectedTeacherAlreadyAssigned
                                          ? 'Update teacher subjects'
                                          : 'Assign teacher + subjects'}
                                </button>
                            </>
                        )}
                        <button
                            onClick={handleGenerateAccounts}
                            disabled={generating}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1D68E3] text-white rounded-lg font-bold text-[11px] hover:bg-blue-600 transition-all disabled:opacity-50"
                        >
                            <UserPlus className="h-3.5 w-3.5" />
                            {generating ? 'Generating...' : 'Generate Student Accounts'}
                        </button>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                            <input
                                type="text"
                                placeholder={`Filter ${activeTab}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-[#F8FAFB] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-2 pl-9 pr-3 text-[12px] w-full sm:w-[180px] outline-none focus:ring-2 focus:ring-blue-500/10 dark:text-white transition-all"
                            />
                        </div>
                    </div>
                </div>
                {activeTab === 'students' && (
                    <>
                        <p className="px-4 pb-2 text-[10px] text-slate-500 leading-snug max-w-3xl">
                            Students who are <strong>not in this class</strong> ({studentCandidates.length} available): anyone already in the
                            roster above or with this class on their profile is hidden. Others can be added, or moved here from another profile
                            class (confirm when moving).
                        </p>
                        <div className="px-4 pb-4">
                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFB] dark:bg-slate-900/40 p-3">
                                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                            Add students to this class
                                        </h4>
                                        <p className="mt-0.5 max-w-xl text-[10px] font-medium text-slate-600 dark:text-slate-400">
                                            The <strong>Current class</strong> column shows each student&apos;s profile class.{' '}
                                            <strong>Select all</strong> selects everyone in the list; <strong>Add selected</strong> assigns or moves them here.
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={selectAllFilteredCandidates}
                                            disabled={
                                                assigningStudent ||
                                                !filteredStudentCandidates.some((s) => studentCanBeBulkAddedToThisClass(s))
                                            }
                                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                        >
                                            Select all
                                        </button>
                                        <button
                                            type="button"
                                            onClick={clearPickedStudents}
                                            disabled={pickedStudentProfileIds.size === 0 || assigningStudent}
                                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                        >
                                            Clear selection
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleAddSelectedStudents}
                                            disabled={pickedStudentProfileIds.size === 0 || assigningStudent}
                                            className="flex items-center gap-1.5 rounded-lg bg-[#1D68E3] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-600 disabled:opacity-50"
                                        >
                                            {assigningStudent ? (
                                                <>
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    Adding…
                                                </>
                                            ) : (
                                                `Add selected (${pickedStudentProfileIds.size})`
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <div className="relative mt-2">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={candidateQuery}
                                        onChange={(e) => setCandidateQuery(e.target.value)}
                                        placeholder="Search by name, ID, email, or class code…"
                                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                    />
                                </div>
                                <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800">
                                    {filteredStudentCandidates.length === 0 ? (
                                        <p className="p-3 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                            {studentCandidates.length === 0
                                                ? 'No students available to add: everyone is already on this class in their profile, or listed in the table above.'
                                                : 'No students match your search.'}
                                        </p>
                                    ) : (
                                        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                                            <li className="hidden sm:flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-400">
                                                <span className="w-4 shrink-0" aria-hidden />
                                                <span className="min-w-0 flex-1">Student</span>
                                                <span className="w-28 shrink-0 text-right sm:w-32">Current class</span>
                                            </li>
                                            {filteredStudentCandidates.map((s) => {
                                                const k = studentProfileKey(s);
                                                const canAdd = studentCanBeBulkAddedToThisClass(s);
                                                const assignedRaw = String(s.classId || s.classCode || '').trim();
                                                const assignedDisplay = assignedRaw ? normalizeClassCode(assignedRaw) : '';
                                                return (
                                                    <li key={k}>
                                                        <label
                                                            className={`flex items-center gap-2 px-2.5 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40 ${
                                                                canAdd ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                disabled={!canAdd}
                                                                className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-[#1D68E3] focus:ring-[#1D68E3] disabled:cursor-not-allowed"
                                                                checked={pickedStudentProfileIds.has(k)}
                                                                onChange={() => togglePickStudent(k)}
                                                            />
                                                            <div className="min-w-0 flex-1">
                                                                <div className="truncate text-[12px] font-bold text-slate-800 dark:text-slate-100">
                                                                    {s.name || 'Unknown'}
                                                                </div>
                                                                <div className="truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                                                    {s.studentId || 'no ID'} · {s.email || '—'}
                                                                </div>
                                                            </div>
                                                            <div className="w-28 shrink-0 text-right sm:w-32">
                                                                {assignedDisplay ? (
                                                                    <Link
                                                                        to={`/admin/classes/${encodeURIComponent(assignedDisplay)}`}
                                                                        className="inline-block max-w-full truncate font-mono text-[11px] font-bold text-[#1D68E3] hover:underline"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        {assignedDisplay}
                                                                    </Link>
                                                                ) : (
                                                                    <span className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                                                        None
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </label>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Table */}
                <div className="app-table-wrap">
                    <table className="app-table">
                        <thead>
                            <tr className="app-table-headrow">
                                <th className="app-table-th">Name</th>
                                <th className="app-table-th">ID / Department</th>
                                {activeTab === 'teachers' && <th className="app-table-th">Subjects</th>}
                                {activeTab === 'students' && <th className="app-table-th">Class</th>}
                                <th className="app-table-th">{activeTab === 'students' ? 'Username / Email' : 'Faculty Email'}</th>
                                <th className="app-table-th">Status</th>
                                {activeTab === 'students' && <th className="app-table-th">Account</th>}
                                <th className="app-table-th text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="app-table-body">
                            {filteredData.map((item) => (
                                <tr key={item._id} className="app-table-row group">
                                    <td className="app-table-td">
                                        <div className="flex items-center gap-2">
                                            <Link
                                                to={`/admin/${activeTab}/${activeTab === 'students' ? item.studentId : item.teacherId}`}
                                                state={{ from: location.pathname }}
                                                className="hover:scale-105 transition-transform"
                                            >
                                                <img src={item.photo || 'https://via.placeholder.com/150'} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-100 dark:border-slate-700 shadow-sm transition-colors" />
                                            </Link>
                                            <div>
                                                <Link
                                                    to={`/admin/${activeTab}/${activeTab === 'students' ? item.studentId : item.teacherId}`}
                                                    state={{ from: location.pathname }}
                                                    className="text-[12px] font-bold text-[#0F172A] dark:text-white hover:text-[#1D68E3] transition-colors line-clamp-1"
                                                >
                                                    {item.name || 'Unknown User'}
                                                </Link>
                                                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 transition-colors line-clamp-1">{item.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="app-table-td">
                                        <span className="text-[12px] font-bold text-slate-600 dark:text-slate-300 tracking-tight transition-colors">
                                            {activeTab === 'students' ? item.studentId : item.department}
                                        </span>
                                    </td>
                                    {activeTab === 'teachers' && (
                                        <td className="app-table-td">
                                            <div className="flex flex-wrap gap-1.5 max-w-md">
                                                {(item.subjects || []).length ? (
                                                    item.subjects.map((sub) => (
                                                        <span
                                                            key={sub._id}
                                                            className="inline-flex rounded-md bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-[#1D68E3]"
                                                        >
                                                            {sub.name}
                                                            {sub.code ? ` (${sub.code})` : ''}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-[12px] text-slate-400">No subjects</span>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                    {activeTab === 'students' && (
                                        <td className="app-table-td">
                                            <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                                {currentClassCode || id || '—'}
                                            </span>
                                        </td>
                                    )}
                                    <td className="app-table-td">
                                        <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400 transition-colors">
                                            {activeTab === 'students'
                                                ? (item.username ? `${item.username} / ${item.email}` : item.email)
                                                : item.email}
                                        </span>
                                    </td>
                                    <td className="app-table-td">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${(item.accountStatus || 'active') === 'active' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500'} transition-colors`}>
                                            <div className={`h-1.5 w-1.5 rounded-full ${(item.accountStatus || 'active') === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                            {(item.accountStatus || 'active').charAt(0).toUpperCase() + (item.accountStatus || 'active').slice(1)}
                                        </span>
                                    </td>
                                    {activeTab === 'students' && (
                                        <td className="app-table-td">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${(item.hasAccount ?? Boolean(item.userId)) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                {(item.hasAccount ?? Boolean(item.userId)) ? 'Has Account' : 'No Account'}
                                            </span>
                                            {generatedPasscodes[String(item._id)] && (
                                                <div className="mt-1 text-[11px] font-mono text-slate-700">
                                                    Passcode: {generatedPasscodes[String(item._id)]}
                                                </div>
                                            )}
                                        </td>
                                    )}
                                    <td className="app-table-td text-right">
                                        {activeTab === 'students' ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleGenerateStudentAccount(item._id, item.name || item.studentId)}
                                                    disabled={generatingStudentPasscodeFor === String(item._id)}
                                                    className="px-2 py-1 text-[10px] font-bold rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                                >
                                                    {generatingStudentPasscodeFor === String(item._id) ? 'Generating...' : 'Generate/Reset'}
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveStudent(item._id)}
                                                    disabled={removingStudentId === String(item._id)}
                                                    className="px-2 py-1 text-[10px] font-bold rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                                                >
                                                    {removingStudentId === String(item._id) ? 'Removing...' : 'Remove'}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleTeacherSelect(String(item.userId || item._id))}
                                                    className="px-2 py-1 text-[10px] font-bold rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
                                                >
                                                    Edit subjects
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveTeacher(item.userId || item._id)}
                                                    disabled={removingTeacherId === String(item.userId || item._id)}
                                                    className="px-2 py-1 text-[10px] font-bold rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                                                >
                                                    {removingTeacherId === String(item.userId || item._id) ? 'Removing...' : 'Remove'}
                                                </button>
                                            </div>
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
