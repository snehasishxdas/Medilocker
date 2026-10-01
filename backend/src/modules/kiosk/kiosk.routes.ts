import { Router, Request, Response, NextFunction } from 'express';
import { KioskController } from './kiosk.controller';
import { authenticate } from '../../middlewares/auth';

const router = Router();

// Allow both authenticated patient kiosk access and public/guest OPD kiosk access
const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticate(req, res, next);
  }
  next();
};

router.post('/intake', optionalAuth, KioskController.submitIntake);

export const kioskRoutes = router;
