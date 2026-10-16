import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { 
  Search, 
  Users,
  FileText, 
  CheckCircle2, 
  Filter, 
  Download, 
  Calendar,
  Lock,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  AlertCircle
} from "lucide-react";

export default function ConsolidateDashboard({ setView }) {
  const { user, role } = useAuth();
  const isFaculty = ["faculty", "hod", "admin"].includes(role);
  const facultyDept = user?.department || "CSE";

  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState(isFaculty ? facultyDept : "ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState("reg_no");
  const [sortDir, setSortDir] = useState("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSummary = useCallback(async () => {
    try {
      const res = await api.getConsolidateSummary();
      setData(res);
      setError(null);
    } catch (err) {
      console.error("Failed to load consolidate summary:", err);
      setError(err.message || "Failed to retrieve consolidated records. Please check backend service.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    await loadSummary();
  };

  useEffect(() => {
    let ignore = false;
    const fetchSummary = async () => {
      try {
        const res = await api.getConsolidateSummary();
        if (!ignore) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          console.error("Failed to load consolidate summary:", err);
          setError(err.message || "Failed to retrieve consolidated records. Please check backend service.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };
    fetchSummary();
    return () => {
      ignore = true;
    };
  }, []);

  if (!isFaculty) return null;

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const records = data?.records || [];
  const filtered = records.filter((r) => {
    const matchesSearch =
      (r.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.reg_no || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.company || "").toLowerCase().includes(search.toLowerCase());
    const matchesDept = isFaculty ? r.department === facultyDept : (deptFilter === "ALL" || r.department === deptFilter);
    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    return matchesSearch && matchesDept && matchesStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    let valA, valB;
    if (sortField === "attendance_pct") {
      valA = a.attendance_pct ?? a.attendance_rate ?? 0;
      valB = b.attendance_pct ?? b.attendance_rate ?? 0;
    } else if (sortField === "name") {
      valA = (a.name || "").toLowerCase();
      valB = (b.name || "").toLowerCase();
    } else if (sortField === "company") {
      valA = (a.company || "").toLowerCase();
      valB = (b.company || "").toLowerCase();
    } else if (sortField === "status") {
      valA = (a.status || "").toLowerCase();
      valB = (b.status || "").toLowerCase();
    } else {
      valA = (a.reg_no || "").toLowerCase();
      valB = (b.reg_no || "").toLowerCase();
    }
    if (valA < valB) return sortDir === "asc" ? -1 : 1;
    if (valA > valB) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const departments = isFaculty ? [facultyDept] : ["ALL", ...new Set(records.map((r) => r.department))];

  const exportToCSV = () => {
    if (!sorted.length) return;
    const headers = ["S.No", "Student Name", "Roll Number", "Department", "Company", "Duration", "Attendance %", "Status", "Certificate Uploaded"];
    const rows = sorted.map((r, idx) => [
      idx + 1,
      `"${(r.name || "").replace(/"/g, '""')}"`,
      `"${(r.reg_no || "").replace(/"/g, '""')}"`,
      `"${(r.department || "").replace(/"/g, '""')}"`,
      `"${(r.company || "").replace(/"/g, '""')}"`,
      `"${(r.duration || "").replace(/"/g, '""')}"`,
      r.attendance_pct ?? r.attendance_rate ?? 0,
      `"${(r.status || "").replace(/"/g, '""')}"`,
      r.document_uploaded ? "Yes" : "No"
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kongu_${facultyDept}_internship_summary_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown size={13} style={{ opacity: 0.4, marginLeft: 4 }} />;
    }
    return sortDir === "asc"
      ? <ChevronUp size={14} style={{ color: "var(--green-primary)", marginLeft: 4 }} />
      : <ChevronDown size={14} style={{ color: "var(--green-primary)", marginLeft: 4 }} />;
  };

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
          justifyContent: "space-between",
          gap: 10,
          color: "var(--green-primary)",
          fontSize: "0.85rem",
          fontWeight: 600,
          flexWrap: "wrap"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Lock size={16} />
            <span>
              <strong>Department Isolation Active:</strong> Displaying consolidated registry and analytics for <strong>Department of {facultyDept}</strong>.
            </span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Refresh consolidated records"
            style={{
              background: "transparent",
              border: "1px solid #86efac",
              color: "var(--green-primary)",
              borderRadius: "var(--radius-sm)",
              padding: "4px 10px",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <RefreshCw size={13} className={loading ? "spin" : ""} /> Refresh Data
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div style={{
          background: "var(--danger-dim)",
          border: "1.5px solid #fecaca",
          color: "var(--danger)",
          padding: "14px 18px",
          borderRadius: "var(--radius-md)",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          fontSize: "0.86rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="btn btn-primary"
            style={{ padding: "6px 14px", fontSize: "0.8rem" }}
          >
            Try Again
          </button>
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
            {loading ? "..." : (data?.metrics?.total_students || 0)}
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Enrolled in Internships</span>
        </div>

        <div className="card" style={{ padding: "22px", textAlign: "center" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Completed
          </span>
          <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--info)", marginTop: 4 }}>
            {loading ? "..." : (data?.metrics?.completed || 0)}
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Verified with Documents</span>
        </div>

        <div className="card" style={{ padding: "22px", textAlign: "center" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Ongoing
          </span>
          <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--warning)", marginTop: 4 }}>
            {loading ? "..." : (data?.metrics?.ongoing || 0)}
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>In-Progress Tracking</span>
        </div>

        <div className="card" style={{ padding: "22px", textAlign: "center" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Average Attendance
          </span>
          <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--green-primary)", marginTop: 4 }}>
            {loading ? "..." : (data?.metrics?.avg_attendance != null ? `${data.metrics.avg_attendance}%` : "0%")}
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

      {/* Search, Filter & Export Toolbar */}
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
              aria-label="Search students"
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={16} color="var(--green-primary)" style={{ position: "absolute", left: 14, top: 13 }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                <Filter size={14} /> Dept:
              </span>
              <select
                className="form-select"
                style={{ width: "auto", padding: "8px 12px", fontSize: "0.84rem" }}
                value={deptFilter}
                disabled={isFaculty}
                aria-label="Filter by department"
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d === "ALL" ? "All Departments" : d}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600 }}>
                Status:
              </span>
              <select
                className="form-select"
                style={{ width: "auto", padding: "8px 12px", fontSize: "0.84rem" }}
                value={statusFilter}
                aria-label="Filter by internship status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="Completed">Completed</option>
                <option value="Ongoing">Ongoing</option>
              </select>
            </div>

            <button
              onClick={exportToCSV}
              disabled={sorted.length === 0}
              className="btn btn-secondary"
              title="Export current table to CSV"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                fontSize: "0.82rem",
                fontWeight: 600
              }}
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Consolidated Records Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1.5px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>Student Internship Registry</h3>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              Showing {sorted.length} of {records.length} records • Click column headers to sort
            </p>
          </div>
        </div>

        <div className="table-responsive" style={{ border: "none" }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: 60 }}>S.No</th>
                <th scope="col" onClick={() => handleSort("name")} style={{ cursor: "pointer", userSelect: "none" }}>
                  <span style={{ display: "inline-flex", alignItems: "center" }}>
                    Student Name {renderSortIcon("name")}
                  </span>
                </th>
                <th scope="col" onClick={() => handleSort("reg_no")} style={{ cursor: "pointer", userSelect: "none" }}>
                  <span style={{ display: "inline-flex", alignItems: "center" }}>
                    Roll Number {renderSortIcon("reg_no")}
                  </span>
                </th>
                <th scope="col">Dept</th>
                <th scope="col" onClick={() => handleSort("company")} style={{ cursor: "pointer", userSelect: "none" }}>
                  <span style={{ display: "inline-flex", alignItems: "center" }}>
                    Company {renderSortIcon("company")}
                  </span>
                </th>
                <th scope="col">Duration</th>
                <th scope="col" onClick={() => handleSort("attendance_pct")} style={{ cursor: "pointer", userSelect: "none" }}>
                  <span style={{ display: "inline-flex", alignItems: "center" }}>
                    Attendance % {renderSortIcon("attendance_pct")}
                  </span>
                </th>
                <th scope="col" onClick={() => handleSort("status")} style={{ cursor: "pointer", userSelect: "none" }}>
                  <span style={{ display: "inline-flex", alignItems: "center" }}>
                    Status {renderSortIcon("status")}
                  </span>
                </th>
                <th scope="col">Certificate</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                      <RefreshCw size={18} className="spin" color="var(--green-primary)" />
                      <span>Loading consolidated student registry...</span>
                    </div>
                  </td>
                </tr>
              ) : sorted.length > 0 ? (
                sorted.map((r, idx) => (
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
                      {(() => {
                        const pct = r.attendance_pct ?? r.attendance_rate ?? 0;
                        return (
                          <span style={{
                            fontWeight: 700,
                            color: pct >= 85 ? "var(--green-primary)" : pct >= 75 ? "var(--warning)" : "var(--danger)"
                          }}>
                            {pct}%
                          </span>
                        );
                      })()}
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
                    No matching student records found. {search || statusFilter !== "ALL" ? "Try clearing search or filters." : ""}
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
