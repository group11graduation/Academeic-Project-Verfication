import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import {
    ChevronRight,
    Edit3,
    Check,
    X,
    Mail,
    User,
    GraduationCap,
    Users,
    FileText,
    Download,
    Shield,
    ArrowLeft,
    Upload,
    Eye,
    Loader2,
    Trash2,
    ShieldCheck,
    Lock,
    BookOpen,
    Copy
} from 'lucide-react';
import adminStudentService from '../../../services/adminStudentService';
import adminClassService from '../../../services/adminClassService';
import { adminAcademicService } from '../../../services/adminAcademicService';

const AdminStudentDetail = () => {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    // Data States
    const [student, setStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Edit States
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [classes, setClasses] = useState([]);
    const [loadingClasses, setLoadingClasses] = useState(false);
    const [facultyStructureNames, setFacultyStructureNames] = useState([]);

    // Certificate Preview State
    const [isCertModalOpen, setIsCertModalOpen] = useState(false);
    const [copiedPasscode, setCopiedPasscode] = useState(false);

    // Photo Edit States
    const fileInputRef = React.useRef(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);


    // Certificate Edit States
    const editCertificateInputRef = React.useRef(null);
    const [certEditMode, setCertEditMode] = useState('local'); // 'local' or 'url'
    const [editCertUrl, setEditCertUrl] = useState('');
    const [editLocalCertFile, setEditLocalCertFile] = useState(null);
    const [editLocalCertFileName, setEditLocalCertFileName] = useState('');

    // Context-aware back navigation
    const backPath = location.state?.from || '/admin/students';
    const backLabel = backPath.includes('/classes/') ? 'Back to Class' : 'Back to Students';

    useEffect(() => {
        const fetchStudent = async () => {
            try {
                const response = await adminStudentService.getStudent(id);
                if (response.success) {
                    setStudent(response.data);
                    // Initialize edit form with fetched data
                    setEditForm({
                        name: response.data.name || '',
                        email: response.data.email || response.data.userId?.email || '',
                        photo: response.data.photo || '',
                        classId: response.data.classId || '',
                        phone: response.data.personalInfo?.phone || '',
                        dob: response.data.personalInfo?.dob ? new Date(response.data.personalInfo.dob).toISOString().split('T')[0] : '',
                        gender: response.data.personalInfo?.gender || 'Unknown',
                        fatherName: response.data.parentDetails?.fatherName || '',
                        motherName: response.data.parentDetails?.motherName || '',
                        fatherContact: response.data.parentDetails?.fatherContact || '',
                        motherContact: response.data.parentDetails?.motherContact || '',
                        highSchoolName: response.data.educationalBackground?.highSchoolName || '',
                        graduationYear: response.data.educationalBackground?.graduationYear || '',
                        certificateUrl: response.data.educationalBackground?.certificateUrl || '',
                        faculty: response.data.academicInfo?.faculty || '',
                        campus: response.data.academicInfo?.campus || '',
                        studyMode: response.data.academicInfo?.studyMode || '',
                        entryDate: response.data.academicInfo?.entryDate ? new Date(response.data.academicInfo.entryDate).toISOString().split('T')[0] : '',
                    });
                } else {
                    setError('Student not found');
                }
            } catch (err) {
                console.error(err);
                setError('Failed to fetch student details.');
            } finally {
                setLoading(false);
            }
        };

        fetchStudent();
    }, [id]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const stRes = await adminAcademicService.getAcademicStructure();
                if (cancelled || !stRes.success) return;
                const names = (stRes.data?.faculties || []).map((f) => f.name).filter(Boolean);
                setFacultyStructureNames(names);
            } catch {
                /* ignore */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditForm(prev => ({ ...prev, [name]: value }));
    };

    const handleEditCertChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setEditLocalCertFileName(file.name);
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditLocalCertFile(reader.result); // Base64 string for backend
                setEditForm(prev => ({ ...prev, certificateUrl: reader.result })); // Update form payload
            };
            reader.readAsDataURL(file);
        }
    };

    const fetchClasses = async () => {
        setLoadingClasses(true);
        try {
            const res = await adminClassService.getClasses();
            if (res.success) {
                setClasses(res.data);
            }
        } catch (err) {
            console.error("Failed to fetch classes:", err);
        } finally {
            setLoadingClasses(false);
        }
    };

    const toggleEdit = () => {
        if (!isEditing) {
            fetchClasses();
        }
        setIsEditing(!isEditing);
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingPhoto(true);
        try {
            const response = await adminStudentService.uploadProfileImage(file);
            // Result is usually /uploads/filename
            const imageUrl = `http://localhost:5000${response}`;
            setEditForm(prev => ({ ...prev, photo: imageUrl }));
        } catch (error) {
            console.error("Failed to upload photo:", error);
            alert("Failed to upload image. Please try again.");
        } finally {
            setUploadingPhoto(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = {
                name: editForm.name,
                email: editForm.email,
                photo: editForm.photo,
                classId: editForm.classId,
                personalInfo: {
                    phone: editForm.phone,
                    dob: editForm.dob || null,
                    gender: editForm.gender
                },
                parentDetails: {
                    fatherName: editForm.fatherName,
                    fatherContact: editForm.fatherContact,
                    motherName: editForm.motherName,
                    motherContact: editForm.motherContact
                },
                educationalBackground: {
                    highSchoolName: editForm.highSchoolName,
                    graduationYear: editForm.graduationYear,
                    certificateUrl: certEditMode === 'local' && editLocalCertFile ? editLocalCertFile : (certEditMode === 'url' && editCertUrl ? editCertUrl : editForm.certificateUrl)
                },
                academicInfo: {
                    faculty: editForm.faculty,
                    campus: editForm.campus,
                    studyMode: editForm.studyMode,
                    entryDate: editForm.entryDate || null,
                    department: editForm.department // Added
                }
            };

            const response = await adminStudentService.updateStudent(id, payload);
            if (response.success) {
                setStudent(response.data);
                setIsEditing(false);
            }
        } catch (err) {
            console.error("Failed to update student", err);
            alert("Failed to update student details.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Are you sure you want to delete this student profile? This action cannot be undone.")) return;

        setIsDeleting(true);
        try {
            const response = await adminStudentService.deleteStudent(id);
            if (response.success) {
                navigate('/admin/students');
            } else {
                alert(response.message || "Failed to delete student.");
                setIsDeleting(false);
            }
        } catch (err) {
            console.error("Failed to delete student", err);
            alert("An error occurred while deleting the student.");
            setIsDeleting(false);
        }
    };

    const handleCopyPasscode = async () => {
        if (!student?.passcode) return;
        try {
            await navigator.clipboard.writeText(String(student.passcode));
            setCopiedPasscode(true);
            window.setTimeout(() => setCopiedPasscode(false), 2000);
        } catch (err) {
            console.error('Failed to copy passcode', err);
            alert('Failed to copy passcode.');
        }
    };

    // handleGeneratePasscode function removed as per instructions

    if (loading) {
        return (
            <div className="min-h-[40vh] flex flex-col items-center justify-center">
                <Loader2 className="h-7 w-7 text-[#1D68E3] animate-spin mb-2" />
                <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">Loading student profile...</p>
            </div>
        );
    }

    if (error || !student) {
        return (
            <div className="min-h-[40vh] flex flex-col items-center justify-center">
                <p className="text-red-500 font-bold mb-3 text-[13px]">{error}</p>
                <button onClick={() => navigate(backPath)} className="text-[#1D68E3] font-medium underline text-[12px]">Go Back</button>
            </div>
        );
    }

    return (
        <div className="font-sans text-[13px] transition-colors">
            <div className="mb-4">

                {/* Profile Header Card */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm mb-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative shrink-0">
                            <img
                                src={isEditing ? (editForm.photo || 'https://via.placeholder.com/150') : (student.photo || 'https://via.placeholder.com/150')}
                                alt={student.name}
                                className="h-20 w-20 rounded-full border-4 border-[#F8FAFB] dark:border-slate-900 shadow-md object-cover transition-colors"
                            />
                            {isEditing && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 hover:opacity-100 transition-opacity cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    <Upload className="h-5 w-5 text-white" />
                                </div>
                            )}
                            <div className="absolute bottom-1 right-1 w-6 h-6 bg-[#10B981] border-4 border-white dark:border-slate-800 rounded-full"></div>
                        </div>
                        <div className="w-full">
                            {isEditing ? (
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        name="name"
                                        value={editForm.name}
                                        onChange={handleEditChange}
                                        placeholder="Student Name"
                                        className="text-lg font-black tracking-tight leading-tight w-full border-b-2 border-blue-500 focus:outline-none bg-slate-50 dark:bg-slate-900 px-2 rounded-t-md text-slate-900 dark:text-white transition-colors"
                                    />
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">Profile Picture Control</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handlePhotoUpload}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={uploadingPhoto}
                                                className="px-4 py-2 bg-blue-50 dark:bg-blue-500/10 text-[#1D68E3] rounded-lg text-[12px] font-black uppercase tracking-widest hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all flex items-center gap-3"
                                            >
                                                {uploadingPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                                {uploadingPhoto ? 'Uploading...' : 'Upload Local Image'}
                                            </button>
                                            <span className="text-slate-300 dark:text-slate-600 text-[12px] font-bold italic transition-colors">OR enter URL:</span>
                                            <input
                                                type="text"
                                                name="photo"
                                                value={editForm.photo}
                                                onChange={handleEditChange}
                                                placeholder="https://example.com/avatar.jpg"
                                                className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-4 text-[13px] font-medium outline-none focus:ring-2 focus:ring-blue-500/10 text-slate-800 dark:text-white transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <h1 className="text-base md:text-lg font-black tracking-tight mb-1 leading-tight text-slate-900 dark:text-white transition-colors">{student.name}</h1>
                            )}

                            <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold mt-1">
                                <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-3 py-1 rounded-lg uppercase tracking-wider transition-colors">{student.studentId}</span>
                                <span className="flex items-center gap-1.5 text-[#10B981]">
                                    <span className="w-2 h-2 bg-[#10B981] rounded-full"></span>
                                    {student.status || 'Active'}
                                </span>
                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                <span className="text-[#1D68E3]">
                                    Class: {isEditing ? (
                                        <select
                                            name="classId"
                                            value={editForm.classId}
                                            onChange={handleEditChange}
                                            disabled={loadingClasses}
                                            className="border-b border-blue-500 bg-slate-50 dark:bg-slate-900 outline-none text-[#1D68E3] dark:text-blue-400 font-bold px-2 rounded-t-md text-slate-900 dark:text-white transition-colors"
                                        >
                                            {loadingClasses ? (
                                                <option>Loading...</option>
                                            ) : classes.length > 0 ? (
                                                classes.map(cls => (
                                                    <option key={cls._id} value={cls.code}>{cls.code}</option>
                                                ))
                                            ) : (
                                                <option value={editForm.classId}>{editForm.classId}</option>
                                            )}
                                        </select>
                                    ) : student.classId}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {isEditing ? (
                            <>
                                <button
                                    onClick={toggleEdit}
                                    className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-lg font-bold text-[12px] hover:bg-slate-50 dark:hover:bg-slate-750 transition-all"
                                >
                                    <X className="h-3.5 w-3.5" /> Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-[#10B981] text-white rounded-lg font-bold text-[12px] shadow-md shadow-green-500/20 hover:bg-green-600 transition-all disabled:opacity-70"
                                >
                                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                    Save Changes
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={toggleEdit}
                                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-[12px] hover:bg-slate-50 dark:hover:bg-slate-750 transition-all shadow-sm"
                            >
                                <Edit3 className="h-3.5 w-3.5" /> Edit Profile
                            </button>
                        )}
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 border border-red-100 dark:border-red-900/30 rounded-lg font-bold text-[12px] hover:bg-red-100 dark:hover:bg-red-900/50 transition-all disabled:opacity-70"
                        >
                            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
                        </button>
                    </div>
                </div>

                {/* Main Content Info Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    {/* Left & Center Column: Detailed Cards */}
                    <div className="xl:col-span-2 space-y-4">
                        {/* Personal Information */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
                            <div className="px-4 py-3 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between transition-colors">
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-[#1D68E3]" />
                                    <h2 className="uppercase font-black text-[12px] tracking-widest text-slate-700 dark:text-slate-300 transition-colors">Personal Information</h2>
                                </div>
                                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-[#1D68E3] rounded-lg font-bold text-[12px] hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all">
                                    <Mail className="h-3.5 w-3.5" /> Message
                                </button>
                            </div>
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 transition-colors">Email Address (Login)</p>
                                    {isEditing ? (
                                        <input type="email" name="email" value={editForm.email} onChange={handleEditChange} className="w-full border p-2 rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-800 dark:text-white transition-colors" />
                                    ) : (
                                        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 transition-colors">{student.email || student.userId?.email || 'N/A'}</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 transition-colors">Date of Birth</p>
                                    {isEditing ? (
                                        <input type="date" name="dob" value={editForm.dob} onChange={handleEditChange} className="w-full border p-2 rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-800 dark:text-white transition-colors" />
                                    ) : (
                                        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 transition-colors">{student.personalInfo?.dob ? new Date(student.personalInfo.dob).toLocaleDateString() : 'N/A'}</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 transition-colors">Gender</p>
                                    {isEditing ? (
                                        <select name="gender" value={editForm.gender} onChange={handleEditChange} className="w-full border p-2 rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-800 dark:text-white transition-colors">
                                            <option>Male</option>
                                            <option>Female</option>
                                            <option>Unknown</option>
                                        </select>
                                    ) : (
                                        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 transition-colors">{student.personalInfo?.gender || 'N/A'}</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 transition-colors">Phone Number</p>
                                    {isEditing ? (
                                        <input type="text" name="phone" value={editForm.phone} onChange={handleEditChange} className="w-full border p-2 rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-800 dark:text-white transition-colors" />
                                    ) : (
                                        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 transition-colors">{student.personalInfo?.phone || 'N/A'}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Educational Background */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
                            <div className="px-4 py-3 border-b border-slate-50 dark:border-slate-700 flex items-center gap-2 transition-colors">
                                <GraduationCap className="h-4 w-4 text-[#1D68E3]" />
                                <h2 className="uppercase font-black text-[12px] tracking-widest text-slate-700 dark:text-slate-300 transition-colors">Educational Background</h2>
                            </div>
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 transition-colors">High School</p>
                                    {isEditing ? (
                                        <input type="text" name="highSchoolName" value={editForm.highSchoolName} onChange={handleEditChange} className="w-full border p-2 rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-800 dark:text-white transition-colors" />
                                    ) : (
                                        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 transition-colors">{student.educationalBackground?.highSchoolName || 'N/A'}</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 transition-colors">Graduation Year</p>
                                    {isEditing ? (
                                        <input type="text" name="graduationYear" value={editForm.graduationYear} onChange={handleEditChange} className="w-full border p-2 rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-800 dark:text-white transition-colors" />
                                    ) : (
                                        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 transition-colors">{student.educationalBackground?.graduationYear || 'N/A'}</p>
                                    )}
                                </div>

                                {/* Certificate Viewer / Editor */}
                                <div className="mt-4 border-t border-slate-50 dark:border-slate-700 pt-4 md:col-span-2 lg:col-span-3 transition-colors">
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 transition-colors">High School Certificate</p>

                                    {isEditing ? (
                                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-900/50 space-y-4 transition-colors">
                                            <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 w-full sm:max-w-xs transition-colors">
                                                <button
                                                    type="button"
                                                    onClick={() => setCertEditMode('local')}
                                                    className={`flex-1 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-md transition-all ${certEditMode === 'local' ? 'bg-[#1D68E3] text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                                >
                                                    Upload File
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setCertEditMode('url')}
                                                    className={`flex-1 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-md transition-all ${certEditMode === 'url' ? 'bg-[#1D68E3] text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                                >
                                                    External Link
                                                </button>
                                            </div>

                                            {certEditMode === 'local' ? (
                                                <div>
                                                    <input
                                                        type="file"
                                                        ref={editCertificateInputRef}
                                                        className="hidden"
                                                        accept=".pdf,image/jpeg,image/png"
                                                        onChange={handleEditCertChange}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => editCertificateInputRef.current?.click()}
                                                        className="w-full flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border-2 border-dashed border-blue-200 dark:border-blue-500/20 text-[#1D68E3] py-4 rounded-xl font-bold text-[13px] hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all transition-colors"
                                                    >
                                                        <Upload className="h-4 w-4" />
                                                        {editLocalCertFileName || 'Click to Upload New Certificate'}
                                                    </button>
                                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 text-center transition-colors">Replacing will overwrite the old file. Max 5MB (PDF/JPG/PNG).</p>
                                                </div>
                                            ) : (
                                                <div>
                                                    <input
                                                        type="text"
                                                        placeholder="Paste new direct document URL..."
                                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 text-[13px] focus:ring-2 focus:ring-blue-500/10 outline-none text-slate-800 dark:text-white transition-colors"
                                                        value={editCertUrl}
                                                        onChange={(e) => {
                                                            setEditCertUrl(e.target.value);
                                                            setEditForm(prev => ({ ...prev, certificateUrl: e.target.value }));
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        student.educationalBackground?.certificateUrl ? (
                                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 transition-colors">
                                                <div className="flex items-center gap-3 truncate pr-4">
                                                    <div className="bg-blue-100 dark:bg-blue-500/10 p-2 rounded-lg shrink-0 transition-colors">
                                                        <FileText className="h-4 w-4 text-[#1D68E3]" />
                                                    </div>
                                                    <span className="text-[14px] font-bold text-slate-700 dark:text-slate-300 transition-colors truncate">
                                                        {student.educationalBackground.certificateUrl.startsWith('data:')
                                                            ? 'Uploaded_Certificate_File'
                                                            : student.educationalBackground.certificateUrl}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <button
                                                        onClick={() => setIsCertModalOpen(true)}
                                                        className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-[#1D68E3] transition-all shadow-sm"
                                                    >
                                                        <Eye className="h-4 w-4" /> View
                                                    </button>
                                                    <a
                                                        href={student.educationalBackground.certificateUrl}
                                                        download="High_School_Certificate"
                                                        className="flex items-center gap-2 bg-[#1D68E3] text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-blue-600 transition-all shadow-sm shadow-blue-500/10"
                                                    >
                                                        <Download className="h-4 w-4" /> Save
                                                    </a>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors">
                                                <FileText className="h-6 w-6 text-slate-300 dark:text-slate-700 mb-2 transition-colors" />
                                                <p className="text-[13px] font-bold text-slate-500 dark:text-slate-400 transition-colors">No Certificate Uploaded</p>
                                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 transition-colors">This student has not provided a high school certificate during registration.</p>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Parent Information */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
                            <div className="px-4 py-3 border-b border-slate-50 dark:border-slate-700 flex items-center gap-2 transition-colors">
                                <Users className="h-4 w-4 text-[#1D68E3]" />
                                <h2 className="uppercase font-black text-[12px] tracking-widest text-slate-700 dark:text-slate-300 transition-colors">Parent Information</h2>
                            </div>
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 transition-colors">Father's Name</p>
                                    {isEditing ? (
                                        <input type="text" name="fatherName" value={editForm.fatherName} onChange={handleEditChange} className="w-full border p-2 rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-800 dark:text-white transition-colors" />
                                    ) : (
                                        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 transition-colors">{student.parentDetails?.fatherName || 'N/A'}</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 transition-colors">Father's Contact</p>
                                    {isEditing ? (
                                        <input type="text" name="fatherContact" placeholder="+252..." value={editForm.fatherContact} onChange={handleEditChange} className="w-full border p-2 rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-800 dark:text-white transition-colors" />
                                    ) : (
                                        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 transition-colors">{student.parentDetails?.fatherContact || 'N/A'}</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 transition-colors">Mother's Name</p>
                                    {isEditing ? (
                                        <input type="text" name="motherName" value={editForm.motherName} onChange={handleEditChange} className="w-full border p-2 rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-800 dark:text-white transition-colors" />
                                    ) : (
                                        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 transition-colors">{student.parentDetails?.motherName || 'N/A'}</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 transition-colors">Mother's Contact</p>
                                    {isEditing ? (
                                        <input type="text" name="motherContact" placeholder="+252..." value={editForm.motherContact} onChange={handleEditChange} className="w-full border p-2 rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-800 dark:text-white transition-colors" />
                                    ) : (
                                        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 transition-colors">{student.parentDetails?.motherContact || 'N/A'}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Academic & Status */}
                    <div className="space-y-4">
                        {/* Academic Summary */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
                            <div className="px-4 py-3 border-b border-slate-50 dark:border-slate-700 flex items-center gap-2 transition-colors">
                                <BookOpen className="h-4 w-4 text-[#1D68E3]" />
                                <h2 className="uppercase font-black text-[12px] tracking-widest text-slate-700 dark:text-slate-300 transition-colors">Academic</h2>
                            </div>
                            <div className="p-4 space-y-4">
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Faculty</p>
                                    {isEditing ? (
                                        <select name="faculty" value={editForm.faculty} onChange={handleEditChange} className="w-full border p-2 rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-800 dark:text-white transition-colors">
                                            <option value="">Select faculty</option>
                                            {(() => {
                                                const names = new Set(facultyStructureNames);
                                                if (editForm.faculty && String(editForm.faculty).trim()) {
                                                    names.add(String(editForm.faculty).trim());
                                                }
                                                return [...names].sort((a, b) => a.localeCompare(b));
                                            })().map((name) => (
                                                <option key={name} value={name}>
                                                    {name}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 transition-colors">{student.academicInfo?.faculty || 'N/A'}</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Campus</p>
                                    {isEditing ? (
                                        <select name="campus" value={editForm.campus} onChange={handleEditChange} className="w-full border p-2 rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-800 dark:text-white transition-colors">
                                            <option value="">Select Campus</option>
                                            <option>Campus 1</option>
                                            <option>Campus 2</option>
                                            <option>Campus 3</option>
                                        </select>
                                    ) : (
                                        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 transition-colors">{student.academicInfo?.campus || 'N/A'}</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Mode</p>
                                    {isEditing ? (
                                        <select name="studyMode" value={editForm.studyMode} onChange={handleEditChange} className="w-full border p-2 rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-800 dark:text-white transition-colors">
                                            <option>Full-time</option>
                                            <option>Part-time</option>
                                        </select>
                                    ) : (
                                        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 transition-colors">{student.academicInfo?.studyMode || 'N/A'}</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 transition-colors">Entry Date</p>
                                    {isEditing ? (
                                        <input type="date" name="entryDate" value={editForm.entryDate} onChange={handleEditChange} className="w-full border p-2 rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-800 dark:text-white transition-colors" />
                                    ) : (
                                        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 transition-colors">{student.academicInfo?.entryDate ? new Date(student.academicInfo.entryDate).toLocaleDateString() : 'N/A'}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Security & Access */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
                            <div className="px-4 py-3 border-b border-slate-50 dark:border-slate-700 flex items-center gap-2 transition-colors">
                                <ShieldCheck className="h-4 w-4 text-[#1D68E3]" />
                                <h2 className="uppercase font-black text-[12px] tracking-widest text-slate-700 dark:text-slate-300 transition-colors">Security</h2>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3 transition-colors">
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 transition-colors">Student Passcode</p>
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5">
                                            <span className="text-[15px] font-black tracking-widest font-mono text-slate-800 dark:text-slate-200 transition-colors">
                                                {student.passcode || 'N/A'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleCopyPasscode}
                                                disabled={!student.passcode}
                                                className="text-slate-500 hover:text-[#1D68E3] transition-colors disabled:opacity-60"
                                                title="Copy passcode"
                                            >
                                                {copiedPasscode ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <button className="w-full flex items-center justify-between p-3 border border-slate-100 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition-all group transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Lock className="h-4 w-4 text-slate-400 group-hover:text-[#1D68E3] transition-colors" />
                                        <span className="text-[13px] font-bold text-slate-600 dark:text-slate-300 transition-colors">Reset Password</span>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-300" />
                                </button>
                                <button className="w-full flex items-center justify-between p-3 border border-slate-100 dark:border-slate-700 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all group transition-colors">
                                    <div className="flex items-center gap-3">
                                        <ShieldCheck className="h-4 w-4 text-slate-400 group-hover:text-red-500 transition-colors" />
                                        <span className="text-[13px] font-bold text-slate-600 dark:text-slate-300 group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors">Deactivate Account</span>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-300" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Certificate Modal */}
            {isCertModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 z-10">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-100 dark:bg-blue-500/10 p-2 rounded-lg">
                                    <FileText className="h-4 w-4 text-[#1D68E3]" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 dark:text-white text-base tracking-tight">High School Certificate</h3>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{student.name}'s Document</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsCertModalOpen(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Modal Body (Preview) */}
                        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950/20">
                            <div className="w-full flex justify-center bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-inner overflow-hidden min-h-[300px]">
                                {student.educationalBackground?.certificateUrl?.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/) || student.educationalBackground?.certificateUrl?.startsWith('data:image') ? (
                                    <img 
                                        src={student.educationalBackground.certificateUrl} 
                                        alt="Certificate Preview" 
                                        className="max-w-full h-auto object-contain"
                                    />
                                ) : (
                                    <iframe 
                                        src={student.educationalBackground?.certificateUrl} 
                                        className="w-full h-[600px] border-none" 
                                        title="Certificate PDF Preview"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-white dark:bg-slate-900">
                            <button 
                                onClick={() => setIsCertModalOpen(false)}
                                className="px-4 py-2 text-[12px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                Close Preview
                            </button>
                            <a 
                                href={student.educationalBackground?.certificateUrl} 
                                download="High_School_Certificate"
                                className="flex items-center gap-1.5 bg-[#1D68E3] text-white px-4 py-2 rounded-lg font-black text-[12px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-md shadow-blue-500/10 active:scale-[0.98]"
                            >
                                <Download className="h-3.5 w-3.5" /> Download Certificate
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminStudentDetail;
