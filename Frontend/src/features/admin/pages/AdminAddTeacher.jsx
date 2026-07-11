import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, User, Lock, ChevronDown, Upload, Link, X, Mail, Phone, ArrowLeft, Loader2 } from 'lucide-react';
import adminTeacherService, { resolveUploadUrl } from '../../../services/adminTeacherService';
import { adminAcademicService } from '../../../services/adminAcademicService';
import { appAlert, appConfirm, appError, appSuccess, appWarning } from '../../../lib/appDialog';

const AdminAddTeacher = () => {
    const navigate = useNavigate();
    const [skills, setSkills] = useState(['React.js', 'Python', 'Network Security']);
    const [loading, setLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = React.useRef(null);
    const [formData, setFormData] = useState({
        name: '',
        faculty: '',
        department: '',
        email: '',
        phone: '',
        photo: 'https://via.placeholder.com/150'
    });
    const [academicStructure, setAcademicStructure] = useState({ faculties: [] });

    useEffect(() => {
        const loadStructure = async () => {
            try {
                const structureRes = await adminAcademicService.getAcademicStructure();
                if (structureRes.success) {
                    setAcademicStructure(structureRes.data || { faculties: [] });
                }
            } catch (err) {
                console.error('Failed to load academic structure:', err);
            }
        };
        loadStructure();
    }, []);

    const facultyOptions = (academicStructure.faculties || []).map((f) => f.name);
    const departmentOptions = useMemo(() => {
        const row = (academicStructure.faculties || []).find((f) => f.name === formData.faculty);
        return row?.departments || [];
    }, [academicStructure, formData.faculty]);

    // Generate a random ID and Passcode on mount
    const [teacherId] = useState(`TC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    const [passcode] = useState(Math.floor(100000 + Math.random() * 900000).toString());

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'faculty') {
            setFormData({ ...formData, faculty: value, department: '' });
            return;
        }
        setFormData({ ...formData, [name]: value });
    };

    const handleAddSkill = (skill) => {
        if (skill && !skills.includes(skill)) {
            setSkills([...skills, skill]);
        }
    };

    const removeSkill = (skillToRemove) => {
        setSkills(skills.filter(s => s !== skillToRemove));
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingImage(true);
        try {
            const imageUrl = await adminTeacherService.uploadProfileImage(file);
            setFormData({ ...formData, photo: resolveUploadUrl(imageUrl) });
        } catch (error) {
            console.error("Failed to upload image:", error);
            await appWarning("Failed to upload image. Please try again.");
        } finally {
            setUploadingImage(false);
            // Reset input so the same file could be selected again if needed
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.faculty || !formData.department) {
            await appWarning('Please select both faculty and department.');
            return;
        }
        setLoading(true);
        try {
            const payload = {
                ...formData,
                teacherId,
                passcode,
                password: passcode, // Use passcode as initial password
                skills
            };
            const response = await adminTeacherService.registerTeacher(payload);
            if (response.success) {
                navigate('/admin/teachers');
            }
        } catch (error) {
            console.error("Failed to register teacher:", error);
            await appError(error.response?.data?.message || "Failed to register teacher");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full font-sans">

            {/* Top Bar Area */}
            <div className="flex flex-col md:flex-row items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-6 md:pb-8 mb-6 md:mb-8 gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-none mb-1 md:mb-2 text-center md:text-left">Register New Teacher</h1>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest leading-none transition-colors text-center md:text-left">Faculty Enrollment</p>
                </div>
                <button
                    onClick={() => navigate('/admin/teachers')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[12px] text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Directory
                </button>
            </div>

            {/* Main Form Card */}
            <div className="bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-8">

                {/* 1. PERSONAL DETAILS */}
                <section className="mb-10">
                    <h3 className="text-[13px] font-extrabold text-[#1D68E3] dark:text-blue-400 uppercase tracking-widest mb-6">Personal Details</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                        <div>
                            <label className="block text-[14px] font-bold text-[#0F172A] dark:text-slate-200 mb-2">Full Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                placeholder="e.g. Dr. Jane Smith"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[12px] py-3.5 px-4 text-[15px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700 dark:text-slate-200 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[14px] font-bold text-[#0F172A] dark:text-slate-200 mb-2">Teacher ID (Auto-generated)</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                                <input
                                    type="text"
                                    value={teacherId}
                                    disabled
                                    className="w-full bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-[12px] py-3.5 pl-11 pr-4 text-[15px] font-medium text-slate-500 dark:text-slate-400 outline-none cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-[14px] font-bold text-[#0F172A] dark:text-slate-200 mb-2">Faculty</label>
                            <div className="relative">
                                <select
                                    name="faculty"
                                    value={formData.faculty}
                                    onChange={handleChange}
                                    required
                                    className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[12px] py-3.5 px-4 pr-10 text-[15px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700 dark:text-slate-200 outline-none"
                                >
                                    <option value="" disabled>Select Faculty</option>
                                    {facultyOptions.map((f) => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[14px] font-bold text-[#0F172A] dark:text-slate-200 mb-2">Department</label>
                            <div className="relative">
                                <select
                                    name="department"
                                    value={formData.department}
                                    onChange={handleChange}
                                    required
                                    disabled={!formData.faculty}
                                    className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[12px] py-3.5 px-4 pr-10 text-[15px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700 dark:text-slate-200 outline-none disabled:bg-slate-100/80 disabled:text-slate-400 dark:disabled:bg-slate-800/50"
                                >
                                    <option value="" disabled>Select Department</option>
                                    {departmentOptions.map((d) => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                        <div>
                            <label className="block text-[14px] font-bold text-[#0F172A] dark:text-slate-200 mb-2">Profile Picture</label>
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                    {uploadingImage ? (
                                        <Loader2 className="h-5 w-5 text-[#1D68E3] animate-spin" />
                                    ) : formData.photo && formData.photo !== 'https://via.placeholder.com/150' ? (
                                        <img src={formData.photo} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                                    )}
                                </div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingImage}
                                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[8px] text-[13px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {uploadingImage ? 'Uploading...' : 'Upload File'}
                                </button>
                                <span className="text-[12px] font-medium text-slate-400 dark:text-slate-500">or enter Image URL below</span>
                            </div>
                            <input
                                type="text"
                                name="photo"
                                value={formData.photo}
                                onChange={handleChange}
                                placeholder="https://example.com/photo.jpg"
                                className="w-full mt-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[12px] py-3.5 px-4 text-[14px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700 dark:text-slate-200 outline-none"
                            />
                        </div>
                    </div>
                </section>

                <hr className="border-slate-100 dark:border-slate-800 mb-10" />

                {/* 2. SUBJECT EXPERTISE */}
                <section className="mb-10">
                    <h3 className="text-[13px] font-extrabold text-[#1D68E3] dark:text-blue-400 uppercase tracking-widest mb-6">Subject Expertise</h3>

                    <div>
                        <label className="block text-[14px] font-bold text-[#0F172A] dark:text-slate-200 mb-2">Skills & Expertise (Select multiple)</label>
                        <div className="relative">
                            <div className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[12px] p-2 flex flex-wrap gap-2 items-center min-h-[52px]">
                                {skills.map(skill => (
                                    <span key={skill} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-[#1D68E3] dark:text-blue-400 rounded-[8px] text-[13px] font-bold">
                                        {skill}
                                        <button onClick={() => removeSkill(skill)} className="hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </span>
                                ))}
                                <select
                                    className="flex-1 bg-transparent border-none py-1.5 px-2 text-[14px] font-medium text-slate-700 dark:text-slate-200 outline-none w-[120px] min-w-[200px]"
                                    onChange={(e) => {
                                        handleAddSkill(e.target.value);
                                        e.target.value = ""; // Reset select after choosing
                                    }}
                                    defaultValue=""
                                >
                                    <option value="" disabled>Select a skill...</option>
                                    <option value="React.js">React.js</option>
                                    <option value="Python">Python</option>
                                    <option value="Network Security">Network Security</option>
                                    <option value="Cloud Computing">Cloud Computing</option>
                                    <option value="Data Science">Data Science</option>
                                    <option value="UX Design">UX Design</option>
                                    <option value="Machine Learning">Machine Learning</option>
                                    <option value="Database Systems">Database Systems</option>
                                    <option value="Web Development">Web Development</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </section>

                <hr className="border-slate-100 dark:border-slate-800 mb-10" />

                {/* 3. CONTACT INFORMATION */}
                <section className="mb-10">
                    <h3 className="text-[13px] font-extrabold text-[#1D68E3] dark:text-blue-400 uppercase tracking-widest mb-6">Contact Information</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-[14px] font-bold text-[#0F172A] dark:text-slate-200 mb-2">Contact Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    placeholder="jane.smith@academy.edu"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[12px] py-3.5 pl-12 pr-4 text-[15px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700 dark:text-slate-200 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[14px] font-bold text-[#0F172A] dark:text-slate-200 mb-2">Phone Number</label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="+1 (555) 000-0000"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[12px] py-3.5 pl-11 pr-4 text-[15px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700 dark:text-slate-200 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={() => navigate('/admin/teachers')}
                        className="text-[14px] font-bold text-[#0F172A] dark:text-slate-300 hover:text-slate-600 dark:hover:text-white transition-colors"
                    >
                        Discard
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex items-center gap-2 bg-[#1D68E3] text-white px-6 py-3.5 rounded-[12px] font-bold text-[15px] shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <UserPlus className="h-5 w-5" />
                        )}
                        {loading ? 'Registering...' : 'Complete Registration'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default AdminAddTeacher;
