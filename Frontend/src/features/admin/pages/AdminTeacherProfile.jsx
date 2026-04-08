import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    ArrowLeft, MapPin, Mail, MessageSquare, Edit2,
    User, Phone, Building2, BarChart2, CheckCircle2,
    Clock, RefreshCw, BookOpen, Users, ArrowRight,
    Eye, EyeOff, Shield, Loader2, GraduationCap, Edit3, ShieldCheck
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
            alert("Failed to save assignments.");
        } finally {
            setLoadingAssignments(false);
        }
    };

    const handleToggleAdmin = async () => {
        if (!window.confirm(`Are you sure you want to ${teacher.userId?.roles?.includes('admin') ? 'revoke' : 'grant'} administrative privileges for this teacher?`)) return;

        setIsPromoting(true);
        try {
            const res = await adminTeacherService.toggleAdmin(id);
            if (res.success) {
                // Refresh teacher data
                const response = await adminTeacherService.getTeacher(id);
                if (response.success) {
                    setTeacher(response.data);
                }
                alert(res.message);
            }
        } catch (error) {
            console.error("Failed to toggle admin status:", error);
            alert("Failed to update administrative status.");
        } finally {
            setIsPromoting(false);
        }
    };

    // Context-aware back navigation
    const backPath = location.state?.from || '/admin/teachers';
    const backLabel = backPath.includes('/classes/') ? 'Back to Class' : 'Back to Teachers';

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] dark:bg-slate-800 flex flex-col items-center justify-center transition-colors duration-300">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin mb-4" />
                <p className="text-slate-500 dark:text-slate-400 font-medium transition-colors">Loading profile...</p>
            </div>
        );
    }

    if (!teacher) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] dark:bg-slate-800 flex flex-col items-center justify-center transition-colors duration-300">
                <p className="text-slate-500 dark:text-slate-400 font-medium transition-colors">Teacher not found.</p>
                <button onClick={() => navigate('/admin/teachers')} className="mt-4 text-blue-500 font-bold hover:underline">
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
        <div className="p-4 md:p-10 max-w-[1600px] mx-auto min-h-screen transition-colors duration-300">

            <header className="flex items-center justify-between mb-6 md:mb-8">
                <div>
                    <h1 className="text-xl md:text-2xl font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-none mb-1 transition-colors">Teacher Profile</h1>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest leading-none transition-colors">Academic Record</p>
                </div>
                <button
                    onClick={() => navigate(backPath)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[12px] text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                >
                    <ArrowLeft className="h-4 w-4" />
                    {backLabel}
                </button>
            </header>

            {/* Top Profile Card */}
            <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-slate-200 dark:border-slate-700 shadow-sm p-6 md:p-7 mb-6 md:mb-8 flex flex-col md:flex-row items-center gap-6 md:gap-8 transition-all duration-300 text-center md:text-left">
                {/* Image Placeholder or Photo */}
                <div className="relative shrink-0">
                    <div className="w-[140px] h-[140px] rounded-[16px] bg-slate-100 dark:bg-slate-700 relative flex items-center justify-center overflow-hidden transition-colors">
                        {teacher.photo && teacher.photo !== 'https://via.placeholder.com/150' ? (
                            <img src={teacher.photo} alt={teacher.name} className="w-full h-full object-cover" />
                        ) : (
                            <GraduationCap className="h-20 w-20 text-slate-200 dark:text-slate-600" />
                        )}
                    </div>

                    <div className="absolute -bottom-2 -right-2 z-10">
                        <span className={`px-3 py-1 text-[11px] font-extrabold tracking-widest uppercase rounded-[8px] border-[3px] border-white dark:border-slate-800 ${teacher.status === 'ACTIVE' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'} shadow-sm`}>
                            {teacher.status}
                        </span>
                    </div>
                </div>

                <div className="flex-1 shrink-0">
                    <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4 mb-3 md:mb-2">
                        <h2 className="text-2xl md:text-3xl font-black text-[#0F172A] dark:text-white transition-colors">{teacher.name}</h2>
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-[8px] text-[13px] font-bold tracking-wider transition-colors">
                            {teacher.teacherId}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium mb-6 transition-colors">
                        <Building2 className="h-4 w-4" />
                        {teacher.department}
                    </div>
                    <div className="flex gap-4">
                        <button className="flex items-center gap-2 px-6 py-3 bg-[#1D68E3] text-white rounded-[12px] font-bold text-[14px] shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-colors">
                            <MessageSquare className="h-4 w-4" />
                            Message Teacher
                        </button>
                        <button
                            onClick={() => navigate(`/admin/teachers/${id}/edit`)}
                            className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-[12px] font-bold text-[14px] hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all"
                        >
                            <Edit3 className="h-4 w-4" />
                            Edit Profile
                        </button>
                    </div>
                </div>
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* Left Column (Info & Stats) */}
                <div className="space-y-8">

                    {/* Personal Info */}
                    <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-slate-200 dark:border-slate-700 shadow-sm p-8 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-8">
                            <User className="h-6 w-6 text-[#1D68E3]" />
                            <h3 className="text-[18px] font-bold text-[#0F172A] dark:text-white transition-colors">Personal Information</h3>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <p className="text-[11px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1 transition-colors">Full Legal Name</p>
                                <p className="text-[15px] font-medium text-[#0F172A] dark:text-white transition-colors">{teacher.name}</p>
                            </div>
                            <div>
                                <p className="text-[11px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1 transition-colors">Email Address</p>
                                <p className="text-[15px] font-medium text-[#0F172A] dark:text-white transition-colors">{teacher.email}</p>
                            </div>
                            <div>
                                <p className="text-[11px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1 transition-colors">Phone Number</p>
                                <p className="text-[15px] font-medium text-[#0F172A] dark:text-white transition-colors">{teacher.phone || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-[11px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1 transition-colors">Faculty Department</p>
                                <p className="text-[15px] font-medium text-[#0F172A] dark:text-white transition-colors">{teacher.department}</p>
                            </div>
                        </div>
                    </div>

                    {/* Security & Access */}
                    <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-slate-200 dark:border-slate-700 shadow-sm p-8 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-8">
                            <Shield className="h-6 w-6 text-[#1D68E3]" />
                            <h3 className="text-[18px] font-bold text-[#0F172A] dark:text-white transition-colors">Security & Access</h3>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-[20px] p-6 transition-all duration-300">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <p className="text-[11px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1 transition-colors">Administrative Passcode</p>
                                    <div className="flex items-center gap-4">
                                        {showPasscode ? (
                                            <span className="text-[24px] font-black text-[#0F172A] dark:text-white tracking-widest font-mono transition-colors">
                                                {teacher.passcode}
                                            </span>
                                        ) : (
                                            <span className="text-[24px] font-black text-slate-300 dark:text-slate-700 tracking-[0.3em] leading-none pt-2 transition-colors">
                                                ••••••
                                            </span>
                                        )}
                                        <button
                                            onClick={() => setShowPasscode(!showPasscode)}
                                            className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                                        >
                                            {showPasscode ? <EyeOff className="h-5 w-5 text-slate-400 dark:text-slate-500" /> : <Eye className="h-5 w-5 text-[#1D68E3]" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-blue-100/50 dark:bg-blue-500/10 p-3 rounded-xl text-[#1D68E3] transition-colors">
                                    <Shield className="h-6 w-6" />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 py-2.5 rounded-xl font-bold text-[13px] hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
                                    Copy Code
                                </button>
                                <button
                                    onClick={handleToggleAdmin}
                                    disabled={isPromoting}
                                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-[13px] transition-all shadow-sm border ${teacher.userId?.roles?.includes('admin')
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
                    <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-slate-200 dark:border-slate-700 shadow-sm p-8 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-8">
                            <BarChart2 className="h-6 w-6 text-[#1D68E3]" />
                            <h3 className="text-[18px] font-bold text-[#0F172A] dark:text-white transition-colors">Activity Summary</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-[16px] border border-slate-100 dark:border-slate-700 flex items-center justify-between transition-colors">
                                <div>
                                    <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 mb-1 transition-colors">Projects Reviewed</p>
                                    <p className="text-[28px] font-extrabold text-[#1D68E3] leading-none">{stats.reviewed}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center text-[#1D68E3] transition-colors">
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>
                            </div>

                            <div className="bg-[#FFFDF4] dark:bg-amber-500/5 p-5 rounded-[16px] border border-amber-100 dark:border-amber-500/20 flex items-center justify-between transition-colors">
                                <div>
                                    <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 mb-1 transition-colors">Pending Reviews</p>
                                    <p className="text-[28px] font-extrabold text-amber-600 dark:text-amber-500 leading-none">{stats.pending}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-500 transition-colors">
                                    <Clock className="h-5 w-5" />
                                </div>
                            </div>

                            <div className="bg-emerald-50/50 dark:bg-emerald-500/5 p-5 rounded-[16px] border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-between transition-colors">
                                <div>
                                    <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 mb-1 transition-colors">Avg. Similarity Score</p>
                                    <p className="text-[28px] font-extrabold text-emerald-600 dark:text-emerald-500 leading-none">{stats.avgSimilarity}%</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-500 transition-colors">
                                    <RefreshCw className="h-5 w-5" />
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Right Column (Classes & Submissions) */}
                <div className="xl:col-span-2 space-y-8">

                    {/* Assigned Subjects */}
                    <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-slate-200 dark:border-slate-700 shadow-sm p-8 transition-all duration-300">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <BookOpen className="h-6 w-6 text-[#1D68E3]" />
                                <h3 className="text-[18px] font-bold text-[#0F172A] dark:text-white transition-colors">Assigned Subjects & Classes</h3>
                            </div>
                            <button
                                onClick={handleOpenAssignment}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-500/10 text-[#1D68E3] rounded-lg font-bold text-[13px] hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
                            >
                                <Users className="h-4 w-4" />
                                Assign/Modify Classes
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {teacher.classes && teacher.classes.length > 0 ? (
                                teacher.classes.map((cls, idx) => (
                                    <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-[20px] p-6 hover:shadow-md transition-shadow group cursor-pointer relative overflow-hidden bg-white dark:bg-slate-800/50">
                                        {/* subtle decorative blur */}
                                        <div className="absolute -right-8 -top-8 w-32 h-32 bg-slate-50 dark:bg-slate-700/30 rounded-full blur-2xl group-hover:bg-blue-50/50 dark:group-hover:bg-blue-500/10 transition-colors"></div>

                                        <div className="relative z-10">
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="px-3 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-[8px] text-[12px] font-bold transition-colors">
                                                    {cls.code}
                                                </span>
                                                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-400 dark:text-slate-500 transition-colors">
                                                    <Users className="h-3.5 w-3.5" />
                                                    {cls.students} Students
                                                </span>
                                            </div>

                                            <h4 className="text-[16px] font-bold text-[#0F172A] dark:text-white mb-1 leading-tight min-h-[40px] transition-colors">
                                                {cls.title}
                                            </h4>
                                            <p className="text-[13px] font-medium text-slate-400 dark:text-slate-500 mb-6 transition-colors">
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
                                <div className="col-span-2 py-10 text-center bg-slate-50 dark:bg-slate-900/50 rounded-[20px] border border-dashed border-slate-200 dark:border-slate-700 transition-colors">
                                    <BookOpen className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                                    <p className="text-slate-400 dark:text-slate-500 font-medium transition-colors">No assigned classes yet.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Submissions */}
                    <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-slate-200 dark:border-slate-700 shadow-sm p-8 transition-all duration-300">
                        <h3 className="text-[16px] font-bold text-[#0F172A] dark:text-white mb-6 transition-colors">Recent Project Submissions</h3>

                        <div className="py-20 text-center bg-slate-50 dark:bg-slate-900/50 rounded-[20px] border border-dashed border-slate-200 dark:border-slate-700 transition-colors">
                            <Clock className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                            <p className="text-slate-400 dark:text-slate-500 font-medium transition-colors">No recent submissions found.</p>
                        </div>
                    </div>

                </div>
            </div>

            {/* Assignment Modal */}
            {isAssigning && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm transition-all">
                    <div className="bg-white dark:bg-slate-800 rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden border border-white/20 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 transition-colors">
                            <div>
                                <h3 className="text-[20px] font-black tracking-tight mb-1 dark:text-white transition-colors">Assign Academic Classes</h3>
                                <p className="text-slate-400 dark:text-slate-500 text-[13px] font-medium transition-colors">Link {teacher?.name} to their active sections</p>
                            </div>
                            <button onClick={() => setIsAssigning(false)} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-600">
                                <X className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                            </button>
                        </div>

                        <div className="p-8 max-h-[500px] overflow-y-auto">
                            <div className="grid grid-cols-1 gap-3">
                                {allClasses.length > 0 ? (
                                    allClasses.map(cls => (
                                        <button
                                            key={cls._id}
                                            onClick={() => handleToggleClass(cls.code)}
                                            className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all group ${selectedClasses.includes(cls.code)
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

                        <div className="p-8 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between transition-colors">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                                <p className="text-[13px] font-black text-[#1D68E3] uppercase tracking-wider">
                                    {selectedClasses.length} Selected
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setIsAssigning(false)}
                                    className="px-6 py-2.5 rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveAssignments}
                                    disabled={loadingAssignments}
                                    className="px-10 py-2.5 bg-[#1D68E3] text-white rounded-xl font-black text-[14px] shadow-xl shadow-blue-500/20 hover:bg-blue-600 transition-all flex items-center gap-2 disabled:opacity-70"
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
