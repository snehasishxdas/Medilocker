/**
 * MediLocker Multilingual Dialect Voice & Text Intake Module (SIH26047)
 * - Dual compatibility: seamlessly accepts both spoken voice audio and typed text
 * - Dynamic SOCRATES framework follow-up questioning
 * - Spoken conversational audio playback in user's dialect
 * - Pre-trained disease prediction & diagnostic lab test recommendations
 */

import { api } from '../core/api.js';
import { events } from '../core/events.js';

export class VoiceIntakeModule {
  constructor(containerId = 'voiceIntakeContainer') {
    this.container = document.getElementById(containerId);
    this.recognition = null;
    this.isListening = false;
    this.conversationHistory = [];
    this.currentSocrates = {
      site: null,
      onset: null,
      character: null,
      radiation: null,
      associations: [],
      timeCourse: null,
      exacerbatingRelieving: null,
      severity: 5,
    };
    this.selectedDialect = 'Hindi / Bhojpuri';
    this.selectedLang = 'hi-IN';
    this.setupSpeechRecognition();
  }

  setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = this.selectedLang;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.updateMicUi(true);
      };

      this.recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        const inputEl = document.getElementById('voiceIntakeInput');
        if (inputEl) inputEl.value = transcript;
        this.submitMessage(transcript);
      };

      this.recognition.onerror = (e) => {
        console.warn('[Voice Intake] Speech recognition notice:', e.error);
        this.isListening = false;
        this.updateMicUi(false);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.updateMicUi(false);
      };
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="voice-intake-card">
        <div class="voice-intake-header">
          <div class="voice-title-wrap">
            <span class="voice-badge">🎙 Multilingual Clinical Voice Intake</span>
            <h2>Describe Your Symptoms (बोलकर या लिखकर बताएं)</h2>
            <p>Speak naturally in your native regional dialect or type below. The clinical engine evaluates your condition using the international SOCRATES framework.</p>
          </div>
          <div class="dialect-selector-wrap">
            <label for="dialectSelect">Spoken Dialect:</label>
            <select id="dialectSelect" class="dialect-select">
              <option value="Hindi / Bhojpuri" selected>भोजपुरी / Hindi (Bhojpuri-mixed)</option>
              <option value="Hindi / Maithili">मैथिली / Hindi (Maithili-mixed)</option>
              <option value="Hindi (Standard)">मानक हिन्दी (Standard Hindi)</option>
              <option value="Bengali">বাংলা (Bengali)</option>
              <option value="Punjabi">ਪੰਜਾਬੀ (Punjabi)</option>
              <option value="English">English (Indian Clinical)</option>
            </select>
          </div>
        </div>

        <div class="voice-socrates-tracker" id="socratesTracker">
          <div class="socrates-pill" data-dimension="site">📍 Site: <span>Pending</span></div>
          <div class="socrates-pill" data-dimension="onset">⏱ Onset: <span>Pending</span></div>
          <div class="socrates-pill" data-dimension="character">⚡ Character: <span>Pending</span></div>
          <div class="socrates-pill" data-dimension="severity">📊 Severity: <span>5/10</span></div>
          <div class="socrates-pill" data-dimension="associations">🔗 Associations: <span>Pending</span></div>
        </div>

        <div class="voice-chat-stream" id="voiceChatStream">
          <div class="chat-bubble assistant">
            <strong>MediLocker Intake Officer</strong>
            <p>नमस्ते! रउआ के का परेशानी हो रहल बा? आपन समस्या बोल के या लिख के बताईं। (Hello! Please describe what symptoms or discomfort you are experiencing today.)</p>
          </div>
        </div>

        <!-- Diagnostic Prediction & Test Recommendation Panel -->
        <div class="diagnostic-prediction-panel hidden" id="diagnosticPredictionPanel">
          <div class="diag-panel-header">
            <span class="diag-badge">🧠 ML Differential Diagnosis & Recommended Investigations</span>
          </div>
          <div class="diag-conditions-list" id="diagConditionsList"></div>
          <div class="diag-tests-list" id="diagTestsList"></div>
          <div class="diag-explanation" id="diagExplanation"></div>
        </div>

        <div class="voice-input-bar">
          <button type="button" class="voice-mic-btn" id="voiceMicBtn" title="Click to speak">
            <span class="mic-icon">🎤</span>
            <span class="mic-ripple"></span>
          </button>
          <input type="text" id="voiceIntakeInput" class="voice-text-input" placeholder="Type symptoms or click mic to speak in your dialect..." />
          <button type="button" class="voice-send-btn" id="voiceSendBtn">Send ↗</button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    events.bind('voiceIntake:mic', '#voiceMicBtn', 'click', () => this.toggleListening());
    events.bind('voiceIntake:send', '#voiceSendBtn', 'click', () => {
      const inputEl = document.getElementById('voiceIntakeInput');
      if (inputEl && inputEl.value.trim()) {
        const text = inputEl.value.trim();
        inputEl.value = '';
        this.submitMessage(text);
      }
    });

    events.bind('voiceIntake:enter', '#voiceIntakeInput', 'keydown', (e) => {
      if (e.key === 'Enter') {
        const text = e.target.value.trim();
        if (text) {
          e.target.value = '';
          this.submitMessage(text);
        }
      }
    });

    events.bind('voiceIntake:dialect', '#dialectSelect', 'change', (e) => {
      this.selectedDialect = e.target.value;
      if (this.selectedDialect.includes('Bengali')) {
        this.selectedLang = 'bn-IN';
      } else if (this.selectedDialect.includes('Punjabi')) {
        this.selectedLang = 'pa-IN';
      } else if (this.selectedDialect.includes('English')) {
        this.selectedLang = 'en-IN';
      } else {
        this.selectedLang = 'hi-IN';
      }
      if (this.recognition) this.recognition.lang = this.selectedLang;
    });
  }

  toggleListening() {
    if (!this.recognition) {
      alert('Speech recognition is not supported by your browser. You can type directly in the box.');
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
    } else {
      try {
        this.recognition.start();
      } catch (e) {
        console.warn('[Voice Intake] Recognition start exception:', e);
      }
    }
  }

  updateMicUi(listening) {
    const micBtn = document.getElementById('voiceMicBtn');
    if (!micBtn) return;
    if (listening) {
      micBtn.classList.add('recording');
      micBtn.setAttribute('title', 'Listening... click to stop');
    } else {
      micBtn.classList.remove('recording');
      micBtn.setAttribute('title', 'Click to speak');
    }
  }

  appendChatBubble(role, senderName, text) {
    const stream = document.getElementById('voiceChatStream');
    if (!stream) return;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    bubble.innerHTML = `
      <strong>${senderName}</strong>
      <p>${text}</p>
    `;
    stream.appendChild(bubble);
    stream.scrollTop = stream.scrollHeight;
  }

  playSpokenAudio(text) {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel(); // Stop any pending speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.selectedLang;
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('[Voice Intake] Speech synthesis notice:', err);
      }
    }
  }

  async submitMessage(userText) {
    this.appendChatBubble('user', 'You', userText);
    this.conversationHistory.push({ role: 'user', content: userText });

    // Show typing status
    const loadingId = 'voiceLoadingIndicator';
    this.appendChatBubble('assistant loading', 'MediLocker Intake Officer', 'Analyzing symptoms and evaluating clinical SOCRATES...');

    try {
      const res = await api.post('/api/v1/ai/voice-intake', {
        input: userText,
        history: this.conversationHistory,
        dialect: this.selectedDialect,
        language: this.selectedLang,
        currentSocrates: this.currentSocrates,
      });

      // Remove loading bubble
      const stream = document.getElementById('voiceChatStream');
      const last = stream?.lastElementChild;
      if (last?.classList.contains('loading')) last.remove();

      const data = res.data;
      if (data) {
        this.currentSocrates = { ...this.currentSocrates, ...(data.socrates || {}) };
        this.updateSocratesTracker();

        this.appendChatBubble('assistant', 'MediLocker Intake Officer', data.assistantReply);
        this.conversationHistory.push({ role: 'assistant', content: data.assistantReply });
        this.playSpokenAudio(data.assistantReply);

        // If intake has sufficient information or user requested, trigger disease prediction
        if (data.isComplete || this.conversationHistory.length >= 4) {
          this.triggerDiseasePrediction();
        }
      }
    } catch (err) {
      console.error('[Voice Intake] Intake query error:', err);
      const stream = document.getElementById('voiceChatStream');
      const last = stream?.lastElementChild;
      if (last?.classList.contains('loading')) last.remove();
      this.appendChatBubble('assistant', 'MediLocker Intake Officer', 'आपन समस्या दर्ज कइल गइल बा। कृपया आगे विवरण बताईं।');
    }
  }

  updateSocratesTracker() {
    const s = this.currentSocrates;
    const updatePill = (dim, val) => {
      const pill = document.querySelector(`.socrates-pill[data-dimension="${dim}"] span`);
      if (pill) {
        pill.textContent = val ? String(val).slice(0, 25) : 'Pending';
        pill.parentElement.classList.toggle('active', Boolean(val));
      }
    };

    updatePill('site', s.site);
    updatePill('onset', s.onset);
    updatePill('character', s.character);
    updatePill('severity', s.severity ? `${s.severity}/10` : '5/10');
    updatePill('associations', s.associations?.length ? s.associations.join(', ') : null);
  }

  async triggerDiseasePrediction() {
    const panel = document.getElementById('diagnosticPredictionPanel');
    const condList = document.getElementById('diagConditionsList');
    const testsList = document.getElementById('diagTestsList');
    const expEl = document.getElementById('diagExplanation');
    if (!panel) return;

    panel.classList.remove('hidden');
    condList.innerHTML = '<div class="diag-loading">🔬 Running AI differential diagnosis model...</div>';

    try {
      const res = await api.post('/api/v1/ai/disease-prediction', {
        socrates: this.currentSocrates,
        dialect: this.selectedDialect,
        language: this.selectedLang,
      });

      const data = res.data;
      if (data) {
        // Render conditions
        condList.innerHTML = `
          <h4>Probable Conditions (Differential Diagnosis):</h4>
          <div class="conditions-grid">
            ${(data.predictedConditions || [])
              .map(
                (c) => `
              <div class="condition-card probability-${(c.probability || 'Moderate').toLowerCase()}">
                <div class="cond-top">
                  <strong class="cond-name">${c.conditionName}</strong>
                  <span class="prob-badge">${c.probability} Confidence · ${c.icdCode || 'ICD-11'}</span>
                </div>
                <p class="cond-rationale">${c.scientificRationale}</p>
              </div>
            `
              )
              .join('')}
          </div>
        `;

        // Render recommended tests
        testsList.innerHTML = `
          <h4>Recommended Diagnostic Laboratory & Imaging Tests:</h4>
          <div class="tests-chips">
            ${(data.recommendedTests || [])
              .map(
                (t) => `
              <div class="test-chip urgency-${(t.urgency || 'Routine').toLowerCase()}">
                <span class="test-icon">⚗</span>
                <div>
                  <strong>${t.testName}</strong>
                  <small>${t.clinicalReason} (${t.urgency})</small>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        `;

        // Render patient guidance
        if (expEl && data.patientExplanation) {
          expEl.innerHTML = `
            <div class="patient-guidance-box">
              <strong>🩺 Clinical Guidance (रोगी परामर्श):</strong>
              <p>${data.patientExplanation}</p>
            </div>
          `;
        }
      }
    } catch (err) {
      console.error('[Voice Intake] Disease prediction error:', err);
      condList.innerHTML = '<p style="color:var(--danger)">Unable to load clinical disease predictions.</p>';
    }
  }
}
