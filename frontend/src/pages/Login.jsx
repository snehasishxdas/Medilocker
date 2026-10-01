import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const [searchParams] = useSearchParams();
  const initialRole = (searchParams.get('role') || 'patient').toUpperCase();
  const [role, setRole] = useState(initialRole);
  const [email, setEmail] = useState('');
  const [authMode, setAuthMode] = useState('password'); // 'password' or 'unitId'
  const [password, setPassword] = useState('');
  const [unitId, setUnitId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Email address is required.');
      return;
    }

    const cleanPassword = password.trim();
    const cleanUnitId = unitId.trim().toUpperCase();

    if (authMode === 'password' && !cleanPassword) {
      setError('Please enter your password to sign in.');
      return;
    }

    if (authMode === 'unitId' && !cleanUnitId) {
      setError('Please enter your Unique Unit ID (ML-XXXX-XXXX) to sign in.');
      return;
    }

    if (!cleanPassword && !cleanUnitId) {
      setError('Please provide either your Password or your Unique Unit ID.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        email: cleanEmail,
        role,
        ...(cleanPassword ? { password: cleanPassword } : {}),
        ...(cleanUnitId ? { medilockerId: cleanUnitId } : {}),
      };

      await login(payload);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const getRoleInfo = () => {
    switch (role) {
      case 'DOCTOR':
        return {
          symbol: '✚',
          title: 'Doctor Portal Login',
          subtitle: 'Sign in to access patient records, review clinical timelines, and conduct consultations.',
        };
      case 'HOSPITAL':
        return {
          symbol: '▦',
          title: 'Hospital Portal Login',
          subtitle: 'Sign in for institutional patient management, staff doctors coordination, and records archival.',
        };
      default:
        return {
          symbol: '♡',
          title: 'Patient Login',
          subtitle: 'Sign in to manage your medical records, daily to-dos, and sovereign vault.',
        };
    }
  };

  const roleInfo = getRoleInfo();

  return (
    <>
      <Navbar isApp={false} />

      <main className="login-shell">
        <section className="login-intro">
          <span className="eyebrow">WELCOME TO MEDILOCKER</span>
          <h1>Choose your care portal.</h1>
          <p>Every role gets a focused experience, while the patient's medical story remains at the center.</p>
        </section>

        <section className="login-card">
          <div className="role-tabs">
            <button
              type="button"
              className={`role-tab ${role === 'PATIENT' ? 'active' : ''}`}
              onClick={() => setRole('PATIENT')}
            >
              Patient
            </button>
            <button
              type="button"
              className={`role-tab ${role === 'DOCTOR' ? 'active' : ''}`}
              onClick={() => setRole('DOCTOR')}
            >
              Doctor
            </button>
            <button
              type="button"
              className={`role-tab ${role === 'HOSPITAL' ? 'active' : ''}`}
              onClick={() => setRole('HOSPITAL')}
            >
              Hospital
            </button>
          </div>

          <div className="login-heading">
            <span className="role-symbol">{roleInfo.symbol}</span>
            <h2>{roleInfo.title}</h2>
          </div>
          <p className="login-subtitle">{roleInfo.subtitle}</p>

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

          <form id="loginForm" onSubmit={handleSubmit}>
            <label>
              <span>Email address</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>

            {/* Credential Mode Selector: Password vs Unit ID */}
            <div style={{ margin: '14px 0 10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--plum, #2b1836)', display: 'block', marginBottom: '8px' }}>
                Sign in using:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#f5edf9', padding: '4px', borderRadius: '12px' }}>
                <button
                  type="button"
                  onClick={() => setAuthMode('password')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: authMode === 'password' ? '#2b1836' : 'transparent',
                    color: authMode === 'password' ? '#ffffff' : '#6b5a7d',
                    transition: 'all 0.2s',
                  }}
                >
                  🔑 Password
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('unitId')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: authMode === 'unitId' ? '#2b1836' : 'transparent',
                    color: authMode === 'unitId' ? '#ffffff' : '#6b5a7d',
                    transition: 'all 0.2s',
                  }}
                >
                  🪪 Unique Unit ID
                </button>
              </div>
            </div>

            {authMode === 'password' ? (
              <label>
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password"
                  autoComplete="current-password"
                />
              </label>
            ) : (
              <label>
                <span>Unique Unit ID</span>
                <input
                  type="text"
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  placeholder="ML-XXX-XXX-XXX"
                  autoComplete="off"
                />
              </label>
            )}

            <p style={{ fontSize: '12px', color: 'var(--muted, #6b5a7d)', margin: '4px 0 16px' }}>
              💡 You can authenticate using either your password or the unique Unit ID generated during registration.
            </p>

            <button className="primary-btn full" type="submit" disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign in ↗'}
            </button>

            <p className="signup-prompt">
              <span>New to MediLocker?</span> <Link to="/signup">Create your sovereign account →</Link>
            </p>
          </form>
        </section>
      </main>

      <footer>
        <span>© 2026 MediLocker</span>
        <span>A digital home for organized healthcare.</span>
        <span>Hardware-Backed Security</span>
      </footer>
    </>
  );
}
