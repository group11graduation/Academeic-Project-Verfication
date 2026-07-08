// import { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { loginRequest } from "../api/auth.api"; // <-- your backend API
// import { toast } from "sonner";

// export function Login() {
//   const navigate = useNavigate();
//   const [loading, setLoading] = useState(false);

//   const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);

//     const form = e.currentTarget;
//     const email = (form.elements.namedItem("email") as HTMLInputElement).value;
//     const password = (form.elements.namedItem("password") as HTMLInputElement).value;

//     // try {
//     //   const res = await loginRequest({ email, password });

//     //   // store token
//     //   localStorage.setItem("token", res.token);
//     //   localStorage.setItem("user", JSON.stringify(res.user));

//     //   toast.success("Login successful");
//     //   navigate("/dashboard");
//     // } catch (error) {
//     //   toast.error("Invalid email or password");
//     // } finally {
//     //   setLoading(false);
//     // }


//     // Inside your handleSubmit function, replace navigate("/dashboard") with this:
// try {
//   const res = await loginRequest({ email, password });

//   // 1. Store data
//   localStorage.setItem("token", res.token);
//   localStorage.setItem("user", JSON.stringify(res.user));

//   toast.success(`Welcome back, ${res.user.name}`);

//   // 2. Role-Based Navigation
//   const role = res.user.role; // Ensure your backend returns 'ADMIN', 'MANAGER', or 'SUB_MANAGER'

//   switch (role) {
//     case "SUPER_ADMIN":
//       navigate("/dashboard");
//       break;
//     case "MANAGER":
//       navigate("/manDash");
//       break;
//     case "SUB_MANAGER":
//       navigate("/manDash");
//       break;
//     default:
//       navigate("/dashboard"); // Fallback
//   }
// } catch (error) {
//   toast.error("Invalid email or password");
// }
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br 
//       from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">

//       <div className="w-full max-w-md">
//         <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          
//           {/* Title */}
//           <div className="text-center mb-8">
//             <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
//               Building Management System
//             </h1>
//             <p className="text-gray-600 dark:text-gray-400">
//               Sign in to access your dashboard
//             </p>
//           </div>

//           {/* Form */}
//           <form onSubmit={handleSubmit} className="space-y-5">
//             <div>
//               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//                 Email
//               </label>
//               <input
//                 name="email"
//                 type="email"
//                 required
//                 placeholder="admin@example.com"
//                 className="w-full rounded-xl border border-gray-300 dark:border-gray-700
//                   bg-white dark:bg-gray-900 px-4 py-3
//                   text-gray-900 dark:text-white
//                   focus:outline-none focus:ring-2 focus:ring-blue-500"
//               />
//             </div>

//             <div>
//               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//                 Password
//               </label>
//               <input
//                 name="password"
//                 type="password"
//                 required
//                 placeholder="••••••••"
//                 className="w-full rounded-xl border border-gray-300 dark:border-gray-700
//                   bg-white dark:bg-gray-900 px-4 py-3
//                   text-gray-900 dark:text-white
//                   focus:outline-none focus:ring-2 focus:ring-blue-500"
//               />
//             </div>

//             <button
//               type="submit"
//               disabled={loading}
//               className="w-full rounded-xl bg-blue-600 hover:bg-blue-700
//                 text-white font-semibold py-3 transition
//                 disabled:opacity-50 disabled:cursor-not-allowed"
//             >
//               {loading ? "Signing in..." : "Sign In"}
//             </button>
//           </form>

//         </div>
//       </div>
//     </div>
//   );
// }




import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loginRequest } from "../api/auth.api"; 
import { toast } from "sonner";
import { EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

export function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [bgImageUrl, setBgImageUrl] = useState("/assets/images/login-bg.jpg");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Try to load the background image and logo
  useEffect(() => {
    // Load background image
    const img = new Image();
    img.onload = () => {
      setBgImageUrl("/assets/images/login-bg.jpg");
    };
    img.onerror = () => {
      setBgImageUrl(""); // Will show gradient only
    };
    img.src = "/assets/images/login-bg.jpg";

    // Try to load logo with multiple possible names
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
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    try {
      const res = await loginRequest({ email, password });

      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));

      // Dispatch event to notify ThemeContext of user change
      window.dispatchEvent(new Event('userChanged'));

      toast.success(`Welcome back, ${res.user.name}`);

      const role = res.user.role; 

      switch (role) {
        case "SUPER_ADMIN":
          navigate("/dashboard");
          break;
        case "MANAGER":
          navigate("/manDash");
          break;
        case "SUB_MANAGER":
          navigate("/manDash");
          break;
        default:
          navigate("/dashboard");
      }
    } catch (error: any) {
      // Handle rate limiting (429) errors
      if (error.response?.status === 429) {
        const retryAfter = error.response?.headers?.['retry-after'] || error.response?.headers?.['x-ratelimit-reset'];
        const message = error.response?.data?.message || "Too many login attempts. Please wait a moment and try again.";
        toast.error(message, {
          duration: 5000,
          description: retryAfter ? `Please try again after ${retryAfter} seconds.` : undefined
        });
      } else if (error.response?.status === 400 || error.response?.status === 401) {
        toast.error(error.response?.data?.message || "Invalid email or password");
      } else {
        toast.error("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/* Background Image Layer */}
        <div 
          className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(/assets/images/login-bg.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        ></div>
        {/* Overlay - Light overlay for simpler background */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/40"></div>
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-[#161b22]/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-700/50 dark:border-gray-600/50 rounded-2xl shadow-2xl px-8 pt-2 pb-8">
          
          {/* Sky Property Branding */}
          <div className="text-center mb-6 -mt-1">
            <div className="flex justify-center mb-0">
              <div className="w-full h-32 flex items-center justify-center">
                {logoUrl ? (
                  <img 
                    src={logoUrl} 
                    alt="Sky Property Logo"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-xl font-black">
                    SP
                  </div>
                )}
              </div>
            </div>
            <h1 className="text-2xl font-black text-white dark:text-gray-100 tracking-tight mt-0 mb-1">
              Sky Property
            </h1>
            <p className="text-gray-400 dark:text-gray-300 text-xs font-medium uppercase tracking-wider">
              Building Management System
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <div className="h-px w-8 bg-gray-700"></div>
              <ShieldCheckIcon className="w-3.5 h-3.5 text-blue-500" />
              <div className="h-px w-8 bg-gray-700"></div>
            </div>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                <EnvelopeIcon className="w-3.5 h-3.5" />
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <EnvelopeIcon className="h-4 w-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="name@company.com"
                  className="w-full bg-[#0d1117] dark:bg-gray-800 border border-gray-700 dark:border-gray-600 text-white dark:text-gray-200 text-sm rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all placeholder:text-gray-600 dark:placeholder:text-gray-500"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <LockClosedIcon className="w-3.5 h-3.5" />
                  Password
                </label>
                <button 
                  type="button" 
                  className="text-[10px] font-bold text-blue-500 hover:text-blue-400 transition-colors uppercase"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-4 w-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  className="w-full bg-[#0d1117] dark:bg-gray-800 border border-gray-700 dark:border-gray-600 text-white dark:text-gray-200 text-sm rounded-lg py-2.5 pl-10 pr-10 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all placeholder:text-gray-600 dark:placeholder:text-gray-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center px-1">
              <input
                id="remember"
                type="checkbox"
                className="w-3.5 h-3.5 rounded border-gray-700 bg-[#0d1117] text-blue-600 focus:ring-blue-500 focus:ring-offset-[#161b22]"
              />
              <label htmlFor="remember" className="ml-2 text-xs font-medium text-gray-400 dark:text-gray-300">
                Remember this device
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
                  className="w-full bg-blue-600 dark:bg-blue-500 hover:bg-blue-500 dark:hover:bg-blue-400 text-white font-bold py-2.5 rounded-lg shadow-lg shadow-blue-600/20 dark:shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Footer Info */}
          <div className="mt-6 pt-5 border-t border-gray-700/50 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">
              New tenant? <button className="text-blue-500 dark:text-blue-400 hover:underline font-bold">Contact Administrator</button>
            </p>
          </div>
        </div>

        {/* Security Badge */}
          <div className="mt-4 flex items-center justify-center gap-2 text-[9px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
            <div className="h-[1px] w-6 bg-gray-800 dark:bg-gray-600"></div>
            <span className="flex items-center gap-1">
              <ShieldCheckIcon className="w-3 h-3 text-green-500 dark:text-green-400" />
              Secure Connection
            </span>
            <div className="h-[1px] w-6 bg-gray-800 dark:bg-gray-600"></div>
          </div>
      </div>
    </div>
  );
}
