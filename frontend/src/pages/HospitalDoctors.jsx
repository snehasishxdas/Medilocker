import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const DEFAULT_DEPARTMENTS = [
  'General Medicine',
  'Emergency & Trauma',
  'Cardiology',
  'Neurology',
  'Pediatrics',
  'Orthopedics',
  'General Surgery',
  'Gynecology & Obstetrics',
  'ICU / Critical Care',
  'Pulmonology',
  'Dermatology',
  'Oncology',
  'Radiology',
  'Anesthesiology',
];

export function HospitalDoctors() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ hospital: null, stats: { total: 0, active: 0, departmentsCount: 0, departments: [] }, doctors: [] });
  const [searchFilter, setSearchFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');

  // Add Doctor Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [targetDepartment, setTargetDepartment] = useState('General Medicine');
  const [customDept, setCustomDept] = useState('');
  const [directId, setDirectId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Edit Department Modal State
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [editDeptValue, setEditDeptValue] = useState('');

  const fetchHospitalDoctors = async () => {
    try {
      setLoading(true);
      const res = await api.getHospitalDoctors();
      if (res?.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch hospital doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHospitalDoctors();
  }, []);

  // Live search debounced
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await api.searchDoctorsForHospital(searchQuery.trim());
        if (res?.data?.doctors) {
          setSearchResults(res.data.doctors);
        }
      } catch (err) {
        console.error('Doctor search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    const identifier = selectedDoctor ? selectedDoctor.doctorId : directId.trim();
    if (!identifier) {
      setFeedback({ type: 'error', message: 'Please select or enter a doctor identifier (Unit ID, Reg No, or Email).' });
      return;
    }

    const finalDept = targetDepartment === 'CUSTOM' ? customDept.trim() : targetDepartment;
    if (!finalDept) {
      setFeedback({ type: 'error', message: 'Please specify the clinical department.' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.addDoctorToHospital({
        doctorIdentifier: identifier,
        department: finalDept,
      });

      setFeedback({ type: 'success', message: res.data?.message || 'Doctor enrolled successfully!' });
      setTimeout(() => {
        setIsModalOpen(false);
        setSelectedDoctor(null);
        setDirectId('');
        setSearchQuery('');
        setSearchResults([]);
        setFeedback({ type: '', message: '' });
        fetchHospitalDoctors();
      }, 1200);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to affiliate doctor.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (doctor) => {
    try {
      const newStatus = !doctor.isActive;
      await api.toggleHospitalDoctor(doctor.doctorId, { isActive: newStatus });
      fetchHospitalDoctors();
    } catch (err) {
      alert('Failed to update doctor status: ' + err.message);
    }
  };

  const handleSaveDepartment = async (e) => {
    e.preventDefault();
    if (!editingDoctor || !editDeptValue.trim()) return;
    try {
      await api.toggleHospitalDoctor(editingDoctor.doctorId, { department: editDeptValue.trim() });
      setEditingDoctor(null);
      fetchHospitalDoctors();
    } catch (err) {
      alert('Failed to update department: ' + err.message);
    }
  };

  const handleRemoveDoctor = async (doctor) => {
    if (!window.confirm(`Are you sure you want to remove Dr. ${doctor.fullName} from ${data.hospital?.hospitalName || 'this hospital'}?`)) {
      return;
    }
    try {
      await api.removeDoctorFromHospital(doctor.doctorId);
      fetchHospitalDoctors();
    } catch (err) {
      alert('Failed to remove doctor: ' + err.message);
    }
  };

  // Filter doctors
  const filteredDoctors = (data.doctors || []).filter((doc) => {
    const matchesSearch =
      !searchFilter ||
      doc.fullName?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      doc.specialization?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      doc.department?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      doc.medilockerId?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      doc.registrationNumber?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      doc.email?.toLowerCase().includes(searchFilter.toLowerCase());

    const matchesDept = deptFilter === 'ALL' || doc.department === deptFilter;

    return matchesSearch && matchesDept;
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span className="eyebrow" style={{ color: '#0284c7' }}>HOSPITAL CLINICAL ROSTER & GOVERNANCE</span>
          <h1 style={{ margin: '4px 0 8px' }}>
            {data.hospital?.hospitalName || 'Hospital Organization'} — Medical Staff
          </h1>
          <p style={{ maxWidth: '700px', color: 'var(--muted)', margin: 0 }}>
            Manage registered medical practitioners, assign clinical departments, maintain on-duty status, and enable institutional access delegation across hospital wards.
          </p>
        </div>

        <button
          className="btn btn-primary"
          style={{
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            borderColor: '#0284c7',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.25)',
          }}
          onClick={() => {
            setIsModalOpen(true);
            setSelectedDoctor(null);
            setFeedback({ type: '', message: '' });
          }}
        >
          <span>✚</span> {t('addDoctorBtn', 'Add Doctor to Organization')}
        </button>
      </div>

      {/* KPI / Stats Overview Cards */}
      <div className="stats-row" style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="stat-card" style={{ borderTop: '4px solid #0284c7' }}>
          <span className="label">AFFILIATED DOCTORS</span>
          <strong style={{ color: '#0284c7', fontSize: '28px' }}>{data.stats?.total || 0}</strong>
          <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Registered with Hospital</span>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #16a34a' }}>
          <span className="label">ACTIVE & ON-DUTY</span>
          <strong style={{ color: '#16a34a', fontSize: '28px' }}>{data.stats?.active || 0}</strong>
          <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Ready for OPD / Inpatient</span>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #8b5cf6' }}>
          <span className="label">CLINICAL DEPARTMENTS</span>
          <strong style={{ color: '#8b5cf6', fontSize: '28px' }}>{data.stats?.departmentsCount || 0}</strong>
          <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Specialized Units Active</span>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #e11d48' }}>
          <span className="label">HOSPITAL CODE / UNIT ID</span>
          <strong style={{ color: '#e11d48', fontSize: '18px', wordBreak: 'break-all' }}>{data.hospital?.hospitalId || user?.medilockerId || 'HOSP-ACTIVE'}</strong>
          <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>{data.hospital?.city || 'Institutional Node'}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          marginTop: '24px',
          padding: '16px 20px',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--white)',
        }}
      >
        <div style={{ flex: '1 1 300px', position: 'relative' }}>
          <input
            type="text"
            className="input"
            placeholder="🔍 Filter by Doctor Name, Reg No, Unit ID, Specialization..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{ width: '100%', paddingLeft: '14px', background: 'var(--cream)', borderColor: 'rgba(0,0,0,0.08)' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted)' }}>Department:</label>
          <select
            className="input"
            style={{ minWidth: '180px', background: 'var(--cream)', fontWeight: 600 }}
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="ALL">All Departments ({data.doctors?.length || 0})</option>
            {(data.stats?.departments || []).map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Doctor Roster */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
          <h3>Loading Hospital Staff & Doctors...</h3>
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div
          className="card"
          style={{
            marginTop: '20px',
            textAlign: 'center',
            padding: '60px 20px',
            border: '2px dashed rgba(2, 132, 199, 0.25)',
            background: 'rgba(2, 132, 199, 0.02)',
          }}
        >
          <div style={{ fontSize: '44px', marginBottom: '12px' }}>👨‍⚕️</div>
          <h2 style={{ color: '#0369a1', margin: '0 0 8px' }}>No Doctors Found</h2>
          <p style={{ maxWidth: '520px', margin: '0 auto 20px', color: 'var(--muted)', fontSize: '14px' }}>
            {searchFilter || deptFilter !== 'ALL'
              ? 'No medical officers match your search filters. Try clearing the search or department filter.'
              : 'Your hospital organization has not affiliated any doctors yet. Click below to add your registered attending physicians and clinical specialists.'}
          </p>
          <button
            className="btn btn-primary"
            style={{ background: '#0284c7', borderColor: '#0284c7' }}
            onClick={() => {
              setIsModalOpen(true);
              setSelectedDoctor(null);
            }}
          >
            ✚ Add Doctor to Hospital
          </button>
        </div>
      ) : (
        <div
          style={{
            marginTop: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
            gap: '18px',
          }}
        >
          {filteredDoctors.map((doc) => {
            const initials = (doc.fullName?.split(' ').map((n) => n[0]).join('') || 'DR').slice(0, 2).toUpperCase();
            return (
              <div
                key={doc.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '20px',
                  borderRadius: '16px',
                  border: doc.isActive ? '1px solid rgba(2, 132, 199, 0.18)' : '1px solid rgba(0,0,0,0.08)',
                  background: 'var(--white)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Active status strip */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: doc.isActive ? 'linear-gradient(90deg, #16a34a, #22c55e)' : '#9ca3af',
                  }}
                />

                <div>
                  {/* Top Doctor Avatar & Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '16px',
                          display: 'grid',
                          placeItems: 'center',
                          boxShadow: '0 3px 8px rgba(2, 132, 199, 0.2)',
                        }}
                      >
                        {initials}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--plum)' }}>
                          Dr. {doc.fullName}
                        </h3>
                        <div style={{ fontSize: '12px', color: '#0284c7', fontWeight: 700, marginTop: '2px' }}>
                          {doc.specialization || 'Clinical Specialist'}
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '3px 9px',
                        borderRadius: '20px',
                        background: doc.isActive ? 'rgba(22, 163, 74, 0.1)' : 'rgba(156, 163, 175, 0.15)',
                        color: doc.isActive ? '#16a34a' : '#6b7280',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {doc.isActive ? '● Active' : '○ Inactive'}
                    </span>
                  </div>

                  {/* Identification tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(2, 132, 199, 0.08)',
                        color: '#0369a1',
                      }}
                    >
                      ID: {doc.medilockerId}
                    </span>
                    {doc.registrationNumber && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(0,0,0,0.05)',
                          color: 'var(--muted)',
                        }}
                      >
                        Reg: {doc.registrationNumber}
                      </span>
                    )}
                    {doc.yearsExperience ? (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(180, 83, 9, 0.08)',
                          color: '#b45309',
                        }}
                      >
                        {doc.yearsExperience} yrs exp
                      </span>
                    ) : null}
                  </div>

                  {/* Department Badge */}
                  <div
                    style={{
                      background: 'var(--cream)',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      marginBottom: '14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--muted)', letterSpacing: '0.05em' }}>
                        Department
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--plum)' }}>
                        🏥 {doc.department || 'General Medicine'}
                      </div>
                    </div>
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#0284c7',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                      onClick={() => {
                        setEditingDoctor(doc);
                        setEditDeptValue(doc.department || 'General Medicine');
                      }}
                    >
                      Change
                    </button>
                  </div>

                  {/* Contact Info */}
                  <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
                    {doc.email && <div>✉ {doc.email}</div>}
                    {doc.phone && <div>📞 {doc.phone}</div>}
                    {doc.clinicName && <div>🏢 Clinic: {doc.clinicName}</div>}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div
                  style={{
                    paddingTop: '12px',
                    borderTop: '1px solid rgba(0,0,0,0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <button
                    className="btn btn-outline"
                    style={{
                      fontSize: '12px',
                      padding: '6px 12px',
                      color: doc.isActive ? '#6b7280' : '#16a34a',
                      borderColor: doc.isActive ? 'rgba(0,0,0,0.15)' : '#16a34a',
                    }}
                    onClick={() => handleToggleStatus(doc)}
                  >
                    {doc.isActive ? 'Set Inactive' : 'Set Active'}
                  </button>

                  <button
                    className="btn btn-outline"
                    style={{
                      fontSize: '12px',
                      padding: '6px 12px',
                      color: '#e11d48',
                      borderColor: 'rgba(225, 29, 72, 0.2)',
                    }}
                    onClick={() => handleRemoveDoctor(doc)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD DOCTOR MODAL */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '640px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--white)',
              borderRadius: '20px',
              padding: '28px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span className="eyebrow" style={{ color: '#0284c7' }}>STAFF ONBOARDING</span>
                <h2 style={{ margin: '4px 0 0' }}>Affiliate Doctor to Hospital</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
              Search registered doctors across MediLocker or enter their sovereign Unit ID / Medical Registration Number directly.
            </p>

            {feedback.message && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  marginBottom: '16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  background: feedback.type === 'error' ? 'rgba(225, 29, 72, 0.1)' : 'rgba(22, 163, 74, 0.1)',
                  color: feedback.type === 'error' ? '#e11d48' : '#16a34a',
                }}
              >
                {feedback.type === 'error' ? '⚠️ ' : '✓ '}
                {feedback.message}
              </div>
            )}

            <form onSubmit={handleAddDoctor}>
              {/* Search Live Doctors */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
                  Search Registered Doctors
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Type doctor's name, specialization, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', background: 'var(--cream)' }}
                />
                {isSearching && <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '4px' }}>Searching doctor registry...</div>}

                {/* Search Results dropdown/cards */}
                {searchResults.length > 0 && (
                  <div
                    style={{
                      marginTop: '8px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: '12px',
                      background: 'var(--cream)',
                    }}
                  >
                    {searchResults.map((doc) => {
                      const isSelected = selectedDoctor?.doctorId === doc.doctorId;
                      return (
                        <div
                          key={doc.doctorId}
                          onClick={() => {
                            if (doc.isAffiliated) return;
                            setSelectedDoctor(doc);
                            setDirectId(doc.medilockerId || doc.registrationNumber);
                          }}
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid rgba(0,0,0,0.06)',
                            cursor: doc.isAffiliated ? 'default' : 'pointer',
                            background: isSelected ? 'rgba(2, 132, 199, 0.1)' : 'transparent',
                            opacity: doc.isAffiliated ? 0.6 : 1,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: '13px', color: 'var(--plum)' }}>Dr. {doc.fullName}</strong>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                              {doc.specialization} · Reg: {doc.registrationNumber} · {doc.medilockerId}
                            </div>
                          </div>
                          {doc.isAffiliated ? (
                            <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 700 }}>Already Affiliated</span>
                          ) : isSelected ? (
                            <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 800 }}>✓ Selected</span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700 }}>Select →</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected doctor summary or Direct identifier */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
                  Doctor Unit ID / Registration No / Email
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. ML-DOC-123-456 or Reg Number or doctor@email.com"
                  value={selectedDoctor ? `Dr. ${selectedDoctor.fullName} (${selectedDoctor.medilockerId})` : directId}
                  onChange={(e) => {
                    setSelectedDoctor(null);
                    setDirectId(e.target.value);
                  }}
                  style={{ width: '100%', background: selectedDoctor ? 'rgba(2, 132, 199, 0.06)' : 'var(--cream)', fontWeight: 600 }}
                  required
                />
                {selectedDoctor && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700 }}>✓ Linked to Doctor Profile</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDoctor(null);
                        setDirectId('');
                      }}
                      style={{ background: 'none', border: 'none', fontSize: '11px', color: '#e11d48', cursor: 'pointer' }}
                    >
                      Clear selection
                    </button>
                  </div>
                )}
              </div>

              {/* Select Department */}
              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
                  Assigned Clinical Department
                </label>
                <select
                  className="input"
                  value={targetDepartment}
                  onChange={(e) => setTargetDepartment(e.target.value)}
                  style={{ width: '100%', background: 'var(--cream)', fontWeight: 600 }}
                >
                  {DEFAULT_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                  <option value="CUSTOM">+ Other Custom Department...</option>
                </select>

                {targetDepartment === 'CUSTOM' && (
                  <input
                    type="text"
                    className="input"
                    placeholder="Enter custom department name..."
                    value={customDept}
                    onChange={(e) => setCustomDept(e.target.value)}
                    style={{ width: '100%', marginTop: '8px', background: 'var(--cream)' }}
                    required
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: '#0284c7', borderColor: '#0284c7' }}
                  disabled={submitting}
                >
                  {submitting ? 'Enrolling...' : 'Affiliate Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT DEPARTMENT MODAL */}
      {editingDoctor && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingDoctor(null);
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '450px',
              width: '100%',
              background: 'var(--white)',
              borderRadius: '20px',
              padding: '24px',
            }}
          >
            <h3 style={{ margin: '0 0 12px', color: 'var(--plum)' }}>
              Change Department for Dr. {editingDoctor.fullName}
            </h3>

            <form onSubmit={handleSaveDepartment}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px' }}>
                  Department Name
                </label>
                <input
                  type="text"
                  className="input"
                  value={editDeptValue}
                  onChange={(e) => setEditDeptValue(e.target.value)}
                  style={{ width: '100%', background: 'var(--cream)' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEditingDoctor(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#0284c7', borderColor: '#0284c7' }}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default HospitalDoctors;
