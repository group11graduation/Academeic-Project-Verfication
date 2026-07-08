import { api } from "./client";

export { api };

export const loginRequest = async (data: any) => {
  const res = await api.post("/api/auth/login", data);
  return res.data;
};
