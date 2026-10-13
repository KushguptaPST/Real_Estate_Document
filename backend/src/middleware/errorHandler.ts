import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  const isDev = process.env['NODE_ENV'] === 'development';
  // Only messages we raised deliberately (createError) reach clients; upstream /
  // library errors (Prisma, model providers, JSON-in-message) never do outside dev.
  // `expose` is set by http-errors (e.g. body-parser's 400/413) for client-safe messages.
  const isClientSafe = err.isOperational || ((err as { expose?: boolean }).expose === true && statusCode < 500);
  const message = isClientSafe || isDev ? err.message : 'Internal server error';

  logger.error(`[${statusCode}] ${err.message}`, {
    stack: err.stack,
  });

  res.status(statusCode).json({
    error: {
      message,
      ...(isDev && { stack: err.stack }),
    },
  });
}

/** Wrap an async route handler so errors propagate to errorHandler */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/** Create an operational error with HTTP status */
export function createError(message: string, statusCode = 400): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.isOperational = true;
  return err;
}
