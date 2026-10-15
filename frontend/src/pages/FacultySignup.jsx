import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { Briefcase, AlertCircle, ArrowRight } from "lucide-react";

const DEPARTMENTS = [
  "CSE", "IT", "ECE", "EEE", "AIDS", "AIML", "MECH", "CIVIL",
  "AUTO", "CSD", "EIE", "MTS", "CHEM", "FT", "ARCH"
];

export default function FacultySignup({ setView }) {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    roll_number: "",
    student_name: "", // Faculty name
    password: "",
    confirm_password: "",
    department: "CSE"
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirm_password) {
      setError("Passwords do not match!");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { roll_number, student_name, ...fields } = formData;
      const res = await api.facultySignup({
        ...fields,
        faculty_id: roll_number.trim(),
        faculty_name: student_name.trim(),
      });
      login(res.access_token, res.role, res.user);
      setView("faculty-home");
    } catch (err) {
      setError(err.message || "Failed to register faculty account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px"
    }}>
      <div className="auth-panel" style={{
        width: "100%",
        maxWidth: 500,
        background: "#ffffff",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-xl)",
        padding: "40px 34px",
        boxShadow: "0 10px 35px -5px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.04)"
      }}>
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
            <Briefcase size={28} />
          </div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)" }}>
            Faculty Registration
          </h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.86rem", marginTop: 4 }}>
            Create faculty mentor profile for internship administration
          </p>
        </div>

        {error && (
          <div style={{
            background: "var(--danger-dim)",
            border: "1px solid #fecaca",
            color: "var(--danger)",
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem",
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
            <label>Kongu Faculty ID *</label>
            <input
              className="form-input mono"
              placeholder="e.g. KECFAC108"
              value={formData.roll_number}
              onChange={(e) => setFormData({ ...formData, roll_number: e.target.value.toUpperCase() })}
              required
            />
          </div>

          <div className="form-group">
            <label>Faculty Full Name (with Title) *</label>
            <input
              className="form-input"
              placeholder="e.g. Dr. K. Saravanan"
              value={formData.student_name}
              onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Department *</label>
            <select
              className="form-select"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              required
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  Department of {d}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Password *</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Confirm Password *</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={formData.confirm_password}
              onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 14, padding: 13, fontSize: "0.95rem" }}
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Faculty Account"}
            <ArrowRight size={18} />
          </button>
        </form>

        <div style={{
          textAlign: "center",
          marginTop: 20,
          fontSize: "0.85rem",
          color: "var(--text-dim)"
        }}>
          Already registered?{" "}
          <span
            style={{ color: "var(--green-primary)", fontWeight: 700, cursor: "pointer" }}
            onClick={() => setView("faculty-login")}
          >
            Sign In
          </span>
        </div>
      </div>
    </div>
  );
}
