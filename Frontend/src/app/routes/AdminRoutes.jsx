import { Routes, Route } from 'react-router-dom';
import AdminLayout from '../../features/admin/layouts/AdminLayout';
import AdminDashboard from '../../features/admin/pages/AdminDashboard';
import AdminTeachers from '../../features/admin/pages/AdminTeachers';
import AdminAddTeacher from '../../features/admin/pages/AdminAddTeacher';
import AdminEditTeacher from '../../features/admin/pages/AdminEditTeacher';
import AdminTeacherProfile from '../../features/admin/pages/AdminTeacherProfile';
import AdminStudents from '../../features/admin/pages/AdminStudents';
import AdminStudentDetail from '../../features/admin/pages/AdminStudentDetail';
import AdminAddStudent from '../../features/admin/pages/AdminAddStudent';
import AdminStudentImport from '../../features/admin/pages/AdminStudentImport';
import AdminClasses from '../../features/admin/pages/AdminClasses';
import AdminClassDetail from '../../features/admin/pages/AdminClassDetail';
import AdminAddClass from '../../features/admin/pages/AdminAddClass';
import AdminAdmins from '../../features/admin/pages/AdminAdmins';
import AdminAddAdmin from '../../features/admin/pages/AdminAddAdmin';
import AdminAdminDetail from '../../features/admin/pages/AdminAdminDetail';
import AdminSubjects from '../../features/admin/pages/AdminSubjects';
import AdminSemesters from '../../features/admin/pages/AdminSemesters';
import AdminImportExport from '../../features/admin/pages/AdminImportExport';

const AdminRoutes = () => {
    return (
        <Routes>
            {/* This component is already mounted at `/admin/*` from AppRoutes, so routes here should be relative. */}
            <Route element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="admins/new" element={<AdminAddAdmin />} />
                <Route path="admins/:id" element={<AdminAdminDetail />} />
                <Route path="admins" element={<AdminAdmins />} />
                <Route path="teachers" element={<AdminTeachers />} />
                <Route path="teachers/new" element={<AdminAddTeacher />} />
                <Route path="teachers/:id" element={<AdminTeacherProfile />} />
                <Route path="teachers/:id/edit" element={<AdminEditTeacher />} />
                <Route path="students">
                    <Route index element={<AdminStudents />} />
                    <Route path="new" element={<AdminAddStudent />} />
                    <Route path="import" element={<AdminStudentImport />} />
                    <Route path=":id" element={<AdminStudentDetail />} />
                </Route>
                {/* Future Admin Routes can go here */}

                <Route path="classes">
                    <Route index element={<AdminClasses />} />
                    <Route path=":id" element={<AdminClassDetail />} />
                    <Route path="new" element={<AdminAddClass />} />
                </Route>

                <Route path="subjects" element={<AdminSubjects />} />
                <Route path="semesters" element={<AdminSemesters />} />
                <Route path="import-export" element={<AdminImportExport />} />
            </Route>
        </Routes>
    );
};

export default AdminRoutes;
