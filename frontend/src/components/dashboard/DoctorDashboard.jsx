import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

export function DoctorDashboard({ user }) {
  const { t } = useLanguage();
  const [appointments, setAppointments] = useState([]);
  const [activePatients, setActivePatients] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Send Request & OTP Unlock state
  const [searchId, setSearchId] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  
  const [selectedDuration, setSelectedDuration] = useState(120); // default 2 hours (120 mins)
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState('');

  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');

  // Appointment Status action state
  const [apptFilter, setApptFilter] = useState('ALL');
  const [updatingApptId, setUpdatingApptId] = useState(null);

  // Unlocked Patient Modal
  const [selectedPatientData, setSelectedPatientData] = useState(null);
  const [loadingPatientData, setLoadingPatientData] = useState(false);
  const [patientModalOpen, setPatientModalOpen] = useState(false);

  const doctorName = user?.name || user?.doctorProfile?.fullName || user?.email?.split('@')[0] || 'Doctor';
  const doctorSpecialty = user?.doctorProfile?.specialty || user?.doctorProfile?.specialization || 'General Physician';
  const hospitalName = user?.doctorProfile?.hospitalName || user?.doctorProfile?.clinicName || 'MediLocker Clinical Network';

  const loadDoctorData = async () => {
    try {
      setLoading(true);
      const [apptsRes, activeRes, pendingRes] = await Promise.allSettled([
        api.getMyAppointments(),
        api.getDoctorActivePatients(),
        api.getProviderPendingRequests(),
      ]);

      if (apptsRes.status === 'fulfilled' && apptsRes.value?.data) {
        setAppointments(Array.isArray(apptsRes.value.data) ? apptsRes.value.data : []);
      }
      if (activeRes.status === 'fulfilled' && activeRes.value?.data) {
        setActivePatients(Array.isArray(activeRes.value.data) ? activeRes.value.data : []);
      }
      if (pendingRes.status === 'fulfilled' && pendingRes.value?.data) {
        setPendingRequests(Array.isArray(pendingRes.value.data) ? pendingRes.value.data : []);
      }
    } catch (err) {
      console.error('Failed to load doctor dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctorData();
  }, []);

  // Search Patient
  const handleSearchPatient = async (e) => {
    e?.preventDefault();
    if (!searchId.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearchResult(null);
    setRequestSuccess('');
    setOtpSuccess('');

    try {
      const res = await api.searchPatient(searchId.trim());
      if (res?.data) {
        setSearchResult(res.data);
      } else {
        setSearchError('No patient found with this MediLocker Unit ID or phone number.');
      }
    } catch (err) {
      setSearchError(err.message || 'Patient not found or invalid Unit ID.');
    } finally {
      setSearching(false);
    }
  };

  // Send Access Request
  const handleSendAccessRequest = async () => {
    if (!searchResult?.medilockerId) return;
    setSendingRequest(true);
    setRequestSuccess('');
    setSearchError('');

    try {
      await api.createAccessRequest({
        patientMedilockerId: searchResult.medilockerId,
        durationMinutes: selectedDuration,
      });
      setRequestSuccess(`✓ Access request successfully sent to ${searchResult.fullName || 'patient'} for ${selectedDuration >= 60 ? `${selectedDuration / 60} hour(s)` : `${selectedDuration} mins`}. Awaiting patient approval.`);
      loadDoctorData();
    } catch (err) {
      setSearchError(err.message || 'Failed to send access request.');
    } finally {
      setSendingRequest(false);
    }
  };

  // Verify OTP Code
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setOtpError('Please enter a valid 6-digit patient verification code.');
      return;
    }
    const targetId = searchResult?.medilockerId || searchId.trim();
    if (!targetId) {
      setOtpError('Please search for or enter the Patient MediLocker ID first.');
      return;
    }

    setVerifyingOtp(true);
    setOtpError('');
    setOtpSuccess('');

    try {
      const res = await api.verifyPatientOtp({
        patientMedilockerId: targetId,
        authCode: otpCode.trim(),
      });
      setOtpSuccess('🔓 Patient records unlocked and decrypted successfully! Active session granted.');
      setOtpCode('');
      loadDoctorData();
      if (res?.data?.patient) {
        viewPatientFullData(res.data.patient.id || res.data.patientId);
      }
    } catch (err) {
      setOtpError(err.message || 'Invalid or expired 6-digit verification code.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Update Appointment Status
  const handleUpdateApptStatus = async (appointmentId, newStatus) => {
    setUpdatingApptId(appointmentId);
    try {
      await api.updateAppointmentStatus(appointmentId, newStatus);
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, status: newStatus } : a))
      );
    } catch (err) {
      alert(err.message || 'Failed to update appointment status.');
    } finally {
      setUpdatingApptId(null);
    }
  };

  // View Unlocked Patient Full Data
  const viewPatientFullData = async (patientId) => {
    setLoadingPatientData(true);
    setPatientModalOpen(true);
    try {
      const res = await api.getDoctorPatientFullData(patientId);
      setSelectedPatientData(res?.data || null);
    } catch (err) {
      alert(err.message || 'Failed to fetch patient full medical record.');
      setPatientModalOpen(false);
    } finally {
      setLoadingPatientData(false);
    }
  };

  // Revoke delegation
  const handleRevoke = async (delegationId) => {
    if (!window.confirm('Are you sure you want to end this patient consultation session?')) return;
    try {
      await api.revokeDelegation(delegationId);
      loadDoctorData();
    } catch (err) {
      alert(err.message || 'Failed to revoke access.');
    }
  };

  // Filter appointments
  const filteredAppointments = appointments.filter((a) => {
    if (apptFilter === 'ALL') return true;
    return a.status?.toUpperCase() === apptFilter;
  });

  const pendingCount = appointments.filter((a) => a.status?.toUpperCase() === 'PENDING').length;
  const confirmedCount = appointments.filter((a) => a.status?.toUpperCase() === 'CONFIRMED').length;
  const activeCount = activePatients.length;

  return (
    <div className="doctor-dashboard" style={{ paddingBottom: '60px' }}>
      {/* Doctor Header */}
      <div className="page-title" style={{ marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              className="eyebrow"
              style={{
                background: 'linear-gradient(135deg, #b45309 0%, #d97706 100%)',
                color: '#ffffff',
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.06em',
              }}
            >
              DOCTOR CLINICAL CONSOLE
            </span>
            <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 700 }}>
              • {doctorSpecialty}
            </span>
          </div>
          <h1 style={{ margin: 0 }}>Welcome, Dr. {doctorName}</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
            Manage incoming appointment requests, send time-bound health vault requests, and access Medi-AI and Kiosk.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link
            to="/companion"
            className="primary-btn"
            style={{
              background: 'linear-gradient(135deg, var(--plum) 0%, #3b2a52 100%)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              fontSize: '13.5px',
            }}
          >
            <span>✦</span> Launch Medi-AI
          </Link>
          <Link
            to="/kiosk"
            className="secondary-btn"
            style={{
              borderColor: '#0284c7',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              fontSize: '13.5px',
            }}
          >
            <span>🏥</span> OPD Kiosk
          </Link>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="dashboard-grid" style={{ marginBottom: '28px' }}>
        <section
          className="summary-card"
          style={{
            borderLeft: '4px solid #f59e0b',
            background: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)',
          }}
        >
          <span style={{ color: '#b45309' }}>RECEIVED APPOINTMENT REQUESTS</span>
          <strong style={{ color: '#92400e', fontSize: '28px' }}>{pendingCount} Pending</strong>
          <small>{appointments.length} total patient consultations in queue.</small>
        </section>

        <section
          className="summary-card"
          style={{
            borderLeft: '4px solid #10b981',
            background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%)',
          }}
        >
          <span style={{ color: '#047857' }}>CONFIRMED CONSULTATIONS</span>
          <strong style={{ color: '#065f46', fontSize: '28px' }}>{confirmedCount} Active</strong>
          <small>Scheduled visits ready for clinical intake & diagnosis.</small>
        </section>

        <section
          className="summary-card"
          style={{
            borderLeft: '4px solid #3b82f6',
            background: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)',
          }}
        >
          <span style={{ color: '#1d4ed8' }}>ACTIVE PATIENT RECORD ACCESS</span>
          <strong style={{ color: '#1e40af', fontSize: '28px' }}>{activeCount} Unlocked</strong>
          <small>Patients who granted time-bound EMR decryption access.</small>
        </section>

        <section
          className="summary-card"
          style={{
            borderLeft: '4px solid var(--plum)',
            background: 'linear-gradient(180deg, var(--lav) 0%, #ffffff 100%)',
          }}
        >
          <span style={{ color: 'var(--plum)' }}>CLINICAL AI & TRIAGE</span>
          <strong style={{ color: 'var(--plum)', fontSize: '28px' }}>Active</strong>
          <small>ICD-10, NAMASTE, voice intake & OPD touch kiosk ready.</small>
        </section>
      </div>

      {/* TWO PRIMARY SPACES: SPACE 1 (Send Request / Unlock) & SPACE 2 (Received Appointments) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        
        {/* ========================================================================= */}
        {/* SPACE 1: SEND ACCESS REQUEST & UNLOCK PATIENT RECORDS                     */}
        {/* ========================================================================= */}
        <div
          className="doctor-panel"
          style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '24px',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span className="eyebrow" style={{ color: '#b45309', margin: 0 }}>
                PATIENT SOVEREIGN LOCKER ACCESS
              </span>
              <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                EHR DELEGATION
              </span>
            </div>
            <h2 style={{ fontSize: '20px', margin: 0, fontFamily: 'Manrope' }}>
              Send Request & Unlock Patient Records
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '13px' }}>
              Search a patient by their Sovereign Unit ID or mobile number to send an access request or enter their 6-digit OTP.
            </p>
          </div>

          {/* Search Box */}
          <form onSubmit={handleSearchPatient} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="Enter Patient Unit ID (e.g. ML-1001-5821) or Mobile..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(0,0,0,0.15)',
                fontSize: '14px',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={searching || !searchId.trim()}
              className="primary-btn"
              style={{
                background: '#b45309',
                padding: '0 20px',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                opacity: searching || !searchId.trim() ? 0.6 : 1,
              }}
            >
              {searching ? 'Searching...' : 'Search Patient ↗'}
            </button>
          </form>

          {/* Search Error */}
          {searchError && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600 }}>
              ⚠️ {searchError}
            </div>
          )}

          {/* Found Patient Info Card */}
          {searchResult && (
            <div
              style={{
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '16px', color: '#0f172a', display: 'block' }}>
                    {searchResult.fullName || searchResult.name || 'Verified Patient'}
                  </strong>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
                    Unit ID: {searchResult.medilockerId || searchId} • DOB: {searchResult.dob ? new Date(searchResult.dob).toLocaleDateString() : 'Protected'}
                  </span>
                </div>
                <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800 }}>
                  ✓ Locker Found
                </span>
              </div>

              {/* Action Tabs: Send Request OR Instant OTP Unlock */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                <strong style={{ fontSize: '12px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Option 1: Send Time-Bound Access Request
                </strong>
                <p style={{ margin: '2px 0 8px', fontSize: '12px', color: 'var(--muted)' }}>
                  Patient will receive a push notification to authorize your clinic for:
                </p>

                {/* Duration Pills */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {[
                    { label: '30 Mins', val: 30 },
                    { label: '1 Hour', val: 60 },
                    { label: '2 Hours', val: 120 },
                    { label: '12 Hours', val: 720 },
                    { label: '24 Hours', val: 1440 },
                    { label: '7 Days', val: 10080 },
                  ].map((dur) => (
                    <button
                      key={dur.val}
                      type="button"
                      onClick={() => setSelectedDuration(dur.val)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: selectedDuration === dur.val ? '2px solid #b45309' : '1px solid #cbd5e1',
                        background: selectedDuration === dur.val ? '#fef3c7' : '#ffffff',
                        color: selectedDuration === dur.val ? '#92400e' : '#334155',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleSendAccessRequest}
                  disabled={sendingRequest}
                  className="primary-btn"
                  style={{
                    background: '#b45309',
                    width: '100%',
                    padding: '10px',
                    fontSize: '13.5px',
                    opacity: sendingRequest ? 0.6 : 1,
                  }}
                >
                  {sendingRequest ? 'Sending Request...' : `Send Access Request (${selectedDuration >= 60 ? `${selectedDuration / 60}h` : `${selectedDuration}m`}) ↗`}
                </button>
              </div>

              {/* Instant OTP Unlock Form */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                <strong style={{ fontSize: '12px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Option 2: Instant 6-Digit OTP Unlock
                </strong>
                <p style={{ margin: '2px 0 8px', fontSize: '12px', color: 'var(--muted)' }}>
                  If the patient is in front of you, enter their 6-digit MediLocker code:
                </p>

                <form onSubmit={handleVerifyOtp} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="6-digit code (e.g. 849201)"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    style={{
                      width: '160px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '15px',
                      fontWeight: 800,
                      letterSpacing: '2px',
                      textAlign: 'center',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={verifyingOtp || otpCode.length !== 6}
                    className="secondary-btn"
                    style={{
                      flex: 1,
                      borderColor: '#10b981',
                      color: '#047857',
                      background: '#ecfdf5',
                      fontWeight: 800,
                      fontSize: '13px',
                      opacity: verifyingOtp || otpCode.length !== 6 ? 0.6 : 1,
                    }}
                  >
                    {verifyingOtp ? 'Verifying...' : '🔓 Unlock Records Now'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Success Alerts */}
          {requestSuccess && (
            <div style={{ background: '#ecfdf5', color: '#065f46', padding: '12px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 600, border: '1px solid #a7f3d0' }}>
              {requestSuccess}
            </div>
          )}

          {otpSuccess && (
            <div style={{ background: '#ecfdf5', color: '#065f46', padding: '12px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 600, border: '1px solid #a7f3d0' }}>
              {otpSuccess}
            </div>
          )}

          {otpError && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600 }}>
              ⚠️ {otpError}
            </div>
          )}

          {/* Active Unlocked Patient Consultations List */}
          <div style={{ marginTop: '10px', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span className="eyebrow" style={{ color: 'var(--plum)', margin: 0 }}>
                ACTIVE UNLOCKED PATIENT LOCKERS ({activePatients.length})
              </span>
              <button
                type="button"
                onClick={loadDoctorData}
                style={{ background: 'none', border: 'none', color: 'var(--plum)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                🔄 Refresh
              </button>
            </div>

            {activePatients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--muted)', background: '#f8fafc', borderRadius: '12px', fontSize: '13px' }}>
                No active patient lockers currently unlocked. Search a patient above to request access.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activePatients.map((ap) => {
                  const pName = ap.patient?.fullName || ap.patient?.name || 'Authorized Patient';
                  const pId = ap.patientId || ap.patient?.id;
                  const unit = ap.patient?.medilockerId || 'ML-SECURE';
                  const expiresAt = ap.expiresAt ? new Date(ap.expiresAt) : null;
                  const isExpired = expiresAt && expiresAt < new Date();

                  return (
                    <div
                      key={ap.id || pId}
                      style={{
                        padding: '12px 16px',
                        background: '#f8fafc',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>{pName}</strong>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          ID: <span style={{ fontWeight: 700 }}>{unit}</span> • Expires: {expiresAt ? expiresAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Session'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => viewPatientFullData(pId)}
                          className="primary-btn"
                          style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--plum)' }}
                        >
                          View Vault ↗
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevoke(ap.id)}
                          style={{
                            padding: '6px 10px',
                            fontSize: '12px',
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          End
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SPACE 2: RECEIVED APPOINTMENT REQUESTS                                    */}
        {/* ========================================================================= */}
        <div
          className="doctor-panel"
          style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '24px',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span className="eyebrow" style={{ color: '#0284c7', margin: 0 }}>
                CLINICAL QUEUE
              </span>
              <h2 style={{ fontSize: '20px', margin: 0, fontFamily: 'Manrope' }}>
                Received Appointment Requests
              </h2>
            </div>
            <span
              style={{
                background: '#e0f2fe',
                color: '#0369a1',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 800,
              }}
            >
              {filteredAppointments.length} Items
            </span>
          </div>

          {/* Status Filter Chips */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'PENDING', label: `Pending (${pendingCount})` },
              { id: 'CONFIRMED', label: `Confirmed (${confirmedCount})` },
              { id: 'COMPLETED', label: 'Completed' },
              { id: 'CANCELLED', label: 'Cancelled' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setApptFilter(f.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '999px',
                  border: apptFilter === f.id ? '2px solid var(--plum)' : '1px solid #e2e8f0',
                  background: apptFilter === f.id ? 'var(--lav)' : '#f8fafc',
                  color: apptFilter === f.id ? 'var(--plum)' : '#64748b',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Appointments List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
              Loading appointment requests...
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 20px',
                background: '#f8fafc',
                borderRadius: '16px',
                border: '1px dashed #cbd5e1',
              }}
            >
              <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>📅</span>
              <strong style={{ fontSize: '15px', color: '#334155', display: 'block' }}>
                No {apptFilter !== 'ALL' ? apptFilter.toLowerCase() : ''} appointment requests found
              </strong>
              <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '13px' }}>
                When patients book consultations with Dr. {doctorName}, their requests appear here for immediate review.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '550px', overflowY: 'auto', paddingRight: '4px' }}>
              {filteredAppointments.map((appt) => {
                const patName = appt.patient?.fullName || appt.patient?.name || appt.patientUser?.name || 'Patient';
                const patUnit = appt.patient?.medilockerId || appt.patientUser?.medilockerId || 'ML-PATIENT';
                const status = appt.status?.toUpperCase() || 'PENDING';
                const dateStr = appt.date || appt.appointmentDate || 'Today';
                const slotStr = appt.slot || appt.timeSlot || 'Scheduled Slot';
                const reason = appt.reason || appt.notes || 'General Consultation / Routine Checkup';
                const isUpdating = updatingApptId === appt.id;

                const badgeBg =
                  status === 'CONFIRMED'
                    ? '#dcfce7'
                    : status === 'PENDING'
                    ? '#fef3c7'
                    : status === 'COMPLETED'
                    ? '#e0e7ff'
                    : '#fee2e2';

                const badgeColor =
                  status === 'CONFIRMED'
                    ? '#15803d'
                    : status === 'PENDING'
                    ? '#b45309'
                    : status === 'COMPLETED'
                    ? '#4338ca'
                    : '#b91c1c';

                return (
                  <div
                    key={appt.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '16px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontSize: '15px', color: '#0f172a' }}>{patName}</strong>
                          <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            {patUnit}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                          🗓 {dateStr} • ⏰ {slotStr}
                        </div>
                      </div>

                      <span
                        style={{
                          background: badgeBg,
                          color: badgeColor,
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {status}
                      </span>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', color: '#334155' }}>
                      <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', display: 'block' }}>Reason for Visit:</strong>
                      {reason}
                    </div>

                    {/* Action Controls for Doctor */}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px', flexWrap: 'wrap' }}>
                      {status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleUpdateApptStatus(appt.id, 'CONFIRMED')}
                            className="primary-btn"
                            style={{
                              padding: '6px 14px',
                              fontSize: '12.5px',
                              background: '#10b981',
                              opacity: isUpdating ? 0.6 : 1,
                            }}
                          >
                            ✓ Accept & Confirm
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleUpdateApptStatus(appt.id, 'CANCELLED')}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12.5px',
                              background: '#fee2e2',
                              color: '#b91c1c',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontWeight: 700,
                              opacity: isUpdating ? 0.6 : 1,
                            }}
                          >
                            ✕ Decline
                          </button>
                        </>
                      )}

                      {status === 'CONFIRMED' && (
                        <>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleUpdateApptStatus(appt.id, 'COMPLETED')}
                            className="primary-btn"
                            style={{
                              padding: '6px 14px',
                              fontSize: '12.5px',
                              background: 'var(--plum)',
                              opacity: isUpdating ? 0.6 : 1,
                            }}
                          >
                            ✓ Mark as Completed
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleUpdateApptStatus(appt.id, 'CANCELLED')}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12.5px',
                              background: '#fee2e2',
                              color: '#b91c1c',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontWeight: 700,
                              opacity: isUpdating ? 0.6 : 1,
                            }}
                          >
                            ✕ Cancel
                          </button>
                        </>
                      )}

                      {status === 'COMPLETED' && (
                        <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          ✓ Consultation Concluded
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SPACE 3: CLINICAL MODULES — STRICTLY ONLY MEDI-AI & OPD KIOSK             */}
      {/* ========================================================================= */}
      <div className="section-row" style={{ marginTop: '12px' }}>
        <div>
          <span className="eyebrow">DOCTOR CLINICAL MODULES</span>
          <h2>Clinical AI & Touch Kiosk Systems</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', margin: '4px 0 0' }}>
            Dedicated specialized tools designed strictly for attending physicians and medical staff.
          </p>
        </div>
      </div>

      <div
        className="quick-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
          marginTop: '16px',
        }}
      >
        {/* Module 1: Medi-AI Companion */}
        <Link
          to="/companion"
          className="quick-card"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)',
            border: '1.5px solid #d8b4fe',
            padding: '24px',
            borderRadius: '20px',
            display: 'flex',
            gap: '16px',
            alignItems: 'flex-start',
            textDecoration: 'none',
            boxShadow: '0 8px 24px -6px rgba(107, 33, 168, 0.08)',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: 'var(--plum)',
              color: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              fontSize: '24px',
              flexShrink: 0,
            }}
          >
            ✦
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <strong style={{ fontSize: '18px', color: 'var(--plum)', fontFamily: 'Manrope' }}>
                Medi-AI Multilingual Companion
              </strong>
              <span style={{ fontSize: '10px', background: '#ede9fe', color: '#6b21a8', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>
                CLINICAL AI
              </span>
            </div>
            <p style={{ margin: 0, color: '#475569', fontSize: '13.5px', lineHeight: 1.5 }}>
              Voice intake with real-time speech-to-text, ICD-10 & NAMASTE automated coding, SOCRATES symptom exploration, and disease differential triage.
            </p>
            <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--plum)', fontWeight: 800, fontSize: '13px' }}>
              Launch Clinical AI Suite ↗
            </div>
          </div>
        </Link>

        {/* Module 2: OPD Touch Kiosk */}
        <Link
          to="/kiosk"
          className="quick-card"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
            border: '1.5px solid #7dd3fc',
            padding: '24px',
            borderRadius: '20px',
            display: 'flex',
            gap: '16px',
            alignItems: 'flex-start',
            textDecoration: 'none',
            boxShadow: '0 8px 24px -6px rgba(2, 132, 199, 0.08)',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: '#0284c7',
              color: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              fontSize: '24px',
              flexShrink: 0,
            }}
          >
            🏥
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <strong style={{ fontSize: '18px', color: '#0369a1', fontFamily: 'Manrope' }}>
                OPD Touch Kiosk
              </strong>
              <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>
                SELF-TRIAGE
              </span>
            </div>
            <p style={{ margin: 0, color: '#475569', fontSize: '13.5px', lineHeight: 1.5 }}>
              Interactive anatomical body-map symptom selector, multi-dialect audio guidance, and automated queue token intake for hospital waiting rooms.
            </p>
            <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0284c7', fontWeight: 800, fontSize: '13px' }}>
              Open OPD Kiosk Mode ↗
            </div>
          </div>
        </Link>
      </div>

      {/* ========================================================================= */}
      {/* UNLOCKED PATIENT MEDICAL VAULT MODAL                                     */}
      {/* ========================================================================= */}
      {patientModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <span className="eyebrow" style={{ color: '#15803d', margin: 0 }}>
                  🔓 DECRYPTED MEDICAL STORY • TIME-BOUND SESSION
                </span>
                <h2 style={{ fontSize: '22px', margin: '4px 0 0', fontFamily: 'Manrope' }}>
                  {selectedPatientData?.profile?.fullName || selectedPatientData?.user?.name || 'Patient Health Vault'}
                </h2>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                  Unit ID: <strong>{selectedPatientData?.user?.medilockerId || 'ML-SECURE'}</strong> • Blood Group: <strong>{selectedPatientData?.profile?.bloodGroup || 'O+'}</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPatientModalOpen(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  fontSize: '18px',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {loadingPatientData ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
                Decrypting and retrieving patient sovereign health vault...
              </div>
            ) : selectedPatientData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Emergency Vitals & Allergies Banner */}
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '16px', padding: '16px' }}>
                  <strong style={{ color: '#991b1b', fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                    🚨 Critical Clinical Notes & Allergies
                  </strong>
                  <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c' }}>
                    Allergies: {selectedPatientData?.profile?.allergies || 'No known drug allergies'}. Chronic Conditions: {selectedPatientData?.profile?.chronicConditions || 'None reported'}.
                  </p>
                </div>

                {/* Timeline & Records Summary */}
                <div>
                  <h3 style={{ fontSize: '16px', margin: '0 0 10px', color: '#0f172a' }}>
                    Recent Medical Records ({selectedPatientData?.records?.length || 0})
                  </h3>
                  {(!selectedPatientData?.records || selectedPatientData.records.length === 0) ? (
                    <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', fontSize: '13px', color: 'var(--muted)' }}>
                      No verified medical records uploaded to this locker yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedPatientData.records.slice(0, 5).map((rec) => (
                        <div key={rec.id} style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong style={{ fontSize: '13.5px', color: '#1e293b' }}>{rec.title || rec.fileName || 'Medical Record'}</strong>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                              Type: {rec.recordType || 'PRESCRIPTION'} • {new Date(rec.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          {rec.ocrText && (
                            <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                              OCR Parsed
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Daily Adherence & Medication */}
                <div>
                  <h3 style={{ fontSize: '16px', margin: '0 0 10px', color: '#0f172a' }}>
                    Active Prescriptions & Dosages
                  </h3>
                  {(!selectedPatientData?.todos || selectedPatientData.todos.length === 0) ? (
                    <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', fontSize: '13px', color: 'var(--muted)' }}>
                      No active daily medication tasks logged.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                      {selectedPatientData.todos.map((todo) => (
                        <div key={todo.id} style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                          <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>{todo.title}</strong>
                          <span style={{ fontSize: '11px', color: todo.isCompleted ? '#16a34a' : '#ea580c', fontWeight: 700 }}>
                            {todo.isCompleted ? '✓ Completed' : '⏳ Pending Dose'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setPatientModalOpen(false)}
                className="primary-btn"
                style={{ background: 'var(--plum)', padding: '10px 24px' }}
              >
                Close Patient Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
