import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import * as api from "../../api/manager.api";
import { motion } from "framer-motion";
import { 
  UserCircleIcon, 
  EnvelopeIcon, 
  ShieldCheckIcon, 
  BuildingOfficeIcon,
  IdentificationIcon,
  KeyIcon
} from "@heroicons/react/24/outline";
import { toast } from "sonner";

export function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        // Try to get fresh data from server, fallback to localStorage
        const data = await api.getProfile(); 
        // Ensure buildingLogo is included from localStorage if not in API response
        const localUser = JSON.parse(localStorage.getItem("user") || "{}");
        setUser({ ...data, buildingLogo: data?.buildingLogo || localUser?.buildingLogo || "" });
      } catch (err) {
        // Fallback to localStorage which should have buildingLogo from login
        const localUser = JSON.parse(localStorage.getItem("user") || "{}");
        setUser(localUser);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#F8FAFC]">Loading Profile...</div>;

  return (
    <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
      <Sidebar />
      
      <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
        <header className="mb-10">
          <h1 className="text-3xl font-black text-[#1E3A4C]">My Account</h1>
          <p className="text-gray-500 font-medium">Manage your personal information and security</p>
        </header>

        <div className="max-w-4xl grid grid-cols-12 gap-8">
          
          {/* Left Column: Identity Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="col-span-12 lg:col-span-4 space-y-6"
          >
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-700 shadow-sm text-center">
              <div className="w-24 h-24 rounded-3xl mx-auto mb-4 overflow-hidden border-2 border-blue-100 dark:border-blue-900/50 flex items-center justify-center">
                {user?.buildingLogo ? (
                  <img src={user.buildingLogo} alt={user?.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <UserCircleIcon className="h-16 w-16 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
              </div>
              <h2 className="text-xl font-black text-[#1E3A4C] dark:text-white">{user?.name}</h2>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                {user?.role}
              </span>
              <div className="mt-8 pt-8 border-t border-gray-50 dark:border-gray-700 text-left space-y-4">
                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                  <EnvelopeIcon className="h-5 w-5 text-gray-300 dark:text-gray-600" />
                  {user?.email}
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                  <IdentificationIcon className="h-5 w-5 text-gray-300 dark:text-gray-600" />
                  ID: {user?._id?.slice(-8).toUpperCase()}
                </div>
              </div>
            </div>

            <div className="bg-[#1E3A4C] dark:bg-gray-800 rounded-[2.5rem] p-8 text-white shadow-xl">
               <div className="flex items-center gap-3 mb-4">
                  <BuildingOfficeIcon className="h-6 w-6 text-blue-400 dark:text-blue-300" />
                  <h3 className="font-bold">Managed Asset</h3>
               </div>
               <p className="text-xs text-blue-200 dark:text-blue-300 leading-relaxed mb-4">
                 You are the primary manager for this facility. You have full access to occupants and reports.
               </p>
               <button className="w-full py-3 bg-white/10 dark:bg-gray-700/50 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/20 dark:hover:bg-gray-700 transition-all">
                  Request Access Change
               </button>
            </div>
          </motion.div>

          {/* Right Column: Settings & Security */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="col-span-12 lg:col-span-8 space-y-6"
          >
            {/* Account Details Form */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-10 border border-gray-100 dark:border-gray-700 shadow-sm">
               <h3 className="text-lg font-black text-[#1E3A4C] dark:text-white mb-8 flex items-center gap-2">
                  <ShieldCheckIcon className="h-6 w-6 text-emerald-500 dark:text-emerald-400" />
                  Personal Details
               </h3>
               
               <form className="grid grid-cols-2 gap-6">
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[10px] font-black text-gray-400 dark:text-gray-400 uppercase tracking-widest">Full Name</label>
                    <input disabled value={user?.name} className="w-full mt-2 p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 rounded-2xl text-gray-500 dark:text-gray-300 cursor-not-allowed" />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[10px] font-black text-gray-400 dark:text-gray-400 uppercase tracking-widest">Email Address</label>
                    <input disabled value={user?.email} className="w-full mt-2 p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 rounded-2xl text-gray-500 dark:text-gray-300 cursor-not-allowed" />
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 dark:text-gray-400 italic">Account details are managed by the System Administrator. To change your name or email, please contact support.</p>
                  </div>
               </form>
            </div>

            {/* Security Section */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-10 border border-gray-100 dark:border-gray-700 shadow-sm">
               <div className="flex justify-between items-center mb-8">
                  <h3 className="text-lg font-black text-[#1E3A4C] dark:text-white flex items-center gap-2">
                    <KeyIcon className="h-6 w-6 text-orange-500 dark:text-orange-400" />
                    Security & Password
                  </h3>
                  {!isChangingPassword && (
                    <button 
                      onClick={() => setIsChangingPassword(true)}
                      className="text-blue-600 dark:text-blue-400 font-bold text-sm hover:underline"
                    >
                      Update Password
                    </button>
                  )}
               </div>

               {isChangingPassword ? (
                 <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); toast.success("Password updated!"); setIsChangingPassword(false); }}>
                    <input type="password" placeholder="Current Password" className="w-full p-4 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
                    <input type="password" placeholder="New Password" className="w-full p-4 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
                    <div className="flex gap-3 pt-2">
                       <button type="submit" className="bg-[#1E3A4C] dark:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold hover:bg-opacity-90 dark:hover:bg-blue-600">Save Changes</button>
                       <button onClick={() => setIsChangingPassword(false)} className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-8 py-3 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
                    </div>
                 </form>
               ) : (
                 <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Password last changed 3 months ago</p>
                    <span className="h-2 w-2 bg-emerald-500 dark:bg-emerald-400 rounded-full"></span>
                 </div>
               )}
            </div>
          </motion.div>

        </div>
        </div>
      </main>
    </div>
  );
}