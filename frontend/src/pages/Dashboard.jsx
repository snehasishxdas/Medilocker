import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { DoctorDashboard } from '../components/dashboard/DoctorDashboard';

export function Dashboard() {
  const { user } = useAuth();
  
  const userRole = String(user?.role || '').toUpperCase();
  const isDoctor = userRole === 'DOCTOR' || Boolean(user?.doctorProfile);

  // If authenticated user is a DOCTOR, render dedicated Doctor Dashboard
  if (isDoctor) {
    return <DoctorDashboard user={user} />;
  }

  const [todos, setTodos] = useState([]);
  const [recordsCount, setRecordsCount] = useState(0);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [refillAlerts, setRefillAlerts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [todayFeelingSubmitted, setTodayFeelingSubmitted] = useState(false);
  const [todayFeeling, setTodayFeeling] = useState(null);
  const [isEditingFeeling, setIsEditingFeeling] = useState(false);
  const [feelingSaved, setFeelingSaved] = useState(false);
  const [todayDateStr, setTodayDateStr] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  const name = user?.patientProfile?.fullName || user?.name || user?.email?.split('@')[0] || 'User';
  const unitId = user?.medilockerId || 'ML-XXXX-XXXX';

  const loadDashboardData = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [todosRes, recordsRes, invRes, refillsRes, feelingsRes, requestsRes] = await Promise.allSettled([
        api.getTodos(),
        api.listRecords(),
        api.getInventory(),
        api.checkRefills(),
        api.getFeelings(14),
        api.getPatientRequests(),
      ]);

      if (requestsRes.status === 'fulfilled' && requestsRes.value?.data) {
        const d = requestsRes.value.data;
        if (Array.isArray(d.pendingRequests)) {
          setPendingRequests(d.pendingRequests);
        }
      }

      let feelingDone = false;
      let loggedFeeling = null;

      if (todosRes.status === 'fulfilled' && todosRes.value?.data) {
        const val = todosRes.value.data;
        if (Array.isArray(val)) {
          setTodos(val);
        } else if (Array.isArray(val.tasks)) {
          setTodos(val.tasks);
          if (val.stats?.todayFeelingSubmitted) {
            feelingDone = true;
            loggedFeeling = val.stats.todayFeeling;
          }
        }
      }

      if (recordsRes.status === 'fulfilled' && Array.isArray(recordsRes.value?.data)) {
        setRecordsCount(recordsRes.value.data.length);
      }
      if (invRes.status === 'fulfilled' && Array.isArray(invRes.value?.data)) {
        setInventoryCount(invRes.value.data.length);
      }
      if (refillsRes.status === 'fulfilled' && Array.isArray(refillsRes.value?.data)) {
        setRefillAlerts(refillsRes.value.data);
      }

      if (feelingsRes.status === 'fulfilled' && feelingsRes.value?.data) {
        const fData = feelingsRes.value.data;
        if (fData.todayFeelingSubmitted) {
          feelingDone = true;
          loggedFeeling = fData.todayFeeling || loggedFeeling;
        }
        const fList = Array.isArray(fData) ? fData : Array.isArray(fData.feelings) ? fData.feelings : [];
        const todayMatch = fList.find((f) => {
          const d = f.date || f.logDate || '';
          return d.startsWith(todayStr);
        });
        if (todayMatch) {
          feelingDone = true;
          loggedFeeling = todayMatch;
        }
      }

      setTodayFeelingSubmitted(feelingDone);
      setTodayFeeling(loggedFeeling);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // 12:00 AM Midnight Automatic Refactor / Reset Engine
  useEffect(() => {
    let timerId;

    const scheduleMidnightReset = () => {
      const now = new Date();
      // Next midnight 00:00:00.500
      const tomorrowMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0, 0, 0, 500
      );
      const msUntilMidnight = tomorrowMidnight.getTime() - now.getTime();

      timerId = setTimeout(() => {
        // At 12:00 AM midnight, refactor state for the brand new day:
        const newDayStr = new Date().toISOString().split('T')[0];
        setTodayDateStr(newDayStr);
        setTodayFeelingSubmitted(false);
        setTodayFeeling(null);
        setIsEditingFeeling(false);

        // Invalidate stale caches so fresh tasks and feeling state populate
        api.invalidateCache('/api/v1/todo');
        api.invalidateCache('/api/v1/timeline');
        api.invalidateCache('/api/v1/timeline/feeling');
        loadDashboardData();

        // Schedule next midnight trigger
        scheduleMidnightReset();
      }, msUntilMidnight);
    };

    scheduleMidnightReset();

    // Check on tab focus or visibility change if user crossed midnight
    const handleVisibilityOrFocus = () => {
      const currentDay = new Date().toISOString().split('T')[0];
      if (currentDay !== todayDateStr) {
        setTodayDateStr(currentDay);
        setTodayFeelingSubmitted(false);
        setTodayFeeling(null);
        setIsEditingFeeling(false);
        api.invalidateCache();
        loadDashboardData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      if (timerId) clearTimeout(timerId);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [todayDateStr]);

  const handleFeelingCheckin = async (score) => {
    const color = score === 1 ? 'GREEN' : score === 2 ? 'ORANGE' : 'RED';
    const feelingObj = {
      feelingScore: score,
      severityColor: color,
      date: new Date().toISOString().split('T')[0],
      patientFeedback: 'Daily biometric dashboard feeling check-in',
    };

    // Reactively lock into completed state immediately
    setTodayFeeling(feelingObj);
    setTodayFeelingSubmitted(true);
    setIsEditingFeeling(false);
    setFeelingSaved(true);

    try {
      await api.logFeeling(score, 'Daily biometric dashboard feeling check-in');
    } catch (err) {
      console.error('Feeling log error:', err);
    }
    setTimeout(() => setFeelingSaved(false), 4000);
  };

  const completedTodos = todos.filter((t) => t.isCompleted).length;
  const totalTodos = todos.length;
  const adherencePercent = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 100;

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">PATIENT DASHBOARD</span>
          <h1>Welcome back, {name}.</h1>
          <p>Your personal health information is organized here. Access your timeline, prescriptions, household cabinet, and clinical AI companion.</p>
        </div>
        <Link className="primary-btn" to="/records">
          Upload a record ↗
        </Link>
      </div>

      {/* Incoming Doctor Access Request Alert Banner */}
      {pendingRequests.length > 0 && (
        <div
          className="dashboard-consent-banner"
          style={{
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
            border: '2px solid #f59e0b',
            borderRadius: '20px',
            padding: '18px 24px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            boxShadow: '0 8px 20px -6px rgba(245, 158, 11, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '28px' }}>🔐</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ color: '#92400e', fontSize: '16px' }}>
                  Doctor Access Request: Dr. {pendingRequests[0].doctorName || 'Attending Physician'}
                </strong>
                <span style={{ background: '#d97706', color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>
                  Action Required
                </span>
              </div>
              <p style={{ margin: '3px 0 0', color: '#b45309', fontSize: '13.5px' }}>
                Your 6-Digit Passcode: <strong style={{ fontSize: '16px', letterSpacing: '2px', background: '#ffffff', padding: '2px 8px', borderRadius: '6px', border: '1px solid #d97706' }}>{pendingRequests[0].authCode}</strong> • Share this code with your doctor to unlock records.
              </p>
            </div>
          </div>
          <Link
            to="/delegation"
            className="primary-btn"
            style={{
              background: '#b45309',
              padding: '10px 18px',
              fontSize: '13px',
              whiteSpace: 'nowrap',
            }}
          >
            Review in Consent & Access ↗
          </Link>
        </div>
      )}

      {/* 2-Day Refill Banner if any item is low */}
      {refillAlerts.length > 0 && (
        <div
          className="dashboard-refill-banner"
          style={{
            background: '#fff7ed',
            border: '1px solid #f97316',
            borderRadius: '20px',
            padding: '18px 24px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <div>
              <strong style={{ color: '#9a3412', fontSize: '16px' }}>
                Refill Warning: {refillAlerts.length} medicine(s) running out in &lt; 48 hours!
              </strong>
              <p style={{ margin: '2px 0 0', color: '#c2410c', fontSize: '13px' }}>
                {refillAlerts.map((r) => `${r.medicineName} (${r.pillsRemaining} remaining)`).join(', ')}
              </p>
            </div>
          </div>
          <Link
            to="/inventory"
            className="secondary-btn"
            style={{ padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap', borderColor: '#f97316', color: '#c2410c' }}
          >
            Review Cabinet →
          </Link>
        </div>
      )}

      {/* Daily Biometric Check-in Box */}
      {todayFeelingSubmitted && !isEditingFeeling ? (
        <div
          className="feeling-box"
          style={{
            background:
              todayFeeling?.feelingScore === 1 || todayFeeling?.severityColor === 'GREEN'
                ? 'linear-gradient(135deg, rgba(240, 253, 244, 0.9) 0%, rgba(220, 252, 231, 0.5) 100%)'
                : todayFeeling?.feelingScore === 2 || todayFeeling?.severityColor === 'ORANGE'
                ? 'linear-gradient(135deg, rgba(255, 247, 237, 0.9) 0%, rgba(254, 215, 170, 0.5) 100%)'
                : 'linear-gradient(135deg, rgba(254, 242, 242, 0.9) 0%, rgba(254, 202, 202, 0.5) 100%)',
            border:
              todayFeeling?.feelingScore === 1 || todayFeeling?.severityColor === 'GREEN'
                ? '1px solid #86efac'
                : todayFeeling?.feelingScore === 2 || todayFeeling?.severityColor === 'ORANGE'
                ? '1px solid #fdba74'
                : '1px solid #fca5a5',
            borderRadius: '24px',
            padding: '22px 28px',
            marginBottom: '28px',
            boxShadow: '0 8px 24px -6px rgba(0,0,0,0.04)',
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                className="eyebrow"
                style={{
                  color:
                    todayFeeling?.feelingScore === 1 || todayFeeling?.severityColor === 'GREEN'
                      ? '#15803d'
                      : todayFeeling?.feelingScore === 2 || todayFeeling?.severityColor === 'ORANGE'
                      ? '#c2410c'
                      : '#b91c1c',
                  margin: 0,
                  fontWeight: 800,
                }}
              >
                DAILY BIOMETRIC CHECK-IN
              </span>
              <span
                style={{
                  background:
                    todayFeeling?.feelingScore === 1 || todayFeeling?.severityColor === 'GREEN'
                      ? '#dcfce7'
                      : todayFeeling?.feelingScore === 2 || todayFeeling?.severityColor === 'ORANGE'
                      ? '#ffedd5'
                      : '#fee2e2',
                  color:
                    todayFeeling?.feelingScore === 1 || todayFeeling?.severityColor === 'GREEN'
                      ? '#15803d'
                      : todayFeeling?.feelingScore === 2 || todayFeeling?.severityColor === 'ORANGE'
                      ? '#9a3412'
                      : '#991b1b',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background:
                      todayFeeling?.feelingScore === 1 || todayFeeling?.severityColor === 'GREEN'
                        ? '#16a34a'
                        : todayFeeling?.feelingScore === 2 || todayFeeling?.severityColor === 'ORANGE'
                        ? '#ea580c'
                        : '#dc2626',
                    display: 'inline-block',
                  }}
                ></span>
                Completed for Today
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {feelingSaved && (
                <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700 }}>
                  ✓ Live Saved
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsEditingFeeling(true)}
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(0,0,0,0.12)',
                  color: 'var(--plum)',
                  padding: '6px 14px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s ease',
                }}
              >
                ✎ Change Response
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '14px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '16px',
                background:
                  todayFeeling?.feelingScore === 1 || todayFeeling?.severityColor === 'GREEN'
                    ? '#dcfce7'
                    : todayFeeling?.feelingScore === 2 || todayFeeling?.severityColor === 'ORANGE'
                    ? '#ffedd5'
                    : '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                flexShrink: 0,
              }}
            >
              {todayFeeling?.feelingScore === 1 || todayFeeling?.severityColor === 'GREEN'
                ? '🟢'
                : todayFeeling?.feelingScore === 2 || todayFeeling?.severityColor === 'ORANGE'
                ? '🟠'
                : '🔴'}
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontFamily: 'Manrope',
                  fontSize: '18px',
                  fontWeight: 800,
                  color:
                    todayFeeling?.feelingScore === 1 || todayFeeling?.severityColor === 'GREEN'
                      ? '#14532d'
                      : todayFeeling?.feelingScore === 2 || todayFeeling?.severityColor === 'ORANGE'
                      ? '#7c2d12'
                      : '#7f1d1d',
                }}
              >
                {todayFeeling?.feelingScore === 1 || todayFeeling?.severityColor === 'GREEN'
                  ? 'Feeling Well / Normal — Logged for Today'
                  : todayFeeling?.feelingScore === 2 || todayFeeling?.severityColor === 'ORANGE'
                  ? 'Mild Discomfort / Fatigue — Monitored for Today'
                  : 'Severe Symptoms / Adverse Issue — Escalated to Care Team'}
              </h3>
              <p
                style={{
                  margin: '4px 0 0',
                  color: 'var(--muted)',
                  fontSize: '13px',
                  lineHeight: 1.4,
                }}
              >
                Your biometric feeling is securely recorded in your clinical health story. This check-in refreshes automatically every night at 12:00 AM midnight.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="feeling-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="eyebrow" style={{ color: 'var(--plum)', margin: 0 }}>
                DAILY BIOMETRIC CHECK-IN
              </span>
              {isEditingFeeling ? (
                <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800 }}>
                  Editing Today's Entry
                </span>
              ) : (
                <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800 }}>
                  Pending for Today
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {feelingSaved && (
                <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700 }}>
                  ✓ Saved to live database
                </span>
              )}
              {isEditingFeeling && (
                <button
                  type="button"
                  onClick={() => setIsEditingFeeling(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--muted)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <h3 style={{ margin: '8px 0 3px', fontFamily: 'Manrope', fontSize: '20px' }}>
            How are you feeling today?
          </h3>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>
            Logging your daily symptoms helps your attending doctor spot subtle recovery trends. Once submitted, it automatically resets at 12:00 AM midnight.
          </p>

          <div className="feeling-btns" style={{ marginTop: '16px' }}>
            <button
              type="button"
              className={`feeling-btn ${todayFeeling?.feelingScore === 1 || todayFeeling?.severityColor === 'GREEN' ? 'active green' : ''}`}
              onClick={() => handleFeelingCheckin(1)}
            >
              <span>🟢</span>
              <span>Feeling Well / Normal</span>
            </button>
            <button
              type="button"
              className={`feeling-btn ${todayFeeling?.feelingScore === 2 || todayFeeling?.severityColor === 'ORANGE' ? 'active orange' : ''}`}
              onClick={() => handleFeelingCheckin(2)}
            >
              <span>🟠</span>
              <span>Mild Discomfort / Fatigue</span>
            </button>
            <button
              type="button"
              className={`feeling-btn ${todayFeeling?.feelingScore === 3 || todayFeeling?.severityColor === 'RED' ? 'active red' : ''}`}
              onClick={() => handleFeelingCheckin(3)}
            >
              <span>🔴</span>
              <span>Severe Symptoms / Adverse Issue</span>
            </button>
          </div>
        </div>
      )}

      {/* Top 4 Summary Cards */}
      <div className="dashboard-grid">
        <section className="summary-card accent">
          <span>YOUR MEDILOCKER UNIT ID</span>
          <strong>{unitId}</strong>
          <small>Share this Sovereign ID with authorized physicians for time-bound consultations.</small>
        </section>

        <section className="summary-card">
          <span>TODAY'S ADHERENCE</span>
          <strong>{totalTodos > 0 ? `${adherencePercent}%` : '100%'}</strong>
          <div className="progress-bar">
            <i style={{ width: `${adherencePercent}%` }}></i>
          </div>
          <small>{completedTodos} of {totalTodos} dosage routines logged.</small>
        </section>

        <section className="summary-card">
          <span>VERIFIED RECORDS</span>
          <strong>{recordsCount} Stored</strong>
          <small>Prescriptions, laboratory tests, and clinical timelines in live vault.</small>
        </section>

        <section className="summary-card">
          <span>MEDICINE CABINET</span>
          <strong>{inventoryCount} Supplies</strong>
          <small>Tracked household medicine supplies and expiry dates.</small>
        </section>
      </div>

      <div className="section-row">
        <div>
          <span className="eyebrow">QUICK ACCESS</span>
          <h2>Your health workspace.</h2>
        </div>
      </div>

      {/* Quick Action Grid */}
      <div className="quick-grid">
        <Link to="/timeline" className="quick-card">
          <span style={{ background: 'var(--lav)' }}>⏳</span>
          <div>
            <strong>Health Timeline</strong>
            <small>Chronological consultation events & symptoms.</small>
          </div>
          ↗
        </Link>

        <Link to="/records" className="quick-card">
          <span>▤</span>
          <div>
            <strong>Medical Records</strong>
            <small>Prescriptions, reports, and real-time OCR upload.</small>
          </div>
          ↗
        </Link>

        <Link to="/medications" className="quick-card todo">
          <span>✓</span>
          <div>
            <strong>Medication To-Do</strong>
            <small>Daily dosage schedule & 0ms adherence checkboxes.</small>
          </div>
          ↗
        </Link>

        <Link to="/inventory" className="quick-card">
          <span style={{ background: 'var(--peach)' }}>⊞</span>
          <div>
            <strong>Medicine Cabinet</strong>
            <small>Household supplies, barcode scan & refill alerts.</small>
          </div>
          ↗
        </Link>

        <Link to="/companion" className="quick-card">
          <span style={{ background: 'var(--plum)', color: '#fff' }}>✦</span>
          <div>
            <strong>Medi-AI Companion</strong>
            <small>Voice intake, disease prediction & SOCRATES triage.</small>
          </div>
          ↗
        </Link>

        <Link to="/kiosk" className="quick-card" style={{ borderLeft: '4px solid #0284c7' }}>
          <span style={{ background: '#e0f2fe', color: '#0284c7' }}>🏥</span>
          <div>
            <strong>OPD Touch Kiosk</strong>
            <small>Interactive anatomical body-map & regional audio self-check-in.</small>
          </div>
          ↗
        </Link>

        {(user?.role === 'DOCTOR' || user?.role === 'ADMIN') && (
          <Link to="/vaidya" className="quick-card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <span style={{ background: '#fef3c7', color: '#b45309' }}>🩺</span>
            <div>
              <strong>Vaidya 30s Chart</strong>
              <small>30-second OPD synthesis, NAMASTE codes & FHIR export.</small>
            </div>
            ↗
          </Link>
        )}

        {(user?.role === 'DOCTOR' || user?.role === 'HOSPITAL' || user?.role === 'ADMIN') && (
          <Link to="/scanner" className="quick-card" style={{ borderLeft: '4px solid #dc2626' }}>
            <span style={{ background: '#fee2e2', color: '#dc2626' }}>🚨</span>
            <div>
              <strong>Emergency QR Scanner</strong>
              <small>Instant camera scan for ER vitals, blood group & allergies.</small>
            </div>
            ↗
          </Link>
        )}

        <Link to="/delegation" className="quick-card">
          <span style={{ background: '#e8dfd8' }}>🛡</span>
          <div>
            <strong>Consent & Access</strong>
            <small>Generate 15-minute 6-digit access codes for clinics.</small>
          </div>
          ↗
        </Link>
      </div>
    </>
  );
}
