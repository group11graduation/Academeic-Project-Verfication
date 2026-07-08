import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { appAlert, appConfirm, appError, appSuccess, appWarning } from '../../../lib/appDialog';
import {
    ArrowLeft, MapPin, Mail, MessageSquare, Edit2,
    User, Phone, Building2, BarChart2, CheckCircle2,
    Clock, RefreshCw, BookOpen, Users, ArrowRight,
    Eye, EyeOff, Shield, Loader2, GraduationCap, Edit3, ShieldCheck, Copy, Check
} from 'lucide-react';
import adminTeacherService from '../../../services/adminTeacherService';
import adminClassService from '../../../services/adminClassService';
import { X, Save } from 'lucide-react';

const AdminTeacherProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [showPasscode, setShowPasscode] = useState(false);
    const [teacher, setTeacher] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAssigning, setIsAssigning] = useState(false);
    const [allClasses, setAllClasses] = useState([]);
    const [loadingAssignments, setLoadingAssignments] = useState(false);
    const [selectedClasses, setSelectedClasses] = useState([]);
    const [isPromoting, setIsPromoting] = useState(false);
    const [copiedPasscode, setCopiedPasscode] = useState(false);

    useEffect(() => {
        const fetchTeacher = async () => {
            try {
                const response = await adminTeacherService.getTeacher(id);
                if (response.success) {
                    setTeacher(response.data);
                }
            } catch (error) {
                console.error("Failed to fetch teacher profile:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTeacher();
    }, [id]);

    const fetchAllClasses = async () => {
        try {
            const res = await adminClassService.getClasses();
            if (res.success) {
                setAllClasses(res.data);
                if (teacher) {
                    setSelectedClasses(teacher.assignedClasses || []);
                }
            }
        } catch (error) {
            console.error("Failed to fetch classes:", error);
        }
    };

    const handleOpenAssignment = () => {
        fetchAllClasses();
        setIsAssigning(true);
    };

    const handleToggleClass = (code) => {
        setSelectedClasses(prev =>
            prev.includes(code)
                ? prev.filter(c => c !== code)
                : [...prev, code]
        );
    };

    const handleSaveAssignments = async () => {
        setLoadingAssignments(true);
        try {
            const res = await adminTeacherService.assignClasses(id, selectedClasses);
            if (res.success) {
                const response = await adminTeacherService.getTeacher(id);
                if (response.success) {
                    setTeacher(response.data);
                }
                setIsAssigning(false);
            }
        } catch (error) {
            console.error("Failed to assign classes:", error);
            await appError("Failed to save assignments.");
        } finally {
            setLoadingAssignments(false);
        }
    };

    const handleToggleAdmin = async () => {
        if (!(await appConfirm(`Are you sure you want to ${teacher.userId?.roles?.includes('admin') ? 'revoke' : 'grant'} administrative privileges for this teacher?`))) return;

        setIsPromoting(true);
        try {
            const res = await adminTeacherService.toggleAdmin(id);
            if (res.success) {
                // Refresh teacher data
                const response = await adminTeacherService.getTeacher(id);
                if (response.success) {
                    setTeacher(response.data);
                }
                await appSuccess(res.message);
            }
        } catch (error) {
            console.error("Failed to toggle admin status:", error);
            await appError("Failed to update administrative status.");
        } finally {
            setIsPromoting(false);
        }
    };

    const handleCopyPasscode = async () => {
        if (!teacher?.passcode) return;
        try {
            await navigator.clipboard.writeText(String(teacher.passcode));
            setCopiedPasscode(true);
            window.setTimeout(() => setCopiedPasscode(false), 2000);
        } catch (error) {
            console.error('Failed to copy passcode:', error);
            await appError('Failed to copy passcode.');
        }
    };

    // Context-aware back navigation
    const backPath = location.state?.from || '/admin/teachers';
    const backLabel = backPath.includes('/classes/') ? 'Back to Class' : 'Back to Teachers';

    if (loading) {
        return (
            <div className="min-h-[40vh] flex flex-col items-center justify-center">
                <Loader2 className="h-7 w-7 text-[#1D68E3] animate-spin mb-2" />
                <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">Loading profile...</p>
            </div>
        );
    }

    if (!teacher) {
        return (
            <div className="min-h-[40vh] flex flex-col items-center justify-center">
                <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">Teacher not found.</p>
                <button onClick={() => navigate('/admin/teachers')} className="mt-3 text-blue-500 font-bold hover:underline text-[12px]">
                    Back to Directory
                </button>
            </div>
        );
    }

    // Adapt real data to view
    const stats = {
        reviewed: 0, // Placeholder for future feature
        pending: 0,
        avgSimilarity: 0
    };

    return (
        <div className="font-sans text-[13px] transition-colors">

            <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
                <div>
                    <h1 className="text-base font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-none mb-0.5">Teacher Profile</h1>
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest leading-none">Academic Record</p>
                </div>
                <button
                    onClick={() => navigate(backPath)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-bold text-[12px] hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {backLabel}
                </button>
            </header>

            {/* Top Profile Card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 mb-4 flex flex-col md:flex-row items-center gap-4 transition-all text-center md:text-left">
                {/* Image Placeholder or Photo */}
                <div className="relative shrink-0">
                    <div className="w-20 h-20 rounded-lg bg-slate-100 dark:bg-slate-700 relative flex items-center justify-center overflow-hidden transition-colors">
                        {teacher.photo && teacher.photo !== 'https://via.placeholder.com/150' ? (
                            <img src={teacher.photo} alt={teacher.name} className="w-full h-full object-cover" />
                        ) : (
                            <GraduationCap className="h-10 w-10 text-slate-200 dark:text-slate-600" />
                        )}
                    </div>

                    <div className="absolute -bottom-2 -right-2 z-10">
                        <span className={`px-3 py-1 text-[11px] font-extrabold tracking-widest uppercase rounded-[8px] border-[3px] border-white dark:border-slate-800 ${teacher.status === 'ACTIVE' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'} shadow-sm`}>
                            {teacher.status}
                        </span>
                    </div>
                </div>

                <div className="flex-1 shrink-0">
                    <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 mb-2">
                        <h2 className="text-base md:text-lg font-black text-[#0F172A] dark:text-white transition-colors">{teacher.name}</h2>
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-[11px] font-bold tracking-wider transition-colors">
                            {teacher.teacherId}
                        </span>
                    </div>
                    <div className="flex items-center justify-center md:justify-start gap-1.5 text-slate-500 dark:text-slate-400 font-medium mb-3 text-[12px] transition-colors">
                        <Building2 className="h-3.5 w-3.5" />
                        {teacher.department}
                    </div>
                    <div className="flex gap-2 justify-center md:justify-start flex-wrap">
                        <button className="flex items-center gap-1.5 px-3 py-2 bg-[#1D68E3] text-white rounded-lg font-bold text-[12px] hover:bg-blue-700 transition-colors">
                            <MessageSquare className="h-3.5 w-3.5" />
                            Message Teacher
                        </button>
                        <button
                            onClick={() => navigate(`/admin/teachers/${id}/edit`)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-[12px] hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit Profile
                        </button>
                    </div>
                </div>
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

                {/* Left Column (Info & Stats) */}
                <div className="space-y-4">

                    {/* Personal Info */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 transition-all">
                        <div className="flex items-center gap-2 mb-4">
                            <User className="h-4 w-4 text-[#1D68E3]" />
                            <h3 className="text-[12px] font-black uppercase tracking-widest text-[#0F172A] dark:text-white transition-colors">Personal Information</h3>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <p className="text-[11px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1 transition-colors">Full Legal Name</p>
                                <p className="text-[13px] font-medium text-[#0F172A] dark:text-white transition-colors">{teacher.name}</p>
                            </div>
                            <div>
                                <p className="text-[11px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1 transition-colors">Email Address</p>
                                <p className="text-[13px] font-medium text-[#0F172A] dark:text-white transition-colors">{teacher.email}</p>
                            </div>
                            <div>
                                <p className="text-[11px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1 transition-colors">Phone Number</p>
                                <p className="text-[13px] font-medium text-[#0F172A] dark:text-white transition-colors">{teacher.phone || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-[11px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1 transition-colors">Faculty Department</p>
                                <p className="text-[13px] font-medium text-[#0F172A] dark:text-white transition-colors">{teacher.department}</p>
                            </div>
                        </div>
                    </div>

                    {/* Security & Access */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 transition-all">
                        <div className="flex items-center gap-2 mb-4">
                            <Shield className="h-4 w-4 text-[#1D68E3]" />
                            <h3 className="text-[12px] font-black uppercase tracking-widest text-[#0F172A] dark:text-white transition-colors">Security & Access</h3>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-lg p-4 transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1 transition-colors">Administrative Passcode</p>
                                    <div className="flex items-center gap-3">
                                        {showPasscode ? (
                                            <span className="text-lg font-black text-[#0F172A] dark:text-white tracking-widest font-mono transition-colors">
                                                {teacher.passcode}
                                            </span>
                                        ) : (
                                            <span className="text-lg font-black text-slate-300 dark:text-slate-700 tracking-[0.3em] leading-none pt-1 transition-colors">
                                                ••••••
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleCopyPasscode}
                                            disabled={!teacher.passcode}
                                            className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 disabled:opacity-60"
                                            title="Copy passcode"
                                        >
                                            {copiedPasscode ? <Check className="h-5 w-5 text-emerald-500" /> : <Copy className="h-5 w-5 text-slate-400 dark:text-slate-500" />}
                                        </button>
                                        <button
                                            onClick={() => setShowPasscode(!showPasscode)}
                                            className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                                        >
                                            {showPasscode ? <EyeOff className="h-5 w-5 text-slate-400 dark:text-slate-500" /> : <Eye className="h-5 w-5 text-[#1D68E3]" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-blue-100/50 dark:bg-blue-500/10 p-2 rounded-lg text-[#1D68E3] transition-colors">
                                    <Shield className="h-4 w-4" />
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleToggleAdmin}
                                    disabled={isPromoting}
                                    className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-[12px] transition-all border ${teacher.userId?.roles?.includes('admin')
                                        ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'
                                        : 'bg-blue-50 border-blue-200 text-[#1D68E3] hover:bg-blue-100'
                                        }`}
                                >
                                    {isPromoting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                    {teacher.userId?.roles?.includes('admin') ? 'Revoke Admin' : 'Grant Admin'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Activity Summary */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 transition-all">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart2 className="h-4 w-4 text-[#1D68E3]" />
                            <h3 className="text-[12px] font-black uppercase tracking-widest text-[#0F172A] dark:text-white transition-colors">Activity Summary</h3>
                        </div>

                        <div className="space-y-3">
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700 flex items-center justify-between transition-colors">
                                <div>
                                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5 transition-colors">Projects Reviewed</p>
                                    <p className="text-xl font-extrabold text-[#1D68E3] leading-none">{stats.reviewed}</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center text-[#1D68E3] transition-colors">
                                    <CheckCircle2 className="h-4 w-4" />
                                </div>
                            </div>

                            <div className="bg-[#FFFDF4] dark:bg-amber-500/5 p-3 rounded-lg border border-amber-100 dark:border-amber-500/20 flex items-center justify-between transition-colors">
                                <div>
                                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5 transition-colors">Pending Reviews</p>
                                    <p className="text-xl font-extrabold text-amber-600 dark:text-amber-500 leading-none">{stats.pending}</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-500 transition-colors">
                                    <Clock className="h-4 w-4" />
                                </div>
                            </div>

                            <div className="bg-emerald-50/50 dark:bg-emerald-500/5 p-3 rounded-lg border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-between transition-colors">
                                <div>
                                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5 transition-colors">Avg. Similarity Score</p>
                                    <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-500 leading-none">{stats.avgSimilarity}%</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-500 transition-colors">
                                    <RefreshCw className="h-4 w-4" />
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Right Column (Classes & Submissions) */}
                <div className="xl:col-span-2 space-y-4">

                    {/* Assigned Subjects */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-[#1D68E3]" />
                                <h3 className="text-[12px] font-black uppercase tracking-widest text-[#0F172A] dark:text-white transition-colors">Assigned Subjects & Classes</h3>
                            </div>
                            <button
                                onClick={handleOpenAssignment}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-[#1D68E3] rounded-lg font-bold text-[12px] hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
                            >
                                <Users className="h-3.5 w-3.5" />
                                Assign/Modify Classes
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {teacher.classes && teacher.classes.length > 0 ? (
                                teacher.classes.map((cls, idx) => (
                                    <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 hover:shadow-md transition-shadow group cursor-pointer relative overflow-hidden bg-white dark:bg-slate-800/50">
                                        {/* subtle decorative blur */}
                                        <div className="absolute -right-8 -top-8 w-32 h-32 bg-slate-50 dark:bg-slate-700/30 rounded-full blur-2xl group-hover:bg-blue-50/50 dark:group-hover:bg-blue-500/10 transition-colors"></div>

                                        <div className="relative z-10">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md text-[11px] font-bold transition-colors">
                                                    {cls.code}
                                                </span>
                                                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 transition-colors">
                                                    <Users className="h-3 w-3" />
                                                    {cls.students} Students
                                                </span>
                                            </div>

                                            <h4 className="text-[13px] font-bold text-[#0F172A] dark:text-white mb-1 leading-tight min-h-[32px] transition-colors">
                                                {cls.title}
                                            </h4>
                                            <p className="text-[12px] font-medium text-slate-400 dark:text-slate-500 mb-3 transition-colors">
                                                {cls.timing}
                                            </p>

                                            <div className="flex items-center justify-between">
                                                <div className="flex -space-x-2">
                                                    {cls.avatars.map((av, i) => (
                                                        <div key={i} className={`w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 ${av} flex items-center justify-center overflow-hidden transition-colors`}>
                                                            {/* Avatar silhouettes */}
                                                        </div>
                                                    ))}
                                                    <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 z-10 transition-colors">
                                                        {cls.moreStudents}
                                                    </div>
                                                </div>

                                                <button className="w-8 h-8 flex items-center justify-center text-slate-400 group-hover:text-[#1D68E3] transition-colors">
                                                    <ArrowRight className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full py-6 text-center bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 transition-colors">
                                    <BookOpen className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                                    <p className="text-[12px] text-slate-400 dark:text-slate-500 font-medium transition-colors">No assigned classes yet.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Submissions */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 transition-all">
                        <h3 className="text-[12px] font-black uppercase tracking-widest text-[#0F172A] dark:text-white mb-3 transition-colors">Recent Project Submissions</h3>

                        <div className="py-10 text-center bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 transition-colors">
                            <Clock className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                            <p className="text-[12px] text-slate-400 dark:text-slate-500 font-medium transition-colors">No recent submissions found.</p>
                        </div>
                    </div>

                </div>
            </div>

            {/* Assignment Modal */}
            {isAssigning && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all">
                    <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden border border-white/20 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 transition-colors">
                            <div>
                                <h3 className="text-base font-black tracking-tight mb-0.5 dark:text-white transition-colors">Assign Academic Classes</h3>
                                <p className="text-slate-400 dark:text-slate-500 text-[12px] font-medium transition-colors">Link {teacher?.name} to their active sections</p>
                            </div>
                            <button onClick={() => setIsAssigning(false)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all">
                                <X className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                            </button>
                        </div>

                        <div className="p-4 max-h-[400px] overflow-y-auto">
                            <div className="grid grid-cols-1 gap-2">
                                {allClasses.length > 0 ? (
                                    allClasses.map(cls => (
                                        <button
                                            key={cls._id}
                                            onClick={() => handleToggleClass(cls.code)}
                                            className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all group ${selectedClasses.includes(cls.code)
                                                ? 'border-[#1D68E3] bg-blue-50/30 dark:bg-blue-500/10 ring-4 ring-blue-500/5'
                                                : 'border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${selectedClasses.includes(cls.code)
                                                    ? 'bg-[#1D68E3] text-white'
                                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 group-hover:bg-slate-200 dark:group-hover:bg-slate-600'
                                                    }`}>
                                                    <BookOpen className="h-6 w-6" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="font-black text-[15px] text-slate-700 dark:text-white transition-colors">{cls.code}</p>
                                                    <p className="text-[12px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">{cls.faculty}</p>
                                                </div>
                                            </div>
                                            <div className={`h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all ${selectedClasses.includes(cls.code)
                                                ? 'bg-[#1D68E3] border-[#1D68E3] text-white scale-110'
                                                : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-transparent'
                                                }`}>
                                                <CheckCircle2 className="h-4 w-4" />
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="py-12 text-center text-slate-400 dark:text-slate-500 font-medium bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed dark:border-slate-700 transition-colors">
                                        No classes found in directory.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between transition-colors">
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                <p className="text-[12px] font-black text-[#1D68E3] uppercase tracking-wider">
                                    {selectedClasses.length} Selected
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsAssigning(false)}
                                    className="px-4 py-2 rounded-lg font-bold text-[12px] text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveAssignments}
                                    disabled={loadingAssignments}
                                    className="px-5 py-2 bg-[#1D68E3] text-white rounded-lg font-black text-[12px] hover:bg-blue-600 transition-all flex items-center gap-1.5 disabled:opacity-70"
                                >
                                    {loadingAssignments ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-blue-200" />}
                                    {loadingAssignments ? 'Updating...' : 'Confirm Assignment'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTeacherProfile;
