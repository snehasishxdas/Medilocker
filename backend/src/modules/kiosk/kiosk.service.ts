import { prisma } from '../../database/prisma';
import { AIService } from '../ai/ai.service';
import { cacheService } from '../../utils/cache';
import { logger } from '../../utils/logger';
import { AppError } from '../../middlewares/errorHandler';

export interface KioskIntakePayload {
  patientId?: string;
  guestName?: string;
  guestPhone?: string;
  age?: number;
  gender?: string;
  bodyRegions: string[]; // e.g. ['Head', 'Chest', 'Abdomen', 'Joints', 'Skin']
  symptoms: string[]; // e.g. ['Fever', 'Sharp Pain', 'Cough', 'Burning', 'Stiffness']
  painScale: number; // 1 to 5
  audioNote?: string;
  dialect?: string;
}

export class KioskService {
  static async submitIntake(payload: KioskIntakePayload, loggedInUserId?: string) {
    const targetUserId = loggedInUserId || payload.patientId;
    const ticketNumber = `OPD-K-${Math.floor(1000 + Math.random() * 9000)}`;
    const intakeTime = new Date();

    const complaintSummary = `${payload.bodyRegions.join(', ')}: ${payload.symptoms.join(', ')} (Pain: ${payload.painScale}/5)`;

    // Map into dual codes (NAMASTE + ICD-11 TM2)
    const doubleCodes = await AIService.doubleCodeDiagnosis({
      complaintOrDiagnosis: complaintSummary,
      language: payload.dialect || 'hi',
    }).catch(() => null);

    // Predict likely conditions & necessary tests
    const predictions = await AIService.predictDiseasesAndTests({
      socrates: {
        site: payload.bodyRegions.join(', '),
        character: payload.symptoms.join(', '),
        severity: payload.painScale * 2,
        notes: payload.audioNote,
      },
      patientContext: {
        age: payload.age,
        gender: payload.gender,
      },
      language: payload.dialect || 'hi',
    }).catch(() => null);

    let createdRecordId: string | null = null;
    let finalUserId = targetUserId;

    if (!finalUserId) {
      try {
        const guestMediId = `ML-OPD-${Math.floor(1000 + Math.random() * 9000)}`;
        const guestUser = await prisma.user.create({
          data: {
            medilockerId: guestMediId,
            email: `kiosk-${ticketNumber.toLowerCase()}@medilocker.in`,
            phone: payload.guestPhone || `9000${Math.floor(100000 + Math.random() * 900000)}`,
            role: 'PATIENT',
            patientProfile: {
              create: {
                fullName: payload.guestName || 'OPD Walk-in Patient',
                gender: payload.gender || 'UNSPECIFIED',
              },
            },
          },
        });
        finalUserId = guestUser.id;
        logger.info(`Auto-provisioned walk-in patient for kiosk ticket ${ticketNumber}: ${guestMediId}`);
      } catch (err: any) {
        logger.warn('Auto-provisioning walk-in kiosk patient failed:', err?.message);
      }
    }

    if (finalUserId) {
      try {
        const userExists = await prisma.user.findUnique({ where: { id: finalUserId } });
        if (userExists) {
          const record = await prisma.medicalRecord.create({
            data: {
              patientId: finalUserId,
              originalFilename: `Kiosk_Intake_${ticketNumber}.json`,
              storageKey: `kiosk/${ticketNumber}`,
              mimeType: 'application/json',
              fileSizeBytes: BigInt(JSON.stringify(payload).length),
              sha256Checksum: ticketNumber,
              documentType: 'OTHER',
              userNote: `Low-Literacy OPD Kiosk Self-Intake: ${complaintSummary}`,
              processingStatus: 'COMPLETED',
            },
          });

          createdRecordId = record.id;

          const dd = String(intakeTime.getDate()).padStart(2, '0');
          const mm = String(intakeTime.getMonth() + 1).padStart(2, '0');
          const yyyy = intakeTime.getFullYear();

          await prisma.timelineEvent.create({
            data: {
              recordId: record.id,
              patientId: finalUserId,
              eventDateDdmmyyyy: `${dd}${mm}${yyyy}`,
              doctorName: 'OPD Triage Kiosk',
              clinicName: 'Ayush Digital OPD',
              diagnoses: payload.symptoms,
              clinicalSummary: `Patient presented with ${complaintSummary}. Dual code: ${doubleCodes?.nationalMorbidityCode?.term || 'Clinical Complaint'}.`,
            },
          });

          await cacheService.invalidateUserAll(finalUserId);
        }
      } catch (err: any) {
        logger.warn('Failed to associate kiosk ticket with user profile:', err?.message);
      }
    }

    let userMedilockerId = 'ML-OPD-WALKIN';
    let userFullName = payload.guestName || 'Walk-in Patient';
    if (finalUserId) {
      try {
        const u = await prisma.user.findUnique({
          where: { id: finalUserId },
          include: { patientProfile: true },
        });
        if (u) {
          userMedilockerId = u.medilockerId;
          if (u.patientProfile?.fullName) userFullName = u.patientProfile.fullName;
        }
      } catch (_) {}
    }

    const isRedEmergency = payload.painScale >= 4 || payload.bodyRegions.some((r) => r.toLowerCase().includes('chest') || r.toLowerCase().includes('heart'));
    const triageCategory = isRedEmergency ? 'RED' : payload.painScale >= 3 ? 'YELLOW' : 'GREEN';

    return {
      ticketNumber,
      tokenNumber: ticketNumber,
      intakeTime: intakeTime.toISOString(),
      complaintSummary,
      complaint: complaintSummary,
      priorityTriage: isRedEmergency ? 'HIGH / URGENT' : 'ROUTINE',
      triageCategory,
      patientName: userFullName,
      medilockerId: userMedilockerId,
      doubleCodes,
      predictions,
      recordId: createdRecordId,
    };
  }
}
