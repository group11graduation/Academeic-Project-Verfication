import { api } from "./client";

const API_URL = "/api/admin";

// Helper to check if user is authenticated
const checkAuth = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("Not authenticated. Please login first.");
  }
  return token;
};

// Use these exact names for exports
export const getAllManagers = () => {
  checkAuth();
  return api.get(`${API_URL}/managers`).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

export const getAdminPersons = () => {
  checkAuth();
  return api.get(`${API_URL}/admin-persons-for-select`).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

// --- ADMIN PERSON APIS ---
export const getAllAdminPersons = () => {
  checkAuth();
  return api.get(`${API_URL}/admin-persons`).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

export const createAdminPerson = (data: any) => {
  checkAuth();
  return api.post(`${API_URL}/admin-person`, data).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

export const updateAdminPerson = (id: string, data: any) => {
  checkAuth();
  return api.put(`${API_URL}/admin-person/${id}`, data).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

export const deleteAdminPerson = (id: string) => {
  checkAuth();
  return api.delete(`${API_URL}/admin-person/${id}`).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

export const createManager = (data: any) => {
  checkAuth();
  return api.post(`${API_URL}/create-manager`, data).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

export const updateManager = (id: string, data: any) => {
  checkAuth();
  return api.put(`${API_URL}/manager/${id}`, data).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

export const deleteManager = (id: string) => {
  checkAuth();
  return api.delete(`${API_URL}/manager/${id}`).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

// --- BUILDING APIS ---
export const getAllBuildings = () => {
  checkAuth();
  return api.get(`${API_URL}/buildings`).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

export const createBuilding = (data: any) => {
  checkAuth();
  return api.post(`${API_URL}/create-building`, data).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

export const updateBuilding = (id: string, data: any) => {
  checkAuth();
  return api.put(`${API_URL}/building/${id}`, data).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

export const deleteBuilding = (id: string) => {
  checkAuth();
  return api.delete(`${API_URL}/building/${id}`).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

// --- PAYMENT APIS ---
export const getAllPayments = () => {
  checkAuth();
  return api.get(`${API_URL}/payments`).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

export const getPaymentsByBuilding = (buildingId: string) => {
  checkAuth();
  return api.get(`${API_URL}/payments/building/${buildingId}`).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

export const getOverduePayments = () => {
  checkAuth();
  return api.get(`${API_URL}/payments/overdue`).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

export const getPaymentStats = () => {
  checkAuth();
  return api.get(`${API_URL}/payments/stats`).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

export const upsertPayment = (data: any) => {
  checkAuth();
  return api.post(`${API_URL}/payments`, data).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

export const markPaymentAsPaid = (id: string, notes?: string) => {
  checkAuth();
  return api.put(`${API_URL}/payments/${id}/paid`, { notes }).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

// --- BUILDING APPROVAL APIS ---
export const getPendingBuildingApprovals = () => {
  checkAuth();
  return api.get(`${API_URL}/building-approvals`).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};

export const approveBuildingCreation = (id: string, status: "APPROVED" | "REJECTED", reason?: string) => {
  checkAuth();
  return api.patch(`${API_URL}/building-approvals/${id}/approve`, { status, reason }).then(r => r.data.data).catch(err => {
    if (err.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    throw err;
  });
};
