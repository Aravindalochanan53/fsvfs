import React from "react";
import { useAuth } from "../context/AuthContext";
import { 
  GraduationCap, 
  MapPin, 
  FileText, 
  BarChart3, 
  Building2, 
  Users, 
  Info, 
  LogOut, 
  Home
} from "lucide-react";

export default function Navbar({ currentView, setView }) {
  const { user, role, logout } = useAuth();

  return (
    <header className="site-navbar">
      <button type="button" className="nav-brand" aria-label="Kongu portal home" onClick={() => setView(["faculty", "hod", "admin"].includes(role) ? "faculty-home" : role === "student" ? "student-home" : "landing")}>
        <div className="brand-icon-box">
          <GraduationCap size={22} />
        </div>
        <div className="brand-text">
          <h3>KONGU</h3>
          <p>INTERNSHIP PORTAL</p>
        </div>
      </button>

      <nav className="nav-links" aria-label="Main navigation">
        {/* Guest Nav */}
        {!user && (
          <>
            <button
              className={`nav-link-btn ${currentView === "landing" ? "active" : ""}`}
              onClick={() => setView("landing")}
            >
              <Home size={15} /> Home
            </button>
            <button
              className={`nav-link-btn ${currentView === "student-home" ? "active" : ""}`}
              onClick={() => setView("student-home")}
            >
              Student Portal
            </button>
            <button
              className={`nav-link-btn ${currentView === "faculty-login" ? "active" : ""}`}
              onClick={() => setView("faculty-login")}
            >
              Teacher Portal
            </button>
            <button
              className={`nav-link-btn ${currentView === "about" ? "active" : ""}`}
              onClick={() => setView("about")}
            >
              <Info size={15} /> About Us
            </button>
          </>
        )}

        {/* Student Nav */}
        {user && role === "student" && (
          <>
            <button
              className={`nav-link-btn ${currentView === "student-home" ? "active" : ""}`}
              onClick={() => setView("student-home")}
            >
              <Home size={15} /> Home
            </button>
            <button
              className={`nav-link-btn ${currentView === "student-attendance" ? "active" : ""}`}
              onClick={() => setView("student-attendance")}
            >
              <MapPin size={15} /> Attendance
            </button>
            <button
              className={`nav-link-btn ${currentView === "student-report" ? "active" : ""}`}
              onClick={() => setView("student-report")}
            >
              <FileText size={15} /> Internship Report
            </button>
            <button
              className={`nav-link-btn ${currentView === "about" ? "active" : ""}`}
              onClick={() => setView("about")}
            >
              <Info size={15} /> About
            </button>
          </>
        )}

        {/* Faculty Nav */}
        {user && ["faculty", "hod", "admin"].includes(role) && (
          <>
            <button
              className={`nav-link-btn ${currentView === "faculty-home" ? "active" : ""}`}
              onClick={() => setView("faculty-home")}
            >
              <Home size={15} /> Faculty Dashboard
            </button>
            <button
              className={`nav-link-btn ${currentView === "departments" ? "active" : ""}`}
              onClick={() => setView("departments")}
            >
              <Building2 size={15} /> Departments
            </button>
            <button
              className={`nav-link-btn ${currentView === "students" ? "active" : ""}`}
              onClick={() => setView("students")}
            >
              <Users size={15} /> Students
            </button>
            <button
              className={`nav-link-btn ${currentView === "consolidate" ? "active" : ""}`}
              onClick={() => setView("consolidate")}
            >
              <BarChart3 size={15} /> Consolidate
            </button>
            <button
              className={`nav-link-btn ${currentView === "about" ? "active" : ""}`}
              onClick={() => setView("about")}
            >
              <Info size={15} /> About
            </button>
          </>
        )}

        {/* User Pill & Logout */}
        {user && (
          <div className="nav-user-pill">
            <div className="user-avatar-small">
              {(user.student_name || user.faculty_name || "U")[0]}
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-primary)" }}>
                {user.student_name || user.faculty_name}
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--green-primary)", fontWeight: 600 }}>
              {user.roll_number || user.faculty_id} · {user.department || role}
              </div>
            </div>
            <button
              className="logout-btn"
              title="Logout"
              aria-label="Log out"
              onClick={() => {
                logout();
                setView("landing");
              }}
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}
