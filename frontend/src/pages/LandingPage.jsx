import React from "react";
import { GraduationCap, Briefcase, ArrowUpRight, ArrowRight, MapPin, FileText, ShieldCheck, Compass } from "lucide-react";
import "./LandingPage.css";

export default function LandingPage({ setView }) {
  return <div className="kec-landing">
    <section className="kec-hero" aria-labelledby="landing-title">
      <div className="kec-copy">
        <div className="kec-eyebrow"><span /> KONGU ENGINEERING COLLEGE / INTERNSHIPS</div>
        <h1 id="landing-title">Your next chapter.<br /><span>Beyond the classroom.</span></h1>
        <p className="kec-description">Turn learning into experience. Manage your internship, track every milestone, and keep your academic journey moving forward.</p>
        <div className="kec-actions"><a href="#portal-access">Find your workspace <ArrowRight size={18} /></a><button onClick={() => setView("about")}>Explore the portal <ArrowUpRight size={17} /></button></div>
        <div className="kec-note"><ShieldCheck size={16} /> One connected space for students &amp; mentors</div>
      </div>
      <div className="kec-journey" aria-label="Internship journey overview">
        <div className="kec-orbit" aria-hidden="true" />
        <div className="kec-journey-top"><span>LEARN. BUILD. BECOME.</span><Compass size={26} strokeWidth={1.3} /></div>
        <div className="kec-journey-title">Big ambitions.<br /><em>Clear direction.</em></div>
        {[[Briefcase, "01 / THE OPPORTUNITY", "Your internship starts here"], [MapPin, "02 / THE EXPERIENCE", "Make every day count"], [GraduationCap, "03 / THE NEXT CHAPTER", "Bring your learning to life"]].map(([Icon, label, title]) => <div className="kec-path-item" key={label}><span className="kec-path-icon"><Icon size={20} /></span><div><small>{label}</small><strong>{title}</strong></div><ArrowUpRight size={17} /></div>)}
        <div className="kec-journey-bottom"><span>ACADEMIC GROWTH, CONNECTED.</span><span>KEC ↗</span></div>
      </div>
    </section>
    <section id="portal-access" className="kec-access" aria-labelledby="access-title">
      <div className="kec-section-heading"><div><span>YOUR SPACE TO MOVE FORWARD</span><h2 id="access-title">A workspace for your role.</h2></div><p>Choose your portal. Pick up where you left off.</p></div>
      <div className="kec-portals">
        <button className="kec-portal-card" onClick={() => setView("student-login")}><div className="kec-portal-top"><span className="kec-role-icon"><GraduationCap size={29} strokeWidth={1.6} /></span><span>01 / STUDENT</span><ArrowUpRight size={24} /></div><h3>Build your story.</h3><p>Your attendance, internship reports, and progress.<br />Everything you need, in one place.</p><div className="kec-tags"><span><MapPin size={13} /> Attendance</span><span><FileText size={13} /> Reports</span></div><div className="kec-portal-cta">Enter student portal <ArrowRight size={18} /></div></button>
        <button className="kec-portal-card kec-faculty-card" onClick={() => setView("faculty-login")}><div className="kec-portal-top"><span className="kec-role-icon"><Briefcase size={27} strokeWidth={1.6} /></span><span>02 / FACULTY</span><ArrowUpRight size={24} /></div><h3>Guide what’s next.</h3><p>Support your students, review their work,<br />and see the bigger picture.</p><div className="kec-tags"><span><Compass size={13} /> Department insights</span><span><ShieldCheck size={13} /> Reviews</span></div><div className="kec-portal-cta">Enter faculty portal <ArrowRight size={18} /></div></button>
      </div>
    </section>
    <div className="kec-bottom-note"><span>ROOTED IN LEARNING. READY FOR THE WORLD.</span><span>Perundurai, Erode ↗</span></div>
  </div>;
}
