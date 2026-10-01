import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { useLanguage } from '../context/LanguageContext';

export function Landing() {
  const { t } = useLanguage();

  return (
    <>
      <Navbar isApp={false} />

      <main style={{ width: '100%', overflowX: 'hidden' }}>
        {/* Centered Hero Section */}
        <section
          className="hero"
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '75px 5.5% 60px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '36px'
          }}
        >
          {/* Centered Hero Copy */}
          <div style={{ maxWidth: '880px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              className="eyebrow"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(81, 66, 103, 0.08)',
                padding: '6px 16px',
                borderRadius: '999px',
                marginBottom: '16px'
              }}
            >
              <span className="eyebrow-dot" style={{ background: '#a68eb8', margin: 0 }}></span>
              <span>{t('eyebrow', 'A CALMER WAY TO MANAGE HEALTHCARE')}</span>
            </div>

            <h1 style={{ textAlign: 'center', margin: '12px 0 20px', letterSpacing: '-2.5px' }}>
              <span>{t('hero1', 'Your health story,')}</span>
              {' '}
              <em style={{ fontStyle: 'normal', color: 'var(--plum)' }}>{t('hero2', 'in one place.')}</em>
            </h1>

            <p
              className="hero-text"
              style={{
                textAlign: 'center',
                margin: '0 auto 28px',
                maxWidth: '740px',
                fontSize: '20px',
                lineHeight: 1.6
              }}
            >
              {t(
                'heroText',
                'MediLocker brings patient records, prescriptions, reports and medication routines into one beautifully organized digital experience.'
              )}
            </p>

            <div
              className="hero-buttons"
              style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '14px',
                margin: '10px 0 28px',
                width: '100%'
              }}
            >
              <Link
                className="primary-btn"
                to="/signup"
                style={{
                  padding: '14px 26px',
                  fontSize: '16px',
                  borderRadius: '16px',
                  whiteSpace: 'nowrap'
                }}
              >
                {t('enter', 'Enter MediLocker ↗')}
              </Link>
              <a
                href="tel:102"
                className="sos-btn sos-hero-btn"
                id="sosHeroBtn"
                aria-label="Emergency Ambulance Call 102"
                style={{
                  padding: '14px 24px',
                  fontSize: '16px',
                  borderRadius: '16px',
                  whiteSpace: 'nowrap'
                }}
              >
                <span className="sos-pulse-ring"></span>
                <span className="sos-icon">🚨</span>
                <span>{t('sosHero', 'Emergency SOS 102')}</span>
              </a>
            </div>

            <div
              className="patient-note"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '14px',
                marginTop: '12px'
              }}
            >
              <div className="mini-bubbles">
                <span>P</span>
                <span>D</span>
                <span>H</span>
              </div>
              <div style={{ textAlign: 'left' }}>
                <strong style={{ fontSize: '14px' }}>{t('designed', 'Designed around the patient')}</strong>
                <small style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  {t('records', 'Records stay organized from first visit to follow-up.')}
                </small>
              </div>
            </div>
          </div>

          {/* Centered Sovereign Overview Card */}
          <div
            className="health-card landing-card"
            style={{
              maxWidth: '960px',
              width: '100%',
              margin: '10px auto 0',
              textAlign: 'left',
              padding: '32px'
            }}
          >
            <div className="card-topline" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t('patientSpaceTitle', 'PATIENT SOVEREIGN SPACE')}</span>
              <span className="live-dot" style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ● <span>{t('secured', 'secured')}</span>
              </span>
            </div>
            <h2 style={{ fontSize: '26px', margin: '14px 0 20px', letterSpacing: '-0.5px' }}>
              {t('workspaceTitle', 'Unified Sovereign Health Workspace')}
            </h2>

            <div className="workspace-steps">
              <div className="workspace-step">
                <span>01</span>
                <div>
                  <strong>{t('step1Title', 'Unique Unit ID & Identity Isolation')}</strong>
                  <p>
                    {t(
                      'step1Text',
                      'Sign up to generate an ABHA-aligned ML-XXX-XXX identifier. One unique user per email address with zero cross-leakage.'
                    )}
                  </p>
                </div>
              </div>
              <div className="workspace-step">
                <span>02</span>
                <div>
                  <strong>{t('step2Title', 'Multimodal Clinical AI Pipelines')}</strong>
                  <p>
                    {t(
                      'step2Text',
                      'Upload prescriptions, speech intake, or lab tests. Mistral AI extracts diagnoses, predicted conditions, and clinical test schedules.'
                    )}
                  </p>
                </div>
              </div>
              <div className="workspace-step">
                <span>03</span>
                <div>
                  <strong>{t('step3Title', 'Time-Bound 6-Digit Doctor Access')}</strong>
                  <p>
                    {t(
                      'step3Text',
                      'Doctor searches by Unit ID (revealing only Name & DOB). Patient generates a 15-min passcode to unlock records for 30m–7d.'
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="landing-card-footer" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '22px' }}>
              <span>{t('badgeAbha', 'ABHA Aligned')}</span>
              <span>{t('badgeRealtime', 'Real-Time Sync')}</span>
              <span>{t('badgeOtp', 'Time-Bound OTP')}</span>
              <span>{t('badgeMistral', 'Mistral Guardrails')}</span>
            </div>
          </div>
        </section>

        {/* Key Metrics & Trust Strip */}
        <section className="trust-strip">
          <div className="trust-item">
            <div className="trust-icon">🛡️</div>
            <div>
              <strong>{t('trust1Title', '100% Patient Control')}</strong>
              <small>{t('trust1Desc', 'Instant 1-click access revocation')}</small>
            </div>
          </div>
          <div className="trust-item">
            <div className="trust-icon" style={{ background: 'var(--sage)', color: '#465743' }}>
              ⚡
            </div>
            <div>
              <strong>{t('trust2Title', 'ACID Database Engine')}</strong>
              <small>{t('trust2Desc', 'Enterprise PostgreSQL storage')}</small>
            </div>
          </div>
          <div className="trust-item">
            <div className="trust-icon" style={{ background: 'var(--peach)', color: '#704e38' }}>
              🔑
            </div>
            <div>
              <strong>{t('trust3Title', '15-Min Dynamic OTP')}</strong>
              <small>{t('trust3Desc', '6-digit code for clinical access')}</small>
            </div>
          </div>
          <div className="trust-item">
            <div className="trust-icon" style={{ background: '#e0d8e8', color: '#3a284c' }}>
              🔒
            </div>
            <div>
              <strong>{t('trust4Title', 'Zero PHI Search Leak')}</strong>
              <small>{t('trust4Desc', 'Only Name & DOB on provider search')}</small>
            </div>
          </div>
        </section>

        {/* Complete Coordinated Features Suite */}
        <section className="features-detailed-section" id="features">
          <div className="section-heading" style={{ textAlign: 'center', maxWidth: '850px', margin: '0 auto 40px' }}>
            <span
              className="eyebrow"
              style={{
                display: 'inline-block',
                background: 'rgba(81, 66, 103, 0.08)',
                padding: '4px 14px',
                borderRadius: '999px',
                marginBottom: '10px'
              }}
            >
              {t('featuresEyebrow', 'SOVEREIGN HEALTH ARCHITECTURE')}
            </span>
            <h2 style={{ fontSize: 'clamp(32px, 3.8vw, 48px)', margin: '8px 0 14px', letterSpacing: '-1.5px' }}>
              {t('featuresTitle', 'Engineered for Complete Clinical Continuity.')}
            </h2>
            <p style={{ fontSize: '18px', color: 'var(--muted)', margin: '0 auto', maxWidth: '720px' }}>
              {t(
                'featuresSubtitle',
                'A coordinated digital ecosystem bridging patients, attending physicians, and emergency hospital networks in real time.'
              )}
            </p>
          </div>

          <div
            className="features-columns-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
              maxWidth: '1280px',
              margin: '0 auto'
            }}
          >
            {/* Feature Column 1: Patient Sovereign Vault */}
            <article className="feature-column-card">
              <div>
                <div className="card-topline" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{t('patientVaultHeader', 'PATIENT HEALTH VAULT')}</span>
                  <span className="live-dot" style={{ color: '#16a34a' }}>
                    ● {t('featVaultLive', 'Live & Encrypted')}
                  </span>
                </div>
                <h3 style={{ fontSize: '22px', margin: '14px 0 18px', letterSpacing: '-0.5px' }}>
                  {t('featVaultTitle', 'Sovereign Health Vault & Ongoing Care')}
                </h3>

                <div className="workspace-steps">
                  <div className="workspace-step">
                    <span>01</span>
                    <div>
                      <strong>{t('featVaultS1Title', 'Consultation Date & Course Tracking')}</strong>
                      <p>
                        {t(
                          'featVaultS1Text',
                          'Upload prescriptions and lab records with the verified clinical consultation date. Ongoing medications stay active while completed courses archive cleanly.'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="workspace-step">
                    <span>02</span>
                    <div>
                      <strong>{t('featVaultS2Title', 'Prescriptions & Diagnostics Inline Viewer')}</strong>
                      <p>
                        {t(
                          'featVaultS2Text',
                          'Securely review uploaded medical records via authenticated inline viewer with instant MIME-typed streaming and zero data leakage.'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="workspace-step">
                    <span>03</span>
                    <div>
                      <strong>{t('featVaultS3Title', 'Smart 12 AM Reset & 2-Day Refill Prediction')}</strong>
                      <p>
                        {t(
                          'featVaultS3Text',
                          'Checklist renewal across Morning, Afternoon, and Night slots, paired with automated predictive warnings 2 days before medication stock runs out.'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="landing-card-footer">
                <span>{t('todoPage', 'Medication To-Do')}</span>
                <span>{t('inventoryPage', 'Medicine Cabinet')}</span>
                <span>{t('timelinePage', 'Health Timeline')}</span>
                <span>{t('aiCompanionPage', 'Medi-AI')}</span>
              </div>
            </article>

            {/* Feature Column 2: Doctor Clinical Suite */}
            <article className="feature-column-card">
              <div>
                <div className="card-topline" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{t('doctorSuiteHeader', 'DOCTOR CLINICAL SUITE')}</span>
                  <span className="live-dot" style={{ color: '#b45309' }}>
                    ● {t('featDoctorLive', 'Verified Practitioners')}
                  </span>
                </div>
                <h3 style={{ fontSize: '22px', margin: '14px 0 18px', letterSpacing: '-0.5px' }}>
                  {t('featDoctorTitle', 'Doctor Clinical Suite & Rapid Triage')}
                </h3>

                <div className="workspace-steps">
                  <div className="workspace-step">
                    <span>01</span>
                    <div>
                      <strong>{t('featDoctorS1Title', 'Zero PHI Unit ID Search & OTP Unlock')}</strong>
                      <p>
                        {t(
                          'featDoctorS1Text',
                          'Search patient profiles strictly by Unit ID revealing only Name and DOB until the patient grants a 15-minute 6-digit OTP passcode.'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="workspace-step">
                    <span>02</span>
                    <div>
                      <strong>{t('featDoctorS2Title', 'Vaidya 30s Rapid OPD Synthesis')}</strong>
                      <p>
                        {t(
                          'featDoctorS2Text',
                          'Instant 30-second patient chart briefing with dual NAMASTE + WHO ICD-11 Chapter 26 terminology and HL7 FHIR export.'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="workspace-step">
                    <span>03</span>
                    <div>
                      <strong>{t('featDoctorS3Title', 'Directory & Geographic Practice Matching')}</strong>
                      <p>
                        {t(
                          'featDoctorS3Text',
                          'Explore verified practitioners filtered by \'Previously Consulted\' and \'In Your Area\' local geographic matching.'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="landing-card-footer">
                <span>{t('vaidyaPage', 'Vaidya 30s Chart')}</span>
                <span>NAMASTE Standard</span>
                <span>WHO ICD-11</span>
                <span>HL7 FHIR R4</span>
              </div>
            </article>

            {/* Feature Column 3: Hospital & Emergency Network */}
            <article className="feature-column-card">
              <div>
                <div className="card-topline" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{t('hospitalHeader', 'HOSPITAL & EMERGENCY')}</span>
                  <span className="live-dot" style={{ color: '#0284c7' }}>
                    ● {t('featHospLive', 'Emergency Ready')}
                  </span>
                </div>
                <h3 style={{ fontSize: '22px', margin: '14px 0 18px', letterSpacing: '-0.5px' }}>
                  {t('featHospTitle', 'Hospital Emergency & Touch Kiosks')}
                </h3>

                <div className="workspace-steps">
                  <div className="workspace-step">
                    <span>01</span>
                    <div>
                      <strong>{t('featHospS1Title', 'Emergency 1-Second QR Profile Scanner')}</strong>
                      <p>
                        {t(
                          'featHospS1Text',
                          'Instant scanning of patient sovereign QR code gives emergency staff critical allergies, blood group, and emergency contact in under 1 second.'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="workspace-step">
                    <span>02</span>
                    <div>
                      <strong>{t('featHospS2Title', 'OPD Walk-In Touch Kiosk with Regional Voice')}</strong>
                      <p>
                        {t(
                          'featHospS2Text',
                          'Interactive anatomical body map with vernacular audio prompts generating instant queue tickets and sovereign vault files.'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="workspace-step">
                    <span>03</span>
                    <div>
                      <strong>{t('featHospS3Title', 'Ambulance SOS 102 & Immutable Audit Trail')}</strong>
                      <p>
                        {t(
                          'featHospS3Text',
                          '1-tap emergency dispatch paired with tamper-proof cryptographic audit logs tracking all access events.'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="landing-card-footer">
                <span>{t('scannerPage', 'QR Scanner')}</span>
                <span>{t('kioskPage', 'Touch Kiosk')}</span>
                <span>Ambulance 102</span>
                <span>Audit Logs</span>
              </div>
            </article>
          </div>
        </section>

        {/* Portals Section */}
        <section className="portals-section" id="portals">
          <div className="section-heading" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 40px' }}>
            <span className="eyebrow">{t('access', 'ACCESS PORTALS')}</span>
            <h2 style={{ letterSpacing: '-1.5px', margin: '10px 0 14px' }}>
              {t('choosePortal', 'Choose your care portal.')}
            </h2>
            <p style={{ color: '#c5bdca', fontSize: '18px' }}>
              {t(
                'portalText',
                'Every role gets a focused experience, while the patient\'s medical story remains at the center.'
              )}
            </p>
          </div>

          <div className="portal-grid" style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <Link className="portal-card patient" to="/login?role=patient">
              <span className="portal-icon">♡</span>
              <div>
                <span>{t('patientPortal', 'Patient Portal')}</span>
                <small>{t('patientPortalDesc', 'Manage records, daily to-dos, cabinet inventory, and OTP delegations.')}</small>
              </div>
              <b>↗</b>
            </Link>

            <Link className="portal-card doctor" to="/login?role=doctor">
              <span className="portal-icon">✚</span>
              <div>
                <span>{t('doctorPortal', 'Doctor Portal')}</span>
                <small>{t('doctorPortalDesc', 'Search patients by Unit ID, review verified history, and conduct Vaidya OPD triage.')}</small>
              </div>
              <b>↗</b>
            </Link>

            <Link className="portal-card hospital" to="/login?role=hospital">
              <span className="portal-icon">▦</span>
              <div>
                <span>{t('hospitalPortal', 'Hospital Portal')}</span>
                <small>{t('hospitalPortalDesc', 'Institutional patient records coordination, staff allocations, and audit oversight.')}</small>
              </div>
              <b>↗</b>
            </Link>
          </div>
        </section>
      </main>

      <footer style={{ maxWidth: '1320px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img
            src="/logo-icon.png"
            alt="MediLocker"
            style={{ height: '42px', width: 'auto', borderRadius: '10px', objectFit: 'contain', flexShrink: 0 }}
          />
          <div>
            <strong>MediLocker</strong> · <span>{t('footer', 'A sovereign digital sanctuary for organized healthcare.')}</span>
            <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.7 }}>
              {t('footerSub', 'Aligned with Ayushman Bharat Digital Mission (ABDM) architectural standards. Powered by live PostgreSQL.')}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Link to="/login" style={{ color: 'var(--plum)', fontWeight: 700 }}>
            {t('signIn', 'Sign in')}
          </Link>
          <Link to="/signup" style={{ color: 'var(--plum)', fontWeight: 700 }}>
            {t('signUp', 'Create Sovereign Account')}
          </Link>
        </div>
      </footer>
    </>
  );
}
