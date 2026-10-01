import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../context/AuthContext';

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const userRole = String(user?.role || '').toUpperCase();
  const isDoctor = userRole === 'DOCTOR' || Boolean(user?.doctorProfile);
  const isHospital = userRole === 'HOSPITAL' || Boolean(user?.hospitalProfile);
  const role = isDoctor ? 'DOCTOR' : isHospital ? 'HOSPITAL' : 'PATIENT';

  return (
    <>
      <Navbar
        isApp={true}
        onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
        isMobileMenuOpen={mobileMenuOpen}
      />
      
      {/* Mobile Drawer Backdrop Overlay */}
      <div
        className={`sidebar-backdrop ${mobileMenuOpen ? 'active' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      <div className="app-layout">
        <Sidebar
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />
        
        <main className="app-main">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (1-Thumb Navigation) */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <div className="mobile-nav-items">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
          >
            <span>⌂</span>
            <span>Home</span>
          </NavLink>

          {role === 'DOCTOR' ? (
            <>
              <NavLink
                to="/companion"
                className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
              >
                <span>✦</span>
                <span>Medi-AI</span>
              </NavLink>

              <NavLink
                to="/kiosk"
                className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
              >
                <span>🏥</span>
                <span>Kiosk</span>
              </NavLink>

              <NavLink
                to="/profile"
                className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
              >
                <span>◉</span>
                <span>Profile</span>
              </NavLink>
            </>
          ) : role === 'HOSPITAL' ? (
            <>
              <NavLink
                to="/hospital-doctors"
                className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
              >
                <span>👨‍⚕️</span>
                <span>Doctors</span>
              </NavLink>

              <NavLink
                to="/kiosk"
                className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
              >
                <span>🏥</span>
                <span>Kiosk</span>
              </NavLink>

              <NavLink
                to="/scanner"
                className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
              >
                <span>🚨</span>
                <span>Scanner</span>
              </NavLink>
            </>
          ) : (
            <>
              <NavLink
                to="/records"
                className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
              >
                <span>▤</span>
                <span>Records</span>
              </NavLink>

              <NavLink
                to="/timeline"
                className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
              >
                <span>⏳</span>
                <span>Timeline</span>
              </NavLink>

              <NavLink
                to="/companion"
                className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
              >
                <span>✦</span>
                <span>Medi-AI</span>
              </NavLink>
            </>
          )}

          <button
            type="button"
            className={`mobile-nav-item ${mobileMenuOpen ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            <span>☰</span>
            <span>Menu</span>
          </button>
        </div>
      </nav>
    </>
  );
}
