// ─────────────────────────────────────────────────────────────────────────────
// /api/properties & /api/leads/:id/matches — Property Inventory & Match Routes
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import {
  createProperty,
  updateProperty,
  getProperties,
  computeMatchesForLead,
} from '../../services/propertyMatch.service.js';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { uploadMiddleware } from '../../middleware/upload.js';
import { storeFile, getSignedDocumentUrl } from '../../services/storage.service.js';

const router = Router();

const OptionalUrlSchema = z.union([z.string().url(), z.literal(''), z.null()]).optional();

const CreatePropertySchema = z.object({
  title: z.string().min(1, 'Property title is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  microMarket: z.string().nullable().optional(),
  builderName: z.string().nullable().optional(),
  reraNumber: z.string().nullable().optional(),
  possessionStatus: z.string().nullable().optional(),
  price: z.number().positive('Price must be greater than 0'),
  bedrooms: z.number().int().min(0, 'Bedrooms cannot be negative').max(20, 'Bedrooms must be a realistic number'),
  bathrooms: z.number().min(0),
  propertyType: z.string().min(1),
  status: z.enum(['AVAILABLE', 'UNDER_CONTRACT', 'SOLD', 'OFF_MARKET']).optional(),
  features: z.array(z.string()).optional(),
  description: z.string().nullable().optional(),
  brochureUrl: OptionalUrlSchema,
  floorPlanUrl: OptionalUrlSchema,
  mapsUrl: OptionalUrlSchema,
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  negotiationMarginNote: z.string().nullable().optional(),
});

const UpdatePropertySchema = CreatePropertySchema.partial();

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
    const status = req.query['status'] as string | undefined;

    const properties = await getProperties({
      search,
      minPrice,
      maxPrice,
      bedrooms,
      city,
      status,
      organizationId: orgId,
    });
    res.json(properties);
  }),
);

// ── POST /api/properties/brochure (Upload PDF brochure & return URL) ──────────
router.post(
  '/brochure',
  requireAuth,
  requireRole('OWNER'),
  uploadMiddleware.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw createError('No PDF brochure uploaded', 400);

    const { storagePath } = await storeFile(file.path, file.originalname);
    const driver = process.env['STORAGE_DRIVER'] ?? 'local';

    let url: string;
    if (driver === 'imagekit') {
      url = getSignedDocumentUrl(storagePath, 7 * 24 * 3600);
    } else {
      const base = (process.env['API_PUBLIC_URL'] || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
      url = `${base}/api/properties/brochures/${encodeURIComponent(path.basename(file.path))}`;
    }

    res.status(201).json({
      url,
      filename: file.originalname,
      sizeBytes: file.size,
      storagePath,
    });
  }),
);

// ── GET /api/properties/brochures/:filename (Serve uploaded PDF brochure) ─────
router.get(
  '/brochures/:filename',
  asyncHandler(async (req, res) => {
    const safeName = path.basename(req.params['filename'] ?? '');
    if (!safeName || !safeName.toLowerCase().endsWith('.pdf')) {
      throw createError('Invalid brochure filename', 400);
    }

    const uploadDir = path.resolve(process.env['UPLOAD_DIR'] ?? './uploads');
    const fullPath = path.resolve(uploadDir, safeName);
    if (!fullPath.startsWith(uploadDir + path.sep) || !fs.existsSync(fullPath)) {
      throw createError('Brochure PDF not found', 404);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.sendFile(fullPath);
  }),
);

// ── POST /api/properties (Add Property to Inventory) ─────────────────────────
router.post(
  '/',
  requireAuth,
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const parsed = CreatePropertySchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const orgId = req.user!.organizationId;
    const normalize = (v: string | null | undefined) => (v && v.trim() ? v.trim() : undefined);
    const property = await createProperty({
      ...parsed.data,
      microMarket: normalize(parsed.data.microMarket),
      builderName: normalize(parsed.data.builderName),
      reraNumber: normalize(parsed.data.reraNumber),
      possessionStatus: normalize(parsed.data.possessionStatus),
      description: normalize(parsed.data.description),
      brochureUrl: normalize(parsed.data.brochureUrl),
      floorPlanUrl: normalize(parsed.data.floorPlanUrl),
      mapsUrl: normalize(parsed.data.mapsUrl),
      latitude: parsed.data.latitude ?? undefined,
      longitude: parsed.data.longitude ?? undefined,
      negotiationMarginNote: normalize(parsed.data.negotiationMarginNote),
      organizationId: orgId,
    });
    res.status(201).json(property);
  }),
);

const BulkImportPropertiesSchema = z.object({
  rows: z.array(z.record(z.unknown())).min(1, 'At least 1 row is required').max(500, 'Maximum 500 rows per batch'),
});

// ── POST /api/properties/import (Batch CSV Inventory Import) ──────────────────
router.post(
  '/import',
  requireAuth,
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const parsed = BulkImportPropertiesSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.errors[0]?.message || 'Invalid import payload', 422);

    const normalize = (v: string | null | undefined) => (v && v.trim() ? v.trim() : undefined);
    let importedCount = 0;
    let skippedCount = 0;
    const errors: Array<{ row: number; reason: string }> = [];

    for (let i = 0; i < parsed.data.rows.length; i++) {
      const raw = parsed.data.rows[i] as Record<string, unknown>;
      const rowParsed = CreatePropertySchema.safeParse({
        title: typeof raw.title === 'string' ? raw.title.trim() : '',
        address: typeof raw.address === 'string' ? raw.address.trim() : '',
        city: typeof raw.city === 'string' ? raw.city.trim() : '',
        microMarket: typeof raw.microMarket === 'string' ? raw.microMarket : undefined,
        builderName: typeof raw.builderName === 'string' ? raw.builderName : undefined,
        reraNumber: typeof raw.reraNumber === 'string' ? raw.reraNumber : undefined,
        possessionStatus: typeof raw.possessionStatus === 'string' ? raw.possessionStatus : undefined,
        price: Number(raw.price),
        bedrooms: raw.bedrooms !== undefined && raw.bedrooms !== '' ? Number(raw.bedrooms) : 0,
        bathrooms: raw.bathrooms !== undefined && raw.bathrooms !== '' ? Number(raw.bathrooms) : 2,
        propertyType:
          typeof raw.propertyType === 'string' && raw.propertyType.trim()
            ? raw.propertyType.trim().toUpperCase()
            : 'APARTMENT',
        brochureUrl: typeof raw.brochureUrl === 'string' ? raw.brochureUrl : undefined,
        description: typeof raw.description === 'string' ? raw.description : undefined,
      });

      if (!rowParsed.success) {
        skippedCount++;
        errors.push({
          row: i + 1,
          reason: rowParsed.error.errors[0]?.message || 'Invalid property row',
        });
        continue;
      }

      try {
        await createProperty({
          ...rowParsed.data,
          microMarket: normalize(rowParsed.data.microMarket),
          builderName: normalize(rowParsed.data.builderName),
          reraNumber: normalize(rowParsed.data.reraNumber),
          possessionStatus: normalize(rowParsed.data.possessionStatus),
          description: normalize(rowParsed.data.description),
          brochureUrl: normalize(rowParsed.data.brochureUrl),
          floorPlanUrl: normalize(rowParsed.data.floorPlanUrl),
          mapsUrl: normalize(rowParsed.data.mapsUrl),
          latitude: rowParsed.data.latitude ?? undefined,
          longitude: rowParsed.data.longitude ?? undefined,
          negotiationMarginNote: normalize(rowParsed.data.negotiationMarginNote),
          organizationId: orgId,
        });
        importedCount++;
      } catch (err: any) {
        skippedCount++;
        errors.push({ row: i + 1, reason: err?.message || 'Could not import listing' });
      }
    }

    res.status(201).json({ importedCount, skippedCount, errors });
  }),
);

// ── PATCH /api/properties/:id (Update Property Listing & Brochure) ────────────
router.patch(
  '/:id',
  requireAuth,
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const parsed = UpdatePropertySchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const orgId = req.user!.organizationId;
    const property = await updateProperty(req.params['id'], orgId, parsed.data);
    res.json(property);
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
