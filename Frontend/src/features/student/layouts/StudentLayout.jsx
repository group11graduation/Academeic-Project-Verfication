import { Outlet } from 'react-router-dom';

const StudentLayout = () => {
    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            <main className="w-full max-w-[1600px] mx-auto overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
};

export default StudentLayout;

