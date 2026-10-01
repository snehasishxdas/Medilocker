import { Router } from 'express';
import { AIController } from './ai.controller';
import { authenticate } from '../../middlewares/auth';
import { uploadMiddleware } from '../../middlewares/upload';

const router = Router();

router.post('/chat', authenticate, AIController.chat);
router.post('/companion-query', authenticate, AIController.chat);
router.post('/scan-foil', authenticate, uploadMiddleware.single('file'), AIController.scanFoil);

// SIH26047 Clinical AI Endpoints
router.post('/voice-intake', authenticate, AIController.voiceIntake);
router.post('/disease-prediction', authenticate, AIController.diseasePrediction);
router.post('/double-code', authenticate, AIController.doubleCode);
router.get('/clinical-triage', authenticate, AIController.clinicalTriage);
router.get('/clinical-triage/:patientId', authenticate, AIController.clinicalTriage);
router.post('/save-intake-to-vault', authenticate, AIController.saveIntake);

export const aiRoutes = router;

