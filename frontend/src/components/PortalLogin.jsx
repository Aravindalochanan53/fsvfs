import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import './PortalLogin.css';

export default function PortalLogin({ kind, setView }) {
  const faculty = kind === 'faculty';
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setError(''); setLoading(true);
    try {
      const res = await (faculty ? api.facultyLogin : api.studentLogin)(identifier.trim(), password);
      login(res.access_token, res.role, res.user);
      setView(faculty ? 'faculty-home' : 'student-home');
    } catch (err) { setError(err.message || 'Unable to sign in. Please try again.'); }
    finally { setLoading(false); }
  };
  return <div className="portal-login-screen">
    <section className="portal-login-photo" aria-label="Kongu Engineering College campus">
      <button className="portal-login-back" onClick={() => setView('landing')}><ArrowLeft size={16} /> Back to home</button>
      <div className="portal-photo-brand"><img src="https://kongu.ac.in/static/media/kec.278b926390254d4ec529.webp" alt="Kongu Engineering College — Transform yourself" /></div>
      <div className="portal-photo-caption"><span>KONGU ENGINEERING COLLEGE</span><p>Your learning. Your experience.<br />Your next chapter.</p></div>
    </section>
    <section className="portal-login-side">
      <div className="portal-login-form-wrap">
        <span className="portal-login-eyebrow">KEC INTERNSHIP PORTAL</span>
        <h1>Get started with KEC</h1>
        <p className="portal-login-subtitle">Sign in to your {faculty ? 'faculty' : 'student'} account</p>
        {error && <div className="portal-login-error" role="alert"><AlertCircle size={17} /><span>{error}</span></div>}
        <form onSubmit={submit} aria-busy={loading}>
          <div className="portal-login-field"><label htmlFor={`${kind}-identifier`}>{faculty ? 'Faculty ID' : 'Register number'}</label><input id={`${kind}-identifier`} name="username" autoComplete="username" placeholder={faculty ? 'Enter your faculty ID' : 'Enter your register number'} value={identifier} onChange={(e) => setIdentifier(e.target.value.toUpperCase())} required disabled={loading} /></div>
          <div className="portal-login-field"><label htmlFor={`${kind}-password`}>Password</label><div className="portal-password-wrap"><input id={`${kind}-password`} name="password" autoComplete="current-password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
          <button type="submit" className="portal-sign-in" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}<ArrowRight size={17} /></button>
        </form>
        <div className="portal-register-link">{faculty ? 'New faculty member?' : 'New to the portal?'} <button onClick={() => setView(`${kind}-signup`)}>Create an account</button></div>
        <div className="portal-switch"><span>{faculty ? 'Are you a student?' : 'Are you a faculty member?'}</span><button onClick={() => setView(faculty ? 'student-login' : 'faculty-login')}>{faculty ? 'Student login' : 'Faculty login'} <ArrowRight size={14} /></button></div>
      </div>
      <div className="portal-login-footer">Kongu Engineering College (Autonomous)<br /><span>Perundurai, Erode · Internship &amp; Attendance</span></div>
    </section>
  </div>;
}
