import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import {
  speakInLanguage,
  getRecognitionLanguage,
  COMPANION_PROMPTS,
  SPEECH_LANG_MAP,
} from '../utils/speech';

export function Companion() {
  const { language, setLanguage, t } = useLanguage();
  const dialect = SPEECH_LANG_MAP[language]?.dialect || 'English';

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: COMPANION_PROMPTS[language]?.welcome || COMPANION_PROMPTS.en.welcome,
    },
  ]);
  const [input, setInput] = useState('');
  const [socrates, setSocrates] = useState({});
  const [isComplete, setIsComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  // Diagnostic Predictions
  const [predictions, setPredictions] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [vaultSaved, setVaultSaved] = useState(false);
  const [savingVault, setSavingVault] = useState(false);

  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);

  // Sync initial welcome message if language changed before user typed
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === 'assistant') {
        return [
          {
            role: 'assistant',
            content: COMPANION_PROMPTS[language]?.welcome || COMPANION_PROMPTS.en.welcome,
          },
        ];
      }
      return prev;
    });
  }, [language]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Speech Synthesis (AI Voice output in target language)
  const speakText = (text) => {
    if (!ttsEnabled) return;
    speakInLanguage(text, language);
  };

  // Web Speech API for speech-to-text
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Speech Recognition is not supported by this browser. Please type your message or use Chrome/Edge.');
      return;
    }

    const rec = new SpeechRec();
    rec.lang = getRecognitionLanguage(language);
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => setIsListening(true);
    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleSendMessage(transcript);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);

    recognitionRef.current = rec;
    rec.start();
  };

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    setInput('');
    const newMessages = [...messages, { role: 'user', content: query }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await api.voiceIntake({
        input: query,
        dialect,
        language,
        currentSocrates: socrates,
        history: newMessages.map((m) => ({ role: m.role, content: m.content })),
      });

      if (res?.data) {
        const reply = res.data.assistantReply || 'Clinical details recorded in sovereign vault.';
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
        speakText(reply);

        if (res.data.socrates) {
          const updatedSocrates = { ...socrates, ...res.data.socrates };
          setSocrates(updatedSocrates);
        }

        if (res.data.isComplete && !isComplete) {
          setIsComplete(true);
          // Auto-trigger diagnostic prediction after a brief moment
          setTimeout(async () => {
            setPredicting(true);
            try {
              const diagRes = await api.predictDiseases({
                socrates: res.data.socrates || socrates,
                language,
              });
              if (diagRes?.data) {
                setPredictions(diagRes.data);
                const completionMsgs = {
                  en: '✅ Diagnosis complete! Your results are ready on the right panel.',
                  hi: '✅ जांच पूरी हुई! आपके नतीजे दाईं ओर तैयार हैं।',
                  bn: '✅ নির্ণয় সম্পন্ন! আপনার ফলাফল ডান পাশে প্রস্তুত।',
                  mr: '✅ निदान पूर्ण! तुमचे निकाल उजव्या बाजूला तयार आहेत.',
                  te: '✅ రోగనిర్ధారణ పూర్తయింది! మీ ఫలితాలు కుడి వైపు సిద్ధంగా ఉన్నాయి.',
                  ta: '✅ நோயறிதல் முடிந்தது! உங்கள் முடிவுகள் வலப்பக்கத்தில் தயாராக உள்ளன.',
                  ur: '✅ تشخیص مکمل! آپ کے نتائج دائیں طرف تیار ہیں۔',
                };
                const completionMsg = completionMsgs[language] || completionMsgs.en;
                setMessages((prev) => [...prev, { role: 'assistant', content: completionMsg }]);
                speakText(completionMsg);
              }
            } catch (diagErr) {
              console.error('Auto-diagnosis error:', diagErr);
            } finally {
              setPredicting(false);
            }
          }, 1500);
        }
      }
    } catch (err) {
      const fallbackPrompt = COMPANION_PROMPTS[language]?.fallback || COMPANION_PROMPTS.en.fallback;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `• ${fallbackPrompt}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Run Disease Prediction Model
  const runDiagnosticPrediction = async () => {
    setPredicting(true);
    try {
      const res = await api.predictDiseases({
        socrates,
        language,
      });
      if (res?.data) {
        setPredictions(res.data);
      }
    } catch (err) {
      alert('Diagnostic model error: ' + err.message);
    } finally {
      setPredicting(false);
    }
  };

  const handleSaveToVault = async () => {
    setSavingVault(true);
    try {
      await api.saveIntakeToVault({
        socrates,
        predictedConditions: predictions?.predictedConditions || [],
        recommendedTests: predictions?.recommendedTests || [],
        patientExplanation: predictions?.patientExplanation || 'Voice Intake Consultation',
      });
      setVaultSaved(true);
    } catch (err) {
      alert('Vault save error: ' + err.message);
    } finally {
      setSavingVault(false);
    }
  };

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">MISTRAL CLINICAL AI PIPELINE</span>
          <h1>Medi-AI Voice & Clinical Intake.</h1>
          <p>Speech + text multilingual intake using the dynamic SOCRATES diagnostic framework and high-accuracy disease prediction.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={dialect}
            onChange={(e) => setDialect(e.target.value)}
            style={{
              padding: '10px 16px',
              borderRadius: '999px',
              border: '1px solid var(--line)',
              background: 'var(--white)',
              fontWeight: 700,
              color: 'var(--plum)',
            }}
          >
            <option>Hindi / Bhojpuri</option>
            <option>Hindi / Awadhi</option>
            <option>Bengali</option>
            <option>Marathi</option>
            <option>Punjabi</option>
            <option>Kannada</option>
            <option>Urdu</option>
            <option>English</option>
          </select>

          <button
            type="button"
            className="secondary-btn"
            onClick={() => setTtsEnabled(!ttsEnabled)}
            style={{ padding: '10px 16px', borderRadius: '999px' }}
          >
            {ttsEnabled ? '🔊 Voice On' : '🔇 Muted'}
          </button>
        </div>
      </div>

      <div className="companion-grid">
        {/* Chat & Audio Intake Window */}
        <div
          style={{
            background: 'var(--white)',
            border: '1px solid var(--line)',
            borderRadius: '24px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            height: '620px',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#16a34a' }}></span>
              <strong style={{ fontFamily: 'Manrope', fontSize: '16px' }}>Live Dialect Intake Officer</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--line)',
                  background: 'var(--cream)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: 'var(--ink)',
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
            </div>
          </div>

          {/* Messages scroll area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: m.role === 'user' ? 'var(--plum)' : 'var(--cream)',
                  color: m.role === 'user' ? '#fff' : 'var(--ink)',
                  borderRadius: '18px',
                  padding: '14px 18px',
                  fontSize: '15px',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  background: 'var(--cream)',
                  padding: '12px 16px',
                  borderRadius: '18px',
                  fontSize: '14px',
                  color: 'var(--muted)',
                }}
              >
                ⏳ {COMPANION_PROMPTS[language]?.analyzing || 'Medi-AI is listening and evaluating clinical symptoms...'}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input & Voice Controls */}
          {isComplete ? (
            <div style={{
              borderTop: '1px solid var(--line)',
              paddingTop: '16px',
              textAlign: 'center',
              background: 'linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%)',
              borderRadius: '14px',
              padding: '16px',
            }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#166534' }}>
                ✅ {language === 'hi' ? 'क्लीनिकल इनटेक पूरा हुआ' : language === 'bn' ? 'ক্লিনিকাল ইনটেক সম্পন্ন' : 'Clinical Intake Complete'}
              </div>
              <div style={{ fontSize: '13px', color: '#15803d', marginTop: '4px' }}>
                {predicting
                  ? (language === 'hi' ? '🔬 AI निदान मॉडल चल रहा है...' : '🔬 Running AI Diagnostic Model...')
                  : predictions
                    ? (language === 'hi' ? '📋 निदान तैयार है — दाईं ओर देखें' : '📋 Diagnosis ready — see right panel')
                    : (language === 'hi' ? '⏳ डायग्नोस्टिक्स शुरू हो रहा है...' : '⏳ Starting diagnostics...')}
              </div>
            </div>
          ) : (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px', display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={COMPANION_PROMPTS[language]?.placeholder || 'Type or speak your symptoms...'}
                style={{
                  flex: 1,
                  border: '1px solid var(--line)',
                  background: '#faf8f5',
                  borderRadius: '14px',
                  padding: '14px 18px',
                  fontSize: '15px',
                }}
              />

              <button
                type="button"
                onClick={toggleListening}
                style={{
                  background: isListening ? '#ef4444' : 'var(--peach)',
                  color: isListening ? '#fff' : 'var(--plum)',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '0 20px',
                  fontWeight: 800,
                  fontSize: '18px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {isListening ? '⏹ Stop' : '🎙 Speak'}
              </button>

              <button
                type="button"
                className="primary-btn"
                onClick={() => handleSendMessage()}
                disabled={loading || !input.trim()}
                style={{ borderRadius: '14px', padding: '0 20px' }}
              >
                Send ↗
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Dynamic SOCRATES Matrix & Disease Prediction */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* SOCRATES Matrix Card */}
          <div
            style={{
              background: 'var(--white)',
              border: '1px solid var(--line)',
              borderRadius: '24px',
              padding: '22px',
              boxShadow: 'var(--shadow)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="eyebrow">CLINICAL FRAMEWORK</span>
              <span
                style={{
                  background: isComplete ? 'var(--sage)' : 'var(--lav)',
                  color: isComplete ? '#2e6b35' : 'var(--plum)',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 800,
                }}
              >
                {isComplete ? 'Intake Complete' : 'Active Intake'}
              </span>
            </div>
            <h3 style={{ margin: '6px 0 8px', fontFamily: 'Manrope', fontSize: '18px' }}>
              SOCRATES Symptom Matrix
            </h3>

            {/* Completeness progress bar */}
            {(() => {
              const dims = ['site', 'onset', 'character', 'radiation', 'associations', 'timeCourse', 'exacerbatingRelieving', 'severity'];
              const filled = dims.filter((d) => {
                const v = socrates[d];
                if (!v) return false;
                if (typeof v === 'string' && (!v.trim() || v.toLowerCase() === 'null')) return false;
                if (Array.isArray(v) && v.length === 0) return false;
                return true;
              }).length;
              const pct = Math.round((filled / dims.length) * 100);
              return (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '4px' }}>
                    <span>{filled}/{dims.length} dimensions filled</span>
                    <span>{pct}%</span>
                  </div>
                  <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: pct >= 62.5 ? '#16a34a' : pct >= 37.5 ? '#f59e0b' : '#ef4444',
                      borderRadius: '999px',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
              <div style={{ background: '#faf8f5', padding: '8px 12px', borderRadius: '10px' }}>
                <span style={{ color: 'var(--muted)', display: 'block' }}>Site (Location):</span>
                <strong>{socrates.site || 'Pending...'}</strong>
              </div>
              <div style={{ background: '#faf8f5', padding: '8px 12px', borderRadius: '10px' }}>
                <span style={{ color: 'var(--muted)', display: 'block' }}>Onset:</span>
                <strong>{socrates.onset || 'Pending...'}</strong>
              </div>
              <div style={{ background: '#faf8f5', padding: '8px 12px', borderRadius: '10px' }}>
                <span style={{ color: 'var(--muted)', display: 'block' }}>Character:</span>
                <strong>{socrates.character || 'Pending...'}</strong>
              </div>
              <div style={{ background: '#faf8f5', padding: '8px 12px', borderRadius: '10px' }}>
                <span style={{ color: 'var(--muted)', display: 'block' }}>Radiation:</span>
                <strong>{socrates.radiation || 'None reported'}</strong>
              </div>
              <div style={{ background: '#faf8f5', padding: '8px 12px', borderRadius: '10px' }}>
                <span style={{ color: 'var(--muted)', display: 'block' }}>Associations:</span>
                <strong>{Array.isArray(socrates.associations) && socrates.associations.length > 0 ? socrates.associations.join(', ') : 'Pending...'}</strong>
              </div>
              <div style={{ background: '#faf8f5', padding: '8px 12px', borderRadius: '10px' }}>
                <span style={{ color: 'var(--muted)', display: 'block' }}>Time Course:</span>
                <strong>{socrates.timeCourse || 'Pending...'}</strong>
              </div>
              <div style={{ background: '#faf8f5', padding: '8px 12px', borderRadius: '10px' }}>
                <span style={{ color: 'var(--muted)', display: 'block' }}>Exacerbating/Relieving:</span>
                <strong>{socrates.exacerbatingRelieving || 'Pending...'}</strong>
              </div>
              <div style={{ background: '#faf8f5', padding: '8px 12px', borderRadius: '10px' }}>
                <span style={{ color: 'var(--muted)', display: 'block' }}>Severity:</span>
                <strong>{socrates.severity ? `${socrates.severity}/10` : 'Pending...'}</strong>
              </div>
            </div>

            <button
              className="primary-btn"
              type="button"
              onClick={runDiagnosticPrediction}
              disabled={predicting || Object.keys(socrates).length === 0}
              style={{ width: '100%', marginTop: '16px', padding: '12px' }}
            >
              {predicting
                ? '🔬 Running Mistral Disease Model...'
                : predictions
                  ? '✅ Diagnosis Complete — Re-run'
                  : isComplete
                    ? '⏳ Auto-Diagnosing...'
                    : 'Run Differential Diagnosis 🔬'}
            </button>
          </div>

          {/* Disease Prediction Results Card */}
          {predictions && (
            <div
              style={{
                background: 'var(--white)',
                border: '1px solid var(--line)',
                borderRadius: '24px',
                padding: '22px',
                boxShadow: 'var(--shadow)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="eyebrow" style={{ color: '#b45309' }}>DIFFERENTIAL DIAGNOSIS</span>
                <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700 }}>High Accuracy</span>
              </div>
              <h3 style={{ margin: '6px 0 12px', fontFamily: 'Manrope', fontSize: '18px' }}>
                Predicted Conditions & Tests Due
              </h3>

              <div style={{ display: 'grid', gap: '10px' }}>
                {predictions.predictedConditions?.map((cond, cIdx) => (
                  <div
                    key={cIdx}
                    style={{
                      background: '#fefce8',
                      border: '1px solid #fef08a',
                      borderRadius: '12px',
                      padding: '10px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong style={{ color: '#854d0e', fontSize: '14px' }}>{cond.conditionName}</strong>
                      <span style={{ fontSize: '11px', background: '#fef9c3', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>
                        {cond.icdCode || 'ICD-11'} · {cond.probability}
                      </span>
                    </div>
                    {cond.scientificRationale && (
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#713f12', lineHeight: 1.4 }}>
                        {cond.scientificRationale}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Recommended Tests */}
              {predictions.recommendedTests?.length > 0 && (
                <div style={{ marginTop: '14px' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--plum)', display: 'block', marginBottom: '6px' }}>
                    Recommended Diagnostic Investigations:
                  </strong>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {predictions.recommendedTests.map((t, tIdx) => (
                      <span
                        key={tIdx}
                        style={{
                          background: 'var(--sage)',
                          color: '#2d5a27',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        ⚗ {t.testName} ({t.urgency || 'Routine'})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Real DB Save to Sovereign Vault */}
              <div style={{ marginTop: '18px', borderTop: '1px solid var(--line)', paddingTop: '14px' }}>
                {vaultSaved ? (
                  <div style={{ color: '#16a34a', fontWeight: 800, fontSize: '14px', textAlign: 'center' }}>
                    ✓ Saved to Sovereign Vault & Scheduled in To-Do Reminders!
                  </div>
                ) : (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={handleSaveToVault}
                    disabled={savingVault}
                    style={{ width: '100%', padding: '12px', background: '#059669' }}
                  >
                    {savingVault ? 'Saving to Database...' : '💾 Save Intake & Tests to Sovereign Vault'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
