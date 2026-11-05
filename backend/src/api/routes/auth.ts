import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  signInWithGoogle,
  signInAsDemoAgent,
  isDemoLoginEnabled,
  registerOrganization,
  signInWithPassword,
} from '../../services/auth.service.js';
import { rateLimit } from '../../utils/rateLimit.js';

const router = Router();

const authLimiter = rateLimit({ name: 'auth', windowMs: 60_000, max: 20 });

const GoogleSignInSchema = z.object({
  credential: z.string().min(1),
  inviteToken: z.string().min(16).max(256).optional(),
});

const RegisterOrgSchema = z.object({
  ownerName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  organizationName: z.string().min(2, 'Brokerage name must be at least 2 characters'),
  stateJurisdiction: z.enum(['KA', 'MH', 'HR', 'TS', 'DL', 'OTHER']).optional(),
  planTier: z.enum(['SOLO', 'TEAM', 'ENTERPRISE']).optional(),
});

const PasswordLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// GET /api/auth/config — public flags the login page needs
router.get('/config', (_req, res) => {
  res.json({ demoLoginEnabled: isDemoLoginEnabled() });
});

// POST /api/auth/register-org — self-serve onboarding wizard for brokerage owners
router.post(
  '/register-org',
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = RegisterOrgSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid registration data', 400);
    }
    const session = await registerOrganization(parsed.data);
    res.status(201).json(session);
  }),
);

// POST /api/auth/login — email & password login
router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = PasswordLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid credentials', 400);
    }
    const session = await signInWithPassword(parsed.data.email, parsed.data.password);
    res.json(session);
  }),
);

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
  asyncHandler(async (req, res) => {
    const role = req.body?.role === 'OWNER' ? 'OWNER' : 'AGENT';
    const session = await signInAsDemoAgent(role);
    res.json(session);
  }),
);

// GET /api/auth/me — return the signed-in user
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;

