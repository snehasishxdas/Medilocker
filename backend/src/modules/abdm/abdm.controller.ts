import { Request, Response, NextFunction } from 'express';
import { AbdmService } from './abdm.service';
import { AppError } from '../../middlewares/errorHandler';

export class AbdmController {
  static verifyAbha(req: Request, res: Response, next: NextFunction) {
    try {
      const { qrPayload } = req.body;
      if (!qrPayload) {
        throw new AppError('ABHA QR payload string is required.', 400);
      }
      const data = AbdmService.parseAbhaQr(qrPayload);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async exportFhir(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId || req.user!.userId;
      const bundle = await AbdmService.exportFhirBundle(patientId);
      res.status(200).json({ success: true, bundle });
    } catch (error) {
      next(error);
    }
  }

  static async purgeSession(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const result = await AbdmService.purgeEphemeralSession(userId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
