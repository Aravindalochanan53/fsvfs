import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { 
  BarChart3, 
  Search, 
  Users,
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  X, 
  Filter, 
  Download, 
  Building2,
  Calendar,
  Image as ImageIcon,
  Lock
} from "lucide-react";

export default function ConsolidateDashboard({ setView }) {
  const { user, role } = useAuth();
  const isFaculty = ["faculty", "hod", "admin"].includes(role);
  const facultyDept = user?.department || "CSE";

  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState(isFaculty ? facultyDept : "ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFaculty) {
      setView("student-home");
      return;
    }
    loadSummary();
  }, [isFaculty, setView]);

  if (!isFaculty) return null;

  const loadSummary = async () => {
    try {
      setLoading(true);
      const res = await api.getConsolidateSummary();
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  const records = data?.records || [];
  const filtered = records.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.reg_no.toLowerCase().includes(search.toLowerCase()) ||
      r.company.toLowerCase().includes(search.toLowerCase());
    const matchesDept = isFaculty ? r.department === facultyDept : (deptFilter === "ALL" || r.department === deptFilter);
    return matchesSearch && matchesDept;
  });

  const departments = isFaculty ? [facultyDept] : ["ALL", ...new Set(records.map((r) => r.department))];

  return (
    <div className="app-container" style={{ padding: "30px 20px 60px" }}>
      {/* Hero Section */}
      <div style={{
        background: "linear-gradient(135deg, #ffffff, #f0fdf4)",
        border: "1.5px solid #bbf7d0",
        borderRadius: "var(--radius-xl)",
        padding: "36px 32px",
        textAlign: "center",
        marginBottom: 24,
        boxShadow: "var(--shadow-sm)"
      }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "var(--green-tint)",
          color: "var(--green-primary)",
          padding: "4px 14px",
          borderRadius: 9999,
          fontSize: "0.76rem",
          fontWeight: 700,
          marginBottom: 12,
          border: "1px solid #bbf7d0"
        }}>
          📊 Consolidated Academic Analytics
        </div>
        <h2 style={{ fontSize: "2.1rem", fontWeight: 800, color: "var(--text-primary)" }}>
          Consolidated Internship Dashboard
        </h2>
        <p style={{ color: "var(--text-dim)", fontSize: "0.95rem", maxWidth: 650, margin: "8px auto 0" }}>
          {isFaculty
            ? `Review and verify internship progress, GPS attendance ratios, and uploaded documents for Department of ${facultyDept}.`
            : "Track, verify and audit student internship progress, GPS attendance ratios, and documentation statuses across Kongu Engineering College."}
        </p>
      </div>

      {/* Faculty Notice Banner */}
      {isFaculty && (
        <div style={{
          background: "var(--green-tint)",
          border: "1.5px solid #86efac",
          borderRadius: "var(--radius-md)",
          padding: "12px 18px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "var(--green-primary)",
          fontSize: "0.85rem",
          fontWeight: 600
        }}>
          <Lock size={16} />
          <span>
            <strong>Department Isolation Active:</strong> Displaying consolidated registry and analytics for <strong>Department of {facultyDept}</strong>.
          </span>
        </div>
      )}

      {/* Metrics Strip */}
      <div className="grid-cards" style={{
        gap: 16,
        marginBottom: 32
      }}>
        <div className="card" style={{ padding: "22px", textAlign: "center" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            {isFaculty ? `${facultyDept} Students` : "Total Students"}
          </span>
          <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--green-primary)", marginTop: 4 }}>
            {data?.metrics?.total_students || 0}
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Enrolled in Internships</span>
        </div>

        <div className="card" style={{ padding: "22px", textAlign: "center" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Completed
          </span>
          <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--info)", marginTop: 4 }}>
            {data?.metrics?.completed || 0}
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Verified with Documents</span>
        </div>

        <div className="card" style={{ padding: "22px", textAlign: "center" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Ongoing
          </span>
          <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--warning)", marginTop: 4 }}>
            {data?.metrics?.ongoing || 0}
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>In-Progress Tracking</span>
        </div>

        <div className="card" style={{ padding: "22px", textAlign: "center" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Average Attendance
          </span>
          <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--green-primary)", marginTop: 4 }}>
            {data?.metrics?.avg_attendance != null ? `${data.metrics.avg_attendance}%` : loading ? "…" : "0%"}
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Attendance Health Ratio</span>
        </div>
      </div>

      {/* Quick Action Buttons Strip */}
      <div className="grid-cards" style={{
        gap: 16,
        marginBottom: 32
      }}>
        <div className="card" style={{ padding: "20px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "var(--green-tint)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--green-primary)",
            border: "1px solid #bbf7d0"
          }}>
            <Users size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: "0.98rem", fontWeight: 700, color: "var(--text-primary)" }}>Student Directory</h4>
            <p style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Open department-scoped student records</p>
          </div>
          <button className="btn btn-primary" onClick={() => setView("students")} style={{ padding: "8px 14px", fontSize: "0.8rem" }}>
            Open
          </button>
        </div>

        <div className="card" style={{ padding: "20px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "var(--info-dim)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--info)",
            border: "1px solid #bae6fd"
          }}>
            <FileText size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: "0.98rem", fontWeight: 700, color: "var(--text-primary)" }}>Department Explorer</h4>
            <p style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Review authorized department records</p>
          </div>
          <button className="btn btn-secondary" onClick={() => setView("departments")} style={{ padding: "8px 14px", fontSize: "0.8rem" }}>
            Open
          </button>
        </div>

        <div className="card" style={{ padding: "20px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "var(--warning-dim)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--warning)",
            border: "1px solid #fde68a"
          }}>
            <Calendar size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: "0.98rem", fontWeight: 700, color: "var(--text-primary)" }}>Faculty Dashboard</h4>
            <p style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Review alerts and pending actions</p>
          </div>
          <button className="btn btn-secondary" onClick={() => setView("faculty-home")} style={{ padding: "8px 14px", fontSize: "0.8rem" }}>
            Review
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="card" style={{ padding: "18px 24px", marginBottom: 20 }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14
        }}>
          <div style={{ position: "relative", flex: "1 1 280px" }}>
            <input
              className="form-input"
              style={{ paddingLeft: 38 }}
              placeholder="Search by student name, roll number, or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={16} color="var(--green-primary)" style={{ position: "absolute", left: 14, top: 13 }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
              <Filter size={14} /> Dept:
            </span>
            <select
              className="form-select"
              style={{ width: "auto", padding: "8px 14px", fontSize: "0.84rem" }}
              value={deptFilter}
              disabled={isFaculty}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d === "ALL" ? "All Departments" : d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Consolidated Records Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1.5px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>Student Internship Registry</h3>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              Showing {filtered.length} of {records.length} records
            </p>
          </div>
        </div>

        <div className="table-responsive" style={{ border: "none" }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Student Name</th>
                <th>Roll Number</th>
                <th>Dept</th>
                <th>Company</th>
                <th>Duration</th>
                <th>Attendance %</th>
                <th>Status</th>
                <th>Certificate</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((r, idx) => (
                  <tr key={r.id || idx}>
                    <td style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                    <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>{r.name}</td>
                    <td className="mono" style={{ color: "var(--green-primary)", fontSize: "0.84rem", fontWeight: 700 }}>
                      {r.reg_no}
                    </td>
                    <td>
                      <span className="badge badge-info">{r.department}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.company}</td>
                    <td style={{ color: "var(--text-dim)", fontSize: "0.84rem" }}>{r.duration}</td>
                    <td>
                      <span style={{
                        fontWeight: 700,
                        color: r.attendance_pct >= 85 ? "var(--green-primary)" : r.attendance_pct >= 75 ? "var(--warning)" : "var(--danger)"
                      }}>
                        {r.attendance_pct}%
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        r.status === "Completed" ? "badge-success" : r.status === "Pending" ? "badge-danger" : "badge-warning"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      {r.document_uploaded ? (
                        <span style={{ fontSize: "0.78rem", color: "var(--green-primary)", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                          <CheckCircle2 size={14} /> Attached
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
