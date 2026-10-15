import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { 
  Building2, 
  Users, 
  BarChart3, 
  FileCheck, 
  ArrowRight, 
  ShieldCheck, 
  GraduationCap,
  Sparkles,
  Award,
  Lock,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Edit,
  History,
  Check
} from "lucide-react";

export default function FacultyHome({ setView }) {
  const { user } = useAuth();
  const facultyDept = user?.department || "CSE";
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  // Alerts & Reports Review States
  const [alerts, setAlerts] = useState([]);
  const [reviewList, setReviewList] = useState([]);
  const [pendingExceptions, setPendingExceptions] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionStatus, setCorrectionStatus] = useState("Present / Verified");
  const [correctionHours, setCorrectionHours] = useState(8.0);
  const [reviewDecision, setReviewDecision] = useState("Approved");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [unlockedSections, setUnlockedSections] = useState([]);
  const [actionMsg, setActionMsg] = useState("");

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setStatsLoading(true);
      const [sumRes, alertsRes, reviewsRes, excRes, watchRes] = await Promise.all([
        api.getConsolidateSummary().catch(() => null),
        api.getFacultyAlerts().catch(() => ({ alerts: [] })),
        api.getFacultyReviewList().catch(() => ({ reports: [] })),
        api.getPendingExceptions().catch(() => ({ exceptions: [] })),
        api.getLowAttendanceWatchlist(75.0).catch(() => ({ watchlist: [] }))
      ]);
      setStats(sumRes);
      setAlerts(alertsRes?.alerts || []);
      setReviewList(reviewsRes?.reports || []);
      setPendingExceptions(excRes?.exceptions || []);
      setWatchlist(watchRes?.watchlist || []);
      setStatsError(false);
    } catch {
      setStatsError(true);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleReviewException = async (exceptionId, decision) => {
    const notes = window.prompt(`Enter review notes for marking as ${decision.toUpperCase()}:`, decision === "approved" ? "Approved by faculty mentor" : "Insufficient justification");
    if (notes === null) return;
    try {
      await api.reviewException(exceptionId, decision, notes);
      setActionMsg(`✅ Exception request marked as ${decision.toUpperCase()}`);
      await loadDashboardData();
    } catch (err) {
      setActionMsg(`❌ Exception review failed: ${err.message}`);
    }
  };

  const handleCorrectAttendance = async () => {
    if (!selectedAlert) return;
    if (!correctionReason.trim() || correctionReason.trim().length < 5) {
      setActionMsg("❌ Mandatory reason (minimum 5 characters) required for immutable audit logging.");
      return;
    }
    try {
      const res = await api.correctAttendance(
        selectedAlert.id,
        correctionStatus,
        correctionHours,
        correctionReason.trim()
      );
      setActionMsg(`✅ ${res.message}`);
      setSelectedAlert(null);
      setCorrectionReason("");
      await loadDashboardData();
    } catch (err) {
      setActionMsg(`❌ Correction failed: ${err.message}`);
    }
  };

  const handleReviewReport = async () => {
    if (!selectedReport) return;
    if (!reviewFeedback.trim() || reviewFeedback.trim().length < 3) {
      setActionMsg("❌ Evaluation comments/feedback required before completing review.");
      return;
    }
    try {
      const res = await api.reviewReport(
        selectedReport.id,
        reviewDecision,
        reviewFeedback.trim(),
        unlockedSections
      );
      setActionMsg(`✅ ${res.message}`);
      setSelectedReport(null);
      setReviewFeedback("");
      setUnlockedSections([]);
      await loadDashboardData();
    } catch (err) {
      setActionMsg(`❌ Review submission failed: ${err.message}`);
    }
  };

  return (
    <div className="app-container" style={{ padding: "30px 20px 60px" }}>
      {/* Welcome Banner */}
      <div style={{
        marginTop: 10,
        background: "linear-gradient(135deg, #ffffff, #f0fdf4)",
        border: "1.5px solid #bbf7d0",
        borderRadius: "var(--radius-xl)",
        padding: "32px 30px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16,
        boxShadow: "var(--shadow-sm)"
      }}>
        <div>
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
            marginBottom: 8,
            border: "1px solid #bbf7d0"
          }}>
            <Sparkles size={14} /> Department Faculty Coordinator Portal
          </div>
          <h2 style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--text-primary)" }}>
            Welcome, {user?.faculty_name || "Faculty Coordinator"}
          </h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.92rem", marginTop: 4 }}>
            Faculty ID: <span className="mono" style={{ color: "var(--text-primary)", fontWeight: 700 }}>{user?.roll_number}</span> · 
            Authorized Department: <strong style={{ color: "var(--green-primary)" }}>Department of {facultyDept}</strong>
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn btn-primary"
            onClick={() => setView("departments")}
            style={{ padding: "10px 20px", fontSize: "0.88rem" }}
          >
            <Building2 size={16} /> Open {facultyDept} Department Roster
          </button>
        </div>
      </div>

      {/* Faculty Department Scope Notice */}
      <div style={{
        marginTop: 20,
        background: "var(--green-tint)",
        border: "1.5px solid #86efac",
        borderRadius: "var(--radius-md)",
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: "var(--green-primary)",
        fontSize: "0.88rem",
        fontWeight: 600
      }}>
        <Lock size={18} />
        <span>
          <strong>Department Isolation Active:</strong> Authorized to review, audit, correct attendance records, and grade reports for <strong>Department of {facultyDept}</strong> students only.
        </span>
      </div>

      {actionMsg && (
        <div style={{
          marginTop: 20,
          background: actionMsg.startsWith("✅") ? "var(--success-dim)" : "var(--danger-dim)",
          border: `1px solid ${actionMsg.startsWith("✅") ? "#bbf7d0" : "#fecaca"}`,
          color: actionMsg.startsWith("✅") ? "var(--green-primary)" : "var(--danger)",
          padding: "12px 18px",
          borderRadius: "var(--radius-md)",
          fontSize: "0.88rem",
          fontWeight: 600
        }}>
          {actionMsg}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid-cards" style={{
        gap: 16,
        marginTop: 20,
        marginBottom: 32
      }}>
        <div className="card" style={{ padding: "22px", textAlign: "center" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            {facultyDept} Enrolled Students
          </span>
          <div style={{ fontSize: "2.3rem", fontWeight: 800, color: "var(--green-primary)", marginTop: 4 }}>
            {statsLoading ? "…" : statsError ? "—" : (stats?.metrics?.total_students ?? 0)}
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>In Department of {facultyDept}</span>
        </div>

        <div className="card" style={{ padding: "22px", textAlign: "center" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Attendance Exceptions / Alerts
          </span>
          <div style={{ fontSize: "2.3rem", fontWeight: 800, color: alerts.length > 0 ? "var(--warning)" : "var(--green-primary)", marginTop: 4 }}>
            {alerts.length}
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Requires Mentor Review</span>
        </div>

        <div className="card" style={{ padding: "22px", textAlign: "center" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Submitted Reports Queue
          </span>
          <div style={{ fontSize: "2.3rem", fontWeight: 800, color: "var(--info)", marginTop: 4 }}>
            {reviewList.length}
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Awaiting Faculty Evaluation</span>
        </div>

        <div className="card" style={{ padding: "22px", textAlign: "center" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Average Attendance Ratio
          </span>
          <div style={{ fontSize: "2.3rem", fontWeight: 800, color: "var(--green-primary)", marginTop: 4 }}>
            {statsLoading ? "…" : statsError ? "—" : `${stats?.metrics?.avg_attendance ?? 0}%`}
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Strict Verified Ratio</span>
        </div>
      </div>

      {/* Attendance Exceptions & Alerts Section */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 30 }}>
        <div style={{ padding: "18px 24px", borderBottom: "1.5px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={20} color="var(--warning)" />
            <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Attendance Exceptions &amp; Suspicious Activity Alerts
            </h4>
          </div>
          <span className="badge badge-warning">{alerts.length} Active Alerts</span>
        </div>

        <div className="table-responsive" style={{ border: "none" }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Roll No</th>
                <th>Flagged Status</th>
                <th>Distance</th>
                <th>Hours</th>
                <th>Suspicious Reasons</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length > 0 ? (
                alerts.map(a => (
                  <tr key={a.id}>
                    <td className="mono">{a.attendance_date}</td>
                    <td style={{ fontWeight: 600 }}>{a.student_name}</td>
                    <td className="mono">{a.register_no}</td>
                    <td><span className="badge badge-danger">{a.status}</span></td>
                    <td>{a.in_distance !== null ? `${a.in_distance}km` : "—"}</td>
                    <td>{a.working_hours}h</td>
                    <td style={{ fontSize: "0.8rem", color: "var(--danger)" }}>
                      {(a.suspicious_flags || []).join(", ") || a.status}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setSelectedAlert(a)}
                        style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                      >
                        <Edit size={13} /> Review &amp; Correct
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "30px", color: "var(--green-primary)", fontWeight: 600 }}>
                    ✓ No active location exceptions or early checkout alerts in Department of {facultyDept}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Internship Reports Evaluation Queue */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 30 }}>
        <div style={{ padding: "18px 24px", borderBottom: "1.5px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileCheck size={20} color="var(--green-primary)" />
            <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
              21-Section Internship Report Review Queue
            </h4>
          </div>
          <span className="badge badge-info">{reviewList.length} Reports</span>
        </div>

        <div className="table-responsive" style={{ border: "none" }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Student</th>
                <th>Roll No</th>
                <th>Company</th>
                <th>Completion</th>
                <th>Version</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {reviewList.length > 0 ? (
                reviewList.map(r => (
                  <tr key={r.id}>
                    <td className="mono">{r.submitted_at ? r.submitted_at.substring(0, 10) : "Draft"}</td>
                    <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                    <td className="mono">{r.reg_no}</td>
                    <td>{r.company_name}</td>
                    <td style={{ fontWeight: 700, color: "var(--green-primary)" }}>{r.completion_pct}%</td>
                    <td>v{r.version}</td>
                    <td>
                      <span className={`badge ${
                        r.status === "Approved" ? "badge-success" :
                        r.status === "Submitted / Locked" ? "badge-info" :
                        r.status === "Changes Requested" ? "badge-warning" : "badge-danger"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-primary"
                        onClick={() => setSelectedReport(r)}
                        style={{ padding: "4px 12px", fontSize: "0.78rem" }}
                      >
                        Evaluate
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    No submitted reports awaiting review in {facultyDept}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Student Attendance Exceptions Queue */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 30 }}>
        <div style={{ padding: "18px 24px", borderBottom: "1.5px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldCheck size={20} color="#d97706" />
            <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Pending Student Attendance Exception Requests
            </h4>
          </div>
          <span className="badge badge-warning">{pendingExceptions.length} Awaiting Approval</span>
        </div>

        <div className="table-responsive" style={{ border: "none" }}>
          <table className="custom-table" style={{ fontSize: "0.82rem" }}>
            <thead>
              <tr>
                <th>Date Requested</th>
                <th>Student</th>
                <th>Roll No</th>
                <th>Exception Type</th>
                <th>Student Reason &amp; Evidence</th>
                <th>Decision Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingExceptions.length > 0 ? (
                pendingExceptions.map((exc) => (
                  <tr key={exc.id}>
                    <td className="mono">{exc.requested_at ? exc.requested_at.substring(0, 10) : "—"}</td>
                    <td style={{ fontWeight: 600 }}>{exc.student_name}</td>
                    <td className="mono">{exc.reg_no}</td>
                    <td>
                      <span className="badge badge-info">
                        {exc.exception_type ? exc.exception_type.replace(/_/g, " ") : "General"}
                      </span>
                    </td>
                    <td style={{ maxWidth: 280 }}>{exc.reason}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleReviewException(exc.id, "approved")}
                          style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                        >
                          <Check size={12} /> Approve
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleReviewException(exc.id, "rejected")}
                          style={{ padding: "4px 10px", fontSize: "0.75rem", background: "#fee2e2", color: "#991b1b" }}
                        >
                          <XCircle size={12} /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "26px", color: "var(--text-muted)" }}>
                    No pending attendance exception requests from {facultyDept} students.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low Attendance Watchlist (< 75%) */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 30 }}>
        <div style={{ padding: "18px 24px", borderBottom: "1.5px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={20} color="var(--danger)" />
            <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Academic Attendance Watchlist (&lt; 75% Verified Attendance)
            </h4>
          </div>
          <span className="badge badge-danger">{watchlist.length} Students at Risk</span>
        </div>

        <div className="table-responsive" style={{ border: "none" }}>
          <table className="custom-table" style={{ fontSize: "0.82rem" }}>
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Student Name</th>
                <th>Company</th>
                <th>Days Logged</th>
                <th>Verified Attendance</th>
                <th>Academic Status</th>
              </tr>
            </thead>
            <tbody>
              {watchlist.length > 0 ? (
                watchlist.map((w) => (
                  <tr key={w.id}>
                    <td className="mono" style={{ fontWeight: 700 }}>{w.roll_number}</td>
                    <td style={{ fontWeight: 600 }}>{w.student_name}</td>
                    <td>{w.company_name}</td>
                    <td>{w.total_days} days</td>
                    <td style={{ fontWeight: 800, color: "var(--danger)" }}>{w.attendance_pct}%</td>
                    <td>
                      <span className="badge badge-danger">Ineligible for Report (&lt; 75%)</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "26px", color: "var(--text-muted)" }}>
                    Excellent! All {facultyDept} students maintain &ge; 75% verified internship attendance.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Navigation Quick Cards */}
      <div className="grid-cards" style={{ gap: 20 }}>
        <div className="card card-hover" onClick={() => setView("students")} style={{ cursor: "pointer", padding: "26px" }}>
          <Users size={32} color="var(--green-primary)" style={{ marginBottom: 12 }} />
          <h4 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)" }}>Student Directory</h4>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", margin: "6px 0 16px" }}>
            Search, filter and inspect full attendance ratios and internship company details for {facultyDept} students.
          </p>
          <span style={{ color: "var(--green-primary)", fontWeight: 700, fontSize: "0.84rem", display: "inline-flex", alignItems: "center", gap: 5 }}>
            Open Directory <ArrowRight size={14} />
          </span>
        </div>

        <div className="card card-hover" onClick={() => setView("consolidate")} style={{ cursor: "pointer", padding: "26px" }}>
          <BarChart3 size={32} color="var(--info)" style={{ marginBottom: 12 }} />
          <h4 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)" }}>Consolidated Analytics</h4>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", margin: "6px 0 16px" }}>
            Review official documents, completion certificates, and overall attendance ratios across your department.
          </p>
          <span style={{ color: "var(--info)", fontWeight: 700, fontSize: "0.84rem", display: "inline-flex", alignItems: "center", gap: 5 }}>
            View Analytics <ArrowRight size={14} />
          </span>
        </div>
      </div>

      {/* Modal: Correct Attendance Record */}
      {selectedAlert && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 550 }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 12 }}>
              Correct Attendance Record #{selectedAlert.id}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: 16 }}>
              Student: <strong>{selectedAlert.student_name}</strong> ({selectedAlert.register_no}) · Date: {selectedAlert.attendance_date}
            </p>

            <div style={{ marginBottom: 14 }}>
              <label className="label">New Attendance Status</label>
              <select
                className="input"
                value={correctionStatus}
                onChange={e => setCorrectionStatus(e.target.value)}
              >
                <option value="Present / Verified">Present / Verified</option>
                <option value="Half Day">Half Day</option>
                <option value="Incomplete">Incomplete</option>
                <option value="Absent">Absent</option>
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="label">Awarded Working Hours</label>
              <input
                type="number"
                step="0.5"
                className="input"
                value={correctionHours}
                onChange={e => setCorrectionHours(parseFloat(e.target.value))}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label className="label">Mandatory Correction Reason (Audit Trail) *</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Specify reason (e.g. In-person industrial site visit verified by guide, approved remote day...)"
                value={correctionReason}
                onChange={e => setCorrectionReason(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSelectedAlert(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCorrectAttendance}>
                Commit Immutable Correction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Evaluate Internship Report */}
      {selectedReport && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 600 }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 12 }}>
              Evaluate Internship Report #{selectedReport.id}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: 16 }}>
              Student: <strong>{selectedReport.student_name}</strong> ({selectedReport.reg_no}) · Company: {selectedReport.company_name} · Completion: {selectedReport.completion_pct}%
            </p>

            <div style={{ marginBottom: 14 }}>
              <label className="label">Evaluation Decision</label>
              <select
                className="input"
                value={reviewDecision}
                onChange={e => setReviewDecision(e.target.value)}
              >
                <option value="Approved">Approved (Final Sign-off &amp; Lock)</option>
                <option value="Changes Requested">Changes Requested (Unlock Specific Sections)</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            {reviewDecision === "Changes Requested" && (
              <div style={{ marginBottom: 14 }}>
                <label className="label">Select Sections to Unlock for Student Revision</label>
                <div className="grid-2-col" style={{ gap: 8, fontSize: "0.82rem", background: "#f8fafc", padding: 12, borderRadius: 6 }}>
                  {["system_methodology", "work_completed", "evidence_screenshots", "challenges_solutions", "conclusion"].map(sec => (
                    <label key={sec} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={unlockedSections.includes(sec)}
                        onChange={e => {
                          if (e.target.checked) setUnlockedSections(p => [...p, sec]);
                          else setUnlockedSections(p => p.filter(s => s !== sec));
                        }}
                      />
                      <span>{sec.replace(/_/g, " ")}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 18 }}>
              <label className="label">Faculty Feedback / Evaluation Notes *</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Detailed critique, corrections needed, or commendation..."
                value={reviewFeedback}
                onChange={e => setReviewFeedback(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSelectedReport(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleReviewReport}>
                Submit Evaluation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
