/**
 * MediLocker Low-Literacy & Elderly OPD Kiosk Engine (SIH26047)
 * - Touchscreen visual interactive human anatomical body-map
 * - Pictorial symptom cards for non-reading patients
 * - Voice prompt audio guidance in regional dialects
 * - Visual Wong-Baker style FACES pain scale
 * - 100% offline edge intake support
 */

import { api } from '../core/api.js';
import { db } from '../core/db.js';
import { events } from '../core/events.js';

export class KioskModule {
  constructor(containerId = 'kioskAppContainer') {
    this.container = document.getElementById(containerId);
    this.selectedRegions = new Set();
    this.selectedSymptoms = new Set();
    this.selectedPainScale = 2; // Default moderate
    this.activeLanguage = 'hi';
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="kiosk-layout">
        <!-- Top Banner with Audio Prompt Guidance -->
        <header class="kiosk-header">
          <div class="kiosk-brand">
            <span class="kiosk-logo">🏥</span>
            <div>
              <h1>OPD Touchscreen Intake Kiosk</h1>
              <p>अस्पताल पर्ची कियोस्क · Tap where it hurts (जहाँ दर्द या परेशानी है वहाँ छुएं)</p>
            </div>
          </div>
          <div class="kiosk-audio-bar">
            <button type="button" class="kiosk-audio-btn" id="kioskAudioGuideBtn">
              <span class="speaker-icon">🔊</span>
              <span>Audio Guidance (आवाज से सुनें)</span>
            </button>
            <div class="kiosk-step-pill">Step <span id="kioskStepNum">1</span> of 3</div>
          </div>
        </header>

        <!-- Main Kiosk Body -->
        <div class="kiosk-grid">
          <!-- Left: Anatomical Body Map -->
          <section class="kiosk-card body-map-section">
            <div class="section-title">
              <span class="num-badge">1</span>
              <h3>Tap the Discomfort Area (दर्द वाली जगह छुएं)</h3>
            </div>
            
            <div class="body-map-container">
              <!-- Responsive SVG Body Silhouette -->
              <svg viewBox="0 0 300 480" class="human-body-svg" id="humanBodySvg">
                <!-- Head -->
                <circle cx="150" cy="50" r="32" class="body-zone" data-region="Head & Face" id="zoneHead" />
                <text x="150" y="55" class="svg-label">Head</text>

                <!-- Neck/Throat -->
                <rect x="138" y="85" width="24" height="22" rx="4" class="body-zone" data-region="Throat & Neck" id="zoneNeck" />

                <!-- Chest -->
                <path d="M105,110 Q150,120 195,110 L190,175 Q150,185 110,175 Z" class="body-zone" data-region="Chest & Lungs" id="zoneChest" />
                <text x="150" y="148" class="svg-label">Chest</text>

                <!-- Abdomen -->
                <path d="M110,180 Q150,185 190,180 L185,250 Q150,260 115,250 Z" class="body-zone" data-region="Stomach & Abdomen" id="zoneAbdomen" />
                <text x="150" y="220" class="svg-label">Stomach</text>

                <!-- Spine / Back Toggle Button -->
                <g class="body-zone" data-region="Spine & Lower Back" id="zoneBack">
                  <rect x="135" y="180" width="30" height="70" rx="6" fill="rgba(255,255,255,0.2)" />
                </g>

                <!-- Upper Limbs (Arms/Shoulders) -->
                <path d="M98,115 L60,200 L75,210 L108,135 Z" class="body-zone" data-region="Shoulders & Arms" id="zoneArmLeft" />
                <path d="M202,115 L240,200 L225,210 L192,135 Z" class="body-zone" data-region="Shoulders & Arms" id="zoneArmRight" />

                <!-- Pelvis & Hip -->
                <path d="M115,255 Q150,265 185,255 L195,305 Q150,315 105,305 Z" class="body-zone" data-region="Pelvis & Hips" id="zonePelvis" />

                <!-- Knees & Legs -->
                <path d="M110,310 L100,430 L130,430 L140,315 Z" class="body-zone" data-region="Knees & Legs" id="zoneLegLeft" />
                <path d="M190,310 L200,430 L170,430 L160,315 Z" class="body-zone" data-region="Knees & Legs" id="zoneLegRight" />
                <text x="150" y="380" class="svg-label">Legs/Knees</text>
              </svg>
            </div>

            <div class="selected-regions-chips" id="selectedRegionsChips">
              <span class="no-selection-hint">Tap any part above (ऊपर शरीर के अंग पर टच करें)</span>
            </div>
          </section>

          <!-- Right: Visual Icon Symptoms & Pain Scale -->
          <section class="kiosk-card symptoms-section">
            <div class="section-title">
              <span class="num-badge">2</span>
              <h3>What Kind of Trouble? (कैसी तकलीफ है?)</h3>
            </div>

            <div class="visual-symptoms-grid" id="visualSymptomsGrid">
              <button type="button" class="symptom-card" data-symptom="Fever / Burning Heat">
                <span class="symptom-emoji">🌡️</span>
                <strong>Fever / Heat</strong>
                <small>बुखार / तेज जलन</small>
              </button>

              <button type="button" class="symptom-card" data-symptom="Severe Sharp Pain">
                <span class="symptom-emoji">⚡</span>
                <strong>Sharp Pain</strong>
                <small>तीखा तेज दर्द</small>
              </button>

              <button type="button" class="symptom-card" data-symptom="Cough / Breathlessness">
                <span class="symptom-emoji">💨</span>
                <strong>Cough / Gas</strong>
                <small>खांसी / सांस फूलना</small>
              </button>

              <button type="button" class="symptom-card" data-symptom="Nausea / Vomiting">
                <span class="symptom-emoji">🤢</span>
                <strong>Vomiting</strong>
                <small>उल्टी / मिचली</small>
              </button>

              <button type="button" class="symptom-card" data-symptom="Dizziness / Fatigue">
                <span class="symptom-emoji">💫</span>
                <strong>Dizziness</strong>
                <small>चक्कर / कमजोरी</small>
              </button>

              <button type="button" class="symptom-card" data-symptom="Joint Stiffness / Swelling">
                <span class="symptom-emoji">🦴</span>
                <strong>Joint Swelling</strong>
                <small>जोड़ों में सूजन</small>
              </button>
            </div>

            <!-- Visual FACES Pain Scale -->
            <div class="pain-scale-container">
              <h4>Pain Intensity (दर्द कितना तेज है?):</h4>
              <div class="pain-faces-row">
                <button type="button" class="pain-face-btn" data-level="1">
                  <span class="face-emoji">😊</span>
                  <span>1 · Mild</span>
                </button>
                <button type="button" class="pain-face-btn active" data-level="2">
                  <span class="face-emoji">😐</span>
                  <span>2 · Discomfort</span>
                </button>
                <button type="button" class="pain-face-btn" data-level="3">
                  <span class="face-emoji">🙁</span>
                  <span>3 · Painful</span>
                </button>
                <button type="button" class="pain-face-btn" data-level="4">
                  <span class="face-emoji">😣</span>
                  <span>4 · Severe</span>
                </button>
                <button type="button" class="pain-face-btn danger" data-level="5">
                  <span class="face-emoji">😭</span>
                  <span>5 · Unbearable</span>
                </button>
              </div>
            </div>

            <!-- Generate Intake Ticket Button -->
            <div class="kiosk-submit-row">
              <button type="button" class="kiosk-submit-btn" id="generateKioskSlipBtn">
                <span>Print OPD Intake Slip (पर्ची निकालें) 🖨️</span>
              </button>
            </div>
          </section>
        </div>

        <!-- Generated Ticket Modal -->
        <div class="kiosk-modal-backdrop hidden" id="kioskTicketModal">
          <div class="kiosk-ticket-slip" id="kioskPrintableSlip">
            <div class="ticket-header">
              <h3>AYUSH DIGITAL OPD CLINIC</h3>
              <p>Government of India Digital Health Mission</p>
              <div class="ticket-number" id="ticketNumberDisplay">OPD-K-8421</div>
            </div>

            <div class="ticket-body">
              <div class="ticket-row">
                <span>Priority Triage:</span>
                <strong id="ticketPriorityDisplay" class="priority-tag">ROUTINE</strong>
              </div>
              <div class="ticket-row">
                <span>Chief Symptoms:</span>
                <strong id="ticketSymptomsDisplay">—</strong>
              </div>
              <div class="ticket-row">
                <span>Affected Regions:</span>
                <strong id="ticketRegionsDisplay">—</strong>
              </div>
              <div class="ticket-row">
                <span>Pain Rating:</span>
                <strong id="ticketPainDisplay">2 / 5</strong>
              </div>
              <div class="ticket-row">
                <span>Standard Dual Code:</span>
                <strong id="ticketCodeDisplay">NAMASTE Classification Active</strong>
              </div>
            </div>

            <div class="ticket-barcode">
              <div class="barcode-lines">||| | |||| || | ||||| || ||| ||||</div>
              <small>Show this ticket to the consulting Vaidya / Medical Officer</small>
            </div>

            <div class="ticket-actions">
              <button type="button" class="primary-btn" onclick="window.print()">Print Ticket (प्रिंट करें) 🖨</button>
              <button type="button" class="secondary-btn" id="closeKioskTicketBtn">Next Patient (अगला मरीज) ↻</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.playAudioInstruction('body_tap');
  }

  bindEvents() {
    // 1. Body Map Clicks
    events.bindAll('kiosk:bodyZone', '.body-zone', 'click', (el) => () => {
      const region = el.dataset.region;
      if (this.selectedRegions.has(region)) {
        this.selectedRegions.delete(region);
        el.classList.remove('selected');
      } else {
        this.selectedRegions.add(region);
        el.classList.add('selected');
      }
      this.updateRegionChips();
    });

    // 2. Symptom Card Clicks
    events.bindAll('kiosk:symptom', '.symptom-card', 'click', (el) => () => {
      const symptom = el.dataset.symptom;
      if (this.selectedSymptoms.has(symptom)) {
        this.selectedSymptoms.delete(symptom);
        el.classList.remove('active');
      } else {
        this.selectedSymptoms.add(symptom);
        el.classList.add('active');
      }
    });

    // 3. Pain Scale Selection
    events.bindAll('kiosk:pain', '.pain-face-btn', 'click', (el) => () => {
      document.querySelectorAll('.pain-face-btn').forEach((b) => b.classList.remove('active'));
      el.classList.add('active');
      this.selectedPainScale = Number(el.dataset.level) || 2;
    });

    // 4. Audio Guide Button
    events.bind('kiosk:audioGuide', '#kioskAudioGuideBtn', 'click', () => {
      this.playAudioInstruction('full');
    });

    // 5. Generate Ticket
    events.bind('kiosk:submit', '#generateKioskSlipBtn', 'click', () => this.generateTicket());

    // 6. Close Modal / Reset for Next Patient
    events.bind('kiosk:closeModal', '#closeKioskTicketBtn', 'click', () => {
      const modal = document.getElementById('kioskTicketModal');
      if (modal) modal.classList.add('hidden');
      this.resetKiosk();
    });
  }

  updateRegionChips() {
    const container = document.getElementById('selectedRegionsChips');
    if (!container) return;

    if (this.selectedRegions.size === 0) {
      container.innerHTML = '<span class="no-selection-hint">Tap any part above (ऊपर शरीर के अंग पर टच करें)</span>';
      return;
    }

    container.innerHTML = Array.from(this.selectedRegions)
      .map((r) => `<span class="kiosk-chip">📍 ${r}</span>`)
      .join(' ');
  }

  playAudioInstruction(type) {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        const text =
          type === 'body_tap'
            ? 'शरीर के जिस हिस्से में दर्द या परेशानी है, स्क्रीन पर वहाँ छुएं।'
            : 'कृपया स्क्रीन पर छूकर बताएं कि आपको शरीर में कहाँ दर्द है और किस तरह की तकलीफ है। फिर पर्ची निकालें बटन दबाएं।';
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'hi-IN';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
      } catch (_) {}
    }
  }

  async generateTicket() {
    if (this.selectedRegions.size === 0) {
      alert('कृपया शरीर के उस अंग पर टच करें जहाँ दर्द या तकलीफ है। (Please select where it hurts on the body map)');
      return;
    }

    if (this.selectedSymptoms.size === 0) {
      alert('कृपया अपनी तकलीफ का निशान चुनें। (Please tap at least one symptom icon)');
      return;
    }

    const payload = {
      bodyRegions: Array.from(this.selectedRegions),
      symptoms: Array.from(this.selectedSymptoms),
      painScale: this.selectedPainScale,
      dialect: 'hi',
    };

    const submitBtn = document.getElementById('generateKioskSlipBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Generating OPD Ticket (पर्ची बन रही है)...';
    }

    try {
      // Send to API or store offline
      const res = await api.post('/api/v1/kiosk/intake', payload);
      const data = res.data;

      const ticketNum = data?.ticketNumber || `OPD-K-${Math.floor(1000 + Math.random() * 9000)}`;
      const priority = data?.priorityTriage || (this.selectedPainScale >= 4 ? 'HIGH / URGENT' : 'ROUTINE');

      // Populate Modal
      const modal = document.getElementById('kioskTicketModal');
      const numEl = document.getElementById('ticketNumberDisplay');
      const prioEl = document.getElementById('ticketPriorityDisplay');
      const symEl = document.getElementById('ticketSymptomsDisplay');
      const regEl = document.getElementById('ticketRegionsDisplay');
      const painEl = document.getElementById('ticketPainDisplay');

      if (numEl) numEl.textContent = ticketNum;
      if (prioEl) {
        prioEl.textContent = priority;
        prioEl.className = `priority-tag ${priority.includes('HIGH') ? 'urgent' : 'routine'}`;
      }
      if (symEl) symEl.textContent = payload.symptoms.join(', ');
      if (regEl) regEl.textContent = payload.bodyRegions.join(', ');
      if (painEl) painEl.textContent = `${payload.painScale} / 5`;

      if (modal) modal.classList.remove('hidden');

      // Play audio confirmation
      if (window.speechSynthesis) {
        const confirmText = `आपकी ओपीडी पर्ची नंबर ${ticketNum} तैयार है। कृपया परामर्श कक्ष में जाएं।`;
        const utterance = new SpeechSynthesisUtterance(confirmText);
        utterance.lang = 'hi-IN';
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.warn('[Kiosk] Offline fallback saving to IndexedDB:', err);
      // Save locally to IndexedDB
      const ticketNum = `OPD-OFFLINE-${Date.now().toString().slice(-4)}`;
      await db.put('kiosk_intakes', {
        ticketNumber: ticketNum,
        ...payload,
        createdAt: new Date().toISOString(),
      });

      const modal = document.getElementById('kioskTicketModal');
      const numEl = document.getElementById('ticketNumberDisplay');
      if (numEl) numEl.textContent = ticketNum;
      if (modal) modal.classList.remove('hidden');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Print OPD Intake Slip (पर्ची निकालें) 🖨️';
      }
    }
  }

  resetKiosk() {
    this.selectedRegions.clear();
    this.selectedSymptoms.clear();
    this.selectedPainScale = 2;
    document.querySelectorAll('.body-zone').forEach((z) => z.classList.remove('selected'));
    document.querySelectorAll('.symptom-card').forEach((s) => s.classList.remove('active'));
    document.querySelectorAll('.pain-face-btn').forEach((p) => p.classList.remove('active'));
    document.querySelector('.pain-face-btn[data-level="2"]')?.classList.add('active');
    this.updateRegionChips();
  }
}
