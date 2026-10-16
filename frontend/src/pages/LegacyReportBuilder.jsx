import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Save, Printer, Eye, PenLine, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import './LegacyReportBuilder.css';

const CHAPTERS = [
  ['Student details & abstract', [
    ['student_name', 'Student name', 'text'], ['reg_no', 'Register number', 'text'],
    ['department', 'Department', 'text'], ['year_sem', 'Year & semester', 'text'],
    ['acad_year', 'Academic year', 'text'], ['abstract', 'Abstract', 'textarea'],
  ]],
  ['Company & mentor', [
    ['company_name', 'Company name', 'text'], ['company_location', 'Location', 'text'],
    ['industry_type', 'Industry type', 'text'], ['company_web', 'Company website (optional)', 'url', true],
    ['company_overview', 'Company overview', 'textarea'], ['mentor_name', 'Mentor name', 'text'],
    ['mentor_desig', 'Mentor designation', 'text'],
  ]],
  ['Training schedule', [
    ['start_date', 'Start date', 'date'], ['end_date', 'End date', 'date'],
    ['duration', 'Duration', 'text'], ['mode', 'Mode of training', 'text'],
    ['training_overview', '3.1 Overview of training', 'textarea'],
  ]],
  ['Internship objectives', [
    ['sec41', '4.1 Skill development in modern technology', 'textarea'],
    ['sec42', '4.2 Understanding industry-level development practices', 'textarea'],
    ['sec43', '4.3 Bridging the gap between theory and practical implementation', 'textarea'],
  ]],
  ['Tools & technologies', [
    ['tools_used', 'Tools used (comma-separated)', 'text'],
    ['extra_tools', 'Other tools (optional)', 'text', true],
    ['tools_desc', 'Tools experience description', 'textarea'],
  ]],
  ['Training phases', [
    ['phase1', '6.1 Technology familiarization & environment setup', 'textarea'],
    ['phase2', '6.2 Backend development & API integration', 'textarea'],
    ['phase3', '6.3 Asynchronous processing & task management', 'textarea'],
    ['phase4', '6.4 Integration, testing & deployment practices', 'textarea'],
  ]],
  ['Conclusion, offer letter & SDG', [
    ['summary', '7.1 Summary of learnings', 'textarea'],
    ['skills_gained', '7.2 Skills gained (comma-separated)', 'text'],
    ['future_scope', '7.3 Future scope', 'textarea'],
    ['offer_letter_no', 'Chapter 8 — Offer letter reference number', 'text'],
    ['sdg_goals', 'Chapter 9 — SDG goals', 'text'],
    ['sdg_mapping', 'SDG mapping explanation', 'textarea'],
  ]],
];
const FIELDS = CHAPTERS.flatMap(([, fields]) => fields);

export default function LegacyReportBuilder({ setView }) {
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [originalSections, setOriginalSections] = useState({});
  const [values, setValues] = useState({});
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const locked = false; // Reports remain editable; faculty approval is not required.
  const missing = FIELDS.filter(([key, , , optional]) => !optional && !String(values[key] || '').trim());
  const datesInvalid = values.start_date && values.end_date && values.end_date < values.start_date;

  useEffect(() => {
    let active = true;
    api.getMyReport().then((res) => {
      if (!active) return;
      const old = res.sections_data || {};
      setReport(res);
      setOriginalSections(old);
      setValues({ student_name: user?.student_name || '', reg_no: user?.roll_number || '',
        department: user?.department || '', company_name: user?.company_name || '',
        company_location: user?.company_location || '', duration: user?.duration || '',
        ...Object.fromEntries(FIELDS.filter(([key]) => typeof res[key] === 'string').map(([key]) => [key, res[key]])),
        abstract: old.abstract || res.abstract || '', company_overview: old.company_profile || res.company_overview || '',
        mentor_name: old.company_mentor_details?.mentor_name || res.mentor_name || '',
        mentor_desig: old.company_mentor_details?.mentor_designation || res.mentor_desig || '',
        tools_used: old.technologies_used || res.tools_used || '', summary: old.conclusion || res.summary || '',
        future_scope: old.future_scope || res.future_scope || '', ...old.legacy_report,
      });
    }).catch((err) => { if (active) { setMessage(err.message); setFailed(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    let active = true;
    const refreshReview = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const latest = await api.getMyReport();
        if (active) setReport(latest);
      } catch (err) { if (active) setMessage(`Unable to refresh review status: ${err.message}`); }
    };
    const timer = setInterval(refreshReview, 15000);
    window.addEventListener('focus', refreshReview);
    document.addEventListener('visibilitychange', refreshReview);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refreshReview); document.removeEventListener('visibilitychange', refreshReview); };
  }, []);

  useEffect(() => {
    const preventLoss = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [dirty]);

  const save = async () => {
    setSaving(true); setMessage('');
    try {
      const sections = { ...originalSections, report_format: 'legacy_php_v1', legacy_report: values };
      await api.saveReportDraft(sections, 'Saved legacy-format internship report');
      setOriginalSections(sections); setDirty(false); setMessage('Report saved successfully.');
      return true;
    } catch (err) { setMessage(err.message); return false; }
    finally { setSaving(false); }
  };
  const exportPdf = async () => {
    if (missing.length || datesInvalid) { setMessage(datesInvalid ? 'End date must be on or after start date.' : `Complete these fields before export: ${missing.map(([, label]) => label).join(', ')}`); return; }
    if (!locked && !(await save())) return;
    setPreview(true);
    setTimeout(() => window.print(), 150);
  };

  if (loading) return <div className="app-container report-loading" role="status">Loading your internship report…</div>;
  if (failed) return <div className="app-container report-loading" role="alert">Unable to load report: {message}</div>;

  return <div className="app-container legacy-report">
    <header className="report-toolbar no-print">
      <div><button className="report-back" onClick={() => { if (!dirty || window.confirm('Leave without saving your changes?')) setView('student-home'); }}><ArrowLeft size={15} /> Student workspace</button><span className="report-kicker">INTERNSHIP DOCUMENTATION</span><h1>Your experience. Documented.</h1><p>Original KEC report format · Seven guided steps · One complete PDF</p></div>
      <div className="report-actions"><button className="btn btn-secondary" onClick={() => setPreview(!preview)}>{preview ? <PenLine size={16} /> : <Eye size={16} />}{preview ? 'Edit report' : 'Preview'}</button><button className="btn btn-secondary" disabled={saving || locked} onClick={save}><Save size={16} />{saving ? 'Saving…' : 'Save draft'}</button><button className="btn btn-primary" disabled={saving} onClick={exportPdf}><Printer size={16} /> Export full PDF</button></div>
    </header>
    <div className="report-progress no-print"><span>{locked ? `Read only · ${report.status}` : dirty ? 'Unsaved changes' : 'Your report workspace'}</span><strong>{FIELDS.filter(([, , , optional]) => !optional).length - missing.length} / {FIELDS.filter(([, , , optional]) => !optional).length} required fields complete</strong></div>
    {message && <div className="report-message no-print" role="status">{message}</div>}
    {preview ? <article className="report-document" id="internship-report-document">
      <section className="report-cover"><div>KONGU ENGINEERING COLLEGE</div><p>(Autonomous) · Perundurai, Erode</p><hr /><span>DEPARTMENT OF {values.department}</span><h1>INTERNSHIP<br />TRAINING REPORT</h1><h2>{values.company_name}</h2><p>Submitted by</p><h3>{values.student_name}</h3><p>{values.reg_no} · {values.year_sem}</p><p>Academic year: {values.acad_year}</p><p>{values.start_date} — {values.end_date}</p></section>
      <section className="report-print-chapter"><h2>Contents</h2>{CHAPTERS.map(([title], i) => <p key={title}>{i + 1}. {title}</p>)}</section>
      {CHAPTERS.map(([title, fields], i) => <section key={title} className="report-print-chapter"><div className="report-document-meta">{values.student_name} · {values.reg_no}</div><h2>{i + 1}. {title}</h2>{fields.filter(([key, , , optional]) => !optional || values[key]).map(([key, label]) => <div className="report-print-field" key={key}><h3>{label.replace(' (optional)', '')}</h3><p>{String(values[key] || 'Not provided')}</p></div>)}</section>)}
    </article> : <div className="report-workspace no-print"><aside className="report-steps" aria-label="Report chapters">{CHAPTERS.map(([title, fields], i) => <button key={title} onClick={() => setStep(i)} aria-current={step === i ? 'step' : undefined}><span>{fields.every(([key, , , optional]) => optional || String(values[key] || '').trim()) ? <CheckCircle2 size={18} /> : String(i + 1).padStart(2, '0')}</span><strong>{title}</strong></button>)}<p>Save a draft anytime. Once every required field is complete, export your whole report using “Save as PDF” in the print dialog.</p></aside>
      <form className="report-editor" onSubmit={(e) => { e.preventDefault(); if (step < 6) setStep(step + 1); else setPreview(true); }}><span className="report-kicker">STEP {step + 1} OF 7</span><h2>{CHAPTERS[step][0]}</h2><p className="report-editor-hint">Use your actual internship details. Fields marked * are required for PDF export.</p><div className="report-field-grid">{CHAPTERS[step][1].map(([key, label, type, optional]) => <div key={key} className={`form-group ${type === 'textarea' ? 'report-field-wide' : ''}`}><label htmlFor={`report-${key}`}>{label}{!optional && ' *'}</label>{type === 'textarea' ? <textarea id={`report-${key}`} className="form-textarea" rows={6} disabled={locked} value={values[key] || ''} onChange={(e) => { setValues({ ...values, [key]: e.target.value }); setDirty(true); }} /> : <input id={`report-${key}`} type={type} className="form-input" disabled={locked} value={values[key] || ''} onChange={(e) => { setValues({ ...values, [key]: e.target.value }); setDirty(true); }} />}</div>)}</div><div className="report-editor-footer"><button type="button" className="btn btn-secondary" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft size={15} /> Previous</button><button type="submit" className="btn btn-primary">{step === 6 ? 'Preview complete report' : 'Next chapter'}<ArrowRight size={15} /></button></div></form>
    </div>}
  </div>;
}
