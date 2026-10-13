import type { Request, Response, NextFunction } from 'express';

/**
 * Minimal fixed-window, in-memory rate limiter. Per-process only — adequate for a
 * single instance; a shared store is needed once the API runs on several instances.
 */
export function rateLimit(options: {
  name: string;
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
}) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = Date.now();

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    if (now - lastSweep > options.windowMs) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      lastSweep = now;
    }

    const key = `${options.name}:${options.key ? options.key(req) : req.ip}`;
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    entry.count++;
    if (entry.count > options.max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      res.status(429).json({ error: { message: 'Too many requests. Please try again later.' } });
      return;
    }
    next();
  };
}
