import { Router } from 'express';
import { TodoController } from './todo.controller';
import { authenticate } from '../../middlewares/auth';

const router = Router();

router.get('/', authenticate, TodoController.getToday);
router.get('/today', authenticate, TodoController.getToday);
router.patch('/:id/toggle', authenticate, TodoController.toggleTask);
router.post('/daily-feeling', authenticate, TodoController.logFeeling);

export const todoRoutes = router;
