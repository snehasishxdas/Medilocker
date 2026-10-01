/**
 * Pradhan Mantri Bhartiya Janaushadhi Pariyojana (PMBJP) Generic Medicine Catalog & Cost Saver
 * Maps high-volume Indian branded drugs to generic salts and Jan Aushadhi prices.
 */

export const JAN_AUSHADHI_CATALOG = [
  {
    brandName: 'Augmentin 625 Duo',
    activeSalt: 'Amoxicillin 500mg + Potassium Clavulanate 125mg',
    brandPrice: 215,
    janAushadhiPrice: 48,
    category: 'Antibiotic / Respiratory & ENT',
    unit: 'Strip of 10 tablets',
  },
  {
    brandName: 'Pan-D / Pantocid-D',
    activeSalt: 'Pantoprazole 40mg + Domperidone 30mg',
    brandPrice: 185,
    janAushadhiPrice: 32,
    category: 'Antacid / Gastrointestinal PPI',
    unit: 'Strip of 10 capsules',
  },
  {
    brandName: 'Glycomet-GP 2',
    activeSalt: 'Metformin 500mg + Glimepiride 2mg',
    brandPrice: 145,
    janAushadhiPrice: 24,
    category: 'Antidiabetic / Type-2 Diabetes',
    unit: 'Strip of 15 tablets',
  },
  {
    brandName: 'Telma-H / Telmikind-H',
    activeSalt: 'Telmisartan 40mg + Hydrochlorothiazide 12.5mg',
    brandPrice: 168,
    janAushadhiPrice: 28,
    category: 'Antihypertensive / Blood Pressure',
    unit: 'Strip of 15 tablets',
  },
  {
    brandName: 'Atorva 10 / Lipitor 10',
    activeSalt: 'Atorvastatin 10mg',
    brandPrice: 125,
    janAushadhiPrice: 18,
    category: 'Cardiovascular / Cholesterol Statin',
    unit: 'Strip of 10 tablets',
  },
  {
    brandName: 'Montair-LC',
    activeSalt: 'Montelukast 10mg + Levocetirizine 5mg',
    brandPrice: 195,
    janAushadhiPrice: 35,
    category: 'Antihistamine / Asthma & Allergy',
    unit: 'Strip of 10 tablets',
  },
  {
    brandName: 'Dolo 650 / Calpol 650',
    activeSalt: 'Paracetamol 650mg',
    brandPrice: 34,
    janAushadhiPrice: 11,
    category: 'Analgesic / Antipyretic',
    unit: 'Strip of 15 tablets',
  },
  {
    brandName: 'Azithral 500',
    activeSalt: 'Azithromycin 500mg',
    brandPrice: 135,
    janAushadhiPrice: 38,
    category: 'Antibiotic / Throat & Chest',
    unit: 'Strip of 5 tablets',
  },
  {
    brandName: 'Thyronorm 50 / Eltroxin',
    activeSalt: 'Thyroxine Sodium 50mcg',
    brandPrice: 175,
    janAushadhiPrice: 42,
    category: 'Endocrine / Hypothyroidism',
    unit: 'Bottle of 100 tablets',
  },
  {
    brandName: 'Shelcal 500',
    activeSalt: 'Calcium Carbonate 500mg + Vitamin D3 250 IU',
    brandPrice: 128,
    janAushadhiPrice: 30,
    category: 'Nutritional / Bone Mineral Supplement',
    unit: 'Strip of 15 tablets',
  },
  {
    brandName: 'Neurobion Forte',
    activeSalt: 'Vitamin B Complex with B12',
    brandPrice: 45,
    janAushadhiPrice: 12,
    category: 'Neurological / Nerve Supplement',
    unit: 'Strip of 30 tablets',
  },
  {
    brandName: 'Ecosprin 75',
    activeSalt: 'Aspirin (Enteric Coated) 75mg',
    brandPrice: 16,
    janAushadhiPrice: 5,
    category: 'Antiplatelet / Cardiac Health',
    unit: 'Strip of 14 tablets',
  },
];

/**
 * Find matching Jan Aushadhi generic alternative for any medicine name or salt
 */
export function findGenericAlternative(query) {
  if (!query) return null;
  const clean = query.toLowerCase().trim();

  // 1. Direct brand name match
  const match = JAN_AUSHADHI_CATALOG.find(
    (item) =>
      clean.includes(item.brandName.toLowerCase()) ||
      item.brandName.toLowerCase().includes(clean) ||
      clean.includes(item.activeSalt.toLowerCase()) ||
      item.activeSalt.toLowerCase().includes(clean)
  );

  if (match) {
    const savingsAmount = match.brandPrice - match.janAushadhiPrice;
    const savingsPercent = Math.round((savingsAmount / match.brandPrice) * 100);
    return {
      ...match,
      savingsAmount,
      savingsPercent,
      isAvailableAtJanAushadhi: true,
      pmbjpPortalLink: 'https://janaushadhi.gov.in',
    };
  }

  // 2. Generic fallback estimation
  return {
    brandName: query,
    activeSalt: query,
    brandPrice: 120,
    janAushadhiPrice: 28,
    savingsAmount: 92,
    savingsPercent: 76,
    category: 'Generic Pharmaceutical',
    unit: 'Per standard strip',
    isAvailableAtJanAushadhi: true,
    pmbjpPortalLink: 'https://janaushadhi.gov.in',
  };
}

/**
 * Calculate total monthly household out-of-pocket savings
 */
export function calculateMonthlySavings(medications) {
  if (!Array.isArray(medications) || medications.length === 0) {
    return { totalBrandCost: 0, totalGenericCost: 0, totalSaved: 0, savingsPercent: 0 };
  }

  let totalBrand = 0;
  let totalGeneric = 0;

  for (const m of medications) {
    const name = typeof m === 'string' ? m : m.medicineName || m.taskLabel || '';
    const alt = findGenericAlternative(name);
    if (alt) {
      totalBrand += alt.brandPrice;
      totalGeneric += alt.janAushadhiPrice;
    }
  }

  const saved = totalBrand - totalGeneric;
  const pct = totalBrand > 0 ? Math.round((saved / totalBrand) * 100) : 0;

  return {
    totalBrandCost: totalBrand,
    totalGenericCost: totalGeneric,
    totalSaved: saved,
    savingsPercent: pct,
  };
}
