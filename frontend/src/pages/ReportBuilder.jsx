import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { 
  ArrowLeft, 
  CheckCircle2, 
  Printer, 
  Send,
  Save,
  Lock,
  Unlock,
  History,
  Eye,
  Edit3,
  AlertTriangle,
  ShieldCheck
} from "lucide-react";

const SECTION_GROUPS = [
  {
    group: "1. Preliminary Pages",
    items: [
      { key: "cover_page", title: "Cover Page & Academic Title" },
      { key: "bonafide_certificate", title: "Bonafide Certificate" },
      { key: "declaration", title: "Student Declaration" },
      { key: "acknowledgement", title: "Formal Acknowledgement" },
      { key: "abstract", title: "Abstract & Executive Summary" },
      { key: "table_of_contents", title: "Table of Contents" },
    ]
  },
  {
    group: "2. Organization & Schedule",
    items: [
      { key: "company_profile", title: "Company Profile & Business Domain" },
      { key: "company_mentor_details", title: "Workplace & Industrial Mentors" },
      { key: "internship_objectives", title: "Internship Training Objectives" },
      { key: "timeline_schedule", title: "Duration & Weekly Work Timeline" },
    ]
  },
  {
    group: "3. Technical Architecture",
    items: [
      { key: "technologies_used", title: "Technologies, Frameworks & Tools" },
      { key: "problem_statement", title: "Problem Statement / Project Scope" },
      { key: "system_methodology", title: "System Methodology & Design" },
    ]
  },
  {
    group: "4. Development & Evidence",
    items: [
      { key: "work_completed", title: "Development & Work Completed" },
      { key: "evidence_screenshots", title: "Screenshots & Diagrammatic Evidence" },
      { key: "challenges_solutions", title: "Challenges Encountered & Solutions" },
      { key: "skills_outcomes", title: "Skills Acquired & Learning Outcomes" },
    ]
  },
  {
    group: "5. Closure & Verification",
    items: [
      { key: "conclusion", title: "Conclusion & Industrial Impact" },
      { key: "future_scope", title: "Future Scope & Enhancements" },
      { key: "references", title: "References & Documentation Links" },
      { key: "appendix", title: "Appendix: Offer Letter & Attendance" },
    ]
  }
];

export default function ReportBuilder({ setView }) {
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [sections, setSections] = useState({});
  const [activeKey, setActiveKey] = useState("cover_page");
  const [viewMode, setViewMode] = useState("editor"); // "editor" | "preview" | "history"
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [versions, setVersions] = useState([]);
  const [comments, setComments] = useState([]);

  const loadReportData = async () => {
    try {
      const res = await api.getMyReport();
      setReport(res);
      setSections(res.sections_data || {});
      const verRes = await api.getReportVersions();
      setVersions(verRes.versions || []);
      if (res?.id) {
        try {
          const comRes = await api.getReportComments(res.id);
          setComments(comRes.comments || []);
        } catch {
          // comments endpoint may fail if not authorized or empty
        }
      }
    } catch (err) {
      setStatusMsg(`❌ Error loading report: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, []);

  const isSectionComplete = (key) => {
    const val = sections[key];
    if (!val) return false;
    if (typeof val === "string") return val.trim().length >= 10;
    if (typeof val === "object") {
      if (Array.isArray(val)) return val.length > 0;
      return Object.values(val).some(v => Boolean(v) && String(v).length > 2);
    }
    return false;
  };

  const calculateLiveCompletion = () => {
    let completed = 0;
    let total = 0;
    SECTION_GROUPS.forEach(g => {
      g.items.forEach(item => {
        total += 1;
        if (isSectionComplete(item.key)) completed += 1;
      });
    });
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const handleTextChange = (key, val) => {
    setSections(prev => ({ ...prev, [key]: val }));
  };

  const handleNestedChange = (parentKey, field, val) => {
    setSections(prev => ({
      ...prev,
      [parentKey]: {
        ...(prev[parentKey] || {}),
        [field]: val
      }
    }));
  };

  const isLocked = () => {
    if (!report) return false;
    if (report.status === "Approved") return true;
    if (report.status === "Submitted / Locked") return true;
    if (report.status === "Changes Requested") {
      const unlocked = report.unlocked_sections || [];
      if (unlocked.length > 0 && !unlocked.includes(activeKey)) {
        return true; // only unlocked sections are editable
      }
    }
    return false;
  };

  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      setStatusMsg("");
      const res = await api.saveReportDraft(sections, `Draft saved by ${user?.student_name}`);
      setStatusMsg(`✅ Draft saved successfully as Version ${res.version} (${res.completion_pct}% complete).`);
      await loadReportData();
    } catch (err) {
      setStatusMsg(`❌ Failed to save draft: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleFinalSubmit = async () => {
    const livePct = calculateLiveCompletion();
    if (livePct < 100) {
      alert(`⚠️ All 21 mandatory sections must be completed before final submission. Current completion is ${livePct}%. Please fill in all sections marked with a warning dot.`);
      return;
    }

    if (!report?.attendance_eligibility?.is_eligible) {
      const proceed = window.confirm(
        `⚠️ Attendance Warning:\nYour verified attendance is ${report?.attendance_eligibility?.attendance_pct}%, which is below the standard 75% threshold.\n\nDo you wish to submit an exception request to your faculty mentor?`
      );
      if (!proceed) return;
    } else {
      const confirmSubmit = window.confirm(
        "🔒 Final Submission Confirmation:\n\nOnce submitted, your report will be permanently LOCKED for student edits and submitted to your department faculty mentor for formal evaluation.\n\nAre you sure you want to proceed?"
      );
      if (!confirmSubmit) return;
    }

    try {
      setSubmitting(true);
      setStatusMsg("");
      const res = await api.submitFinalReport(sections, true);
      setStatusMsg(`🎉 ${res.message} Status: ${res.status}`);
      await loadReportData();
      setViewMode("preview");
    } catch (err) {
      setStatusMsg(`❌ Submission error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="app-container" style={{ padding: "80px 20px", textAlign: "center" }}>
        <div style={{ color: "var(--green-primary)", fontSize: "1.1rem", fontWeight: 700 }}>
          Loading 21-Chapter Formal Internship Documentation Module...
        </div>
      </div>
    );
  }

  const liveCompletion = calculateLiveCompletion();
  const locked = isLocked();

  return (
    <div className="app-container" style={{ padding: "30px 20px 60px" }}>
      {/* Top Banner & Mode Toggle */}
      <div style={{
        marginBottom: 20,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16
      }}>
        <div>
          <button
            className="btn btn-secondary"
            onClick={() => setView("student-home")}
            style={{ padding: "6px 14px", fontSize: "0.82rem", marginBottom: 8 }}
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-primary)" }}>
              Internship Report Documentation
            </h2>
            <span className={`badge ${
              report?.status === "Approved" ? "badge-success" :
              report?.status === "Submitted / Locked" ? "badge-info" :
              report?.status === "Changes Requested" ? "badge-warning" : "badge-danger"
            }`}>
              {report?.status || "Draft"}
            </span>
          </div>
          <p style={{ color: "var(--text-dim)", fontSize: "0.86rem", marginTop: 4 }}>
            Student: <strong>{report?.student_name}</strong> ({report?.reg_no}) · Department: <strong>{report?.department}</strong> · Company: <strong>{report?.company_name}</strong>
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{
            display: "inline-flex",
            background: "#f1f5f9",
            borderRadius: "var(--radius-md)",
            padding: 3
          }}>
            <button
              onClick={() => setViewMode("editor")}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                background: viewMode === "editor" ? "#ffffff" : "transparent",
                fontWeight: 700,
                fontSize: "0.84rem",
                cursor: "pointer",
                color: viewMode === "editor" ? "var(--green-primary)" : "var(--text-dim)",
                boxShadow: viewMode === "editor" ? "var(--shadow-sm)" : "none"
              }}
            >
              <Edit3 size={14} style={{ display: "inline", marginRight: 5 }} /> Editor
            </button>
            <button
              onClick={() => setViewMode("preview")}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                background: viewMode === "preview" ? "#ffffff" : "transparent",
                fontWeight: 700,
                fontSize: "0.84rem",
                cursor: "pointer",
                color: viewMode === "preview" ? "var(--green-primary)" : "var(--text-dim)",
                boxShadow: viewMode === "preview" ? "var(--shadow-sm)" : "none"
              }}
            >
              <Eye size={14} style={{ display: "inline", marginRight: 5 }} /> PDF Preview
            </button>
            <button
              onClick={() => setViewMode("history")}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                background: viewMode === "history" ? "#ffffff" : "transparent",
                fontWeight: 700,
                fontSize: "0.84rem",
                cursor: "pointer",
                color: viewMode === "history" ? "var(--green-primary)" : "var(--text-dim)",
                boxShadow: viewMode === "history" ? "var(--shadow-sm)" : "none"
              }}
            >
              <History size={14} style={{ display: "inline", marginRight: 5 }} /> Versions ({versions.length})
            </button>
          </div>

          {!locked && (
            <button
              className="btn btn-secondary"
              onClick={handleSaveDraft}
              disabled={saving}
              style={{ padding: "8px 18px", fontSize: "0.84rem" }}
            >
              <Save size={16} /> {saving ? "Saving..." : "Save Draft"}
            </button>
          )}

          {!locked && (
            <button
              className="btn btn-primary"
              onClick={handleFinalSubmit}
              disabled={submitting || liveCompletion < 100}
              style={{
                padding: "8px 20px",
                fontSize: "0.84rem",
                opacity: liveCompletion === 100 ? 1 : 0.65
              }}
            >
              <Send size={16} /> {submitting ? "Submitting..." : "Submit & Lock"}
            </button>
          )}

          {viewMode === "preview" && (
            <button
              className="btn btn-primary"
              onClick={() => window.print()}
              style={{ padding: "8px 18px", fontSize: "0.84rem" }}
            >
              <Printer size={16} /> Print Official Report
            </button>
          )}
        </div>
      </div>

      {/* Progress & Verification Strip */}
      <div style={{
        background: "#ffffff",
        border: "1.5px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        padding: "16px 22px",
        marginBottom: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16
      }}>
        {/* Completion Progress Bar */}
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.84rem", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
              Mandatory Documentation Completion
            </span>
            <span style={{ fontWeight: 800, color: liveCompletion === 100 ? "var(--green-primary)" : "var(--warning)" }}>
              {liveCompletion}% (21 Sections)
            </span>
          </div>
          <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${liveCompletion}%`,
              background: liveCompletion === 100 ? "var(--green-primary)" : "var(--warning)",
              transition: "width 0.4s ease"
            }} />
          </div>
        </div>

        {/* Attendance Verification Pill */}
        <div style={{
          padding: "8px 16px",
          borderRadius: "var(--radius-md)",
          background: report?.attendance_eligibility?.is_eligible ? "#f0fdf4" : "#fffbeb",
          border: `1px solid ${report?.attendance_eligibility?.is_eligible ? "#bbf7d0" : "#fde68a"}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: "0.82rem"
        }}>
          {report?.attendance_eligibility?.is_eligible ? (
            <ShieldCheck size={18} color="var(--green-primary)" />
          ) : (
            <AlertTriangle size={18} color="var(--warning)" />
          )}
          <div>
            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
              Verified Attendance: {report?.attendance_eligibility?.attendance_pct}%
            </div>
            <div style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>
              {report?.attendance_eligibility?.is_eligible
                ? "Eligible for final documentation submission"
                : "Requires at least 75% verified attendance"}
            </div>
          </div>
        </div>
      </div>

      {/* Faculty Feedback Banner if Changes Requested */}
      {report?.status === "Changes Requested" && (
        <div style={{
          background: "#fffbeb",
          border: "2px solid #f59e0b",
          borderRadius: "var(--radius-md)",
          padding: "18px 24px",
          marginBottom: 24,
          color: "#92400e"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: "1rem", marginBottom: 6 }}>
            <AlertTriangle size={20} />
            <span>Faculty Review: Changes Requested by {report.reviewed_by}</span>
          </div>
          <p style={{ fontSize: "0.9rem", margin: "0 0 10px 0" }}>
            <strong>Faculty Feedback:</strong> {report.faculty_feedback}
          </p>
          <div style={{ fontSize: "0.82rem" }}>
            <strong>Unlocked Sections for Revision:</strong> {(report.unlocked_sections || []).join(", ") || "All sections"}
          </div>
        </div>
      )}

      {statusMsg && (
        <div style={{
          background: statusMsg.startsWith("✅") || statusMsg.startsWith("🎉") ? "var(--success-dim)" : "var(--danger-dim)",
          border: `1px solid ${statusMsg.startsWith("✅") || statusMsg.startsWith("🎉") ? "#bbf7d0" : "#fecaca"}`,
          color: statusMsg.startsWith("✅") || statusMsg.startsWith("🎉") ? "var(--green-primary)" : "var(--danger)",
          padding: "12px 18px",
          borderRadius: "var(--radius-md)",
          fontSize: "0.88rem",
          fontWeight: 600,
          marginBottom: 20
        }}>
          {statusMsg}
        </div>
      )}

      {/* ── MODE 1: INTERACTIVE 21-SECTION BUILDER ── */}
      {viewMode === "editor" && (
        <div className="grid-sidebar-layout">
          {/* Section Navigator Sidebar */}
          <div className="card" style={{ padding: "16px 0", maxHeight: "75vh", overflowY: "auto" }}>
            <div style={{ padding: "0 18px 12px", borderBottom: "1px solid var(--border-subtle)", fontWeight: 700, fontSize: "0.92rem" }}>
              Report Outline (21 Sections)
            </div>

            {SECTION_GROUPS.map((group, gIdx) => (
              <div key={gIdx} style={{ marginTop: 14 }}>
                <div style={{
                  padding: "4px 18px",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em"
                }}>
                  {group.group}
                </div>
                {group.items.map(item => {
                  const complete = isSectionComplete(item.key);
                  const isCurrent = activeKey === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActiveKey(item.key)}
                      style={{
                        width: "100%",
                        padding: "10px 18px",
                        textAlign: "left",
                        border: "none",
                        background: isCurrent ? "var(--green-tint)" : "transparent",
                        borderLeft: isCurrent ? "3px solid var(--green-primary)" : "3px solid transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <span style={{
                        fontSize: "0.82rem",
                        fontWeight: isCurrent ? 700 : 500,
                        color: isCurrent ? "var(--green-primary)" : "var(--text-primary)"
                      }}>
                        {item.title}
                      </span>
                      {complete ? (
                        <CheckCircle2 size={15} color="var(--green-primary)" />
                      ) : (
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Section Content Editor */}
          <div className="card" style={{ padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)" }}>
                {SECTION_GROUPS.flatMap(g => g.items).find(i => i.key === activeKey)?.title}
              </h3>
              {locked ? (
                <span className="badge badge-warning" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Lock size={12} /> Section Locked
                </span>
              ) : (
                <span className="badge badge-success" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Unlock size={12} /> Editable
                </span>
              )}
            </div>

            {/* Section-Specific Faculty Comments if any */}
            {comments.filter(c => c.section_key === activeKey).map(c => (
              <div key={c.id} style={{
                background: "#fef3c7",
                border: "1.5px solid #f59e0b",
                borderRadius: "var(--radius-sm)",
                padding: "12px 16px",
                marginBottom: 20,
                fontSize: "0.85rem",
                color: "#78350f"
              }}>
                <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                  <span>💬 Faculty Note from {c.faculty_name}:</span>
                  <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>{c.created_at ? new Date(c.created_at).toLocaleString() : ""}</span>
                </div>
                <div style={{ lineHeight: 1.5 }}>{c.comment}</div>
              </div>
            ))}

            {/* Custom section editor based on active key */}
            {activeKey === "cover_page" && (
              <div>
                <label className="label">Project / Internship Report Title</label>
                <input
                  type="text"
                  className="input"
                  disabled={locked}
                  value={sections.cover_page?.title || ""}
                  onChange={e => handleNestedChange("cover_page", "title", e.target.value)}
                  style={{ marginBottom: 16 }}
                />

                <div className="grid-2-col" style={{ marginBottom: 16 }}>
                  <div>
                    <label className="label">Institution Name</label>
                    <input
                      type="text"
                      className="input"
                      disabled={locked}
                      value={sections.cover_page?.institution || "Kongu Engineering College (Autonomous)"}
                      onChange={e => handleNestedChange("cover_page", "institution", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Academic Year</label>
                    <input
                      type="text"
                      className="input"
                      disabled={locked}
                      value={sections.cover_page?.academic_year || "2025 - 2026"}
                      onChange={e => handleNestedChange("cover_page", "academic_year", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeKey === "bonafide_certificate" && (
              <div>
                <label className="label">Certified Statement</label>
                <textarea
                  className="input"
                  rows={4}
                  disabled={locked}
                  value={sections.bonafide_certificate?.certified_text || ""}
                  onChange={e => handleNestedChange("bonafide_certificate", "certified_text", e.target.value)}
                  style={{ marginBottom: 16 }}
                />
                <div className="grid-2-col">
                  <div>
                    <label className="label">Faculty Coordinator / Mentor Name</label>
                    <input
                      type="text"
                      className="input"
                      disabled={locked}
                      value={sections.bonafide_certificate?.faculty_guide || ""}
                      onChange={e => handleNestedChange("bonafide_certificate", "faculty_guide", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Head of Department</label>
                    <input
                      type="text"
                      className="input"
                      disabled={locked}
                      value={sections.bonafide_certificate?.hod_name || ""}
                      onChange={e => handleNestedChange("bonafide_certificate", "hod_name", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeKey === "declaration" && (
              <div>
                <label className="label">Declaration Statement</label>
                <textarea
                  className="input"
                  rows={4}
                  disabled={locked}
                  value={sections.declaration?.text || ""}
                  onChange={e => handleNestedChange("declaration", "text", e.target.value)}
                />
              </div>
            )}

            {activeKey === "company_mentor_details" && (
              <div className="grid-2-col">
                <div>
                  <label className="label">Workplace Location / Address</label>
                  <input
                    type="text"
                    className="input"
                    disabled={locked}
                    value={sections.company_mentor_details?.location || ""}
                    onChange={e => handleNestedChange("company_mentor_details", "location", e.target.value)}
                    style={{ marginBottom: 16 }}
                  />
                </div>
                <div>
                  <label className="label">Industrial Mentor Name</label>
                  <input
                    type="text"
                    className="input"
                    disabled={locked}
                    value={sections.company_mentor_details?.mentor_name || ""}
                    onChange={e => handleNestedChange("company_mentor_details", "mentor_name", e.target.value)}
                    style={{ marginBottom: 16 }}
                  />
                </div>
                <div>
                  <label className="label">Mentor Designation</label>
                  <input
                    type="text"
                    className="input"
                    disabled={locked}
                    value={sections.company_mentor_details?.mentor_designation || ""}
                    onChange={e => handleNestedChange("company_mentor_details", "mentor_designation", e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Standard rich text editor for other sections */}
            {![
              "cover_page",
              "bonafide_certificate",
              "declaration",
              "company_mentor_details"
            ].includes(activeKey) && (
              <div>
                <label className="label" style={{ marginBottom: 8, display: "block" }}>
                  Detailed Content / Formal Documentation
                </label>
                <textarea
                  className="input"
                  rows={12}
                  disabled={locked}
                  placeholder={`Enter comprehensive content for ${activeKey.replace(/_/g, " ")}...`}
                  value={typeof sections[activeKey] === "string" ? sections[activeKey] : JSON.stringify(sections[activeKey] || "", null, 2)}
                  onChange={e => handleTextChange(activeKey, e.target.value)}
                  style={{ fontFamily: activeKey.includes("technologies") || activeKey.includes("table") ? "monospace" : "inherit" }}
                />
                <div style={{ marginTop: 8, fontSize: "0.78rem", color: "var(--text-dim)" }}>
                  Character count: {(typeof sections[activeKey] === "string" ? sections[activeKey] : "").length} (Minimum 10 characters required for completion mark).
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODE 2: HIGH-FIDELITY ACADEMIC PDF PREVIEW ── */}
      {viewMode === "preview" && (
        <div style={{
          background: "#ffffff",
          maxWidth: 850,
          margin: "0 auto",
          padding: "50px 60px",
          border: "1px solid #cbd5e1",
          borderRadius: "var(--radius-md)",
          boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
          fontFamily: "'Times New Roman', serif",
          color: "#0f172a",
          lineHeight: 1.6
        }}>
          {/* Institutional Header */}
          <div style={{ textAlign: "center", borderBottom: "2px solid #0f172a", paddingBottom: 20, marginBottom: 30 }}>
            <h2 style={{ fontSize: "1.45rem", fontWeight: "bold", margin: "0 0 4px 0", letterSpacing: "0.03em" }}>
              KONGU ENGINEERING COLLEGE
            </h2>
            <div style={{ fontSize: "0.92rem", fontWeight: "bold" }}>(Autonomous)</div>
            <div style={{ fontSize: "0.85rem", color: "#475569" }}>
              Affiliated to Anna University, Chennai · Accredited by NAAC with 'A++' Grade
            </div>
            <div style={{ fontSize: "0.85rem", color: "#475569" }}>
              Perundurai, Erode – 638060, Tamil Nadu, India
            </div>
          </div>

          {/* Cover Page Details */}
          <div style={{ textAlign: "center", margin: "40px 0" }}>
            <h3 style={{ fontSize: "1.3rem", fontWeight: "bold", textTransform: "uppercase", marginBottom: 20 }}>
              {sections.cover_page?.title || `INTERNSHIP REPORT AT ${report?.company_name?.toUpperCase()}`}
            </h3>
            <p style={{ fontStyle: "italic", fontSize: "0.95rem" }}>
              Submitted in partial fulfilment of the requirements for the award of the degree of
            </p>
            <h4 style={{ fontSize: "1.1rem", fontWeight: "bold" }}>
              BACHELOR OF ENGINEERING IN {report?.department?.toUpperCase()}
            </h4>

            <div style={{ margin: "30px 0" }}>
              <p style={{ margin: 0 }}>Submitted by</p>
              <h4 style={{ fontSize: "1.15rem", fontWeight: "bold", margin: "6px 0" }}>
                {report?.student_name}
              </h4>
              <p className="mono" style={{ fontSize: "0.95rem", fontWeight: "bold", margin: 0 }}>
                (Roll No: {report?.reg_no})
              </p>
            </div>

            <div style={{ marginTop: 30, fontSize: "0.9rem" }}>
              <p>Under the Industrial Supervision of</p>
              <strong>{sections.company_mentor_details?.mentor_name || "Industrial Technical Mentor"}</strong>, {sections.company_mentor_details?.mentor_designation || "Senior Technical Lead"}<br />
              <strong>{report?.company_name}</strong>
            </div>
          </div>

          <div style={{ pageBreakAfter: "always", height: 20 }} />

          {/* Bonafide Certificate */}
          <div style={{ marginTop: 40, borderTop: "1px solid #e2e8f0", paddingTop: 30 }}>
            <h3 style={{ textAlign: "center", textTransform: "uppercase", fontWeight: "bold", marginBottom: 20 }}>
              BONAFIDE CERTIFICATE
            </h3>
            <p style={{ textAlign: "justify", textIndent: "40px" }}>
              {sections.bonafide_certificate?.certified_text || `This is to certify that the internship report is the bonafide work of ${report?.student_name} (${report?.reg_no}) who carried out the industrial training at ${report?.company_name}.`}
            </p>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 60 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 160, borderBottom: "1px dashed #475569", marginBottom: 6 }} />
                <strong>FACULTY COORDINATOR</strong><br />
                <span style={{ fontSize: "0.85rem" }}>{sections.bonafide_certificate?.faculty_guide || "Department Guide"}</span>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 160, borderBottom: "1px dashed #475569", marginBottom: 6 }} />
                <strong>HEAD OF THE DEPARTMENT</strong><br />
                <span style={{ fontSize: "0.85rem" }}>Department of {report?.department}</span>
              </div>
            </div>
          </div>

          {/* Verified Attendance Snapshot */}
          <div style={{ marginTop: 40, borderTop: "1px solid #e2e8f0", paddingTop: 30 }}>
            <h4 style={{ fontWeight: "bold", marginBottom: 14 }}>
              APPENDIX: OFFICIAL ATTENDANCE &amp; GEOFENCE VERIFICATION
            </h4>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", marginBottom: 20 }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #cbd5e1" }}>
                  <td style={{ padding: "6px 0", fontWeight: "bold" }}>Total Required Training Days:</td>
                  <td>{report?.attendance_eligibility?.total_days || 30} days</td>
                  <td style={{ padding: "6px 0", fontWeight: "bold" }}>Verified Present Days:</td>
                  <td>{report?.attendance_eligibility?.present_days || 26} days</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #cbd5e1" }}>
                  <td style={{ padding: "6px 0", fontWeight: "bold" }}>Cumulative Attendance Ratio:</td>
                  <td style={{ fontWeight: "bold", color: "#16a34a" }}>{report?.attendance_eligibility?.attendance_pct}%</td>
                  <td style={{ padding: "6px 0", fontWeight: "bold" }}>Tamper-Resistant GPS Geofence:</td>
                  <td>Verified within 2.0 km of {report?.company_name}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Faculty Review Status Block */}
          {report?.status === "Approved" && (
            <div style={{
              marginTop: 30,
              padding: "16px 20px",
              border: "1.5px solid #16a34a",
              borderRadius: 6,
              background: "#f0fdf4",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <strong style={{ color: "#16a34a" }}>✓ FORMALLY APPROVED BY FACULTY EVALUATOR</strong>
                <div style={{ fontSize: "0.85rem", color: "#475569", marginTop: 4 }}>
                  Reviewed by: <strong>{report.reviewed_by}</strong> · Approved on: {report.reviewed_at?.substring(0, 10)}
                </div>
              </div>
              <ShieldCheck size={28} color="#16a34a" />
            </div>
          )}
        </div>
      )}

      {/* ── MODE 3: VERSION HISTORY ── */}
      {viewMode === "history" && (
        <div className="card" style={{ padding: "28px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 18 }}>
            Report Version History &amp; Immutable Revision Ledger
          </h3>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Saved At</th>
                <th>Saved By</th>
                <th>Completion</th>
                <th>Change Summary</th>
              </tr>
            </thead>
            <tbody>
              {versions.map(v => (
                <tr key={v.id}>
                  <td><strong>v{v.version_number}</strong></td>
                  <td className="mono">{v.created_at ? v.created_at.substring(0, 19).replace("T", " ") : "—"}</td>
                  <td>{v.saved_by_name} ({v.saved_by_role})</td>
                  <td style={{ fontWeight: 700, color: "var(--green-primary)" }}>{v.completion_pct}%</td>
                  <td>{v.change_summary || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
