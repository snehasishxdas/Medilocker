import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export function Sidebar({ isOpen = false, onClose = () => {} }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();

  const name = user?.patientProfile?.fullName || user?.name || user?.email?.split('@')[0] || 'Patient';
  const unitId = user?.medilockerId || user?.patientProfile?.id || user?.id || 'ML-SECURE';
  const initials = (name.split(' ').map((n) => n[0]).join('') || 'P').slice(0, 2).toUpperCase();
  const userRole = String(user?.role || '').toUpperCase();
  const isDoctor = userRole === 'DOCTOR' || Boolean(user?.doctorProfile);
  const isHospital = userRole === 'HOSPITAL' || Boolean(user?.hospitalProfile);
  const role = isDoctor ? 'DOCTOR' : isHospital ? 'HOSPITAL' : 'PATIENT';
  const roleTitle = role === 'DOCTOR' ? t('doctorSuiteTitle', 'Doctor / Clinical Suite') : role === 'HOSPITAL' ? t('hospitalPortalTitle', 'Hospital & Emergency Portal') : t('patientSpaceTitle', 'Patient Sovereign Space');
  const roleBadgeColor = role === 'DOCTOR' ? '#b45309' : role === 'HOSPITAL' ? '#0284c7' : 'var(--plum)';

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  return (
    <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
      {/* Mobile Drawer Close Button */}
      <div className="mobile-drawer-close">
        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--plum)' }}>MEDILOCKER MENU</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          style={{
            background: 'rgba(0,0,0,0.06)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            fontSize: '16px',
            color: 'var(--plum)',
          }}
        >
          ✕
        </button>
      </div>

      <div className="patient-mini">
        <div className="avatar" style={{ background: roleBadgeColor }}>{initials}</div>
        <strong>{name}</strong>
        <small style={{ color: roleBadgeColor, fontWeight: 800, fontSize: '12px' }}>{unitId}</small>
        <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, color: roleBadgeColor, background: 'rgba(0,0,0,0.04)', padding: '2px 8px', borderRadius: '6px', marginTop: '4px', display: 'inline-block' }}>
          {roleTitle}
        </span>
      </div>

      <nav className="side-nav">
        {role === 'DOCTOR' ? (
          <>
            <div style={{ padding: '8px 12px 4px', fontSize: '10px', fontWeight: 800, letterSpacing: '1px', color: '#b45309', textTransform: 'uppercase' }}>
              {t('doctorNavigation', 'Doctor Navigation')}
            </div>
            <NavLink to="/dashboard" onClick={handleLinkClick} className={({ isActive }) => (isActive ? 'active' : '')}>
              ⌂ <span>{t('dashboard', 'Dashboard')}</span>
            </NavLink>
            <NavLink to="/companion" onClick={handleLinkClick} className={({ isActive }) => (isActive ? 'active' : '')}>
              ✦ <span>{t('aiCompanionPage', 'Medi-AI Companion')}</span>
            </NavLink>
            <NavLink to="/kiosk" onClick={handleLinkClick} className={({ isActive }) => (isActive ? 'active' : '')} style={{ color: '#0284c7' }}>
              🏥 <span>{t('kioskPage', 'OPD Touch Kiosk')}</span>
            </NavLink>
            <NavLink to="/profile" onClick={handleLinkClick} className={({ isActive }) => (isActive ? 'active' : '')}>
              ◉ <span>{t('profilePage', 'My Profile')}</span>
            </NavLink>
          </>
        ) : role === 'HOSPITAL' ? (
          <>
            <div style={{ padding: '8px 12px 4px', fontSize: '10px', fontWeight: 800, letterSpacing: '1px', color: '#0284c7', textTransform: 'uppercase' }}>
              {t('hospitalHeader', 'Hospital & Emergency')}
            </div>
            <NavLink to="/dashboard" onClick={handleLinkClick} className={({ isActive }) => (isActive ? 'active' : '')}>
              ⌂ <span>{t('dashboard', 'Dashboard')}</span>
            </NavLink>
            <NavLink to="/hospital-doctors" onClick={handleLinkClick} className={({ isActive }) => (isActive ? 'active' : '')} style={{ color: '#0284c7' }}>
              👨‍⚕️ <span>{t('hospitalDoctorsPage', 'Hospital Doctors & Staff')}</span>
            </NavLink>
            <NavLink to="/kiosk" onClick={handleLinkClick} className={({ isActive }) => (isActive ? 'active' : '')} style={{ color: '#0284c7' }}>
              🏥 <span>{t('kioskPage', 'OPD Touch Kiosk')}</span>
            </NavLink>
            <NavLink to="/scanner" onClick={handleLinkClick} className={({ isActive }) => (isActive ? 'active' : '')} style={{ color: '#b91c1c' }}>
              🚨 <span>{t('scannerPage', 'Emergency QR Scanner')}</span>
            </NavLink>
            <NavLink to="/profile" onClick={handleLinkClick} className={({ isActive }) => (isActive ? 'active' : '')}>
              ◉ <span>{t('profilePage', 'My Profile')}</span>
            </NavLink>
          </>
        ) : (
          <>
            {/* Patient Core Locker */}
            <div style={{ padding: '8px 12px 4px', fontSize: '10px', fontWeight: 800, letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase' }}>
              {t('patientVaultHeader', 'Patient Health Vault')}
            </div>
            <NavLink to="/dashboard" onClick={handleLinkClick} className={({ isActive }) => (isActive ? 'active' : '')}>
              ⌂ <span>{t('dashboard', 'Dashboard')}</span>
            </NavLink>
            <NavLink to="/timeline" onClick={handleLinkClick} className={({ isActive }) => (isActive ? 'active' : '')}>
              ⏳ <span>{t('timelinePage', 'Health Timeline')}</span>
            </NavLink>
            <NavLink to="/records" onClick={handleLinkClick} className={({ isActive }) => (isActive ? 'active' : '')}>
              ▤ <span>{t('recordsPage', 'Medical Records')}</span>
            </NavLink>
            <NavLink to="/medications" onClick={handleLinkClick} className={({ isActive }) => (isActive ? 'active' : '')}>
              ✓ <span>{t('todoPage', 'Medication To-Do')}</span>
            </NavLink>
            <NavLink to="/inventory" onClick={handleLinkClick} className={({ isActive }) => (isActive ? 'active' : '')}>
              ⊞ <span>{t('inventoryPage', 'Medicine Cabinet')}</span>
            </NavLink>
            <NavLink to="/companion" onClick={handleLinkClick} className={({ isActive }) => (isActive ? 'active' : '')}>
              ✦ <span>{t('aiCompanionPage', 'Medi-AI Companion')}</span>
            </NavLink>
            <NavLink to="/kiosk" onClick={handleLinkClick} className={({ isActive }) => (isActive ? 'active' : '')} style={{ color: '#0284c7' }}>
              🏥 <span>{t('kioskPage', 'OPD Touch Kiosk')}</span>
            </NavLink>
            <NavLink to="/delegation" onClick={handleLinkClick} className={({ isActive }) => (isActive ? 'active' : '')} style={{ color: '#047857' }}>
              🛡 <span>{t('delegationPage', 'Consent & Access')}</span>
            </NavLink>
            <NavLink to="/profile" onClick={handleLinkClick} className={({ isActive }) => (isActive ? 'active' : '')}>
              ◉ <span>{t('profilePage', 'My Profile & QR')}</span>
            </NavLink>
          </>
        )}
      </nav>

      <div className="side-bottom">
        <button
          onClick={() => {
            if (onClose) onClose();
            logout();
          }}
          type="button"
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            gap: '13px',
            alignItems: 'center',
            padding: '13px 14px',
            borderRadius: '13px',
            color: 'var(--muted)',
            fontWeight: 700,
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left'
          }}
        >
          ↪ <span>{t('signOut', 'Sign out')}</span>
        </button>
      </div>
    </aside>
  );
}

