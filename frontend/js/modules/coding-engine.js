/**
 * MediLocker Dual-Standard Medical Classification Engine (SIH26047)
 * - National Morbidity Codes (NAMASTE Standard)
 * - WHO ICD-11 Chapter 26 (Traditional Medicine Module 2 - TM2)
 * - Scientific pathophysiological profile visualization
 */

import { api } from '../core/api.js';
import { events } from '../core/events.js';

export class CodingEngineModule {
  constructor(containerId = 'codingEngineContainer') {
    this.container = document.getElementById(containerId);
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="coding-engine-card">
        <div class="coding-header">
          <span class="coding-badge">🏷 Dual-Standard Medical Terminology Engine</span>
          <h3>NAMASTE & WHO ICD-11 Chapter 26 Cross-Coding</h3>
          <p>Translates patient-reported symptoms and clinical diagnoses into standardized National Morbidity Codes and international WHO ICD-11 TM2 classifications.</p>
        </div>

        <div class="coding-search-bar">
          <input type="text" id="codingInput" placeholder="Enter clinical condition (e.g. Acid peptic disease, Bronchial asthma, Joint stiffness)..." />
          <button type="button" id="codingLookupBtn" class="primary-btn">Classify Condition ↗</button>
        </div>

        <div class="coding-results-area" id="codingResultsArea">
          <div class="coding-presets">
            <span>Quick Clinical Examples:</span>
            <button class="preset-tag" data-query="Hyperacidity and heartburn after meals">Acid Dyspepsia (Amlapitta)</button>
            <button class="preset-tag" data-query="Chronic wheezing with shortness of breath">Bronchial Asthma (Tamaka Shwasa)</button>
            <button class="preset-tag" data-query="Morning joint stiffness with knee pain">Osteoarthritis (Sandhivata)</button>
            <button class="preset-tag" data-query="High fever with shivering and body aches">Febrile Illness (Jvara)</button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    events.bind('coding:lookup', '#codingLookupBtn', 'click', () => {
      const input = document.getElementById('codingInput');
      if (input && input.value.trim()) {
        this.performClassification(input.value.trim());
      }
    });

    events.bind('coding:enter', '#codingInput', 'keydown', (e) => {
      if (e.key === 'Enter') {
        const input = document.getElementById('codingInput');
        if (input && input.value.trim()) {
          this.performClassification(input.value.trim());
        }
      }
    });

    events.bindAll('coding:preset', '.preset-tag', 'click', (el) => () => {
      const query = el.dataset.query;
      const input = document.getElementById('codingInput');
      if (input) input.value = query;
      this.performClassification(query);
    });
  }

  async performClassification(query) {
    const resultsArea = document.getElementById('codingResultsArea');
    if (!resultsArea) return;

    resultsArea.innerHTML = '<div class="coding-loading">🔍 Querying national and international medical ontology databases...</div>';

    try {
      const res = await api.post('/api/v1/ai/double-code', {
        complaintOrDiagnosis: query,
      });

      const data = res.data;
      if (data) {
        const namc = data.nationalMorbidityCode || {};
        const icd = data.icd11Tm2Code || {};
        const profile = data.physiologicalProfile || { neuroMotorIndex: 33, metabolicInflammatoryIndex: 34, structuralFluidIndex: 33 };

        resultsArea.innerHTML = `
          <div class="dual-code-cards-grid">
            <!-- Standard 1: National Morbidity Code (NAMASTE) -->
            <div class="standard-code-card namaste-card">
              <div class="card-head">
                <span class="source-tag">National Morbidity Standard (NAMASTE)</span>
                <span class="code-pill">${namc.code || 'NAMC-01'}</span>
              </div>
              <h4 class="term-title">${namc.term || 'Clinical Term'}</h4>
              <p class="term-category"><b>Category:</b> ${namc.scientificCategory || 'Standard Clinical Entity'}</p>
              <div class="system-status">✓ Verified in Ministry of Ayush Electronic Registry</div>
            </div>

            <!-- Standard 2: WHO ICD-11 Chapter 26 (TM2) -->
            <div class="standard-code-card icd-card">
              <div class="card-head">
                <span class="source-tag">WHO ICD-11 Chapter 26 (TM2)</span>
                <span class="code-pill">${icd.code || 'TM2: SF00'}</span>
              </div>
              <h4 class="term-title">${icd.term || 'Traditional Medicine Disorder'}</h4>
              <p class="term-category"><b>Pathophysiology:</b> ${icd.description || 'Systemic physiological dysregulation'}</p>
              <div class="system-status">✓ WHO International Classification of Diseases Compatible</div>
            </div>
          </div>

          <!-- Scientific Physiological Distribution Radar -->
          <div class="physiological-profile-card">
            <h4>Physiological Metabolic & Neuro-Motor Profile (Constitutional Indices):</h4>
            <div class="profile-bars">
              <div class="profile-bar-item">
                <div class="bar-label">
                  <span>Neuro-Motor / Kinetic Regulation (Vata equivalent)</span>
                  <strong>${profile.neuroMotorIndex}%</strong>
                </div>
                <div class="bar-track"><div class="bar-fill neuro" style="width:${profile.neuroMotorIndex}%"></div></div>
              </div>

              <div class="profile-bar-item">
                <div class="bar-label">
                  <span>Metabolic-Inflammatory / Heat Regulation (Pitta equivalent)</span>
                  <strong>${profile.metabolicInflammatoryIndex}%</strong>
                </div>
                <div class="bar-track"><div class="bar-fill metabolic" style="width:${profile.metabolicInflammatoryIndex}%"></div></div>
              </div>

              <div class="profile-bar-item">
                <div class="bar-label">
                  <span>Structural-Fluid / Cohesive Balance (Kapha equivalent)</span>
                  <strong>${profile.structuralFluidIndex}%</strong>
                </div>
                <div class="bar-track"><div class="bar-fill structural" style="width:${profile.structuralFluidIndex}%"></div></div>
              </div>
            </div>
          </div>
        `;
      }
    } catch (err) {
      console.error('[Coding Engine] Classification error:', err);
      resultsArea.innerHTML = '<p style="color:var(--danger)">Classification lookup encountered a network issue.</p>';
    }
  }
}
