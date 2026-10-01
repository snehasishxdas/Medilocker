import { Request, Response, NextFunction } from 'express';
import { DelegationService } from './delegation.service';

export class DelegationController {
  /**
   * Search patient by MediLocker Unit ID (Returns ONLY Name & DOB)
   */
  static async searchPatient(req: Request, res: Response, next: NextFunction) {
    try {
      const medilockerId = (req.query.medilockerId || req.body.patientMedilockerId || req.body.medilockerId) as string;
      const result = await DelegationService.searchPatient(medilockerId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Doctor/Hospital sends access request with requested duration (30 mins to 7 days)
   */
  static async createRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientMedilockerId, durationMinutes } = req.body;
      const result = await DelegationService.createAccessRequest(
        req.user!.userId,
        req.user!.role,
        patientMedilockerId,
        Number(durationMinutes) || 120
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Doctor enters 6-digit code provided by patient to unlock records
   */
  static async verifyCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientMedilockerId, authCode } = req.body;
      const result = await DelegationService.verifyAccessCode(
        req.user!.userId,
        req.user!.role,
        patientMedilockerId,
        authCode
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Patient retrieves incoming access requests and active authorizations
   */
  static async getPatientRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DelegationService.getPatientRequests(req.user!.userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Revoke delegation immediately
   */
  static async revokeDelegation(req: Request, res: Response, next: NextFunction) {
    try {
      const delegationId = req.body.delegationId || req.body.id || req.params.id;
      const result = await DelegationService.revokeDelegation(
        req.user!.userId,
        req.user!.role,
        delegationId
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Doctor views list of currently active patients
   */
  static async getActivePatients(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DelegationService.getDoctorActivePatients(req.user!.userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Doctor/Hospital views unexpired pending verification requests
   */
  static async getProviderPendingRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DelegationService.getProviderPendingRequests(
        req.user!.userId,
        req.user!.role
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Doctor views authorized patient's full records and dashboard
   */
  static async getPatientFullData(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DelegationService.getAuthorizedPatientFullData(
        req.user!.userId,
        req.params.patientId,
        req.user!.role
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Hospital/Doctor/Emergency QR code & Unit ID instant triage lookup
   */
  static async emergencyLookup(req: Request, res: Response, next: NextFunction) {
    try {
      const identifier = (req.params.identifier || req.query.identifier || req.body?.identifier || req.body?.medilockerId) as string;
      const accessorId = req.user?.userId;
      const result = await DelegationService.emergencyLookup(identifier, accessorId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Hospital retrieves list of all allocated doctors
   */
  static async getHospitalDoctors(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DelegationService.getHospitalDoctors(req.user!.userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Hospital searches doctors across MediLocker by name, reg number, unit ID, email
   */
  static async searchDoctorsForHospital(req: Request, res: Response, next: NextFunction) {
    try {
      const query = (req.query.query || req.query.q || '') as string;
      const result = await DelegationService.searchDoctorsForHospital(req.user!.userId, query);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Hospital adds / enrolls a doctor to its organization
   */
  static async addDoctorToHospital(req: Request, res: Response, next: NextFunction) {
    try {
      const { doctorIdentifier, department } = req.body;
      const result = await DelegationService.addDoctorToHospital(req.user!.userId, {
        doctorIdentifier,
        department,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Hospital updates doctor affiliation status or department
   */
  static async toggleHospitalDoctor(req: Request, res: Response, next: NextFunction) {
    try {
      const { doctorId } = req.params;
      const { isActive, department } = req.body;
      const result = await DelegationService.toggleHospitalDoctorStatus(
        req.user!.userId,
        doctorId,
        { isActive, department }
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Hospital removes a doctor from its organization
   */
  static async removeDoctorFromHospital(req: Request, res: Response, next: NextFunction) {
    try {
      const { doctorId } = req.params;
      const result = await DelegationService.removeDoctorFromHospital(
        req.user!.userId,
        doctorId
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

