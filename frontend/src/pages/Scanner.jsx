import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import jsQR from 'jsqr';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export function Scanner() {
  const { user } = useAuth();
  const role = user?.role || 'PATIENT';
  const isAuthorized = role === 'DOCTOR' || role === 'HOSPITAL' || role === 'ADMIN';

  const [mode, setMode] = useState('camera'); // 'camera' | 'upload' | 'manual'
  const [isScannerOn, setIsScannerOn] = useState(true); // User switch to power off/on scanner
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' | 'user'
  const [cameraError, setCameraError] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patientData, setPatientData] = useState(null);
  const [copied, setCopied] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);

  // Play subtle high-pitch tone on successful QR scan using Web Audio API
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 tone
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (_) {}
  };

  // Start Camera Stream
  const startCamera = async () => {
    stopCamera();
    if (!isScannerOn) return;
    setCameraError('');
    try {
      const constraints = {
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        requestAnimationFrame(tickScan);
      }
    } catch (err) {
      console.warn('Camera access error:', err);
      setCameraError('Camera access denied or unavailable. Please upload a QR image or enter Unit ID manually.');
      setCameraActive(false);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Scan Video Frame Loop
  const tickScan = () => {
    if (!isScannerOn) return;
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          playBeep();
          stopCamera();
          handleScannedContent(code.data);
          return;
        }
      }
    }
    if (cameraActive && isScannerOn) {
      animFrameRef.current = requestAnimationFrame(tickScan);
    }
  };

  useEffect(() => {
    if (mode === 'camera' && !patientData && isScannerOn && isAuthorized) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode, cameraFacing, patientData, isScannerOn, isAuthorized]);

  // Handle Scanned Content (either offline JSON payload or online Unit ID query)
  const handleScannedContent = async (rawContent) => {
    setError('');
    setLoading(true);

    try {
      let parsed = null;
      let unitIdToFetch = rawContent.trim();

      // Check if it is a JSON payload
      if (rawContent.startsWith('{') && rawContent.endsWith('}')) {
        try {
          parsed = JSON.parse(rawContent);
          if (parsed.unitId) unitIdToFetch = parsed.unitId;
        } catch (_) {}
      }

      // 1. If parsed offline payload is valid, use it as baseline
      if (parsed && (parsed.scheme === 'MEDILOCKER-EMERGENCY-V1' || parsed.type === 'KIOSK_INTAKE_TICKET')) {
        const offlineData = {
          fullName: parsed.name || parsed.patientName || 'Registered Citizen',
          medilockerId: parsed.unitId || 'ML-EMERGENCY',
          bloodGroup: parsed.blood || 'Not specified',
          allergies: Array.isArray(parsed.allergies) ? parsed.allergies : [],
          chronicConditions: [],
          activePrescriptions: [],
          kiosk: parsed.kiosk || (parsed.type === 'KIOSK_INTAKE_TICKET' ? parsed : null),
          emergencyContact: {
            name: 'Emergency Contact',
            phone: parsed.emergencyPhone || '102',
          },
          accessedAt: new Date().toISOString(),
          isOfflineDecoded: true,
        };
        setPatientData(offlineData);
      }

      // 2. Fetch rich real-time clinical data from backend database
      try {
        const res = await api.emergencyLookup(unitIdToFetch);
        if (res?.data) {
          setPatientData((prev) => ({
            ...res.data,
            kiosk: prev?.kiosk || res.data.latestKioskIntake || null,
          }));
        }
      } catch (backendErr) {
        // If offline payload was available, keep offline; otherwise show error
        if (!parsed) {
          setError(backendErr.message || 'No patient record found matching this QR code or ID.');
        }
      }
    } catch (err) {
      setError('Could not read patient profile: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Image Upload QR Decoding
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code && code.data) {
          playBeep();
          handleScannedContent(code.data);
        } else {
          setError('No valid MediLocker QR code detected in this image. Try adjusting lighting or use manual lookup.');
        }
      };
      img.src = event.target?.result;
    };
    reader.readAsDataURL(file);
  };

  // Handle Manual Unit ID Search
  const handleManualSearch = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleScannedContent(manualInput.trim());
  };


  const resetScanner = () => {
    setPatientData(null);
    setError('');
    setManualInput('');
    if (mode === 'camera') {
      startCamera();
    }
  };

  const copyEmergencySynopsis = () => {
    if (!patientData) return;
    const allergies = (patientData.allergies || []).join(', ') || 'None recorded';
    const chronic = (patientData.chronicConditions || []).join(', ') || 'None recorded';
    const meds = (patientData.activePrescriptions || []).map((m) => `${m.medicineName} (${m.dosage})`).join(', ') || 'None';
    const text = `=== MEDILOCKER EMERGENCY CLINICAL SUMMARY ===
Patient: ${patientData.fullName}
Unit ID: ${patientData.medilockerId}
Blood Group: ${patientData.bloodGroup}
Critical Allergies: ${allergies}
Chronic Conditions: ${chronic}
Active Medications: ${meds}
Emergency Contact: ${patientData.emergencyContact?.name} (${patientData.emergencyContact?.phone})
Accessed At: ${new Date(patientData.accessedAt || Date.now()).toLocaleString()}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isAuthorized) {
    return (
      <div className="profile-card" style={{ maxWidth: '820px', margin: '40px auto', textAlign: 'center', padding: '52px 36px', boxShadow: '0 20px 50px rgba(43,32,58,.08)' }}>
        <div style={{ width: '70px', height: '70px', borderRadius: '22px', background: '#fee2e2', color: '#dc2626', display: 'grid', placeItems: 'center', fontSize: '32px', margin: '0 auto 20px' }}>
          🛡️
        </div>
        <span className="eyebrow" style={{ color: '#b91c1c', marginBottom: '8px', display: 'inline-block' }}>
          CLINICAL TRIAGE RESTRICTED ACCESS
        </span>
        <h2 style={{ fontFamily: 'Manrope', fontSize: '28px', color: '#991b1b', margin: '6px 0 16px', letterSpacing: '-0.5px' }}>
          Doctor & Hospital Access Only
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: '16px', maxWidth: '620px', margin: '0 auto 28px', lineHeight: 1.65 }}>
          The Emergency Patient QR Scanner is exclusively authorized for verified attending Doctors and accredited Hospital Emergency Desks to triage patients and retrieve life-saving vitals.
        </p>
        <p style={{ color: 'var(--ink)', fontSize: '15px', fontWeight: 600, margin: '0 auto 32px' }}>
          As a registered citizen/patient, your personal sovereign emergency QR card is available in your profile.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <Link to="/profile" className="primary-btn" style={{ padding: '13px 26px', fontSize: '15px' }}>
            ◉ View My Emergency QR Card
          </Link>
          <Link to="/dashboard" className="secondary-btn" style={{ padding: '13px 24px', fontSize: '15px' }}>
            ⌂ Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow" style={{ color: '#b91c1c' }}>HOSPITAL & DOCTOR EMERGENCY TRIAGE</span>
          <h1>Emergency Patient QR Scanner.</h1>
          <p>Scan a patient's physical/digital Emergency QR code or enter their Unit ID to access critical life-saving vitals, allergies, and blood group instantly.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link to="/vaidya" className="secondary-btn" style={{ padding: '8px 16px', fontSize: '13px' }}>
            🩺 Vaidya 30s Chart
          </Link>
          <Link to="/kiosk" className="secondary-btn" style={{ padding: '8px 16px', fontSize: '13px' }}>
            🏥 OPD Kiosk
          </Link>
        </div>
      </div>

      {/* Main Container */}
      {!patientData ? (
        <div className="scanner-main-grid">
          {/* Scanner Viewfinder / Input Box */}
          <div
            style={{
              background: '#0f172a',
              borderRadius: '24px',
              padding: '24px',
              color: '#f8fafc',
              boxShadow: '0 20px 40px -15px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {/* Mode Switcher Tabs */}
            <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.06)', padding: '6px', borderRadius: '14px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setMode('camera')}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: mode === 'camera' ? '#0284c7' : 'transparent',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                📷 Live Camera
              </button>
              <button
                type="button"
                onClick={() => setMode('upload')}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: mode === 'upload' ? '#0284c7' : 'transparent',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                🖼 Upload QR Image
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: mode === 'manual' ? '#0284c7' : 'transparent',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                ⌨ Unit ID / Manual
              </button>
            </div>

            {/* Mode 1: Camera Scanner */}
            {mode === 'camera' && (
              <div>
                {/* Scanner Power Status & Switch Controls */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: isScannerOn ? 'rgba(2, 132, 199, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    border: isScannerOn ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                    padding: '8px 14px',
                    marginBottom: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700 }}>
                    <span style={{ color: isScannerOn ? '#38bdf8' : '#ef4444' }}>
                      {isScannerOn ? '🟢 Scanner Camera Active' : '🔴 Scanner Switched Off (Standby)'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (isScannerOn) {
                        setIsScannerOn(false);
                        stopCamera();
                      } else {
                        setIsScannerOn(true);
                        startCamera();
                      }
                    }}
                    style={{
                      background: isScannerOn ? '#ef4444' : '#0284c7',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                    }}
                  >
                    {isScannerOn ? '⏹ Switch Off Scanner' : '⚡ Switch On Scanner'}
                  </button>
                </div>

                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '340px',
                    borderRadius: '18px',
                    overflow: 'hidden',
                    background: '#020617',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: isScannerOn ? '2px solid rgba(56, 189, 248, 0.4)' : '2px dashed rgba(239, 68, 68, 0.3)',
                  }}
                >
                  {isScannerOn ? (
                    <>
                      <video
                        ref={videoRef}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: cameraActive ? 'block' : 'none',
                        }}
                      />
                      <canvas ref={canvasRef} style={{ display: 'none' }} />

                      {/* Scanning Overlay Reticle */}
                      {cameraActive && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <div
                            style={{
                              width: '220px',
                              height: '220px',
                              border: '2px solid #38bdf8',
                              borderRadius: '20px',
                              position: 'relative',
                              boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.45)',
                            }}
                          >
                            {/* Laser Scan Line */}
                            <div
                              style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                height: '3px',
                                background: 'linear-gradient(90deg, transparent, #38bdf8, #ef4444, #38bdf8, transparent)',
                                boxShadow: '0 0 12px #38bdf8',
                                animation: 'scanLaser 2s infinite ease-in-out',
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {!cameraActive && (
                        <div style={{ textAlign: 'center', padding: '24px' }}>
                          <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>📷</span>
                          <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: '14px' }}>
                            {cameraError || 'Camera connecting... Click below if prompt appears.'}
                          </p>
                          <button
                            type="button"
                            onClick={startCamera}
                            style={{
                              background: '#0284c7',
                              color: '#fff',
                              border: 'none',
                              padding: '10px 22px',
                              borderRadius: '12px',
                              fontWeight: 700,
                              fontSize: '14px',
                              cursor: 'pointer',
                            }}
                          >
                            Start Camera Viewfinder
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Scanner Standby View when Switched Off */
                    <div style={{ textAlign: 'center', padding: '36px 20px' }}>
                      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'grid', placeItems: 'center', fontSize: '26px', margin: '0 auto 16px' }}>
                        ⏹
                      </div>
                      <h4 style={{ margin: '0 0 8px', fontSize: '18px', color: '#f8fafc' }}>
                        Scanner Camera is Switched OFF
                      </h4>
                      <p style={{ margin: '0 auto 20px', color: '#94a3b8', fontSize: '13.5px', maxWidth: '340px', lineHeight: 1.5 }}>
                        Camera stream is stopped and hardware is released. Click below to turn the scanner back on.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsScannerOn(true);
                          startCamera();
                        }}
                        style={{
                          background: '#0284c7',
                          color: '#fff',
                          border: 'none',
                          padding: '10px 24px',
                          borderRadius: '12px',
                          fontWeight: 800,
                          fontSize: '14px',
                          cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                        }}
                      >
                        ⚡ Turn On Camera Scanner
                      </button>
                    </div>
                  )}
                </div>

                {cameraActive && isScannerOn && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
                    <button
                      type="button"
                      onClick={() => setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#cbd5e1',
                        padding: '6px 14px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      🔄 Switch Camera ({cameraFacing === 'environment' ? 'Back' : 'Front'})
                    </button>
                    <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 700 }}>
                      ● Point viewfinder at Patient QR
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Mode 2: Upload QR Image */}
            {mode === 'upload' && (
              <div
                style={{
                  border: '2px dashed rgba(255,255,255,0.2)',
                  borderRadius: '18px',
                  padding: '40px 20px',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <span style={{ fontSize: '44px', display: 'block', marginBottom: '12px' }}>🖼</span>
                <h3 style={{ margin: '0 0 6px', fontSize: '18px' }}>Upload Patient Emergency QR</h3>
                <p style={{ margin: '0 0 20px', color: '#94a3b8', fontSize: '13px' }}>
                  Select or drag & drop a saved screenshot, photo, or PDF scan of the patient's card.
                </p>
                <label
                  style={{
                    display: 'inline-block',
                    background: '#0284c7',
                    color: '#fff',
                    padding: '12px 26px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                  }}
                >
                  Browse Image File
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                </label>
              </div>
            )}

            {/* Mode 3: Manual Unit ID Input */}
            {mode === 'manual' && (
              <form onSubmit={handleManualSearch}>
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#94a3b8', marginBottom: '8px' }}>
                    Patient MediLocker ID / Phone / Email
                  </label>
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="e.g. ML-2026-9042 or 9876543210"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      background: 'rgba(0,0,0,0.3)',
                      color: '#fff',
                      fontSize: '15px',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !manualInput.trim()}
                  style={{
                    width: '100%',
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    padding: '14px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '15px',
                    cursor: 'pointer',
                  }}
                >
                  {loading ? 'Querying Sovereign Vault...' : '⚡ Fetch Emergency Record'}
                </button>
              </form>
            )}

            {error && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginTop: '18px',
                  color: '#fca5a5',
                  fontSize: '13px',
                }}
              >
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Clinical Workflow & Triage Security Notice */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Live Triage Instructions */}
            <div
              style={{
                background: 'var(--white)',
                border: '1px solid var(--line)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: 'var(--shadow)',
              }}
            >
              <span className="eyebrow" style={{ color: '#0284c7' }}>TRIAGE WORKFLOW</span>
              <h3 style={{ fontFamily: 'Manrope', margin: '4px 0 10px', fontSize: '18px' }}>
                How Emergency QR Scanning Works
              </h3>
              <ul style={{ margin: '0 0 16px', paddingLeft: '18px', color: 'var(--muted)', fontSize: '13px', lineHeight: 1.6 }}>
                <li><b>Live Camera:</b> Align the patient's digital or physical QR within the viewfinder frame.</li>
                <li><b>Direct Image Upload:</b> Upload an image/photo of the patient's Arogya Pocket Card.</li>
                <li><b>Sovereign Unit ID:</b> Enter the patient's unique MediLocker ID (e.g., <code>ML-XXXX-XXXX</code>).</li>
                <li><b>Live Extraction:</b> Instantly retrieves verified blood group, critical allergies, ongoing medications, and next of kin contacts from the patient's secure clinical vault.</li>
              </ul>
            </div>

            {/* Protocol Notice */}
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '24px',
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '24px' }}>🛡</span>
                <div>
                  <strong style={{ color: '#991b1b', fontSize: '15px' }}>Emergency Triage Standard</strong>
                  <p style={{ margin: '6px 0 0', color: '#b91c1c', fontSize: '13px', lineHeight: 1.5 }}>
                    Emergency access is strictly governed under the NDHM/ABDM Break-Glass Protocol. Every QR scan creates an immutable audit trail entry linked to the attending healthcare facility.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Patient Clinical Emergency Card Display */
        <div style={{ marginBottom: '40px' }}>
          {/* Emergency Alert Topbar */}
          <div
            style={{
              background: 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)',
              color: '#fff',
              borderRadius: '24px 24px 0 0',
              padding: '20px 28px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: '0 10px 25px -5px rgba(185, 28, 28, 0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '28px' }}>🚨</span>
              <div>
                <span style={{ fontSize: '11px', letterSpacing: '1px', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9 }}>
                  EMERGENCY CLINICAL PROFILE ACCESSED
                </span>
                <h2 style={{ margin: 0, fontFamily: 'Manrope', fontSize: '22px' }}>
                  {patientData.fullName}
                </h2>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={copyEmergencySynopsis}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {copied ? '✓ Copied to Clipboard' : '📋 Copy Synopsis'}
              </button>
              <button
                type="button"
                onClick={handlePrint}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                🖨 Print Chart
              </button>
              <button
                type="button"
                onClick={resetScanner}
                style={{
                  background: '#ffffff',
                  color: '#991b1b',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                🔄 Scan Next Patient
              </button>
            </div>
          </div>

          {/* Emergency Card Body */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--line)',
              borderTop: 'none',
              borderRadius: '0 0 24px 24px',
              padding: '32px',
              boxShadow: 'var(--shadow)',
            }}
          >
            {/* Critical Vitals Strip */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '18px',
                marginBottom: '28px',
              }}
            >
              {/* Blood Group */}
              <div
                style={{
                  background: '#fef2f2',
                  border: '2px solid #ef4444',
                  borderRadius: '18px',
                  padding: '18px',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#991b1b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  BLOOD GROUP
                </span>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#dc2626', fontFamily: 'Manrope', margin: '4px 0' }}>
                  {patientData.bloodGroup || 'O+'}
                </div>
                <small style={{ color: '#b91c1c', fontWeight: 600 }}>Universal / Clinical verified</small>
              </div>

              {/* Age / Gender */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--line)',
                  borderRadius: '18px',
                  padding: '18px',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  DEMOGRAPHICS
                </span>
                <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'Manrope', margin: '6px 0 2px' }}>
                  {patientData.gender || 'Not specified'}
                </div>
                <small style={{ color: 'var(--muted)' }}>
                  DOB: {patientData.dob ? new Date(patientData.dob).toLocaleDateString() : 'N/A'}
                </small>
              </div>

              {/* Unit ID & Insurance */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--line)',
                  borderRadius: '18px',
                  padding: '18px',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  SOVEREIGN UNIT ID
                </span>
                <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', margin: '6px 0 2px', color: 'var(--plum)' }}>
                  {patientData.medilockerId}
                </div>
                <small style={{ color: 'var(--muted)' }}>
                  {patientData.insuranceProvider ? `Insurance: ${patientData.insuranceProvider}` : 'ABHA Sovereign Protected'}
                </small>
              </div>

              {/* Immediate Next of Kin Contact */}
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: '18px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#166534', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    EMERGENCY CONTACT
                  </span>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#14532d', margin: '4px 0 2px' }}>
                    {patientData.emergencyContact?.name || 'Next of Kin'}
                  </div>
                  <small style={{ color: '#15803d', fontWeight: 700 }}>
                    {patientData.emergencyContact?.phone || '102'}
                  </small>
                </div>
                {patientData.emergencyContact?.phone && (
                  <a
                    href={`tel:${patientData.emergencyContact.phone}`}
                    style={{
                      display: 'inline-block',
                      textAlign: 'center',
                      background: '#16a34a',
                      color: '#fff',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '12px',
                      textDecoration: 'none',
                      marginTop: '8px',
                    }}
                  >
                    📞 Call Contact Now
                  </a>
                )}
              </div>
            </div>

            {/* Critical Clinical Alerts: Allergies & Chronic Conditions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
              {/* Critical Allergies */}
              <div
                style={{
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: '18px',
                  padding: '22px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '20px' }}>⚠️</span>
                  <h3 style={{ margin: 0, fontFamily: 'Manrope', fontSize: '16px', color: '#9f1239' }}>
                    Critical Allergies & Contraindications
                  </h3>
                </div>

                {Array.isArray(patientData.allergies) && patientData.allergies.length > 0 ? (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {patientData.allergies.map((allergy, i) => (
                      <span
                        key={i}
                        style={{
                          background: '#be123c',
                          color: '#fff',
                          padding: '6px 14px',
                          borderRadius: '999px',
                          fontSize: '13px',
                          fontWeight: 800,
                          boxShadow: '0 2px 6px rgba(190, 18, 60, 0.2)',
                        }}
                      >
                        🚫 {allergy}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, color: '#9f1239', fontSize: '13px' }}>
                    No critical baseline drug or food allergies recorded.
                  </p>
                )}
              </div>

              {/* Chronic Conditions & Past History */}
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '18px',
                  padding: '22px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '20px' }}>🫀</span>
                  <h3 style={{ margin: 0, fontFamily: 'Manrope', fontSize: '16px', color: '#92400e' }}>
                    Chronic Conditions & Surgical History
                  </h3>
                </div>

                {Array.isArray(patientData.chronicConditions) && patientData.chronicConditions.length > 0 ? (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {patientData.chronicConditions.map((cond, i) => (
                      <span
                        key={i}
                        style={{
                          background: '#d97706',
                          color: '#fff',
                          padding: '6px 14px',
                          borderRadius: '999px',
                          fontSize: '13px',
                          fontWeight: 800,
                        }}
                      >
                        ● {cond}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, color: '#92400e', fontSize: '13px' }}>
                    No chronic ailments or surgical implants on immediate record.
                  </p>
                )}
              </div>
            </div>

            {/* Recent OPD Kiosk Self-Intake & Triage */}
            {(patientData.kiosk || patientData.latestKioskIntake) && (
              <div
                style={{
                  marginBottom: '28px',
                  background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08), rgba(37, 99, 235, 0.04))',
                  border: '2px solid rgba(2, 132, 199, 0.35)',
                  borderRadius: '18px',
                  padding: '20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '22px' }}>🏥</span>
                    <h3 style={{ margin: 0, fontFamily: 'Manrope', fontSize: '17px', color: '#0369a1' }}>
                      OPD Kiosk Self-Intake & Triage Record
                    </h3>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {(patientData.kiosk?.token || patientData.kiosk?.tokenNumber) && (
                      <span
                        style={{
                          background: 'rgba(2, 132, 199, 0.15)',
                          color: '#0284c7',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 800,
                        }}
                      >
                        Token: {patientData.kiosk.token || patientData.kiosk.tokenNumber}
                      </span>
                    )}

                    <span
                      style={{
                        background:
                          (patientData.kiosk?.triage || patientData.kiosk?.triageCategory) === 'RED'
                            ? '#dc2626'
                            : '#0284c7',
                        color: '#fff',
                        padding: '4px 12px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      ● {(patientData.kiosk?.triage || patientData.kiosk?.triageCategory || 'LIVE INTAKE')}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '14px', color: 'var(--plum)', lineHeight: 1.6, background: 'rgba(255,255,255,0.7)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(2, 132, 199, 0.15)' }}>
                  <strong>Reported Clinical Complaint:</strong>{' '}
                  {patientData.kiosk?.complaint ||
                    patientData.kiosk?.complaintSummary ||
                    patientData.latestKioskIntake?.clinicalSummary ||
                    'Touch body-map and voice triage recorded.'}
                </div>

                {Array.isArray(patientData.latestKioskIntake?.diagnoses) && patientData.latestKioskIntake.diagnoses.length > 0 && (
                  <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {patientData.latestKioskIntake.diagnoses.map((d, i) => (
                      <span
                        key={i}
                        style={{
                          background: 'rgba(2, 132, 199, 0.12)',
                          color: '#0369a1',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        ● {d}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Active Ongoing Prescriptions */}
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontFamily: 'Manrope', fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>💊</span> Active Ongoing Prescriptions (Prevent Lethal Interactions)
              </h3>

              {Array.isArray(patientData.activePrescriptions) && patientData.activePrescriptions.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                  {patientData.activePrescriptions.map((med, i) => (
                    <div
                      key={i}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid var(--line)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '14px', color: 'var(--plum)' }}>{med.medicineName}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                          {med.dosage} • {med.frequency}
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                        Active Course
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px' }}>
                  No ongoing medications recorded in patient's active vault.
                </p>
              )}
            </div>

            {/* Bottom Actions for Attending Doctors */}
            <div
              style={{
                borderTop: '1px solid var(--line)',
                paddingTop: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '14px',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Time of Access: {new Date(patientData.accessedAt || Date.now()).toLocaleString()} • Sovereign Audit ID: #AUD-{Math.floor(100000 + Math.random() * 900000)}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <Link
                  to="/vaidya"
                  className="primary-btn"
                  style={{ background: 'var(--plum)', fontSize: '13px', padding: '10px 20px' }}
                >
                  🩺 Open Full Vaidya 30s Chart ↗
                </Link>
                <button
                  type="button"
                  onClick={resetScanner}
                  className="secondary-btn"
                  style={{ fontSize: '13px', padding: '10px 20px' }}
                >
                  Close Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Laser Animation Styles */}
      <style>{`
        @keyframes scanLaser {
          0% { top: 0%; opacity: 0.8; }
          50% { top: 96%; opacity: 1; }
          100% { top: 0%; opacity: 0.8; }
        }
      `}</style>
    </>
  );
}
