import React from "react";
import { Award, Building, ShieldCheck, MapPin, Mail, Phone, Globe } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="app-container" style={{ padding: "30px 20px 60px" }}>
      {/* Hero Banner */}
      <div style={{
        background: "linear-gradient(135deg, #ffffff, #f0fdf4)",
        border: "1.5px solid #bbf7d0",
        borderRadius: "var(--radius-xl)",
        padding: "44px 36px",
        textAlign: "center",
        marginBottom: 32,
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
          marginBottom: 14,
          border: "1px solid #bbf7d0"
        }}>
          🏛️ Excellence in Technical Education Since 1984
        </div>
        <h1 style={{ fontSize: "2.3rem", fontWeight: 800, color: "var(--text-primary)" }}>
          Kongu Engineering College
        </h1>
        <p style={{ color: "var(--text-dim)", fontSize: "1.05rem", maxWidth: 700, margin: "10px auto 0", lineHeight: 1.6 }}>
          Perundurai, Erode, Tamil Nadu — Autonomous Institution affiliated to Anna University, accredited with 'A++' Grade by NAAC.
        </p>
      </div>

      {/* Grid Features */}
      <div className="grid-cards" style={{
        gap: 20,
        marginBottom: 32
      }}>
        <div className="card" style={{ padding: "28px" }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "var(--green-tint)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--green-primary)",
            marginBottom: 16,
            border: "1px solid #bbf7d0"
          }}>
            <Award size={22} />
          </div>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>
            Accreditations &amp; Recognition
          </h3>
          <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", lineHeight: 1.6 }}>
            Accredited by National Board of Accreditation (NBA) for all eligible undergraduate programmes, ranked prominently in NIRF, and awarded NAAC 'A++' Grade.
          </p>
        </div>

        <div className="card" style={{ padding: "28px" }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "var(--info-dim)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--info)",
            marginBottom: 16,
            border: "1px solid #bae6fd"
          }}>
            <Building size={22} />
          </div>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>
            Industry Collaboration Cell
          </h3>
          <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", lineHeight: 1.6 }}>
            Over 300+ corporate tie-ups with global organizations including Zoho, Amazon, Texas Instruments, Bosch, and L&amp;T ensuring 100% real-world exposure.
          </p>
        </div>

        <div className="card" style={{ padding: "28px" }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "var(--warning-dim)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--warning)",
            marginBottom: 16,
            border: "1px solid #fde68a"
          }}>
            <ShieldCheck size={22} />
          </div>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>
            Autonomous Verification
          </h3>
          <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", lineHeight: 1.6 }}>
            Automated GPS geofenced attendance tracking and strict academic guidelines ensuring minimum 75% attendance ratio for semester credit validation.
          </p>
        </div>
      </div>

      {/* Vision and Mission */}
      <div className="card" style={{ padding: "36px", marginBottom: 32 }}>
        <h3 style={{ fontSize: "1.35rem", fontWeight: 800, marginBottom: 18, color: "var(--text-primary)" }}>
          Vision &amp; Mission
        </h3>
        
        <div className="grid-2-col" style={{ gap: 24 }}>
          <div>
            <h4 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--green-primary)", marginBottom: 8 }}>
              Vision
            </h4>
            <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", lineHeight: 1.7 }}>
              To become a centre of excellence in engineering education and research, imparting quality technical education with moral values to transform students into globally competent leaders.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--green-primary)", marginBottom: 8 }}>
              Mission
            </h4>
            <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", lineHeight: 1.7 }}>
              To continuously improve the teaching-learning process, promote cutting-edge research, foster industry-institute partnerships, and instill social responsibility among young engineers.
            </p>
          </div>
        </div>
      </div>

      {/* Contact Section */}
      <div className="card" style={{ padding: "30px" }}>
        <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 16, color: "var(--text-primary)" }}>
          Contact Information
        </h3>
        <div className="grid-cards" style={{
          gap: 16,
          color: "var(--text-dim)",
          fontSize: "0.88rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <MapPin size={18} color="var(--green-primary)" />
            <span>Perundurai, Erode — 638060, Tamil Nadu</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Mail size={18} color="var(--green-primary)" />
            <span>internship@kongu.edu</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Phone size={18} color="var(--green-primary)" />
            <span>+91 4294 226555</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Globe size={18} color="var(--green-primary)" />
            <span>www.kongu.ac.in</span>
          </div>
        </div>
      </div>
    </div>
  );
}
