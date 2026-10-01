import { Router } from 'express';
import { DelegationController } from './delegation.controller';
import { authenticate, requireRole } from '../../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = Router();

router.get(
  '/search-patient',
  authenticate,
  requireRole(UserRole.DOCTOR, UserRole.HOSPITAL),
  DelegationController.searchPatient
);
router.post(
  '/search-patient',
  authenticate,
  requireRole(UserRole.DOCTOR, UserRole.HOSPITAL),
  DelegationController.searchPatient
);

router.post(
  '/create-request',
  authenticate,
  requireRole(UserRole.DOCTOR, UserRole.HOSPITAL),
  DelegationController.createRequest
);

router.post(
  '/verify-code',
  authenticate,
  requireRole(UserRole.DOCTOR, UserRole.HOSPITAL),
  DelegationController.verifyCode
);

router.get(
  '/patient-requests',
  authenticate,
  requireRole(UserRole.PATIENT),
  DelegationController.getPatientRequests
);

router.post(
  '/revoke',
  authenticate,
  DelegationController.revokeDelegation
);

router.get(
  '/doctor/active-patients',
  authenticate,
  requireRole(UserRole.DOCTOR, UserRole.HOSPITAL),
  DelegationController.getActivePatients
);

router.get(
  '/provider/pending-requests',
  authenticate,
  requireRole(UserRole.DOCTOR, UserRole.HOSPITAL),
  DelegationController.getProviderPendingRequests
);

router.get(
  '/doctor/patient/:patientId/full-data',
  authenticate,
  requireRole(UserRole.DOCTOR, UserRole.HOSPITAL),
  DelegationController.getPatientFullData
);

// Emergency QR & Unit ID Triage Lookup
router.get(
  '/emergency-lookup/:identifier',
  DelegationController.emergencyLookup
);
router.post(
  '/emergency-lookup',
  DelegationController.emergencyLookup
);

// Hospital Doctor Organization Management
router.get(
  '/hospital/doctors',
  authenticate,
  requireRole(UserRole.HOSPITAL),
  DelegationController.getHospitalDoctors
);

router.get(
  '/hospital/search-doctors',
  authenticate,
  requireRole(UserRole.HOSPITAL),
  DelegationController.searchDoctorsForHospital
);

router.post(
  '/hospital/add-doctor',
  authenticate,
  requireRole(UserRole.HOSPITAL),
  DelegationController.addDoctorToHospital
);

router.patch(
  '/hospital/doctor/:doctorId',
  authenticate,
  requireRole(UserRole.HOSPITAL),
  DelegationController.toggleHospitalDoctor
);

router.delete(
  '/hospital/doctor/:doctorId',
  authenticate,
  requireRole(UserRole.HOSPITAL),
  DelegationController.removeDoctorFromHospital
);

export const delegationRoutes = router;

