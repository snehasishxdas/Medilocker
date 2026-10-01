import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';

export function Signup() {
  const [role, setRole] = useState('patient');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    dob: '',
    gender: 'Prefer not to say',
    bloodGroup: 'Not specified',
    allergies: '',
    medications: '',
    emergencyContact: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    // Doctor specific
    doctorDegree: '',
    registrationNumber: '',
    specialization: 'General Medicine',
    clinicName: '',
    clinicAddress: '',
    // Hospital specific
    hospitalName: '',
    hospitalRegistrationNumber: '',
    hospitalType: 'General Hospital',
    hospitalOwnership: 'PRIVATE',
    beds: '50',
    representative: '',
  });

  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);
  const [copied, setCopied] = useState(false);

  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCopyUnitId = () => {
    if (createdUser?.medilockerId) {
      navigator.clipboard.writeText(createdUser.medilockerId);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!consent) {
      setError('Please agree to the sovereign health data storage terms.');
      return;
    }

    const nameToUse = role === 'hospital' ? (formData.hospitalName || formData.fullName) : formData.fullName;

    if (!nameToUse || !formData.email || !formData.phone || !formData.password) {
      setError('Name, Email, Phone, and Password are required.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        role: role.toUpperCase(),
        name: nameToUse.trim(),
        fullName: nameToUse.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim(),
        dob: formData.dob || undefined,
        gender: formData.gender,
        blood: formData.bloodGroup,
        bloodGroup: formData.bloodGroup,
        allergy: formData.allergies || undefined,
        allergies: formData.allergies || undefined,
        baselineAllergies: formData.allergies ? [formData.allergies] : [],
        medications: formData.medications || undefined,
        baselineMedications: formData.medications ? [formData.medications] : [],
        history: formData.medications || undefined,
        chronicConditions: formData.medications ? [formData.medications] : [],
        emergency: formData.emergencyContact || undefined,
        emergencyContact: formData.emergencyContact || undefined,
        emergencyContacts: formData.emergencyContact ? [{ name: 'Emergency', phone: formData.emergencyContact }] : [],
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        pincode: formData.pincode || undefined,
        // Doctor
        doctorId: `DOC-${Date.now().toString().slice(-6)}`,
        doctorDegree: formData.doctorDegree || 'MBBS',
        degree: formData.doctorDegree || 'MBBS',
        registrationNumber: formData.registrationNumber || `REG-${Date.now().toString().slice(-6)}`,
        specialization: formData.specialization || 'General Medicine',
        clinicName: formData.clinicName || 'Clinical Workspace',
        clinicAddress: formData.clinicAddress || formData.address || 'Medical Facility',
        // Hospital
        hospitalName: formData.hospitalName || nameToUse.trim(),
        hospitalId: `HOS-${Date.now().toString().slice(-6)}`,
        license: formData.hospitalRegistrationNumber || `LIC-${Date.now().toString().slice(-6)}`,
        hospitalRegistrationNumber: formData.hospitalRegistrationNumber || `LIC-${Date.now().toString().slice(-6)}`,
        hospitalType: formData.hospitalType,
        hospitalOwnership: formData.hospitalOwnership,
        beds: Number(formData.beds) || 50,
        representative: formData.representative || undefined,
      };

      const res = await signup(payload);
      if (res?.user) {
        setCreatedUser({
          ...res.user,
          email: formData.email.trim(),
          registeredRole: role,
        });
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar isApp={false} />

      <main className="login-shell signup-shell">
        <section className="login-intro">
          <span className="eyebrow">REGISTRATION</span>
          <h1>Create your MediLocker.</h1>
          <p>Choose your account type. MediLocker connects patients, attending physicians, and hospital networks in real-time.</p>
        </section>

        <section className="login-card signup-card">
          <div className="role-heading">
            <span className="eyebrow">ACCOUNT TYPE</span>
            <h2>Who are you registering as?</h2>
          </div>

          <div className="signup-role-grid" id="signupRoleGrid">
            <label className={`signup-role ${role === 'patient' ? 'selected' : ''}`} onClick={() => setRole('patient')}>
              <input type="radio" name="role" value="patient" checked={role === 'patient'} readOnly />
              <span className="signup-role-icon">♡</span>
              <span>
                <strong>Patient</strong>
                <small>Personal health records</small>
              </span>
            </label>

            <label className={`signup-role ${role === 'doctor' ? 'selected' : ''}`} onClick={() => setRole('doctor')}>
              <input type="radio" name="role" value="doctor" checked={role === 'doctor'} readOnly />
              <span className="signup-role-icon">✚</span>
              <span>
                <strong>Doctor</strong>
                <small>Professional medical access</small>
              </span>
            </label>

            <label className={`signup-role ${role === 'hospital' ? 'selected' : ''}`} onClick={() => setRole('hospital')}>
              <input type="radio" name="role" value="hospital" checked={role === 'hospital'} readOnly />
              <span className="signup-role-icon">▦</span>
              <span>
                <strong>Hospital</strong>
                <small>Institutional care access</small>
              </span>
            </label>
          </div>

          {error && (
            <div
              style={{
                background: '#fee2e2',
                border: '1px solid #ef4444',
                color: '#b91c1c',
                padding: '12px 16px',
                borderRadius: '12px',
                fontSize: '14px',
                marginBottom: '18px',
              }}
            >
              {error}
            </div>
          )}

          <form id="signupForm" onSubmit={handleSubmit}>
            <div className="signup-section">
              <div className="section-kicker">IDENTITY DETAILS</div>
              <h3>{role === 'hospital' ? 'Hospital Core Details' : 'Primary Credentials'}</h3>
              <div className="form-grid">
                {role === 'hospital' ? (
                  <label>
                    <span>Hospital / Clinic Name *</span>
                    <input
                      name="hospitalName"
                      required
                      value={formData.hospitalName}
                      onChange={handleChange}
                      placeholder="e.g. Apollo Multi-Specialty Hospital"
                    />
                  </label>
                ) : (
                  <label>
                    <span>{role === 'doctor' ? "Doctor's Full Name *" : 'Full Name *'}</span>
                    <input
                      name="fullName"
                      required
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder={role === 'doctor' ? 'e.g. Dr. Priya Sharma' : 'e.g. Ramesh Verma'}
                    />
                  </label>
                )}

                <label>
                  <span>{role === 'hospital' ? 'Official Hospital Email *' : role === 'doctor' ? 'Professional Email *' : 'Email Address *'}</span>
                  <input
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@domain.com"
                  />
                </label>

                <label>
                  <span>Password *</span>
                  <input
                    name="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Create a secure password"
                    autoComplete="new-password"
                  />
                </label>

                <label>
                  <span>{role === 'hospital' ? 'Hospital Contact Phone *' : 'Phone Number *'}</span>
                  <input
                    name="phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+91 9876543210"
                  />
                </label>

                {role === 'patient' && (
                  <>
                    <label>
                      <span>Date of Birth</span>
                      <input name="dob" type="date" value={formData.dob} onChange={handleChange} />
                    </label>
                    <label>
                      <span>Gender</span>
                      <select name="gender" value={formData.gender} onChange={handleChange}>
                        <option>Prefer not to say</option>
                        <option>Female</option>
                        <option>Male</option>
                        <option>Other</option>
                      </select>
                    </label>
                    <label>
                      <span>Blood Group</span>
                      <select name="bloodGroup" value={formData.bloodGroup} onChange={handleChange}>
                        <option>Not specified</option>
                        <option>A+</option>
                        <option>A-</option>
                        <option>B+</option>
                        <option>B-</option>
                        <option>AB+</option>
                        <option>AB-</option>
                        <option>O+</option>
                        <option>O-</option>
                      </select>
                    </label>
                  </>
                )}
              </div>
            </div>

            {role === 'patient' && (
              <div className="signup-section">
                <div className="section-kicker">PATIENT · CLINICAL PROFILE</div>
                <h3>Baseline Medical History</h3>
                <div className="form-grid">
                  <label className="wide">
                    <span>Known Allergies (Optional)</span>
                    <textarea
                      name="allergies"
                      value={formData.allergies}
                      onChange={handleChange}
                      placeholder="e.g. Penicillin, Sulfa drugs, Peanuts"
                      rows="2"
                    />
                  </label>
                  <label className="wide">
                    <span>Current Regular Medications (Optional)</span>
                    <textarea
                      name="medications"
                      value={formData.medications}
                      onChange={handleChange}
                      placeholder="e.g. Metformin 500mg (1-0-0), Telmisartan 40mg"
                      rows="2"
                    />
                  </label>
                  <label>
                    <span>Emergency Contact Phone</span>
                    <input
                      name="emergencyContact"
                      value={formData.emergencyContact}
                      onChange={handleChange}
                      placeholder="+91 9876543210"
                    />
                  </label>
                  <label>
                    <span>City</span>
                    <input name="city" value={formData.city} onChange={handleChange} placeholder="e.g. New Delhi" />
                  </label>
                </div>
              </div>
            )}

            {role === 'doctor' && (
              <div className="signup-section">
                <div className="section-kicker">DOCTOR · CREDENTIALS</div>
                <h3>Professional Verification</h3>
                <div className="form-grid">
                  <label>
                    <span>Medical Degree *</span>
                    <input
                      name="doctorDegree"
                      required
                      value={formData.doctorDegree}
                      onChange={handleChange}
                      placeholder="e.g. MBBS, MD, MS, BAMS"
                    />
                  </label>
                  <label>
                    <span>Medical Council Registration No. *</span>
                    <input
                      name="registrationNumber"
                      required
                      value={formData.registrationNumber}
                      onChange={handleChange}
                      placeholder="e.g. MCI-2024-8891"
                    />
                  </label>
                  <label>
                    <span>Specialization *</span>
                    <input
                      name="specialization"
                      required
                      value={formData.specialization}
                      onChange={handleChange}
                      placeholder="e.g. Cardiology / General Medicine"
                    />
                  </label>
                  <label>
                    <span>Clinic / Hospital Name</span>
                    <input
                      name="clinicName"
                      value={formData.clinicName}
                      onChange={handleChange}
                      placeholder="e.g. Max Care Clinic"
                    />
                  </label>
                  <label className="wide">
                    <span>Clinic Address</span>
                    <input
                      name="clinicAddress"
                      value={formData.clinicAddress}
                      onChange={handleChange}
                      placeholder="e.g. Suite 402, Medical Enclave, New Delhi"
                    />
                  </label>
                </div>
              </div>
            )}

            {role === 'hospital' && (
              <div className="signup-section">
                <div className="section-kicker">HOSPITAL · INSTITUTIONAL INFO</div>
                <h3>Operating License & Infrastructure</h3>
                <div className="form-grid">
                  <label>
                    <span>Registration / License No. *</span>
                    <input
                      name="hospitalRegistrationNumber"
                      required
                      value={formData.hospitalRegistrationNumber}
                      onChange={handleChange}
                      placeholder="e.g. HOSP-REG-2024-9901"
                    />
                  </label>
                  <label>
                    <span>Hospital Ownership *</span>
                    <select
                      name="hospitalOwnership"
                      value={formData.hospitalOwnership}
                      onChange={handleChange}
                    >
                      <option value="PRIVATE">Private Hospital / Trust</option>
                      <option value="PUBLIC">Government / Public Hospital</option>
                    </select>
                  </label>
                  <label>
                    <span>Hospital Type</span>
                    <select
                      name="hospitalType"
                      value={formData.hospitalType}
                      onChange={handleChange}
                    >
                      <option>General Hospital</option>
                      <option>Super Specialty Hospital</option>
                      <option>Clinic / Nursing Home</option>
                      <option>Community Health Center</option>
                    </select>
                  </label>
                  <label>
                    <span>Bed Capacity</span>
                    <input
                      name="beds"
                      type="number"
                      min="1"
                      value={formData.beds}
                      onChange={handleChange}
                      placeholder="e.g. 100"
                    />
                  </label>
                  <label className="wide">
                    <span>Hospital Address</span>
                    <input
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="e.g. Sector 12, Main Road, New Delhi"
                    />
                  </label>
                </div>
              </div>
            )}

            <div style={{ margin: '20px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  style={{ width: 'auto', margin: 0 }}
                />
                <span>I confirm the information is accurate and agree to MediLocker Terms of Service.</span>
              </label>
            </div>

            <button className="primary-btn" type="submit" disabled={loading} style={{ width: '100%', padding: '16px' }}>
              {loading ? 'Creating Sovereign Account...' : 'Complete Registration & Generate Unit ID ↗'}
            </button>

            <p className="signup-prompt">
              <span>Already registered?</span> <Link to={`/login?role=${role}`}>Sign in with Email + Password or Unit ID →</Link>
            </p>
          </form>
        </section>
      </main>

      {/* Success Modal Popup with Unit ID & Login Instructions */}
      {createdUser && (
        <div className="modal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 9999 }}>
          <div className="modal-card" style={{ maxWidth: '520px', width: '90%', textAlign: 'center', padding: '36px 28px', background: '#fff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(43,24,54,0.25)' }}>
            <div className="success-icon" style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', margin: '0 auto 16px', fontWeight: 900 }}>
              ✓
            </div>
            
            <div style={{ display: 'inline-block', background: '#f3e8ff', color: '#7e22ce', padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
              {createdUser.registeredRole?.toUpperCase() || role.toUpperCase()} ACCOUNT CREATED
            </div>

            <h2 style={{ fontFamily: 'Manrope', fontSize: '24px', fontWeight: 800, margin: '0 0 10px', color: '#2b1836' }}>
              Registration Successful!
            </h2>
            
            <p style={{ color: '#6b5a7d', fontSize: '14px', margin: '0 0 20px', lineHeight: 1.5 }}>
              Your unique sovereign identifier has been generated and registered in the health network:
            </p>

            {/* Generated Unit ID Display */}
            <div style={{ background: '#f8f4fb', border: '2px dashed #7e22ce', borderRadius: '16px', padding: '18px', margin: '0 0 16px' }}>
              <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#7e22ce', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
                Your Unique Unit ID
              </span>
              <div style={{ fontFamily: 'monospace', fontSize: '28px', fontWeight: 900, color: '#2b1836', letterSpacing: '2px', wordBreak: 'break-all' }}>
                {createdUser.medilockerId || 'ML-XXXX-XXXX'}
              </div>
              <button
                type="button"
                onClick={handleCopyUnitId}
                style={{
                  marginTop: '10px',
                  background: copied ? '#16a34a' : '#2b1836',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                {copied ? '✓ Unit ID Copied!' : '📋 Copy Unit ID'}
              </button>
            </div>

            {/* Clear Login Information Alert */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px', textAlign: 'left', margin: '0 0 24px' }}>
              <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#1e40af', fontWeight: 700 }}>
                🔑 How to Sign In:
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: '#1e3a8a', lineHeight: 1.5 }}>
                You can log in using your registered email (<strong>{createdUser.email || formData.email}</strong>) and <strong>EITHER</strong> your chosen Password <strong>OR</strong> this Unique Unit ID (<strong>{createdUser.medilockerId}</strong>).
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className="primary-btn"
                type="button"
                onClick={() => navigate('/dashboard')}
                style={{ width: '100%', padding: '14px', fontSize: '15px' }}
              >
                Enter Care Dashboard ↗
              </button>
              <button
                type="button"
                onClick={() => navigate(`/login?role=${role}`)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--line)',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#6b5a7d',
                  cursor: 'pointer',
                }}
              >
                Sign in with Credentials →
              </button>
            </div>
          </div>
        </div>
      )}

      <footer>
        <span>© 2026 MediLocker</span>
        <span>A digital home for organized healthcare.</span>
        <span>ABDM & HIPAA Compliant</span>
      </footer>
    </>
  );
}
