import './config/env';
import { app } from './app';
import { env } from './config/env';
import { checkDatabaseConnection } from './database/prisma';
import { startCronScheduler } from './workers/cronScheduler';
import { logger } from './utils/logger';

async function bootstrap() {
  await checkDatabaseConnection();
  startCronScheduler();

  const server = app.listen(env.PORT, () => {
    logger.info(`MediLocker server listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  logger.error('Fatal startup error:', error);
  process.exit(1);
});
