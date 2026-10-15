import React, { useState, useEffect } from "react";
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
import ReportBuilder from "./pages/ReportBuilder";
import ConsolidateDashboard from "./pages/ConsolidateDashboard";
import FacultyHome from "./pages/FacultyHome";
import DepartmentExplorer from "./pages/DepartmentExplorer";
import StudentDirectory from "./pages/StudentDirectory";
import StudentReportDetail from "./pages/StudentReportDetail";
import AboutPage from "./pages/AboutPage";

function AppContent() {
  const { user, role, loading } = useAuth();
  const [currentView, setCurrentView] = useState("landing");
  const [selectedStudentId, setSelectedStudentId] = useState(1);

  // Sync initial view with logged in state
  useEffect(() => {
    if (!loading) {
      if (user) {
        if (["faculty", "hod", "admin"].includes(role)) {
          setCurrentView((prev) => (prev === "landing" || prev.includes("login") ? "faculty-home" : prev));
        } else if (role === "student") {
          setCurrentView((prev) => (prev === "landing" || prev.includes("login") ? "student-home" : prev));
        }
      }
    }
  }, [user, role, loading]);

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

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar currentView={currentView} setView={setCurrentView} />
      <main style={{ flex: 1 }}>{renderView()}</main>
      <Footer />
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
