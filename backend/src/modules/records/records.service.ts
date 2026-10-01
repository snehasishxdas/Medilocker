import crypto from 'crypto';
import { DocumentType, ProcessingStatus } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { uploadMedicalDocument } from '../../utils/storage';
import { AIService } from '../ai/ai.service';
import { logger } from '../../utils/logger';
import { AppError } from '../../middlewares/errorHandler';
import { cacheService } from '../../utils/cache';
import { mailerService } from '../../utils/mailer';
import path from 'path';
import fs from 'fs';

export class RecordsService {
  /**
   * Ingest and process a new medical prescription, report, or scan
   */
  static async uploadAndProcess(
    userId: string,
    file: Express.Multer.File,
    documentType: DocumentType,
    note?: string,
    eventDate?: string,
    isMedicineStillNeeded?: boolean,
    doctorUnitId?: string
  ) {
    const sha256Checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const uploadResult = await uploadMedicalDocument(file.buffer, file.originalname, file.mimetype);
    const cleanDoctorUnitId = doctorUnitId ? doctorUnitId.trim().toUpperCase() : null;

    const record = await prisma.medicalRecord.create({
      data: {
        patientId: userId,
        originalFilename: file.originalname,
        storageKey: uploadResult.storageKey,
        fileUrl: uploadResult.url,
        doctorUnitId: cleanDoctorUnitId,
        mimeType: file.mimetype,
        fileSizeBytes: BigInt(uploadResult.bytes),
        sha256Checksum,
        documentType,
        userNote: note,
        processingStatus: ProcessingStatus.PROCESSING,
      },
    });

    logger.info(`Document uploaded: ${record.id} (${record.documentType}) for user ${userId}`);

    // Check for active consultations and alert authorized doctors via SMTP email
    prisma.patientAccessDelegation.findMany({
      where: {
        patientId: userId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      include: {
        allottedDoctor: true,
        patient: { include: { patientProfile: true } },
      },
    }).then((delegations) => {
      for (const del of delegations) {
        if (del.allottedDoctor?.professionalEmail) {
          mailerService.sendRecordUploadedEmail({
            doctorEmail: del.allottedDoctor.professionalEmail,
            doctorName: del.allottedDoctor.fullName,
            patientName: del.patient.patientProfile?.fullName || 'Patient',
            patientUnitId: del.patient.medilockerId,
            documentType: record.documentType,
            originalFilename: record.originalFilename,
            recordId: record.id,
          }).catch((err) => logger.warn('Failed to notify doctor by email:', err?.message));
        }
      }
    }).catch(() => {});

    // Invalidate user records cache immediately so the newly uploaded file appears in the UI
    await cacheService.invalidateUserAll(userId);

    // Run AI OCR and extraction asynchronously in background so HTTP response is instant (<400ms)
    this.processExtractionAsync(
      record,
      uploadResult,
      userId,
      file.buffer,
      file.mimetype,
      file.originalname,
      note,
      eventDate,
      isMedicineStillNeeded
    ).catch((err) => {
      logger.error(`Background AI extraction error for record ${record.id}:`, err?.message);
    });

    return {
      record: {
        ...record,
        fileSizeBytes: record.fileSizeBytes.toString(),
        url: uploadResult.url,
      },
      status: ProcessingStatus.PROCESSING,
      message: 'Document securely vaulted. AI clinical extraction is processing in the background.',
    };
  }

  /**
   * Asynchronous background extraction worker (Zero UI blocking)
   */
  private static async processExtractionAsync(
    record: any,
    uploadResult: any,
    userId: string,
    fileBuffer: Buffer,
    mimeType: string,
    originalFilename: string,
    note?: string,
    eventDate?: string,
    isMedicineStillNeeded?: boolean
  ) {
    try {
      const extracted = await AIService.analyzeDocument(fileBuffer, mimeType, originalFilename, note);

      let finalEventDate = extracted.eventDateDdmmyyyy;
      if (eventDate) {
        const clean = eventDate.replace(/[^0-9]/g, '');
        if (clean.length === 8) {
          if (eventDate.includes('-') && eventDate.startsWith('20')) {
            const parts = eventDate.split('-');
            finalEventDate = `${parts[2]}${parts[1]}${parts[0]}`;
          } else {
            finalEventDate = clean;
          }
        }
      }

      const timelineEvent = await prisma.timelineEvent.create({
        data: {
          recordId: record.id,
          patientId: userId,
          eventDateDdmmyyyy: finalEventDate,
          doctorName: extracted.doctorName,
          clinicName: extracted.clinicName,
          diagnoses: extracted.diagnoses,
          allergiesDetected: extracted.allergiesDetected,
          clinicalTestsDue: extracted.clinicalTestsDue,
          clinicalSummary: extracted.clinicalSummary,
        },
      });

      const isStillNeeded = isMedicineStillNeeded !== false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (extracted.prescribedMedications && extracted.prescribedMedications.length > 0) {
        for (const med of extracted.prescribedMedications) {
          const startDate = med.courseStartDate ? new Date(med.courseStartDate) : new Date();
          const endDate = med.courseEndDate ? new Date(med.courseEndDate) : new Date(Date.now() + 5 * 86400000);

          const createdMed = await prisma.prescribedMedication.create({
            data: {
              timelineEventId: timelineEvent.id,
              patientId: userId,
              medicineName: med.medicineName,
              activeSalt: med.activeSalt,
              dosage: med.dosage || 'As directed',
              frequency: med.frequency || '1-0-1',
              route: med.route || 'Oral',
              timingInstruction: med.timingInstruction || 'After food',
              courseStartDate: startDate,
              courseEndDate: endDate,
              totalQuantityNeeded: Number(med.totalQuantityNeeded) || 10,
              isActive: isStillNeeded,
            },
          });

          const isTodayWithinCourse = isStillNeeded && (startDate <= today && today <= endDate);
          if (isTodayWithinCourse) {
            const freq = (med.frequency || '').toLowerCase();
            const timing = (med.timingInstruction || '').toLowerCase();

            if (freq.includes('1-') || freq.includes('morning') || freq.includes('once') || timing.includes('breakfast') || timing.includes('morning') || (!freq && !timing)) {
              await prisma.dailyTodoItem.create({
                data: {
                  patientId: userId,
                  medicationId: createdMed.id,
                  scheduleDate: today,
                  timeSlot: 'MORNING',
                  taskLabel: `${med.medicineName} (${med.dosage || '1 tab'}) - Morning after breakfast`,
                  isCompleted: false,
                },
              });
            }

            if (freq.includes('-1-') || freq.includes('afternoon') || freq.includes('twice') || freq.includes('thrice') || timing.includes('lunch')) {
              await prisma.dailyTodoItem.create({
                data: {
                  patientId: userId,
                  medicationId: createdMed.id,
                  scheduleDate: today,
                  timeSlot: 'AFTERNOON',
                  taskLabel: `${med.medicineName} (${med.dosage || '1 tab'}) - Afternoon after lunch`,
                  isCompleted: false,
                },
              });
            }

            if (freq.includes('-1') || freq.includes('night') || freq.includes('bedtime') || timing.includes('dinner') || timing.includes('bedtime')) {
              await prisma.dailyTodoItem.create({
                data: {
                  patientId: userId,
                  medicationId: createdMed.id,
                  scheduleDate: today,
                  timeSlot: 'NIGHT',
                  taskLabel: `${med.medicineName} (${med.dosage || '1 tab'}) - Night after dinner`,
                  isCompleted: false,
                },
              });
            }
          }
        }
      }

      if (Array.isArray(extracted.clinicalTestsDue) && extracted.clinicalTestsDue.length > 0) {
        for (const test of extracted.clinicalTestsDue) {
          const testName = typeof test === 'string' ? test : test.testName || 'Clinical Investigation';
          const dueDays = typeof test === 'object' && test.dueWithinDays ? ` (within ${test.dueWithinDays} days)` : '';
          await prisma.dailyTodoItem.create({
            data: {
              patientId: userId,
              scheduleDate: new Date(),
              timeSlot: 'MORNING',
              taskLabel: `⚗ Diagnostic Test Due: ${testName}${dueDays}`,
              isCompleted: false,
            },
          });
        }
      }

      await prisma.medicalRecord.update({
        where: { id: record.id },
        data: { processingStatus: ProcessingStatus.COMPLETED },
      });

      logger.info(`Medi-AI extraction completed for record ${record.id}, timeline event ${timelineEvent.id}`);
      await cacheService.invalidateUserAll(userId);

      // Dispatch confirmation email to patient with AI extraction findings
      prisma.user.findUnique({
        where: { id: userId },
        include: { patientProfile: true },
      }).then((patientUser) => {
        if (patientUser?.email) {
          const diagnosesList = Array.isArray(extracted.diagnoses)
            ? extracted.diagnoses.map((d: any) => typeof d === 'string' ? d : d.condition || d.diagnosis).filter(Boolean)
            : [];
          mailerService.sendPatientRecordUploadedEmail({
            patientEmail: patientUser.email,
            patientName: patientUser.patientProfile?.fullName || 'Valued Patient',
            patientUnitId: patientUser.medilockerId,
            documentType: record.documentType,
            originalFilename: record.originalFilename,
            doctorName: extracted.doctorName || undefined,
            clinicName: extracted.clinicName || undefined,
            diagnoses: diagnosesList,
            medicationsCount: extracted.prescribedMedications?.length || 0,
          }).catch((err) => logger.warn('Failed to send patient record upload email:', err?.message));
        }
      }).catch(() => {});
    } catch (aiError: any) {
      logger.error(`Medi-AI extraction failed for record ${record.id}:`, aiError?.message);
      await prisma.medicalRecord.update({
        where: { id: record.id },
        data: { processingStatus: ProcessingStatus.FAILED },
      });
      await cacheService.invalidateUserAll(userId);
    }
  }

  /**
   * Get realtime processing status for an uploaded document
   */
  static async getRecordStatus(userId: string, recordId: string) {
    const record = await prisma.medicalRecord.findFirst({
      where: { id: recordId, patientId: userId },
      include: {
        timelineEvent: {
          include: { prescribedMeds: true },
        },
      },
    });

    if (!record) {
      throw new AppError('Medical record not found.', 404);
    }

    return {
      id: record.id,
      processingStatus: record.processingStatus,
      documentType: record.documentType,
      originalFilename: record.originalFilename,
      timelineEvent: record.timelineEvent,
      uploadedAt: record.uploadedAt,
    };
  }

  /**
   * Manually record a prescription or clinical document
   */
  static async createManualRecord(userId: string, data: any) {
    const docType = (data.category?.toUpperCase() === 'PRESCRIPTION' || data.recordType?.toUpperCase() === 'PRESCRIPTION'
      ? DocumentType.PRESCRIPTION
      : data.category?.toUpperCase() === 'LAB REPORT' || data.recordType?.toUpperCase() === 'REPORT'
      ? DocumentType.REPORT
      : DocumentType.OTHER) as DocumentType;

    const today = new Date();
    const currentDdmmyyyy = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${today.getFullYear()}`;

    const record = await prisma.medicalRecord.create({
      data: {
        patientId: userId,
        originalFilename: `manual_entry_${Date.now()}.json`,
        storageKey: 'manual_submission',
        mimeType: 'application/json',
        fileSizeBytes: BigInt(0),
        sha256Checksum: crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex'),
        documentType: docType,
        userNote: data.clinicalSummary || data.diagnosis || data.title || 'Manual patient record',
        processingStatus: ProcessingStatus.COMPLETED,
      },
    });

    let diagnosesList = Array.isArray(data.diagnoses)
      ? data.diagnoses
      : [data.diagnoses || data.title || 'General Clinical Consultation'];

    const noteText = data.clinicalSummary || data.diagnosis || data.title || '';
    if ((!data.prescribedMedications || data.prescribedMedications.length === 0) && noteText.length > 5) {
      try {
        const extracted = await AIService.analyzeClinicalText(noteText, currentDdmmyyyy);
        if (extracted.prescribedMedications && extracted.prescribedMedications.length > 0) {
          data.prescribedMedications = extracted.prescribedMedications;
        }
        if (extracted.doctorName && extracted.doctorName !== 'Attending Physician') {
          data.doctorName = extracted.doctorName;
        }
        if (extracted.diagnoses && extracted.diagnoses.length > 0) {
          diagnosesList = extracted.diagnoses;
        }
      } catch (_) {}
    }

    const timelineEvent = await prisma.timelineEvent.create({
      data: {
        recordId: record.id,
        patientId: userId,
        eventDateDdmmyyyy: data.eventDateDdmmyyyy || currentDdmmyyyy,
        doctorName: data.doctorName || 'Attending Physician',
        clinicName: data.clinicName || 'MediLocker Vault',
        diagnoses: diagnosesList,
        allergiesDetected: data.allergiesDetected || [],
        clinicalTestsDue: data.clinicalTestsDue || data.testsDue || [],
        clinicalSummary: data.clinicalSummary || data.diagnosis || data.title || '',
      },
    });

    if (Array.isArray(data.prescribedMedications) && data.prescribedMedications.length > 0) {
      for (const med of data.prescribedMedications) {
        if (!med.medicineName) continue;
        const createdMed = await prisma.prescribedMedication.create({
          data: {
            timelineEventId: timelineEvent.id,
            patientId: userId,
            medicineName: med.medicineName,
            activeSalt: med.activeSalt || 'Active formula',
            dosage: med.dosage || '1 tablet',
            frequency: med.frequency || '1-0-1',
            route: med.route || 'Oral',
            timingInstruction: med.timing || med.timingInstruction || 'After food',
            courseStartDate: new Date(),
            courseEndDate: new Date(Date.now() + 7 * 86400000),
            totalQuantityNeeded: Number(med.totalQuantityNeeded) || 10,
            isActive: true,
          },
        });

        const freq = (med.frequency || '').toLowerCase();
        const timing = (med.timing || med.timingInstruction || '').toLowerCase();

        if (freq.includes('1-') || freq.includes('morning') || freq.includes('once') || timing.includes('breakfast') || timing.includes('morning') || (!freq && !timing)) {
          await prisma.dailyTodoItem.create({
            data: {
              patientId: userId,
              medicationId: createdMed.id,
              scheduleDate: new Date(),
              timeSlot: 'MORNING',
              taskLabel: `${med.medicineName} (${med.dosage || '1 tab'}) - Morning after breakfast`,
              isCompleted: false,
            },
          });
        }

        if (freq.includes('-1-') || freq.includes('afternoon') || freq.includes('twice') || freq.includes('thrice') || timing.includes('lunch')) {
          await prisma.dailyTodoItem.create({
            data: {
              patientId: userId,
              medicationId: createdMed.id,
              scheduleDate: new Date(),
              timeSlot: 'AFTERNOON',
              taskLabel: `${med.medicineName} (${med.dosage || '1 tab'}) - Afternoon after lunch`,
              isCompleted: false,
            },
          });
        }

        if (freq.includes('-1') || freq.includes('night') || freq.includes('bedtime') || timing.includes('dinner') || timing.includes('bedtime')) {
          await prisma.dailyTodoItem.create({
            data: {
              patientId: userId,
              medicationId: createdMed.id,
              scheduleDate: new Date(),
              timeSlot: 'NIGHT',
              taskLabel: `${med.medicineName} (${med.dosage || '1 tab'}) - Night after dinner`,
              isCompleted: false,
            },
          });
        }

        // Automatic Cross-Module Sync: Stock in Medicine Cabinet & Setup 2-Day Refill Alert
        try {
          await prisma.medicineInventoryHome.create({
            data: {
              patientId: userId,
              medicineName: med.medicineName,
              activeSalt: med.activeSalt || 'Active formula',
              quantityAvailable: Number(med.totalQuantityNeeded) || 15,
              expiryDate: new Date(Date.now() + 180 * 86400000),
              batchNumber: `RX-${Date.now().toString().slice(-4)}`,
              scanMethod: 'MANUAL',
              aiCategory: 'Prescribed Course',
            },
          });

          const dailyRate = freq.includes('-1-') ? 3 : freq.includes('-1') ? 2 : 1;
          const daysSupply = Math.floor((Number(med.totalQuantityNeeded) || 15) / dailyRate);
          const depDate = new Date(Date.now() + daysSupply * 86400000);
          const alertDate = new Date(depDate.getTime() - 2 * 86400000);

          await prisma.refillReminder.create({
            data: {
              patientId: userId,
              medicationId: createdMed.id,
              purchasedQuantity: Number(med.totalQuantityNeeded) || 15,
              remainingQuantity: Number(med.totalQuantityNeeded) || 15,
              dailyConsumptionRate: dailyRate,
              estimatedDepletionDate: depDate,
              alertDate,
              isAlertTriggered: false,
              epharmacyLink: `https://www.1mg.com/search/all?name=${encodeURIComponent(med.medicineName)}`,
            },
          });
        } catch (invErr: any) {
          logger.warn('Auto-stocking prescribed medicine failed:', invErr?.message);
        }
      }
    }


    const testsList = data.clinicalTestsDue || data.testsDue || [];
    if (Array.isArray(testsList) && testsList.length > 0) {
      for (const test of testsList) {
        const testName = typeof test === 'string' ? test : test.testName || 'Clinical Investigation';
        const dueDays = typeof test === 'object' && test.dueWithinDays ? ` (within ${test.dueWithinDays} days)` : '';
        await prisma.dailyTodoItem.create({
          data: {
            patientId: userId,
            scheduleDate: new Date(),
            timeSlot: 'MORNING',
            taskLabel: `⚗ Diagnostic Test Due: ${testName}${dueDays}`,
            isCompleted: false,
          },
        });
      }
    }

    await cacheService.invalidateUserAll(userId);

    return {
      record: {
        ...record,
        fileSizeBytes: record.fileSizeBytes.toString(),
      },
      timelineEvent,
    };
  }

  /**
   * List medical records with type filter (Accelerated with cache)
   */
  static async listRecords(userId: string, filter?: string) {
    const cacheKey = `records:list:${userId}:${filter || 'all'}`;

    const { data } = await cacheService.fetchOrCompute(
      cacheKey,
      async () => {
        const where: any = { patientId: userId };
        if (filter && filter !== 'all') {
          where.documentType = filter.toUpperCase() as DocumentType;
        }

        const records = await prisma.medicalRecord.findMany({
          where,
          orderBy: { uploadedAt: 'desc' },
          include: {
            timelineEvent: {
              include: { prescribedMeds: true },
            },
          },
        });

        return records.map((r) => {
          const event = r.timelineEvent;
          const uploadedDdmmyyyy = r.uploadedAt.toLocaleDateString('en-GB').replace(/\//g, '');
          return {
            id: r.id,
            category: r.documentType === 'PRESCRIPTION' ? 'Prescription' : r.documentType === 'REPORT' ? 'Lab Report' : 'Medical Record',
            dateFormatted: r.uploadedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            eventDateDdmmyyyy: event?.eventDateDdmmyyyy || uploadedDdmmyyyy,
            doctorName: event?.doctorName || 'Attending Physician',
            clinicName: event?.clinicName || 'MediLocker Vault',
            diagnoses: event?.diagnoses || ['Clinical Record'],
            clinicalSummary: event?.clinicalSummary || r.userNote || 'Sovereign clinical record.',
            prescribedMedications: (event?.prescribedMeds || []).map((m) => ({
              medicineName: m.medicineName,
              dosage: m.dosage,
              frequency: m.frequency,
              timing: m.timingInstruction,
            })),
            testsDue: event?.clinicalTestsDue || [],
            storageKey: r.storageKey,
            mimeType: r.mimeType,
            uploadedAt: r.uploadedAt,
          };
        });
      },
      { ttlSeconds: 180, swrGraceSeconds: 60 }
    );

    return data;
  }

  /**
   * Get single medical record details
   */
  static async getRecordById(recordId: string, userId: string) {
    const record = await prisma.medicalRecord.findFirst({
      where: { id: recordId, patientId: userId },
      include: {
        timelineEvent: {
          include: { prescribedMeds: true },
        },
      },
    });

    if (!record) {
      throw new AppError('Medical record not found.', 404);
    }

    return {
      ...record,
      fileSizeBytes: record.fileSizeBytes.toString(),
    };
  }

  /**
   * Securely retrieve medical document file / URL for patient or authorized doctor/hospital
   */
  static async getSecureRecordView(userId: string, userRole: string, recordId: string) {
    const record = await prisma.medicalRecord.findUnique({
      where: { id: recordId },
      include: {
        patient: {
          include: { patientProfile: true },
        },
        timelineEvent: {
          include: { prescribedMeds: true },
        },
      },
    });

    if (!record) {
      throw new AppError('Medical record not found.', 404);
    }

    if (userRole === 'PATIENT') {
      if (record.patientId !== userId) {
        throw new AppError('Unauthorized access to medical record.', 403);
      }
      return record;
    }

    const now = new Date();
    let authorized = false;

    if (userRole === 'DOCTOR') {
      const docProfile = await prisma.doctorProfile.findUnique({
        where: { userId },
      });
      if (docProfile) {
        const activeDel = await prisma.patientAccessDelegation.findFirst({
          where: {
            patientId: record.patientId,
            allottedDoctorId: docProfile.id,
            status: 'ACTIVE',
            expiresAt: { gt: now },
          },
        });
        if (activeDel) authorized = true;
      }
    } else if (userRole === 'HOSPITAL') {
      const hospProfile = await prisma.hospitalProfile.findUnique({
        where: { userId },
      });
      if (hospProfile) {
        const activeDel = await prisma.patientAccessDelegation.findFirst({
          where: {
            patientId: record.patientId,
            hospitalId: hospProfile.id,
            status: 'ACTIVE',
            expiresAt: { gt: now },
          },
        });
        if (activeDel) authorized = true;
      }
    }

    if (!authorized) {
      throw new AppError('Access Denied: You do not have active consultation authorization to view this document.', 403);
    }

    return record;
  }

  /**
   * Permanently delete a patient's medical record and linked files
   */
  static async deleteRecord(recordId: string, userId: string) {
    const record = await prisma.medicalRecord.findFirst({
      where: { id: recordId, patientId: userId },
    });

    if (!record) {
      throw new AppError('Medical record not found or you are not authorized to delete it.', 404);
    }

    if (record.storageKey && fs.existsSync(record.storageKey)) {
      try {
        fs.unlinkSync(record.storageKey);
      } catch (_) {}
    }

    await prisma.medicalRecord.delete({
      where: { id: recordId },
    });

    // Invalidate all caches across modules for this user
    await cacheService.invalidateUserAll(userId);

    return { message: 'Medical record deleted successfully.' };
  }
}
