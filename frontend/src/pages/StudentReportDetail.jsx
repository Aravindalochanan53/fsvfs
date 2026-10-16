import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { 
  ArrowLeft, 
  Printer, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Building2, 
  ShieldCheck, 
  Clock, 
  MapPin
} from "lucide-react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement } from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement);

export default function StudentReportDetail({ studentId, setView }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId) return;
    let ignore = false;
    const fetchReport = async () => {
      try {
        const res = await api.getStudentDetail(studentId);
        if (!ignore) {
          setData(res.data);
          setError("");
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to load student report.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };
    fetchReport();
    return () => {
      ignore = true;
    };
  }, [studentId]);

  if (loading) {
    return (
      <div className="app-container" style={{ padding: "80px 20px", textAlign: "center" }}>
        <div style={{ color: "var(--green-primary)", fontSize: "1.1rem", fontWeight: 700 }}>
          Loading student comprehensive report...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="app-container" style={{ padding: "60px 20px", maxWidth: 650 }}>
        <div className="card" style={{ textAlign: "center", padding: "40px 28px" }}>
          <AlertTriangle size={36} color="var(--danger)" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
            Access Restricted
          </h3>
          <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", marginBottom: 24 }}>
            {error || "Unable to access student report."}
          </p>
          <button className="btn btn-primary" onClick={() => setView("students")}>
            <ArrowLeft size={16} /> Return to Student Directory
          </button>
        </div>
      </div>
    );
  }

  const s = data.student;
  const totals = data.totals || {};
  const eligible = data.eligible;
  const pct = data.overall_pct;
  const monthly = data.monthly || [];
  const daily = data.daily || [];

  // Chart data
  const donutData = {
    labels: ["Present", "Absent"],
    datasets: [
      {
        data: [totals.total_present || 0, totals.total_absent || 0],
        backgroundColor: ["#16a34a", "#ef4444"],
        borderColor: ["#ffffff", "#ffffff"],
        borderWidth: 3,
        hoverOffset: 6
      }
    ]
  };

  const barData = {
    labels: monthly.map((m) => m.month_label),
    datasets: [
      {
        label: "Present Days",
        data: monthly.map((m) => m.total_present),
        backgroundColor: "#16a34a",
        borderRadius: 6
      },
      {
        label: "Absent Days",
        data: monthly.map((m) => m.total_classes - m.total_present),
        backgroundColor: "#ef4444",
        borderRadius: 6
      }
    ]
  };

  const formatTime = (t) => {
    if (!t) return "--:--";
    if (t.length > 10) return t.substring(11, 16);
    return t;
  };

  return (
    <div className="app-container" style={{ padding: "30px 20px 60px" }}>
      {/* Top action bar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
        flexWrap: "wrap",
        gap: 12
      }}>
        <button
          className="btn btn-secondary"
          onClick={() => setView("students")}
          style={{ padding: "8px 16px", fontSize: "0.84rem" }}
        >
          <ArrowLeft size={16} /> Back to Student Directory
        </button>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn btn-primary"
            onClick={() => window.print()}
            style={{ padding: "8px 18px", fontSize: "0.84rem" }}
          >
            <Printer size={16} /> Print / Export PDF
          </button>
        </div>
      </div>

      {/* Header Profile Card */}
      <div className="card" style={{
        marginBottom: 24,
        padding: "28px",
        background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(240, 253, 244, 0.5))"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 20
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <h2 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)" }}>
                {s.student_name}
              </h2>
              <span className="badge badge-primary mono" style={{ fontSize: "0.85rem", padding: "4px 10px" }}>
                {s.register_number}
              </span>
            </div>

            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              color: "var(--text-dim)",
              fontSize: "0.88rem",
              alignItems: "center"
            }}>
              <span><strong>Department:</strong> {s.department}</span>
              <span>•</span>
              <span><strong>Class:</strong> {s.year_section} (Sem {s.semester})</span>
              <span>•</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Building2 size={15} color="var(--green-primary)" />
                <strong>{s.company_name}</strong>
              </span>
              <span>•</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <MapPin size={15} color="var(--green-primary)" />
                {s.company_location}
              </span>
            </div>
          </div>

          <div style={{
            textAlign: "right",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end"
          }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: "20px",
              background: eligible ? "rgba(22, 163, 74, 0.12)" : "rgba(239, 68, 68, 0.12)",
              color: eligible ? "var(--green-primary)" : "var(--danger)",
              fontWeight: 700,
              fontSize: "0.86rem",
              marginBottom: 8
            }}>
              {eligible ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
              {eligible ? "Eligible for End-Sem Exam" : "Attendance Condonation Required"}
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: eligible ? "var(--green-primary)" : "var(--danger)" }}>
              {pct}%
            </div>
            <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
              Overall Cumulative Attendance
            </span>
          </div>
        </div>
      </div>

      {/* 4 KPI Metrics */}
      <div className="grid-cards" style={{
        gap: 16,
        marginBottom: 28
      }}>
        <div className="card" style={{ padding: "20px", textAlign: "center" }}>
          <div style={{ color: "var(--green-primary)", display: "flex", justifyContent: "center", marginBottom: 6 }}>
            <CheckCircle2 size={24} />
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-primary)" }}>{totals.total_present}</div>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Total Days Present</span>
        </div>

        <div className="card" style={{ padding: "20px", textAlign: "center" }}>
          <div style={{ color: "var(--danger)", display: "flex", justifyContent: "center", marginBottom: 6 }}>
            <AlertTriangle size={24} />
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--danger)" }}>{totals.total_absent}</div>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Total Days Absent</span>
        </div>

        <div className="card" style={{ padding: "20px", textAlign: "center" }}>
          <div style={{ color: "var(--info)", display: "flex", justifyContent: "center", marginBottom: 6 }}>
            <Calendar size={24} />
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-primary)" }}>{totals.total_classes}</div>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Total Working Days</span>
        </div>

        <div className="card" style={{ padding: "20px", textAlign: "center" }}>
          <div style={{ color: "var(--warning)", display: "flex", justifyContent: "center", marginBottom: 6 }}>
            <Clock size={24} />
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-primary)" }}>{totals.total_hours || s.total_hours || 0} hrs</div>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Total Hours Logged</span>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid-2-col" style={{ gap: 20, marginBottom: 28 }}>
        {/* Doughnut Chart */}
        <div className="card" style={{ padding: "24px" }}>
          <h4 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 16, color: "var(--text-primary)" }}>
            Overall Attendance Distribution
          </h4>
          <div style={{ maxHeight: 240, display: "flex", justifyContent: "center" }}>
            <Doughnut
              data={donutData}
              options={{
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: { color: "#334155", font: { family: "Plus Jakarta Sans", size: 12, weight: 600 } }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Bar Chart */}
        <div className="card" style={{ padding: "24px" }}>
          <h4 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 16, color: "var(--text-primary)" }}>
            Monthly Attendance Trend
          </h4>
          <div style={{ maxHeight: 240 }}>
            <Bar
              data={barData}
              options={{
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: { color: "#334155", font: { family: "Plus Jakarta Sans", size: 12, weight: 600 } }
                  }
                },
                scales: {
                  x: { ticks: { color: "#475569" }, grid: { color: "#f1f5f9" } },
                  y: { ticks: { color: "#475569" }, grid: { color: "#f1f5f9" } }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 28 }}>
        <div style={{ padding: "18px 24px", borderBottom: "1.5px solid var(--border-subtle)" }}>
          <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>Monthly Aggregated Attendance &amp; Hours</h4>
        </div>
        <div className="table-responsive" style={{ border: "none" }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Present Days</th>
                <th>Absent Days</th>
                <th>Total Days</th>
                <th>Logged Hours</th>
                <th>Attendance Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m) => {
                const mElig = m.percentage >= 75.0;
                return (
                  <tr key={m.month_label}>
                    <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>{m.month_label}</td>
                    <td style={{ color: "var(--green-primary)", fontWeight: 700 }}>{m.total_present}</td>
                    <td style={{ color: "var(--danger)", fontWeight: 700 }}>{m.total_classes - m.total_present}</td>
                    <td style={{ color: "var(--text-muted)" }}>{m.total_classes}</td>
                    <td style={{ color: "var(--text-primary)", fontWeight: 600 }}>{m.hours} hrs</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 80, height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{
                            width: `${m.percentage}%`,
                            height: "100%",
                            background: mElig ? "var(--green-primary)" : "var(--danger)",
                            borderRadius: 3
                          }} />
                        </div>
                        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: mElig ? "var(--green-primary)" : "var(--danger)" }}>
                          {m.percentage}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${mElig ? "badge-success" : "badge-danger"}`}>
                        {mElig ? "Satisfactory" : "Below Threshold"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Attendance Logs */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1.5px solid var(--border-subtle)" }}>
          <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>Daily GPS Attendance Logs</h4>
        </div>
        <div className="table-responsive" style={{ border: "none" }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>In Time</th>
                <th>Out Time</th>
                <th>Hours</th>
                <th>GPS Geofence</th>
                <th>Status</th>
                <th>Work Summary</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d, i) => (
                <tr key={i}>
                  <td className="mono" style={{ fontWeight: 600 }}>{d.attendance_date}</td>
                  <td className="mono">{formatTime(d.in_time)}</td>
                  <td className="mono">{formatTime(d.out_time)}</td>
                  <td style={{ color: "var(--green-primary)", fontWeight: 700 }}>
                    {d.working_hours ? `${d.working_hours}h` : "—"}
                  </td>
                  <td>
                    {d.location_verified ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.78rem", color: "var(--green-primary)", fontWeight: 600 }}>
                        <ShieldCheck size={14} /> Verified
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.78rem", color: "var(--warning)", fontWeight: 600 }}>
                        <AlertTriangle size={14} /> Unverified
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${d.status === "Present" ? "badge-success" : "badge-danger"}`}>
                      {d.status}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.84rem", color: "var(--text-dim)" }}>
                    {d.work_summary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
