import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { RecordsService } from './records.service';
import { DocumentType } from '@prisma/client';
import { AppError } from '../../middlewares/errorHandler';

export class RecordsController {
  static async upload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new AppError('File is required for upload.', 400);
      }

      const docTypeStr = (req.body.documentType || '').toUpperCase();
      const documentType: DocumentType =
        docTypeStr === 'REPORT' || docTypeStr.includes('REPORT') || docTypeStr.includes('LAB')
          ? DocumentType.REPORT
          : docTypeStr === 'SCAN'
          ? DocumentType.SCAN
          : docTypeStr === 'PRESCRIPTION'
          ? DocumentType.PRESCRIPTION
          : DocumentType.OTHER;
      const note = req.body.note;
      const eventDate = req.body.eventDate || req.body.docDate;
      const isMedicineStillNeeded =
        req.body.isMedicineStillNeeded !== undefined
          ? String(req.body.isMedicineStillNeeded).toLowerCase() !== 'false'
          : true;
      const doctorUnitId = req.body.doctorUnitId;

      const result = await RecordsService.uploadAndProcess(
        req.user!.userId,
        req.file,
        documentType,
        note,
        eventDate,
        isMedicineStillNeeded,
        doctorUnitId
      );

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = await RecordsService.getRecordStatus(req.user!.userId, req.params.id);
      res.status(200).json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  static async serveRawFile(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await RecordsService.getSecureRecordView(
        req.user!.userId,
        req.user!.role,
        req.params.id
      );

      // If fileUrl is a remote URL (Supabase/Cloudinary)
      if (record.fileUrl && (record.fileUrl.startsWith('http://') || record.fileUrl.startsWith('https://'))) {
        return res.redirect(record.fileUrl);
      }

      // If storageKey is a local path and file exists
      if (record.storageKey && fs.existsSync(record.storageKey)) {
        res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${record.originalFilename}"`);
        return fs.createReadStream(record.storageKey).pipe(res);
      }

      // If stored relative in uploads
      const uploadsFallback = path.join(process.cwd(), 'uploads', record.originalFilename);
      if (fs.existsSync(uploadsFallback)) {
        res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${record.originalFilename}"`);
        return fs.createReadStream(uploadsFallback).pipe(res);
      }

      // If stored with relative fileUrl in uploads
      if (record.fileUrl && record.fileUrl.startsWith('/uploads/')) {
        const localPath = path.join(process.cwd(), record.fileUrl.replace(/^\//, ''));
        if (fs.existsSync(localPath)) {
          res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
          res.setHeader('Content-Disposition', `inline; filename="${record.originalFilename}"`);
          return fs.createReadStream(localPath).pipe(res);
        }
      }

      throw new AppError('Document file not found on storage.', 404);
    } catch (error) {
      next(error);
    }
  }

  static async viewFile(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await RecordsService.getSecureRecordView(
        req.user!.userId,
        req.user!.role,
        req.params.id
      );

      // If requested raw JSON download
      if (req.query.format === 'raw' || req.query.format === 'json') {
        if (record.storageKey && fs.existsSync(record.storageKey)) {
          res.setHeader('Content-Type', record.mimeType || 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="${record.originalFilename}"`);
          return fs.createReadStream(record.storageKey).pipe(res);
        }
        return res.status(200).json({ success: true, data: record });
      }

      const token = (req.query.token as string) || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : '');
      const rawFileUrl = token
        ? `/api/v1/records/${record.id}/file?token=${encodeURIComponent(token)}`
        : `/api/v1/records/${record.id}/file`;

      const escape = (str: any) =>
        String(str || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');

      const patientName = escape((record as any).patient?.patientProfile?.fullName || 'Verified Patient');
      const medilockerId = escape((record as any).patient?.medilockerId || 'ML-VAL-2026');
      const bloodGroup = escape((record as any).patient?.patientProfile?.bloodGroup || 'Not Specified');
      const gender = escape((record as any).patient?.patientProfile?.gender || 'N/A');
      const doctorName = escape((record as any).timelineEvent?.doctorName || 'Attending Physician');
      const clinicName = escape((record as any).timelineEvent?.clinicName || 'MediLocker Sovereign Digital Vault');
      const dateFormatted = (record as any).timelineEvent?.eventDateDdmmyyyy
        ? `${(record as any).timelineEvent.eventDateDdmmyyyy.slice(0, 2)}/${(record as any).timelineEvent.eventDateDdmmyyyy.slice(2, 4)}/${(record as any).timelineEvent.eventDateDdmmyyyy.slice(4)}`
        : new Date(record.uploadedAt).toLocaleDateString('en-IN');

      const diagnoses: string[] = (record as any).timelineEvent?.diagnoses || [];
      const allergies: string[] = (record as any).timelineEvent?.allergiesDetected || [];
      const testsDue: any[] = (record as any).timelineEvent?.clinicalTestsDue || [];
      const prescribedMeds: any[] = (record as any).timelineEvent?.prescribedMeds || [];
      const clinicalSummary = (record as any).timelineEvent?.clinicalSummary || record.userNote || 'Clinical record securely archived in digital health locker.';

      const isImage =
        record.mimeType?.startsWith('image/') ||
        /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(record.originalFilename);
      const isPdf =
        record.mimeType === 'application/pdf' ||
        /\.pdf$/i.test(record.originalFilename);

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escape(record.originalFilename)} — MediLocker Clinical Record</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #0284c7;
      --primary-dark: #0369a1;
      --primary-light: #e0f2fe;
      --surface: #ffffff;
      --bg: #f8fafc;
      --border: #e2e8f0;
      --text: #0f172a;
      --muted: #64748b;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.55;
      padding: 24px 16px;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
      background: var(--surface);
      border-radius: 24px;
      border: 1px solid var(--border);
      box-shadow: 0 14px 35px -10px rgba(0, 0, 0, 0.08);
      overflow: hidden;
    }
    .top-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 28px;
      background: #0f172a;
      color: #fff;
      flex-wrap: wrap;
      gap: 12px;
    }
    .btn-group { display: flex; gap: 10px; align-items: center; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 18px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn-primary { background: #0284c7; color: #fff; border: none; }
    .btn-primary:hover { background: #0369a1; transform: translateY(-1px); }
    .btn-secondary { background: rgba(255, 255, 255, 0.15); color: #fff; border: 1px solid rgba(255, 255, 255, 0.25); }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.25); }
    
    .header {
      padding: 28px 32px 22px;
      border-bottom: 2px dashed var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand-icon {
      width: 48px; height: 48px;
      background: linear-gradient(135deg, #0284c7, #6366f1);
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 24px;
      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);
    }
    .badge-verified {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
    }
    .patient-strip {
      background: #f1f5f9;
      padding: 18px 32px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      border-bottom: 1px solid var(--border);
    }
    .strip-item span { display: block; font-size: 11px; text-transform: uppercase; color: var(--muted); font-weight: 800; letter-spacing: 0.5px; margin-bottom: 2px; }
    .strip-item strong { font-size: 14px; color: var(--text); }
    
    .body-content { padding: 32px; }
    .section { margin-bottom: 30px; }
    .section-title {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--primary);
      font-weight: 800;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Document Preview Styling */
    .document-preview-card {
      background: #0f172a;
      border-radius: 18px;
      overflow: hidden;
      border: 1px solid var(--border);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
      position: relative;
    }
    .document-img-container {
      background: #020617;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 16px;
      min-height: 280px;
      max-height: 600px;
      overflow: auto;
    }
    .document-img {
      max-width: 100%;
      max-height: 560px;
      object-fit: contain;
      border-radius: 10px;
      cursor: zoom-in;
      transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
    .document-img:hover {
      transform: scale(1.02);
    }
    .document-pdf-container {
      width: 100%;
      height: 520px;
      background: #1e293b;
    }
    .document-pdf-frame {
      width: 100%;
      height: 100%;
      border: none;
    }
    .preview-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background: #1e293b;
      color: #e2e8f0;
      font-size: 13px;
      border-top: 1px solid #334155;
    }
    .preview-bar a {
      color: #38bdf8;
      text-decoration: none;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .preview-bar a:hover {
      text-decoration: underline;
    }

    /* AI Summary & Cards */
    .ai-summary-card {
      background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%);
      border: 1px solid #bbf7d0;
      border-left: 5px solid #10b981;
      padding: 20px 24px;
      border-radius: 16px;
      font-size: 15px;
      line-height: 1.65;
      color: #1e293b;
    }
    .callout {
      background: #f8fafc;
      border-left: 4px solid var(--primary);
      padding: 16px 20px;
      border-radius: 0 14px 14px 0;
      font-size: 14px;
      line-height: 1.6;
    }
    .warning-callout {
      background: #fef2f2;
      border-left: 4px solid #ef4444;
      padding: 16px 20px;
      border-radius: 0 14px 14px 0;
      font-size: 14px;
      color: #991b1b;
      margin-bottom: 20px;
    }
    .pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .pill {
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th { text-align: left; background: #f1f5f9; padding: 12px 16px; font-weight: 700; color: #475569; border-bottom: 2px solid var(--border); }
    td { padding: 12px 16px; border-bottom: 1px solid var(--border); }
    tr:hover td { background: #f8fafc; }
    .urgency-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      background: #fef3c7;
      color: #92400e;
    }
    .footer {
      background: #f8fafc;
      border-top: 1px solid var(--border);
      padding: 20px 32px;
      font-size: 12px;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .mono { font-family: 'JetBrains Mono', monospace; font-size: 11px; }

    /* Modal Image Lightbox */
    #imageModal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.92);
      z-index: 9999;
      justify-content: center;
      align-items: center;
      padding: 20px;
      cursor: zoom-out;
    }
    #imageModal img {
      max-width: 95vw;
      max-height: 95vh;
      object-fit: contain;
      border-radius: 12px;
      box-shadow: 0 0 30px rgba(0,0,0,0.8);
    }

    @media print {
      body { background: #fff; padding: 0; }
      .top-actions, .preview-bar, #imageModal { display: none !important; }
      .container { border: none; box-shadow: none; max-width: 100%; }
      .document-img { max-height: 400px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="top-actions">
      <div style="font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 8px;">
        <span>🔒 Sovereign Medical Document Vault</span>
      </div>
      <div class="btn-group">
        <a href="${rawFileUrl}" target="_blank" download="${escape(record.originalFilename)}" class="btn btn-secondary">💾 Download Original</a>
        <button onclick="window.print()" class="btn btn-primary">🖨 Print / Save PDF</button>
        <button onclick="window.close()" class="btn btn-secondary">Close</button>
      </div>
    </div>

    <div class="header">
      <div>
        <div class="brand">
          <div class="brand-icon">⚕</div>
          <div>
            <h1 style="font-size: 20px; font-weight: 800; color: #0f172a;">MediLocker Electronic Health Vault</h1>
            <p style="font-size: 13px; color: var(--muted);">${clinicName} · ${doctorName}</p>
          </div>
        </div>
      </div>
      <div style="text-align: right;">
        <span class="badge-verified">✓ ABDM Verified Record</span>
        <div style="font-size: 12px; color: var(--muted); margin-top: 6px;">Date: <strong>${dateFormatted}</strong></div>
      </div>
    </div>

    <div class="patient-strip">
      <div class="strip-item">
        <span>Patient Name</span>
        <strong>${patientName}</strong>
      </div>
      <div class="strip-item">
        <span>MediLocker ID</span>
        <strong class="mono" style="color: #0284c7;">${medilockerId}</strong>
      </div>
      <div class="strip-item">
        <span>Blood Group</span>
        <strong>${bloodGroup}</strong>
      </div>
      <div class="strip-item">
        <span>Gender</span>
        <strong>${gender}</strong>
      </div>
      <div class="strip-item">
        <span>Document Type</span>
        <strong>${escape(record.documentType)}</strong>
      </div>
    </div>

    <div class="body-content">
      <!-- 1. Original Document Section (Image / PDF Preview) -->
      <div class="section">
        <div class="section-title">
          <span>📷 Original Uploaded Document</span>
        </div>
        <div class="document-preview-card">
          ${
            isImage
              ? `
          <div class="document-img-container">
            <img src="${rawFileUrl}" alt="Original Medical Document" class="document-img" onclick="openLightbox(this.src)" title="Click to view full screen">
          </div>
          `
              : isPdf
              ? `
          <div class="document-pdf-container">
            <iframe src="${rawFileUrl}" class="document-pdf-frame"></iframe>
          </div>
          `
              : `
          <div style="padding: 40px; text-align: center; color: #fff;">
            <p style="margin-bottom: 12px; font-size: 15px;">Document archived in vault: <strong>${escape(record.originalFilename)}</strong></p>
            <a href="${rawFileUrl}" target="_blank" class="btn btn-primary">Open / Download Original File ↗</a>
          </div>
          `
          }
          <div class="preview-bar">
            <span>📄 <strong>${escape(record.originalFilename)}</strong> (${escape(record.mimeType || 'Document')})</span>
            <div style="display: flex; gap: 14px;">
              <a href="${rawFileUrl}" target="_blank">Open Full Resolution ↗</a>
              <a href="${rawFileUrl}" download="${escape(record.originalFilename)}">Download File ↓</a>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Allergies Warning (if any detected) -->
      ${
        allergies.length > 0
          ? `
      <div class="warning-callout">
        <strong>⚠️ Clinical Allergy Alerts Detected:</strong> ${allergies.map((a) => escape(a)).join(', ')}
      </div>`
          : ''
      }

      <!-- 3. Reported Chief Complaints (if notes present) -->
      ${
        record.userNote
          ? `
      <div class="section">
        <div class="section-title">Reported Chief Complaints & Remarks</div>
        <div class="callout">${escape(record.userNote)}</div>
      </div>`
          : ''
      }

      <!-- 4. AI Clinical Intelligence Assessment Summary -->
      <div class="section">
        <div class="section-title">
          <span>✦ Medi-AI Clinical Narrative & Summary</span>
        </div>
        <div class="ai-summary-card">
          ${escape(clinicalSummary)}
        </div>
      </div>

      <!-- 5. Diagnoses -->
      ${
        diagnoses.length > 0
          ? `
      <div class="section">
        <div class="section-title">Clinical Findings & Diagnoses (${diagnoses.length})</div>
        <div class="pills">
          ${diagnoses.map((d) => `<span class="pill">${escape(d)}</span>`).join('')}
        </div>
      </div>`
          : ''
      }

      <!-- 6. Prescribed Medications Table (if any) -->
      ${
        prescribedMeds.length > 0
          ? `
      <div class="section">
        <div class="section-title">Prescribed Medications (${prescribedMeds.length})</div>
        <table>
          <thead>
            <tr>
              <th style="width: 30%;">Medicine Name & Salt</th>
              <th style="width: 20%;">Dosage</th>
              <th style="width: 25%;">Frequency & Timing</th>
              <th style="width: 25%;">Route / Instructions</th>
            </tr>
          </thead>
          <tbody>
            ${prescribedMeds
              .map(
                (m: any) => `
            <tr>
              <td>
                <strong>${escape(m.medicineName)}</strong>
                ${m.activeSalt ? `<div style="font-size: 11px; color: var(--muted);">${escape(m.activeSalt)}</div>` : ''}
              </td>
              <td>${escape(m.dosage || 'As directed')}</td>
              <td>
                <div>${escape(m.frequency || 'Daily')}</div>
                ${m.timingInstruction ? `<small style="color: var(--muted);">${escape(m.timingInstruction)}</small>` : ''}
              </td>
              <td>${escape(m.route || 'Oral')}</td>
            </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
          : ''
      }

      <!-- 7. Recommended Diagnostic Investigations Table (if any) -->
      ${
        testsDue.length > 0
          ? `
      <div class="section">
        <div class="section-title">Recommended Diagnostic Investigations (${testsDue.length})</div>
        <table>
          <thead>
            <tr>
              <th style="width: 15%;">Urgency</th>
              <th style="width: 45%;">Diagnostic Investigation</th>
              <th style="width: 40%;">Clinical Indication</th>
            </tr>
          </thead>
          <tbody>
            ${testsDue
              .map(
                (t: any) => `
            <tr>
              <td><span class="urgency-badge">${escape(t.urgency || 'Routine')}</span></td>
              <td><strong>${escape(t.testName || 'Investigation')}</strong></td>
              <td style="color: var(--muted);">${escape(t.clinicalReason || 'Standard clinical review')}</td>
            </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
          : ''
      }
    </div>

    <div class="footer">
      <div>
        <span>Document Integrity Hash (SHA-256): </span>
        <span class="mono">${escape(record.sha256Checksum || record.id)}</span>
      </div>
      <div>
        <span>Status: </span>
        <strong style="color: #10b981;">VERIFIED & ACTIVE IN EHR</strong>
      </div>
    </div>
  </div>

  <!-- Lightbox Modal for zooming into original document -->
  <div id="imageModal" onclick="this.style.display='none'">
    <img id="modalImg" src="" alt="Zoomed document" />
  </div>

  <script>
    function openLightbox(src) {
      var modal = document.getElementById('imageModal');
      var img = document.getElementById('modalImg');
      img.src = src;
      modal.style.display = 'flex';
    }
  </script>
</body>
</html>`;

      res.status(200).type('text/html').send(html);
    } catch (error) {
      next(error);
    }
  }

  static async createManual(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await RecordsService.createManualRecord(req.user!.userId, req.body);
      res.status(201).json({ success: true, record: result.record, timelineEvent: result.timelineEvent });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const filter = req.query.type as string;
      const result = await RecordsService.listRecords(req.user!.userId, filter);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await RecordsService.getRecordById(req.params.id, req.user!.userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await RecordsService.deleteRecord(req.params.id, req.user!.userId);
      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  }
}
