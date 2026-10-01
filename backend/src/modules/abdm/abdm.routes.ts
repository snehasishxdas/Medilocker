import { Router } from 'express';
import { AbdmController } from './abdm.controller';
import { authenticate } from '../../middlewares/auth';

const router = Router();

router.post('/verify-abha', authenticate, AbdmController.verifyAbha);
router.get('/fhir-bundle', authenticate, AbdmController.exportFhir);
router.get('/fhir-bundle/:patientId', authenticate, AbdmController.exportFhir);
router.post('/ephemeral-purge', authenticate, AbdmController.purgeSession);

export const abdmRoutes = router;
