import React from "react";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-content">
        <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
          🏛️ Kongu Engineering College
        </h4>
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: 4 }}>
          Autonomous Institution · Affiliated to Anna University · Accredited by NAAC with 'A++' Grade
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: 4 }}>
          Perundurai, Erode, Tamil Nadu — 638060 | Email: internship@kongu.edu
        </p>
        <div className="footer-line"></div>
        <p style={{ color: "var(--green-light)", fontSize: "0.78rem" }}>
          Empowering future engineers with industry-grade internship analytics &amp; automated reporting
        </p>
      </div>
    </footer>
  );
}
