import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export function Navbar({ isApp = true, onToggleMobileMenu = () => {}, isMobileMenuOpen = false }) {
  const { user, isAuthenticated, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const [locationLabel, setLocationLabel] = useState(() => {
    try {
      const saved = localStorage.getItem('medilockerUserLocation');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.name || '';
      }
    } catch (e) {}
    return '';
  });

  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    const handleLocationEvent = (e) => {
      if (e.detail?.name) {
        setLocationLabel(e.detail.name);
      }
    };
    window.addEventListener('medilocker-location-updated', handleLocationEvent);
    return () => window.removeEventListener('medilocker-location-updated', handleLocationEvent);
  }, []);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let detectedCity = '';

        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
          );
          if (res.ok) {
            const data = await res.json();
            detectedCity = data.locality || data.city || data.principalSubdivision || '';
            if (data.countryCode && detectedCity) {
              detectedCity = `${detectedCity}, ${data.countryCode}`;
            }
          }
        } catch (err) {
          console.warn('Reverse geocoding error:', err);
        }

        if (!detectedCity) {
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
            );
            if (res.ok) {
              const data = await res.json();
              const addr = data.address || {};
              detectedCity = addr.city || addr.town || addr.village || addr.suburb || addr.state || '';
            }
          } catch (e) {}
        }

        if (!detectedCity) {
          detectedCity = `${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E`;
        }

        setLocationLabel(detectedCity);
        try {
          localStorage.setItem(
            'medilockerUserLocation',
            JSON.stringify({ name: detectedCity, lat, lng, timestamp: Date.now() })
          );
        } catch (e) {}

        window.dispatchEvent(
          new CustomEvent('medilocker-location-updated', {
            detail: { name: detectedCity, lat, lng }
          })
        );

        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        console.error('Geolocation error:', err);
        if (err.code === 1) {
          alert('Location permission was denied. Please allow location access in your browser to detect your actual city.');
        } else if (err.code === 2) {
          alert('Location position unavailable. Please try again.');
        } else if (err.code === 3) {
          alert('Location request timed out. Please try again.');
        } else {
          alert('Location error: ' + err.message);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <header className={isApp ? 'app-header' : 'site-header'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {isApp && (
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={onToggleMobileMenu}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            title="Toggle Navigation Menu"
          >
            <span className="hamburger-icon">{isMobileMenuOpen ? '✕' : '☰'}</span>
          </button>
        )}

        <Link to={isAuthenticated ? '/dashboard' : '/'} className="brand" aria-label="MediLocker Home">
          <img src="/logo-horizontal.png" alt="MediLocker" className="brand-logo" height="42" />
        </Link>
      </div>

      {!isApp && (
        <nav className="nav-links">
          <a href="#features">{t('navFeatures', 'Features')}</a>
          <a href="#portals">{t('navPortals', 'Access Portals')}</a>
        </nav>
      )}

      <div
        className={isApp ? 'app-header-right' : 'header-actions'}
        style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: '8px' }}
      >
        <a
          href="tel:102"
          className="sos-btn"
          id="sosHeaderBtn"
          aria-label="Emergency Ambulance Call 102"
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          <span className="sos-pulse-ring"></span>
          <span className="sos-icon">🚨</span>
          <span className="sos-btn-text">SOS 102</span>
        </a>

        <button
          className="location-btn"
          id="locationBtn"
          type="button"
          onClick={handleGetLocation}
          disabled={isLocating}
          title={locationLabel ? `Actual location: ${locationLabel}. Click to update.` : 'Click to detect your actual location'}
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          ⌖ <span>{isLocating ? 'Detecting...' : (locationLabel || t('setLocation', 'Set location'))}</span>
        </button>

        <select
          id="languageSelect"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label="Select Language"
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          <option value="en">English</option>
          <option value="hi">हिन्दी</option>
          <option value="bn">বাংলা</option>
          <option value="mr">मराठी</option>
          <option value="ur">اردو</option>
          <option value="pa">ਪੰਜਾਬੀ</option>
          <option value="kn">ಕನ್ನಡ</option>
        </select>

        {isAuthenticated ? (
          <div className="user-header-profile" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', flexShrink: 0 }}>
            <Link
              to="/profile"
              className="user-badge-link"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--white)',
                border: '1px solid var(--line)',
                borderRadius: '999px',
                padding: '6px 12px',
                fontWeight: 700,
                fontSize: '13.5px',
                color: 'var(--plum)',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              <span>👤</span>
              <span className="user-name-text">{user?.patientProfile?.fullName || user?.name || user?.email?.split('@')[0] || 'User'}</span>
            </Link>
            <button
              onClick={logout}
              type="button"
              className="secondary-btn header-signout-btn"
              style={{ padding: '6px 12px', fontSize: '12.5px', borderRadius: '999px', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {t('signOut', 'Sign out')}
            </button>
          </div>
        ) : (
          <Link
            className="signin"
            to="/login"
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {t('signIn', 'Sign in ↗')}
          </Link>
        )}
      </div>
    </header>
  );
}
