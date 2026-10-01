/**
 * Offline Emergency Arogya Pocket QR Generator
 * Standard ISO/IEC 18004 QR Matrix Generator with Reed-Solomon Error Correction.
 * Readable by all camera sensors, hardware 2D scanners, and jsQR decoders.
 */
import QRCode from 'qrcode';

export function generateEmergencyPayload(patient, kioskData = null) {
  const profile = patient?.patientProfile || {};
  const name = profile.fullName || patient?.name || 'Registered Citizen';
  const blood = profile.bloodGroup || patient?.bloodGroup || 'Not specified';
  const allergiesList = Array.isArray(patient?.allergies)
    ? patient.allergies
    : (profile.baselineAllergies ? profile.baselineAllergies.split(',').map((s) => s.trim()).filter(Boolean) : []);
  const emPhone = profile.emergencyContactPhone || patient?.emergencyContact?.phone || patient?.phone || '102';
  const unitId = patient?.medilockerId || 'ML-EMERGENCY';

  const payload = {
    scheme: 'MEDILOCKER-EMERGENCY-V1',
    unitId,
    name,
    blood,
    allergies: allergiesList,
    emergencyPhone: emPhone,
    verifiedAt: new Date().toISOString().split('T')[0],
  };

  if (kioskData) {
    payload.kiosk = {
      token: kioskData.tokenNumber || kioskData.ticketNumber,
      complaint: kioskData.complaint || kioskData.complaintSummary,
      triage: kioskData.triageCategory || kioskData.priorityTriage,
      regions: kioskData.bodyRegions,
      symptoms: kioskData.symptoms,
      painScale: kioskData.painScale,
    };
  }

  return JSON.stringify(payload);
}

/**
 * Generate standard QR payload for an OPD Kiosk Queue Ticket
 */
export function generateKioskQrPayload(ticketData) {
  return JSON.stringify({
    scheme: 'MEDILOCKER-EMERGENCY-V1',
    type: 'KIOSK_INTAKE_TICKET',
    unitId: ticketData.medilockerId || 'ML-OPD',
    tokenNumber: ticketData.tokenNumber || ticketData.ticketNumber || 'OPD-1',
    patientName: ticketData.patientName || 'OPD Patient',
    complaint: ticketData.complaint || ticketData.complaintSummary || 'General Triage',
    triageCategory: ticketData.triageCategory || 'GREEN',
    verifiedAt: new Date().toISOString().split('T')[0],
  });
}


/**
 * Returns a standard high-density SVG QR code representation for wallet card printing & scanning
 */
export function generateQrSvg(text, options = {}) {
  try {
    const errorCorrectionLevel = options.errorCorrectionLevel || 'M';
    const margin = options.margin !== undefined ? options.margin : 4;
    const qr = QRCode.create(String(text || 'MEDILOCKER-SOVEREIGN'), { errorCorrectionLevel });
    const size = qr.modules.size;
    const data = qr.modules.data;
    const fullSize = size + margin * 2;
    const cellSize = options.cellSize || 8;
    const totalDim = fullSize * cellSize;

    let rects = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (data[r * size + c]) {
          const x = (c + margin) * cellSize;
          const y = (r + margin) * cellSize;
          rects += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="#0f172a" />`;
        }
      }
    }

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalDim} ${totalDim}" width="160" height="160" shape-rendering="crispEdges">
        <rect width="100%" height="100%" fill="#ffffff"/>
        ${rects}
      </svg>
    `;
  } catch (err) {
    console.error('Failed to generate standard QR code:', err);
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
        <rect width="100%" height="100%" fill="#fee2e2" rx="12"/>
        <text x="80" y="80" text-anchor="middle" fill="#dc2626" font-size="12" font-weight="bold">QR Error</text>
      </svg>
    `;
  }
}

/**
 * Generates an asynchronous Data URL (PNG) if needed for canvas drawing or file downloads
 */
export async function generateQrDataUrl(text, width = 256) {
  try {
    return await QRCode.toDataURL(String(text || 'MEDILOCKER-SOVEREIGN'), {
      width,
      margin: 4,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('QR DataURL generation error:', err);
    return '';
  }
}
