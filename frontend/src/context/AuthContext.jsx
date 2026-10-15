import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("kec_token");
    const storedRole = localStorage.getItem("kec_role");

    if (token && storedRole) {
      api.getMe()
        .then((res) => {
          setUser(res.user);
          setRole(res.role);
          setNetworkError(false);
        })
        .catch((err) => {
          // Only clear auth if the error is a genuine 401/403 (not a network outage)
          const message = err?.message || "";
          const isAuthFailure =
            message.includes("401") ||
            message.includes("403") ||
            message.includes("Invalid or expired") ||
            message.includes("Authentication token required") ||
            message.includes("User not found");

          if (isAuthFailure) {
            // Token is invalid or expired — clear session cleanly
            logout();
          } else {
            // Network/server unreachable — preserve stored role so user can retry
            setRole(storedRole);
            setNetworkError(true);
          }
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userRole, userData) => {
    localStorage.setItem("kec_token", token);
    localStorage.setItem("kec_role", userRole);
    setRole(userRole);
    setUser(userData);
    setNetworkError(false);
  };

  const logout = () => {
    localStorage.removeItem("kec_token");
    localStorage.removeItem("kec_role");
    setUser(null);
    setRole(null);
    setNetworkError(false);
  };

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
