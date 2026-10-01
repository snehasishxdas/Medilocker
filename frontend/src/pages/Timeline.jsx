import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export function Timeline() {
  const [events, setEvents] = useState([]);
  const [feelings, setFeelings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTimeline() {
      try {
        setLoading(true);
        const timelineRes = await api.getTimeline();
        if (timelineRes?.data) {
          const rawData = timelineRes.data;
          const eventsList = Array.isArray(rawData)
            ? rawData
            : Array.isArray(rawData.timeline)
            ? rawData.timeline
            : [];
          setEvents(eventsList);

          const feelingsList = Array.isArray(rawData.symptomSynopsis)
            ? rawData.symptomSynopsis
            : [];
          setFeelings(feelingsList);
        }
      } catch (err) {
        console.error('Error loading timeline:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTimeline();
  }, []);

  const getHeatClass = (score) => {
    if (score === 1) return 'green';
    if (score === 2) return 'orange';
    if (score === 3 || score >= 4) return 'red';
    return 'empty';
  };

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">CHRONOLOGICAL HEALTH STORY</span>
          <h1>Clinical Timeline.</h1>
          <p>Every consultation, prescription, and biometric feeling logged in strict chronological order with live DB synchronization.</p>
        </div>
      </div>

      {/* 14-Day Feeling Heat Strip */}
      <div className="feeling-box">
        <span className="eyebrow">RECENT BIOMETRIC TREND</span>
        <h3 style={{ margin: '6px 0 10px', fontFamily: 'Manrope', fontSize: '18px' }}>
          Daily Symptom Adherence Strip (Past 14 Days)
        </h3>

        {feelings.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '14px', margin: 0 }}>
            No daily check-ins logged recently. Log your feelings on the Dashboard to build your biometric trend!
          </p>
        ) : (
          <div className="timeline-heat-strip">
            {feelings.slice(-14).map((f, i) => (
              <div key={i} className="heat-day">
                <div className={`heat-dot ${getHeatClass(f.feelingScore)}`} title={`Score: ${f.feelingScore} on ${f.date || f.logDate}`}>
                  {f.feelingScore === 1 ? '✓' : f.feelingScore === 2 ? '!' : '✕'}
                </div>
                <span className="heat-label">
                  {typeof f.date === 'string' ? f.date.slice(5) : typeof f.logDate === 'string' ? f.logDate.slice(5) : `D${i + 1}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline Events List */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
          Loading chronological timeline...
        </div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <h2>No clinical events recorded yet.</h2>
          <p>Your timeline populates automatically when you upload a prescription, laboratory report, or complete an OPD intake.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {events.map((ev) => {
            const dateRaw = ev.eventDateDdmmyyyy || '';
            const day = dateRaw.length === 8 ? dateRaw.slice(0, 2) : '01';
            const month = dateRaw.length === 8 ? dateRaw.slice(2, 4) : '01';
            const year = dateRaw.length === 8 ? dateRaw.slice(4) : '2026';
            const recordId = ev.sourceDocument?.id || ev.medicalRecord?.id || ev.recordId;
            const meds = ev.prescribedMedications || ev.prescribedMeds || [];

            return (
              <article key={ev.id} className="timeline-card">
                <div className="timeline-date">
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--plum)' }}>{month}/{year}</span>
                  <strong style={{ fontSize: '26px', fontFamily: 'Manrope', margin: '2px 0' }}>{day}</strong>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>VISIT</span>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1px', color: 'var(--muted)' }}>
                        {ev.clinicName || 'Digital Clinical Vault'}
                      </span>
                      <h3 style={{ margin: '4px 0 8px', fontFamily: 'Manrope', fontSize: '20px' }}>
                        {ev.doctorName || 'Attending Physician'}
                      </h3>
                    </div>
                    {recordId && (
                      <a
                        href={api.getRecordViewUrl(recordId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="view-btn"
                        style={{ fontSize: '13px', padding: '6px 14px' }}
                      >
                        View File ↗
                      </a>
                    )}
                  </div>

                  {/* Diagnoses Pills */}
                  {Array.isArray(ev.diagnoses) && ev.diagnoses.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '8px 0' }}>
                      {ev.diagnoses.map((d, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: 'var(--lav)',
                            color: 'var(--plum)',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '12px',
                            fontWeight: 700,
                          }}
                        >
                          {typeof d === 'string' ? d : d.name || JSON.stringify(d)}
                        </span>
                      ))}
                    </div>
                  )}

                  {ev.clinicalSummary && (
                    <p style={{ margin: '8px 0', fontSize: '14px', color: 'var(--muted)', lineHeight: 1.5 }}>
                      {ev.clinicalSummary}
                    </p>
                  )}

                  {/* Prescribed Medications list if any */}
                  {Array.isArray(meds) && meds.length > 0 && (
                    <div style={{ marginTop: '12px', borderTop: '1px solid var(--line)', paddingTop: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--plum)' }}>
                        Prescribed Medicines ({meds.length}):
                      </span>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                        {meds.map((med, mIdx) => (
                          <span
                            key={mIdx}
                            style={{
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '8px',
                              padding: '4px 10px',
                              fontSize: '13px',
                              fontWeight: 600,
                            }}
                          >
                            💊 {med.medicineName} {med.dosage ? `(${med.dosage})` : ''} {med.frequency ? `· ${med.frequency}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
