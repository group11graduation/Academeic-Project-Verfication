import axios from "axios";

export const api = axios.create({
  baseURL: "http://localhost:8761/api", // Note: auth.api.ts had /api appended, so let's stick to that convention or not?
  // Most routes are /api/...
  // If I set baseURL to .../api, then requests should be /auth/login, /dashboard/stats
  // But other files use /api/buildings...
  // Let's use http://localhost:8761 and include /api in requests, OR use /api in baseURL and remove it from requests.
  // The existing code has /api/ prefix in requests.
  // So baseURL should be http://localhost:8761
});

// Update baseURL to match usage
api.defaults.baseURL = "http://localhost:8761";

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 (Unauthorized) - redirect to login
    if (error.response?.status === 401) {
      // Clear auth data
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Dispatch event to notify ThemeContext of user change
      window.dispatchEvent(new Event('userChanged'));
      
      // Redirect to login if not already there
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    // Handle 429 (Too Many Requests) - don't redirect, just let the component handle it
    // The error will be passed to the component for user-friendly messaging
    
    return Promise.reject(error);
  }
);
