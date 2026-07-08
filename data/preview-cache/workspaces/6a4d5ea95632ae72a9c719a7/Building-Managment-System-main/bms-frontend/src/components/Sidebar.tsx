// import React, { useEffect, useState } from "react";
// import { useLocation, Link, useNavigate } from "react-router-dom";
// import {
//   Squares2X2Icon,
//   BuildingOfficeIcon,
//   UserPlusIcon,
//   QueueListIcon,
//   HomeIcon,
//   UsersIcon,
//   ArrowLeftOnRectangleIcon,
//   ShieldCheckIcon,
//   ClipboardDocumentCheckIcon
// } from "@heroicons/react/24/outline";

// export function Sidebar() {
//   const location = useLocation();
//   const navigate = useNavigate();
//   const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

//   useEffect(() => {
//     const userString = localStorage.getItem("user");
//     if (userString) {
//       setUser(JSON.parse(userString));
//     }
//   }, []);

//   const handleLogout = () => {
//     localStorage.removeItem("token");
//     localStorage.removeItem("user");
//     navigate("/login");
//   };

//   // --- ROLE BASED NAVIGATION LOGIC ---
  
//   const getMenuItems = () => {
//     const role = user?.role?.toLowerCase();

//     // 1. SUPER ADMIN: High-level management
//     if (role === "super_admin") {
//       return [
//         { name: "Dashboard", icon: Squares2X2Icon, path: "/dashboard" },
//         { name: "Create Building", icon: BuildingOfficeIcon, path: "/create-building" },
//         { name: "Create Manager", icon: UserPlusIcon, path: "/create-manager" },
//         { name: "Buildings & Managers", icon: ShieldCheckIcon, path: "/build-overview" },
//          { name: "Report", icon: ShieldCheckIcon, path: "/adminReport" },
//        { name: "Profile", icon: ClipboardDocumentCheckIcon, path: "/profile" },

//       ];
//     }

//     // 2. MANAGER: Full operational control + Staff management
//     if (role === "manager") {
//       return [
//         { name: "Dashboard", icon: Squares2X2Icon, path: "/manDash" },
//         { name: "Create Sub-Manager", icon: UserPlusIcon, path: "/team" }, // Only for Manager
//         { name: "Floors", icon: QueueListIcon, path: "/manage-floors" },
//         { name: "Rooms", icon: HomeIcon, path: "/manage-rooms" },
//         { name: "Tenants/People", icon: UsersIcon, path: "/manage-people" },
//         { name: "Reports", icon: ClipboardDocumentCheckIcon, path: "/report" },
//         { name: "Profile", icon: ClipboardDocumentCheckIcon, path: "/profile" },
//       ];
//     }

//     // 3. SUB-MANAGER: Operations only (No staff management)
//     if (role === "sub_manager") {
//       return [
//         { name: "Dashboard", icon: Squares2X2Icon, path: "/manDash" },
//         { name: "Floors", icon: QueueListIcon, path: "/subF" },
//         { name: "Rooms", icon: HomeIcon, path: "/subR" },
//         { name: "Tenants/People", icon: UsersIcon, path: "/subP" },
//         { name: "Reports", icon: ClipboardDocumentCheckIcon, path: "/report" },
//       ];
//     }

//     return []; // Default empty
//   };

//   const menuItems = getMenuItems();

//   return (
//     <aside className="w-64 bg-[#1E3A4C] text-white flex flex-col h-screen sticky top-0 shrink-0">
//       {/* Profile Section */}
//       <div className="p-8 text-center border-b border-white/10">
//         <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-3 overflow-hidden border-2 border-white/20">
//           <img 
//             src={`https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=0D8ABC&color=fff`} 
//             alt="Profile" 
//           />
//         </div>
//         <h2 className="text-lg font-semibold leading-tight truncate">{user?.name}</h2>
//         <p className="text-[10px] text-orange-400 uppercase font-bold tracking-widest mt-1">
//           {user?.role?.replace("superadmin", "Super Admin").replace("submanager", "Sub-Manager")}
//         </p>
//       </div>

//       {/* Navigation Links */}
//       <nav className="flex-1 mt-6 pl-4 space-y-1">
//         {menuItems.map((item) => {
//           const isActive = location.pathname === item.path;
//           return (
//             <Link
//               key={item.name}
//               to={item.path}
//               className={`flex items-center gap-3 px-6 py-4 rounded-l-full transition-all duration-200 ${
//                 isActive 
//                   ? "bg-[#F0F5F9] text-[#1E3A4C] font-bold shadow-[-4px_0_10px_rgba(0,0,0,0.1)]" 
//                   : "text-gray-300 hover:text-white hover:bg-white/5"
//               }`}
//             >
//               <item.icon className={`h-5 w-5 ${isActive ? "text-[#1E3A4C]" : "text-gray-400"}`} />
//               <span>{item.name}</span>
//             </Link>
//           );
//         })}
//       </nav>

//       {/* Logout */}
//       <div className="p-6 border-t border-white/10">
//         <button 
//           onClick={handleLogout}
//           className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors w-full px-4"
//         >
//           <ArrowLeftOnRectangleIcon className="h-5 w-5" />
//           <span className="text-sm font-medium">Logout</span>
//         </button>
//       </div>
//     </aside>
//   );
// }


import React, { useEffect, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import {
  Squares2X2Icon,
  BuildingOfficeIcon,
  UserPlusIcon,
  QueueListIcon,
  HomeIcon,
  UsersIcon,
  ArrowLeftOnRectangleIcon,
  ShieldCheckIcon,
  ClipboardDocumentCheckIcon,
  BuildingOffice2Icon,
  CurrencyDollarIcon,
  EyeIcon,
  HomeModernIcon
} from "@heroicons/react/24/outline";

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<{ name: string; email: string; role: string; buildingLogo?: string } | null>(null);
  const [buildingInfo, setBuildingInfo] = useState<{ name: string; logo: string } | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const userString = localStorage.getItem("user");
    if (userString) {
      const userData = JSON.parse(userString);
      setUser(userData);
      
      // Fetch building info for managers and sub-managers
      if (userData && (userData.role === "MANAGER" || userData.role === "SUB_MANAGER")) {
        fetchBuildingInfo();
      }
      
      // Load logo for SUPER_ADMIN
      if (userData && userData.role === "SUPER_ADMIN") {
        loadLogo();
      }
    }

    // Listen for building changes
    const handleBuildingChange = () => {
      const userString = localStorage.getItem("user");
      if (userString) {
        const userData = JSON.parse(userString);
        if (userData && (userData.role === "MANAGER" || userData.role === "SUB_MANAGER")) {
          fetchBuildingInfo();
        }
      }
    };

    window.addEventListener('buildingChanged', handleBuildingChange);
    return () => window.removeEventListener('buildingChanged', handleBuildingChange);
  }, []);

  const loadLogo = () => {
    // Try to load logo with multiple possible names (same as Login page)
    const logoNames = [
      "sky-property-logo.png",
      "sky-property-logo.jpg",
      "sky-property-logo.svg",
      "logo.png",
      "logo.jpg",
      "logo.svg",
      "logo4.png",
      "sky-property.png",
      "sky-property.jpg"
    ];

    const tryLoadLogo = (index: number) => {
      if (index >= logoNames.length) return; // No logo found
      
      const logoImg = new Image();
      logoImg.onload = () => {
        setLogoUrl(`/assets/images/${logoNames[index]}`);
      };
      logoImg.onerror = () => {
        tryLoadLogo(index + 1); // Try next name
      };
      logoImg.src = `/assets/images/${logoNames[index]}`;
    };

    tryLoadLogo(0);
  };

  const fetchBuildingInfo = async () => {
    try {
      const reportsApi = await import("../api/reports.api");
      // Get selected building ID from localStorage
      const selectedBuildingId = localStorage.getItem("selectedBuildingId");
      const report = await reportsApi.getManagerReport(selectedBuildingId || undefined);
      if (report) {
        setBuildingInfo({
          name: report.brandingName || report.building || "Building",
          logo: report.brandingLogo || ""
        });
      }
    } catch (err) {
      console.error("Failed to load building info", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    // Dispatch event to notify ThemeContext of user change
    window.dispatchEvent(new Event('userChanged'));
    navigate("/login");
  };

  // Role-based menu items
  const getMenuItems = () => {
    const role = user?.role?.toUpperCase();
    
    // SUPER_ADMIN: High-level management
    if (role === "SUPER_ADMIN") {
      return [
    { name: "Dashboard", icon: Squares2X2Icon, path: "/dashboard" },
    { name: "Properties", icon: BuildingOfficeIcon, path: "/create-building" },
    { name: "Managers", icon: UserPlusIcon, path: "/create-manager" },
        { name: "Building Overview", icon: EyeIcon, path: "/build-overview" },
        { name: "Payment Tracking", icon: CurrencyDollarIcon, path: "/payments" },
        { name: "Building Approvals", icon: ShieldCheckIcon, path: "/building-approvals" },
    { name: "Analytics", icon: ClipboardDocumentCheckIcon, path: "/adminReport" },
  ];
    }
    
    // MANAGER: Full operational control + Staff management
    if (role === "MANAGER") {
      return [
        { name: "Dashboard", icon: Squares2X2Icon, path: "/manDash" },
        { name: "Teams", icon: UserPlusIcon, path: "/team" },
        { name: "Floors", icon: QueueListIcon, path: "/manage-floors" },
        { name: "Rooms", icon: HomeIcon, path: "/manage-rooms" },
        { name: "Apartments", icon: HomeModernIcon, path: "/manage-apartments" },
        { name: "Tenants/People", icon: UsersIcon, path: "/manage-people" },
        { name: "Payment Tracking", icon: CurrencyDollarIcon, path: "/manager-payments" },
        { name: "Approvals", icon: ShieldCheckIcon, path: "/approvals" },
        { name: "Reports", icon: ClipboardDocumentCheckIcon, path: "/report" },
        { name: "Profile", icon: ClipboardDocumentCheckIcon, path: "/profile" },
      ];
    }
    
    // SUB_MANAGER: Operations only (No staff management)
    if (role === "SUB_MANAGER") {
      return [
        { name: "Dashboard", icon: Squares2X2Icon, path: "/manDash" },
        { name: "Floors", icon: QueueListIcon, path: "/subF" },
        { name: "Rooms", icon: HomeIcon, path: "/subR" },
        { name: "Tenants/People", icon: UsersIcon, path: "/subP" },
        { name: "Reports", icon: ClipboardDocumentCheckIcon, path: "/report" },
        { name: "Profile", icon: ClipboardDocumentCheckIcon, path: "/profile" },
      ];
    }
    
    return []; // Default empty
  };

  const menuItems = getMenuItems();

  return (
    <aside className="w-72 bg-[#1E3A4C] dark:bg-gray-900 text-white flex flex-col h-screen sticky top-0 shrink-0">
      
      {/* 1. BRANDING SECTION */}
      <div className="px-8 pt-10 pb-6 flex items-center gap-3">
        {user?.role === "MANAGER" || user?.role === "SUB_MANAGER" ? (
          <>
            {buildingInfo?.logo ? (
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/20 shadow-inner flex-shrink-0">
                <img src={buildingInfo.logo} alt={buildingInfo.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10 shadow-inner">
                <BuildingOffice2Icon className="h-6 w-6 text-white" />
              </div>
            )}
            <div className="overflow-hidden">
              <h1 className="text-xl font-black tracking-tighter leading-none truncate">
                {buildingInfo?.name || "Building"}
              </h1>
            </div>
          </>
        ) : (
          <>
            {logoUrl ? (
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/20 shadow-inner flex-shrink-0">
                <img src={logoUrl} alt="Sky Property Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10 shadow-inner">
          <BuildingOffice2Icon className="h-6 w-6 text-white" />
        </div>
            )}
        <div>
          <h1 className="text-xl font-black tracking-tighter leading-none italic">
            SKY <span className="text-white/40">PROPERTY</span>
          </h1>
        </div>
          </>
        )}
      </div>

      {/* 2. INTEGRATED USER PROFILE */}
      <div className="px-8 pb-10 flex items-center gap-3">
        <div className="relative">
          {user?.buildingLogo ? (
            <img 
              className="w-10 h-10 rounded-xl border border-white/20 p-0.5 object-cover"
              src={user.buildingLogo} 
              alt="Avatar" 
            />
          ) : (
          <img 
            className="w-10 h-10 rounded-xl border border-white/20 p-0.5 object-cover"
            src={`https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=F0F5F9&color=1E3A4C&bold=true&rounded=true`} 
            alt="Avatar" 
          />
          )}
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 dark:bg-emerald-400 border-2 border-[#1E3A4C] dark:border-gray-900 rounded-full"></div>
        </div>
        <div className="overflow-hidden">
          <h2 className="text-sm font-bold truncate leading-none">{user?.name}</h2>
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">
            {user?.role?.replace("_", " ")}
          </p>
        </div>
      </div>

      {/* 3. NAVIGATION (The Mixing Logic) */}
      <nav className="flex-1 pl-4 space-y-1 overflow-y-auto scrollbar-hide">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`group relative flex items-center gap-4 px-6 py-4 rounded-l-[2.5rem] transition-all duration-300 ${
                isActive 
                  ? "bg-[#F8FAFC] dark:bg-gray-800 text-[#1E3A4C] dark:text-white font-bold shadow-[-10px_0_15px_rgba(0,0,0,0.1)] dark:shadow-[-10px_0_15px_rgba(0,0,0,0.3)]" 
                  : "text-white/50 dark:text-gray-300 hover:text-white dark:hover:text-white hover:bg-white/5 dark:hover:bg-white/10"
              }`}
            >
              {/* Top Inverted Corner - The "Mix" effect */}
              {isActive && (
                <>
                  <div className="absolute -top-10 right-0 w-10 h-10 bg-[#F8FAFC] dark:bg-gray-800 before:content-[''] before:absolute before:inset-0 before:bg-[#1E3A4C] dark:before:bg-gray-900 before:rounded-br-[2.5rem]" />
                </>
              )}
              
              <item.icon className={`h-5 w-5 ${isActive ? "text-[#1E3A4C] dark:text-white" : "text-white/30 dark:text-gray-400 group-hover:text-white transition-colors"}`} />
              <span className="text-sm tracking-tight">{item.name}</span>
              
              {/* Bottom Inverted Corner - The "Mix" effect */}
              {isActive && (
                <div className="absolute -bottom-10 right-0 w-10 h-10 bg-[#F8FAFC] dark:bg-gray-800 before:content-[''] before:absolute before:inset-0 before:bg-[#1E3A4C] dark:before:bg-gray-900 before:rounded-tr-[2.5rem]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* 4. THEME TOGGLE & LOGOUT SECTION */}
      <div className="p-8 mt-auto border-t border-white/5 space-y-4">
        <div className="flex justify-center">
          <ThemeToggle />
        </div>
        <button 
          onClick={handleLogout} 
          className="flex items-center gap-3 text-white/30 hover:text-red-400 transition-all font-bold text-sm group"
        >
          <ArrowLeftOnRectangleIcon className="h-5 w-5 group-hover:-translate-x-1 transition-transform" /> 
          <span>Logout Session</span>
        </button>
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </aside>
  );
}