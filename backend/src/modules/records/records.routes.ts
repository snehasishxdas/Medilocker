import { Router } from 'express';
import { RecordsController } from './records.controller';
import { authenticate } from '../../middlewares/auth';
import { uploadMiddleware } from '../../middlewares/upload';

const router = Router();

router.post('/upload', authenticate, uploadMiddleware.single('file'), RecordsController.upload);
router.post('/', authenticate, RecordsController.createManual);
router.get('/', authenticate, RecordsController.list);
router.get('/:id/status', authenticate, RecordsController.getStatus);
router.get('/:id/file', authenticate, RecordsController.serveRawFile);
router.get('/:id/view', authenticate, RecordsController.viewFile);
router.get('/:id', authenticate, RecordsController.getById);
router.delete('/:id', authenticate, RecordsController.delete);

export const recordsRoutes = router;
