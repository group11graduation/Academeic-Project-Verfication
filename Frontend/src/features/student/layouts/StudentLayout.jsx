import { Outlet } from 'react-router-dom';

const StudentLayout = () => {
    return (
        <div className="min-h-screen bg-[#F8FAFB] flex flex-col">
            {/* Main Content Area */}
            <main className="flex-1 w-full max-w-[1600px] mx-auto overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
};

export default StudentLayout;

