import cron from 'node-cron';
import { TodoService } from '../modules/todo/todo.service';
import { logger } from '../utils/logger';

export function startCronScheduler() {
  logger.info('Initializing MediLocker background cron scheduler...');

  cron.schedule('0 0 * * *', async () => {
    logger.info('Midnight cron triggered: Renewing daily medication to-do lists.');
    try {
      await TodoService.renewAllMidnightTodos();
      logger.info('Midnight To-Do renewal finished successfully.');
    } catch (error: any) {
      logger.error('Midnight To-Do renewal error:', error?.message);
    }
  });

  cron.schedule('0 9 * * *', async () => {
    logger.info('Daily 9:00 AM Cron triggered: Evaluating low-stock refill alerts.');
  });

  logger.info('MediLocker cron scheduler active.');
}
