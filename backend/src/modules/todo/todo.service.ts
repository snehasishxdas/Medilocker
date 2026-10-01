import { SeverityColor, TimeSlot } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';
import { cacheService } from '../../utils/cache';
import { mailerService } from '../../utils/mailer';

export class TodoService {
  /**
   * Get today's medication to-do items and adherence stats
   */
  static async getTodayTasks(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dateKey = today.toISOString().slice(0, 10);
    const cacheKey = `todo:today:${userId}:${dateKey}`;

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch or generate tasks for today if not already generated
    let tasks = await prisma.dailyTodoItem.findMany({
      where: {
        patientId: userId,
        scheduleDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: { medication: true },
      orderBy: { createdAt: 'asc' },
    });

    if (tasks.length === 0) {
      // Auto-generate for today if active prescriptions exist
      await this.generateDailyTasksForPatient(userId, today);
      tasks = await prisma.dailyTodoItem.findMany({
        where: {
          patientId: userId,
          scheduleDate: {
            gte: today,
            lt: tomorrow,
          },
        },
        include: { medication: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    const completed = tasks.filter((t) => t.isCompleted).length;
    const total = tasks.length;
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Check if today's feeling log has been submitted
    const todayFeeling = await prisma.dailyFeelingLog.findFirst({
      where: {
        patientId: userId,
        logDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // Calculate adherence streak (consecutive days with completed logs)
    const streakDays = await this.calculateStreak(userId);

    const result = {
      tasks,
      stats: {
        total,
        completed,
        progressPercent,
        streakDays,
        todayFeelingSubmitted: Boolean(todayFeeling),
        todayFeeling: todayFeeling || null,
      },
    };

    // Cache today's tasks for 5 minutes with SWR
    cacheService.set(cacheKey, result, 300, 60);

    return result;
  }

  /**
   * Toggle a medication task completed/uncompleted
   */
  static async toggleTask(taskId: string, userId: string) {
    const task = await prisma.dailyTodoItem.findFirst({
      where: { id: taskId, patientId: userId },
    });

    if (!task) {
      throw new AppError('Task not found.', 404);
    }

    const updated = await prisma.dailyTodoItem.update({
      where: { id: taskId },
      data: {
        isCompleted: !task.isCompleted,
        completedAt: !task.isCompleted ? new Date() : null,
      },
    });

    // Invalidate cached tasks for this user across L1 & L2
    await cacheService.invalidatePrefix(`todo:today:${userId}`);

    return updated;
  }

  /**
   * Log evening feeling response ("How was your day? Feeling better or not?")
   */
  static async logDailyFeeling(
    userId: string,
    feelingScore: number,
    severityColor: SeverityColor,
    feedback?: string
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const log = await prisma.dailyFeelingLog.upsert({
      where: {
        patientId_logDate: {
          patientId: userId,
          logDate: today,
        },
      },
      update: {
        feelingScore,
        severityColor,
        patientFeedback: feedback,
      },
      create: {
        patientId: userId,
        logDate: today,
        feelingScore,
        severityColor,
        patientFeedback: feedback,
      },
    });

    // Invalidate cached tasks & stats AND timeline heat strip for this user
    await Promise.allSettled([
      cacheService.invalidatePrefix(`todo:today:${userId}`),
      cacheService.invalidatePrefix(`timeline:${userId}`),
    ]);

    logger.info(`Daily feeling logged for user ${userId}: ${severityColor} (Score: ${feelingScore})`);

    // If severe symptoms or adverse reaction reported, send urgent patient advisory email
    if (severityColor === SeverityColor.RED) {
      prisma.user.findUnique({
        where: { id: userId },
        include: { patientProfile: true },
      }).then((u) => {
        if (u) {
          mailerService.sendCriticalAdverseSymptomEmail({
            patientEmail: u.email,
            patientName: u.patientProfile?.fullName || 'Valued Patient',
            feelingScore,
            feedback,
            dateStr: today.toLocaleDateString('en-GB'),
          }).catch((err) => logger.warn('Critical adverse symptom email failed:', err?.message));
        }
      }).catch(() => {});
    }

    return log;
  }

  /**
   * Generates tasks for active ongoing prescriptions for a patient
   */
  static async generateDailyTasksForPatient(userId: string, date: Date) {
    const activeMeds = await prisma.prescribedMedication.findMany({
      where: {
        patientId: userId,
        isActive: true,
        courseStartDate: { lte: date },
        courseEndDate: { gte: date },
      },
    });

    for (const med of activeMeds) {
      const frequency = med.frequency.toLowerCase();

      // Morning dose
      if (frequency.includes('1-') || frequency.includes('once') || frequency.includes('morning')) {
        await prisma.dailyTodoItem.create({
          data: {
            patientId: userId,
            medicationId: med.id,
            scheduleDate: date,
            timeSlot: TimeSlot.MORNING,
            taskLabel: `${med.medicineName} (${med.dosage}) - Morning after breakfast`,
          },
        });
      }

      // Afternoon dose
      if (frequency.includes('-1-') || frequency.includes('twice') || frequency.includes('afternoon')) {
        await prisma.dailyTodoItem.create({
          data: {
            patientId: userId,
            medicationId: med.id,
            scheduleDate: date,
            timeSlot: TimeSlot.AFTERNOON,
            taskLabel: `${med.medicineName} (${med.dosage}) - Afternoon after lunch`,
          },
        });
      }

      // Night dose
      if (frequency.includes('-1') || frequency.includes('bedtime') || frequency.includes('night')) {
        await prisma.dailyTodoItem.create({
          data: {
            patientId: userId,
            medicationId: med.id,
            scheduleDate: date,
            timeSlot: TimeSlot.NIGHT,
            taskLabel: `${med.medicineName} (${med.dosage}) - Night after dinner`,
          },
        });
      }
    }
  }

  /**
   * Midnight 12:00 AM Batch Reset across all patients
   */
  static async renewAllMidnightTodos() {
    logger.info('Executing midnight 12:00 AM To-Do renewal job across all active patients.');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const patients = await prisma.user.findMany({
      where: { role: 'PATIENT', isActive: true },
      select: { id: true },
    });

    for (const p of patients) {
      try {
        await this.generateDailyTasksForPatient(p.id, today);
      } catch (err: any) {
        logger.error(`Error generating daily tasks for patient ${p.id}:`, err?.message);
      }
    }
  }

  private static async calculateStreak(userId: string): Promise<number> {
    const logs = await prisma.dailyFeelingLog.findMany({
      where: { patientId: userId },
      orderBy: { logDate: 'desc' },
      take: 14,
    });
    return logs.length;
  }
}
