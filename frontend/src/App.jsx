import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';

import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { Records } from './pages/Records';
import { Timeline } from './pages/Timeline';
import { Medications } from './pages/Medications';
import { Inventory } from './pages/Inventory';
import { Companion } from './pages/Companion';
import { Kiosk } from './pages/Kiosk';
import { Vaidya } from './pages/Vaidya';
import { Delegation } from './pages/Delegation';
import { Profile } from './pages/Profile';
import { Scanner } from './pages/Scanner';
import { HospitalDoctors } from './pages/HospitalDoctors';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--cream)', color: 'var(--plum)' }}>
        <h2>Loading Sovereign MediLocker...</h2>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export function App() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Authenticated Sovereign Portal Pages */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/records" element={<Records />} />
        <Route path="/upload" element={<Records />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/medications" element={<Medications />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/companion" element={<Companion />} />
        <Route path="/ai-companion" element={<Companion />} />
        <Route path="/kiosk" element={<Kiosk />} />
        <Route path="/hospital-doctors" element={<HospitalDoctors />} />
        <Route path="/doctors" element={<HospitalDoctors />} />
        <Route path="/vaidya" element={<Vaidya />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/emergency-scanner" element={<Scanner />} />
        <Route path="/delegation" element={<Delegation />} />
        <Route path="/profile" element={<Profile />} />
      </Route>


      {/* Fallback to Landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
export default App;
