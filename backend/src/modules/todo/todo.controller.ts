import { Request, Response, NextFunction } from 'express';
import { TodoService } from './todo.service';
import { SeverityColor } from '@prisma/client';
import { z } from 'zod';

const dailyFeelingSchema = z.object({
  feelingScore: z.coerce.number().min(1).max(5),
  severityColor: z.nativeEnum(SeverityColor),
  feedback: z.string().optional(),
});

export class TodoController {
  static async getToday(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await TodoService.getTodayTasks(req.user!.userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async toggleTask(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await TodoService.toggleTask(req.params.id, req.user!.userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async logFeeling(req: Request, res: Response, next: NextFunction) {
    try {
      const { feelingScore, severityColor, feedback } = dailyFeelingSchema.parse(req.body);
      const result = await TodoService.logDailyFeeling(
        req.user!.userId,
        feelingScore,
        severityColor,
        feedback
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
