import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { env } from '../../config/env';
import { generateMediLockerId } from '../../utils/idGenerator';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';
import { cacheService } from '../../utils/cache';
import { mailerService } from '../../utils/mailer';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

// Temporary challenge store for WebAuthn in-memory (or Upstash Redis)
const webauthnChallenges = new Map<string, string>();

export class AuthService {
  /**
   * Register a new Patient, Doctor, or Hospital
   */
  static async signup(data: any) {
    const cleanEmail = String(data.email || '').trim().toLowerCase();
    if (!cleanEmail) {
      throw new AppError('Valid email address is required.', 400);
    }

    const existing = await prisma.user.findFirst({
      where: { email: cleanEmail },
    }).catch(() => null);

    if (existing) {
      throw new AppError(`An account with email "${cleanEmail}" is already registered (Associated Unit ID: ${existing.medilockerId}). Duplicate accounts for the same email are not allowed. Please sign in.`, 409);
    }

    let unitId = generateMediLockerId();
    let collisionCheck = await prisma.user.findUnique({ where: { medilockerId: unitId } }).catch(() => null);
    while (collisionCheck) {
      unitId = generateMediLockerId();
      collisionCheck = await prisma.user.findUnique({ where: { medilockerId: unitId } }).catch(() => null);
    }

    let mpinHash: string | null = null;
    const rawSecret = data.mpin || data.password;
    if (rawSecret) {
      mpinHash = await argon2.hash(String(rawSecret), {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      });
    }

    const normalizedRole = String(data.role || 'PATIENT').toUpperCase() as UserRole;

    const user = await prisma.user.create({
      data: {
        medilockerId: unitId,
        email: cleanEmail,
        phone: String(data.phone || ''),
        role: normalizedRole,
        mpinHash,
        isVerified: normalizedRole === UserRole.PATIENT,
      },
    });

    if (normalizedRole === UserRole.PATIENT) {
      const allergiesStr = Array.isArray(data.baselineAllergies)
        ? data.baselineAllergies.filter(Boolean).join(', ')
        : (data.baselineAllergies || data.allergy || data.allergies || null);
      const medsStr = Array.isArray(data.baselineMedications)
        ? data.baselineMedications.filter(Boolean).join(', ')
        : (data.baselineMedications || data.medications || null);
      const historyStr = Array.isArray(data.chronicConditions)
        ? data.chronicConditions.filter(Boolean).join(', ')
        : (data.medicalHistory || data.history || null);
      const emContactName = data.emergencyContactName ||
        (Array.isArray(data.emergencyContacts) && data.emergencyContacts[0]?.name) ||
        (typeof data.emergency === 'string' && !/^\+?[\d\s-]{7,}$/.test(data.emergency) ? data.emergency : 'Emergency Contact');
      const emContactPhone = data.emergencyContactPhone ||
        (Array.isArray(data.emergencyContacts) && data.emergencyContacts[0]?.phone) ||
        data.emergencyContact ||
        (typeof data.emergency === 'string' && /^\+?[\d\s-]{7,}$/.test(data.emergency) ? data.emergency : null);

      await prisma.patientProfile.create({
        data: {
          userId: user.id,
          fullName: data.fullName || data.name || 'Patient',
          dob: data.dob ? new Date(data.dob) : null,
          gender: data.gender || 'Not specified',
          bloodGroup: data.bloodGroup || data.blood || 'Not specified',
          insuranceProvider: data.insuranceProvider || data.insurance || null,
          baselineAllergies: allergiesStr,
          baselineMedications: medsStr,
          medicalHistory: historyStr,
          emergencyContactName: emContactName,
          emergencyContactPhone: emContactPhone,
          addressLine: data.addressLine || data.address || null,
          city: data.city || null,
          state: data.state || null,
          pincode: data.pincode || null,
        },
      });
    } else if (normalizedRole === UserRole.DOCTOR) {
      const regNum = data.registrationNumber || data.registrationNo || `REG-${Date.now().toString().slice(-6)}`;
      const existingDoc = await prisma.doctorProfile.findUnique({
        where: { registrationNumber: regNum },
      }).catch(() => null);

      if (existingDoc) {
        throw new AppError(`Medical Council Registration Number "${regNum}" is already registered. Please check your registration number or sign in.`, 409);
      }

      await prisma.doctorProfile.create({
        data: {
          userId: user.id,
          fullName: data.fullName || data.name || 'Doctor',
          professionalEmail: (data.email || user.email).toLowerCase(),
          phone: String(data.phone || user.phone || ''),
          institutionalDoctorId: data.institutionalDoctorId || data.doctorId || `DOC-${Date.now().toString().slice(-6)}`,
          registrationNumber: regNum,
          specialization: data.specialization || 'General Medicine',
          degree: data.degree || data.doctorDegree || 'MBBS',
          certificateUrl: data.certificateUrl || null,
          registrationDate: data.registrationDate ? new Date(data.registrationDate) : null,
          yearsExperience: Number(data.yearsExperience || data.experience) || 0,
          clinicName: data.clinicName || 'Clinical Practice',
          clinicVerificationRef: data.clinicVerificationRef || data.clinicVerification || null,
          clinicAddress: data.clinicAddress || data.address || 'Medical Facility',
          city: data.city || 'City',
          state: data.state || 'State',
          verificationStatus: 'PENDING_VERIFICATION',
        },
      });
    } else if (normalizedRole === UserRole.HOSPITAL) {
      const licNum = data.license || data.hospitalLicense || data.licenseNumber || `HOSP-${Date.now().toString().slice(-6)}`;
      const hospId = data.hospitalId || `HOS-${Date.now().toString().slice(-6)}`;

      const existingHosp = await prisma.hospitalProfile.findFirst({
        where: {
          OR: [
            { licenseNumber: licNum },
            { hospitalId: hospId },
          ],
        },
      }).catch(() => null);

      if (existingHosp) {
        throw new AppError(`Hospital License Number or Hospital ID is already registered. Please check your credentials.`, 409);
      }

      const schemes = Array.isArray(data.govtSchemesList)
        ? data.govtSchemesList
        : data.govtSchemes
        ? String(data.govtSchemes).split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

      await prisma.hospitalProfile.create({
        data: {
          userId: user.id,
          hospitalName: data.name || data.hospitalName || 'Hospital',
          officialEmail: (data.email || user.email).toLowerCase(),
          phone: String(data.phone || user.phone || ''),
          hospitalId: hospId,
          licenseNumber: licNum,
          registrationDate: data.registrationDate ? new Date(data.registrationDate) : null,
          address: data.address || data.hospitalAddress || 'Hospital Address',
          city: data.city || data.hospitalCity || 'City',
          state: data.state || data.hospitalState || 'State',
          hospitalType: data.hospitalType || 'General Hospital',
          hospitalOwnership: (data.hospitalOwnership || 'PRIVATE').toUpperCase(),
          bedCapacity: Number(data.beds || data.bedCapacity) || 0,
          authorizedRepresentative: data.representative || data.authorizedRepresentative || null,
          managingDirectorName: data.managingDirectorName || data.mdName || null,
          managingDirectorContact: data.managingDirectorContact || data.mdPhone || null,
          govtSchemesAvailable: Boolean(data.govtSchemesAvailable || schemes.length > 0),
          govtSchemesList: schemes,
          registrationCertificateUrl: data.registrationCertificateUrl || null,
          verificationStatus: 'PENDING_VERIFICATION',
          verificationRef: data.verificationRef || data.hospitalVerificationRef || null,
        },
      });
    }

    logger.info(`User registered successfully: ${user.medilockerId} (${user.role})`);

    mailerService
      .sendWelcomeEmail({
        to: user.email,
        fullName: data.name || data.fullName || data.hospitalName || 'Valued User',
        role: user.role,
        medilockerId: user.medilockerId,
      })
      .catch((err) => logger.warn('Background welcome email dispatch failed:', err?.message));

    const token = jwt.sign(
      {
        userId: user.id,
        medilockerId: user.medilockerId,
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    const fullUser = await AuthService.getMe(user.id);

    return {
      token,
      user: fullUser,
      message: 'Account created successfully.',
    };
  }

  /**
   * Configure 6-digit Master MPIN using Argon2id
   */
  static async setupMpin(medilockerId: string, mpin: string) {
    const user = await prisma.user.findUnique({
      where: { medilockerId: medilockerId.toUpperCase() },
    });

    if (!user) {
      throw new AppError('User not found with this MediLocker Unit ID.', 404);
    }

    const hashedMpin = await argon2.hash(mpin, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { mpinHash: hashedMpin },
    });

    logger.info(`MPIN configured for ${user.medilockerId}`);

    return {
      success: true,
      message: '6-digit MPIN set successfully.',
    };
  }

  /**
   * Authenticate via Email + Unit ID
   */
  static async login(
    params: { email?: string; medilockerId?: string; identifier?: string; role?: any; mpin?: string; password?: string } | string,
    roleParam?: any,
    mpinParam?: string
  ) {
    let email = '';
    let medilockerId = '';
    let roleUpper: UserRole = UserRole.PATIENT;
    let mpin: string | undefined;
    let password: string | undefined;

    if (typeof params === 'object') {
      email = String(params.email || '').trim().toLowerCase();
      medilockerId = String(params.medilockerId || '').trim().toUpperCase();
      const identifier = String(params.identifier || '').trim();
      roleUpper = String(params.role || 'PATIENT').toUpperCase() as UserRole;
      mpin = params.mpin;
      password = params.password;

      if (!email && identifier.includes('@')) {
        email = identifier.toLowerCase();
      }
      if (!medilockerId && identifier.toUpperCase().startsWith('ML-')) {
        medilockerId = identifier.toUpperCase();
      }
    } else {
      const cleanId = String(params || '').trim();
      if (cleanId.includes('@')) {
        email = cleanId.toLowerCase();
      } else {
        medilockerId = cleanId.toUpperCase();
      }
      roleUpper = String(roleParam || 'PATIENT').toUpperCase() as UserRole;
      mpin = mpinParam;
    }

    let user;

    if (email) {
      user = await prisma.user.findUnique({
        where: { email },
        include: {
          patientProfile: true,
          doctorProfile: true,
          hospitalProfile: true,
        },
      });
      if (!user) {
        throw new AppError(`No registered account found with email "${email}". Please sign up.`, 401);
      }
    } else if (medilockerId) {
      user = await prisma.user.findUnique({
        where: { medilockerId },
        include: {
          patientProfile: true,
          doctorProfile: true,
          hospitalProfile: true,
        },
      });
      if (!user) {
        throw new AppError(`No registered account found with Unit ID "${medilockerId}".`, 401);
      }
    } else {
      throw new AppError('Email address or Unique Unit ID is required to sign in.', 400);
    }

    if (user.role !== roleUpper) {
      throw new AppError(`This account is registered under the ${user.role} portal. Please select the correct portal tab.`, 403);
    }

    // Check authentication credentials: Password OR Unit ID
    const hasPassword = Boolean(password || mpin);
    const hasUnitId = Boolean(medilockerId);

    if (!hasPassword && !hasUnitId) {
      throw new AppError('Please provide either your Password or your Unique Unit ID (ML-XXXX-XXXX) to sign in.', 400);
    }

    // If Unit ID was provided, verify it matches the user's registered Unit ID
    if (hasUnitId) {
      if (user.medilockerId.toUpperCase() !== medilockerId.toUpperCase()) {
        throw new AppError(`Unit ID mismatch: The provided Unit ID (${medilockerId}) does not match the account associated with email ${user.email}.`, 401);
      }
    }

    // If Password was provided, verify it with Argon2
    if (hasPassword && user.mpinHash) {
      const candidateSecret = String(password || mpin);
      const isPasswordValid = await argon2.verify(user.mpinHash, candidateSecret);
      if (!isPasswordValid) {
        throw new AppError('Invalid password or Security MPIN.', 401);
      }
    }

    const token = jwt.sign(
      {
        userId: user.id,
        medilockerId: user.medilockerId,
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    const name =
      user.patientProfile?.fullName ||
      user.doctorProfile?.fullName ||
      user.hospitalProfile?.hospitalName ||
      'User';

    const resultUser = {
      id: user.id,
      medilockerId: user.medilockerId,
      email: user.email,
      name,
      role: user.role.toUpperCase(),
      phone: user.phone,
      bloodGroup: user.patientProfile?.bloodGroup || 'Not specified',
      allergies: user.patientProfile?.baselineAllergies ? [user.patientProfile.baselineAllergies] : [],
      chronicConditions: user.patientProfile?.medicalHistory ? [user.patientProfile.medicalHistory] : [],
      emergencyContact: {
        name: user.patientProfile?.emergencyContactName || 'Not configured',
        phone: user.phone,
        relation: 'Family',
      },
    };

    cacheService.setUserProfile(user.id, resultUser, 600);
    cacheService.setUserByUnit(user.medilockerId, resultUser, 900);

    return {
      token,
      user: resultUser,
    };
  }

  /**
   * Change existing MPIN
   */
  static async changeMpin(userId: string, oldMpin: string, newMpin: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mpinHash) {
      throw new AppError('MPIN not configured for this account.', 400);
    }

    const isValid = await argon2.verify(user.mpinHash, oldMpin);
    if (!isValid) {
      throw new AppError('Current MPIN is incorrect.', 401);
    }

    const newHash = await argon2.hash(newMpin, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
    });

    await prisma.user.update({
      where: { id: userId },
      data: { mpinHash: newHash },
    });

    return { success: true, message: 'MPIN updated successfully.' };
  }

  /**
   * WebAuthn Biometric Registration: Generate Options
   */
  static async getWebAuthnRegisterOptions(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

    const options = await generateRegistrationOptions({
      rpName: env.WEBAUTHN_RP_NAME,
      rpID: env.WEBAUTHN_RP_ID,
      userID: user.id,
      userName: user.email,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    webauthnChallenges.set(user.id, options.challenge);

    return options;
  }

  /**
   * WebAuthn Biometric Registration: Verify Response
   */
  static async verifyWebAuthnRegister(userId: string, response: any) {
    const expectedChallenge = webauthnChallenges.get(userId);
    if (!expectedChallenge) {
      throw new AppError('Biometric verification challenge expired. Please retry.', 400);
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: env.WEBAUTHN_ORIGIN,
      expectedRPID: env.WEBAUTHN_RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new AppError('Biometric registration verification failed.', 400);
    }

    const { credentialPublicKey, credentialID, counter } = verification.registrationInfo;

    await prisma.user.update({
      where: { id: userId },
      data: {
        webauthnCredentialId: Buffer.from(credentialID).toString('base64url'),
        webauthnPublicKey: Buffer.from(credentialPublicKey).toString('base64url'),
        webauthnSignCount: counter,
      },
    });

    webauthnChallenges.delete(userId);

    return { success: true, message: 'Biometric fingerprint credential enrolled successfully.' };
  }

  /**
   * WebAuthn Biometric Login: Generate Options
   */
  static async getWebAuthnAuthOptions(medilockerId: string) {
    const user = await prisma.user.findUnique({
      where: { medilockerId: medilockerId.toUpperCase() },
    });

    if (!user || !user.webauthnCredentialId) {
      throw new AppError('Biometric authentication is not enrolled for this account.', 400);
    }

    const options = await generateAuthenticationOptions({
      rpID: env.WEBAUTHN_RP_ID,
      allowCredentials: [
        {
          id: Buffer.from(user.webauthnCredentialId, 'base64url'),
          type: 'public-key',
        },
      ],
      userVerification: 'preferred',
    });

    webauthnChallenges.set(user.id, options.challenge);

    return { options, userId: user.id };
  }

  /**
   * WebAuthn Biometric Login: Verify Assertion
   */
  static async verifyWebAuthnAuth(userId: string, response: any) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { patientProfile: true },
    });

    if (!user || !user.webauthnPublicKey || !user.webauthnCredentialId) {
      throw new AppError('User biometric credentials not found.', 400);
    }

    const expectedChallenge = webauthnChallenges.get(userId);
    if (!expectedChallenge) {
      throw new AppError('Biometric login challenge expired.', 400);
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: env.WEBAUTHN_ORIGIN,
      expectedRPID: env.WEBAUTHN_RP_ID,
      authenticator: {
        credentialPublicKey: Buffer.from(user.webauthnPublicKey, 'base64url'),
        credentialID: Buffer.from(user.webauthnCredentialId, 'base64url'),
        counter: user.webauthnSignCount,
      },
    });

    if (!verification.verified) {
      throw new AppError('Biometric authentication failed.', 401);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { webauthnSignCount: verification.authenticationInfo.newCounter },
    });

    webauthnChallenges.delete(userId);

    const token = jwt.sign(
      {
        userId: user.id,
        medilockerId: user.medilockerId,
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    return {
      token,
      user: {
        id: user.id,
        medilockerId: user.medilockerId,
        email: user.email,
        name: user.patientProfile?.fullName || 'Patient',
        role: user.role,
      },
    };
  }

  /**
   * Get authenticated user profile (Accelerated with in-memory / Redis cache)
   */
  static async getMe(userId: string) {
    const cached = await cacheService.getUserProfile(userId);
    if (cached) {
      return cached;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        patientProfile: true,
        doctorProfile: true,
        hospitalProfile: true,
      },
    });

    if (!user) throw new AppError('User not found', 404);

    const name =
      user.patientProfile?.fullName ||
      user.doctorProfile?.fullName ||
      user.hospitalProfile?.hospitalName ||
      'User';

    const result = {
      id: user.id,
      medilockerId: user.medilockerId,
      email: user.email,
      name,
      role: user.role.toUpperCase(),
      phone: user.phone,
      isVerified: user.isVerified,
      patientProfile: user.patientProfile,
      doctorProfile: user.doctorProfile,
      hospitalProfile: user.hospitalProfile,
      bloodGroup: user.patientProfile?.bloodGroup || 'Not specified',
      allergies: user.patientProfile?.baselineAllergies
        ? user.patientProfile.baselineAllergies.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      baselineMedications: user.patientProfile?.baselineMedications
        ? user.patientProfile.baselineMedications.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      chronicConditions: user.patientProfile?.chronicConditions || [],
      emergencyContact: {
        name: user.patientProfile?.emergencyContactName || '',
        phone: user.patientProfile?.emergencyContactPhone || user.phone,
        relation: 'Family',
      },
      dob: user.patientProfile?.dob || null,
      address: user.patientProfile?.addressLine || user.doctorProfile?.clinicAddress || user.hospitalProfile?.address || '',
      city: user.patientProfile?.city || user.doctorProfile?.city || user.hospitalProfile?.city || '',
      state: user.patientProfile?.state || user.doctorProfile?.state || user.hospitalProfile?.state || '',
      pincode: user.patientProfile?.pincode || '',
      insurance: user.patientProfile?.insuranceProvider || '',
      govid: user.patientProfile?.govidEncrypted || '',
      degree: user.doctorProfile?.degree || '',
      specialization: user.doctorProfile?.specialization || '',
      experience: user.doctorProfile?.yearsExperience || 0,
      clinicName: user.doctorProfile?.clinicName || '',
      hospitalType: user.hospitalProfile?.hospitalType || '',
      hospitalOwnership: user.hospitalProfile?.hospitalOwnership || 'PRIVATE',
      bedCapacity: user.hospitalProfile?.bedCapacity || 0,
      managingDirectorName: user.hospitalProfile?.managingDirectorName || '',
      managingDirectorContact: user.hospitalProfile?.managingDirectorContact || '',
      govtSchemesAvailable: user.hospitalProfile?.govtSchemesAvailable || false,
      govtSchemesList: user.hospitalProfile?.govtSchemesList || [],
    };

    cacheService.setUserProfile(userId, result, 600);
    cacheService.setUserByUnit(user.medilockerId, result, 900);

    return result;
  }

  /**
   * Update profile for Patient, Doctor, or Hospital
   */
  static async updateProfile(userId: string, data: any) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        patientProfile: true,
        doctorProfile: true,
        hospitalProfile: true,
      },
    });

    if (!user) throw new AppError('User not found', 404);

    if (data.phone) {
      await prisma.user.update({
        where: { id: userId },
        data: { phone: String(data.phone).trim() },
      });
    }

    if (user.role === UserRole.PATIENT) {
      const allergiesStr = Array.isArray(data.allergies)
        ? data.allergies.join(', ')
        : (data.allergies || data.baselineAllergies || '');
      const medsStr = Array.isArray(data.baselineMedications)
        ? data.baselineMedications.join(', ')
        : (data.medications || data.baselineMedications || '');
      const chronicList = Array.isArray(data.chronicConditions)
        ? data.chronicConditions
        : (data.chronicConditions ? String(data.chronicConditions).split(',').map((s: string) => s.trim()).filter(Boolean) : []);

      await prisma.patientProfile.upsert({
        where: { userId },
        update: {
          fullName: data.fullName || data.name || user.patientProfile?.fullName || 'Patient',
          dob: data.dob ? new Date(data.dob) : user.patientProfile?.dob,
          bloodGroup: data.bloodGroup || user.patientProfile?.bloodGroup,
          baselineAllergies: allergiesStr,
          baselineMedications: medsStr,
          medicalHistory: data.medicalHistory || data.history || user.patientProfile?.medicalHistory,
          chronicConditions: chronicList,
          emergencyContactName: data.emergencyContactName || data.emergencyContact?.name || data.emergency || user.patientProfile?.emergencyContactName,
          emergencyContactPhone: data.emergencyContactPhone || data.emergencyContact?.phone || user.patientProfile?.emergencyContactPhone,
          addressLine: data.addressLine || data.address || user.patientProfile?.addressLine,
          city: data.city || user.patientProfile?.city,
          state: data.state || user.patientProfile?.state,
          pincode: data.pincode || user.patientProfile?.pincode,
          gender: data.gender !== undefined ? data.gender : user.patientProfile?.gender,
          insuranceProvider: data.insuranceProvider || data.insurance || user.patientProfile?.insuranceProvider,
          govidEncrypted: data.govid || user.patientProfile?.govidEncrypted,
        },
        create: {
          userId,
          fullName: data.fullName || data.name || user.email.split('@')[0],
          dob: data.dob ? new Date(data.dob) : null,
          gender: data.gender || 'Not specified',
          bloodGroup: data.bloodGroup || 'Not specified',
          baselineAllergies: allergiesStr,
          baselineMedications: medsStr,
          chronicConditions: chronicList,
          emergencyContactName: data.emergencyContactName || data.emergencyContact?.name || '',
          emergencyContactPhone: data.emergencyContactPhone || data.emergencyContact?.phone || '',
          addressLine: data.addressLine || data.address || '',
          city: data.city || '',
          state: data.state || '',
          pincode: data.pincode || '',
          insuranceProvider: data.insuranceProvider || data.insurance || '',
        },
      });
    } else if (user.role === UserRole.DOCTOR) {
      await prisma.doctorProfile.upsert({
        where: { userId },
        update: {
          fullName: data.fullName || data.name || user.doctorProfile?.fullName,
          degree: data.degree !== undefined ? data.degree : user.doctorProfile?.degree,
          specialization: data.specialization || user.doctorProfile?.specialization,
          yearsExperience: data.experience !== undefined ? Number(data.experience) : user.doctorProfile?.yearsExperience,
          clinicName: data.clinicName || user.doctorProfile?.clinicName,
          clinicAddress: data.clinicAddress || data.address || user.doctorProfile?.clinicAddress,
          city: data.city || user.doctorProfile?.city,
          state: data.state || user.doctorProfile?.state,
          certificateUrl: data.certificateUrl !== undefined ? data.certificateUrl : user.doctorProfile?.certificateUrl,
        },
        create: {
          userId,
          fullName: data.fullName || data.name || 'Doctor',
          professionalEmail: user.email,
          phone: user.phone,
          institutionalDoctorId: `DOC-${Date.now().toString().slice(-6)}`,
          registrationNumber: data.registrationNumber || `REG-${Date.now().toString().slice(-6)}`,
          specialization: data.specialization || 'General Medicine',
          degree: data.degree || null,
          clinicName: data.clinicName || 'Clinic',
          clinicAddress: data.clinicAddress || data.address || 'Address',
          city: data.city || 'City',
          state: data.state || 'State',
        },
      });
    } else if (user.role === UserRole.HOSPITAL) {
      const schemes = Array.isArray(data.govtSchemesList)
        ? data.govtSchemesList
        : data.govtSchemes
        ? String(data.govtSchemes).split(',').map((s: string) => s.trim()).filter(Boolean)
        : user.hospitalProfile?.govtSchemesList || [];

      await prisma.hospitalProfile.upsert({
        where: { userId },
        update: {
          hospitalName: data.hospitalName || data.name || user.hospitalProfile?.hospitalName,
          address: data.address || user.hospitalProfile?.address,
          city: data.city || user.hospitalProfile?.city,
          state: data.state || user.hospitalProfile?.state,
          hospitalType: data.hospitalType || user.hospitalProfile?.hospitalType,
          hospitalOwnership: data.hospitalOwnership ? String(data.hospitalOwnership).toUpperCase() : user.hospitalProfile?.hospitalOwnership,
          bedCapacity: data.bedCapacity !== undefined ? Number(data.bedCapacity) : (data.beds !== undefined ? Number(data.beds) : user.hospitalProfile?.bedCapacity),
          authorizedRepresentative: data.authorizedRepresentative || data.representative || user.hospitalProfile?.authorizedRepresentative,
          managingDirectorName: data.managingDirectorName || data.mdName || user.hospitalProfile?.managingDirectorName,
          managingDirectorContact: data.managingDirectorContact || data.mdPhone || user.hospitalProfile?.managingDirectorContact,
          govtSchemesAvailable: data.govtSchemesAvailable !== undefined ? Boolean(data.govtSchemesAvailable) : user.hospitalProfile?.govtSchemesAvailable,
          govtSchemesList: schemes,
          registrationCertificateUrl: data.registrationCertificateUrl !== undefined ? data.registrationCertificateUrl : user.hospitalProfile?.registrationCertificateUrl,
        },
        create: {
          userId,
          hospitalName: data.hospitalName || data.name || 'Hospital',
          officialEmail: user.email,
          phone: user.phone,
          hospitalId: `HOSP-${Date.now().toString().slice(-6)}`,
          licenseNumber: `LIC-${Date.now().toString().slice(-6)}`,
          address: data.address || 'Address',
          city: data.city || 'City',
          state: data.state || 'State',
          hospitalOwnership: (data.hospitalOwnership || 'PRIVATE').toUpperCase(),
          bedCapacity: Number(data.bedCapacity || data.beds) || 0,
        },
      });
    }

    cacheService.invalidateUserProfile(userId);
    cacheService.invalidateUserByUnit(user.medilockerId);

    return this.getMe(userId);
  }
}
