export interface PatientClinicalContext {
  fullName?: string;
  isPregnant?: boolean;
  recentAlcohol?: boolean;
  knownAllergies?: string[];
  chronicConditions?: string[];
  homeSupplies?: Array<{ name: string; activeSalt?: string; quantity: number }>;
  alreadyPrescribedMedications?: Array<{
    medicineName: string;
    activeSalt?: string;
    dosage?: string;
    frequency?: string;
  }>;
}

export interface DrugCandidate {
  name: string;
  activeSalt: string;
  isNsaid?: boolean;
  sedativeProperty?: boolean;
}

export class ClinicalGuardrails {
  private static emergencyKeywords = [
    'chest pain',
    'heart attack',
    'left arm pain',
    'shortness of breath',
    'cannot breathe',
    'face droop',
    'slurred speech',
    'stroke',
    'unconscious',
    'coughing blood',
    'severe allergic reaction',
    'anaphylaxis',
    'swelling of throat',
  ];

  private static nonMedicalPatterns = [
    /\b(python|javascript|typescript|java|c\+\+|c#|ruby|rust|golang|php|swift|kotlin)\b/i,
    /\b(html|css|react|angular|vue|django|flask|express|spring boot|docker|kubernetes)\b/i,
    /\b(linked\s*list|binary\s*tree|data\s*structure|algorithm|sorting|recursion|hashmap|array\s*list)\b/i,
    /\b(def\s+\w+|class\s+\w+|function\s*\(|const\s+\w+\s*=|import\s+[\w{}]+|console\.log)\b/i,
    /\b(write\s+(?:a\s+)?(?:python|code|script|program|function|class|algorithm|sql))\b/i,
    /\b(debug\s+(?:this|my)?\s*code|compile\s+error|syntax\s+error|runtime\s+error|stack\s*trace)\b/i,
    /\b(git\s+commit|git\s+push|npm\s+install|pip\s+install|terminal\s+command)\b/i,
    /\b(solve\s+(?:the\s+)?(?:equation|integral|derivative|calculus|algebra|matrix))\b/i,
    /\b(write\s+(?:an?\s+)?(?:essay|poem|song|story|movie\s*review|speech))\b/i,
    /\b(stock\s+market|crypto|cryptocurrency|bitcoin|ethereum|forex\s+trading)\b/i,
  ];

  private static restrictedDrugs = [
    'amoxicillin',
    'azithromycin',
    'ciprofloxacin',
    'doxycycline',
    'cephalexin',
    'metronidazole',
    'cefixime',
    'levofloxacin',
    'augmentin',
    'alprazolam',
    'xanax',
    'diazepam',
    'valium',
    'lorazepam',
    'clonazepam',
    'tramadol',
    'codeine',
    'morphine',
    'fentanyl',
    'pregabalin',
    'gabapentin',
    'prednisone',
    'prednisolone',
    'dexamethasone',
  ];

  /**
   * Evaluates prompt for life-threatening emergency signs
   */
  static isEmergency(userQuery: string): boolean {
    const lower = userQuery.toLowerCase();
    return this.emergencyKeywords.some((keyword) => lower.includes(keyword));
  }

  /**
   * Evaluates prompt for non-medical requests (coding, math, general trivia)
   */
  static isNonMedical(userQuery: string): boolean {
    return this.nonMedicalPatterns.some((pattern) => pattern.test(userQuery));
  }

  /**
   * Checks if user is asking for restricted Schedule H/X or antibiotic medications
   */
  static isRestrictedDrugRequest(userQuery: string): { isRestricted: boolean; drugName?: string } {
    const lower = userQuery.toLowerCase();
    const match = this.restrictedDrugs.find((drug) => lower.includes(drug));
    if (match) {
      return { isRestricted: true, drugName: match };
    }
    return { isRestricted: false };
  }

  /**
   * Checks if user query references an allergen they are documented to be allergic to
   */
  static checkDirectAllergyConflict(
    patient: PatientClinicalContext,
    userQuery: string
  ): { hasConflict: boolean; allergen?: string } {
    if (!patient.knownAllergies || patient.knownAllergies.length === 0) {
      return { hasConflict: false };
    }
    const lower = userQuery.toLowerCase();
    const match = patient.knownAllergies.find((allergy) => {
      const cleanAllergy = allergy.toLowerCase().replace(/\ballergy\b/i, '').trim();
      return cleanAllergy.length > 2 && lower.includes(cleanAllergy);
    });

    if (match) {
      return { hasConflict: true, allergen: match };
    }
    return { hasConflict: false };
  }

  /**
   * Returns standardized emergency response
   */
  static getEmergencyResponse(): string {
    return `⚠️ EMERGENCY ALERT: Your symptoms may indicate an acute medical emergency.

• Action: Call 112 or 108 immediately (or 911) or proceed to the nearest emergency room without delay.
• Safety: Do not drive yourself. Remain seated in an upright or resting position.
• Limitation: Medi-AI cannot triage acute or life-threatening emergencies.

⚠️ Medical Disclaimer: This advice is for informational and emergency guidance only. It is not a substitute for a licensed medical professional.`;
  }

  /**
   * Returns standardized non-medical refusal response
   */
  static getNonMedicalRefusal(): string {
    return `⚠️ Out of Scope Request

Medi-AI is strictly confined to personal healthcare, daily wellness, and non-prescription over-the-counter (OTC) guidance.

• Permitted Scope: Daily symptom advice, non-prescription home remedies, lab investigation explanation, and medication adherence.
• Restricted Scope: Programming, computer code, mathematics, academic essays, and general non-health topics.

⚠️ Medical Disclaimer: Medi-AI provides informational health guidance only and does not substitute for a qualified physician's consultation.`;
  }

  /**
   * Standard disclaimer to append to all responses
   */
  static getStandardDisclaimer(): string {
    return `⚠️ Medical Disclaimer: This advice is for informational and daily guidance purposes only. It is not a substitute for professional medical diagnosis or a prescription. Consult a qualified doctor if symptoms persist or worsen.`;
  }

  /**
   * Cross-references home medicine candidate against patient history
   */
  static checkSafety(patient: PatientClinicalContext, drug: DrugCandidate): { safe: boolean; reason?: string } {
    // 1. Pregnancy check
    if (patient.isPregnant && drug.isNsaid) {
      return {
        safe: false,
        reason: `CONTRAINDICATION: NSAIDs (like ${drug.name}) should be avoided during pregnancy due to fetal risk.`,
      };
    }

    // 2. Alcohol interaction
    if (patient.recentAlcohol && drug.sedativeProperty) {
      return {
        safe: false,
        reason: `CONTRAINDICATION: Combining ${drug.name} with alcohol increases the risk of severe central nervous system depression.`,
      };
    }

    // 3. Documented Allergies
    if (patient.knownAllergies && patient.knownAllergies.length > 0) {
      const allergyMatch = patient.knownAllergies.find((allergy) =>
        drug.activeSalt.toLowerCase().includes(allergy.toLowerCase()) ||
        drug.name.toLowerCase().includes(allergy.toLowerCase())
      );
      if (allergyMatch) {
        return {
          safe: false,
          reason: `CONTRAINDICATION: You have a documented allergy to ${allergyMatch}. Do not consume ${drug.name}.`,
        };
      }
    }

    return { safe: true };
  }
}
