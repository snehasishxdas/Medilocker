import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './errorHandler';
import { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  userId: string;
  medilockerId: string;
  email: string;
  role: UserRole;
  delegationId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    throw new AppError('Authentication required. Missing Bearer token.', 401);
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUser;
    req.user = payload;
    next();
  } catch (error) {
    throw new AppError('Invalid or expired authentication token.', 401);
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(`Access forbidden for role ${req.user.role}`, 403);
    }
    next();
  };
}
