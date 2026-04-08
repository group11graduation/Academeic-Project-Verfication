import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/authContext';

/**
 * Guards children by JWT-backed roles from auth context.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {string[]} props.allow - Any of these roles grants access (also checks user.roles[])
 * @param {string} [props.redirectTo='/login'] - Where to send unauthenticated users
 */
const ProtectedRoute = ({ children, allow, redirectTo = '/login' }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F8FAFB] dark:bg-[#0F172A]">
                <div className="h-10 w-10 border-4 border-[#1D68E3] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to={redirectTo} state={{ from: location }} replace />;
    }

    const roles = user.roles?.length ? user.roles : user.role ? [user.role] : [];
    const ok = allow.some((r) => roles.includes(r));
    if (!ok) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default ProtectedRoute;
