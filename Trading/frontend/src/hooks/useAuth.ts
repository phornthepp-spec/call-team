import { useState, useCallback, useEffect } from "react";
import api from "../lib/api";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("user");
    if (token && userRaw) {
      try {
        return { user: JSON.parse(userRaw), isAuthenticated: true };
      } catch {
        return { user: null, isAuthenticated: false };
      }
    }
    return { user: null, isAuthenticated: false };
  });

  // Listen for storage changes (e.g., from other tabs or interceptor clearing)
  useEffect(() => {
    const handleStorage = () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setAuthState({ user: null, isAuthenticated: false });
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await api.post("/auth/login", { email, password });
      const { token, user } = res.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      setAuthState({ user, isAuthenticated: true });
      return { success: true };
    } catch (error: any) {
      const message =
        error.response?.data?.detail || "Login failed. Please try again.";
      return { success: false, message };
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      try {
        const res = await api.post("/auth/register", {
          email,
          password,
          name,
        });
        const { token, user } = res.data;
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        setAuthState({ user, isAuthenticated: true });
        return { success: true };
      } catch (error: any) {
        const message =
          error.response?.data?.detail ||
          "Registration failed. Please try again.";
        return { success: false, message };
      }
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setAuthState({ user: null, isAuthenticated: false });
  }, []);

  return {
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    login,
    register,
    logout,
  };
}
