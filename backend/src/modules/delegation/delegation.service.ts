import { AuthMethod, DelegationStatus, UserRole } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';
import { cacheService } from '../../utils/cache';
import { mailerService } from '../../utils/mailer';

export class DelegationService {
  /**
   * Search patient by MediLocker Unit ID
   * Constraint: Returns ONLY patient name and DOB (no medical records)
   */
  static async searchPatient(medilockerId: string) {
    if (!medilockerId || typeof medilockerId !== 'string') {
      throw new AppError('Patient MediLocker Unit ID is required.', 400);
    }

    const cleanId = medilockerId.trim().toUpperCase();

    const cached = await cacheService.get(`patient:search:${cleanId}`);
    if (cached) {
      return cached;
    }

    const patient = await prisma.user.findUnique({
      where: { medilockerId: cleanId },
      include: {
        patientProfile: {
          select: {
            fullName: true,
            dob: true,
          },
        },
      },
    });

    if (!patient || patient.role !== UserRole.PATIENT) {
      throw new AppError('No registered patient found with this MediLocker Unit ID.', 404);
    }

    const result = {
      medilockerId: patient.medilockerId,
      fullName: patient.patientProfile?.fullName || 'Patient',
      dob: patient.patientProfile?.dob || null,
    };

    cacheService.set(`patient:search:${cleanId}`, result, 900);

    return result;
  }

  /**
   * Doctor or Hospital sends access request with specified duration (30 mins to 7 days)
   * Generates a dynamic 6-digit verification code valid for 15 minutes.
   */
  static async createAccessRequest(
    providerUserId: string,
    providerRole: UserRole,
    patientMedilockerId: string,
    durationMinutes: number
  ) {
    if (!patientMedilockerId) {
      throw new AppError('Patient Unit ID is required.', 400);
    }

    // Validate duration bounds (30 minutes to 7 days = 10080 minutes)
    const validMinutes = Math.max(30, Math.min(10080, Number(durationMinutes) || 120));

    const patient = await prisma.user.findUnique({
      where: { medilockerId: patientMedilockerId.trim().toUpperCase() },
      include: { patientProfile: true },
    });

    if (!patient || patient.role !== UserRole.PATIENT) {
      throw new AppError('No patient found with this MediLocker Unit ID.', 404);
    }

    // Resolve doctor & hospital profile IDs
    let doctorProfileId: string;
    let hospitalProfileId: string | null = null;

    if (providerRole === UserRole.DOCTOR) {
      const docProfile = await prisma.doctorProfile.findUnique({
        where: { userId: providerUserId },
      });
      if (!docProfile) throw new AppError('Doctor profile not found.', 404);
      doctorProfileId = docProfile.id;
    } else {
      const hospProfile = await prisma.hospitalProfile.findUnique({
        where: { userId: providerUserId },
      });
      if (!hospProfile) throw new AppError('Hospital profile not found.', 404);
      hospitalProfileId = hospProfile.id;

      const docMapping = await prisma.hospitalDoctor.findFirst({
        where: { hospitalId: hospProfile.id, isActive: true },
      });
      if (!docMapping) {
        throw new AppError('No active registered doctors found under this hospital.', 400);
      }
      doctorProfileId = docMapping.doctorId;
    }

    // Check if an active unexpired consultation already exists
    const now = new Date();
    const existingActive = await prisma.patientAccessDelegation.findFirst({
      where: {
        patientId: patient.id,
        allottedDoctorId: doctorProfileId,
        status: DelegationStatus.ACTIVE,
        expiresAt: { gt: now },
      },
    });

    if (existingActive) {
      return {
        delegationId: existingActive.id,
        patientMedilockerId: patient.medilockerId,
        patientName: patient.patientProfile?.fullName || 'Patient',
        alreadyActive: true,
        expiresAt: existingActive.expiresAt,
        message: 'Active clinical consultation session is already unlocked and valid for this patient.',
      };
    }

    // Check if an unexpired pending request already exists for this provider and patient (Deduplication)
    const existingPending = await prisma.patientAccessDelegation.findFirst({
      where: {
        patientId: patient.id,
        allottedDoctorId: doctorProfileId,
        status: DelegationStatus.REQUESTED,
        codeExpiresAt: { gt: now },
      },
      include: { allottedDoctor: true },
    });

    if (existingPending) {
      return {
        delegationId: existingPending.id,
        patientMedilockerId: patient.medilockerId,
        patientName: patient.patientProfile?.fullName || 'Patient',
        requestedDurationMinutes: existingPending.requestedDurationMinutes,
        codeExpiresAt: existingPending.codeExpiresAt,
        codeValidityMinutes: Math.max(1, Math.round((existingPending.codeExpiresAt!.getTime() - now.getTime()) / 60000)),
        isExisting: true,
        message: 'A verification request is already pending for this patient. Please enter the 6-digit code provided by the patient.',
      };
    }

    // Generate 6-digit dynamic code
    const sixDigitCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Create the delegation request record
    const delegation = await prisma.patientAccessDelegation.create({
      data: {
        patientId: patient.id,
        hospitalId: hospitalProfileId,
        allottedDoctorId: doctorProfileId,
        authorizationMethod: AuthMethod.MPIN,
        status: DelegationStatus.REQUESTED,
        authCode: sixDigitCode,
        codeExpiresAt,
        requestedDurationMinutes: validMinutes,
      },
      include: {
        allottedDoctor: true,
      },
    });

    logger.info(
      `Access request created: Doctor ${delegation.allottedDoctor?.fullName || 'Doctor'} requested ${validMinutes}m access to patient ${patient.medilockerId}`
    );

    if (patient.email) {
      mailerService
        .sendAccessRequestEmail({
          patientEmail: patient.email,
          patientName: patient.patientProfile?.fullName || 'Valued Patient',
          doctorName: delegation.allottedDoctor?.fullName || 'Healthcare Provider',
          clinicName: delegation.allottedDoctor?.clinicName || 'MediLocker Clinic',
          durationMinutes: validMinutes,
          sixDigitCode,
          codeExpiresAt,
        })
        .catch((err) => logger.warn('Access request email dispatch failed:', err?.message));
    }

    return {
      delegationId: delegation.id,
      patientMedilockerId: patient.medilockerId,
      patientName: patient.patientProfile?.fullName || 'Patient',
      requestedDurationMinutes: validMinutes,
      codeValidityMinutes: 15,
      message: 'Access request sent successfully. Please enter the 6-digit code provided by the patient to complete authorization.',
    };
  }

  /**
   * Get pending verification requests for a doctor or hospital
   */
  static async getProviderPendingRequests(providerUserId: string, providerRole: UserRole) {
    let doctorProfileId: string | null = null;
    let hospitalProfileId: string | null = null;

    if (providerRole === UserRole.DOCTOR) {
      const docProfile = await prisma.doctorProfile.findUnique({
        where: { userId: providerUserId },
      });
      if (!docProfile) throw new AppError('Doctor profile not found.', 404);
      doctorProfileId = docProfile.id;
    } else {
      const hospProfile = await prisma.hospitalProfile.findUnique({
        where: { userId: providerUserId },
      });
      if (!hospProfile) throw new AppError('Hospital profile not found.', 404);
      hospitalProfileId = hospProfile.id;
    }

    const now = new Date();

    const pending = await prisma.patientAccessDelegation.findMany({
      where: {
        status: DelegationStatus.REQUESTED,
        codeExpiresAt: { gt: now },
        OR: [
          doctorProfileId ? { allottedDoctorId: doctorProfileId } : null,
          hospitalProfileId ? { hospitalId: hospitalProfileId } : null,
        ].filter(Boolean) as any,
      },
      include: {
        patient: {
          include: { patientProfile: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return pending.map((d) => {
      const minsLeft = Math.max(1, Math.round((d.codeExpiresAt!.getTime() - now.getTime()) / 60000));
      return {
        delegationId: d.id,
        patientId: d.patient.id,
        patientMedilockerId: d.patient.medilockerId,
        patientName: d.patient.patientProfile?.fullName || 'Patient',
        dob: d.patient.patientProfile?.dob || null,
        requestedDurationMinutes: d.requestedDurationMinutes,
        codeExpiresAt: d.codeExpiresAt,
        minsLeft,
        createdAt: d.createdAt,
      };
    });
  }

  /**
   * Doctor verifies patient's 6-digit authorization code and unlocks full records
   */
  static async verifyAccessCode(
    providerUserId: string,
    providerRole: UserRole,
    patientMedilockerId: string,
    authCode: string
  ) {
    if (!patientMedilockerId || !authCode) {
      throw new AppError('Patient Unit ID and 6-digit authorization code are required.', 400);
    }

    const cleanCode = authCode.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      throw new AppError('Authorization code must be exactly 6 digits.', 400);
    }

    const patient = await prisma.user.findUnique({
      where: { medilockerId: patientMedilockerId.trim().toUpperCase() },
      include: { patientProfile: true },
    });

    if (!patient) {
      throw new AppError('Patient not found.', 404);
    }

    // Resolve doctor profile
    let doctorProfileId: string;
    if (providerRole === UserRole.DOCTOR) {
      const docProfile = await prisma.doctorProfile.findUnique({
        where: { userId: providerUserId },
      });
      if (!docProfile) throw new AppError('Doctor profile not found.', 404);
      doctorProfileId = docProfile.id;
    } else {
      const hospProfile = await prisma.hospitalProfile.findUnique({
        where: { userId: providerUserId },
      });
      if (!hospProfile) throw new AppError('Hospital profile not found.', 404);
      const docMapping = await prisma.hospitalDoctor.findFirst({
        where: { hospitalId: hospProfile.id, isActive: true },
      });
      if (!docMapping) throw new AppError('No registered doctor found.', 400);
      doctorProfileId = docMapping.doctorId;
    }

    const now = new Date();

    // Find pending request matching this patient, doctor, and code
    const delegation = await prisma.patientAccessDelegation.findFirst({
      where: {
        patientId: patient.id,
        allottedDoctorId: doctorProfileId,
        status: DelegationStatus.REQUESTED,
        authCode: cleanCode,
        codeExpiresAt: { gt: now },
      },
      include: {
        allottedDoctor: true,
      },
    });

    if (!delegation) {
      throw new AppError(
        'Invalid or expired 6-digit authorization code. Please verify with the patient or request a new code.',
        401
      );
    }

    // Grant access for the requested duration
    const durationMs = delegation.requestedDurationMinutes * 60 * 1000;
    const expiresAt = new Date(Date.now() + durationMs);

    const updatedDelegation = await prisma.patientAccessDelegation.update({
      where: { id: delegation.id },
      data: {
        status: DelegationStatus.ACTIVE,
        grantedAt: now,
        expiresAt,
      },
      include: {
        allottedDoctor: true,
      },
    });

    // Immutable audit log
    await prisma.auditLog.create({
      data: {
        userId: providerUserId,
        action: 'PATIENT_UNLOCKED_WITH_6DIGIT_CODE',
        resourceType: 'PATIENT_RECORD',
        resourceId: patient.id,
        eventDetails: {
          patientMedilockerId: patient.medilockerId,
          allottedDoctorId: doctorProfileId,
          durationMinutes: delegation.requestedDurationMinutes,
          expiresAt: expiresAt.toISOString(),
        },
      },
    });

    logger.info(`Doctor ${delegation.allottedDoctor?.fullName || 'Doctor'} unlocked patient ${patient.medilockerId} until ${expiresAt.toISOString()}`);

    if (patient.email) {
      mailerService
        .sendAccessAuthorizedEmail({
          recipientEmail: patient.email,
          recipientName: patient.patientProfile?.fullName || 'Valued Patient',
          doctorName: delegation.allottedDoctor?.fullName || 'Doctor',
          patientName: patient.patientProfile?.fullName || 'Patient',
          durationMinutes: delegation.requestedDurationMinutes,
          expiresAt,
          role: 'PATIENT',
        })
        .catch((err) => logger.warn('Access authorized email dispatch failed:', err?.message));
    }

    return {
      success: true,
      message: `Full clinical access granted for ${delegation.requestedDurationMinutes >= 1440 ? `${Math.round(delegation.requestedDurationMinutes / 1440)} day(s)` : `${Math.round(delegation.requestedDurationMinutes / 60)} hour(s)`}.`,
      delegationId: updatedDelegation.id,
      patientId: patient.id,
      patientMedilockerId: patient.medilockerId,
      patientName: patient.patientProfile?.fullName,
      expiresAt,
    };
  }

  /**
   * Patient views all incoming requests and active authorizations
   */
  static async getPatientRequests(patientUserId: string) {
    const now = new Date();

    const delegations = await prisma.patientAccessDelegation.findMany({
      where: {
        patientId: patientUserId,
      },
      include: {
        allottedDoctor: true,
        hospital: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Auto-expire any active delegations past their expiry date
    const pendingRequests = [];
    const activeDelegations = [];
    const pastHistory = [];

    for (const d of delegations) {
      const isCodeExpired = d.codeExpiresAt && d.codeExpiresAt < now;
      const isAccessExpired = d.expiresAt && d.expiresAt < now;

      if (d.status === DelegationStatus.REQUESTED) {
        if (!isCodeExpired) {
          pendingRequests.push({
            id: d.id,
            doctorName: d.allottedDoctor.fullName,
            organization: d.hospital?.hospitalName || d.allottedDoctor.clinicName || 'Independent Medical Practice',
            registrationNumber: d.allottedDoctor.registrationNumber,
            specialization: d.allottedDoctor.specialization,
            authCode: d.authCode,
            codeExpiresAt: d.codeExpiresAt,
            requestedDurationMinutes: d.requestedDurationMinutes,
            status: d.status,
            createdAt: d.createdAt,
          });
        }
      } else if (d.status === DelegationStatus.ACTIVE) {
        if (!isAccessExpired) {
          activeDelegations.push({
            id: d.id,
            doctorName: d.allottedDoctor.fullName,
            organization: d.hospital?.hospitalName || d.allottedDoctor.clinicName || 'Independent Medical Practice',
            registrationNumber: d.allottedDoctor.registrationNumber,
            specialization: d.allottedDoctor.specialization,
            grantedAt: d.grantedAt,
            expiresAt: d.expiresAt,
            requestedDurationMinutes: d.requestedDurationMinutes,
            status: d.status,
          });
        } else {
          // Mark expired in DB
          prisma.patientAccessDelegation.update({
            where: { id: d.id },
            data: { status: DelegationStatus.EXPIRED },
          }).catch(() => {});
        }
      } else {
        pastHistory.push({
          id: d.id,
          doctorName: d.allottedDoctor.fullName,
          organization: d.hospital?.hospitalName || d.allottedDoctor.clinicName || 'Independent Medical Practice',
          status: d.status,
          grantedAt: d.grantedAt,
          revokedAt: d.revokedAt,
          expiresAt: d.expiresAt,
        });
      }
    }

    return {
      pendingRequests,
      activeDelegations,
      pastHistory,
    };
  }

  /**
   * Revoke delegation immediately
   */
  static async revokeDelegation(userId: string, role: UserRole, delegationId: string) {
    const delegation = await prisma.patientAccessDelegation.findUnique({
      where: { id: delegationId },
      include: { allottedDoctor: true },
    });

    if (!delegation) {
      throw new AppError('Delegation record not found.', 404);
    }

    // Patient can revoke their own records; Doctor can revoke their granted access
    if (role === UserRole.PATIENT && delegation.patientId !== userId) {
      throw new AppError('You do not have permission to revoke this delegation.', 403);
    }

    const updated = await prisma.patientAccessDelegation.update({
      where: { id: delegationId },
      data: {
        status: DelegationStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'PATIENT_ACCESS_REVOKED',
        resourceType: 'PATIENT_RECORD',
        resourceId: delegation.patientId,
        eventDetails: {
          delegationId,
          revokedByRole: role,
        },
      },
    });

    return {
      success: true,
      message: 'Access delegation has been revoked immediately.',
      delegationId: updated.id,
    };
  }

  /**
   * Doctor views list of currently authorized patients
   */
  static async getDoctorActivePatients(doctorUserId: string) {
    const docProfile = await prisma.doctorProfile.findUnique({
      where: { userId: doctorUserId },
    });
    if (!docProfile) throw new AppError('Doctor profile not found.', 404);

    const now = new Date();

    const delegations = await prisma.patientAccessDelegation.findMany({
      where: {
        allottedDoctorId: docProfile.id,
        status: DelegationStatus.ACTIVE,
        expiresAt: { gt: now },
      },
      include: {
        patient: {
          include: { patientProfile: true },
        },
      },
      orderBy: { grantedAt: 'desc' },
    });

    return delegations.map((d) => ({
      delegationId: d.id,
      patientId: d.patient.id,
      medilockerId: d.patient.medilockerId,
      fullName: d.patient.patientProfile?.fullName || 'Patient',
      dob: d.patient.patientProfile?.dob,
      bloodGroup: d.patient.patientProfile?.bloodGroup,
      allergies: d.patient.patientProfile?.baselineAllergies,
      expiresAt: d.expiresAt,
    }));
  }

  /**
   * Doctor or Hospital retrieves full patient dashboard & clinical information under active authorization
   */
  static async getAuthorizedPatientFullData(
    providerUserId: string,
    patientMedilockerOrId: string,
    providerRole?: UserRole
  ) {
    let doctorProfileId: string | null = null;
    let hospitalProfileId: string | null = null;

    const docProfile = await prisma.doctorProfile.findUnique({
      where: { userId: providerUserId },
    });

    if (docProfile) {
      doctorProfileId = docProfile.id;
    } else {
      const hospProfile = await prisma.hospitalProfile.findUnique({
        where: { userId: providerUserId },
      });
      if (hospProfile) {
        hospitalProfileId = hospProfile.id;
        const docMapping = await prisma.hospitalDoctor.findFirst({
          where: { hospitalId: hospProfile.id, isActive: true },
        });
        if (docMapping) doctorProfileId = docMapping.doctorId;
      }
    }

    if (!doctorProfileId && !hospitalProfileId) {
      throw new AppError('Healthcare provider profile not found.', 404);
    }

    // Find patient by ID or Unit ID
    const cleanParam = patientMedilockerOrId.trim();
    const patient = await prisma.user.findFirst({
      where: {
        OR: [{ id: cleanParam }, { medilockerId: cleanParam.toUpperCase() }],
      },
      include: {
        patientProfile: true,
        medicalRecords: {
          orderBy: { uploadedAt: 'desc' },
        },
        timelineEvents: {
          orderBy: { createdAt: 'desc' },
          include: { prescribedMeds: true, record: true },
        },
        todoItems: {
          orderBy: { scheduleDate: 'desc' },
          take: 30,
        },
        homeSupplies: {
          orderBy: { addedAt: 'desc' },
        },
        feelingLogs: {
          orderBy: { logDate: 'desc' },
          take: 30,
        },
      },
    });

    if (!patient) {
      throw new AppError('Patient record not found.', 404);
    }

    const now = new Date();

    // Check active authorization
    const activeDelegation = await prisma.patientAccessDelegation.findFirst({
      where: {
        patientId: patient.id,
        status: DelegationStatus.ACTIVE,
        expiresAt: { gt: now },
        OR: [
          ...(doctorProfileId ? [{ allottedDoctorId: doctorProfileId }] : []),
          ...(hospitalProfileId ? [{ hospitalId: hospitalProfileId }] : []),
        ],
      },
    });

    if (!activeDelegation) {
      throw new AppError(
        'Access Denied: Consultation authorization has expired or was revoked by the patient.',
        403
      );
    }

    // Audit log access
    await prisma.auditLog.create({
      data: {
        userId: providerUserId,
        action: 'PROVIDER_VIEWED_PATIENT_FULL_DATA',
        resourceType: 'PATIENT_RECORD',
        resourceId: patient.id,
        eventDetails: {
          delegationId: activeDelegation.id,
          expiresAt: activeDelegation.expiresAt?.toISOString(),
        },
      },
    });

    // Sanitize BigInt fields for JSON serialization
    const sanitizedMedicalRecords = (patient.medicalRecords || []).map((r: any) => ({
      ...r,
      fileSizeBytes: r.fileSizeBytes != null ? r.fileSizeBytes.toString() : '0',
    }));

    const sanitizedTimelineEvents = (patient.timelineEvents || []).map((t: any) => ({
      ...t,
      record: t.record
        ? {
            ...t.record,
            fileSizeBytes: t.record.fileSizeBytes != null ? t.record.fileSizeBytes.toString() : '0',
          }
        : null,
    }));

    return {
      delegation: {
        id: activeDelegation.id,
        expiresAt: activeDelegation.expiresAt,
        status: activeDelegation.status,
      },
      patient: {
        id: patient.id,
        medilockerId: patient.medilockerId,
        email: patient.email,
        phone: patient.phone,
        profile: patient.patientProfile,
      },
      medicalRecords: sanitizedMedicalRecords,
      timelineEvents: sanitizedTimelineEvents,
      todoItems: patient.todoItems,
      homeSupplies: patient.homeSupplies,
      feelingLogs: patient.feelingLogs,
    };
  }

  /**
   * Emergency clinical profile lookup via QR scan or Sovereign Unit ID
   * Delivers immediate life-critical vitals, allergies, blood group, chronic conditions, and emergency contacts.
   */
  static async emergencyLookup(identifier: string, accessorUserId?: string) {
    if (!identifier || typeof identifier !== 'string') {
      throw new AppError('Patient identifier or QR payload is required.', 400);
    }

    const cleanId = identifier.trim();

    // Check if identifier is a JSON string from the QR code
    let parsedUnitId = cleanId;
    try {
      if (cleanId.startsWith('{') && cleanId.endsWith('}')) {
        const parsed = JSON.parse(cleanId);
        if (parsed.unitId) parsedUnitId = parsed.unitId;
      }
    } catch (_) {}

    const patient = await prisma.user.findFirst({
      where: {
        OR: [
          { medilockerId: { equals: parsedUnitId, mode: 'insensitive' } },
          { id: parsedUnitId },
          { email: { equals: parsedUnitId, mode: 'insensitive' } },
          { phone: parsedUnitId },
        ],
      },
      include: {
        patientProfile: true,
        prescribedMeds: {
          where: { isActive: true },
          take: 10,
        },
        timelineEvents: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!patient) {
      throw new AppError('No patient record found matching the scanned QR code or Unit ID.', 404);
    }

    const profile = patient.patientProfile;
    const allergiesList = profile?.baselineAllergies
      ? profile.baselineAllergies.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];
    const chronicList = profile?.medicalHistory
      ? profile.medicalHistory.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];
    const baselineMeds = profile?.baselineMedications
      ? profile.baselineMedications.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    // Derive active prescriptions
    const activePrescriptions = (patient.prescribedMeds || []).map((p: any) => ({
      medicineName: p.medicineName,
      dosage: p.dosage,
      frequency: p.frequency,
      instructions: p.instructions,
    }));

    // Record audit event for emergency access
    if (accessorUserId) {
      await prisma.auditLog.create({
        data: {
          userId: accessorUserId,
          action: 'EMERGENCY_QR_PROFILE_ACCESSED',
          resourceType: 'PATIENT_EMERGENCY_DATA',
          resourceId: patient.id,
          eventDetails: {
            medilockerId: patient.medilockerId,
            timestamp: new Date().toISOString(),
          },
        },
      }).catch(() => {});
    }

    // Check for recent OPD Kiosk intake event
    const latestKioskEvent = patient.timelineEvents.find(
      (e: any) => e.doctorName === 'OPD Triage Kiosk' || e.clinicalSummary?.includes('Kiosk')
    );

    return {
      scheme: 'MEDILOCKER-EMERGENCY-V1',
      patientId: patient.id,
      medilockerId: patient.medilockerId,
      fullName: profile?.fullName || 'Valued Patient',
      dob: profile?.dob || null,
      gender: profile?.gender || 'Not specified',
      bloodGroup: profile?.bloodGroup || 'Not specified',
      allergies: allergiesList,
      chronicConditions: chronicList,
      baselineMedications: baselineMeds,
      activePrescriptions,
      emergencyContact: {
        name: profile?.emergencyContactName || 'Next of Kin',
        phone: profile?.emergencyContactPhone || patient.phone || '102',
      },
      insuranceProvider: profile?.insuranceProvider || null,
      address: {
        city: profile?.city,
        state: profile?.state,
        pincode: profile?.pincode,
      },
      recentDiagnoses: patient.timelineEvents.flatMap((e: any) => (Array.isArray(e.diagnoses) ? e.diagnoses : [])).slice(0, 8),
      latestKioskIntake: latestKioskEvent
        ? {
            doctorName: latestKioskEvent.doctorName,
            clinicName: latestKioskEvent.clinicName,
            diagnoses: latestKioskEvent.diagnoses,
            clinicalSummary: latestKioskEvent.clinicalSummary,
            date: latestKioskEvent.eventDateDdmmyyyy,
            createdAt: latestKioskEvent.createdAt,
          }
        : null,
      accessedAt: new Date().toISOString(),
      isVerified: true,
    };
  }

  /**
   * Get all doctors affiliated under the authenticated hospital organization
   */
  static async getHospitalDoctors(hospitalUserId: string) {
    const hospital = await prisma.hospitalProfile.findUnique({
      where: { userId: hospitalUserId },
    });

    if (!hospital) {
      throw new AppError('Hospital organization profile not found.', 404);
    }

    const hospitalDoctors = await prisma.hospitalDoctor.findMany({
      where: { hospitalId: hospital.id },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                id: true,
                medilockerId: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { allottedAt: 'desc' },
    });

    const doctorsList = hospitalDoctors.map((hd) => ({
      id: hd.id,
      doctorId: hd.doctorId,
      doctorProfileId: hd.doctor.id,
      medilockerId: hd.doctor.user?.medilockerId || 'ML-DOC',
      fullName: hd.doctor.fullName,
      specialization: hd.doctor.specialization,
      registrationNumber: hd.doctor.registrationNumber,
      institutionalDoctorId: hd.doctor.institutionalDoctorId,
      department: hd.department || 'General Medicine',
      isActive: hd.isActive,
      allottedAt: hd.allottedAt,
      phone: hd.doctor.phone || hd.doctor.user?.phone,
      email: hd.doctor.professionalEmail || hd.doctor.user?.email,
      clinicName: hd.doctor.clinicName,
      city: hd.doctor.city,
      yearsExperience: hd.doctor.yearsExperience,
      degree: hd.doctor.degree,
      verificationStatus: hd.doctor.verificationStatus,
    }));

    const departments = Array.from(new Set(doctorsList.map((d) => d.department).filter(Boolean)));

    return {
      hospital: {
        id: hospital.id,
        hospitalName: hospital.hospitalName,
        hospitalId: hospital.hospitalId,
        officialEmail: hospital.officialEmail,
        phone: hospital.phone,
        city: hospital.city,
        state: hospital.state,
      },
      stats: {
        total: doctorsList.length,
        active: doctorsList.filter((d) => d.isActive).length,
        departmentsCount: departments.length,
        departments,
      },
      doctors: doctorsList,
    };
  }

  /**
   * Search doctors across MediLocker for hospital affiliation
   */
  static async searchDoctorsForHospital(hospitalUserId: string, query: string) {
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return { doctors: [] };
    }

    const hospital = await prisma.hospitalProfile.findUnique({
      where: { userId: hospitalUserId },
    });

    if (!hospital) {
      throw new AppError('Hospital organization profile not found.', 404);
    }

    const cleanQuery = query.trim();

    // Fetch matching doctor profiles
    const doctors = await prisma.doctorProfile.findMany({
      where: {
        OR: [
          { fullName: { contains: cleanQuery, mode: 'insensitive' } },
          { specialization: { contains: cleanQuery, mode: 'insensitive' } },
          { registrationNumber: { contains: cleanQuery, mode: 'insensitive' } },
          { professionalEmail: { contains: cleanQuery, mode: 'insensitive' } },
          { user: { medilockerId: { contains: cleanQuery.toUpperCase(), mode: 'insensitive' } } },
          { user: { email: { contains: cleanQuery, mode: 'insensitive' } } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            medilockerId: true,
            email: true,
            phone: true,
          },
        },
        hospitalDoctors: {
          where: { hospitalId: hospital.id },
        },
      },
      take: 20,
    });

    const results = doctors.map((doc) => {
      const affiliation = doc.hospitalDoctors[0] || null;
      return {
        doctorId: doc.id,
        fullName: doc.fullName,
        specialization: doc.specialization,
        registrationNumber: doc.registrationNumber,
        institutionalDoctorId: doc.institutionalDoctorId,
        medilockerId: doc.user?.medilockerId || 'ML-DOC',
        email: doc.professionalEmail || doc.user?.email,
        phone: doc.phone || doc.user?.phone,
        clinicName: doc.clinicName,
        city: doc.city,
        yearsExperience: doc.yearsExperience,
        degree: doc.degree,
        isAffiliated: !!affiliation,
        department: affiliation?.department || null,
        isActive: affiliation ? affiliation.isActive : null,
      };
    });

    return { doctors: results };
  }

  /**
   * Add / affiliate a doctor under hospital organization
   */
  static async addDoctorToHospital(
    hospitalUserId: string,
    data: { doctorIdentifier: string; department?: string }
  ) {
    if (!data.doctorIdentifier) {
      throw new AppError('Doctor Unit ID, Registration Number, or Email is required.', 400);
    }

    const hospital = await prisma.hospitalProfile.findUnique({
      where: { userId: hospitalUserId },
    });

    if (!hospital) {
      throw new AppError('Hospital organization profile not found.', 404);
    }

    const cleanId = data.doctorIdentifier.trim();

    // Look for doctor profile
    const doctor = await prisma.doctorProfile.findFirst({
      where: {
        OR: [
          { id: cleanId },
          { registrationNumber: cleanId },
          { institutionalDoctorId: cleanId },
          { professionalEmail: { equals: cleanId, mode: 'insensitive' } },
          { user: { medilockerId: cleanId.toUpperCase() } },
          { user: { email: { equals: cleanId, mode: 'insensitive' } } },
          { fullName: { equals: cleanId, mode: 'insensitive' } },
        ],
      },
      include: {
        user: true,
      },
    });

    if (!doctor) {
      throw new AppError(
        'Doctor not found. Please verify the Doctor Unit ID, Registration Number, or registered Email.',
        404
      );
    }

    const department = (data.department && data.department.trim()) || 'General Medicine';

    // Upsert into hospitalDoctor table
    const hospitalDoctor = await prisma.hospitalDoctor.upsert({
      where: {
        hospitalId_doctorId: {
          hospitalId: hospital.id,
          doctorId: doctor.id,
        },
      },
      update: {
        department,
        isActive: true,
      },
      create: {
        hospitalId: hospital.id,
        doctorId: doctor.id,
        department,
        isActive: true,
      },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                id: true,
                medilockerId: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    // Record audit event
    await prisma.auditLog.create({
      data: {
        userId: hospitalUserId,
        action: 'HOSPITAL_DOCTOR_ADDED',
        resourceType: 'HOSPITAL_ORGANIZATION',
        resourceId: hospital.id,
        eventDetails: {
          hospitalName: hospital.hospitalName,
          doctorId: doctor.id,
          doctorName: doctor.fullName,
          department,
          timestamp: new Date().toISOString(),
        },
      },
    }).catch(() => {});

    return {
      message: `Dr. ${doctor.fullName} has been successfully added to ${hospital.hospitalName} (${department}).`,
      hospitalDoctor: {
        id: hospitalDoctor.id,
        doctorId: doctor.id,
        fullName: doctor.fullName,
        specialization: doctor.specialization,
        registrationNumber: doctor.registrationNumber,
        department: hospitalDoctor.department,
        isActive: hospitalDoctor.isActive,
        allottedAt: hospitalDoctor.allottedAt,
        medilockerId: doctor.user?.medilockerId,
      },
    };
  }

  /**
   * Update active status or department for an affiliated doctor
   */
  static async toggleHospitalDoctorStatus(
    hospitalUserId: string,
    doctorId: string,
    data: { isActive?: boolean; department?: string }
  ) {
    const hospital = await prisma.hospitalProfile.findUnique({
      where: { userId: hospitalUserId },
    });

    if (!hospital) {
      throw new AppError('Hospital organization profile not found.', 404);
    }

    const record = await prisma.hospitalDoctor.findFirst({
      where: {
        hospitalId: hospital.id,
        OR: [
          { doctorId },
          { id: doctorId },
          { doctor: { registrationNumber: doctorId } },
          { doctor: { user: { medilockerId: doctorId.toUpperCase() } } },
        ],
      },
    });

    if (!record) {
      throw new AppError('Doctor affiliation record not found under this hospital.', 404);
    }

    const updated = await prisma.hospitalDoctor.update({
      where: { id: record.id },
      data: {
        ...(typeof data.isActive === 'boolean' ? { isActive: data.isActive } : {}),
        ...(data.department ? { department: data.department.trim() } : {}),
      },
      include: {
        doctor: true,
      },
    });

    return {
      message: 'Doctor affiliation updated successfully.',
      doctor: {
        id: updated.id,
        doctorId: updated.doctorId,
        fullName: updated.doctor.fullName,
        department: updated.department,
        isActive: updated.isActive,
      },
    };
  }

  /**
   * Remove doctor from hospital organization
   */
  static async removeDoctorFromHospital(hospitalUserId: string, doctorId: string) {
    const hospital = await prisma.hospitalProfile.findUnique({
      where: { userId: hospitalUserId },
    });

    if (!hospital) {
      throw new AppError('Hospital organization profile not found.', 404);
    }

    const record = await prisma.hospitalDoctor.findFirst({
      where: {
        hospitalId: hospital.id,
        OR: [
          { doctorId },
          { id: doctorId },
          { doctor: { registrationNumber: doctorId } },
          { doctor: { user: { medilockerId: doctorId.toUpperCase() } } },
        ],
      },
      include: { doctor: true },
    });

    if (!record) {
      throw new AppError('Doctor affiliation record not found under this hospital.', 404);
    }

    await prisma.hospitalDoctor.delete({
      where: { id: record.id },
    });

    await prisma.auditLog.create({
      data: {
        userId: hospitalUserId,
        action: 'HOSPITAL_DOCTOR_REMOVED',
        resourceType: 'HOSPITAL_ORGANIZATION',
        resourceId: hospital.id,
        eventDetails: {
          hospitalName: hospital.hospitalName,
          doctorId: record.doctorId,
          doctorName: record.doctor.fullName,
          timestamp: new Date().toISOString(),
        },
      },
    }).catch(() => {});

    return {
      message: `Dr. ${record.doctor.fullName} removed from ${hospital.hospitalName}.`,
    };
  }
}
