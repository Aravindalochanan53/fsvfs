import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { 
  Building2, 
  Users, 
  Briefcase, 
  ChevronRight, 
  Search,
  Lock,
  RefreshCw
} from "lucide-react";

export default function DepartmentExplorer({ setView, onSelectStudent }) {
  const { user, role } = useAuth();
  const isFaculty = ["faculty", "hod"].includes(role);
  const facultyDept = user?.department || "CSE";

  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState(isFaculty ? facultyDept : "CSE");
  const [rosterData, setRosterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [listError, setListError] = useState("");

  useEffect(() => {
    let ignore = false;
    const fetchDeptList = async () => {
      setLoading(true);
      try {
        const res = await api.getDepartments();
        if (!ignore) {
          setDepartments(res.departments || []);
          setListError("");
        }
      } catch (err) {
        if (!ignore) setListError(err.message || "Department counts could not load.");
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    fetchDeptList();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedDept) return;
    let ignore = false;
    const fetchRoster = async () => {
      setRosterLoading(true);
      setRosterData(null);
      setErrorMsg("");
      setSearch("");
      try {
        const res = await api.getDepartmentRoster(selectedDept);
        if (!ignore) {
          setRosterData(res);
          setErrorMsg("");
        }
      } catch (err) {
        if (!ignore) {
          setErrorMsg(err.message || "Failed to load department roster.");
          setRosterData(null);
        }
      } finally {
        if (!ignore) setRosterLoading(false);
      }
    };
    fetchRoster();
    return () => {
      ignore = true;
    };
  }, [selectedDept, refreshKey]);

  const currentDeptInfo = rosterData?.department;
  const students = rosterData?.students || [];

  const filteredStudents = students.filter(
    (s) =>
      (s.student_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.roll_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.company_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-container" style={{ padding: "30px 20px 60px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "var(--green-tint)",
          color: "var(--green-primary)",
          padding: "4px 12px",
          borderRadius: 9999,
          fontSize: "0.76rem",
          fontWeight: 700,
          marginBottom: 8,
          border: "1px solid #bbf7d0"
        }}>
          <Building2 size={14} /> Academic Programmes Directory
        </div>
        <h2 style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--text-primary)" }}>
          Department Explorer
        </h2>
        <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", marginTop: 4 }}>
          {isFaculty 
            ? `Institutional faculty view: Scoped to your assigned Department of ${facultyDept}.`
            : "Select any undergraduate engineering programme to view student registries and hiring companies."}
        </p>
      </div>

      {/* Faculty Restriction Notice Banner */}
      {isFaculty && (
        <div style={{
          background: "var(--green-tint)",
          border: "1.5px solid #86efac",
          borderRadius: "var(--radius-md)",
          padding: "12px 18px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "var(--green-primary)",
          fontSize: "0.85rem",
          fontWeight: 600
        }}>
          <Lock size={16} />
          <span>
            <strong>Department Isolation Active:</strong> As a faculty mentor in <strong>Department of {facultyDept}</strong>, you can only view students and internships registered in your department.
          </span>
        </div>
      )}

      {/* Department Branch Chips Horizontal Scroll */}
      <div style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        paddingBottom: 10,
        marginBottom: 24,
        scrollbarWidth: "none"
      }}>
        {loading ? (
          <div style={{ padding: "10px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Loading department programmes...
          </div>
        ) : (
          departments.map((d) => {
            const isSelected = selectedDept === d.code;
            const isDisabled = isFaculty && d.code !== facultyDept;

            return (
              <button
                key={d.code}
                disabled={isDisabled}
                onClick={() => setSelectedDept(d.code)}
                aria-label={`Select department ${d.name}`}
                style={{
                  background: isSelected ? "var(--green-primary)" : "#ffffff",
                  border: `1.5px solid ${isSelected ? "var(--green-primary)" : "var(--border-subtle)"}`,
                  color: isSelected ? "#ffffff" : isDisabled ? "#94a3b8" : "var(--text-primary)",
                  padding: "9px 18px",
                  borderRadius: "var(--radius-full)",
                  fontSize: "0.84rem",
                  fontWeight: 700,
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.2s",
                  boxShadow: isSelected ? "0 4px 14px rgba(21, 128, 61, 0.25)" : "var(--shadow-sm)",
                  opacity: isDisabled ? 0.45 : 1
                }}
                title={isDisabled ? `Restricted: You are in Department ${facultyDept}` : d.name}
              >
                <span>{d.code}</span>
                <span style={{
                  background: isSelected ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                  fontSize: "0.72rem",
                  padding: "2px 7px",
                  borderRadius: 10,
                  color: isSelected ? "#ffffff" : "var(--green-primary)",
                  fontWeight: 700
                }}>
                  {d.total_students ?? "—"}
                </span>
              </button>
            );
          })
        )}
      </div>

      {(errorMsg || listError) && (
        <div role="alert" style={{
          background: "var(--danger-dim)",
          border: "1px solid #fecaca",
          color: "var(--danger)",
          padding: "12px 18px",
          borderRadius: "var(--radius-md)",
          fontSize: "0.85rem",
          marginBottom: 20
        }}>
          {errorMsg || listError}
          <button className="btn btn-secondary" style={{ marginLeft: 12 }} onClick={() => setRefreshKey((value) => value + 1)}>Retry</button>
        </div>
      )}

      {/* Selected Department Overview Banner */}
      <div style={{
        background: "linear-gradient(135deg, #ffffff, #f0fdf4)",
        border: "1.5px solid #bbf7d0",
        borderRadius: "var(--radius-xl)",
        padding: "26px 30px",
        marginBottom: 24,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16,
        boxShadow: "var(--shadow-sm)"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h3 style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--text-primary)" }}>
              {currentDeptInfo ? `${currentDeptInfo.degree} ${currentDeptInfo.name}` : `Department of ${selectedDept}`}
            </h3>
            <span className="badge badge-success" style={{ fontSize: "0.8rem" }}>
              {selectedDept}
            </span>
          </div>
          <p style={{ color: "var(--text-dim)", fontSize: "0.86rem" }}>
            Duration: <strong style={{ color: "var(--text-primary)" }}>{currentDeptInfo?.duration || "4 Years"}</strong> · 
            Curriculum: Autonomous KEC Regulation · AICTE &amp; Anna University Approved
          </p>
        </div>

        {/* Stats Bar */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div style={{
            background: "#ffffff",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "10px 18px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: "var(--shadow-sm)"
          }}>
            <Users size={22} color="var(--green-primary)" />
            <div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Total Students</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>{rosterData ? rosterData.total_enrolled : rosterLoading ? "…" : "—"}</div>
            </div>
          </div>

          <div style={{
            background: "#ffffff",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "10px 18px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: "var(--shadow-sm)"
          }}>
            <Briefcase size={22} color="var(--info)" />
            <div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Hiring Companies</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>{currentDeptInfo?.total_companies ?? (rosterLoading ? "…" : "—")}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Roster Table Card */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{
          padding: "18px 24px",
          borderBottom: "1.5px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12
        }}>
          <div>
            <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Student Roster — Department of {selectedDept}
            </h4>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              {rosterLoading ? "Loading enrolled students…" : errorMsg ? "Student records could not be loaded." : `${filteredStudents.length} students currently registered for internships`}
            </p>
          </div>

          <div style={{ position: "relative", width: 240 }}>
            <input
              className="form-input"
              style={{ padding: "8px 12px 8px 34px", fontSize: "0.84rem" }}
              placeholder="Search student or company..."
              value={search}
              aria-label="Search student roster"
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={14} color="var(--green-primary)" style={{ position: "absolute", left: 12, top: 11 }} />
          </div>
        </div>

        <div className="table-responsive" style={{ border: "none" }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th scope="col">Roll Number</th>
                <th scope="col">Student Name</th>
                <th scope="col">Department</th>
                <th scope="col">Company Name</th>
                <th scope="col">Year &amp; Section</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {rosterLoading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <RefreshCw size={16} className="spin" color="var(--green-primary)" />
                      <span>Loading student roster...</span>
                    </div>
                  </td>
                </tr>
              ) : errorMsg ? (
                <tr><td colSpan="6" style={{ textAlign: "center", padding: 36 }}>Unable to load student records. Use Retry above.</td></tr>
              ) : filteredStudents.length > 0 ? (
                filteredStudents.map((s) => (
                  <tr key={s.id}>
                    <td className="mono" style={{ color: "var(--green-primary)", fontWeight: 700 }}>
                      {s.roll_number}
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>{s.student_name}</td>
                    <td>
                      <span className="badge badge-info">{s.department}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: "var(--green-tint)",
                          color: "var(--green-primary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          border: "1px solid #bbf7d0"
                        }}>
                          {(s.company_name || "CO").substring(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{s.company_name || "Not assigned"}</span>
                      </div>
                    </td>
                    <td style={{ color: "var(--text-dim)", fontSize: "0.84rem" }}>{s.year_section || "—"}</td>
                    <td>
                      <button
                        className="btn btn-outline"
                        style={{ padding: "6px 12px", fontSize: "0.76rem" }}
                        onClick={() => {
                          if (onSelectStudent) onSelectStudent(s.id);
                          setView("student-detail");
                        }}
                      >
                        View Report <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
                    {search ? `No students matched "${search}".` : `No students registered for Department of ${selectedDept}.`}
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
