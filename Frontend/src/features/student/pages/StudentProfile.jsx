import React, { useState, useEffect } from 'react';
import studentService from '../../../services/studentService';
import { 
    User, 
    Mail, 
    Calendar, 
    Phone, 
    MapPin, 
    GraduationCap, 
    Shield, 
    FileText, 
    Download, 
    Eye,
    RefreshCw,
    Lock,
    Trash2,
    MessageSquare,
    BookOpen,
    Clock,
    CheckCircle2,
    BarChart3
} from 'lucide-react';
import { Z_SHELL, Z_SHELL_INNER, Z_CARD, Z_BTN_PRIMARY, Z_BTN_SECONDARY } from '../../../shared/ui/zendentaLayout';

const StudentProfile = () => {
    const [studentData, setStudentData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCertificate, setShowCertificate] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await studentService.getProfile();
                if (response.success) {
                    setStudentData(response.data);
                } else {
                    setError(response.message || 'Failed to load profile data');
                }
            } catch (err) {
                console.error('Error fetching profile:', err);
                setError(err.userMessage || 'Failed to load profile data');
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
        window.scrollTo(0, 0);
    }, []);

    if (loading) {
        return (
            <div className={`${Z_SHELL} items-center justify-center py-16`}>
                <div className="w-9 h-9 border-4 border-slate-200 border-t-[#1D68E3] rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !studentData) {
        return (
            <div className={`${Z_SHELL} flex flex-1 items-center justify-center py-12`}>
                <div className={`${Z_CARD} text-center p-6`}>
                    <div className="bg-red-100 text-red-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Lock className="w-5 h-5" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-900 mb-1.5">Access Denied</h2>
                    <p className="text-[12px] text-slate-500 font-medium">{error || 'Unable to retrieve profile data'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={Z_SHELL}>
            <div className={`${Z_SHELL_INNER} space-y-4`}>
                {/* Profile summary */}
                <div className={`${Z_CARD} p-4 flex flex-col md:flex-row items-center justify-between gap-4`}>
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <div className="relative group">
                            <img 
                                src={studentData.photo || 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?auto=format&fit=crop&q=80&w=400'} 
                                alt={studentData.name} 
                                className="w-20 h-20 rounded-xl object-cover shadow-md border-2 border-white"
                            />
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div className="text-center md:text-left">
                            <h2 className="text-base font-bold tracking-tight text-[#0F172A] mb-2">
                                {studentData.name}
                            </h2>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                                <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-slate-200">
                                    {studentData.studentId}
                                </span>
                                <span className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 border border-green-200">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                    {studentData.status}
                                </span>
                                <span className="bg-blue-50 text-[#1D68E3] px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-blue-100">
                                    CLASS: {studentData.classId}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 space-y-4">
                        {/* Project Tracking Hub */}
                        <div className={`${Z_CARD} p-4`}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-bold text-[#0F172A] tracking-tight">Project Tracking Hub</h2>
                                <BarChart3 className="w-4 h-4 text-[#1D68E3]" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                <div className="bg-[#F8FAFB] p-3 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] block mb-1.5">SUBMITTED</span>
                                    <span className="text-xl font-bold text-[#1D68E3]">
                                        {String(studentData.projectStats?.submitted ?? 0).padStart(2, '0')}
                                    </span>
                                </div>
                                <div className="bg-[#F8FAFB] p-3 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] block mb-1.5">PENDING</span>
                                    <span className="text-xl font-bold text-orange-500">
                                        {String(studentData.projectStats?.pending ?? 0).padStart(2, '0')}
                                    </span>
                                </div>
                                <div className="bg-[#F8FAFB] p-3 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] block mb-1.5">TOTAL COURSES</span>
                                    <span className="text-xl font-bold text-[#0F172A]">
                                        {String(studentData.projectStats?.totalCourses ?? 0).padStart(2, '0')}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[12px] font-bold text-slate-500">Academic Progress</span>
                                    <span className="text-[12px] font-bold text-[#1D68E3]">
                                        {studentData.projectStats?.progressPercent ?? 0}% Complete
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[#1D68E3] rounded-full transition-all duration-1000"
                                        style={{ width: `${studentData.projectStats?.progressPercent ?? 0}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Personal Information */}
                        <div className={`${Z_CARD} p-4`}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-blue-50 text-[#1D68E3] rounded-lg flex items-center justify-center">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <h2 className="text-sm font-bold text-[#0F172A] tracking-tight">Personal information</h2>
                                </div>
                                <button className={`${Z_BTN_PRIMARY}`}>
                                    <MessageSquare className="w-3.5 h-3.5" /> Message
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Email address (login)</label>
                                    <div className="text-[13px] font-bold text-slate-700">{studentData.email}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Date of birth</label>
                                    <div className="text-[13px] font-bold text-slate-700">
                                        {studentData.personalInfo?.dob ? new Date(studentData.personalInfo.dob).toLocaleDateString() : 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Gender</label>
                                    <div className="text-[13px] font-bold text-slate-700">{studentData.personalInfo?.gender || 'N/A'}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Phone number</label>
                                    <div className="text-[13px] font-bold text-slate-700">{studentData.personalInfo?.phone || 'N/A'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Educational Background */}
                        <div className={`${Z_CARD} p-4`}>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 bg-orange-50 text-orange-500 rounded-lg flex items-center justify-center">
                                    <GraduationCap className="w-4 h-4" />
                                </div>
                                <h2 className="text-sm font-bold text-[#0F172A] tracking-tight">Educational background</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6 mb-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">High school</label>
                                    <div className="text-[13px] font-bold text-slate-700">{studentData.educationalBackground?.highSchoolName || 'N/A'}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Graduation year</label>
                                    <div className="text-[13px] font-bold text-slate-700">{studentData.educationalBackground?.graduationYear || 'N/A'}</div>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">High school certificate</label>
                                <div className="bg-[#F8FAFB] border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 border border-slate-100">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-[12px] font-bold text-slate-700">
                                                {studentData.educationalBackground?.certificateUrl
                                                    ? studentData.educationalBackground.certificateUrl.split('/').pop()
                                                    : 'No certificate uploaded'}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Document</div>
                                        </div>
                                    </div>
                                    {studentData.educationalBackground?.certificateUrl && (
                                        <div className="flex gap-1.5">
                                            <button
                                                onClick={() => setShowCertificate(true)}
                                                className={`${Z_BTN_SECONDARY} py-1`}
                                            >
                                                <Eye className="w-3.5 h-3.5" /> View
                                            </button>
                                            <a
                                                href={studentData.educationalBackground.certificateUrl}
                                                download
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`${Z_BTN_PRIMARY} py-1`}
                                            >
                                                <Download className="w-3.5 h-3.5" /> Save
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Parent Information */}
                        <div className={`${Z_CARD} p-4`}>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
                                    <Shield className="w-4 h-4" />
                                </div>
                                <h2 className="text-sm font-bold text-[#0F172A] tracking-tight">Parent information</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Father&apos;s name</label>
                                    <div className="text-[13px] font-bold text-slate-700">{studentData.parentDetails?.fatherName || 'N/A'}</div>
                                    <div className="mt-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] block mb-0.5">Father&apos;s contact</label>
                                        <div className="text-[12px] font-bold text-slate-500">{studentData.parentDetails?.fatherContact || 'N/A'}</div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Mother&apos;s name</label>
                                    <div className="text-[13px] font-bold text-slate-700">{studentData.parentDetails?.motherName || 'N/A'}</div>
                                    <div className="mt-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] block mb-0.5">Mother&apos;s contact</label>
                                        <div className="text-[12px] font-bold text-slate-500">{studentData.parentDetails?.motherContact || 'N/A'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right column */}
                    <div className="space-y-4">
                        <div className={`${Z_CARD} p-4`}>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 bg-blue-100/50 text-[#1D68E3] rounded-lg flex items-center justify-center">
                                    <BookOpen className="w-4 h-4" />
                                </div>
                                <h2 className="text-sm font-bold text-[#0F172A] tracking-tight">Academic</h2>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Faculty</label>
                                    <div className="text-[13px] font-bold text-slate-700 leading-tight">
                                        {studentData.academicInfo?.faculty || 'Computer Science & IT'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Campus</label>
                                    <div className="text-[13px] font-bold text-slate-700">
                                        {studentData.academicInfo?.campus || 'Campus 1'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Mode</label>
                                    <div className="text-[13px] font-bold text-slate-700">
                                        {studentData.academicInfo?.studyMode || 'Full-time'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Entry date</label>
                                    <div className="text-[13px] font-bold text-slate-700">
                                        {studentData.academicInfo?.entryDate 
                                            ? new Date(studentData.academicInfo.entryDate).toLocaleDateString() 
                                            : new Date(studentData.enrollmentDate).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#0F172A] rounded-xl p-4 text-white relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-[#1D68E3] rounded-full blur-[50px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
                            <h3 className="text-sm font-bold mb-2 relative z-10">Academic Support</h3>
                            <p className="text-[12px] font-medium text-slate-400 leading-relaxed mb-4 relative z-10">
                                Need help with your courses or verification requests? Our support team is here for you.
                            </p>
                            <button className={`${Z_BTN_PRIMARY} w-full relative z-10`}>
                                Contact Registrar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Certificate Preview Modal */}
            {showCertificate && studentData.educationalBackground?.certificateUrl && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => setShowCertificate(false)}
                >
                    <div 
                        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-orange-50 text-orange-500 rounded-lg flex items-center justify-center">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-[13px] font-bold text-[#0F172A]">High School Certificate</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        {studentData.educationalBackground.certificateUrl.split('/').pop()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={studentData.educationalBackground.certificateUrl}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={Z_BTN_PRIMARY}
                                >
                                    <Download className="w-3.5 h-3.5" /> Download
                                </a>
                                <button 
                                    onClick={() => setShowCertificate(false)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-slate-50 p-3">
                            <iframe
                                src={studentData.educationalBackground.certificateUrl}
                                className="w-full h-full rounded-xl border border-slate-200"
                                title="Certificate Preview"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentProfile;
