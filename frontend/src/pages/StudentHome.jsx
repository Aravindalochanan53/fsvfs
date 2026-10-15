import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { 
  MapPin, 
  FileText, 
  BarChart3, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  Sparkles, 
  Building2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Clock,
  Calendar,
  AlertTriangle
} from "lucide-react";

const SLIDES = [
  {
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=80",
    title: "🎓 Launch Your Engineering Career",
    subtitle: "Connect with leading industry partners through the KEC Internship Portal",
  },
  {
    image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200&q=80",
    title: "⚙️ Industry-Ready Training",
    subtitle: "Hands-on experience in production environments and engineering labs",
  },
  {
    image: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&q=80",
    title: "🏛️ Kongu Engineering College",
    subtitle: "Perundurai, Erode — autonomous centre of academic excellence",
  },
  {
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80",
    title: "📊 Geofenced Smart Attendance",
    subtitle: "Automated GPS attendance tracking, 7-chapter documentation & audit metrics",
  },
];

export default function StudentHome({ setView }) {
  const { user } = useAuth();
  const [activeSlide, setActiveSlide] = useState(0);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getAttendanceStats().catch(() => null),
      api.getMyReport().catch(() => null)
    ])
      .then(([attRes, repRes]) => {
        if (attRes?.stats) setAttendanceStats(attRes.stats);
        if (repRes) setReportData(repRes);
      })
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => setActiveSlide((prev) => (prev + 1) % SLIDES.length);
  const prevSlide = () => setActiveSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);

  return (
    <div className="app-container" style={{ paddingBottom: 60 }}>
      {/* Welcome Banner */}
      <div style={{
        marginTop: 28,
        background: "linear-gradient(135deg, #ffffff, #f0fdf4)",
        border: "1.5px solid #bbf7d0",
        borderRadius: "var(--radius-xl)",
        padding: "26px 32px",
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
            padding: "3px 12px",
            borderRadius: 9999,
            fontSize: "0.76rem",
            fontWeight: 700,
            marginBottom: 8,
            border: "1px solid #bbf7d0"
          }}>
            <Sparkles size={13} /> Active Student Session
          </div>
          <h2 style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-primary)" }}>
            Welcome back, {user?.student_name || "Student"}!
          </h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", marginTop: 4 }}>
            Roll No: <span className="mono" style={{ color: "var(--text-primary)", fontWeight: 700 }}>{user?.roll_number}</span> · 
            Company: <strong style={{ color: "var(--green-primary)" }}>{user?.company_name}</strong> · 
            Department: <strong>{user?.department}</strong>
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn btn-primary"
            onClick={() => setView("student-attendance")}
            style={{ padding: "10px 20px", fontSize: "0.88rem" }}
          >
            <MapPin size={16} /> Mark Today's Attendance
          </button>
        </div>
      </div>

      {/* Carousel Section */}
      <div style={{
        marginTop: 24,
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
        position: "relative",
        height: 360,
        boxShadow: "var(--shadow-md)",
        border: "1px solid var(--border-card)"
      }}>
        {SLIDES.map((slide, idx) => (
          <div
            key={idx}
            style={{
              position: "absolute",
              inset: 0,
              opacity: activeSlide === idx ? 1 : 0,
              transition: "opacity 0.8s ease-in-out",
              pointerEvents: activeSlide === idx ? "auto" : "none"
            }}
          >
            <img
              src={slide.image}
              alt={slide.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "brightness(0.5)"
              }}
            />
            <div style={{
              position: "absolute",
              bottom: 36,
              left: 36,
              right: 36,
              zIndex: 10
            }}>
              <h2 style={{
                fontSize: "2rem",
                fontWeight: 800,
                color: "#ffffff",
                textShadow: "0 2px 12px rgba(0,0,0,0.6)"
              }}>
                {slide.title}
              </h2>
              <p style={{
                color: "#bbf7d0",
                fontSize: "1.05rem",
                marginTop: 6,
                maxWidth: 600,
                textShadow: "0 2px 8px rgba(0,0,0,0.7)"
              }}>
                {slide.subtitle}
              </p>
            </div>
          </div>
        ))}

        {/* Carousel Controls */}
        <button
          onClick={prevSlide}
          style={{
            position: "absolute",
            left: 16,
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.75)",
            backdropFilter: "blur(6px)",
            border: "1px solid #cbd5e1",
            color: "#0f172a",
            width: 40,
            height: 40,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 20
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={nextSlide}
          style={{
            position: "absolute",
            right: 16,
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.75)",
            backdropFilter: "blur(6px)",
            border: "1px solid #cbd5e1",
            color: "#0f172a",
            width: 40,
            height: 40,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 20
          }}
        >
          <ChevronRight size={20} />
        </button>

        {/* Indicators */}
        <div style={{
          position: "absolute",
          bottom: 14,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 8,
          zIndex: 20
        }}>
          {SLIDES.map((_, idx) => (
            <div
              key={idx}
              onClick={() => setActiveSlide(idx)}
              style={{
                width: activeSlide === idx ? 28 : 8,
                height: 6,
                borderRadius: 3,
                background: activeSlide === idx ? "#22c55e" : "rgba(255,255,255,0.5)",
                cursor: "pointer",
                transition: "all 0.3s ease"
              }}
            />
          ))}
        </div>
      </div>

      {/* Live Academic & Attendance KPI Strip */}
      <div className="grid-cards" style={{
        marginTop: 24,
        gap: 16
      }}>
        {/* Metric 1: Verified Attendance */}
        <div className="card" style={{ padding: "20px 24px", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Verified Attendance
              </p>
              <h3 style={{ fontSize: "1.9rem", fontWeight: 800, color: (attendanceStats?.attendance_pct ?? 0) >= 75 ? "var(--green-primary)" : "#f59e0b", marginTop: 4 }}>
                {statsLoading ? "..." : `${attendanceStats?.attendance_pct ?? 0}%`}
              </h3>
            </div>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: (attendanceStats?.attendance_pct ?? 0) >= 75 ? "var(--green-tint)" : "#fef3c7",
              color: (attendanceStats?.attendance_pct ?? 0) >= 75 ? "var(--green-primary)" : "#d97706",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, fontSize: "0.76rem" }}>
            {(attendanceStats?.attendance_pct ?? 0) >= 75 ? (
              <span style={{ color: "var(--green-primary)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <CheckCircle2 size={13} /> Eligible for Report (≥ 75%)
              </span>
            ) : (
              <span style={{ color: "#d97706", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <AlertTriangle size={13} /> Requires ≥ 75% for Report
              </span>
            )}
          </div>
          <p style={{ fontSize: "0.76rem", color: "var(--text-dim)", marginTop: 4 }}>
            {attendanceStats?.present_days ?? 0} verified present out of {attendanceStats?.total_days ?? 0} recorded days
          </p>
        </div>

        {/* Metric 2: Total Hours Logged */}
        <div className="card" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Total Verified Hours
              </p>
              <h3 style={{ fontSize: "1.9rem", fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>
                {statsLoading ? "..." : `${attendanceStats?.total_hours ?? 0} hrs`}
              </h3>
            </div>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: "var(--info-dim)",
              color: "var(--info)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Clock size={20} />
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: "0.76rem", color: "var(--text-dim)" }}>
            Min. <strong style={{ color: "var(--text-primary)" }}>3.0 hrs/day</strong> required for Verified Present status
          </div>
        </div>

        {/* Metric 3: Attendance Breakdown */}
        <div className="card" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Status Breakdown
              </p>
              <h3 style={{ fontSize: "1.9rem", fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>
                {statsLoading ? "..." : `${attendanceStats?.present_days ?? 0}`} <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-dim)" }}>days verified</span>
              </h3>
            </div>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: "#ede9fe",
              color: "#7c3aed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Calendar size={20} />
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", fontSize: "0.73rem" }}>
            <span style={{ background: "var(--green-tint)", color: "var(--green-primary)", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
              {attendanceStats?.present_days ?? 0} Verified
            </span>
            <span style={{ background: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>
              {attendanceStats?.half_days ?? 0} Half
            </span>
            <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>
              {attendanceStats?.incomplete_days ?? 0} Incomplete
            </span>
          </div>
        </div>

        {/* Metric 4: 21-Section Report Progress */}
        <div className="card" style={{ padding: "20px 24px", cursor: "pointer", border: "1.5px solid #cbd5e1" }} onClick={() => setView("student-report")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Internship Report
              </p>
              <h3 style={{ fontSize: "1.9rem", fontWeight: 800, color: reportData?.completion_pct === 100 ? "var(--green-primary)" : "var(--info)", marginTop: 4 }}>
                {statsLoading ? "..." : `${reportData?.completion_pct ?? 0}%`}
              </h3>
            </div>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: "var(--info-dim)",
              color: "var(--info)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <FileText size={20} />
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{
              fontSize: "0.73rem",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 6,
              background: reportData?.status === "Approved" ? "var(--green-tint)" : reportData?.status === "Submitted" ? "var(--info-dim)" : reportData?.status === "Changes Requested" ? "#fef3c7" : "#f1f5f9",
              color: reportData?.status === "Approved" ? "var(--green-primary)" : reportData?.status === "Submitted" ? "var(--info)" : reportData?.status === "Changes Requested" ? "#b45309" : "var(--text-dim)"
            }}>
              {reportData?.status || "Draft (In Progress)"}
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--green-primary)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 2 }}>
              Open <ArrowRight size={12} />
            </span>
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid-cards" style={{
        gap: 20,
        marginTop: 36
      }}>
        {/* Card 1: Attendance */}
        <div className="card" style={{ padding: "28px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{
              width: 50,
              height: 50,
              borderRadius: 14,
              background: "var(--green-tint)",
              border: "1px solid #bbf7d0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--green-primary)",
              marginBottom: 16
            }}>
              <MapPin size={24} />
            </div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>
              Geofenced Attendance Tracker
            </h3>
            <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", lineHeight: 1.6 }}>
              Check-in and check-out daily with automatic GPS distance verification against your internship company location. Enforces daily check-in lock and minimum 3-hour work duration.
            </p>
          </div>
          <button
            className="btn btn-outline"
            style={{ width: "100%", marginTop: 22 }}
            onClick={() => setView("student-attendance")}
          >
            Launch Attendance Tracker <ArrowRight size={16} />
          </button>
        </div>

        {/* Card 2: 21-Section Report */}
        <div className="card" style={{ padding: "28px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{
              width: 50,
              height: 50,
              borderRadius: 14,
              background: "var(--info-dim)",
              border: "1px solid #bae6fd",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--info)",
              marginBottom: 16
            }}>
              <FileText size={24} />
            </div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>
              21-Section Internship Report
            </h3>
            <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", lineHeight: 1.6 }}>
              Professional report module with 21 mandatory sections, draft auto-save, version history, printable academic PDF export, and faculty evaluation workflow.
            </p>
          </div>
          <button
            className="btn btn-outline"
            style={{ width: "100%", marginTop: 22 }}
            onClick={() => setView("student-report")}
          >
            Build Internship Report <ArrowRight size={16} />
          </button>
        </div>

      </div>

      {/* Feature Highlight Strip */}
      <div style={{
        marginTop: 44,
        background: "#ffffff",
        borderRadius: "var(--radius-xl)",
        padding: "36px 32px",
        border: "1px solid var(--border-card)",
        boxShadow: "var(--shadow-sm)"
      }}>
        <h3 style={{ textAlign: "center", fontSize: "1.5rem", fontWeight: 800, marginBottom: 6, color: "var(--text-primary)" }}>
          What We Offer
        </h3>
        <p style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "0.92rem", marginBottom: 30 }}>
          Everything you need to complete and certify your engineering internship
        </p>

        <div className="grid-cards" style={{
          gap: 20
        }}>
          <div style={{
            background: "#f8fafc",
            padding: "24px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)"
          }}>
            <span style={{ fontSize: "2rem", display: "block", marginBottom: 12 }}>📌</span>
            <h4 style={{ color: "var(--green-primary)", marginBottom: 8, fontWeight: 700 }}>Easy Tracking</h4>
            <p style={{ color: "var(--text-dim)", fontSize: "0.86rem", lineHeight: 1.5 }}>
              Maintain internship records with automated check-ins and GPS-verified accuracy.
            </p>
          </div>

          <div style={{
            background: "#f8fafc",
            padding: "24px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)"
          }}>
            <span style={{ fontSize: "2rem", display: "block", marginBottom: 12 }}>🔒</span>
            <h4 style={{ color: "var(--green-primary)", marginBottom: 8, fontWeight: 700 }}>Secure Cloud Database</h4>
            <p style={{ color: "var(--text-dim)", fontSize: "0.86rem", lineHeight: 1.5 }}>
              All records stored securely with role-based permissions and academic tamper protection.
            </p>
          </div>

          <div style={{
            background: "#f8fafc",
            padding: "24px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)"
          }}>
            <span style={{ fontSize: "2rem", display: "block", marginBottom: 12 }}>⚡</span>
            <h4 style={{ color: "var(--green-primary)", marginBottom: 8, fontWeight: 700 }}>Instant Reports</h4>
            <p style={{ color: "var(--text-dim)", fontSize: "0.86rem", lineHeight: 1.5 }}>
              Generate comprehensive 7-chapter PDF-ready documents with one-click export for faculty review.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
