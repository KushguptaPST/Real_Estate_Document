// ─────────────────────────────────────────────────────────────────────────────
// /api/properties & /api/leads/:id/matches — Property Inventory & Match Routes
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { z } from 'zod';
import {
  createProperty,
  getProperties,
  computeMatchesForLead,
} from '../../services/propertyMatch.service.js';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

const router = Router();

const CreatePropertySchema = z.object({
  title: z.string().min(1, 'Property title is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  price: z.number().positive('Price must be greater than 0'),
  bedrooms: z.number().int().min(1, 'Bedrooms must be between 1 and 3').max(3, 'Bedrooms must be between 1 and 3'),
  bathrooms: z.number().min(0),
  propertyType: z.string().min(1),
  status: z.enum(['AVAILABLE', 'UNDER_CONTRACT', 'SOLD', 'OFF_MARKET']).optional(),
  features: z.array(z.string()).optional(),
  description: z.string().optional(),
});

// ── GET /api/properties (List Inventory) ──────────────────────────────────────
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const search = req.query['search'] as string | undefined;
    const minPrice = req.query['minPrice'] ? Number(req.query['minPrice']) : undefined;
    const maxPrice = req.query['maxPrice'] ? Number(req.query['maxPrice']) : undefined;
    const bedrooms = req.query['bedrooms'] ? Number(req.query['bedrooms']) : undefined;
    const city = req.query['city'] as string | undefined;

    const properties = await getProperties({
      search,
      minPrice,
      maxPrice,
      bedrooms,
      city,
      organizationId: orgId,
    });
    res.json(properties);
  }),
);

// ── POST /api/properties (Add Property to Inventory) ─────────────────────────
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = CreatePropertySchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const orgId = req.user!.organizationId;
    const property = await createProperty({ ...parsed.data, organizationId: orgId });
    res.status(201).json(property);
  }),
);

export default router;

// Lead Match Sub-router export for /api/leads/:id/matches
export const leadMatchesRouter = Router({ mergeParams: true });

leadMatchesRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const leadId = req.params['id'];
    const orgId = req.user!.organizationId;
    const matches = await computeMatchesForLead(leadId, orgId);
    res.json(matches);
  }),
);

leadMatchesRouter.post(
  '/refresh',
  requireAuth,
  asyncHandler(async (req, res) => {
    const leadId = req.params['id'];
    const orgId = req.user!.organizationId;
    const matches = await computeMatchesForLead(leadId, orgId);
    res.json({ message: 'Lead matches refreshed successfully', matchesCount: matches.length, matches });
  }),
);
