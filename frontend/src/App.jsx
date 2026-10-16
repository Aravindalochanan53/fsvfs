import React, { useState, useEffect, useCallback, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

// Pages
import LandingPage from "./pages/LandingPage";
import StudentLogin from "./pages/StudentLogin";
import StudentSignup from "./pages/StudentSignup";
import FacultyLogin from "./pages/FacultyLogin";
import FacultySignup from "./pages/FacultySignup";
import StudentHome from "./pages/StudentHome";
import AttendanceTracker from "./pages/AttendanceTracker";
import ReportBuilder from "./pages/LegacyReportBuilder";
import ConsolidateDashboard from "./pages/ConsolidateDashboard";
import FacultyHome from "./pages/FacultyHome";
import DepartmentExplorer from "./pages/DepartmentExplorer";
import StudentDirectory from "./pages/StudentDirectory";
import StudentReportDetail from "./pages/StudentReportDetail";
import AboutPage from "./pages/AboutPage";
import "./portal.css";

function AppContent() {
  const { user, role, loading } = useAuth();
  const [currentView, updateView] = useState("landing");
  const [selectedStudentId, updateStudentId] = useState(1);
  const viewRef = useRef("landing");
  const studentRef = useRef(1);

  const setSelectedStudentId = useCallback((id) => {
    studentRef.current = id;
    updateStudentId(id);
  }, []);

  const setCurrentView = useCallback((next) => {
    const view = typeof next === "function" ? next(viewRef.current) : next;
    if (view === viewRef.current) return;
    window.history.pushState(
      { kecView: view, studentId: studentRef.current },
      "",
      view === "landing" ? window.location.pathname : `#/${view}`,
    );
    viewRef.current = view;
    updateView(view);
    window.scrollTo(0, 0);
  }, []);

  // Keep portal navigation in browser history so Back/Forward moves one
  // visited portal page at a time. Fresh loads still require explicit login.
  useEffect(() => {
    window.history.replaceState({ kecView: "landing", studentId: 1 }, "", window.location.pathname);
    const onPopState = (event) => {
      const view = event.state?.kecView || "landing";
      viewRef.current = view;
      updateView(view);
      const id = event.state?.studentId || 1;
      studentRef.current = id;
      updateStudentId(id);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-main)",
        color: "var(--green-bright)",
        fontFamily: "'Sora', sans-serif",
        fontSize: "1.1rem"
      }}>
        Initializing Kongu Academic Portal...
      </div>
    );
  }

  const renderView = () => {
    const studentViews = ["student-home", "student-attendance", "student-report"];
    const staffViews = ["faculty-home", "departments", "students", "student-detail", "consolidate"];
    const isStaff = ["faculty", "hod", "admin"].includes(role);
    if (studentViews.includes(currentView) && (!user || role !== "student")) {
      return user && isStaff
        ? <FacultyHome setView={setCurrentView} />
        : <StudentLogin setView={setCurrentView} />;
    }
    if (staffViews.includes(currentView) && (!user || !isStaff)) {
      return user && role === "student"
        ? <StudentHome setView={setCurrentView} />
        : <FacultyLogin setView={setCurrentView} />;
    }
    switch (currentView) {
      case "landing":
        return <LandingPage setView={setCurrentView} />;
      case "student-login":
        return <StudentLogin setView={setCurrentView} />;
      case "student-signup":
        return <StudentSignup setView={setCurrentView} />;
      case "faculty-login":
        return <FacultyLogin setView={setCurrentView} />;
      case "faculty-signup":
        return <FacultySignup setView={setCurrentView} />;
      
      // Student Pages
      case "student-home":
        return <StudentHome setView={setCurrentView} />;
      case "student-attendance":
        return <AttendanceTracker setView={setCurrentView} />;
      case "student-report":
        return <ReportBuilder setView={setCurrentView} />;
      
      // Faculty Pages
      case "faculty-home":
        return <FacultyHome setView={setCurrentView} />;
      case "departments":
        return (
          <DepartmentExplorer
            setView={setCurrentView}
            onSelectStudent={(id) => setSelectedStudentId(id)}
          />
        );
      case "students":
        return (
          <StudentDirectory
            setView={setCurrentView}
            onSelectStudent={(id) => setSelectedStudentId(id)}
          />
        );
      case "student-detail":
        return (
          <StudentReportDetail
            studentId={selectedStudentId}
            setView={setCurrentView}
          />
        );

      // Shared
      case "consolidate":
        return ["faculty", "hod", "admin"].includes(role)
          ? <ConsolidateDashboard setView={setCurrentView} />
          : <StudentHome setView={setCurrentView} />;
      case "about":
        return <AboutPage setView={setCurrentView} />;

      default:
        return <LandingPage setView={setCurrentView} />;
    }
  };

  const fullScreen = ["landing", "student-login", "faculty-login"].includes(currentView);
  const pageTitles = { "student-home": "My workspace", "faculty-home": "Faculty overview", "student-attendance": "Attendance", "student-report": "Internship report", departments: "Departments", students: "Student directory", "student-detail": "Student overview", consolidate: "Consolidated dashboard", about: "About the portal" };
  return (
    <div className={!fullScreen && user ? "portal-shell" : ""} style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {!["landing", "student-login", "faculty-login"].includes(currentView) && <Navbar currentView={currentView} setView={setCurrentView} />}
      <main className="portal-main" style={{ flex: 1 }}>
        {!fullScreen && user && <header className="workspace-topbar"><div><span className="workspace-breadcrumb">KEC / {role === 'student' ? 'Student portal' : 'Faculty portal'}</span><strong>{pageTitles[currentView] || 'Workspace'}</strong></div><div className="workspace-context"><span className="workspace-dept">{user.department}</span><time dateTime={new Date().toISOString().slice(0,10)}>{new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())}</time></div></header>}
        {renderView()}
      </main>
      {!["landing", "student-login", "faculty-login"].includes(currentView) && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
