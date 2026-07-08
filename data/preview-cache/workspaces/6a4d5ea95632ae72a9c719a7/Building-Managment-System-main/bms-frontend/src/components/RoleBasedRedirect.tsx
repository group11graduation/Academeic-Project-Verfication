import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

export function RoleBasedRedirect() {
  const [redirectPath, setRedirectPath] = useState<string>("/login");

  useEffect(() => {
    const userString = localStorage.getItem("user");
    if (userString) {
      try {
        const user = JSON.parse(userString);
        const role = user?.role?.toUpperCase();
        
        switch (role) {
          case "SUPER_ADMIN":
            setRedirectPath("/dashboard");
            break;
          case "MANAGER":
            setRedirectPath("/manDash");
            break;
          case "SUB_MANAGER":
            setRedirectPath("/manDash");
            break;
          default:
            setRedirectPath("/dashboard");
        }
      } catch (error) {
        setRedirectPath("/login");
      }
    } else {
      setRedirectPath("/login");
    }
  }, []);

  return <Navigate to={redirectPath} replace />;
}
