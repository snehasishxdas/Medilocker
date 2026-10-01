import fs from 'fs';
import { prisma } from '../../database/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { cacheService } from '../../utils/cache';

export class TimelineService {
  /**
   * Get patient chronological timeline events (Accelerated with SWR cache)
   */
  static async getPatientTimeline(patientUserId: string) {
    const cacheKey = `timeline:${patientUserId}`;

    const { data } = await cacheService.fetchOrCompute(
      cacheKey,
      async () => {
        const events = await prisma.timelineEvent.findMany({
          where: { patientId: patientUserId },
          orderBy: { createdAt: 'desc' },
          include: {
            record: true,
            prescribedMeds: true,
          },
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const feelingLogs = await prisma.dailyFeelingLog.findMany({
          where: { patientId: patientUserId },
          orderBy: { logDate: 'desc' },
          take: 30,
        });

        const todayFeeling = feelingLogs.find((f) => {
          const lDate = new Date(f.logDate);
          return lDate >= today && lDate < tomorrow;
        });

        return {
          timeline: events.map((e) => ({
            id: e.id,
            eventDateDdmmyyyy: e.eventDateDdmmyyyy,
            doctorName: e.doctorName,
            clinicName: e.clinicName,
            diagnoses: e.diagnoses,
            allergiesDetected: e.allergiesDetected,
            clinicalTestsDue: e.clinicalTestsDue,
            clinicalSummary: e.clinicalSummary,
            prescribedMedications: e.prescribedMeds,
            sourceDocument: {
              id: e.record.id,
              filename: e.record.originalFilename,
              mimeType: e.record.mimeType,
              documentType: e.record.documentType,
            },
          })),
          symptomSynopsis: feelingLogs.map((f) => ({
            date: f.logDate.toISOString().split('T')[0],
            severityColor: f.severityColor, // GREEN, ORANGE, RED
            feelingScore: f.feelingScore,
            feedback: f.patientFeedback,
          })),
          todayFeelingSubmitted: Boolean(todayFeeling),
          todayFeeling: todayFeeling ? {
            id: todayFeeling.id,
            feelingScore: todayFeeling.feelingScore,
            severityColor: todayFeeling.severityColor,
            feedback: todayFeeling.patientFeedback,
            date: todayFeeling.logDate.toISOString().split('T')[0],
          } : null,
        };
      },
      { ttlSeconds: 180, swrGraceSeconds: 60 }
    );

    return data;
  }

  /**
   * Get patient recent feeling logs and today's status
   */
  static async getPatientFeelings(patientUserId: string, days = 14) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const logs = await prisma.dailyFeelingLog.findMany({
      where: { patientId: patientUserId },
      orderBy: { logDate: 'desc' },
      take: Math.max(1, Math.min(days, 60)),
    });

    const todayFeeling = logs.find((f) => {
      const lDate = new Date(f.logDate);
      return lDate >= today && lDate < tomorrow;
    });

    return {
      feelings: logs.map((f) => ({
        date: f.logDate.toISOString().split('T')[0],
        severityColor: f.severityColor,
        feelingScore: f.feelingScore,
        feedback: f.patientFeedback,
      })),
      todayFeelingSubmitted: Boolean(todayFeeling),
      todayFeeling: todayFeeling ? {
        id: todayFeeling.id,
        feelingScore: todayFeeling.feelingScore,
        severityColor: todayFeeling.severityColor,
        feedback: todayFeeling.patientFeedback,
        date: todayFeeling.logDate.toISOString().split('T')[0],
      } : null,
    };
  }

  /**
   * Get single timeline card drill-down
   */
  static async getTimelineEventById(eventId: string, userId: string) {
    const event = await prisma.timelineEvent.findFirst({
      where: { id: eventId },
      include: {
        record: true,
        prescribedMeds: true,
      },
    });

    if (!event) {
      throw new AppError('Timeline event not found.', 404);
    }

    return event;
  }

  /**
   * Permanently delete a patient timeline event and associated record
   */
  static async deleteTimelineEvent(eventId: string, userId: string) {
    const event = await prisma.timelineEvent.findFirst({
      where: { id: eventId, patientId: userId },
      include: { record: true },
    });

    if (!event) {
      throw new AppError('Timeline event not found or unauthorized.', 404);
    }

    // Delete linked MedicalRecord if present, which cascades to TimelineEvent & PrescribedMedication
    if (event.recordId) {
      const record = event.record;
      if (record && record.storageKey && fs.existsSync(record.storageKey)) {
        try {
          fs.unlinkSync(record.storageKey);
        } catch (_) {}
      }
      await prisma.medicalRecord.delete({
        where: { id: event.recordId },
      });
    } else {
      await prisma.timelineEvent.delete({
        where: { id: eventId },
      });
    }

    await cacheService.invalidateUserAll(userId);

    return { message: 'Timeline event deleted successfully.' };
  }
}
