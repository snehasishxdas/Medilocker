import { Router } from 'express';
import { TimelineController } from './timeline.controller';
import { authenticate } from '../../middlewares/auth';

import { TodoController } from '../todo/todo.controller';

const router = Router();

router.get('/', authenticate, TimelineController.getMyTimeline);
router.get('/feeling', authenticate, TimelineController.getFeelings);
router.post('/feeling', authenticate, TodoController.logFeeling);
router.get('/:id', authenticate, TimelineController.getEventById);
router.delete('/:id', authenticate, TimelineController.delete);

export const timelineRoutes = router;
