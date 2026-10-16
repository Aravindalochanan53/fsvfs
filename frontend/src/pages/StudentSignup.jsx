import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { 
  GraduationCap, 
  AlertCircle, 
  ArrowRight
} from "lucide-react";

const DEPARTMENTS = [
  "CSE", "IT", "ECE", "EEE", "AIDS", "AIML", "MECH", "CIVIL",
  "AUTO", "CSD", "EIE", "MTS", "CHEM", "FT", "ARCH"
];

export default function StudentSignup({ setView }) {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    roll_number: "",
    student_name: "",
    password: "",
    confirm_password: "",
    department: "CSE",
    year_section: "III - A",
    semester: 6,
    duration: "30 Days",
    start_date: "",
    end_date: "",
    company_name: "",
    company_location: "11.2742,77.6070",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [workplaces, setWorkplaces] = useState([]);
  useEffect(() => {
    let active = true;
    api.getRegistrationWorkplaces().then((data) => {
      if (active) setWorkplaces(data.workplaces || []);
    }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirm_password) {
      setError("Passwords do not match!");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await api.studentSignup(formData);
      login(res.access_token, "student", res.user);
      setView("student-home");
    } catch (err) {
      setError(err.message || "Failed to register. Please check your inputs.");
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
        maxWidth: 820,
        background: "#ffffff",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-xl)",
        padding: "44px 38px",
        boxShadow: "0 10px 35px -5px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.04)"
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
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
          <h2 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-primary)" }}>
            Student Registration
          </h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", marginTop: 4 }}>
            Kongu Engineering College · Internship Management Portal
          </p>
        </div>

        {error && (
          <div style={{
            background: "var(--danger-dim)",
            border: "1px solid #fecaca",
            color: "var(--danger)",
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            fontSize: "0.85rem",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-grid-2">
            <div className="form-group">
              <label>Roll Number (Kongu Reg No) *</label>
              <input
                className="form-input mono"
                name="roll_number"
                placeholder="e.g. 21CSR099"
                value={formData.roll_number}
                onChange={(e) => setFormData({ ...formData, roll_number: e.target.value.toUpperCase() })}
                required
              />
            </div>

            <div className="form-group">
              <label>Student Full Name *</label>
              <input
                className="form-input"
                name="student_name"
                placeholder="e.g. Aarav Krishnan"
                value={formData.student_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>New Password *</label>
              <input
                type="password"
                className="form-input"
                name="password"
                placeholder="Enter secure password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Confirm Password *</label>
              <input
                type="password"
                className="form-input"
                name="confirm_password"
                placeholder="Re-enter password"
                value={formData.confirm_password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Department *</label>
              <select
                className="form-select"
                name="department"
                value={formData.department}
                onChange={handleChange}
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
              <label>Year &amp; Section *</label>
              <input
                className="form-input"
                name="year_section"
                placeholder="e.g. III - A"
                value={formData.year_section}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Semester *</label>
              <select
                className="form-select"
                name="semester"
                value={formData.semester}
                onChange={handleChange}
                required
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Internship Duration *</label>
              <input
                className="form-input"
                name="duration"
                placeholder="e.g. 30 Days / 60 Days"
                value={formData.duration}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Start Date *</label>
              <input
                type="date"
                className="form-input"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>End Date *</label>
              <input
                type="date"
                className="form-input"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="registered-workplace">Registered workplace *</label>
              <select
                id="registered-workplace"
                className="form-select"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                required
              >
                <option value="">Select your internship company</option>
                {workplaces.map((company) => <option key={company.name} value={company.name}>{company.name}</option>)}
              </select>
              <small>Your workplace coordinates are managed by the institution. If your company is missing, contact your coordinator.</small>
            </div>

          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 24, padding: 14, fontSize: "0.95rem" }}
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Create Student Account"}
            <ArrowRight size={18} />
          </button>
        </form>

        <div style={{
          textAlign: "center",
          marginTop: 24,
          fontSize: "0.85rem",
          color: "var(--text-dim)"
        }}>
          Already registered?{" "}
          <span
            style={{ color: "var(--green-primary)", fontWeight: 700, cursor: "pointer" }}
            onClick={() => setView("student-login")}
          >
            Sign In
          </span>
        </div>
      </div>
    </div>
  );
}
