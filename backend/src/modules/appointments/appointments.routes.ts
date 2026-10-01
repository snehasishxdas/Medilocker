import { Router } from 'express';
import { AppointmentsController } from './appointments.controller';
import { authenticate } from '../../middlewares/auth';

const router = Router();

router.get('/doctors', authenticate, AppointmentsController.listDoctors);
router.post('/', authenticate, AppointmentsController.bookAppointment);
router.get('/my-appointments', authenticate, AppointmentsController.getMyAppointments);
router.get('/my', authenticate, AppointmentsController.getMyAppointments);
router.put('/:id/status', authenticate, AppointmentsController.updateStatus);

export const appointmentRoutes = router;
