import { UserRole } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';
import { mailerService } from '../../utils/mailer';

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export const AppointmentStatus = {
  PENDING: 'PENDING' as const,
  CONFIRMED: 'CONFIRMED' as const,
  CANCELLED: 'CANCELLED' as const,
  COMPLETED: 'COMPLETED' as const,
};

export interface DoctorFilterQuery {
  filter?: 'previously_visited' | 'nearby' | 'all';
  specialization?: string;
  search?: string;
}

export class AppointmentsService {
  /**
   * List doctors with rich metadata (previously visited, nearby, experience, degree)
   */
  static async listDoctors(patientUserId?: string, query?: DoctorFilterQuery) {
    const doctors = await prisma.doctorProfile.findMany({
      include: {
        user: {
          select: {
            medilockerId: true,
            email: true,
            phone: true,
            isActive: true,
          },
        },
      },
      orderBy: { yearsExperience: 'desc' },
    });

    let patientCity = '';
    let patientState = '';
    const previouslyVisitedDocProfileIds = new Set<string>();

    if (patientUserId) {
      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: patientUserId },
      });
      if (patientProfile) {
        patientCity = (patientProfile.city || '').trim().toLowerCase();
        patientState = (patientProfile.state || '').trim().toLowerCase();
      }

      const recordsWithDocUnit = await (prisma.medicalRecord as any).findMany({
        where: {
          patientId: patientUserId,
          doctorUnitId: { not: null },
        },
        select: { doctorUnitId: true },
      });

      const doctorUnitIds = (recordsWithDocUnit as any[])
        .map((r: any) => r.doctorUnitId)
        .filter(Boolean) as string[];

      if (doctorUnitIds.length > 0) {
        const matchingDocs = await prisma.doctorProfile.findMany({
          where: {
            user: {
              medilockerId: { in: doctorUnitIds },
            },
          },
          select: { id: true },
        });
        matchingDocs.forEach((d) => previouslyVisitedDocProfileIds.add(d.id));
      }

      const delegations = await prisma.patientAccessDelegation.findMany({
        where: { patientId: patientUserId },
        select: { allottedDoctorId: true },
      });
      delegations.forEach((d) => previouslyVisitedDocProfileIds.add(d.allottedDoctorId));

      const pastAppointments = await (prisma as any).appointment.findMany({
        where: { patientId: patientUserId },
        select: { doctorId: true },
      });
      (pastAppointments as any[]).forEach((a: any) => previouslyVisitedDocProfileIds.add(a.doctorId));
    }

    let mappedDoctors = doctors.map((doc: any) => {
      const docCity = (doc.city || '').trim().toLowerCase();
      const docState = (doc.state || '').trim().toLowerCase();

      const isNearby =
        Boolean(patientCity && docCity && docCity === patientCity) ||
        Boolean(patientState && docState && docState === patientState);

      const isPreviouslyVisited = previouslyVisitedDocProfileIds.has(doc.id);

      return {
        id: doc.id,
        userId: doc.userId,
        medilockerId: doc.user.medilockerId,
        fullName: doc.fullName,
        degree: doc.degree || 'MBBS',
        specialization: doc.specialization,
        yearsExperience: doc.yearsExperience,
        clinicName: doc.clinicName,
        clinicAddress: doc.clinicAddress,
        city: doc.city,
        state: doc.state,
        phone: doc.phone,
        professionalEmail: doc.professionalEmail,
        isPreviouslyVisited,
        isNearby,
      };
    });

    if (query?.filter === 'previously_visited') {
      mappedDoctors = mappedDoctors.filter((d) => d.isPreviouslyVisited);
    } else if (query?.filter === 'nearby') {
      mappedDoctors = mappedDoctors.filter((d) => d.isNearby);
    }

    if (query?.specialization && query.specialization !== 'all') {
      const specLower = query.specialization.trim().toLowerCase();
      mappedDoctors = mappedDoctors.filter((d) =>
        d.specialization.toLowerCase().includes(specLower)
      );
    }

    if (query?.search) {
      const term = query.search.trim().toLowerCase();
      mappedDoctors = mappedDoctors.filter(
        (d) =>
          d.fullName.toLowerCase().includes(term) ||
          d.specialization.toLowerCase().includes(term) ||
          d.clinicName.toLowerCase().includes(term) ||
          d.city.toLowerCase().includes(term) ||
          d.medilockerId.toLowerCase().includes(term)
      );
    }

    mappedDoctors.sort((a, b) => {
      if (a.isPreviouslyVisited && !b.isPreviouslyVisited) return -1;
      if (!a.isPreviouslyVisited && b.isPreviouslyVisited) return 1;
      if (a.isNearby && !b.isNearby) return -1;
      if (!a.isNearby && b.isNearby) return 1;
      return b.yearsExperience - a.yearsExperience;
    });

    return mappedDoctors;
  }

  /**
   * Book a clinical appointment with a doctor
   */
  static async bookAppointment(
    patientUserId: string,
    data: {
      doctorId?: string;
      doctorMedilockerId?: string;
      appointmentDate: string;
      timeSlot: string;
      reason?: string;
      notes?: string;
    }
  ) {
    const { appointmentDate, timeSlot, reason, notes } = data;
    const targetDocId = (data.doctorId || data.doctorMedilockerId || '').trim();

    if (!targetDocId || !appointmentDate || !timeSlot) {
      throw new AppError('Doctor identifier, appointment date, and time slot are required.', 400);
    }

    const doctor = await prisma.doctorProfile.findFirst({
      where: {
        OR: [
          { id: targetDocId },
          { userId: targetDocId },
          { user: { medilockerId: targetDocId } },
        ],
      },
      include: { user: true },
    });

    if (!doctor) {
      throw new AppError('Doctor not found.', 404);
    }

    const parsedDate = new Date(appointmentDate);
    if (isNaN(parsedDate.getTime())) {
      throw new AppError('Invalid appointment date format.', 400);
    }

    const appointment = await (prisma as any).appointment.create({
      data: {
        patientId: patientUserId,
        doctorId: doctor.id,
        appointmentDate: parsedDate,
        timeSlot,
        reason: reason || 'General Consultation',
        notes,
        status: AppointmentStatus.PENDING,
      },
      include: {
        doctor: true,
      },
    });

    logger.info(
      `Appointment booked: Patient ${patientUserId} booked with Dr. ${doctor.fullName} on ${parsedDate.toISOString().slice(0, 10)} (${timeSlot})`
    );

    // Asynchronously dispatch appointment booking emails to patient & doctor
    prisma.user.findUnique({
      where: { id: patientUserId },
      include: { patientProfile: true },
    }).then((patientUser) => {
      if (patientUser) {
        const patientName = patientUser.patientProfile?.fullName || 'Valued Patient';

        mailerService.sendAppointmentBookedEmail({
          recipientEmail: patientUser.email,
          recipientName: patientName,
          doctorName: doctor.fullName,
          specialization: doctor.specialization,
          clinicName: doctor.clinicName || 'Medical Clinic',
          clinicAddress: docAddress(doctor),
          appointmentDate: appointment.appointmentDate.toISOString(),
          timeSlot: appointment.timeSlot,
          reason: appointment.reason || 'General Consultation',
          isDoctor: false,
        }).catch((err) => logger.warn('Patient booking email failed:', err?.message));

        const docEmail = doctor.professionalEmail || doctor.user?.email;
        if (docEmail) {
          mailerService.sendAppointmentBookedEmail({
            recipientEmail: docEmail,
            recipientName: patientName,
            doctorName: doctor.fullName,
            specialization: doctor.specialization,
            clinicName: doctor.clinicName || 'Medical Clinic',
            appointmentDate: appointment.appointmentDate.toISOString(),
            timeSlot: appointment.timeSlot,
            reason: appointment.reason || 'General Consultation',
            isDoctor: true,
          }).catch((err) => logger.warn('Doctor booking notification email failed:', err?.message));
        }
      }
    }).catch(() => {});

    return {
      appointmentId: appointment.id,
      doctorName: doctor.fullName,
      specialization: doctor.specialization,
      clinicName: doctor.clinicName,
      clinicAddress: docAddress(doctor),
      appointmentDate: appointment.appointmentDate,
      timeSlot: appointment.timeSlot,
      status: appointment.status,
      message: `Appointment requested successfully with Dr. ${doctor.fullName}.`,
    };
  }

  /**
   * Get booked appointments for authenticated user (Patient or Doctor)
   */
  static async getMyAppointments(userId: string, userRole: UserRole) {
    if (userRole === UserRole.PATIENT) {
      const appointments = await (prisma as any).appointment.findMany({
        where: { patientId: userId },
        include: {
          doctor: {
            include: { user: { select: { medilockerId: true, phone: true } } },
          },
        },
        orderBy: { appointmentDate: 'desc' },
      });

      return (appointments as any[]).map((a: any) => ({
        id: a.id,
        doctorId: a.doctorId,
        doctorName: a.doctor?.fullName || 'Doctor',
        doctorMedilockerId: a.doctor?.user?.medilockerId || '',
        specialization: a.doctor?.specialization || 'Specialist',
        degree: a.doctor?.degree || 'MBBS',
        clinicName: a.doctor?.clinicName || 'Clinic',
        clinicAddress: docAddress(a.doctor),
        appointmentDate: a.appointmentDate,
        timeSlot: a.timeSlot,
        reason: a.reason,
        status: a.status,
        createdAt: a.createdAt,
      }));
    } else if (userRole === UserRole.DOCTOR) {
      const docProfile = await prisma.doctorProfile.findUnique({
        where: { userId },
      });
      if (!docProfile) throw new AppError('Doctor profile not found.', 404);

      const appointments = await (prisma as any).appointment.findMany({
        where: { doctorId: docProfile.id },
        include: {
          patient: {
            include: { patientProfile: true },
          },
        },
        orderBy: { appointmentDate: 'desc' },
      });

      return (appointments as any[]).map((a: any) => ({
        id: a.id,
        patientId: a.patientId,
        patientName: a.patient?.patientProfile?.fullName || 'Patient',
        patientMedilockerId: a.patient?.medilockerId || '',
        patientPhone: a.patient?.phone || '',
        bloodGroup: a.patient?.patientProfile?.bloodGroup,
        appointmentDate: a.appointmentDate,
        timeSlot: a.timeSlot,
        reason: a.reason,
        status: a.status,
        createdAt: a.createdAt,
      }));
    }

    return [];
  }

  /**
   * Update appointment status (Doctor or Patient)
   */
  static async updateAppointmentStatus(
    userId: string,
    userRole: UserRole,
    appointmentId: string,
    status: AppointmentStatus
  ) {
    const appointment = await (prisma as any).appointment.findUnique({
      where: { id: appointmentId },
      include: { doctor: true },
    });

    if (!appointment) {
      throw new AppError('Appointment not found.', 404);
    }

    if (userRole === UserRole.PATIENT && appointment.patientId !== userId) {
      throw new AppError('Unauthorized to modify this appointment.', 403);
    }

    if (userRole === UserRole.DOCTOR && appointment.doctor.userId !== userId) {
      throw new AppError('Unauthorized to modify this appointment.', 403);
    }

    const updated = await (prisma as any).appointment.update({
      where: { id: appointmentId },
      data: { status },
    });

    // Notify patient of status change (Confirmed / Completed / Cancelled)
    prisma.user.findUnique({
      where: { id: appointment.patientId },
      include: { patientProfile: true },
    }).then((patientUser) => {
      if (patientUser?.email) {
        mailerService.sendAppointmentStatusEmail({
          patientEmail: patientUser.email,
          patientName: patientUser.patientProfile?.fullName || 'Valued Patient',
          doctorName: appointment.doctor.fullName,
          appointmentDate: appointment.appointmentDate.toISOString(),
          timeSlot: appointment.timeSlot,
          newStatus: status,
        }).catch((err) => logger.warn('Appointment status update email failed:', err?.message));
      }
    }).catch(() => {});

    return updated;
  }
}

function docAddress(doc: any) {
  return [doc.clinicAddress, doc.city, doc.state].filter(Boolean).join(', ');
}
