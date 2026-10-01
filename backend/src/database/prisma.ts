import '../config/env';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

const SUPABASE_IPV4_POOLER_DB = 'postgresql://postgres.mmgyamemhbecpytpibrr:qLBHDWUwaMod4Cd0@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require';

const resolveDatabaseUrl = () => {
  let current = process.env.DATABASE_URL;
  if (!current || current.includes('pnqubhvcvocytudlwbog') || current.includes('ep-sample-neon') || current.includes('db.mmgyamemhbecpytpibrr.supabase.co')) {
    current = SUPABASE_IPV4_POOLER_DB;
  }
  if (current.includes('pooler.supabase.com')) {
    const separator = current.includes('?') ? '&' : '?';
    if (!current.includes('connection_limit=')) {
      current += `${separator}connection_limit=15&pool_timeout=20`;
    }
  }
  return current;
};

export const prisma =
  global.prismaGlobal ||
  new PrismaClient({
    datasources: {
      db: {
        url: resolveDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prismaGlobal = prisma;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Connected to PostgreSQL database.');
    return true;
  } catch (error) {
    logger.warn('PostgreSQL database connection pending or offline. Running in resilient mode.');
    return false;
  }
}
