import { Request, Response, NextFunction } from 'express';
import { KioskService } from './kiosk.service';
import { AppError } from '../../middlewares/errorHandler';

export class KioskController {
  static async submitIntake(req: Request, res: Response, next: NextFunction) {
    try {
      let bodyRegions: string[] = [];
      if (Array.isArray(req.body.bodyRegions) && req.body.bodyRegions.length > 0) {
        bodyRegions = req.body.bodyRegions;
      } else if (typeof req.body.anatomicalRegion === 'string' && req.body.anatomicalRegion.trim()) {
        bodyRegions = req.body.anatomicalRegion.split(',').map((s: string) => s.trim()).filter(Boolean);
      } else if (Array.isArray(req.body.anatomicalRegion) && req.body.anatomicalRegion.length > 0) {
        bodyRegions = req.body.anatomicalRegion;
      }

      if (bodyRegions.length === 0) {
        throw new AppError('At least one anatomical body region must be selected.', 400);
      }

      let symptoms: string[] = [];
      if (Array.isArray(req.body.symptoms) && req.body.symptoms.length > 0) {
        symptoms = req.body.symptoms;
      } else if (typeof req.body.complaint === 'string' && req.body.complaint.trim()) {
        symptoms = req.body.complaint.split(',').map((s: string) => s.trim()).filter(Boolean);
      } else if (Array.isArray(req.body.complaint) && req.body.complaint.length > 0) {
        symptoms = req.body.complaint;
      }

      if (symptoms.length === 0) {
        throw new AppError('At least one symptom icon must be selected.', 400);
      }

      const painScale = Number(req.body.painScale || (req.body.severity ? Math.round(Number(req.body.severity) / 2) : 1)) || 1;
      const guestName = req.body.guestName || req.body.patientName;
      const guestPhone = req.body.guestPhone || req.body.phone;
      const age = req.body.age ? Number(req.body.age) : undefined;
      const gender = req.body.gender;
      const audioNote = req.body.audioNote;
      const dialect = req.body.dialect;

      const loggedInUserId = (req as any).user?.userId;
      const result = await KioskService.submitIntake(
        {
          bodyRegions,
          symptoms,
          painScale,
          guestName,
          guestPhone,
          age,
          gender,
          audioNote,
          dialect,
        },
        loggedInUserId
      );

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
