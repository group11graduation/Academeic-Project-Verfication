import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/authContext';
import axios from 'axios';
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

const StudentProfile = () => {
    const { user, token } = useAuth();
    const [studentData, setStudentData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCertificate, setShowCertificate] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await axios.get('http://localhost:5000/api/student/profile', {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                if (response.data.success) {
                    setStudentData(response.data.data);
                }
            } catch (err) {
                console.error('Error fetching profile:', err);
                setError('Failed to load profile data');
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchProfile();
        } else {
            setLoading(false);
            setError('Not authenticated');
        }
        window.scrollTo(0, 0);
    }, [token]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-[#1D68E3] rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !studentData) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex flex-col">
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="bg-red-100 text-red-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Lock className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">Access Denied</h2>
                        <p className="text-slate-500 font-medium">{error || 'Unable to retrieve profile data'}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFB] font-sans text-slate-900 selection:bg-blue-100">
            <main className="max-w-[1400px] mx-auto px-8 py-10">
                
                {/* 1. Header Section: Profile Summary */}
                <div className="bg-white rounded-[32px] p-8 mb-8 border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="relative group">
                            <img 
                                src={studentData.photo || 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?auto=format&fit=crop&q=80&w=400'} 
                                alt={studentData.name} 
                                className="w-32 h-32 rounded-[24px] object-cover shadow-xl border-4 border-white"
                            />
                            <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-green-500 border-4 border-white rounded-full"></div>
                        </div>
                        <div className="text-center md:text-left">
                            <h1 className="text-[32px] font-black tracking-tight text-[#0F172A] mb-3">
                                {studentData.name}
                            </h1>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                <span className="bg-slate-100 text-slate-600 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border border-slate-200">
                                    {studentData.studentId}
                                </span>
                                <span className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest flex items-center gap-2 border border-green-200">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                    {studentData.status}
                                </span>
                                <span className="bg-blue-50 text-[#1D68E3] px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border border-blue-100">
                                    CLASS: {studentData.classId}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* LEFT COLUMN: Main Information */}
                    <div className="lg:col-span-2 space-y-8">
                        
                        {/* Project Tracking Hub */}
                        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-xl font-black text-[#0F172A] tracking-tight">Project Tracking Hub</h2>
                                <BarChart3 className="w-5 h-5 text-[#1D68E3]" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                                <div className="bg-[#F8FAFB] p-6 rounded-2xl border border-slate-100">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3">SUBMITTED</span>
                                    <span className="text-4xl font-black text-[#1D68E3]">03</span>
                                </div>
                                <div className="bg-[#F8FAFB] p-6 rounded-2xl border border-slate-100">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3">PENDING</span>
                                    <span className="text-4xl font-black text-orange-500">01</span>
                                </div>
                                <div className="bg-[#F8FAFB] p-6 rounded-2xl border border-slate-100">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3">TOTAL COURSES</span>
                                    <span className="text-4xl font-black text-[#0F172A]">07</span>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-[13px] font-bold text-slate-500">Academic Progress</span>
                                    <span className="text-[13px] font-black text-[#1D68E3]">75% Complete</span>
                                </div>
                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="w-[75%] h-full bg-[#1D68E3] rounded-full shadow-lg shadow-blue-200 transition-all duration-1000"></div>
                                </div>
                            </div>
                        </div>

                        {/* Personal Information */}
                        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-50 text-[#1D68E3] rounded-xl flex items-center justify-center">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <h2 className="text-xl font-black text-[#0F172A] tracking-tight">PERSONAL INFORMATION</h2>
                                </div>
                                <button className="bg-[#1D68E3] text-white px-6 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-widest hover:shadow-lg transition-all flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4" /> Message
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">EMAIL ADDRESS (LOGIN)</label>
                                    <div className="text-[15px] font-bold text-slate-700">{studentData.email}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">DATE OF BIRTH</label>
                                    <div className="text-[15px] font-bold text-slate-700">
                                        {studentData.personalInfo?.dob ? new Date(studentData.personalInfo.dob).toLocaleDateString() : 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">GENDER</label>
                                    <div className="text-[15px] font-bold text-slate-700">{studentData.personalInfo?.gender || 'N/A'}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">PHONE NUMBER</label>
                                    <div className="text-[15px] font-bold text-slate-700">{studentData.personalInfo?.phone || 'N/A'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Educational Background */}
                        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-10">
                                <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center">
                                    <GraduationCap className="w-5 h-5" />
                                </div>
                                <h2 className="text-xl font-black text-[#0F172A] tracking-tight">EDUCATIONAL BACKGROUND</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-10 gap-x-12 mb-10">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">HIGH SCHOOL</label>
                                    <div className="text-[15px] font-bold text-slate-700">{studentData.educationalBackground?.highSchoolName || 'N/A'}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">GRADUATION YEAR</label>
                                    <div className="text-[15px] font-bold text-slate-700">{studentData.educationalBackground?.graduationYear || 'N/A'}</div>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">HIGH SCHOOL CERTIFICATE</label>
                                <div className="bg-[#F8FAFB] border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-slate-400 border border-slate-100">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="text-[13px] font-bold text-slate-700">
                                                {studentData.educationalBackground?.certificateUrl
                                                    ? studentData.educationalBackground.certificateUrl.split('/').pop()
                                                    : 'No certificate uploaded'}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Document</div>
                                        </div>
                                    </div>
                                    {studentData.educationalBackground?.certificateUrl && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setShowCertificate(true)}
                                                className="px-4 py-2 border border-slate-200 rounded-xl text-[11px] font-black text-slate-600 hover:bg-white transition-all flex items-center gap-2"
                                            >
                                                <Eye className="w-3.5 h-3.5" /> View
                                            </button>
                                            <a
                                                href={studentData.educationalBackground.certificateUrl}
                                                download
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-4 py-2 bg-[#1D68E3] rounded-xl text-[11px] font-black text-white hover:shadow-md transition-all flex items-center gap-2"
                                            >
                                                <Download className="w-3.5 h-3.5" /> Save
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Parent Information */}
                        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-10">
                                <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                                    <Shield className="w-5 h-5" />
                                </div>
                                <h2 className="text-xl font-black text-[#0F172A] tracking-tight uppercase">Parent Information</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-10 gap-x-12">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">FATHER'S NAME</label>
                                    <div className="text-[15px] font-bold text-slate-700">{studentData.parentDetails?.fatherName || 'N/A'}</div>
                                    <div className="mt-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block mb-1">FATHER'S CONTACT</label>
                                        <div className="text-[13px] font-bold text-slate-500">{studentData.parentDetails?.fatherContact || 'N/A'}</div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">MOTHER'S NAME</label>
                                    <div className="text-[15px] font-bold text-slate-700">{studentData.parentDetails?.motherName || 'N/A'}</div>
                                    <div className="mt-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block mb-1">MOTHER'S CONTACT</label>
                                        <div className="text-[13px] font-bold text-slate-500">{studentData.parentDetails?.motherContact || 'N/A'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Academic Sidebar */}
                    <div className="space-y-8">
                        
                        {/* Academic Section */}
                        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-10">
                                <div className="w-10 h-10 bg-blue-100/50 text-[#1D68E3] rounded-xl flex items-center justify-center">
                                    <BookOpen className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg font-black text-[#0F172A] tracking-tight uppercase">Academic</h2>
                            </div>
                            <div className="space-y-8">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">FACULTY</label>
                                    <div className="text-[15px] font-black text-slate-700 leading-tight">
                                        {studentData.academicInfo?.faculty || 'Computer Science & IT'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">CAMPUS</label>
                                    <div className="text-[15px] font-bold text-slate-700">
                                        {studentData.academicInfo?.campus || 'Campus 1'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">MODE</label>
                                    <div className="text-[15px] font-bold text-slate-700">
                                        {studentData.academicInfo?.studyMode || 'Full-time'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">ENTRY DATE</label>
                                    <div className="text-[15px] font-bold text-slate-700">
                                        {studentData.academicInfo?.entryDate 
                                            ? new Date(studentData.academicInfo.entryDate).toLocaleDateString() 
                                            : new Date(studentData.enrollmentDate).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Support Card */}
                        <div className="bg-[#0F172A] rounded-[32px] p-10 text-white relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#1D68E3] rounded-full blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
                            <h3 className="text-xl font-black mb-4 relative z-10">Academic Support</h3>
                            <p className="text-[14px] font-medium text-slate-400 leading-relaxed mb-8 relative z-10">
                                Need help with your courses or verification requests? Our support team is here for you.
                            </p>
                            <button className="w-full bg-[#1D68E3] text-white py-4 rounded-2xl text-[13px] font-black uppercase tracking-widest hover:shadow-lg hover:shadow-blue-500/20 transition-all relative z-10 active:scale-95">
                                Contact Registrar
                            </button>
                        </div>
                    </div>
                </div>

            </main>

            {/* ScholarVerify Footer */}
            <footer className="mt-10 py-12 bg-white text-slate-900 border-t border-slate-100">
                <div className="max-w-[1400px] mx-auto px-8 flex flex-col md:flex-row items-center justify-between">
                    <div className="flex flex-col items-center md:items-start mb-8 md:mb-0">
                        <div className="font-black text-slate-900 text-xl tracking-tighter mb-2">
                            ScholarVerify
                        </div>
                        <p className="text-[13px] font-medium text-slate-400 max-w-[300px] text-center md:text-left leading-relaxed">
                            Setting the standard in student identity and academic records management for higher education institutions.
                        </p>
                    </div>
                    
                    <div className="flex flex-wrap justify-center gap-16">
                        <div>
                            <h4 className="text-[11px] font-black text-[#1D68E3] uppercase tracking-[0.2em] mb-6">PLATFORM</h4>
                            <ul className="space-y-4">
                                <li><a href="#" className="text-[13px] font-medium text-slate-500 hover:text-[#1D68E3] transition-colors">Verification</a></li>
                                <li><a href="#" className="text-[13px] font-medium text-slate-500 hover:text-[#1D68E3] transition-colors">Certificates</a></li>
                                <li><a href="#" className="text-[13px] font-medium text-slate-500 hover:text-[#1D68E3] transition-colors">Security</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-[11px] font-black text-[#1D68E3] uppercase tracking-[0.2em] mb-6">SUPPORT</h4>
                            <ul className="space-y-4">
                                <li><a href="#" className="text-[13px] font-medium text-slate-500 hover:text-[#1D68E3] transition-colors">Help Center</a></li>
                                <li><a href="#" className="text-[13px] font-medium text-slate-500 hover:text-[#1D68E3] transition-colors">API Docs</a></li>
                                <li><a href="#" className="text-[13px] font-medium text-slate-500 hover:text-[#1D68E3] transition-colors">Status</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-[11px] font-black text-[#1D68E3] uppercase tracking-[0.2em] mb-6">LEGAL</h4>
                            <ul className="space-y-4">
                                <li><a href="#" className="text-[13px] font-medium text-slate-500 hover:text-[#1D68E3] transition-colors">Privacy</a></li>
                                <li><a href="#" className="text-[13px] font-medium text-slate-500 hover:text-[#1D68E3] transition-colors">Terms</a></li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div className="max-w-[1400px] mx-auto px-8 mt-16 pt-8 border-t border-slate-50 flex items-center justify-between">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                        &copy; 2024 ScholarVerify. All academic records are encrypted and protected.
                    </div>
                    <div className="flex gap-4">
                        <Shield className="w-5 h-5 text-slate-300" />
                        <CheckCircle2 className="w-5 h-5 text-slate-300" />
                    </div>
                </div>
            </footer>

            {/* Certificate Preview Modal */}
            {showCertificate && studentData.educationalBackground?.certificateUrl && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
                    onClick={() => setShowCertificate(false)}
                >
                    <div 
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-[15px] font-black text-[#0F172A]">High School Certificate</h3>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                        {studentData.educationalBackground.certificateUrl.split('/').pop()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <a
                                    href={studentData.educationalBackground.certificateUrl}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-5 py-2.5 bg-[#1D68E3] rounded-xl text-[11px] font-black text-white hover:shadow-md transition-all flex items-center gap-2"
                                >
                                    <Download className="w-3.5 h-3.5" /> Download
                                </a>
                                <button 
                                    onClick={() => setShowCertificate(false)}
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        {/* PDF Viewer */}
                        <div className="flex-1 bg-slate-50 p-4">
                            <iframe
                                src={studentData.educationalBackground.certificateUrl}
                                className="w-full h-full rounded-2xl border border-slate-200"
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
