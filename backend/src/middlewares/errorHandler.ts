import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export class AppError extends Error {
  public statusCode: number;
  public details?: any;

  constructor(message: string, statusCode = 400, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  logger.error(err.message, { stack: err.stack, path: req.path });

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      details: err.details,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Handle Prisma P2002 Unique Constraint Violation
  if ((err as any)?.code === 'P2002') {
    const target = Array.isArray((err as any)?.meta?.target)
      ? (err as any).meta.target.join(', ')
      : (err as any)?.meta?.target || 'field';
    res.status(409).json({
      success: false,
      error: `An account or record with this ${target} is already registered. Please sign in or use unique credentials.`,
    });
    return;
  }

  // Handle Prisma P2025 Record Not Found
  if ((err as any)?.code === 'P2025') {
    res.status(404).json({
      success: false,
      error: 'The requested resource was not found.',
    });
    return;
  }

  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({
    success: false,
    error: isDev ? (err.message || 'Internal server error') : (err.message?.includes('database') || err.message?.includes('prisma') ? 'Database operation failed. Please try again.' : err.message || 'Internal server error'),
    message: err.message,
  });
}
