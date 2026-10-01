import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

export interface WelcomeEmailParams {
  to: string;
  fullName: string;
  role: 'PATIENT' | 'DOCTOR' | 'HOSPITAL';
  medilockerId: string;
}

export interface AccessRequestEmailParams {
  patientEmail: string;
  patientName: string;
  doctorName: string;
  clinicName: string;
  durationMinutes: number;
  sixDigitCode: string;
  codeExpiresAt: Date;
}

export interface AccessAuthorizedEmailParams {
  recipientEmail: string;
  recipientName: string;
  doctorName: string;
  patientName: string;
  durationMinutes: number;
  expiresAt: Date;
  role: 'PATIENT' | 'DOCTOR';
}

export interface RecordUploadedEmailParams {
  doctorEmail: string;
  doctorName: string;
  patientName: string;
  patientUnitId: string;
  documentType: string;
  originalFilename: string;
  recordId: string;
}

export interface PatientRecordUploadedEmailParams {
  patientEmail: string;
  patientName: string;
  patientUnitId: string;
  documentType: string;
  originalFilename: string;
  doctorName?: string;
  clinicName?: string;
  diagnoses?: string[];
  medicationsCount?: number;
}

export interface AppointmentBookedEmailParams {
  recipientEmail: string;
  recipientName: string;
  doctorName: string;
  specialization: string;
  clinicName: string;
  clinicAddress?: string;
  appointmentDate: string;
  timeSlot: string;
  reason?: string;
  isDoctor?: boolean;
}

export interface AppointmentStatusEmailParams {
  patientEmail: string;
  patientName: string;
  doctorName: string;
  appointmentDate: string;
  timeSlot: string;
  newStatus: string;
  notes?: string;
}

export interface CriticalAdverseEmailParams {
  patientEmail: string;
  patientName: string;
  feelingScore: number;
  feedback?: string;
  dateStr: string;
}

interface BaseLayoutOptions {
  headerTagline: string;
  badgeText?: string;
  badgeBg?: string;
  badgeColor?: string;
  heading: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  extraFooter?: string;
}

function renderBaseLayout(opts: BaseLayoutOptions): string {
  const currentYear = new Date().getFullYear();
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MediLocker Notification</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f7f5fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#24192e;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f5fa;padding:32px 12px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e7dfef;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(43,24,54,0.06);">
              
              <!-- Brand Header Banner -->
              <tr>
                <td style="background:linear-gradient(135deg, #2b1836 0%, #3e204d 100%);padding:32px 32px 28px;text-align:center;">
                  <div style="font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;margin:0;">
                    Medi<span style="color:#d4a8ec;">Locker</span>
                  </div>
                  <div style="margin-top:6px;font-size:12px;font-weight:700;color:#c9b6dc;letter-spacing:1.5px;text-transform:uppercase;">
                    ${opts.headerTagline}
                  </div>
                </td>
              </tr>

              <!-- Main Content Body -->
              <tr>
                <td style="padding:36px 32px 28px;">
                  ${
                    opts.badgeText
                      ? `<div style="margin-bottom:16px;">
                          <span style="display:inline-block;background:${opts.badgeBg || '#f2e8fa'};color:${opts.badgeColor || '#6f3289'};padding:4px 12px;border-radius:20px;font-size:11px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;">
                            ${opts.badgeText}
                          </span>
                        </div>`
                      : ''
                  }
                  <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#24192e;line-height:1.3;">
                    ${opts.heading}
                  </h1>

                  <div style="font-size:15px;line-height:1.65;color:#4f435c;">
                    ${opts.bodyHtml}
                  </div>

                  ${
                    opts.ctaText && opts.ctaUrl
                      ? `<div style="margin:30px 0 10px;text-align:center;">
                          <a href="${opts.ctaUrl}" style="display:inline-block;background:#2b1836;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:12px;font-size:14px;font-weight:700;letter-spacing:0.5px;">
                            ${opts.ctaText} ↗
                          </a>
                        </div>`
                      : ''
                  }
                </td>
              </tr>

              <!-- Footer Section -->
              <tr>
                <td style="background:#fbf8fd;padding:24px 32px;border-top:1px solid #f0e8f6;text-align:center;font-size:12px;color:#857596;line-height:1.5;">
                  ${opts.extraFooter ? `<div style="margin-bottom:10px;font-size:12px;color:#6b5a7d;">${opts.extraFooter}</div>` : ''}
                  <p style="margin:0;">© ${currentYear} <strong>MediLocker Health Systems</strong>. Sovereign, Zero-Knowledge Health Locker Infrastructure.</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#a595b5;">This is an automated clinical notification. Please do not reply directly to this email.</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

class MailerService {
  private transporter: Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.init();
  }

  private init() {
    const user = env.SMTP_USER?.trim();
    const pass = env.SMTP_PASS ? env.SMTP_PASS.replace(/[\s"']/g, '') : '';

    if (user && pass) {
      try {
        const port = Number(env.SMTP_PORT) || 465;
        const secure = port === 465 ? true : Boolean(env.SMTP_SECURE);

        this.transporter = nodemailer.createTransport({
          host: env.SMTP_HOST || 'smtp.gmail.com',
          port,
          secure,
          auth: {
            user,
            pass,
          },
          connectionTimeout: 5000,
          greetingTimeout: 5000,
          socketTimeout: 5000,
        });
        this.isConfigured = true;
        logger.info(`[MAILER] SMTP Mailer initialized for ${user} via ${env.SMTP_HOST || 'smtp.gmail.com'}:${port} (secure: ${secure})`);

        this.transporter.verify((error) => {
          if (error) {
            logger.warn(`[MAILER] Direct SMTP port connection failed (common on Render Free Tier where ports 465/587 are blocked): ${error.message}`);
          } else {
            logger.info(`[MAILER] SMTP connection verified successfully! Ready to deliver emails.`);
          }
        });
      } catch (err: any) {
        logger.warn('[MAILER] Failed to initialize SMTP transporter:', err?.message);
      }
    } else {
      logger.info('[MAILER] SMTP credentials not provided in environment. Mailer will operate in simulated dev mode.');
    }
  }

  /**
   * Diagnostic verification helper for health check endpoint
   */
  async verifyConnection(): Promise<{ ok: boolean; message: string; activeTransport: string; details?: any }> {
    if (env.RESEND_API_KEY) {
      return { ok: true, message: 'Resend HTTP API configured (HTTPS Port 443, Render compatible)', activeTransport: 'RESEND_API' };
    }
    if (env.BREVO_API_KEY) {
      return { ok: true, message: 'Brevo HTTP API configured (HTTPS Port 443, Render compatible)', activeTransport: 'BREVO_API' };
    }
    if (env.GMAIL_RELAY_URL) {
      return { ok: true, message: 'Google Apps Script HTTPS Relay configured (HTTPS Port 443, Render compatible)', activeTransport: 'GMAIL_RELAY' };
    }
    if (!this.isConfigured || !this.transporter) {
      return {
        ok: false,
        message: 'No email service configured. Please set SMTP_USER & SMTP_PASS, or an HTTP email relay (RESEND_API_KEY / BREVO_API_KEY).',
        activeTransport: 'NONE',
      };
    }
    try {
      await this.transporter.verify();
      return {
        ok: true,
        message: 'Direct SMTP connection verified successfully with mail server.',
        activeTransport: 'SMTP',
        details: { host: env.SMTP_HOST || 'smtp.gmail.com', user: env.SMTP_USER },
      };
    } catch (err: any) {
      return {
        ok: false,
        message: `SMTP verification failed (${err?.message}). Note: Render free tier blocks outbound ports 25, 465, and 587. Consider using RESEND_API_KEY or BREVO_API_KEY.`,
        activeTransport: 'SMTP',
        details: { error: err?.message },
      };
    }
  }

  /**
   * Diagnostic helper to test email delivery
   */
  async sendTestEmail(to: string): Promise<{ ok: boolean; message: string }> {
    const html = renderBaseLayout({
      headerTagline: 'Delivery Diagnostic',
      badgeText: 'Diagnostic Test',
      heading: 'MediLocker Email Operational',
      bodyHtml: `
        <p>This is an automated diagnostic test confirming that your <strong>MediLocker Email Notification Service</strong> is operational!</p>
        <p style="margin-top:12px;">Automated clinical notifications, welcome emails, and OTP passcodes are active in production.</p>
      `,
      ctaText: 'Visit MediLocker Portal',
      ctaUrl: 'https://medi-locker-sih.vercel.app',
    });

    const dispatched = await this.dispatch(to, '[MediLocker] Diagnostic Test Email', html);
    if (dispatched) {
      return { ok: true, message: `Test email successfully dispatched to ${to}` };
    }
    return { ok: false, message: `Failed to dispatch test email to ${to}. Check Render logs for details.` };
  }

  private async dispatch(to: string, subject: string, html: string): Promise<boolean> {
    // 1. If GMAIL_RELAY_URL is provided, send via Google Apps Script HTTPS Relay (Port 443 - works everywhere)
    if (env.GMAIL_RELAY_URL) {
      try {
        const res = await fetch(env.GMAIL_RELAY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, subject, html }),
          redirect: 'follow',
        });
        if (res.ok || res.status === 200 || res.status === 302) {
          logger.info(`[GMAIL RELAY] Email dispatched to ${to} | Subject: "${subject}"`);
          return true;
        } else {
          const txt = await res.text();
          logger.warn(`[GMAIL RELAY] Relay returned non-OK status ${res.status}:`, txt);
        }
      } catch (err: any) {
        logger.warn('[GMAIL RELAY] Relay failed, trying next provider:', err?.message);
      }
    }

    // 2. If RESEND_API_KEY is provided, send via Resend HTTPS API (Port 443)
    if (env.RESEND_API_KEY) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: env.RESEND_FROM || 'MediLocker <onboarding@resend.dev>',
            to: [to],
            subject,
            html,
          }),
        });
        if (res.ok) {
          logger.info(`[RESEND API] Email dispatched to ${to} | Subject: "${subject}"`);
          return true;
        } else {
          const errText = await res.text();
          logger.warn('[RESEND API] Resend returned error:', errText);
        }
      } catch (err: any) {
        logger.warn('[RESEND API] Resend dispatch failed:', err?.message);
      }
    }

    // 3. If BREVO_API_KEY is provided, send via Brevo HTTPS API (Port 443)
    if (env.BREVO_API_KEY) {
      try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': env.BREVO_API_KEY.trim(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: 'MediLocker Health', email: env.SMTP_USER || 'sentridibesh6@gmail.com' },
            to: [{ email: to }],
            subject,
            htmlContent: html,
          }),
        });
        if (res.ok) {
          logger.info(`[BREVO API] Email dispatched to ${to} | Subject: "${subject}"`);
          return true;
        } else {
          const errText = await res.text();
          logger.warn('[BREVO API] Brevo returned error:', errText);
        }
      } catch (err: any) {
        logger.warn('[BREVO API] Brevo dispatch failed:', err?.message);
      }
    }

    // 4. Standard SMTP Transporter (Port 465 / 587)
    if (!this.isConfigured || !this.transporter) {
      logger.info(`[MAILER SIMULATION] SMTP not configured. Email to ${to} bypassed: "${subject}"`);
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: env.SMTP_FROM || `"MediLocker Health" <${env.SMTP_USER}>`,
        to,
        subject,
        html,
      });
      logger.info(`Email dispatched successfully to ${to} | Subject: "${subject}"`);
      return true;
    } catch (error: any) {
      logger.error(`Failed to dispatch email to ${to}:`, error?.message);
      return false;
    }
  }

  async sendWelcomeEmail(params: WelcomeEmailParams): Promise<boolean> {
    const { to, fullName, role, medilockerId } = params;

    const roleName =
      role === 'PATIENT'
        ? 'Patient Personal Health Vault'
        : role === 'DOCTOR'
        ? 'Doctor Healthcare Workspace'
        : 'Hospital Institution Portal';

    const roleGuide =
      role === 'PATIENT'
        ? `<ul style="padding-left:20px;margin:12px 0;">
            <li><strong>Sovereign Vault:</strong> Upload prescriptions, diagnostic tests, and scan reports.</li>
            <li><strong>Consent Shield:</strong> Doctors and hospitals can only access your health data when you provide a 6-digit dynamic passcode.</li>
            <li><strong>Daily Routine:</strong> Active medications automatically populate your daily To-Do adherence checklist.</li>
           </ul>`
        : role === 'DOCTOR'
        ? `<ul style="padding-left:20px;margin:12px 0;">
            <li><strong>Authorized Clinical Sessions:</strong> Request temporary access using the patient's Unit ID.</li>
            <li><strong>Comprehensive EHR:</strong> Inspect past clinical timelines, active medications, and full lab files.</li>
            <li><strong>Direct Consultations:</strong> Receive appointment bookings directly into your workspace.</li>
           </ul>`
        : `<ul style="padding-left:20px;margin:12px 0;">
            <li><strong>Institutional Administration:</strong> Verify clinical departments, empanelled schemes, and doctor credentials.</li>
            <li><strong>Patient Care:</strong> Request temporary inpatient and emergency clinical access with institutional oversight.</li>
           </ul>`;

    const bodyHtml = `
      <p>Dear <strong>${fullName}</strong>,</p>
      <p>Welcome to <strong>MediLocker</strong>! Your registered <strong>${roleName}</strong> account is fully activated in our sovereign health network.</p>

      <div style="background:#f5edf9;border:2px dashed #6f3289;border-radius:14px;padding:22px;text-align:center;margin:24px 0;">
        <span style="font-size:12px;font-weight:800;color:#6f3289;text-transform:uppercase;letter-spacing:1.5px;display:block;margin-bottom:6px;">
          Your Permanent MediLocker Unit ID
        </span>
        <span style="font-size:30px;font-weight:900;color:#2b1836;letter-spacing:3px;font-family:monospace;">
          ${medilockerId}
        </span>
        <small style="display:block;color:#7a6d88;margin-top:8px;font-size:12px;">
          Keep this Unit ID secure. You will need it together with your registered email to sign in to MediLocker.
        </small>
      </div>

      <h3 style="font-size:16px;color:#2b1836;margin:20px 0 8px;">Key Capabilities of Your Account:</h3>
      ${roleGuide}

      <div style="background:#faf8fc;border-radius:12px;padding:14px 18px;margin-top:20px;border:1px solid #eee5f4;">
        <div style="font-size:13px;color:#6b5a7d;">
          <strong>Account Security Reminder:</strong> Never share your passwords or OTPs with anyone. MediLocker staff will never ask for your credentials.
        </div>
      </div>
    `;

    const html = renderBaseLayout({
      headerTagline: 'Welcome to Sovereign Healthcare',
      badgeText: `${role} ACCOUNT ACTIVATED`,
      badgeBg: '#eef7ee',
      badgeColor: '#25632d',
      heading: `Welcome to MediLocker, ${fullName}!`,
      bodyHtml,
      extraFooter: `Account: ${to} · Unit ID: ${medilockerId}`,
    });

    return this.dispatch(to, `Welcome to MediLocker — Your Unit ID is ${medilockerId}`, html);
  }

  async sendAccessRequestEmail(params: AccessRequestEmailParams): Promise<boolean> {
    const { patientEmail, patientName, doctorName, clinicName, durationMinutes, sixDigitCode, codeExpiresAt } = params;

    const durationText =
      durationMinutes >= 1440
        ? `${Math.round(durationMinutes / 1440)} Day(s)`
        : durationMinutes >= 60
        ? `${Math.round(durationMinutes / 60)} Hour(s)`
        : `${durationMinutes} Minutes`;

    const expiryTimeStr = codeExpiresAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const bodyHtml = `
      <p>Dear <strong>${patientName}</strong>,</p>
      <p><strong>Dr. ${doctorName}</strong> (${clinicName}) has requested temporary clinical access to your MediLocker health records.</p>

      <div style="background:#fdf6ec;border-left:4px solid #d97706;padding:16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0 0 6px;font-size:14px;color:#78350f;"><strong>Requested By:</strong> Dr. ${doctorName} · ${clinicName}</p>
        <p style="margin:0 0 6px;font-size:14px;color:#78350f;"><strong>Requested Duration:</strong> ${durationText}</p>
        <p style="margin:0;font-size:14px;color:#78350f;"><strong>Passcode Validity:</strong> 15 Minutes (Expires at ${expiryTimeStr})</p>
      </div>

      <p style="margin-bottom:8px;">If you are currently with the doctor and approve this consultation access, provide them with this 6-digit dynamic code:</p>

      <div style="background:#2b1836;border-radius:16px;padding:22px;text-align:center;margin:20px 0;">
        <span style="font-size:12px;font-weight:700;color:#c9b6dc;text-transform:uppercase;letter-spacing:1.5px;display:block;margin-bottom:6px;">
          Your One-Time Authorization Passcode
        </span>
        <span style="font-size:38px;font-weight:900;color:#ffffff;letter-spacing:10px;font-family:monospace;">
          ${sixDigitCode}
        </span>
        <small style="display:block;color:#d4a8ec;margin-top:8px;font-size:12px;">
          Valid for 15 minutes only. Do not share if you did not request this consultation.
        </small>
      </div>

      <p style="font-size:13px;color:#706380;line-height:1.5;">
        🔒 <strong>Sovereign Consent:</strong> You retain complete ownership of your health locker. You can revoke access at any time from your MediLocker <em>Consent & Access</em> dashboard.
      </p>
    `;

    const html = renderBaseLayout({
      headerTagline: 'Patient Consent & Access Control',
      badgeText: 'CLINICAL ACCESS REQUEST',
      badgeBg: '#fef3c7',
      badgeColor: '#92400e',
      heading: `Dr. ${doctorName} is requesting access to your health vault`,
      bodyHtml,
    });

    return this.dispatch(
      patientEmail,
      `[MediLocker] Access Request: Dynamic Code ${sixDigitCode} for Dr. ${doctorName}`,
      html
    );
  }

  async sendAccessAuthorizedEmail(params: AccessAuthorizedEmailParams): Promise<boolean> {
    const { recipientEmail, recipientName, doctorName, patientName, durationMinutes, expiresAt, role } = params;

    const durationText =
      durationMinutes >= 1440
        ? `${Math.round(durationMinutes / 1440)} Day(s)`
        : durationMinutes >= 60
        ? `${Math.round(durationMinutes / 60)} Hour(s)`
        : `${durationMinutes} Minutes`;

    const expStr = expiresAt.toLocaleString();

    const bodyHtml =
      role === 'PATIENT'
        ? `
        <p>Dear <strong>${recipientName}</strong>,</p>
        <p>This is a confirmation that <strong>Dr. ${doctorName}</strong> has been authorized to access your MediLocker medical records for clinical consultation.</p>

        <div style="background:#eef7ee;border:1px solid #c5e4c6;border-radius:12px;padding:18px;margin:20px 0;">
          <p style="margin:0 0 6px;font-size:14px;color:#1e4620;"><strong>Authorized Provider:</strong> Dr. ${doctorName}</p>
          <p style="margin:0 0 6px;font-size:14px;color:#1e4620;"><strong>Session Duration:</strong> ${durationText}</p>
          <p style="margin:0;font-size:14px;color:#1e4620;"><strong>Session Expires At:</strong> ${expStr}</p>
        </div>

        <p style="font-size:14px;color:#554c60;">
          The doctor can now review your health history, prescriptions, and diagnostic tests. When the timer expires, all access is automatically terminated.
        </p>
      `
        : `
        <p>Dear <strong>Dr. ${doctorName}</strong>,</p>
        <p>Patient <strong>${patientName}</strong> has successfully authorized your clinical access request.</p>

        <div style="background:#eef7ee;border:1px solid #c5e4c6;border-radius:12px;padding:18px;margin:20px 0;">
          <p style="margin:0 0 6px;font-size:14px;color:#1e4620;"><strong>Patient Name:</strong> ${patientName}</p>
          <p style="margin:0 0 6px;font-size:14px;color:#1e4620;"><strong>Authorized Duration:</strong> ${durationText}</p>
          <p style="margin:0;font-size:14px;color:#1e4620;"><strong>Valid Until:</strong> ${expStr}</p>
        </div>

        <p style="font-size:14px;color:#554c60;">
          You may now view the patient's full clinical records, prescriptions, and investigation reports in your Doctor Workspace.
        </p>
      `;

    const html = renderBaseLayout({
      headerTagline: 'Authorized Clinical Consultation',
      badgeText: 'ACCESS AUTHORIZED',
      badgeBg: '#dcfce7',
      badgeColor: '#15803d',
      heading: 'Clinical Consultation Session Active',
      bodyHtml,
    });

    return this.dispatch(recipientEmail, `[MediLocker] Consultation Session Active — Valid until ${expStr}`, html);
  }

  async sendRecordUploadedEmail(params: RecordUploadedEmailParams): Promise<boolean> {
    const { doctorEmail, doctorName, patientName, patientUnitId, documentType, originalFilename } = params;

    const bodyHtml = `
      <p>Dear <strong>Dr. ${doctorName}</strong>,</p>
      <p>A new clinical document has just been uploaded by your patient <strong>${patientName}</strong> under your active consultation session.</p>

      <div style="background:#f4edf9;border-left:4px solid #6f3289;border-radius:8px;padding:18px;margin:20px 0;">
        <p style="margin:0 0 6px;font-size:14px;"><strong>Patient:</strong> ${patientName} (Unit ID: <code style="color:#6f3289;font-weight:700;">${patientUnitId}</code>)</p>
        <p style="margin:0 0 6px;font-size:14px;"><strong>Document Classification:</strong> ${documentType}</p>
        <p style="margin:0 0 6px;font-size:14px;"><strong>File Name:</strong> ${originalFilename}</p>
        <p style="margin:0;font-size:14px;"><strong>Ingested At:</strong> ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      </div>

      <p style="font-size:14px;color:#554c60;">
        This document has been indexed and analyzed by Medi-AI. You can inspect the file and extracted laboratory/prescription findings in your Doctor Portal.
      </p>
    `;

    const html = renderBaseLayout({
      headerTagline: 'Real-Time Health Record Ingestion',
      badgeText: 'NEW RECORD UPLOADED',
      badgeBg: '#f3e8ff',
      badgeColor: '#7e22ce',
      heading: `New ${documentType} uploaded by patient ${patientName}`,
      bodyHtml,
    });

    return this.dispatch(
      doctorEmail,
      `[MediLocker] New ${documentType} uploaded by patient ${patientName}`,
      html
    );
  }

  async sendPatientRecordUploadedEmail(params: PatientRecordUploadedEmailParams): Promise<boolean> {
    const {
      patientEmail,
      patientName,
      patientUnitId,
      documentType,
      originalFilename,
      doctorName,
      clinicName,
      diagnoses,
      medicationsCount,
    } = params;

    const docTypePretty =
      documentType === 'PRESCRIPTION'
        ? 'Medical Prescription'
        : documentType === 'REPORT'
        ? 'Diagnostic Lab Report'
        : documentType === 'SCAN'
        ? 'Clinical Scan / Radiology'
        : 'Health Document';

    const bodyHtml = `
      <p>Dear <strong>${patientName}</strong>,</p>
      <p>Your <strong>${docTypePretty}</strong> has been securely stored in your sovereign MediLocker vault and analyzed by <strong>Medi-AI</strong>.</p>

      <div style="background:#f5edf9;border-left:4px solid #6f3289;border-radius:8px;padding:18px;margin:20px 0;">
        <p style="margin:0 0 6px;font-size:14px;"><strong>Document:</strong> ${originalFilename}</p>
        <p style="margin:0 0 6px;font-size:14px;"><strong>Category:</strong> ${docTypePretty}</p>
        <p style="margin:0 0 6px;font-size:14px;"><strong>Your Unit ID:</strong> <code style="color:#6f3289;font-weight:700;">${patientUnitId}</code></p>
        ${doctorName ? `<p style="margin:0 0 6px;font-size:14px;"><strong>Prescribing Doctor:</strong> Dr. ${doctorName} ${clinicName ? `(${clinicName})` : ''}</p>` : ''}
        ${diagnoses && diagnoses.length > 0 ? `<p style="margin:0 0 6px;font-size:14px;"><strong>Diagnoses Detected:</strong> ${diagnoses.join(', ')}</p>` : ''}
        ${medicationsCount && medicationsCount > 0 ? `<p style="margin:0;font-size:14px;"><strong>Medications Extracted:</strong> ${medicationsCount} medication(s) added to your Daily To-Do Routine</p>` : ''}
      </div>

      <p style="font-size:14px;color:#554c60;">
        You can view this document, track your active medications in your daily To-Do checklist, and share time-bound access with doctors anytime.
      </p>
    `;

    const html = renderBaseLayout({
      headerTagline: 'Sovereign Medical Vault Ingestion',
      badgeText: 'RECORD VAULTED & INDEXED',
      badgeBg: '#ede9fe',
      badgeColor: '#6d28d9',
      heading: `${docTypePretty} Stored in Your MediLocker`,
      bodyHtml,
      ctaText: 'Open Medical Vault',
      ctaUrl: 'https://medi-locker-sih.vercel.app',
      extraFooter: `Unit ID: ${patientUnitId} · Encrypted Storage`,
    });

    return this.dispatch(
      patientEmail,
      `[MediLocker] ${docTypePretty} uploaded successfully (${originalFilename})`,
      html
    );
  }

  async sendAppointmentBookedEmail(params: AppointmentBookedEmailParams): Promise<boolean> {
    const {
      recipientEmail,
      recipientName,
      doctorName,
      specialization,
      clinicName,
      clinicAddress,
      appointmentDate,
      timeSlot,
      reason,
      isDoctor,
    } = params;

    const formattedDate = new Date(appointmentDate).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const bodyHtml = isDoctor
      ? `
      <p>Dear <strong>Dr. ${doctorName}</strong>,</p>
      <p>A new appointment consultation has been scheduled with you by patient <strong>${recipientName}</strong>.</p>

      <div style="background:#eef6fc;border-left:4px solid #1d4ed8;border-radius:8px;padding:18px;margin:20px 0;">
        <p style="margin:0 0 6px;font-size:14px;"><strong>Patient:</strong> ${recipientName}</p>
        <p style="margin:0 0 6px;font-size:14px;"><strong>Date:</strong> ${formattedDate}</p>
        <p style="margin:0 0 6px;font-size:14px;"><strong>Time Slot:</strong> ${timeSlot}</p>
        <p style="margin:0;font-size:14px;"><strong>Reason for Visit:</strong> ${reason || 'General Consultation'}</p>
      </div>

      <p style="font-size:14px;color:#554c60;">
        This appointment has been recorded in your clinical schedule. Please review your portal for patient history.
      </p>
    `
      : `
      <p>Dear <strong>${recipientName}</strong>,</p>
      <p>Your appointment has been successfully booked with <strong>Dr. ${doctorName}</strong>.</p>

      <div style="background:#eef6fc;border-left:4px solid #1d4ed8;border-radius:8px;padding:18px;margin:20px 0;">
        <p style="margin:0 0 6px;font-size:14px;"><strong>Doctor:</strong> Dr. ${doctorName} (${specialization})</p>
        <p style="margin:0 0 6px;font-size:14px;"><strong>Clinic / Hospital:</strong> ${clinicName}</p>
        ${clinicAddress ? `<p style="margin:0 0 6px;font-size:14px;"><strong>Location:</strong> ${clinicAddress}</p>` : ''}
        <p style="margin:0 0 6px;font-size:14px;"><strong>Appointment Date:</strong> ${formattedDate}</p>
        <p style="margin:0 0 6px;font-size:14px;"><strong>Time Slot:</strong> ${timeSlot}</p>
        <p style="margin:0;font-size:14px;"><strong>Reason:</strong> ${reason || 'Consultation'}</p>
      </div>

      <p style="font-size:14px;color:#554c60;">
        Please arrive 10 minutes prior to your consultation time. Have your MediLocker Unit ID ready for seamless clinical check-in.
      </p>
    `;

    const html = renderBaseLayout({
      headerTagline: 'Clinical Appointment Confirmation',
      badgeText: 'APPOINTMENT SCHEDULED',
      badgeBg: '#dbeafe',
      badgeColor: '#1e40af',
      heading: isDoctor
        ? `New Consultation Booked with ${recipientName}`
        : `Appointment Confirmed with Dr. ${doctorName}`,
      bodyHtml,
    });

    return this.dispatch(
      recipientEmail,
      `[MediLocker] Appointment Scheduled with Dr. ${doctorName} on ${formattedDate}`,
      html
    );
  }

  async sendAppointmentStatusEmail(params: AppointmentStatusEmailParams): Promise<boolean> {
    const { patientEmail, patientName, doctorName, appointmentDate, timeSlot, newStatus, notes } = params;

    const formattedDate = new Date(appointmentDate).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const statusBadge =
      newStatus === 'CONFIRMED'
        ? { text: 'CONFIRMED BY DOCTOR', bg: '#dcfce7', color: '#15803d' }
        : newStatus === 'COMPLETED'
        ? { text: 'CONSULTATION COMPLETED', bg: '#e0f2fe', color: '#0369a1' }
        : { text: 'APPOINTMENT CANCELLED', bg: '#fee2e2', color: '#b91c1c' };

    const bodyHtml = `
      <p>Dear <strong>${patientName}</strong>,</p>
      <p>Your appointment with <strong>Dr. ${doctorName}</strong> scheduled for <strong>${formattedDate} at ${timeSlot}</strong> has been updated to:</p>

      <div style="text-align:center;padding:16px;background:#f8f6fb;border-radius:12px;margin:20px 0;">
        <span style="display:inline-block;padding:8px 20px;border-radius:24px;font-size:14px;font-weight:800;background:${statusBadge.bg};color:${statusBadge.color};">
          ${statusBadge.text}
        </span>
        ${notes ? `<p style="margin:12px 0 0;font-size:13px;color:#6b5a7d;"><em>"${notes}"</em></p>` : ''}
      </div>

      <p style="font-size:14px;color:#554c60;">
        You can review your upcoming visits and clinical records anytime from your patient dashboard.
      </p>
    `;

    const html = renderBaseLayout({
      headerTagline: 'Appointment Status Notice',
      badgeText: statusBadge.text,
      badgeBg: statusBadge.bg,
      badgeColor: statusBadge.color,
      heading: `Appointment Status Update: ${newStatus}`,
      bodyHtml,
    });

    return this.dispatch(
      patientEmail,
      `[MediLocker] Appointment with Dr. ${doctorName} is ${newStatus}`,
      html
    );
  }

  async sendCriticalAdverseSymptomEmail(params: CriticalAdverseEmailParams): Promise<boolean> {
    const { patientEmail, patientName, feelingScore, feedback, dateStr } = params;

    const bodyHtml = `
      <p>Dear <strong>${patientName}</strong>,</p>
      <p>You recorded experiencing <strong>severe symptoms / adverse discomfort</strong> (Score ${feelingScore}/5) today (${dateStr}) in your MediLocker daily health log.</p>

      <div style="background:#fef2f2;border:2px solid #ef4444;border-radius:12px;padding:18px;margin:20px 0;">
        <h3 style="margin:0 0 8px;color:#991b1b;font-size:16px;">⚠️ Clinical Safety Protocol Activated</h3>
        <p style="margin:0 0 10px;font-size:14px;color:#7f1d1d;line-height:1.5;">
          • If you are experiencing acute chest pain, severe shortness of breath, sudden facial swelling, or extreme dizziness, <strong>dial 112 or 108 immediately</strong> for emergency medical services.
        </p>
        <p style="margin:0;font-size:14px;color:#7f1d1d;line-height:1.5;">
          • If you started a new prescription recently, this may be an adverse drug reaction. Do not discontinue medications without clinical guidance from your prescribing doctor.
        </p>
      </div>

      ${
        feedback
          ? `<div style="background:#faf8fc;border-radius:10px;padding:12px 16px;margin:16px 0;border:1px solid #eee5f4;">
              <strong style="font-size:13px;color:#2b1836;">Your Notes:</strong>
              <p style="margin:4px 0 0;font-size:13px;color:#6b5a7d;">"${feedback}"</p>
            </div>`
          : ''
      }

      <p style="font-size:14px;color:#554c60;">
        This event has been logged to your clinical timeline and flagged in your daily medication adherence checklist for doctor review.
      </p>
    `;

    const html = renderBaseLayout({
      headerTagline: 'Clinical Safety & Adverse Reaction Watch',
      badgeText: 'ADVERSE SYMPTOM ADVISORY',
      badgeBg: '#fee2e2',
      badgeColor: '#991b1b',
      heading: 'Health & Medication Safety Alert',
      bodyHtml,
    });

    return this.dispatch(
      patientEmail,
      `[MediLocker URGENT] Adverse Symptom Advisory recorded on ${dateStr}`,
      html
    );
  }
}

export const mailerService = new MailerService();
