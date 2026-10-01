import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export function Delegation() {
  const { t } = useLanguage();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeDelegations, setActiveDelegations] = useState([]);
  const [pastHistory, setPastHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Self-generated OTP code form
  const [doctorName, setDoctorName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchDelegationData = async () => {
    try {
      setLoading(true);
      const [requestsRes, listRes] = await Promise.allSettled([
        api.getPatientRequests(),
        api.listDelegations(),
      ]);

      if (requestsRes.status === 'fulfilled' && requestsRes.value?.data) {
        const d = requestsRes.value.data;
        setPendingRequests(Array.isArray(d.pendingRequests) ? d.pendingRequests : []);
        setActiveDelegations(Array.isArray(d.activeDelegations) ? d.activeDelegations : []);
        setPastHistory(Array.isArray(d.pastHistory) ? d.pastHistory : []);
      } else if (listRes.status === 'fulfilled' && Array.isArray(listRes.value?.data)) {
        const list = listRes.value.data;
        setActiveDelegations(list.filter((x) => x.status === 'ACTIVE'));
        setPastHistory(list.filter((x) => x.status !== 'ACTIVE'));
      }
    } catch (err) {
      console.error('Error fetching delegation requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDelegationData();
    const interval = setInterval(fetchDelegationData, 15000); // Polling every 15s for incoming requests
    return () => clearInterval(interval);
  }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.createDelegation({
        doctorName: doctorName.trim() || 'Attending Physician',
        durationMinutes: Number(durationMinutes),
      });
      const code = res?.data?.code || res?.data?.accessCode || res?.data?.authCode;
      if (code) {
        setGeneratedCode(code);
        fetchDelegationData();
      }
    } catch (err) {
      alert('Failed to generate access code: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('Are you sure you want to revoke this physician\'s access immediately? They will lose access to your medical records in real-time.')) return;
    setActionLoadingId(id);
    try {
      await api.revokeDelegation(id);
      fetchDelegationData();
    } catch (err) {
      alert('Revocation failed: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  return (
    <div className="delegation-page" style={{ paddingBottom: '60px' }}>
      {/* Page Header */}
      <div className="page-title">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              className="eyebrow"
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                color: '#ffffff',
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.06em',
              }}
            >
              PATIENT CONSENT & ACCESS GOVERNANCE
            </span>
            <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 700 }}>
              • ABDM Sovereign EMR
            </span>
          </div>
          <h1 style={{ margin: 0 }}>Consent & Doctor Access Manager</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
            Approve incoming doctor requests, share your single-use 6-digit access codes, and revoke physician permissions at any time.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchDelegationData}
          className="secondary-btn"
          style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          🔄 Refresh Requests
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: INCOMING DOCTOR ACCESS REQUESTS & 6-DIGIT PASSCODES            */}
      {/* ========================================================================= */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <span className="eyebrow" style={{ color: '#b45309', margin: 0 }}>ACTION REQUIRED</span>
            <h2 style={{ fontSize: '20px', margin: '2px 0 0', fontFamily: 'Manrope' }}>
              Incoming Doctor Access Requests ({pendingRequests.length})
            </h2>
          </div>
          {pendingRequests.length > 0 && (
            <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 800 }}>
              ● Pending Verification
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)', background: '#ffffff', borderRadius: '20px', border: '1px solid var(--line)' }}>
            Checking incoming authorization requests...
          </div>
        ) : pendingRequests.length === 0 ? (
          <div
            style={{
              background: '#f8fafc',
              border: '1.5px dashed #cbd5e1',
              borderRadius: '20px',
              padding: '32px 24px',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>🛡️</span>
            <strong style={{ fontSize: '15px', color: '#334155', display: 'block' }}>
              No Pending Doctor Access Requests
            </strong>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '13px' }}>
              When a doctor searches your MediLocker Unit ID and sends an access request, their request and your single-use 6-digit code will appear right here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {pendingRequests.map((req) => {
              const expiresAt = req.codeExpiresAt ? new Date(req.codeExpiresAt) : null;
              const now = new Date();
              const minsLeft = expiresAt ? Math.max(1, Math.round((expiresAt.getTime() - now.getTime()) / 60000)) : 15;
              const durationHours = req.requestedDurationMinutes >= 60 ? `${req.requestedDurationMinutes / 60} hour(s)` : `${req.requestedDurationMinutes} mins`;

              return (
                <div
                  key={req.id}
                  style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)',
                    border: '2px solid #f59e0b',
                    borderRadius: '24px',
                    padding: '24px',
                    boxShadow: '0 12px 30px -8px rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        DOCTOR ACCESS REQUEST
                      </span>
                      <h3 style={{ margin: '2px 0 0', fontSize: '18px', color: '#0f172a', fontFamily: 'Manrope' }}>
                        {req.doctorName ? `Dr. ${req.doctorName}` : 'Attending Physician'}
                      </h3>
                      <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                        {req.organization || 'MediLocker Clinic'} • {req.specialization || 'General Practice'}
                        {req.registrationNumber ? ` (Reg: ${req.registrationNumber})` : ''}
                      </div>
                    </div>

                    <span
                      style={{
                        background: '#fef3c7',
                        color: '#92400e',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 800,
                      }}
                    >
                      ⏳ Expires in {minsLeft}m
                    </span>
                  </div>

                  {/* 6-Digit Passcode Box */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '2px dashed #d97706',
                      borderRadius: '16px',
                      padding: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#b45309', letterSpacing: '1px' }}>
                      YOUR 6-DIGIT VERIFICATION PASSCODE
                    </span>
                    <div
                      style={{
                        fontSize: '36px',
                        fontWeight: 900,
                        fontFamily: 'Manrope, monospace',
                        color: '#b45309',
                        letterSpacing: '8px',
                        margin: '6px 0',
                      }}
                    >
                      {req.authCode || '------'}
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#78350f' }}>
                      Tell this 6-digit code to Dr. {req.doctorName || 'your doctor'} to unlock your records for <strong>{durationHours}</strong>.
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleCopy(req.authCode)}
                      className="secondary-btn"
                      style={{ padding: '8px 14px', fontSize: '12.5px', borderColor: '#d97706', color: '#b45309' }}
                    >
                      {copiedCode ? '✓ Copied Code' : '📋 Copy Code'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRevoke(req.id)}
                      disabled={actionLoadingId === req.id}
                      style={{
                        background: '#fee2e2',
                        color: '#b91c1c',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '8px 14px',
                        fontWeight: 700,
                        fontSize: '12.5px',
                        cursor: 'pointer',
                      }}
                    >
                      {actionLoadingId === req.id ? 'Rejecting...' : '✕ Reject Request'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: ACTIVE UNLOCKED SESSIONS & REVOKE PERMISSIONS                  */}
      {/* ========================================================================= */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <span className="eyebrow" style={{ color: '#047857', margin: 0 }}>LIVE AUTHORIZATIONS</span>
            <h2 style={{ fontSize: '20px', margin: '2px 0 0', fontFamily: 'Manrope' }}>
              Active Doctor Consultations ({activeDelegations.length})
            </h2>
          </div>
          {activeDelegations.length > 0 && (
            <span style={{ background: '#dcfce7', color: '#15803d', padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 800 }}>
              ● Unlocked & Decrypted
            </span>
          )}
        </div>

        {activeDelegations.length === 0 ? (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '24px',
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: '13.5px',
            }}
          >
            No active physician consultations currently open. Your health vault is locked and sovereign.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {activeDelegations.map((act) => {
              const expiresAt = act.expiresAt ? new Date(act.expiresAt) : null;

              return (
                <div
                  key={act.id}
                  style={{
                    background: '#ffffff',
                    border: '1.5px solid #86efac',
                    borderRadius: '16px',
                    padding: '18px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '14px',
                    boxShadow: '0 4px 14px rgba(22, 163, 74, 0.06)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '16px', color: '#0f172a' }}>
                        {act.doctorName ? `Dr. ${act.doctorName}` : 'Authorized Physician'}
                      </strong>
                      <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                        ✓ ACTIVE EMR ACCESS
                      </span>
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '3px' }}>
                      Organization: <strong style={{ color: '#334155' }}>{act.organization || 'Clinical Practice'}</strong> • Access Expires: <strong style={{ color: '#15803d' }}>{expiresAt ? expiresAt.toLocaleString() : 'Active Session'}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRevoke(act.id)}
                    disabled={actionLoadingId === act.id}
                    style={{
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '10px 18px',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)',
                    }}
                  >
                    {actionLoadingId === act.id ? 'Revoking Access...' : 'Revoke Access Immediately ✕'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: SELF-GENERATED 6-DIGIT EMERGENCY CODE                          */}
      {/* ========================================================================= */}
      <div className="delegation-grid" style={{ marginBottom: '32px' }}>
        <div
          style={{
            background: 'var(--white)',
            border: '1px solid var(--line)',
            borderRadius: '24px',
            padding: '28px',
            boxShadow: 'var(--shadow)',
          }}
        >
          <span className="eyebrow">SELF-SERVICE CODE</span>
          <h2 style={{ fontFamily: 'Manrope', margin: '6px 0 12px' }}>Generate Walk-In Doctor OTP</h2>
          <p style={{ color: 'var(--muted)', fontSize: '13.5px', margin: '0 0 18px' }}>
            Visiting a clinic in person? Generate an instant 6-digit access code for your doctor.
          </p>

          <form onSubmit={handleGenerate}>
            <label style={{ display: 'block', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                Doctor or Hospital Name (Optional)
              </span>
              <input
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="e.g. Dr. Rajesh Khanna (Cardiology)"
                style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--line)', fontSize: '14px' }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: '18px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                Access Duration
              </span>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--line)', fontSize: '14px' }}
              >
                <option value={30}>30 Minutes (Quick OPD Consult)</option>
                <option value={60}>1 Hour (Standard Consultation)</option>
                <option value={120}>2 Hours (Detailed Evaluation)</option>
                <option value={1440}>24 Hours (Day Care / Observation)</option>
                <option value={10080}>7 Days (Extended Hospital Admission)</option>
              </select>
            </label>

            <button className="primary-btn" type="submit" disabled={creating} style={{ width: '100%', padding: '12px', fontSize: '14px' }}>
              {creating ? 'Generating Secure Code...' : 'Generate 6-Digit Code 🔑'}
            </button>
          </form>

          {generatedCode && (
            <div
              style={{
                marginTop: '18px',
                background: '#f0fdf4',
                border: '2px dashed #22c55e',
                borderRadius: '16px',
                padding: '16px',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#15803d', letterSpacing: '1px' }}>
                SINGLE-USE PASSCODE (VALID FOR 15 MINS)
              </span>
              <div style={{ fontSize: '32px', fontWeight: 900, fontFamily: 'Manrope, monospace', color: '#166534', margin: '6px 0', letterSpacing: '6px' }}>
                {generatedCode}
              </div>
              <small style={{ color: '#166534' }}>Tell this code to the doctor to decrypt and unlock your timeline.</small>
            </div>
          )}
        </div>

        {/* Security & Cryptography Guarantee */}
        <div
          style={{
            background: 'var(--plum-dark)',
            color: '#fff',
            borderRadius: '24px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span className="eyebrow" style={{ color: '#d5cdda' }}>ZERO PHI LEAK GUARANTEE</span>
            <h2 style={{ fontFamily: 'Manrope', margin: '6px 0 14px' }}>Cryptographic Guardrails</h2>
            <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: 1.8, fontSize: '13.5px', color: '#e2e8f0' }}>
              <li><strong>Zero PHI Search Exposure:</strong> When a clinic searches your Unit ID, only your Name and DOB are displayed until you authorize.</li>
              <li><strong>Argon2id Hashing:</strong> Access tokens and MPINs are one-way hashed with enterprise salt.</li>
              <li><strong>Automatic Expiration:</strong> Once time lapses, the authorization token is invalidated across all nodes.</li>
              <li><strong>1-Click Instant Revocation:</strong> Revoke access anytime with immediate 0ms cut-off.</li>
            </ul>
          </div>

          <div style={{ marginTop: '20px', background: 'rgba(255, 255, 255, 0.08)', padding: '14px', borderRadius: '14px', fontSize: '13px' }}>
            🔒 Aligned with ABDM Unified Health Interface (UHI) consent protocols.
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 4: AUDIT TRAIL & LOG HISTORY                                      */}
      {/* ========================================================================= */}
      <div
        style={{
          background: 'var(--white)',
          border: '1px solid var(--line)',
          borderRadius: '24px',
          padding: '26px',
          boxShadow: 'var(--shadow)',
        }}
      >
        <span className="eyebrow">AUDIT TRAIL</span>
        <h3 style={{ fontFamily: 'Manrope', fontSize: '20px', margin: '6px 0 16px' }}>
          Consent & Access Log History ({pastHistory.length})
        </h3>

        {pastHistory.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '14px', margin: 0 }}>
            No past delegation history recorded yet.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {pastHistory.map((item) => {
              const statusUpper = item.status?.toUpperCase() || 'EXPIRED';
              const isRevoked = statusUpper === 'REVOKED';

              return (
                <div
                  key={item.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid var(--line)',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                      {item.doctorName ? `Dr. ${item.doctorName}` : 'Healthcare Provider'}
                    </strong>
                    <div style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '2px' }}>
                      {item.organization || 'Medical Practice'} • Date: {new Date(item.createdAt || item.grantedAt || Date.now()).toLocaleDateString()}
                    </div>
                  </div>

                  <span
                    style={{
                      background: isRevoked ? '#fee2e2' : '#f1f5f9',
                      color: isRevoked ? '#b91c1c' : '#64748b',
                      padding: '3px 10px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 800,
                    }}
                  >
                    {statusUpper}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
