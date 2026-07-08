"use client";
import { useNavigate } from "react-router-dom";
export function SignOutButton() {
  const navigate = useNavigate();

  const handleSignOut = () => {
    // Remove token or auth info from localStorage
    localStorage.removeItem("token"); // adjust key if different
    localStorage.removeItem("user"); // optional: remove user info
    // Dispatch event to notify ThemeContext of user change
    window.dispatchEvent(new Event('userChanged'));
    // Redirect to login page
    navigate("/login");
  };

  // Optionally hide button if user not logged in
  const isAuthenticated = !!localStorage.getItem("token");
  if (!isAuthenticated) return null;

  return (
    <button
      className="px-4 py-2 rounded bg-white text-secondary border border-gray-200 font-semibold hover:bg-gray-50 hover:text-secondary-hover transition-colors shadow-sm hover:shadow"
      onClick={handleSignOut}
    >
      Sign out
    </button>
  );
}
