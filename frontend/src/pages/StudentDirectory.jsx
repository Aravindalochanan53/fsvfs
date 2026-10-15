import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { 
  Users, 
  Search, 
  Filter, 
  GraduationCap, 
  Building, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle,
  Lock
} from "lucide-react";

export default function StudentDirectory({ setView, onSelectStudent }) {
  const { user, role } = useAuth();
  const isFaculty = role === "faculty";
  const facultyDept = user?.department || "CSE";

  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState(isFaculty ? facultyDept : "ALL");
  const [semesterFilter, setSemesterFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isFaculty && facultyDept) {
      setDeptFilter(facultyDept);
    }
    loadStudents();
  }, [isFaculty, facultyDept]);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const res = await api.getStudents();
      setStudents(res.students || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const departments = isFaculty ? [facultyDept] : ["ALL", ...new Set(students.map((s) => s.department))];

  const filtered = students.filter((s) => {
    const matchesSearch =
      s.student_name.toLowerCase().includes(search.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(search.toLowerCase()) ||
      s.company_name.toLowerCase().includes(search.toLowerCase());
    const matchesDept = isFaculty ? s.department === facultyDept : (deptFilter === "ALL" || s.department === deptFilter);
    const matchesSem = semesterFilter === "ALL" || String(s.semester) === String(semesterFilter);
    return matchesSearch && matchesDept && matchesSem;
  });

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
          <Users size={14} /> Student Records &amp; Attendance Directory
        </div>
        <h2 style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--text-primary)" }}>
          Student Directory &amp; Reports
        </h2>
        <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", marginTop: 4 }}>
          {isFaculty 
            ? `Viewing student roster and daily attendance logs for Department of ${facultyDept}.`
            : "Search and inspect individual student attendance metrics, daily logs and 75% exam eligibility ratings."}
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
            <strong>Department Scope Active:</strong> Showing students from <strong>Department of {facultyDept}</strong>. As faculty coordinator, you are authorized to review your department's candidates.
          </span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card" style={{ padding: "18px 24px", marginBottom: 24 }}>
        <div style={{
          display: "flex",
          gap: 14,
          alignItems: "center",
          flexWrap: "wrap"
        }}>
          <div style={{ position: "relative", flex: "1 1 300px" }}>
            <input
              className="form-input"
              style={{ paddingLeft: 38 }}
              placeholder="Search by student name, roll number, company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={16} color="var(--green-primary)" style={{ position: "absolute", left: 14, top: 13 }} />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select
              className="form-select"
              style={{ width: "auto" }}
              value={deptFilter}
              disabled={isFaculty}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d === "ALL" ? "All Departments" : `Dept: ${d}`}
                </option>
              ))}
            </select>

            <select
              className="form-select"
              style={{ width: "auto" }}
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
            >
              <option value="ALL">All Semesters</option>
              <option value="4">Semester 4</option>
              <option value="5">Semester 5</option>
              <option value="6">Semester 6</option>
              <option value="7">Semester 7</option>
              <option value="8">Semester 8</option>
            </select>
          </div>
        </div>
      </div>

      {/* Student Cards Grid */}
      <div className="grid-cards" style={{ gap: 18 }}>
        {filtered.map((s) => {
          const eligible = s.attendance_pct >= 75.0;
          return (
            <div
              key={s.id}
              className="card"
              onClick={() => {
                if (onSelectStudent) onSelectStudent(s.id);
                setView("student-detail");
              }}
              style={{
                cursor: "pointer",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      background: "linear-gradient(135deg, var(--green-primary), var(--green-accent))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ffffff",
                      fontSize: "1.1rem",
                      fontWeight: 800,
                      boxShadow: "0 2px 8px rgba(21, 128, 61, 0.2)"
                    }}>
                      {s.student_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>
                        {s.student_name}
                      </h4>
                      <div className="mono" style={{ fontSize: "0.8rem", color: "var(--green-primary)", fontWeight: 700 }}>
                        {s.roll_number}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{
                      fontSize: "1.45rem",
                      fontWeight: 800,
                      color: eligible ? "var(--green-primary)" : "var(--danger)"
                    }}>
                      {s.attendance_pct}%
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                      Attendance
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  <span className="badge badge-info">{s.department}</span>
                  <span className="badge badge-success">Sem {s.semester || 6}</span>
                  <span className="badge badge-warning">{s.year_section || "III - A"}</span>
                </div>

                <div style={{
                  background: "#f8fafc",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 14px",
                  fontSize: "0.84rem",
                  color: "var(--text-dim)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}>
                  <Building size={15} color="var(--green-primary)" />
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{s.company_name}</span>
                </div>
              </div>

              <div style={{
                marginTop: 20,
                borderTop: "1.5px solid var(--border-subtle)",
                paddingTop: 14,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span style={{
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  color: eligible ? "var(--green-primary)" : "var(--danger)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4
                }}>
                  {eligible ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  {eligible ? "Eligible for Exams" : "Attendance Warning"}
                </span>

                <span style={{ fontSize: "0.8rem", color: "var(--green-primary)", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                  Full Report <ChevronRight size={14} />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
          <Users size={36} color="var(--text-muted)" style={{ margin: "0 auto 12px" }} />
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            No students found matching current filters.
          </p>
        </div>
      )}
    </div>
  );
}
