import { Routes, Route, Navigate } from 'react-router-dom';
import AdminRoutes from './AdminRoutes';
import DashboardLayout from '../../shared/layouts/DashboardLayout';
import LoginPage from '../../features/Auth/pages/LoginPage';
import LandingPage from '../../features/student/pages/LandingPage';
import StudentAbout from '../../features/student/pages/StudentAbout';
import StudentGallery from '../../features/student/pages/StudentGallery';
import VerifiedProjectDetail from '../../features/student/pages/VerifiedProjectDetail';
import StudentAssignments from '../../features/student/pages/StudentAssignments';
import StudentAssignmentDetail from '../../features/student/pages/StudentAssignmentDetail';
import StudentLayout from '../../features/student/layouts/StudentLayout';
import StudentProjectsList from '../../features/student/pages/StudentProjectsList';
import StudentMyProject from '../../features/student/pages/StudentMyProject';
import StudentMyProjectDetail from '../../features/student/pages/StudentMyProjectDetail';
import StudentProfile from '../../features/student/pages/StudentProfile';
import { useAuth } from '../../context/authContext';
import { Loader2 } from 'lucide-react';
import ProtectedRoute from '../components/ProtectedRoute';

import TeacherDashboard from '../../features/teacher/pages/TeacherDashboard';
import ManageClasses from '../../features/teacher/pages/ManageClasses';
import ClassDetail from '../../features/teacher/pages/ClassDetail';
import StudentList from '../../features/teacher/pages/StudentList';
import ClassStudentDetail from '../../features/teacher/pages/ClassStudentDetail';
import ClassSectionOutlet from '../../features/teacher/layouts/ClassSectionOutlet';
import GroupConfiguration from '../../features/teacher/pages/GroupConfiguration';
import GroupManagement from '../../features/teacher/pages/GroupManagement';
import ProjectsOverview from '../../features/teacher/pages/ProjectsOverview';
import GroupDetailPage from '../../features/teacher/pages/GroupDetailPage';
import Assignments from '../../features/teacher/pages/Assignments';
import AssignmentCreate from '../../features/teacher/pages/AssignmentCreate';
import CollaborativeAssignmentCreate from '../../features/teacher/pages/CollaborativeAssignmentCreate';
import AssignmentDetail from '../../features/teacher/pages/AssignmentDetail';
import TeacherAssignmentProposals from '../../features/teacher/pages/TeacherAssignmentProposals';
import TeacherProposalStudentDetail from '../../features/teacher/pages/TeacherProposalStudentDetail';
import NormalAssignmentStudents from '../../features/teacher/pages/NormalAssignmentStudents';
import NormalAssignmentStudentDetail from '../../features/teacher/pages/NormalAssignmentStudentDetail';
import StudentProposalSubmit from '../../features/student/pages/StudentProposalSubmit';

const AppRoutes = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F8FAFB]">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
            </div>
        );
    }

    return (
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/about" element={<StudentAbout />} />
            <Route path="/gallery" element={<StudentGallery />} />
            <Route path="/gallery/:id" element={<VerifiedProjectDetail />} />
            <Route path="/assignments" element={<StudentAssignments />} />
            <Route path="/assignments/:id" element={<StudentAssignmentDetail />} />

            <Route
                path="/login"
                element={
                    user ? <Navigate to={user.role === 'student' ? '/student' : `/${user.role}`} replace /> : <LoginPage />
                }
            />

            {/* Admin — nested layout matches pattern used in AdminRoutes (Outlet inside AdminLayout) */}
            <Route
                path="/admin/*"
                element={
                    <ProtectedRoute allow={['admin']}>
                        <AdminRoutes />
                    </ProtectedRoute>
                }
            />

            {/* Teacher — nested routes + DashboardLayout Outlet (fixes index route under /teacher) */}
            <Route
                path="/teacher"
                element={
                    <ProtectedRoute allow={['teacher']}>
                        <DashboardLayout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<TeacherDashboard />} />
                <Route path="classes" element={<ManageClasses />} />
                <Route path="classes/:id" element={<ClassSectionOutlet />}>
                    <Route index element={<ClassDetail />} />
                    <Route path="students" element={<StudentList />} />
                    <Route path="students/:studentUserId" element={<ClassStudentDetail />} />
                    <Route path="groups/manage" element={<GroupManagement />} />
                    <Route path="groups" element={<GroupConfiguration />} />
                </Route>
                <Route path="group-management" element={<ProjectsOverview />} />
                <Route path="groups/:id" element={<GroupDetailPage />} />
                <Route path="assignments" element={<Assignments />} />
                <Route path="assignments/new" element={<AssignmentCreate />} />
                <Route path="assignments/collaborative/new" element={<CollaborativeAssignmentCreate />} />
                <Route path="assignments/:id/normal-students/:studentUserId" element={<NormalAssignmentStudentDetail />} />
                <Route path="assignments/:id/normal-students" element={<NormalAssignmentStudents />} />
                <Route path="assignments/:id/proposals/:proposalId" element={<TeacherProposalStudentDetail />} />
                <Route path="assignments/:id/proposals" element={<TeacherAssignmentProposals />} />
                <Route path="assignments/:id" element={<AssignmentDetail />} />
            </Route>

            {/* Student app — sidebar + Outlet */}
            <Route
                path="/student"
                element={
                    <ProtectedRoute allow={['student']}>
                        <StudentLayout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<StudentMyProject />} />
                <Route path="projects" element={<StudentMyProject />} />
                <Route path="assignments" element={<StudentAssignments />} />
                <Route path="assignments/:id" element={<StudentAssignmentDetail />} />
                <Route path="assignments/:assignmentId/proposal" element={<StudentProposalSubmit />} />
                <Route path="profile" element={<StudentProfile />} />
                <Route path="project" element={<StudentProjectsList />} />
                <Route path="project/:id" element={<StudentMyProjectDetail />} />
                <Route
                    path="chat"
                    element={
                        <div className="p-10 text-2xl font-bold text-slate-400">Group Chat (Coming Soon)</div>
                    }
                />
                <Route
                    path="submissions"
                    element={
                        <div className="p-10 text-2xl font-bold text-slate-400">Submissions (Coming Soon)</div>
                    }
                />
            </Route>

            <Route path="*" element={<div>404 - Not Found</div>} />
        </Routes>
    );
};

export default AppRoutes;
