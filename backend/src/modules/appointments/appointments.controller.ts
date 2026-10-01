import { Request, Response, NextFunction } from 'express';
import { AppointmentsService, DoctorFilterQuery, AppointmentStatus } from './appointments.service';
import { UserRole } from '@prisma/client';
import { AppError } from '../../middlewares/errorHandler';

export class AppointmentsController {
  static async listDoctors(req: Request, res: Response, next: NextFunction) {
    try {
      const patientUserId = req.user?.userId;
      let filterParam = req.query.filter as any;
      if (!filterParam) {
        if (req.query.previouslyVisited === 'true' || req.query.previously_visited === 'true') {
          filterParam = 'previously_visited';
        } else if (req.query.nearby === 'true') {
          filterParam = 'nearby';
        }
      }

      const query: DoctorFilterQuery = {
        filter: filterParam,
        specialization: (req.query.specialization || req.query.specialty) as string,
        search: (req.query.search || req.query.q) as string,
      };

      const doctors = await AppointmentsService.listDoctors(patientUserId, query);
      res.status(200).json({ success: true, data: doctors });
    } catch (error) {
      next(error);
    }
  }

  static async bookAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.user!.role !== UserRole.PATIENT) {
        throw new AppError('Only patients can book doctor appointments.', 403);
      }

      const result = await AppointmentsService.bookAppointment(req.user!.userId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getMyAppointments(req: Request, res: Response, next: NextFunction) {
    try {
      const appointments = await AppointmentsService.getMyAppointments(
        req.user!.userId,
        req.user!.role
      );
      res.status(200).json({ success: true, data: appointments });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];
      if (!status || !validStatuses.includes(status.toUpperCase())) {
        throw new AppError('Invalid appointment status.', 400);
      }

      const updated = await AppointmentsService.updateAppointmentStatus(
        req.user!.userId,
        req.user!.role,
        req.params.id,
        status.toUpperCase() as AppointmentStatus
      );

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
}
