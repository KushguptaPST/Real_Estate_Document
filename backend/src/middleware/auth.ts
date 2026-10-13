import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@prisma/client';
import { verifySessionToken, type SessionUser } from '../services/auth.service.js';
import { createError } from './errorHandler.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
      rawBody?: Buffer;
    }
  }
}

/** Reject requests without a valid `Authorization: Bearer <session JWT>` header. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    next(createError('Authentication required', 401));
    return;
  }
  verifySessionToken(token)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(next);
}

/** Must run after requireAuth. Rejects members whose role is not in `roles`. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(createError('Authentication required', 401));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(createError('You do not have permission to perform this action', 403));
      return;
    }
    next();
  };
}
