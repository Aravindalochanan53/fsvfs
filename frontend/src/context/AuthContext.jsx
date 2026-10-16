import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);

  const logout = useCallback(() => {
    if (sessionStorage.getItem("kec_token")) {
      api.logout().catch(() => { /* Local sign-out still works during a network outage. */ });
    }
    sessionStorage.removeItem("kec_token");
    sessionStorage.removeItem("kec_role");
    setRole(null);
    setUser(null);
    setNetworkError(false);
  }, []);

  const login = useCallback((token, userRole, userData) => {
    sessionStorage.setItem("kec_token", token);
    sessionStorage.setItem("kec_role", userRole);
    setRole(userRole);
    setUser(userData);
    setNetworkError(false);
  }, []);

  useEffect(() => {
    // Require an explicit login on every fresh app load. Stored credentials
    // are only used by API requests during this mounted application session.
    logout();
    setLoading(false);
  }, [logout]);

  useEffect(() => {
    window.addEventListener('kec-session-expired', logout);
    return () => window.removeEventListener('kec-session-expired', logout);
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: !!user,
        loading,
        networkError,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
