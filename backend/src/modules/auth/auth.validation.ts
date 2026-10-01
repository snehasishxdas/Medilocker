import { z } from 'zod';
import { UserRole } from '@prisma/client';

export const patientSignupSchema = z.object({
  role: z.enum([UserRole.PATIENT, 'patient', 'PATIENT']).default(UserRole.PATIENT),
  name: z.string().optional(),
  fullName: z.string().optional(),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(7, 'Valid phone number is required'),
  password: z.string().optional(),
  mpin: z.string().optional(),
  dob: z.string().optional(),
  gender: z.string().optional(),
  blood: z.string().optional(),
  bloodGroup: z.string().optional(),
  govid: z.string().optional(),
  insurance: z.string().optional(),
  allergy: z.any().optional(),
  allergies: z.any().optional(),
  baselineAllergies: z.any().optional(),
  medications: z.any().optional(),
  baselineMedications: z.any().optional(),
  history: z.any().optional(),
  chronicConditions: z.any().optional(),
  emergency: z.any().optional(),
  emergencyContact: z.any().optional(),
  emergencyContacts: z.any().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
}).refine((d) => Boolean(d.name || d.fullName), {
  message: 'Full Name is required',
  path: ['fullName'],
});

export const doctorSignupSchema = z.object({
  role: z.enum([UserRole.DOCTOR, 'doctor', 'DOCTOR']),
  name: z.string().optional(),
  fullName: z.string().optional(),
  email: z.string().email('Professional email is required'),
  phone: z.string().min(7, 'Phone number is required'),
  password: z.string().optional(),
  mpin: z.string().optional(),
  doctorId: z.string().optional(),
  institutionalDoctorId: z.string().optional(),
  registrationNumber: z.string().optional(),
  specialization: z.string().optional(),
  registrationDate: z.string().optional(),
  degree: z.string().optional(),
  doctorDegree: z.string().optional(),
  certificateUrl: z.string().optional(),
  experience: z.coerce.number().optional().default(0),
  clinicName: z.string().optional(),
  clinicVerification: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  verification: z.enum(['PENDING_VERIFICATION', 'VERIFIED']).optional(),
}).refine((d) => Boolean(d.name || d.fullName), {
  message: 'Doctor name is required',
  path: ['fullName'],
});

export const hospitalSignupSchema = z.object({
  role: z.enum([UserRole.HOSPITAL, 'hospital', 'HOSPITAL']),
  name: z.string().optional(),
  fullName: z.string().optional(),
  hospitalName: z.string().optional(),
  email: z.string().email('Official email is required'),
  phone: z.string().min(7, 'Contact number is required'),
  password: z.string().optional(),
  mpin: z.string().optional(),
  hospitalId: z.string().optional(),
  license: z.string().optional(),
  hospitalRegistrationNumber: z.string().optional(),
  registrationDate: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  hospitalType: z.string().optional(),
  beds: z.coerce.number().optional().default(0),
  representative: z.string().optional(),
  verification: z.enum(['PENDING_VERIFICATION', 'VERIFIED']).optional(),
  verificationRef: z.string().optional(),
}).refine((d) => Boolean(d.name || d.fullName || d.hospitalName), {
  message: 'Hospital name is required',
  path: ['hospitalName'],
});

export const signupSchema = z.union([
  patientSignupSchema,
  doctorSignupSchema,
  hospitalSignupSchema,
]);

export const setupMpinSchema = z.object({
  medilockerId: z.string().min(1, 'MediLocker ID is required'),
  mpin: z.string().regex(/^\d{6}$/, 'MPIN must be exactly 6 numeric digits'),
});

export const loginSchema = z.object({
  email: z.string().optional(),
  medilockerId: z.string().optional(),
  identifier: z.string().optional(),
  role: z.nativeEnum(UserRole).or(z.string()),
  mpin: z.string().optional(),
  password: z.string().optional(),
});

export const changeMpinSchema = z.object({
  oldMpin: z.string().regex(/^\d{6}$/, 'Old MPIN must be 6 digits'),
  newMpin: z.string().regex(/^\d{6}$/, 'New MPIN must be 6 digits'),
});
