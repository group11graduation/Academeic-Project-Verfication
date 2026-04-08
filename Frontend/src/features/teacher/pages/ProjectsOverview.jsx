import React, { useState, useEffect } from 'react';
import {
    Search,
    Users,
    ArrowRight,
    BookOpen,
    Loader2,
    ChevronDown,
    Plus,
    Layout,
    X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import teacherService from '../../../services/teacherService';

const ProjectsOverview = () => {
    const navigate = useNavigate();
    const [groupedData, setGroupedData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('group'); // 'individual' or 'group'
    const [expandedClasses, setExpandedClasses] = useState({});
    const [myClasses, setMyClasses] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState({
        classCode: '',
        type: 'group',
        groupSize: 4,
    });

    useEffect(() => {
        const fetchAllGroups = async () => {
            try {
                const response = await teacherService.getAllGroups();
                if (response.success) {
                    setGroupedData(response.data);
                }
                const clsRes = await teacherService.getMyClasses();
                if (clsRes.success) {
                    const rows = clsRes.data || [];
                    setMyClasses(rows);
                    if (rows.length > 0) {
                        setCreateForm((prev) => ({ ...prev, classCode: prev.classCode || rows[0].code }));
                    }
                }
            } catch (error) {
                console.error("Failed to fetch all groups:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAllGroups();
    }, []);

    const toggleClassExpansion = (classCode) => {
        setExpandedClasses(prev => ({
            ...prev,
            [classCode]: !prev[classCode]
        }));
    };

    const handleCreateGroups = async () => {
        if (!createForm.classCode) {
            alert('Select class first.');
            return;
        }
        try {
            setCreating(true);
            const res = await teacherService.generateGroups(createForm.classCode, {
                type: createForm.type,
                groupSize: createForm.type === 'group' ? Number(createForm.groupSize || 4) : 1,
            });
            if (!res.success) throw new Error(res.message || 'Failed to create groups');
            const response = await teacherService.getAllGroups();
            if (response.success) setGroupedData(response.data || []);
            setShowCreateModal(false);
        } catch (error) {
            console.error('Failed to create groups:', error);
            alert(error.response?.data?.message || error.message || 'Could not create groups');
        } finally {
            setCreating(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0B1120]">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
            </div>
        );
    }

    const filteredData = groupedData.map(cls => ({
        ...cls,
        projects: cls.projects.filter(p => {
            // Default to 'group' if type is missing (older data)
            const projectType = p.type || 'group';
            const matchesTab = projectType === activeTab;
            const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.members.some(m => m.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                p.members.some(m => m.studentId && m.studentId.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesTab && matchesSearch;
        })
    })).filter(cls => cls.projects.length > 0);

    const hasAnyProjects = filteredData.length > 0;

    return (
        <div className="min-h-screen bg-transparent p-4 md:p-10 max-w-[1600px] mx-auto">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                <div className="flex items-center gap-4">
                    <div className="bg-[#1D68E3] p-3 rounded-2xl shadow-xl shadow-blue-500/20">
                        <BookOpen className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Student Projects</h1>
                    </div>
                </div>
                
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-[320px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-600" />
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-500/10 transition-all font-bold shadow-xl text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700"
                        />
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-[#2a3fa4] text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#223688] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg whitespace-nowrap"
                    >
                        Create New
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex items-center gap-10 mb-10 border-b border-slate-100 dark:border-white/5 pb-0.5">
                {[
                    { id: 'individual', label: 'Individual', icon: Users },
                    { id: 'group', label: 'Group', icon: Layout }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-3 px-2 py-4 relative transition-all ${activeTab === tab.id ? 'text-[#1D68E3]' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    >
                        <tab.icon className={`h-5 w-5 ${activeTab === tab.id ? 'opacity-100' : 'opacity-50'}`} />
                        <span className="text-sm font-black tracking-wide uppercase">{tab.label}</span>
                        {activeTab === tab.id && (
                            <div className="absolute bottom-[-1px] left-0 right-0 h-1 bg-[#1D68E3] rounded-full shadow-[0_-2px_10px_rgba(29,104,227,0.3)]"></div>
                        )}
                    </button>
                ))}
            </div>

            {!hasAnyProjects ? (
                <div className="bg-white dark:bg-[#0F172A] rounded-[40px] border-2 border-dashed border-slate-100 dark:border-white/5 p-12 md:p-24 text-center">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-[#0B1120] rounded-full flex items-center justify-center mx-auto mb-8">
                        <Layout className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-3">No {activeTab} projects found</h2>
                    <p className="text-slate-500 mb-10 max-w-md mx-auto font-medium">Try adjusting your search or create a new student group assignment.</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-[#2a3fa4] text-white px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[#223688] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
                    >
                        Go to My Classes
                    </button>
                </div>
            ) : (
                <div className="space-y-12">
                    {filteredData.map(cls => (
                        <section key={cls.code} className="space-y-6">
                            <div className="flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className="w-1.5 h-8 bg-[#1D68E3] rounded-full"></div>
                                    <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{cls.code}: {cls.title}</h2>
                                    <span className="px-3 py-1 bg-blue-50 dark:bg-blue-500/10 text-[#1D68E3] dark:text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                                        {cls.semester || 'Semester 1'}
                                    </span>
                                </div>
                            </div>

                            {activeTab === 'individual' ? (
                                <div className="bg-white dark:bg-[#0F172A] rounded-[40px] border border-slate-100 dark:border-white/5 shadow-2xl overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-slate-50 dark:border-white/5">
                                                    <th className="px-8 py-6 text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Student</th>
                                                    <th className="px-8 py-6 text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest text-center">Student ID</th>
                                                    <th className="px-8 py-6 text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Project Title</th>
                                                    <th className="px-8 py-6 text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                                                {(expandedClasses[cls.code] ? cls.projects : cls.projects.slice(0, 5)).map((project, idx) => {
                                                    const student = project.members[0] || {};
                                                    return (
                                                        <tr key={project._id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                                                            <td className="px-8 py-6">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#0B1120] border border-slate-100 dark:border-white/5 flex items-center justify-center overflow-hidden shadow-sm">
                                                                        {student.photo && student.photo !== 'default-student.jpg' ? (
                                                                            <img src={student.photo.startsWith('http') ? student.photo : `http://localhost:5000/uploads/${student.photo}`} className="w-full h-full object-cover" alt="" />
                                                                        ) : <span className="text-lg font-black text-slate-400 uppercase">{student.name?.[0]}</span>}
                                                                    </div>
                                                                    <span className="text-[15px] font-bold text-slate-700 dark:text-slate-200">{student.name || 'Unknown Student'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-6 text-center">
                                                                <span className="text-[13px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">ID: {student.studentId || 'N/A'}</span>
                                                            </td>
                                                            <td className="px-8 py-6">
                                                                <span className="text-[15px] font-bold text-[#1D68E3] dark:text-blue-400 hover:underline cursor-pointer transition-all">{project.title}</span>
                                                            </td>
                                                            <td className="px-8 py-6 text-right">
                                                                <button 
                                                                    onClick={() => navigate(`/teacher/groups/${project._id}`)}
                                                                    className="text-xs font-black text-[#1D68E3] dark:text-blue-400 uppercase tracking-widest hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                                                                >
                                                                    View Progress
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    {cls.projects.length > 5 && (
                                        <button 
                                            onClick={() => toggleClassExpansion(cls.code)}
                                            className="w-full py-6 border-t border-slate-50 dark:border-white/5 flex items-center justify-center gap-2 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-300 transition-all hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                                        >
                                            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${expandedClasses[cls.code] ? 'rotate-180' : ''}`} />
                                            {expandedClasses[cls.code] ? 'See Less' : `See More Students (${cls.projects.length - 5})`}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {cls.projects.map((group) => (
                                        <div key={group._id} className="bg-white dark:bg-[#0F172A] rounded-[40px] border border-slate-100 dark:border-white/5 shadow-2xl overflow-hidden flex flex-col group hover:border-blue-500/30 transition-all duration-300">
                                            <div className="p-8 pb-6">
                                                <div className="flex justify-between items-start mb-6">
                                                    <h4 className="text-[12px] font-black text-[#1D68E3] dark:text-blue-400 uppercase tracking-widest">Group {group.assignmentNumber}</h4>
                                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-widest ${group.status.toLowerCase() === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-slate-50 dark:bg-[#0B1120] text-slate-400 dark:text-slate-600'}`}>
                                                        {group.status.toUpperCase()}
                                                    </span>
                                                </div>
                                                <h3 className="text-[18px] font-black text-slate-800 dark:text-slate-100 mb-8 leading-tight line-clamp-2 min-h-[52px]">
                                                    {group.title}
                                                </h3>

                                                <div className="space-y-4 pt-6 border-t border-slate-50 dark:border-white/5">
                                                    {group.members.slice(0, 3).map((member, i) => (
                                                        <div key={i} className="flex items-center gap-4">
                                                            <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-[#0B1120] flex items-center justify-center text-[10px] font-black text-slate-700 dark:text-slate-100 uppercase overflow-hidden border border-slate-100 dark:border-white/5 shadow-sm">
                                                                {member.photo && member.photo !== 'default-student.jpg' ? (
                                                                    <img src={member.photo.startsWith('http') ? member.photo : `http://localhost:5000/uploads/${member.photo}`} className="w-full h-full object-cover" alt="" />
                                                                ) : member.name[0]}
                                                            </div>
                                                            <span className="text-[14px] font-bold text-slate-500 dark:text-slate-400">{member.name}</span>
                                                        </div>
                                                    ))}
                                                    {group.members.length > 3 && (
                                                        <p className="text-[11px] font-black text-slate-400 dark:text-slate-600 pl-12 uppercase tracking-widest">+{group.members.length - 3} more</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-auto px-8 py-6 bg-slate-50/50 dark:bg-[#0B1120] border-t border-slate-50 dark:border-white/5 flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">SIMILARITY</span>
                                                    <span className={`text-[17px] font-black ${group.similarityLevel === 'High' ? 'text-rose-600' : 'text-emerald-500'}`}>
                                                        {group.similarity}%
                                                    </span>
                                                </div>
                                                <button 
                                                    onClick={() => navigate(`/teacher/groups/${group._id}`)}
                                                    className="p-3 bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-100 dark:border-white/5 text-[#1D68E3] dark:text-blue-400 hover:bg-[#1D68E3] hover:text-white transition-all shadow-xl"
                                                >
                                                    <ArrowRight className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    ))}
                </div>
            )}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-900/60"
                        onClick={() => !creating && setShowCreateModal(false)}
                    />
                    <div className="relative w-full max-w-xl rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0F172A] p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Create Groups</h3>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="p-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-500"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[12px] font-black uppercase tracking-wider text-slate-500 mb-2">Class</label>
                                <select
                                    value={createForm.classCode}
                                    onChange={(e) => setCreateForm((p) => ({ ...p, classCode: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] px-4 py-2.5 text-sm text-slate-900 dark:text-white"
                                >
                                    <option value="">Select class</option>
                                    {myClasses.map((c) => (
                                        <option key={c.code} value={c.code}>
                                            {c.code} - {c.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[12px] font-black uppercase tracking-wider text-slate-500 mb-2">Type</label>
                                <select
                                    value={createForm.type}
                                    onChange={(e) => setCreateForm((p) => ({ ...p, type: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] px-4 py-2.5 text-sm text-slate-900 dark:text-white"
                                >
                                    <option value="group">Group</option>
                                    <option value="individual">Individual</option>
                                </select>
                            </div>
                            {createForm.type === 'group' && (
                                <div>
                                    <label className="block text-[12px] font-black uppercase tracking-wider text-slate-500 mb-2">Group size</label>
                                    <input
                                        type="number"
                                        min={2}
                                        max={10}
                                        value={createForm.groupSize}
                                        onChange={(e) => setCreateForm((p) => ({ ...p, groupSize: e.target.value }))}
                                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] px-4 py-2.5 text-sm text-slate-900 dark:text-white"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-600 dark:text-slate-300"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateGroups}
                                disabled={creating}
                                className="px-5 py-2 rounded-xl bg-[#2a3fa4] text-white text-sm font-bold hover:bg-[#223688] disabled:opacity-60"
                            >
                                {creating ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectsOverview;
