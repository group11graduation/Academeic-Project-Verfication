import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import adminClassService from '../../../services/adminClassService';
import adminSemesterService from '../../../services/adminSemesterService';
import adminSubjectService from '../../../services/adminSubjectService';
import { adminAcademicService } from '../../../services/adminAcademicService';
import { appAlert, appConfirm, appError, appSuccess, appWarning } from '../../../lib/appDialog';

const AdminAddClass = () => {
    const navigate = useNavigate();
    const [className, setClassName] = useState('');
    const [classCode, setClassCode] = useState('');
    const [selectedFaculty, setSelectedFaculty] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [selectedSemester, setSelectedSemester] = useState('');
    const [semesters, setSemesters] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [academicStructure, setAcademicStructure] = useState({ faculties: [] });
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    const [saving, setSaving] = useState(false);
    const [description, setDescription] = useState('');

    useEffect(() => {
        const loadSemesters = async () => {
            try {
                const [semRes, subjRes, structureRes] = await Promise.all([
                    adminSemesterService.getSemesters(),
                    adminSubjectService.getSubjects(),
                    adminAcademicService.getAcademicStructure(),
                ]);
                if (semRes.success) {
                    setSemesters(semRes.data || []);
                }
                if (subjRes.success) {
                    setSubjects(subjRes.data || []);
                }
                if (structureRes.success) {
                    setAcademicStructure(structureRes.data || { faculties: [] });
                }
            } catch (err) {
                console.error('Failed to load registration metadata:', err);
            }
        };
        loadSemesters();
    }, []);

    const semesterOptions = useMemo(() => {
        return (semesters || []).map((s) => ({
            value: s._id,
            label: `${s.academicYearLabel ? `${s.academicYearLabel} - ` : ''}${s.name || `Semester ${s.order || ''}`.trim()}`,
        }));
    }, [semesters]);

    const facultyOptions = (academicStructure.faculties || []).map((f) => f.name);
    const departmentOptions = useMemo(() => {
        const row = (academicStructure.faculties || []).find((f) => f.name === selectedFaculty);
        return row?.departments || [];
    }, [academicStructure, selectedFaculty]);

    const availableSubjects = useMemo(() => {
        if (!selectedFaculty || !selectedDepartment) return [];
        const source = subjects || [];
        return source.filter((s) => {
            const subFaculty = String(s.faculty || '').trim().toLowerCase();
            const subDepartment = String(s.department || '').trim().toLowerCase();
            const facultyOk = subFaculty === selectedFaculty.toLowerCase();
            const departmentOk = subDepartment === selectedDepartment.toLowerCase();
            return facultyOk && departmentOk;
        });
    }, [subjects, selectedFaculty, selectedDepartment]);

    const handleRegisterClass = async () => {
        if (!className.trim() || !classCode.trim() || !selectedFaculty || !selectedDepartment || !selectedSemester) {
            await appWarning('Please fill Class Name, Class Code, Faculty, Department and Semester.');
            return;
        }
        try {
            setSaving(true);
            const payload = {
                name: className.trim(),
                code: classCode.trim().toUpperCase(),
                faculty: selectedFaculty,
                department: selectedDepartment,
                semester: selectedSemester,
                description: description.trim(),
                subjectIds: selectedSubjectId ? [selectedSubjectId] : [],
            };
            const res = await adminClassService.createClass(payload);
            if (!res.success) {
                throw new Error(res.message || 'Failed to register class');
            }
            navigate(`/admin/classes/${payload.code}`);
        } catch (err) {
            console.error('Register class failed:', err);
            await appError(err.response?.data?.message || err.message || 'Could not register class');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-8 max-w-[960px] mx-auto font-sans bg-[#F8FAFB] min-h-screen">
            <div className="flex items-center justify-between mb-8">
                <button
                    onClick={() => navigate('/admin/classes')}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold transition-colors group"
                >
                    <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                    Back to Classes
                </button>
                <button
                    onClick={handleRegisterClass}
                    disabled={saving}
                    className="flex items-center gap-2 bg-[#1D68E3] text-white px-6 py-3 rounded-[12px] font-bold text-[14px] hover:bg-blue-700 disabled:opacity-60"
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Register New Class
                </button>
            </div>

            <header className="mb-8">
                <h1 className="text-[30px] font-extrabold text-[#0F172A] tracking-tight mb-2">New Class Registration</h1>
                <p className="text-[15px] text-slate-500 font-medium">Create a class section. Course registration is now managed from Subjects page.</p>
            </header>

            <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-[14px] font-bold text-[#0F172A] mb-2">Class Name</label>
                        <input
                            value={className}
                            onChange={(e) => setClassName(e.target.value)}
                            placeholder="e.g. CS 2nd Year Section A"
                            className="w-full bg-white border border-slate-200 rounded-[12px] py-3 px-4 text-[14px] font-semibold text-black outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>
                    <div>
                        <label className="block text-[14px] font-bold text-[#0F172A] mb-2">Class Code</label>
                        <input
                            value={classCode}
                            onChange={(e) => setClassCode(e.target.value)}
                            placeholder="e.g. CS223-A"
                            className="w-full bg-white border border-slate-200 rounded-[12px] py-3 px-4 text-[14px] font-semibold text-black outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                        <label className="block text-[14px] font-bold text-[#0F172A] mb-2">Faculty</label>
                        <select
                            value={selectedFaculty}
                            onChange={(e) => {
                                setSelectedFaculty(e.target.value);
                                setSelectedDepartment('');
                                setSelectedSubjectId('');
                            }}
                            className="w-full bg-white border border-slate-200 rounded-[12px] py-3 px-4 text-[14px] font-semibold text-black outline-none"
                        >
                            <option value="">Select Faculty</option>
                            {facultyOptions.map((f) => (
                                <option key={f} value={f}>{f}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[14px] font-bold text-[#0F172A] mb-2">Department</label>
                        <select
                            value={selectedDepartment}
                            onChange={(e) => {
                                setSelectedDepartment(e.target.value);
                                setSelectedSubjectId('');
                            }}
                            disabled={!selectedFaculty}
                            className="w-full bg-white border border-slate-200 rounded-[12px] py-3 px-4 text-[14px] font-semibold text-black outline-none disabled:bg-slate-100 disabled:text-slate-400"
                        >
                            <option value="">Select Department</option>
                            {departmentOptions.map((d) => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[14px] font-bold text-[#0F172A] mb-2">Semester</label>
                        <select
                            value={selectedSemester}
                            onChange={(e) => setSelectedSemester(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-[12px] py-3 px-4 text-[14px] font-semibold text-black outline-none"
                        >
                            <option value="">Select Semester</option>
                            {semesterOptions.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-[14px] font-bold text-[#0F172A] mb-2">
                        Subject for this class (optional)
                    </label>
                    <div className="rounded-[12px] border border-slate-200 bg-white p-3 max-h-56 overflow-y-auto space-y-2">
                        {!selectedFaculty || !selectedDepartment ? (
                            <p className="text-[13px] text-slate-500">
                                Select faculty and department first.
                            </p>
                        ) : availableSubjects.length === 0 ? (
                            <p className="text-[13px] text-slate-500">
                                No subjects found for selected faculty/department yet.
                            </p>
                        ) : (
                            availableSubjects.map((s) => (
                                <label
                                    key={s._id}
                                    className="flex items-center gap-2 text-[13px] text-slate-700 font-medium"
                                >
                                    <input
                                        type="radio"
                                        name="class-subject"
                                        checked={selectedSubjectId === s._id}
                                        onChange={() => setSelectedSubjectId(s._id)}
                                        className="rounded border-slate-300"
                                    />
                                    <span>{s.name} ({s.code})</span>
                                </label>
                            ))
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-[14px] font-bold text-[#0F172A] mb-2">Notes / Description (optional)</label>
                    <textarea
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="e.g. Morning section for practical labs."
                        className="w-full bg-white border border-slate-200 rounded-[12px] py-3 px-4 text-[14px] font-medium text-black outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>
            </div>
        </div>
    );
};

export default AdminAddClass;
