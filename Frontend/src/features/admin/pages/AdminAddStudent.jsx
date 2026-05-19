import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Upload,
    Check,
    UserPlus,
    ChevronDown,
    Calendar,
    Users,
    GraduationCap,
    FileText,
    User,
    Image as ImageIcon,
    ChevronLeft,
    Loader2
} from 'lucide-react';
import adminStudentService from '../../../services/adminStudentService';
import adminClassService from '../../../services/adminClassService';
import { adminAcademicService } from '../../../services/adminAcademicService';

const AdminAddStudent = () => {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [photoMode, setPhotoMode] = useState('local'); // 'local' or 'url'
    const [photoUrl, setPhotoUrl] = useState('');
    const [localPhotoPreview, setLocalPhotoPreview] = useState(null);

    // Certificate States
    const certificateInputRef = useRef(null);
    const [certificateMode, setCertificateMode] = useState('local'); // 'local' or 'url'
    const [certificateUrl, setCertificateUrl] = useState('');
    const [localCertificateFile, setLocalCertificateFile] = useState(null);
    const [localCertificateFileName, setLocalCertificateFileName] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [classes, setClasses] = useState([]);
    const [loadingClasses, setLoadingClasses] = useState(true);
    const [facultyStructureNames, setFacultyStructureNames] = useState([]);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        gender: 'Select Gender',
        dob: '',
        fatherName: '',
        fatherContact: '',
        motherName: '',
        motherContact: '',
        highSchoolName: '',
        graduationYear: '',
        faculty: '',
        campus: 'Main Campus (Mogadishu)',
        studyMode: 'Full-time',
        entryDate: '',
        classId: '' // Initialize as empty
    });

    useEffect(() => {
        const load = async () => {
            try {
                const [classRes, stRes] = await Promise.all([
                    adminClassService.getClasses(),
                    adminAcademicService.getAcademicStructure(),
                ]);
                const names = stRes.success ? (stRes.data?.faculties || []).map((f) => f.name).filter(Boolean) : [];
                setFacultyStructureNames(names);
                if (classRes.success && classRes.data?.length) {
                    const first = classRes.data[0];
                    setClasses(classRes.data);
                    setFormData((prev) => ({
                        ...prev,
                        classId: first.code,
                        faculty: (first.faculty && String(first.faculty).trim()) || names[0] || '',
                    }));
                } else if (classRes.success) {
                    setClasses(classRes.data || []);
                }
            } catch (err) {
                console.error('Failed to fetch classes:', err);
            } finally {
                setLoadingClasses(false);
            }
        };
        load();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'classId') {
            const cls = classes.find((c) => c.code === value);
            setFormData((prev) => ({
                ...prev,
                classId: value,
                faculty: (cls?.faculty && String(cls.faculty).trim()) || prev.faculty,
            }));
            return;
        }
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const facultySelectOptions = useMemo(() => {
        const fallback = ['Computer Science & IT', 'Engineering', 'Medicine'];
        const base = facultyStructureNames.length ? facultyStructureNames : fallback;
        const set = new Set(base);
        if (formData.faculty && String(formData.faculty).trim()) {
            set.add(String(formData.faculty).trim());
        }
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [facultyStructureNames, formData.faculty]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setLocalPhotoPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCertificateChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLocalCertificateFile(file);
            setLocalCertificateFileName(file.name);

            // For images we can preview it, but since certificates could be PDFs we just store the file name for display
            // and an optional base64 representation if we plan to send it as pure JSON.
            const reader = new FileReader();
            reader.onloadend = () => {
                setLocalCertificateFile(reader.result); // Base64 string for backend
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerFilePicker = () => {
        fileInputRef.current?.click();
    };

    const triggerCertificatePicker = () => {
        certificateInputRef.current?.click();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            // Generate IDs and passcode
            const generatedStudentId = `PV-2024-${Math.floor(1000 + Math.random() * 9000)}`;
            const generatedPasscode = Math.floor(100000 + Math.random() * 900000).toString();

            const payload = {
                studentId: generatedStudentId,
                name: formData.name,
                email: formData.email,
                password: generatedPasscode,
                passcode: generatedPasscode,
                photo: photoMode === 'local' ? localPhotoPreview : photoUrl,
                classId: formData.classId,
                personalInfo: {
                    phone: formData.phone,
                    dob: formData.dob || null,
                    gender: formData.gender === 'Select Gender' ? 'Unknown' : formData.gender
                },
                parentDetails: {
                    fatherName: formData.fatherName,
                    fatherContact: formData.fatherContact,
                    motherName: formData.motherName,
                    motherContact: formData.motherContact
                },
                educationalBackground: {
                    highSchoolName: formData.highSchoolName,
                    graduationYear: formData.graduationYear,
                    certificateUrl: certificateMode === 'local' ? localCertificateFile : certificateUrl,
                },
                academicInfo: {
                    faculty: formData.faculty,
                    campus: formData.campus,
                    studyMode: formData.studyMode,
                    entryDate: formData.entryDate || null,
                }
            };

            const response = await adminStudentService.registerStudent(payload);

            if (response.success) {
                navigate('/admin/students');
            } else {
                setError(response.message || 'Registration failed');
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'An error occurred during registration.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loadingClasses) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] dark:bg-slate-900 flex flex-col items-center justify-center transition-colors">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin mb-4" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Initializing enrollment system...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFB] dark:bg-[#0F172A]/30 font-sans text-[#0F172A] dark:text-slate-200 transition-colors">
            {/* Top Navbar */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between px-6 md:px-10 py-3 md:py-4 sticky top-0 z-10 gap-3 md:gap-0 transition-colors">
                <button
                    onClick={() => navigate('/admin/students')}
                    type="button"
                    className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-[#1D68E3] dark:hover:text-blue-400 transition-all font-bold text-[14px] group"
                >
                    <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg group-hover:bg-blue-50 dark:group-hover:bg-slate-700 transition-all">
                        <ChevronLeft className="h-4 w-4" />
                    </div>
                    Back to Students
                </button>
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/students')}
                        className="px-8 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-[14px] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-8 py-2.5 bg-[#1D68E3] text-white rounded-xl font-bold text-[14px] shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all disabled:opacity-70"
                    >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                        {isSubmitting ? 'Registering...' : 'Register Student'}
                    </button>
                </div>
            </div>

            <div className="p-4 md:p-10 max-w-[1600px] mx-auto">
                {/* Header */}
                <div className="mb-6 md:mb-10 text-center md:text-left">
                    <h1 className="text-xl md:text-2xl font-black tracking-tight mb-1 md:mb-2 text-[#0F172A] dark:text-white transition-colors">Register New Student</h1>
                    <p className="text-[12px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none transition-colors">Enrollment System</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl font-medium">
                        {error}
                    </div>
                )}

                <form className="grid grid-cols-1 xl:grid-cols-3 gap-8" onSubmit={handleSubmit}>
                    {/* Left & Center Column: Form Sections */}
                    <div className="xl:col-span-2 space-y-8">

                        {/* Personal Information */}
                        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm p-8">
                            <div className="flex items-center gap-3 mb-8">
                                <User className="h-5 w-5 text-[#1D68E3] dark:text-blue-400" />
                                <h2 className="uppercase font-black text-[12px] tracking-widest text-slate-700 dark:text-slate-300">Personal Information</h2>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Full Name (Magaca oo Dhammaystiran) *</label>
                                    <input
                                        type="text"
                                        name="name"
                                        required
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="e.g. Maxamed Cabdi Faarax"
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 px-5 text-[15px] focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all text-slate-800 dark:text-white"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Email Address *</label>
                                        <input
                                            type="email"
                                            name="email"
                                            required
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="student@example.com"
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 px-5 text-[15px] focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all text-slate-800 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Phone Number</label>
                                        <input
                                            type="text"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            placeholder="+252 ..."
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 px-5 text-[15px] focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all text-slate-800 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="relative">
                                        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Gender</label>
                                        <select
                                            name="gender"
                                            value={formData.gender}
                                            onChange={handleChange}
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 px-5 text-[15px] focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all text-slate-800 dark:text-white"
                                        >
                                            <option>Select Gender</option>
                                            <option>Male</option>
                                            <option>Female</option>
                                        </select>
                                        <ChevronDown className="absolute right-5 top-[46px] h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                                    </div>
                                    <div className="relative">
                                        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Date of Birth</label>
                                        <input
                                            type="date"
                                            name="dob"
                                            value={formData.dob}
                                            onChange={handleChange}
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 px-5 text-[15px] focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all text-[#0F172A] dark:text-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Parent / Guardian Details */}
                        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm p-8">
                            <div className="flex items-center gap-3 mb-8">
                                <Users className="h-5 w-5 text-[#1D68E3] dark:text-blue-400" />
                                <h2 className="uppercase font-black text-[12px] tracking-widest text-slate-700 dark:text-slate-300">Parent / Guardian Details</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Father's Full Name</label>
                                    <input
                                        type="text"
                                        name="fatherName"
                                        value={formData.fatherName}
                                        onChange={handleChange}
                                        placeholder="Father's Name"
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 px-5 text-[15px] focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 text-[#0F172A] dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Father's Contact</label>
                                    <input
                                        type="text"
                                        name="fatherContact"
                                        value={formData.fatherContact}
                                        onChange={handleChange}
                                        placeholder="+252 ..."
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 px-5 text-[15px] focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 text-[#0F172A] dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Mother's Full Name</label>
                                    <input
                                        type="text"
                                        name="motherName"
                                        value={formData.motherName}
                                        onChange={handleChange}
                                        placeholder="Mother's Name"
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 px-5 text-[15px] focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 text-[#0F172A] dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Mother's Contact</label>
                                    <input
                                        type="text"
                                        name="motherContact"
                                        value={formData.motherContact}
                                        onChange={handleChange}
                                        placeholder="+252 ..."
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 px-5 text-[15px] focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 text-[#0F172A] dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Educational Background */}
                        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm p-8">
                            <div className="flex items-center gap-3 mb-8">
                                <FileText className="h-5 w-5 text-[#1D68E3] dark:text-blue-400" />
                                <h2 className="uppercase font-black text-[12px] tracking-widest text-slate-700 dark:text-slate-300">Educational Background</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">High School Name</label>
                                    <input
                                        type="text"
                                        name="highSchoolName"
                                        value={formData.highSchoolName}
                                        onChange={handleChange}
                                        placeholder="Jabir Binu Hayan"
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 px-5 text-[15px] focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 text-[#0F172A] dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Graduation Year</label>
                                    <input
                                        type="text"
                                        name="graduationYear"
                                        value={formData.graduationYear}
                                        onChange={handleChange}
                                        placeholder="2022"
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 px-5 text-[15px] focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 text-[#0F172A] dark:text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">High School Certificate</label>
                                    <div className="flex items-center bg-slate-50 dark:bg-slate-800 p-1 rounded-lg">
                                        <button
                                            type="button"
                                            onClick={() => setCertificateMode('local')}
                                            className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded transition-all ${certificateMode === 'local' ? 'bg-white dark:bg-slate-700 text-[#1D68E3] dark:text-blue-400 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
                                        >
                                            Upload File
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCertificateMode('url')}
                                            className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded transition-all ${certificateMode === 'url' ? 'bg-white dark:bg-slate-700 text-[#1D68E3] dark:text-blue-400 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
                                        >
                                            External Link
                                        </button>
                                    </div>
                                </div>

                                {certificateMode === 'local' ? (
                                    <div
                                        onClick={triggerCertificatePicker}
                                        className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[20px] p-6 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-800/50 group hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-[#1D68E3] transition-all cursor-pointer relative overflow-hidden"
                                    >
                                        <input
                                            type="file"
                                            ref={certificateInputRef}
                                            className="hidden"
                                            accept=".pdf,image/jpeg,image/png"
                                            onChange={handleCertificateChange}
                                        />

                                        {localCertificateFileName ? (
                                            <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-6 py-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 z-10 w-full justify-between">
                                                <div className="flex items-center gap-3 truncate">
                                                    <FileText className="h-5 w-5 text-[#1D68E3] dark:text-blue-400 shrink-0" />
                                                    <span className="text-[14px] font-bold truncate">{localCertificateFileName}</span>
                                                </div>
                                                <Check className="h-5 w-5 text-[#10B981] dark:text-emerald-400 shrink-0" />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="bg-blue-50 dark:bg-blue-900/40 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform text-[#1D68E3] dark:text-blue-400">
                                                    <Upload className="h-6 w-6" />
                                                </div>
                                                <p className="text-[14px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                    Click to <span className="text-[#1D68E3] dark:text-blue-400">Upload File</span>
                                                </p>
                                                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center max-w-[80%]">Supported: PDF, JPG, PNG. Max size 5MB.</p>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            placeholder="Paste the URL link to the certificate..."
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 px-5 text-[14px] focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 font-medium text-[#0F172A] dark:text-slate-200"
                                            value={certificateUrl}
                                            onChange={(e) => setCertificateUrl(e.target.value)}
                                        />
                                        <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-1">Ensure the link is publicly accessible.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Academic Information */}
                        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm p-8">
                            <div className="flex items-center gap-3 mb-8">
                                <GraduationCap className="h-5 w-5 text-[#1D68E3] dark:text-blue-400" />
                                <h2 className="uppercase font-black text-[12px] tracking-widest text-slate-700 dark:text-slate-300">Academic Information</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="relative">
                                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Faculty (Kulliyadda)</label>
                                    <select
                                        name="faculty"
                                        value={formData.faculty}
                                        onChange={handleChange}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 px-5 text-[15px] appearance-none focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all text-[#0F172A] dark:text-white font-medium"
                                    >
                                        <option value="">Select faculty</option>
                                        {facultySelectOptions.map((name) => (
                                            <option key={name} value={name}>
                                                {name}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-5 top-[46px] h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                                </div>
                                <div className="relative">
                                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Campus</label>
                                    <select
                                        name="campus"
                                        value={formData.campus}
                                        onChange={handleChange}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 px-5 text-[15px] appearance-none focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all text-[#0F172A] dark:text-white font-medium"
                                    >
                                        <option value="">Select Campus</option>
                                        <option>Campus 1</option>
                                        <option>Campus 2</option>
                                        <option>Campus 3</option>
                                    </select>
                                    <ChevronDown className="absolute right-5 top-[46px] h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="relative">
                                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Study Mode</label>
                                    <select
                                        name="studyMode"
                                        value={formData.studyMode}
                                        onChange={handleChange}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 px-5 text-[15px] appearance-none focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all text-[#0F172A] dark:text-white font-medium"
                                    >
                                        <option>Full-time</option>
                                        <option>Part-time</option>
                                    </select>
                                    <ChevronDown className="absolute right-5 top-[46px] h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                                </div>
                                <div className="relative">
                                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Entry Date</label>
                                    <input
                                        type="date"
                                        name="entryDate"
                                        value={formData.entryDate}
                                        onChange={handleChange}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 px-5 text-[15px] focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all text-[#0F172A] dark:text-white"
                                    />
                                </div>
                            </div>
                            <div className="relative">
                                <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Class Section (Glasses) *</label>
                                <select
                                    name="classId"
                                    required
                                    value={formData.classId}
                                    onChange={handleChange}
                                    disabled={loadingClasses}
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 px-5 text-[15px] appearance-none focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all text-slate-800 dark:text-white font-medium disabled:bg-slate-50 dark:disabled:bg-slate-800/50"
                                >
                                    {loadingClasses ? (
                                        <option>Loading classes...</option>
                                    ) : classes.length > 0 ? (
                                        classes.map(cls => (
                                            <option key={cls._id} value={cls.code}>{cls.code} - {cls.faculty}</option>
                                        ))
                                    ) : (
                                        <option>No classes found</option>
                                    )}
                                </select>
                                <ChevronDown className="absolute right-5 top-[46px] h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Photo & ID Cards */}
                    <div className="space-y-8">

                        {/* Profile Photo */}
                        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm p-8">
                            <h2 className="text-[16px] font-bold mb-6 text-[#0F172A] dark:text-white">Profile Photo</h2>

                            <div className="flex flex-col items-center">
                                <div className="w-32 h-32 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 border border-slate-100 dark:border-slate-700 shadow-inner relative overflow-hidden group">
                                    {photoMode === 'local' ? (
                                        localPhotoPreview ? (
                                            <img src={localPhotoPreview} alt="Local Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="h-12 w-12 text-slate-200 dark:text-slate-600" />
                                        )
                                    ) : (
                                        photoUrl ? (
                                            <img src={photoUrl} alt="URL Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="h-12 w-12 text-slate-200 dark:text-slate-600" />
                                        )
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-black/40 transition-all"></div>
                                </div>

                                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl mb-6 w-full">
                                    <button
                                        type="button"
                                        onClick={() => setPhotoMode('local')}
                                        className={`flex-1 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${photoMode === 'local' ? 'bg-white dark:bg-slate-700 text-[#1D68E3] dark:text-blue-400 shadow-sm' : 'text-slate-400 dark:text-slate-500'
                                            }`}
                                    >
                                        Local
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPhotoMode('url')}
                                        className={`flex-1 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${photoMode === 'url' ? 'bg-white dark:bg-slate-700 text-[#1D68E3] dark:text-blue-400 shadow-sm' : 'text-slate-400 dark:text-slate-500'
                                            }`}
                                    >
                                        URL
                                    </button>
                                </div>

                                {photoMode === 'local' ? (
                                    <>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                        />
                                        <button
                                            type="button"
                                            onClick={triggerFilePicker}
                                            className="w-full flex items-center justify-center gap-2 bg-[#1D68E3] text-white py-3 rounded-xl font-bold text-[13px] shadow-lg shadow-blue-500/10 hover:bg-blue-600 transition-all mb-3"
                                        >
                                            <Upload className="h-4 w-4" />
                                            Choose Image
                                        </button>
                                        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Supported: JPG, PNG. Max size 2MB.</p>
                                    </>
                                ) : (
                                    <div className="w-full space-y-3">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Enter Image URL..."
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 text-[13px] focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 font-medium text-[#0F172A] dark:text-slate-200"
                                                value={photoUrl}
                                                onChange={(e) => setPhotoUrl(e.target.value)}
                                            />
                                            <ImageIcon className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 dark:text-slate-500" />
                                        </div>
                                        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Paste a direct image link (JPEG, PNG).</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Student ID */}
                        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm p-8">
                            <h2 className="text-[16px] font-bold mb-6 text-[#0F172A] dark:text-white">Student Enrollment</h2>
                            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-6 text-center space-y-2">
                                <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Upon successful registration, the ID and Passcode will be generated.</p>
                                <p className="text-[11px] font-bold text-[#1D68E3] dark:text-blue-400 uppercase tracking-wider">Automated Enrollment</p>
                            </div>
                        </div>

                    </div>
                </form>
            </div >
        </div >
    );
};

export default AdminAddStudent;
