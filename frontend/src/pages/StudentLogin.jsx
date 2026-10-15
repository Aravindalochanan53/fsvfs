import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { GraduationCap, ArrowRight, Lock, User, AlertCircle, Sparkles } from "lucide-react";

export default function StudentLogin({ setView }) {
  const { login } = useAuth();
  const [rollNumber, setRollNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rollNumber || !password) {
      setError("Please fill in both roll number and password");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await api.studentLogin(rollNumber, password);
      login(res.access_token, "student", res.user);
      setView("student-home");
    } catch (err) {
      setError(err.message || "Failed to sign in. Please verify your roll number & password.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = () => {
    setRollNumber("21CSR001");
    setPassword("password123");
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "calc(100vh - 160px)",
      padding: "30px 20px"
    }}>
      <div className="auth-panel" style={{
        width: "100%",
        maxWidth: 450,
        background: "#ffffff",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-xl)",
        padding: "40px 32px",
        boxShadow: "0 10px 35px -5px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.04)"
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 50,
            height: 50,
            borderRadius: 14,
            background: "linear-gradient(135deg, var(--green-primary), var(--green-accent))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            margin: "0 auto 14px",
            boxShadow: "0 4px 14px rgba(21, 128, 61, 0.25)"
          }}>
            <GraduationCap size={28} />
          </div>
          <h2 style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-primary)" }}>
            Student Sign In
          </h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.86rem", marginTop: 4 }}>
            Access internship records, daily GPS logs &amp; reports
          </p>
        </div>

        {error && (
          <div style={{
            background: "var(--danger-dim)",
            border: "1px solid #fecaca",
            color: "var(--danger)",
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.82rem",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Roll Number (Kongu Reg No)</label>
            <div style={{ position: "relative" }}>
              <input
                className="form-input mono"
                style={{ paddingLeft: 40 }}
                placeholder="e.g. 21CSR001"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                required
              />
              <User
                size={16}
                color="var(--green-primary)"
                style={{ position: "absolute", left: 14, top: 14 }}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div style={{ position: "relative" }}>
              <input
                type="password"
                className="form-input"
                style={{ paddingLeft: 40 }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock
                size={16}
                color="var(--green-primary)"
                style={{ position: "absolute", left: 14, top: 14 }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 8, padding: 13, fontSize: "0.95rem" }}
            disabled={loading}
          >
            {loading ? "Verifying..." : "Sign In to Portal"}
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Quick Demo Autofill */}
        <button
          onClick={handleQuickDemo}
          style={{
            width: "100%",
            marginTop: 14,
            background: "#f0fdf4",
            border: "1.5px dashed #86efac",
            color: "var(--green-primary)",
            padding: "9px",
            borderRadius: "var(--radius-md)",
            fontSize: "0.82rem",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6
          }}
        >
          <Sparkles size={14} /> Auto-fill Demo Student (21CSR001)
        </button>

        {/* Footer Navigation */}
        <div style={{
          textAlign: "center",
          marginTop: 22,
          fontSize: "0.84rem",
          color: "var(--text-dim)"
        }}>
          Don't have an account?{" "}
          <span
            style={{ color: "var(--green-primary)", fontWeight: 700, cursor: "pointer" }}
            onClick={() => setView("student-signup")}
          >
            Register Here
          </span>
        </div>

        <div style={{
          textAlign: "center",
          marginTop: 10,
          fontSize: "0.82rem",
          color: "var(--text-muted)"
        }}>
          Faculty member?{" "}
          <span
            style={{ color: "var(--text-primary)", fontWeight: 600, cursor: "pointer" }}
            onClick={() => setView("faculty-login")}
          >
            Faculty Portal →
          </span>
        </div>
      </div>
    </div>
  );
}
