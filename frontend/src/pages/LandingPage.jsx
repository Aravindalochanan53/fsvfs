import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import './LandingPage.css';

export default function LandingPage({ setView }) {
  return (
    <section className="campus-landing" aria-label="Kongu Engineering College internship portal">
      <div className="campus-caption">
        <h1>KONGU ENGINEERING COLLEGE<br /><span>(AUTONOMOUS)</span></h1>
      </div>
      <aside className="campus-login-panel">
        <div className="campus-brand">
          <img src="https://kongu.ac.in/static/media/kec.278b926390254d4ec529.webp" alt="Kongu Engineering College" />
          <p>INTERNSHIP &amp; ATTENDANCE PORTAL</p>
        </div>
        <nav className="campus-login-options" aria-label="Choose your login">
          <button type="button" onClick={() => setView('faculty-login')}><span><strong>Faculty</strong> Login</span><ArrowUpRight size={23} strokeWidth={1.4} /></button>
          <button type="button" onClick={() => setView('student-login')}><span><strong>Student</strong> Login</span><ArrowUpRight size={23} strokeWidth={1.4} /></button>
        </nav>
        <div className="campus-panel-footer">Kongu Engineering College · Perundurai, Erode</div>
      </aside>
    </section>
  );
}
