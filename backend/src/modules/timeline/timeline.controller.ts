import { Request, Response, NextFunction } from 'express';
import { TimelineService } from './timeline.service';

export class TimelineController {
  static async getMyTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await TimelineService.getPatientTimeline(req.user!.userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getFeelings(req: Request, res: Response, next: NextFunction) {
    try {
      const days = req.query.days ? parseInt(String(req.query.days), 10) : 14;
      const result = await TimelineService.getPatientFeelings(req.user!.userId, days);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getEventById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await TimelineService.getTimelineEventById(req.params.id, req.user!.userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await TimelineService.deleteTimelineEvent(req.params.id, req.user!.userId);
      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  }
}
