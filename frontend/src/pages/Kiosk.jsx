import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  speakInLanguage,
  getRecognitionLanguage,
  KIOSK_AUDIO_PROMPTS,
  SPEECH_LANG_MAP,
} from '../utils/speech';
import { generateQrSvg, generateKioskQrPayload } from '../utils/qr';

export function Kiosk() {
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('walkin'); // 'walkin' | 'appointment'
  const [intakeMode, setIntakeMode] = useState('both'); // 'touch' | 'voice' | 'both'

  // Appointment lookup state
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupFound, setLookupFound] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Kiosk Intake Data (Clean Real Patient State)
  const [selectedRegions, setSelectedRegions] = useState(new Set());
  const [selectedSymptoms, setSelectedSymptoms] = useState(new Set());
  const [painLevel, setPainLevel] = useState(1);
  const [patientName, setPatientName] = useState(
    user?.patientProfile?.fullName || user?.name || ''
  );
  const [phone, setPhone] = useState(
    user?.patientProfile?.emergencyContactPhone || user?.phone || ''
  );
  const [age, setAge] = useState('');
  const [gender, setGender] = useState(
    user?.patientProfile?.gender || 'Not specified'
  );

  // Auto-populate when user profile is loaded
  useEffect(() => {
    if (user) {
      if (!patientName && (user.patientProfile?.fullName || user.name)) {
        setPatientName(user.patientProfile?.fullName || user.name);
      }
      if (!phone && (user.patientProfile?.emergencyContactPhone || user.phone)) {
        setPhone(user.patientProfile?.emergencyContactPhone || user.phone);
      }
      if (gender === 'Not specified' && user.patientProfile?.gender) {
        setGender(user.patientProfile.gender);
      }
    }
  }, [user]);


  // Voice Recognition on Kiosk
  const dialect = SPEECH_LANG_MAP[language]?.dialect || 'English';
  const [voiceText, setVoiceText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [ticketData, setTicketData] = useState(null);

  const toggleRegion = (region) => {
    setSelectedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  };

  const toggleSymptom = (symptom) => {
    setSelectedSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(symptom)) next.delete(symptom);
      else next.add(symptom);
      return next;
    });
  };

  const playAudioGuide = (customMsg, overrideLang = null) => {
    const activeLang = overrideLang || language || 'en';
    const prompts = KIOSK_AUDIO_PROMPTS[activeLang] || KIOSK_AUDIO_PROMPTS.en;
    const text = customMsg || prompts.guide;
    speakInLanguage(text, activeLang);
  };

  // Voice recognition on Kiosk
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Speech Recognition not supported in this browser. Please touch the body map or type.');
      return;
    }

    const rec = new SpeechRec();
    rec.lang = getRecognitionLanguage(language);
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => setIsListening(true);
    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setVoiceText(transcript);
      // Auto-add recognized words to symptoms
      setSelectedSymptoms((prev) => new Set([...prev, transcript]));
      const prompts = KIOSK_AUDIO_PROMPTS[language] || KIOSK_AUDIO_PROMPTS.en;
      playAudioGuide(prompts.heard(transcript));
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);

    recognitionRef.current = rec;
    rec.start();
  };

  // Appointment / Prior patient lookup
  const handleLookup = async (e) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;
    setLookupLoading(true);
    try {
      // Lookup in backend (kiosk or delegation)
      const res = await api.request(`/api/v1/auth/me`).catch(() => null);
      if (res?.user) {
        setLookupFound(res.user);
        setPatientName(res.user.patientProfile?.fullName || 'Registered Patient');
        setPhone(res.user.phone || '');
        if (res.user.patientProfile?.dob) {
          const birthYear = new Date(res.user.patientProfile.dob).getFullYear();
          setAge(String(new Date().getFullYear() - birthYear));
        }
        if (res.user.patientProfile?.gender) setGender(res.user.patientProfile.gender);
        const prompts = KIOSK_AUDIO_PROMPTS[language] || KIOSK_AUDIO_PROMPTS.en;
        playAudioGuide(prompts.welcome(res.user.patientProfile?.fullName || 'Patient'));
      } else {
        setLookupFound(null);
        alert('No registered patient found with this identifier. You can proceed with Walk-In registration.');
      }
    } catch (err) {
      setLookupFound(null);
      alert('Patient lookup failed. Please proceed with Walk-In registration.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patientName.trim()) {
      alert('कृपया मरीज का नाम दर्ज करें (Please enter patient name)');
      return;
    }

    const regionList = Array.from(selectedRegions);
    const symptomList = Array.from(selectedSymptoms);
    if (voiceText) symptomList.push(`Voice: ${voiceText}`);

    if (regionList.length === 0) {
      alert('कृपया दर्द का अंग चुनें (Please select at least one discomfort area on the body map)');
      return;
    }

    if (symptomList.length === 0) {
      alert('कृपया तकलीफ का प्रकार चुनें (Please select at least one symptom)');
      return;
    }

    setLoading(true);

    try {
      const severityScore = painLevel * 2.5;

      // Emergency Triage rule: Chest + Sharp Pain + high severity = RED
      const isRedEmergency =
        regionList.some((r) => r.toLowerCase().includes('chest') || r.toLowerCase().includes('heart')) &&
        (symptomList.some((s) => s.includes('Sharp') || s.includes('Breath')) || severityScore >= 7.5);

      const triageCategory = isRedEmergency ? 'RED' : severityScore >= 5 ? 'YELLOW' : 'GREEN';

      const res = await api.submitKioskIntake({
        bodyRegions: regionList,
        symptoms: symptomList,
        painScale: Number(painLevel) || 1,
        guestName: patientName.trim(),
        guestPhone: phone.trim() || '9876543210',
        patientName: patientName.trim(),
        phone: phone.trim() || '9876543210',
        age: Number(age) || 30,
        gender,
        dialect,
        audioNote: voiceText || undefined,
        anatomicalRegion: regionList.join(', '),
        complaint: symptomList.join(', '),
        severity: severityScore,
        triageCategory,
      });

      if (res?.data) {
        setTicketData(res.data);
        try {
          localStorage.setItem('medilockerLastKioskTicket', JSON.stringify({
            ...res.data,
            timestamp: new Date().toISOString(),
          }));
        } catch (_) {}

        const prompts = KIOSK_AUDIO_PROMPTS[language] || KIOSK_AUDIO_PROMPTS.en;
        if (res.data.triageCategory === 'RED' || triageCategory === 'RED') {
          playAudioGuide(prompts.emergency);
        } else {
          playAudioGuide(prompts.ticketReady(res.data.tokenNumber || res.data.ticketNumber || '1'));
        }
      }
    } catch (err) {
      alert('Kiosk intake error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1140px', margin: '0 auto', color: '#fff' }}>
      {/* Top Banner with Audio Guidance & Dialect Picker */}
      <div
        style={{
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '24px',
          padding: '24px 30px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '40px' }}>🏥</span>
          <div>
            <h1 style={{ fontFamily: 'Manrope', fontSize: '24px', margin: 0, color: '#f8fafc' }}>
              Civil Hospital OPD Touch & Voice Kiosk
            </h1>
            <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '14px' }}>
              अस्पताल पर्ची कियोस्क · Tap body map or speak in your language (छुएं या बोलकर बताएं)
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={language}
            onChange={(e) => {
              const newLang = e.target.value;
              setLanguage(newLang);
              playAudioGuide(null, newLang);
            }}
            style={{
              background: '#1e293b',
              color: '#38bdf8',
              border: '1px solid #334155',
              borderRadius: '999px',
              padding: '10px 16px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <option value="en">English (English)</option>
            <option value="hi">हिंदी / भोजपुरी (Hindi)</option>
            <option value="bn">বাংলা (Bengali)</option>
            <option value="mr">मराठी (Marathi)</option>
            <option value="te">తెలుగు (Telugu)</option>
            <option value="ta">தமிழ் (Tamil)</option>
            <option value="ur">اردو (Urdu)</option>
          </select>

          <button
            type="button"
            onClick={() => playAudioGuide()}
            style={{
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              borderRadius: '999px',
              padding: '10px 20px',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>🔊</span>
            <span>Audio Help (आवाज से सुनें)</span>
          </button>
        </div>
      </div>

      {/* Appointment vs Walk-in Mode Selector */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          background: '#0f172a',
          padding: '8px',
          borderRadius: '16px',
          width: 'fit-content',
          border: '1px solid #1e293b',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('walkin')}
          style={{
            background: activeTab === 'walkin' ? '#0284c7' : 'transparent',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            padding: '10px 22px',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          🚶 Walk-In Registration (नई पर्ची)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('appointment')}
          style={{
            background: activeTab === 'appointment' ? '#0284c7' : 'transparent',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            padding: '10px 22px',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          📅 Check-in via Appointment / Mobile No.
        </button>
      </div>

      {/* Appointment Lookup Bar */}
      {activeTab === 'appointment' && (
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '20px',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          <form onSubmit={handleLookup} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
              placeholder="Enter Mobile No. or Unit ID (e.g. 9876543210 or ML-XXXX)"
              style={{
                flex: 1,
                background: '#020617',
                border: '1px solid #334155',
                color: '#fff',
                padding: '12px 16px',
                borderRadius: '12px',
                fontSize: '15px',
              }}
            />
            <button
              type="submit"
              disabled={lookupLoading}
              style={{
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '0 24px',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {lookupLoading ? 'Searching...' : 'Find Appointment 🔍'}
            </button>
          </form>

          {lookupFound && (
            <div style={{ marginTop: '12px', color: '#4ade80', fontSize: '13px', fontWeight: 700 }}>
              ✓ Verified Patient: {patientName} (Phone: {phone}) — Pre-filled below!
            </div>
          )}
        </div>
      )}

      {/* Live Voice Speech-to-Text Strip on Kiosk */}
      <div
        style={{
          background: isListening ? 'rgba(239, 68, 68, 0.15)' : '#1e293b',
          border: isListening ? '2px solid #ef4444' : '1px solid #334155',
          borderRadius: '18px',
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <button
            type="button"
            onClick={toggleListening}
            style={{
              background: isListening ? '#ef4444' : '#0284c7',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              width: '46px',
              height: '46px',
              fontSize: '20px',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              boxShadow: isListening ? '0 0 15px rgba(239, 68, 68, 0.6)' : 'none',
            }}
          >
            {isListening ? '⏹' : '🎙'}
          </button>
          <div>
            <strong style={{ fontSize: '14px', display: 'block' }}>
              {isListening ? 'Listening in Hindi / Regional Dialect...' : 'Speak Your Problem (बोलकर बताएं):'}
            </strong>
            <span style={{ fontSize: '13px', color: voiceText ? '#38bdf8' : '#94a3b8' }}>
              {voiceText ? `"${voiceText}"` : 'Click the microphone button and describe what hurts.'}
            </span>
          </div>
        </div>

        {voiceText && (
          <button
            type="button"
            onClick={() => setVoiceText('')}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}
          >
            Clear ✕
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="kiosk-grid">
          {/* Section 1: Anatomical SVG Body Map */}
          <section
            style={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '24px',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <span
                style={{
                  background: '#0284c7',
                  color: '#fff',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                }}
              >
                1
              </span>
              <h3 style={{ margin: 0, fontFamily: 'Manrope', fontSize: '18px' }}>
                Tap the Discomfort Area (दर्द की जगह छुएं)
              </h3>
            </div>

            <div
              style={{
                background: '#020617',
                border: '1px solid #1e293b',
                borderRadius: '18px',
                padding: '16px',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <svg viewBox="0 0 300 480" style={{ maxHeight: '380px', width: '100%' }}>
                {/* Head */}
                <circle
                  cx="150"
                  cy="50"
                  r="32"
                  onClick={() => toggleRegion('Head & Face')}
                  style={{
                    fill: selectedRegions.has('Head & Face') ? '#ef4444' : '#1e293b',
                    stroke: '#38bdf8',
                    strokeWidth: 2.5,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                />
                <text x="150" y="55" fill="#94a3b8" fontSize="12" fontWeight="700" textAnchor="middle" pointerEvents="none">
                  Head
                </text>

                {/* Neck */}
                <rect
                  x="138"
                  y="85"
                  width="24"
                  height="22"
                  rx="4"
                  onClick={() => toggleRegion('Throat & Neck')}
                  style={{
                    fill: selectedRegions.has('Throat & Neck') ? '#ef4444' : '#1e293b',
                    stroke: '#38bdf8',
                    strokeWidth: 2.5,
                    cursor: 'pointer',
                  }}
                />

                {/* Chest */}
                <path
                  d="M105,110 Q150,120 195,110 L190,175 Q150,185 110,175 Z"
                  onClick={() => toggleRegion('Chest & Lungs')}
                  style={{
                    fill: selectedRegions.has('Chest & Lungs') ? '#ef4444' : '#1e293b',
                    stroke: '#38bdf8',
                    strokeWidth: 2.5,
                    cursor: 'pointer',
                  }}
                />
                <text x="150" y="148" fill="#94a3b8" fontSize="12" fontWeight="700" textAnchor="middle" pointerEvents="none">
                  Chest
                </text>

                {/* Abdomen */}
                <path
                  d="M110,180 Q150,185 190,180 L185,250 Q150,260 115,250 Z"
                  onClick={() => toggleRegion('Stomach & Abdomen')}
                  style={{
                    fill: selectedRegions.has('Stomach & Abdomen') ? '#ef4444' : '#1e293b',
                    stroke: '#38bdf8',
                    strokeWidth: 2.5,
                    cursor: 'pointer',
                  }}
                />
                <text x="150" y="220" fill="#94a3b8" fontSize="12" fontWeight="700" textAnchor="middle" pointerEvents="none">
                  Stomach
                </text>

                {/* Arms */}
                <path
                  d="M98,115 L60,200 L75,210 L108,135 Z"
                  onClick={() => toggleRegion('Shoulders & Arms')}
                  style={{
                    fill: selectedRegions.has('Shoulders & Arms') ? '#ef4444' : '#1e293b',
                    stroke: '#38bdf8',
                    strokeWidth: 2.5,
                    cursor: 'pointer',
                  }}
                />
                <path
                  d="M202,115 L240,200 L225,210 L192,135 Z"
                  onClick={() => toggleRegion('Shoulders & Arms')}
                  style={{
                    fill: selectedRegions.has('Shoulders & Arms') ? '#ef4444' : '#1e293b',
                    stroke: '#38bdf8',
                    strokeWidth: 2.5,
                    cursor: 'pointer',
                  }}
                />

                {/* Pelvis */}
                <path
                  d="M115,255 Q150,265 185,255 L195,305 Q150,315 105,305 Z"
                  onClick={() => toggleRegion('Pelvis & Hips')}
                  style={{
                    fill: selectedRegions.has('Pelvis & Hips') ? '#ef4444' : '#1e293b',
                    stroke: '#38bdf8',
                    strokeWidth: 2.5,
                    cursor: 'pointer',
                  }}
                />

                {/* Legs */}
                <path
                  d="M110,310 L100,430 L130,430 L140,315 Z"
                  onClick={() => toggleRegion('Knees & Legs')}
                  style={{
                    fill: selectedRegions.has('Knees & Legs') ? '#ef4444' : '#1e293b',
                    stroke: '#38bdf8',
                    strokeWidth: 2.5,
                    cursor: 'pointer',
                  }}
                />
                <path
                  d="M190,310 L200,430 L170,430 L160,315 Z"
                  onClick={() => toggleRegion('Knees & Legs')}
                  style={{
                    fill: selectedRegions.has('Knees & Legs') ? '#ef4444' : '#1e293b',
                    stroke: '#38bdf8',
                    strokeWidth: 2.5,
                    cursor: 'pointer',
                  }}
                />
                <text x="150" y="380" fill="#94a3b8" fontSize="12" fontWeight="700" textAnchor="middle" pointerEvents="none">
                  Legs
                </text>
              </svg>
            </div>

            <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {Array.from(selectedRegions).map((reg) => (
                <span
                  key={reg}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    border: '1px solid #ef4444',
                    padding: '4px 12px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  ✓ {reg}
                </span>
              ))}
            </div>
          </section>

          {/* Section 2: Symptoms & Patient Info */}
          <section
            style={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '24px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                <span
                  style={{
                    background: '#0284c7',
                    color: '#fff',
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                  }}
                >
                  2
                </span>
                <h3 style={{ margin: 0, fontFamily: 'Manrope', fontSize: '18px' }}>
                  What Kind of Trouble? (कैसी तकलीफ है?)
                </h3>
              </div>

              {/* Symptom Cards Grid */}
              <div className="kiosk-symptom-grid">
                {[
                  { id: 'Fever / Burning Heat', emoji: '🌡️', title: 'Fever', sub: 'बुखार / जलन' },
                  { id: 'Severe Sharp Pain', emoji: '⚡', title: 'Sharp Pain', sub: 'तेज दर्द' },
                  { id: 'Cough / Breathlessness', emoji: '💨', title: 'Cough', sub: 'खांसी / सांस' },
                  { id: 'Nausea / Vomiting', emoji: '🤢', title: 'Vomiting', sub: 'उल्टी / मिचली' },
                  { id: 'Dizziness / Fatigue', emoji: '💫', title: 'Dizziness', sub: 'चक्कर / कमजोरी' },
                  { id: 'Joint Stiffness / Swelling', emoji: '🦴', title: 'Swelling', sub: 'सूजन' },
                ].map((s) => {
                  const active = selectedSymptoms.has(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleSymptom(s.id)}
                      style={{
                        background: active ? 'rgba(56, 189, 248, 0.15)' : '#020617',
                        border: active ? '2px solid #38bdf8' : '1px solid #1e293b',
                        borderRadius: '14px',
                        padding: '12px 8px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <span style={{ fontSize: '22px' }}>{s.emoji}</span>
                      <strong style={{ display: 'block', fontSize: '13px', margin: '4px 0 2px' }}>{s.title}</strong>
                      <small style={{ color: '#94a3b8', fontSize: '11px', display: 'block' }}>{s.sub}</small>
                    </div>
                  );
                })}
              </div>

              {/* Pain Scale */}
              <div style={{ marginBottom: '20px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
                  Pain Intensity (दर्द का स्तर):
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {[
                    { lvl: 1, label: 'Mild', emoji: '😊' },
                    { lvl: 2, label: 'Moderate', emoji: '😐' },
                    { lvl: 3, label: 'Severe', emoji: '😣' },
                    { lvl: 4, label: 'Extreme', emoji: '😭' },
                  ].map((p) => (
                    <button
                      key={p.lvl}
                      type="button"
                      onClick={() => setPainLevel(p.lvl)}
                      style={{
                        background: painLevel === p.lvl ? '#0284c7' : '#020617',
                        color: '#fff',
                        border: '1px solid #1e293b',
                        borderRadius: '12px',
                        padding: '8px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      <span style={{ fontSize: '18px', display: 'block' }}>{p.emoji}</span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Patient Basic Info */}
              <div className="kiosk-patient-info-grid" style={{ marginBottom: '16px' }}>
                <label>
                  <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                    Patient Name * (मरीज का नाम)
                  </span>
                  <input
                    type="text"
                    required
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="e.g. Suresh Kumar"
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', background: '#020617', border: '1px solid #334155', color: '#fff' }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                    Phone / Mobile
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile"
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', background: '#020617', border: '1px solid #334155', color: '#fff' }}
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                color: '#fff',
                border: 'none',
                padding: '16px',
                borderRadius: '14px',
                fontSize: '17px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.5)',
              }}
            >
              {loading ? 'Registering in PostgreSQL...' : '🎟 Generate OPD Queue Ticket (पर्ची निकालें)'}
            </button>
          </section>
        </div>
      </form>

      {/* OPD Ticket Slip Modal */}
      {ticketData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
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
              color: '#090e17',
              borderRadius: '24px',
              maxWidth: '460px',
              width: '100%',
              padding: '34px',
              textAlign: 'center',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
            }}
          >
            <span style={{ fontSize: '36px' }}>🎟️</span>
            <h2 style={{ fontFamily: 'Manrope', fontSize: '22px', margin: '8px 0 2px' }}>
              OPD Queue Slip (अस्पताल पर्ची)
            </h2>
            <small style={{ color: '#64748b' }}>Civil Hospital / Community Health Centre (CHC)</small>

            <div
              style={{
                fontSize: '34px',
                fontWeight: 900,
                color: '#0284c7',
                letterSpacing: '2px',
                margin: '18px 0',
                background: '#f0f9ff',
                padding: '12px',
                borderRadius: '14px',
                border: '2px dashed #0284c7',
              }}
            >
              {ticketData.tokenNumber || `OPD-${Date.now().toString().slice(-4)}`}
            </div>

            <div style={{ textAlign: 'left', background: '#f8fafc', padding: '14px', borderRadius: '12px', fontSize: '13px', lineHeight: 1.6 }}>
              <div><strong>Patient:</strong> {ticketData.patientName}</div>
              <div><strong>MediLocker Unit ID:</strong> {ticketData.medilockerId}</div>
              <div><strong>Complaint:</strong> {ticketData.complaint}</div>
              <div>
                <strong>Triage Status:</strong>{' '}
                <span
                  style={{
                    background: ticketData.triageCategory === 'RED' ? '#fee2e2' : '#dcfce7',
                    color: ticketData.triageCategory === 'RED' ? '#dc2626' : '#16a34a',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontWeight: 800,
                  }}
                >
                  {ticketData.triageCategory} {ticketData.triageCategory === 'RED' ? 'EMERGENCY' : 'ROUTINE'}
                </span>
              </div>
            </div>

            {/* Generated OPD Ticket QR Code with Kiosk Intake Payload */}
            <div style={{ marginTop: '16px', background: '#fff', padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div
                dangerouslySetInnerHTML={{
                  __html: generateQrSvg(generateKioskQrPayload(ticketData), { cellSize: 5, margin: 2 }),
                }}
                style={{ display: 'grid', placeItems: 'center' }}
              />
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, marginTop: '4px' }}>
                Scan at Doctor Desk / Emergency Triage ↗
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => window.print()}
                className="primary-btn"
                style={{ flex: 1, padding: '12px' }}
              >
                Print Slip 🖨
              </button>
              <button
                type="button"
                onClick={() => setTicketData(null)}
                className="secondary-btn"
                style={{ flex: 1, padding: '12px' }}
              >
                Done / Next Patient ↻
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
