import React, { useState, useEffect, useRef } from "react";
import { api } from "../services/api";
import { requestFreshPosition } from "../services/geolocation";
import { 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  LogIn, 
  LogOut, 
  ShieldCheck, 
  RefreshCw,
  Lock,
  History,
  AlertCircle
} from "lucide-react";

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function AttendanceTracker() {
  const [todayData, setTodayData] = useState(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const gpsRequest = useRef(0);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [accuracyM, setAccuracyM] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [gpsError, setGpsError] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [workSummary, setWorkSummary] = useState("");
  const [btnLoading, setBtnLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [exceptionType, setExceptionType] = useState("location_rejected");
  const [exceptionReason, setExceptionReason] = useState("");
  const [exceptionSubmitting, setExceptionSubmitting] = useState(false);
  const [myExceptions, setMyExceptions] = useState([]);

  const detectGPS = async (data) => {
    const requestId = ++gpsRequest.current;
    setGpsLoading(true);
    setGpsError('');
    setCurrentCoords(null);
    setDistanceKm(null);
    try {
        const position = await requestFreshPosition();
        if (requestId !== gpsRequest.current) return null;
        setCurrentCoords(position);
        setAccuracyM(position.accuracy);
        const compLat = data?.company?.latitude ?? data?.company_lat;
        const compLng = data?.company?.longitude ?? data?.company_lng;
        if (Number.isFinite(compLat) && Number.isFinite(compLng)) {
          const d = calculateDistance(position.lat, position.lng, compLat, compLng);
          setDistanceKm(d);
        }
        return position;
    } catch (error) {
      if (requestId === gpsRequest.current) setGpsError(error.message);
      return null;
    } finally {
      if (requestId === gpsRequest.current) setGpsLoading(false);
    }
  };

  const loadAllData = async () => {
    try {
      const [todayRes, histRes, statsRes, excRes] = await Promise.all([
        api.getTodayAttendance(),
        api.getAttendanceHistory(null, 15),
        api.getAttendanceStats(),
        api.getMyExceptions(),
      ]);
      setTodayData(todayRes);
      setHistory(histRes?.logs || []);
      setStats(statsRes?.stats || null);
      setMyExceptions(excRes?.exceptions || []);
      setLoadError("");
      if (todayRes?.record?.working_hours && todayRes?.record?.out_time) {
        setElapsedSeconds(Math.round(todayRes.record.working_hours * 3600));
      }
    } catch (err) {
      setLoadError(err.message || "Attendance could not be loaded. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
    const refresh = () => { if (document.visibilityState !== 'hidden') loadAllData(); };
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);

  // Run GPS detection only after todayData is available
  useEffect(() => {
    if (todayData) {
      detectGPS(todayData);
    }
  }, [todayData?.company?.latitude, todayData?.company?.longitude]);

  // Real-time elapsed work duration timer
  useEffect(() => {
    const todayRec = todayData?.record;
    if (todayRec?.in_time && !todayRec?.out_time) {
      const calcElapsed = () => {
        try {
          const rawTime = todayRec.check_in_at;
          const inDt = new Date(rawTime && !/Z$|[+-]\d{2}:\d{2}$/.test(rawTime) ? `${rawTime}Z` : rawTime);
          const diff = Math.max(0, Math.floor((new Date() - inDt) / 1000));
          setElapsedSeconds(diff);
        } catch {
          setElapsedSeconds(0);
        }
      };
      calcElapsed();
      const interval = setInterval(calcElapsed, 1000);
      return () => clearInterval(interval);
    }
  }, [todayData]);

  const loadAuditLogs = async () => {
    try {
      const res = await api.getAttendanceAuditLogs();
      setAuditLogs(res.audit_logs || []);
      setShowAuditModal(true);
    } catch (err) {
      setActionMsg(`❌ Failed to load audit trail: ${err.message}`);
    }
  };

  const handleExceptionSubmit = async (e) => {
    e.preventDefault();
    if (!exceptionReason.trim() || exceptionReason.trim().length < 5) {
      alert("Please provide a detailed reason (minimum 5 characters).");
      return;
    }
    setExceptionSubmitting(true);
    try {
      await api.createException({
        attendance_id: todayData?.record?.id || null,
        exception_type: exceptionType,
        reason: exceptionReason.trim(),
      });
      alert("✅ Exception request submitted for faculty review. Your department coordinator will be notified.");
      setShowExceptionModal(false);
      setExceptionReason("");
      const res = await api.getMyExceptions();
      setMyExceptions(res.exceptions || []);
    } catch (err) {
      alert(`❌ Error submitting exception: ${err.message}`);
    } finally {
      setExceptionSubmitting(false);
    }
  };

  const handleCheckIn = async () => {
    if (!currentCoords) {
      setActionMsg("❌ GPS location is required to check in. Please allow browser location access.");
      return;
    }
    setBtnLoading(true);
    setActionMsg("");
    try {
      const fresh = await detectGPS(todayData);
      if (!fresh) return;
      const res = await api.checkIn(
        fresh.lat,
        fresh.lng,
        fresh.accuracy,
        navigator.userAgent
      );
      setActionMsg(`✅ ${res.message} (Status: ${res.status})`);
      await loadAllData();
    } catch (err) {
      setActionMsg(`❌ ${err.message}`);
    } finally {
      setBtnLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!currentCoords) {
      setActionMsg("❌ GPS location is required to check out. Please allow browser location access.");
      return;
    }
    if (!workSummary.trim() || workSummary.trim().length < 5) {
      setActionMsg("❌ Daily work summary is required (minimum 5 characters) before checking out.");
      return;
    }
    const elapsedHrs = elapsedSeconds / 3600.0;
    if (elapsedHrs < (todayData?.min_work_hours || 3.0)) {
      const proceed = window.confirm(
        `Minimum Duration Warning:\nYou have logged ${elapsedHrs.toFixed(2)} hours today, which is less than the required ${todayData?.min_work_hours || 3.0} hours.\n\nChecking out now may record "Half Day" or "Incomplete". Continue?`
      );
      if (!proceed) return;
    }

    setBtnLoading(true);
    setActionMsg("");
    try {
      const fresh = await detectGPS(todayData);
      if (!fresh) return;
      const res = await api.checkOut(
        fresh.lat,
        fresh.lng,
        fresh.accuracy,
        workSummary.trim(),
        navigator.userAgent
      );
      setActionMsg(`✅ ${res.message} (Duration: ${res.working_hours} hrs, Status: ${res.status})`);
      setWorkSummary("");
      await loadAllData();
    } catch (err) {
      setActionMsg(`❌ ${err.message}`);
    } finally {
      setBtnLoading(false);
    }
  };

  const todayRecord = todayData?.record;
  const hasIn = todayRecord && todayRecord.in_time;
  const hasOut = todayRecord && todayRecord.out_time;
  const minHrs = todayData?.min_work_hours || 3.0;
  const companyName = todayData?.company?.name || todayData?.company_name || "Assigned Company";
  const geofenceRadiusKm = (todayData?.company?.geofence_radius_m || 2000) / 1000;
  const isWithinGeofence = distanceKm !== null && distanceKm <= geofenceRadiusKm;
  const isReliableGPS = Number.isFinite(accuracyM) && accuracyM > 0 && accuracyM <= (todayData?.policy?.max_accuracy_m || 150);

  const formatElapsed = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <div className="app-container" style={{ padding: "30px 20px 60px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "var(--green-tint)",
            color: "var(--green-primary)",
            padding: "4px 12px",
            borderRadius: 9999,
            fontSize: "0.76rem",
            fontWeight: 700,
            marginBottom: 8,
            border: "1px solid #bbf7d0"
          }}>
            <ShieldCheck size={14} /> Strict Tamper-Resistant Attendance Policy
          </div>
          <h2 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-primary)" }}>
            Daily Attendance &amp; Geofence Tracker
          </h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", marginTop: 4 }}>
            Company: <strong style={{ color: "var(--green-primary)" }}>{companyName}</strong> · 
            Date: <span className="mono" style={{ fontWeight: 600 }}>{todayData?.date || new Date().toISOString().split("T")[0]}</span>
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowExceptionModal(true)}
            style={{ padding: "8px 16px", fontSize: "0.82rem", background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}
          >
            <AlertCircle size={14} /> Request Exception
          </button>
          <button
            className="btn btn-secondary"
            onClick={loadAuditLogs}
            style={{ padding: "8px 16px", fontSize: "0.82rem" }}
          >
            <History size={14} /> Audit Trail
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => { detectGPS(todayData); loadAllData(); }}
            disabled={gpsLoading}
            style={{ padding: "8px 16px", fontSize: "0.82rem" }}
          >
            <RefreshCw size={14} /> {gpsLoading ? 'Detecting location…' : 'Refresh GPS'}
          </button>
        </div>
      </div>

      {loadError && <div role="alert" className="attendance-load-error">
        <AlertTriangle size={18} /><span>{loadError}</span>
        <button className="btn btn-secondary" onClick={loadAllData}>Retry</button>
      </div>}
      {/* Geofence Status Banner */}
      <div style={{
        background: isWithinGeofence ? "#f0fdf4" : "#fffbeb",
        border: `1.5px solid ${isWithinGeofence ? "#bbf7d0" : "#fde68a"}`,
        borderRadius: "var(--radius-md)",
        padding: "16px 20px",
        marginBottom: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: isWithinGeofence ? "var(--green-primary)" : "var(--warning)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff"
          }}>
            <MapPin size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-primary)" }}>
              {currentCoords
                ? `GPS: ${currentCoords.lat.toFixed(5)}, ${currentCoords.lng.toFixed(5)} (Accuracy: ±${Math.round(accuracyM)}m)`
                : gpsError || "Acquiring GPS location..."}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginTop: 2 }}>
              {distanceKm !== null
                ? `Workplace distance: ${Math.round(distanceKm * 1000)} m · Allowed radius: ${Math.round(geofenceRadiusKm * 1000)} m. ${!isReliableGPS ? "GPS accuracy is too low; refresh before checking in." : "A fresh location is verified by the server for each action."}`
                : "Calculating distance to registered workplace..."}
            </div>
          </div>
        </div>

        <div style={{
          fontSize: "0.75rem",
          fontWeight: 700,
          padding: "5px 14px",
          borderRadius: 9999,
          background: "#ffffff",
          border: `1px solid ${isWithinGeofence ? "#86efac" : "#fcd34d"}`,
          color: isWithinGeofence ? "var(--green-primary)" : "#b45309"
        }}>
          {gpsLoading ? "LOCATING…" : isWithinGeofence && isReliableGPS ? "WITHIN WORKPLACE RADIUS" : distanceKm !== null ? (isWithinGeofence ? "LOW GPS ACCURACY" : "OUTSIDE WORKPLACE RADIUS") : "AWAITING GPS"}
        </div>
      </div>

      {actionMsg && (
        <div role="status" aria-live="polite" style={{
          background: actionMsg.startsWith("✅") ? "var(--success-dim)" : "var(--danger-dim)",
          border: `1px solid ${actionMsg.startsWith("✅") ? "#bbf7d0" : "#fecaca"}`,
          color: actionMsg.startsWith("✅") ? "var(--green-primary)" : "var(--danger)",
          padding: "12px 18px",
          borderRadius: "var(--radius-md)",
          fontSize: "0.88rem",
          fontWeight: 600,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 10
        }}>
          {actionMsg.startsWith("✅") ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Main Action Grid */}
      <div className="grid-split-12" style={{ marginBottom: 32 }}>
        {/* Check-In / Check-Out Card */}
        <div className="card" style={{ padding: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Today's Session &amp; Geofence Verification
            </h3>
            {todayRecord?.status && (
              <span className={`badge ${
                todayRecord.status.includes("Present") ? "badge-success" :
                todayRecord.status.includes("Half Day") ? "badge-warning" :
                todayRecord.status.includes("Pending") ? "badge-info" : "badge-danger"
              }`}>
                {todayRecord.status}
              </span>
            )}
          </div>

          {/* Daily Check-In Lock Section */}
          <div style={{
            background: hasIn ? "#f8fafc" : "var(--bg-main)",
            border: `1px solid ${hasIn ? "#cbd5e1" : "var(--border-subtle)"}`,
            borderRadius: "var(--radius-md)",
            padding: "20px",
            marginBottom: 20
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "0.95rem" }}>
                <LogIn size={18} color="var(--green-primary)" />
                <span>Daily Check-In</span>
              </div>
              {hasIn && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>
                  <Lock size={13} /> LOCKED FOR TODAY
                </span>
              )}
            </div>

            {hasIn ? (
              <div>
                <div className="grid-2-col" style={{ gap: 12, fontSize: "0.85rem", color: "var(--text-dim)" }}>
                  <div><strong>Server Timestamp:</strong> <span className="mono">{todayRecord.in_time}</span></div>
                  <div><strong>GPS Proximity:</strong> {todayRecord.in_distance_m != null ? `${Math.round(todayRecord.in_distance_m)} m` : "Not recorded"}</div>
                </div>
                <div style={{ marginTop: 8, fontSize: "0.8rem", color: todayRecord.verification_state === "verified" ? "var(--green-primary)" : "var(--danger)" }}>
                  {todayRecord.verification_state === "verified" ? "Location verification completed." : "Verification pending; review attendance status."}
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: 14 }}>
                  Perform GPS check-in upon arrival at your workplace. Check-in is permitted <strong>only once per day</strong> and is immediately locked.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={handleCheckIn}
                  disabled={btnLoading || !currentCoords}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <LogIn size={16} /> {btnLoading ? "Verifying GPS..." : "Mark Daily Check-In"}
                </button>
              </div>
            )}
          </div>

          {/* Duration Progress Tracker */}
          {hasIn && (
            <div style={{
              background: "#ffffff",
              border: "1.5px solid #e2e8f0",
              borderRadius: "var(--radius-md)",
              padding: "20px",
              marginBottom: 20
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Active Work Duration
                </span>
                <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--green-primary)", fontFamily: "monospace" }}>
                  {formatElapsed(elapsedSeconds)}
                </span>
              </div>

              {/* Progress bar towards 3h */}
              <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(100, (elapsedSeconds / (minHrs * 3600)) * 100)}%`,
                  background: elapsedSeconds >= minHrs * 3600 ? "var(--green-primary)" : "var(--warning)",
                  transition: "width 0.5s ease"
                }} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--text-dim)" }}>
                <span>Threshold: {minHrs} hours for Full Day</span>
                <span>
                  {elapsedSeconds >= minHrs * 3600
                    ? "✓ Full Day Duration Achieved"
                    : `Remaining: ${formatElapsed(Math.max(0, Math.round(minHrs * 3600 - elapsedSeconds)))}`}
                </span>
              </div>

              {/* Checkout Eligibility Countdown Badge */}
              {todayData?.can_checkout_at && (
                <div style={{
                  marginTop: 14,
                  padding: "10px 14px",
                  background: elapsedSeconds >= minHrs * 3600 ? "var(--green-tint)" : "#fef3c7",
                  border: `1px solid ${elapsedSeconds >= minHrs * 3600 ? "#bbf7d0" : "#fde68a"}`,
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.82rem"
                }}>
                  <span style={{ fontWeight: 700, color: elapsedSeconds >= minHrs * 3600 ? "var(--green-primary)" : "#b45309" }}>
                    {elapsedSeconds >= minHrs * 3600 ? "🎉 Minimum Work Duration Reached" : "⏳ Eligible Checkout Target:"}
                  </span>
                  <span style={{ fontWeight: 800, fontFamily: "monospace", color: elapsedSeconds >= minHrs * 3600 ? "var(--green-primary)" : "#92400e" }}>
                    You can check out at {todayData.can_checkout_at}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Checkout & Summary Section */}
          {hasIn && (
            <div style={{
              background: hasOut ? "#f8fafc" : "var(--bg-main)",
              border: `1px solid ${hasOut ? "#cbd5e1" : "var(--border-subtle)"}`,
              borderRadius: "var(--radius-md)",
              padding: "20px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "0.95rem" }}>
                  <LogOut size={18} color="var(--danger)" />
                  <span>Daily Checkout</span>
                </div>
                {hasOut && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>
                    <Lock size={13} /> COMPLETED TODAY
                  </span>
                )}
              </div>

              {hasOut ? (
                <div>
                  <div className="grid-2-col" style={{ gap: 12, fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: 10 }}>
                    <div><strong>Checkout Time:</strong> <span className="mono">{todayRecord.out_time}</span></div>
                    <div><strong>Total Hours:</strong> <strong style={{ color: "var(--green-primary)" }}>{todayRecord.working_hours} hrs</strong></div>
                  </div>
                  <div style={{ fontSize: "0.84rem", color: "var(--text-dim)" }}>
                    <strong>Work Summary:</strong> {todayRecord.work_summary}
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                    Daily Work Summary <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Describe tasks completed, modules worked on, or deliverables submitted today..."
                    value={workSummary}
                    onChange={(e) => setWorkSummary(e.target.value)}
                    style={{ marginBottom: 14, resize: "vertical" }}
                  />

                  <button
                    className="btn btn-secondary"
                    onClick={handleCheckOut}
                    disabled={btnLoading || !currentCoords}
                    style={{ width: "100%", justifyContent: "center", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" }}
                  >
                    <LogOut size={16} /> {btnLoading ? "Recording Checkout..." : "Submit Summary & Checkout"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Monthly Summary & Verification Card */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card" style={{ padding: "26px" }}>
            <h4 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 16, color: "var(--text-primary)" }}>
              Monthly Verification Health
            </h4>

            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
              <div style={{
                fontSize: "2.6rem",
                fontWeight: 800,
                color: (stats?.attendance_pct || 0) >= 75 ? "var(--green-primary)" : "var(--danger)"
              }}>
                {stats?.attendance_pct != null ? `${stats.attendance_pct}%` : loading ? "…" : "0%"}
              </div>
              <div>
                <span className={`badge ${(stats?.attendance_pct || 0) >= 75 ? "badge-success" : "badge-danger"}`}>
                  {(stats?.attendance_pct || 0) >= 75 ? "Verified Eligible" : "Attendance Warning"}
                </span>
                <p style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginTop: 4 }}>
                  Computed strictly from <strong>Present / Verified</strong> records only.
                </p>
              </div>
            </div>

            <div className="grid-2-col" style={{ gap: 12, borderTop: "1px solid var(--border-subtle)", paddingTop: 16 }}>
              <div>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Verified Present</span>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--green-primary)" }}>{stats?.present_days ?? 0} days</div>
              </div>
              <div>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Half Days</span>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--warning)" }}>{stats?.half_days ?? 0} days</div>
              </div>
              <div>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Incomplete / Pending</span>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--danger)" }}>{stats?.incomplete_days ?? 0} days</div>
              </div>
              <div>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Total Work Hours</span>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-primary)" }}>{stats?.total_hours ?? 0} hrs</div>
              </div>
            </div>
          </div>

          {/* Tamper Resistance Rules Box */}
          <div className="card" style={{ padding: "22px", background: "linear-gradient(135deg, #ffffff, #f0fdf4)", border: "1.5px solid #bbf7d0" }}>
            <h5 style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--green-primary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={16} /> Anti-Tampering Rules Enforced
            </h5>
            <ul style={{ fontSize: "0.78rem", color: "var(--text-dim)", margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
              <li>Server timestamps are used for all check-ins and checkouts.</li>
              <li>Single check-in lock prevents multiple or re-marked records.</li>
              <li>Haversine backend distance validation calculates true GPS proximity.</li>
              <li>At least 3.0 hours duration required for Full Day status.</li>
              <li>All corrections are logged in an immutable audit ledger.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Attendance History Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1.5px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
            Recent Attendance Log &amp; Status Ledger
          </h4>
          <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
            Showing last {history.length} days
          </span>
        </div>

        <div className="table-responsive" style={{ border: "none" }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Hours</th>
                <th>Distance</th>
                <th>Status</th>
                <th>Location</th>
                <th>Work Summary</th>
              </tr>
            </thead>
            <tbody>
              {history.length > 0 ? (
                history.map((log) => {
                  const isPres = log.status === "Present / Verified" || log.status === "Present";
                  const isHalf = log.status === "Half Day";
                  const isPending = log.status?.includes("Pending");
                  return (
                    <tr key={log.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>{log.date}</td>
                      <td className="mono">{log.in_time ? log.in_time.substring(11, 16) : "--:--"}</td>
                      <td className="mono">{log.out_time ? log.out_time.substring(11, 16) : "--:--"}</td>
                      <td style={{ fontWeight: 700, color: "var(--green-primary)" }}>
                        {log.working_hours ? `${log.working_hours}h` : "—"}
                      </td>
                      <td style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>
                        {log.in_distance_m != null ? `${Math.round(log.in_distance_m)} m` : "—"}
                      </td>
                      <td>
                        <span className={`badge ${
                          isPres ? "badge-success" :
                          isHalf ? "badge-warning" :
                          isPending ? "badge-info" : "badge-danger"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td>
                        {log.verification_state === "verified" ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.76rem", color: "var(--green-primary)", fontWeight: 600 }}>
                            <ShieldCheck size={13} /> Verified
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.76rem", color: "var(--warning)", fontWeight: 600 }}>
                            <AlertTriangle size={13} /> Exception
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: "0.82rem", color: "var(--text-dim)", maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {log.work_summary || "—"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                    No attendance records found yet. Mark your first check-in above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attendance Exceptions Section */}
      <div style={{ marginTop: 36 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
              My Attendance Exception Requests
            </h3>
            <p style={{ fontSize: "0.82rem", color: "var(--text-dim)", marginTop: 2 }}>
              Track requests for location exceptions, missing checkouts, or corrections submitted for faculty review.
            </p>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => setShowExceptionModal(true)}
            style={{ fontSize: "0.82rem", padding: "6px 14px", background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}
          >
            <AlertCircle size={14} /> Submit New Request
          </button>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="custom-table" style={{ fontSize: "0.82rem" }}>
            <thead>
              <tr>
                <th>Submitted On</th>
                <th>Exception Type</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Faculty Decision / Notes</th>
              </tr>
            </thead>
            <tbody>
              {myExceptions && myExceptions.length > 0 ? (
                myExceptions.map((exc) => (
                  <tr key={exc.id}>
                    <td className="mono">{exc.requested_at ? exc.requested_at.substring(0, 10) : "—"}</td>
                    <td>
                      <span className="badge badge-info">
                        {exc.exception_type ? exc.exception_type.replace(/_/g, " ") : "General"}
                      </span>
                    </td>
                    <td style={{ maxWidth: 300 }}>{exc.reason}</td>
                    <td>
                      <span className={`badge ${
                        exc.status === "approved" ? "badge-success" :
                        exc.status === "rejected" ? "badge-danger" : "badge-warning"
                      }`}>
                        {exc.status ? exc.status.toUpperCase() : "PENDING"}
                      </span>
                    </td>
                    <td>{exc.review_notes || (exc.status === "pending" ? "Awaiting faculty mentor review" : "—")}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "26px", color: "var(--text-muted)" }}>
                    No exception requests submitted. If your location was rejected or checkout was missed, click "Submit New Request".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exception Submission Modal */}
      {showExceptionModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 540 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={22} color="#d97706" />
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Raise Attendance Exception</h3>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowExceptionModal(false)} style={{ padding: "4px 12px" }}>
                Close
              </button>
            </div>
            <p style={{ fontSize: "0.82rem", color: "var(--text-dim)", marginBottom: 16 }}>
              Submit a formal request to your department faculty mentor to approve attendance with location deviation or missing checkout.
            </p>

            <form onSubmit={handleExceptionSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label className="label">Exception Type</label>
                <select
                  className="input"
                  value={exceptionType}
                  onChange={(e) => setExceptionType(e.target.value)}
                >
                  <option value="location_rejected">Location Rejected / Outside Geofence</option>
                  <option value="missing_checkout">Missing Checkout / Network Issue</option>
                  <option value="correction">Duty / On-site Visit Correction</option>
                  <option value="other">Other Academic Exemption</option>
                </select>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label className="label">
                  Detailed Reason & Evidence Details <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <textarea
                  className="input"
                  rows={4}
                  required
                  placeholder="Explain why you were outside the geofence, specify on-site visit details, or describe supervisor approval..."
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowExceptionModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={exceptionSubmitting}
                >
                  {exceptionSubmitting ? "Submitting..." : "Submit to Faculty"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Modal */}
      {showAuditModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 780 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldCheck size={22} color="var(--green-primary)" />
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Immutable Attendance Audit Trail</h3>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowAuditModal(false)} style={{ padding: "4px 12px" }}>
                Close
              </button>
            </div>
            <p style={{ fontSize: "0.82rem", color: "var(--text-dim)", marginBottom: 16 }}>
              Every check-in, checkout, and authorized faculty correction is cryptographically and immutably recorded.
            </p>

            <div className="table-responsive">
              <table className="custom-table" style={{ fontSize: "0.8rem" }}>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Performed By</th>
                    <th>Status Transition</th>
                    <th>Hours</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="mono">{log.created_at ? log.created_at.substring(0, 19).replace("T", " ") : "—"}</td>
                      <td><strong>{log.action}</strong></td>
                      <td>{log.performed_by_name} ({log.performed_by_role})</td>
                      <td>{log.old_status ? `${log.old_status} → ${log.new_status}` : log.new_status}</td>
                      <td>{log.new_hours ? `${log.new_hours}h` : "—"}</td>
                      <td>{log.reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
