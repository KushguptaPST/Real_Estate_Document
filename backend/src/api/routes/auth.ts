import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { signInWithGoogle, signInAsDemoAgent, isDemoLoginEnabled } from '../../services/auth.service.js';
import { rateLimit } from '../../utils/rateLimit.js';

const router = Router();

const authLimiter = rateLimit({ name: 'auth', windowMs: 60_000, max: 20 });

const GoogleSignInSchema = z.object({
  credential: z.string().min(1),
  inviteToken: z.string().min(16).max(256).optional(),
});

// GET /api/auth/config — public flags the login page needs
router.get('/config', (_req, res) => {
  res.json({ demoLoginEnabled: isDemoLoginEnabled() });
});

// POST /api/auth/google — exchange a Google ID token (plus optional invite token) for a session JWT
router.post(
  '/google',
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = GoogleSignInSchema.safeParse(req.body);
    if (!parsed.success) throw createError('Missing Google credential', 400);

    const session = await signInWithGoogle(parsed.data.credential, parsed.data.inviteToken);
    res.json(session);
  }),
);

// POST /api/auth/demo — sandbox login; 404 unless ENABLE_DEMO_LOGIN=true outside production
router.post(
  '/demo',
  authLimiter,
  asyncHandler(async (_req, res) => {
    const session = await signInAsDemoAgent();
    res.json(session);
  }),
);

// GET /api/auth/me — return the signed-in user
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
