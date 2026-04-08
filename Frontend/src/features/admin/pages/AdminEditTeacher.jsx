import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, User, ChevronDown, Upload, X, Mail, Phone, ArrowLeft, Loader2 } from 'lucide-react';
import adminTeacherService from '../../../services/adminTeacherService';

const AdminEditTeacher = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [skills, setSkills] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = React.useRef(null);

    const [formData, setFormData] = useState({
        name: '',
        department: '',
        email: '',
        phone: '',
        photo: 'https://via.placeholder.com/150'
    });

    useEffect(() => {
        const fetchTeacherData = async () => {
            try {
                const response = await adminTeacherService.getTeacher(id);
                if (response.success) {
                    const t = response.data;
                    setFormData({
                        name: t.name || '',
                        department: t.department || '',
                        email: t.email || '',
                        phone: t.phone || '',
                        photo: t.photo || 'https://via.placeholder.com/150'
                    });
                    setSkills(t.skills || []);
                }
            } catch (err) {
                console.error("Failed to fetch teacher:", err);
                setError("Failed to load teacher data. They may not exist.");
            } finally {
                setInitialLoading(false);
            }
        };
        fetchTeacherData();
    }, [id]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
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
            setFormData({ ...formData, photo: `http://localhost:5000${imageUrl}` });
        } catch (error) {
            console.error("Failed to upload image:", error);
            alert("Failed to upload image. Please try again.");
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...formData,
                skills
            };
            const response = await adminTeacherService.updateTeacher(id, payload);
            if (response.success) {
                navigate(`/admin/teachers/${id}`);
            }
        } catch (error) {
            console.error("Failed to update teacher:", error);
            alert(error.response?.data?.message || "Failed to update teacher");
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Loading teacher profile...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex flex-col items-center justify-center p-10 text-center">
                <div className="bg-white p-8 rounded-2xl border border-red-100 shadow-sm max-w-md w-full">
                    <X className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-[#0F172A] mb-2">Error</h2>
                    <p className="text-slate-500 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/admin/teachers')}
                        className="bg-[#1D68E3] text-white px-6 py-2.5 rounded-[12px] font-bold shadow-lg hover:bg-blue-700 w-full"
                    >
                        Back to Directory
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-10 max-w-[1200px] mx-auto font-sans bg-[#F8FAFB] min-h-screen">

            {/* Top Bar Area */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-8 mb-8">
                <div>
                    <h1 className="text-[32px] font-extrabold text-[#0F172A] tracking-tight mb-2">Edit Teacher Profile</h1>
                    <p className="text-[16px] text-slate-500 font-medium">Update information for {formData.name}</p>
                </div>
                <button
                    onClick={() => navigate(`/admin/teachers/${id}`)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-[12px] text-slate-600 font-bold hover:bg-slate-50 transition-colors shadow-sm"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Profile
                </button>
            </div>

            {/* Main Form Card */}
            <div className="bg-white rounded-[16px] border border-slate-200 shadow-sm overflow-hidden p-8">

                {/* 1. PERSONAL DETAILS */}
                <section className="mb-10">
                    <h3 className="text-[13px] font-extrabold text-[#1D68E3] uppercase tracking-widest mb-6">Personal Details</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                        <div>
                            <label className="block text-[14px] font-bold text-[#0F172A] mb-2">Full Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="w-full bg-slate-50 border border-slate-200 rounded-[12px] py-3.5 px-4 text-[15px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[14px] font-bold text-[#0F172A] mb-2">Teacher ID</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={id}
                                    disabled
                                    className="w-full bg-slate-100/70 border border-slate-200 rounded-[12px] py-3.5 px-4 text-[15px] font-medium text-slate-500 outline-none cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-[14px] font-bold text-[#0F172A] mb-2">Faculty Department</label>
                            <div className="relative">
                                <select
                                    name="department"
                                    value={formData.department}
                                    onChange={handleChange}
                                    required
                                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-[12px] py-3.5 px-4 pr-10 text-[15px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700 outline-none"
                                >
                                    <option value="" disabled>Select Department</option>
                                    <option value="Computer Science">Computer Science</option>
                                    <option value="Information Technology">Information Technology</option>
                                    <option value="Mathematics">Mathematics</option>
                                    <option value="Software Engineering">Software Engineering</option>
                                    <option value="Data Science">Data Science</option>
                                    <option value="Cybersecurity">Cybersecurity</option>
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[14px] font-bold text-[#0F172A] mb-2">Profile Picture & URL</label>
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                                    {uploadingImage ? (
                                        <Loader2 className="h-5 w-5 text-[#1D68E3] animate-spin" />
                                    ) : formData.photo && formData.photo !== 'https://via.placeholder.com/150' ? (
                                        <img src={formData.photo} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="h-6 w-6 text-slate-400" />
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
                                    className="px-4 py-2 bg-white border border-slate-200 rounded-[8px] text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {uploadingImage ? 'Uploading...' : 'Upload File'}
                                </button>
                                <span className="text-[12px] font-medium text-slate-400">or enter Image URL below</span>
                            </div>
                            <input
                                type="text"
                                name="photo"
                                value={formData.photo}
                                onChange={handleChange}
                                placeholder="https://example.com/photo.jpg"
                                className="w-full mt-3 bg-slate-50 border border-slate-200 rounded-[12px] py-3.5 px-4 text-[14px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700 outline-none"
                            />
                        </div>
                    </div>
                </section>

                <hr className="border-slate-100 mb-10" />

                {/* 2. SUBJECT EXPERTISE */}
                <section className="mb-10">
                    <h3 className="text-[13px] font-extrabold text-[#1D68E3] uppercase tracking-widest mb-6">Subject Expertise</h3>

                    <div>
                        <label className="block text-[14px] font-bold text-[#0F172A] mb-2">Skills & Expertise (Select multiple)</label>
                        <div className="relative">
                            <div className="w-full bg-slate-50 border border-slate-200 rounded-[12px] p-2 flex flex-wrap gap-2 items-center min-h-[52px]">
                                {skills.map(skill => (
                                    <span key={skill} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-[#1D68E3] rounded-[8px] text-[13px] font-bold">
                                        {skill}
                                        <button onClick={() => removeSkill(skill)} className="hover:text-blue-700 focus:outline-none">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </span>
                                ))}
                                <select
                                    className="flex-1 bg-transparent border-none py-1.5 px-2 text-[14px] font-medium text-slate-700 outline-none w-[120px] min-w-[200px]"
                                    onChange={(e) => {
                                        handleAddSkill(e.target.value);
                                        e.target.value = ""; // Reset select after choosing
                                    }}
                                    defaultValue=""
                                >
                                    <option value="" disabled>Select a skill...</option>
                                    <option value="React.js">React.js</option>
                                    <option value="Python">Python</option>
                                    <option value="Java">Java</option>
                                    <option value="C++">C++</option>
                                    <option value="Network Security">Network Security</option>
                                    <option value="Cloud Architectures">Cloud Architectures</option>
                                    <option value="Cloud Computing">Cloud Computing</option>
                                    <option value="Data Science">Data Science</option>
                                    <option value="UX Design">UX Design</option>
                                    <option value="Machine Learning">Machine Learning</option>
                                    <option value="Database Systems">Database Systems</option>
                                    <option value="Database Design">Database Design</option>
                                    <option value="Web Development">Web Development</option>
                                    <option value="UI/UX Design">UI/UX Design</option>
                                    <option value="Agile Methodologies">Agile Methodologies</option>
                                    <option value="DevOps">DevOps</option>
                                    <option value="Node.js">Node.js</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </section>

                <hr className="border-slate-100 mb-10" />

                {/* 3. CONTACT INFORMATION */}
                <section className="mb-10">
                    <h3 className="text-[13px] font-extrabold text-[#1D68E3] uppercase tracking-widest mb-6">Contact Information</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-[14px] font-bold text-[#0F172A] mb-2">Contact Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-[12px] py-3.5 pl-12 pr-4 text-[15px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[14px] font-bold text-[#0F172A] mb-2">Phone Number</label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-[12px] py-3.5 pl-11 pr-4 text-[15px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-6 pt-6 border-t border-slate-100">
                    <button
                        onClick={() => navigate(`/admin/teachers/${id}`)}
                        className="text-[14px] font-bold text-[#0F172A] hover:text-slate-600 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex items-center gap-2 bg-[#1D68E3] text-white px-6 py-3.5 rounded-[12px] font-bold text-[15px] shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Save className="h-5 w-5" />
                        )}
                        {loading ? 'Saving Changes...' : 'Save Changes'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default AdminEditTeacher;
