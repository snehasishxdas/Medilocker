import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { generateEmergencyPayload, generateQrSvg } from '../utils/qr';

export function Profile() {
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Profile Form State initialized with user data (or localStorage cache)
  const [formData, setFormData] = useState(() => {
    let cached = null;
    try {
      const raw = localStorage.getItem('medilockerUserProfileCache');
      if (raw) cached = JSON.parse(raw);
    } catch (e) {}

    const src = user || cached || {};
    const prof = src.patientProfile || {};

    return {
      fullName: prof.fullName || src.name || '',
      phone: src.phone || prof.emergencyContactPhone || '',
      dob: prof.dob ? prof.dob.split('T')[0] : '',
      gender: prof.gender || 'Not specified',
      bloodGroup: prof.bloodGroup || src.bloodGroup || 'Not specified',
      address: prof.addressLine || src.address || '',
      city: prof.city || src.city || '',
      state: prof.state || src.state || '',
      pincode: prof.pincode || src.pincode || '',
      allergies: Array.isArray(src.allergies) && src.allergies.length > 0
        ? src.allergies.join(', ')
        : (prof.baselineAllergies || ''),
      medications: Array.isArray(src.baselineMedications) && src.baselineMedications.length > 0
        ? src.baselineMedications.join(', ')
        : (prof.baselineMedications || ''),
      history: Array.isArray(src.chronicConditions) && src.chronicConditions.length > 0
        ? src.chronicConditions.join(', ')
        : (prof.medicalHistory || ''),
      emergencyName: prof.emergencyContactName || src.emergencyContact?.name || '',
      emergencyPhone: prof.emergencyContactPhone || src.emergencyContact?.phone || '',
      insurance: prof.insuranceProvider || src.insurance || '',
    };
  });

  // Sync state when fresh user profile loads from API
  useEffect(() => {
    if (user) {
      const prof = user.patientProfile || {};
      setFormData((prev) => ({
        fullName: prof.fullName || user.name || prev.fullName || '',
        phone: user.phone || prev.phone || '',
        dob: prof.dob ? prof.dob.split('T')[0] : prev.dob || '',
        gender: prof.gender || prev.gender || 'Not specified',
        bloodGroup: prof.bloodGroup || user.bloodGroup || prev.bloodGroup || 'Not specified',
        address: prof.addressLine || user.address || prev.address || '',
        city: prof.city || user.city || prev.city || '',
        state: prof.state || user.state || prev.state || '',
        pincode: prof.pincode || user.pincode || prev.pincode || '',
        allergies: Array.isArray(user.allergies) && user.allergies.length > 0
          ? user.allergies.join(', ')
          : (prof.baselineAllergies || prev.allergies || ''),
        medications: Array.isArray(user.baselineMedications) && user.baselineMedications.length > 0
          ? user.baselineMedications.join(', ')
          : (prof.baselineMedications || prev.medications || ''),
        history: Array.isArray(user.chronicConditions) && user.chronicConditions.length > 0
          ? user.chronicConditions.join(', ')
          : (prof.medicalHistory || prev.history || ''),
        emergencyName: prof.emergencyContactName || user.emergencyContact?.name || prev.emergencyName || '',
        emergencyPhone: prof.emergencyContactPhone || user.emergencyContact?.phone || prev.emergencyPhone || '',
        insurance: prof.insuranceProvider || user.insurance || prev.insurance || '',
      }));

      // Cache locally
      try {
        localStorage.setItem('medilockerUserProfileCache', JSON.stringify(user));
      } catch (e) {}
    }
  }, [user]);

  // Fetch latest profile on mount
  useEffect(() => {
    async function fetchFreshProfile() {
      try {
        const res = await api.getMe();
        if (res?.user) {
          try {
            localStorage.setItem('medilockerUserProfileCache', JSON.stringify(res.user));
          } catch (e) {}
        }
      } catch (err) {
        console.warn('Silent profile fetch error:', err?.message);
      }
    }
    fetchFreshProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError('');
    setSaveSuccess(false);

    try {
      const payload = {
        fullName: formData.fullName.trim(),
        name: formData.fullName.trim(),
        phone: formData.phone.trim(),
        dob: formData.dob || undefined,
        gender: formData.gender,
        bloodGroup: formData.bloodGroup,
        blood: formData.bloodGroup,
        address: formData.address.trim(),
        addressLine: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim(),
        allergies: formData.allergies.trim(),
        baselineAllergies: formData.allergies.trim(),
        medications: formData.medications.trim(),
        baselineMedications: formData.medications.trim(),
        history: formData.history.trim(),
        chronicConditions: formData.history ? formData.history.split(',').map((s) => s.trim()).filter(Boolean) : [],
        emergencyContactName: formData.emergencyName.trim(),
        emergencyContactPhone: formData.emergencyPhone.trim(),
        emergency: formData.emergencyName.trim(),
        emergencyPhone: formData.emergencyPhone.trim(),
        insuranceProvider: formData.insurance.trim(),
        insurance: formData.insurance.trim(),
      };

      await api.updateProfile(payload);
      await refreshUser();

      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setError(err.message || 'Failed to save profile. Please check your network.');
    } finally {
      setSaving(false);
    }
  };

  const displayName = formData.fullName || user?.patientProfile?.fullName || user?.name || user?.email?.split('@')[0] || 'Patient';
  const initials = (displayName.split(' ').map((n) => n[0]).join('') || 'P').slice(0, 2).toUpperCase();
  const unitId = user?.medilockerId || 'ML-VAULT-ACTIVE';

  // Build emergency payload with live form data so card/QR reflect changes immediately
  const dynamicUserForQr = {
    ...user,
    medilockerId: unitId,
    name: displayName,
    bloodGroup: formData.bloodGroup,
    allergies: formData.allergies ? formData.allergies.split(',').map((s) => s.trim()) : [],
    emergencyContact: {
      name: formData.emergencyName || 'Emergency Contact',
      phone: formData.emergencyPhone || formData.phone || user?.phone || '102',
    },
    patientProfile: {
      fullName: displayName,
      bloodGroup: formData.bloodGroup,
      gender: formData.gender,
      baselineAllergies: formData.allergies,
      emergencyContactName: formData.emergencyName,
      emergencyContactPhone: formData.emergencyPhone || formData.phone,
    },
  };

  let lastKioskTicket = null;
  try {
    const raw = localStorage.getItem('medilockerLastKioskTicket');
    if (raw) lastKioskTicket = JSON.parse(raw);
  } catch (_) {}

  const emergencyPayload = generateEmergencyPayload(dynamicUserForQr, lastKioskTicket);
  const qrSvgHtml = generateQrSvg(emergencyPayload);


  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">SOVEREIGN PATIENT IDENTITY</span>
          <h1>My Health Profile.</h1>
          <p>Your verified biometric, demographic, and clinical identity stored under sovereign database encryption.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            className={isEditing ? 'secondary-btn' : 'primary-btn'}
            onClick={() => {
              if (isEditing) {
                setIsEditing(false);
              } else {
                setIsEditing(true);
              }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '14px' }}
          >
            <span>{isEditing ? '✕ Cancel Editing' : '✎ Edit Profile'}</span>
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={() => setShowPrintModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '14px' }}
          >
            <span>🪪</span>
            <span>Arogya Card with QR ↗</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #10b981',
            color: '#047857',
            padding: '14px 20px',
            borderRadius: '16px',
            fontSize: '15px',
            fontWeight: 700,
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span>✓</span>
          <span>Profile updated and synchronized to live Supabase PostgreSQL database successfully!</span>
        </div>
      )}

      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #ef4444',
            color: '#b91c1c',
            padding: '14px 20px',
            borderRadius: '16px',
            fontSize: '14px',
            marginBottom: '24px',
          }}
        >
          {error}
        </div>
      )}

      {/* Arogya Emergency Health Card Preview */}
      <div
        className="profile-arogya-grid"
        style={{
          background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
          color: '#fff',
          borderRadius: '24px',
          padding: '28px',
          marginBottom: '32px',
          boxShadow: '0 20px 40px rgba(30, 27, 75, 0.25)',
        }}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '11px', letterSpacing: '1.6px', fontWeight: 800, color: '#a5b4fc', textTransform: 'uppercase' }}>
              NATIONAL HEALTH AUTHORITY ALIGNED · EMERGENCY AROGYA CARD
            </span>
            <span style={{ background: '#ef4444', color: '#fff', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 800 }}>
              100% OFFLINE SCAN
            </span>
          </div>

          <h2 style={{ fontFamily: 'Manrope', fontSize: '26px', margin: '0 0 4px', color: '#fff' }}>
            {displayName}
          </h2>
          <p style={{ margin: '0 0 16px', color: '#c7d2fe', fontSize: '14px' }}>
            Unit ID: <strong style={{ color: '#fff', letterSpacing: '1px' }}>{unitId}</strong>
          </p>

          <div className="profile-vitals-meta" style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '14px', borderRadius: '16px' }}>
            <div>
              <small style={{ color: '#c7d2fe', display: 'block', fontSize: '11px' }}>BLOOD GROUP</small>
              <strong style={{ fontSize: '18px', color: '#fca5a5' }}>{formData.bloodGroup || 'Not specified'}</strong>
            </div>
            <div>
              <small style={{ color: '#c7d2fe', display: 'block', fontSize: '11px' }}>GENDER</small>
              <strong style={{ fontSize: '14px' }}>{formData.gender || 'Not specified'}</strong>
            </div>
            <div>
              <small style={{ color: '#c7d2fe', display: 'block', fontSize: '11px' }}>SOS CONTACT</small>
              <strong style={{ fontSize: '13px' }}>
                {formData.emergencyPhone || formData.phone || user?.phone || '102 / 108'}
              </strong>
            </div>
          </div>

          {/* Critical Allergy Tag */}
          <div style={{ marginTop: '14px', background: '#fef2f2', color: '#991b1b', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️</span>
            <span>
              <strong>Documented Allergies:</strong>{' '}
              {formData.allergies ? formData.allergies : 'No acute drug contraindications recorded'}
            </span>
          </div>
        </div>

        {/* Offline QR Card Box */}
        <div
          style={{
            background: '#fff',
            borderRadius: '18px',
            padding: '18px',
            textAlign: 'center',
            color: '#0f172a',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div dangerouslySetInnerHTML={{ __html: qrSvgHtml }} style={{ display: 'grid', placeItems: 'center' }} />
          <strong style={{ fontSize: '13px', marginTop: '8px', display: 'block' }}>
            Offline Emergency QR Code
          </strong>
          <small style={{ color: '#64748b', fontSize: '11px', display: 'block', maxWidth: '200px', margin: '2px 0 10px' }}>
            Any paramedic can scan this without active internet connection.
          </small>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => window.print()}
            style={{ padding: '6px 16px', fontSize: '12px', borderRadius: '8px', width: '100%' }}
          >
            Print Wallet Card 🖨
          </button>
        </div>
      </div>

      {/* Main Profile Card */}
      <div className="profile-card">
        <div className="profile-hero">
          <div className="large-avatar">{initials}</div>
          <div>
            <h2>{displayName}</h2>
            <p>
              Unit ID: <strong style={{ color: 'var(--plum)' }}>{unitId}</strong> · Role: {user?.role || 'PATIENT'}
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
            {isEditing ? (
              <button
                type="button"
                className="primary-btn"
                onClick={handleSaveProfile}
                disabled={saving}
                style={{ padding: '10px 22px', fontSize: '14px', borderRadius: '12px' }}
              >
                {saving ? 'Saving...' : '💾 Save Changes'}
              </button>
            ) : (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setIsEditing(true)}
                style={{ padding: '8px 18px', fontSize: '13px', borderRadius: '12px' }}
              >
                ✎ Edit Details
              </button>
            )}
            <span className="status-pill">● Sovereign Vault Active</span>
          </div>
        </div>

        <form onSubmit={handleSaveProfile}>
          <div className="details-grid">
            <label>
              <span>Full Name</span>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                disabled={!isEditing}
                placeholder="e.g. Ramesh Verma"
                style={{ background: isEditing ? '#fff' : '#fbf9f6', borderColor: isEditing ? 'var(--plum)' : 'var(--line)' }}
              />
            </label>

            <label>
              <span>Primary Email Address</span>
              <input type="text" readOnly disabled value={user?.email || ''} style={{ background: '#f5f3f0', cursor: 'not-allowed' }} />
            </label>

            <label>
              <span>Contact Phone Number</span>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                disabled={!isEditing}
                placeholder="+91 9876543210"
                style={{ background: isEditing ? '#fff' : '#fbf9f6', borderColor: isEditing ? 'var(--plum)' : 'var(--line)' }}
              />
            </label>

            <label>
              <span>Blood Group</span>
              {isEditing ? (
                <select
                  name="bloodGroup"
                  value={formData.bloodGroup}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '13px 14px', borderRadius: '12px', border: '1px solid var(--plum)', background: '#fff' }}
                >
                  <option value="Not specified">Not specified</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              ) : (
                <input type="text" readOnly disabled value={formData.bloodGroup || 'Not recorded'} />
              )}
            </label>

            <label>
              <span>Gender</span>
              {isEditing ? (
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '13px 14px', borderRadius: '12px', border: '1px solid var(--plum)', background: '#fff' }}
                >
                  <option value="Not specified">Not specified</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              ) : (
                <input type="text" readOnly disabled value={formData.gender || 'Not specified'} />
              )}
            </label>

            <label>
              <span>Date of Birth</span>
              <input
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
                disabled={!isEditing}
                style={{ background: isEditing ? '#fff' : '#fbf9f6', borderColor: isEditing ? 'var(--plum)' : 'var(--line)' }}
              />
            </label>

            <label>
              <span>Emergency Contact Name</span>
              <input
                type="text"
                name="emergencyName"
                value={formData.emergencyName}
                onChange={handleChange}
                disabled={!isEditing}
                placeholder="e.g. Priya Verma (Spouse)"
                style={{ background: isEditing ? '#fff' : '#fbf9f6', borderColor: isEditing ? 'var(--plum)' : 'var(--line)' }}
              />
            </label>

            <label>
              <span>Emergency Contact Phone</span>
              <input
                type="tel"
                name="emergencyPhone"
                value={formData.emergencyPhone}
                onChange={handleChange}
                disabled={!isEditing}
                placeholder="+91 9876543210"
                style={{ background: isEditing ? '#fff' : '#fbf9f6', borderColor: isEditing ? 'var(--plum)' : 'var(--line)' }}
              />
            </label>

            <label>
              <span>Address</span>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                disabled={!isEditing}
                placeholder="Street address or locality"
                style={{ background: isEditing ? '#fff' : '#fbf9f6', borderColor: isEditing ? 'var(--plum)' : 'var(--line)' }}
              />
            </label>

            <label>
              <span>City / State</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="City"
                  style={{ background: isEditing ? '#fff' : '#fbf9f6', borderColor: isEditing ? 'var(--plum)' : 'var(--line)' }}
                />
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="State"
                  style={{ background: isEditing ? '#fff' : '#fbf9f6', borderColor: isEditing ? 'var(--plum)' : 'var(--line)' }}
                />
              </div>
            </label>

            <label>
              <span>PIN Code</span>
              <input
                type="text"
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                disabled={!isEditing}
                placeholder="e.g. 110001"
                style={{ background: isEditing ? '#fff' : '#fbf9f6', borderColor: isEditing ? 'var(--plum)' : 'var(--line)' }}
              />
            </label>

            <label>
              <span>Medical Insurance Provider</span>
              <input
                type="text"
                name="insurance"
                value={formData.insurance}
                onChange={handleChange}
                disabled={!isEditing}
                placeholder="e.g. Star Health / PM-JAY Ayushman"
                style={{ background: isEditing ? '#fff' : '#fbf9f6', borderColor: isEditing ? 'var(--plum)' : 'var(--line)' }}
              />
            </label>

            <label style={{ gridColumn: '1 / -1' }}>
              <span>Documented Baseline Drug / Food Allergies</span>
              <textarea
                name="allergies"
                value={formData.allergies}
                onChange={handleChange}
                disabled={!isEditing}
                rows="2"
                placeholder="e.g. Penicillin, Sulfa drugs, Peanuts (separate with commas)"
                style={{
                  width: '100%',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  background: isEditing ? '#fff' : '#fbf9f6',
                  borderColor: isEditing ? 'var(--plum)' : 'var(--line)',
                  font: 'inherit',
                  resize: 'vertical',
                }}
              />
            </label>

            <label style={{ gridColumn: '1 / -1' }}>
              <span>Current Regular Medications</span>
              <textarea
                name="medications"
                value={formData.medications}
                onChange={handleChange}
                disabled={!isEditing}
                rows="2"
                placeholder="e.g. Metformin 500mg (1-0-0), Telmisartan 40mg (1-0-0)"
                style={{
                  width: '100%',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  background: isEditing ? '#fff' : '#fbf9f6',
                  borderColor: isEditing ? 'var(--plum)' : 'var(--line)',
                  font: 'inherit',
                  resize: 'vertical',
                }}
              />
            </label>

            <label style={{ gridColumn: '1 / -1' }}>
              <span>Known Chronic Medical Conditions</span>
              <textarea
                name="history"
                value={formData.history}
                onChange={handleChange}
                disabled={!isEditing}
                rows="2"
                placeholder="e.g. Type 2 Diabetes, Hypertension, Asthma"
                style={{
                  width: '100%',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  background: isEditing ? '#fff' : '#fbf9f6',
                  borderColor: isEditing ? 'var(--plum)' : 'var(--line)',
                  font: 'inherit',
                  resize: 'vertical',
                }}
              />
            </label>
          </div>

          {isEditing && (
            <div style={{ marginTop: '24px', display: 'flex', gap: '14px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setIsEditing(false)}
                style={{ padding: '12px 24px', borderRadius: '12px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-btn"
                disabled={saving}
                style={{ padding: '12px 28px', borderRadius: '12px', fontSize: '15px' }}
              >
                {saving ? 'Saving...' : '💾 Save Profile to Sovereign Vault ↗'}
              </button>
            </div>
          )}
        </form>

        <div className="emergency-box" style={{ marginTop: '30px' }}>
          <span>🛡</span>
          <div>
            <strong>ABDM & National Digital Health Mission Compliant</strong>
            <p>
              Your MediLocker ID is cryptographically anchored to your identity. Records and clinical profiles stored here can be securely shared with any ABDM-accredited facility or hospital.
            </p>
          </div>
        </div>
      </div>

      {/* Printable Wallet Card Modal */}
      {showPrintModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '24px',
              padding: '30px',
              maxWidth: '500px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: qrSvgHtml }} style={{ display: 'grid', placeItems: 'center', marginBottom: '14px' }} />
            <h3 style={{ fontFamily: 'Manrope', margin: '0 0 4px', fontSize: '20px' }}>{displayName}</h3>
            <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: '13px' }}>
              Unit ID: {unitId} · Blood: <strong style={{ color: '#dc2626' }}>{formData.bloodGroup || 'Not specified'}</strong>
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="primary-btn"
                onClick={() => window.print()}
                style={{ flex: 1, padding: '12px' }}
              >
                Print Arogya Pocket Card 🖨
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShowPrintModal(false)}
                style={{ flex: 1, padding: '12px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
