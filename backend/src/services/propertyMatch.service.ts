// ─────────────────────────────────────────────────────────────────────────────
// Property Match Service — Deterministic Inventory Filter & Soft Preference Ranking
// ─────────────────────────────────────────────────────────────────────────────

import { type Property } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { getLeadDetails } from './lead.service.js';
import { requireOrgId } from '../utils/tenant.js';
import { createError } from '../middleware/errorHandler.js';


export interface MatchCalculationResult {
  property: Property;
  matchScore: number; // 0.0 to 1.0 (deterministic compatibility)
  aiExplanationConfidence: number; // 0.0 to 1.0
  matchReason: string;
  failedCriteria: string[];
}

/**
 * Computes deterministic property matches for a lead based on database inventory.
 * 1. Hard filters out unavailable, over-budget, or incompatible property types.
 * 2. Applies soft scoring for locations, amenities, price targets, and bedrooms.
 * 3. Returns and persists top matches with explicit reasons scoped strictly to organizationId.
 */
function formatPrice(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount) || amount === 0) return '₹0';
  if (amount >= 10_000_000) {
    const cr = (amount / 10_000_000).toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1');
    return `₹${cr} Cr`;
  }
  if (amount >= 100_000) {
    const lakh = (amount / 100_000).toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1');
    return `₹${lakh} L`;
  }
  if (amount >= 1_000) {
    const k = (amount / 1_000).toFixed(1).replace(/\.0$/, '');
    return `₹${k} K`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

const formatIndianPrice = formatPrice;

export async function computeMatchesForLead(leadId: string, organizationId: string): Promise<MatchCalculationResult[]> {
  const orgId = requireOrgId(organizationId);
  const lead = await getLeadDetails(leadId, orgId);
  const req = lead.requirements;

  logger.info(`[Property Matcher] Computing matches for Lead ${leadId}`);

  if (!req) {
    logger.info(`[Property Matcher] No requirements recorded for lead ${leadId}. Returning empty matches.`);
    await prisma.propertyMatch.deleteMany({ where: { leadId, organizationId: orgId } });
    return [];
  }

  // 1. Mandatory SQL Hard Filters
  const hardWhere: Record<string, unknown> = {
    status: 'AVAILABLE',
    organizationId: orgId,
  };

  if (req.maxBudget && req.maxBudget > 0) {
    hardWhere['price'] = { lte: req.maxBudget };
  }

  if (req.minBedrooms && req.minBedrooms > 0) {
    hardWhere['bedrooms'] = { gte: req.minBedrooms };
  }

  if (req.propertyType && req.propertyType.trim().length > 0) {
    hardWhere['propertyType'] = { equals: req.propertyType, mode: 'insensitive' };
  }

  const candidateProperties = await prisma.property.findMany({
    where: hardWhere,
  });

  logger.info(`[Property Matcher] Hard filter passed ${candidateProperties.length} candidate properties`);

  const results: MatchCalculationResult[] = [];

  for (const property of candidateProperties) {
    let score = 0.5; // Base score for passing hard filters
    const matchReasons: string[] = [];
    const failedCriteria: string[] = [];

    // Budget check
    if (req.maxBudget && req.maxBudget > 0) {
      matchReasons.push(`Price (${formatIndianPrice(property.price)}) is within maximum budget ceiling (${formatIndianPrice(req.maxBudget)})`);
      if (property.price <= req.maxBudget * 0.95) {
        score += 0.15;
        const savings = req.maxBudget - property.price;
        matchReasons.push(`Priced below budget ceiling (${formatIndianPrice(savings)} savings)`);
      }
    } else {
      matchReasons.push(`Flexible budget (Property priced at ${formatIndianPrice(property.price)})`);
    }

    // Bedroom check
    if (req.minBedrooms && req.minBedrooms > 0) {
      matchReasons.push(`Bedrooms (${property.bedrooms}) meet minimum requirement (${req.minBedrooms} Beds)`);
    } else {
      matchReasons.push(`Bedrooms: ${property.bedrooms} Beds available`);
    }

    // Location Check (+0.25)
    if (req.preferredLocations && req.preferredLocations.length > 0) {
      const propLocationStr = `${property.address} ${property.city}`.toLowerCase();
      const locMatch = req.preferredLocations.some((loc) => propLocationStr.includes(loc.toLowerCase()));
      if (locMatch) {
        score += 0.25;
        matchReasons.push(`Located in preferred area (${property.city})`);
      } else {
        failedCriteria.push(`Location (${property.city}) is not in requested list (${req.preferredLocations.join(', ')})`);
      }
    }

    // Bedroom Exact Fit (+0.1)
    if (req.maxBedrooms && property.bedrooms <= req.maxBedrooms) {
      score += 0.1;
      matchReasons.push(`Bedrooms (${property.bedrooms}) fit requested range`);
    } else if (req.maxBedrooms && property.bedrooms > req.maxBedrooms) {
      failedCriteria.push(`Bedrooms (${property.bedrooms}) exceed requested maximum (${req.maxBedrooms})`);
    }

    const finalScore = Math.min(1.0, Math.max(0.0, Number(score.toFixed(2))));
    const matchReasonText = matchReasons.map((r) => `• ${r}`).join('\n');

    results.push({
      property,
      matchScore: finalScore,
      aiExplanationConfidence: 0.95,
      matchReason: matchReasonText,
      failedCriteria,
    });
  }

  // Sort descending by score
  results.sort((a, b) => b.matchScore - a.matchScore);

  const topMatches = results.slice(0, 10);
  const topMatchIds = topMatches.map((r) => r.property.id);

  // 3. Persist top matches to database with organizationId
  for (const res of topMatches) {
    await prisma.propertyMatch.upsert({
      where: {
        leadId_propertyId: {
          leadId,
          propertyId: res.property.id,
        },
      },
      create: {
        leadId,
        propertyId: res.property.id,
        organizationId: orgId,
        matchScore: res.matchScore,
        aiExplanationConfidence: res.aiExplanationConfidence,
        matchReason: res.matchReason,
        failedCriteria: res.failedCriteria,
      },
      update: {
        organizationId: orgId,
        matchScore: res.matchScore,
        aiExplanationConfidence: res.aiExplanationConfidence,
        matchReason: res.matchReason,
        failedCriteria: res.failedCriteria,
      },
    });
  }

  // Remove stale matches that no longer satisfy the updated filter
  await prisma.propertyMatch.deleteMany({
    where: {
      leadId,
      organizationId: orgId,
      propertyId: { notIn: topMatchIds },
    },
  });

  return results;
}

/**
 * Creates a new property listing in inventory.
 */
export async function createProperty(data: {
  title: string;
  address: string;
  city: string;
  microMarket?: string;
  builderName?: string;
  reraNumber?: string;
  possessionStatus?: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  propertyType: string;
  status?: 'AVAILABLE' | 'UNDER_CONTRACT' | 'SOLD' | 'OFF_MARKET';
  features?: string[];
  description?: string;
  brochureUrl?: string;
  floorPlanUrl?: string;
  mapsUrl?: string;
  latitude?: number;
  longitude?: number;
  negotiationMarginNote?: string;
  organizationId: string;
}) {
  const property = await prisma.property.create({
    data: {
      title: data.title,
      address: data.address,
      city: data.city,
      microMarket: data.microMarket ?? null,
      builderName: data.builderName ?? null,
      reraNumber: data.reraNumber ?? null,
      possessionStatus: data.possessionStatus ?? null,
      price: data.price,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      propertyType: data.propertyType,
      status: data.status ?? 'AVAILABLE',
      features: data.features ?? [],
      description: data.description ?? null,
      brochureUrl: data.brochureUrl ?? null,
      floorPlanUrl: data.floorPlanUrl ?? null,
      mapsUrl: data.mapsUrl ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      negotiationMarginNote: data.negotiationMarginNote ?? null,
      organizationId: data.organizationId,
    },
  });

  logger.info(`[Property Service] Created property "${property.title}" ID: ${property.id}`);
  return property;
}

/**
 * Updates an existing property listing scoped strictly to the tenant organizationId.
 */
export async function updateProperty(
  propertyId: string,
  organizationId: string,
  data: {
    title?: string;
    address?: string;
    city?: string;
    microMarket?: string | null;
    builderName?: string | null;
    reraNumber?: string | null;
    possessionStatus?: string | null;
    price?: number;
    bedrooms?: number;
    bathrooms?: number;
    propertyType?: string;
    status?: 'AVAILABLE' | 'UNDER_CONTRACT' | 'SOLD' | 'OFF_MARKET';
    features?: string[];
    description?: string | null;
    brochureUrl?: string | null;
    floorPlanUrl?: string | null;
    mapsUrl?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    negotiationMarginNote?: string | null;
  },
) {
  const orgId = requireOrgId(organizationId);
  const existing = await prisma.property.findFirst({
    where: { id: propertyId, organizationId: orgId },
  });
  if (!existing) {
    throw createError('Property not found or access denied', 404);
  }

  const normalizeOptional = (val: string | null | undefined) =>
    val === undefined ? undefined : val && val.trim() ? val.trim() : null;

  const updated = await prisma.property.update({
    where: { id: existing.id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.address !== undefined ? { address: data.address.trim() } : {}),
      ...(data.city !== undefined ? { city: data.city.trim() } : {}),
      ...(data.microMarket !== undefined ? { microMarket: normalizeOptional(data.microMarket) } : {}),
      ...(data.builderName !== undefined ? { builderName: normalizeOptional(data.builderName) } : {}),
      ...(data.reraNumber !== undefined ? { reraNumber: normalizeOptional(data.reraNumber) } : {}),
      ...(data.possessionStatus !== undefined ? { possessionStatus: normalizeOptional(data.possessionStatus) } : {}),
      ...(data.price !== undefined ? { price: data.price } : {}),
      ...(data.bedrooms !== undefined ? { bedrooms: data.bedrooms } : {}),
      ...(data.bathrooms !== undefined ? { bathrooms: data.bathrooms } : {}),
      ...(data.propertyType !== undefined ? { propertyType: data.propertyType } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.features !== undefined ? { features: data.features } : {}),
      ...(data.description !== undefined ? { description: normalizeOptional(data.description) } : {}),
      ...(data.brochureUrl !== undefined ? { brochureUrl: normalizeOptional(data.brochureUrl) } : {}),
      ...(data.floorPlanUrl !== undefined ? { floorPlanUrl: normalizeOptional(data.floorPlanUrl) } : {}),
      ...(data.mapsUrl !== undefined ? { mapsUrl: normalizeOptional(data.mapsUrl) } : {}),
      ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
      ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
      ...(data.negotiationMarginNote !== undefined
        ? { negotiationMarginNote: normalizeOptional(data.negotiationMarginNote) }
        : {}),
    },
  });

  logger.info(`[Property Service] Updated property "${updated.title}" ID: ${updated.id}`);
  return updated;
}

/**
 * Hybrid search for AI agents:
 * Tier 1: Exact SQL matches (city/microMarket/address/title, budget, bedrooms)
 * Tier 2: Elastic stretch (+20% budget and MicroMarketAdjacency / broader org inventory)
 */
export async function searchPropertiesHybrid(params: {
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  city?: string;
  organizationId: string;
}): Promise<{
  exactMatches: Property[];
  stretchMatches: Array<{ property: Property; stretchReason: string }>;
}> {
  const exactMatches = await getProperties({
    ...params,
    status: 'AVAILABLE',
  });

  if (exactMatches.length >= 2) {
    return { exactMatches: exactMatches.slice(0, 5), stretchMatches: [] };
  }

  const orgId = requireOrgId(params.organizationId);
  const exactIds = new Set(exactMatches.map((p) => p.id));
  const stretchMatches: Array<{ property: Property; stretchReason: string }> = [];

  // Look up configured micro-market adjacencies if city/microMarket specified
  let adjacentMarkets: Array<{ adjacentMarket: string; commuteNote: string | null }> = [];
  if (params.city && params.city.trim().length > 0) {
    adjacentMarkets = await prisma.microMarketAdjacency.findMany({
      where: {
        organizationId: orgId,
        sourceMarket: { contains: params.city.trim(), mode: 'insensitive' },
      },
      select: { adjacentMarket: true, commuteNote: true },
      take: 5,
    });
  }

  // Elastic budget ceiling (+20%)
  const elasticMaxPrice = params.maxPrice ? Math.round(params.maxPrice * 1.2) : undefined;
  const candidatePool = await prisma.property.findMany({
    where: {
      organizationId: orgId,
      status: 'AVAILABLE',
      ...(params.bedrooms ? { bedrooms: { gte: params.bedrooms } } : {}),
      ...(elasticMaxPrice ? { price: { lte: elasticMaxPrice } } : {}),
    },
    orderBy: { price: 'asc' },
    take: 15,
  });

  for (const prop of candidatePool) {
    if (exactIds.has(prop.id)) continue;

    const reasons: string[] = [];
    if (params.maxPrice && prop.price > params.maxPrice) {
      const diffPct = Math.round(((prop.price - params.maxPrice) / params.maxPrice) * 100);
      reasons.push(`${diffPct}% above target ceiling (${formatIndianPrice(prop.price)})`);
    }

    if (params.city && params.city.trim().length > 0) {
      const propLoc = `${prop.city} ${prop.microMarket ?? ''} ${prop.address}`.toLowerCase();
      const adj = adjacentMarkets.find((a) => propLoc.includes(a.adjacentMarket.toLowerCase()));
      if (adj) {
        reasons.push(adj.commuteNote || `Adjacent micro-market: ${adj.adjacentMarket}`);
      } else if (!propLoc.includes(params.city.trim().toLowerCase())) {
        reasons.push(`Alternative area: ${prop.microMarket || prop.city}`);
      }
    }

    stretchMatches.push({
      property: prop,
      stretchReason: reasons.join('; ') || 'Close inventory alternative',
    });

    if (stretchMatches.length >= 3) break;
  }

  return { exactMatches: exactMatches.slice(0, 5), stretchMatches };
}

/**
 * Returns property inventory list scoped strictly to organization.
 */
export async function getProperties(params: {
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  city?: string;
  status?: string;
  organizationId: string;
}) {
  const { search, minPrice, maxPrice, bedrooms, city, status, organizationId } = params;

  const andConditions: any[] = [
    { organizationId },
  ];

  if (status && status !== 'ALL') {
    andConditions.push({ status });
  }

  if (minPrice != null && minPrice > 0) {
    andConditions.push({ price: { gte: minPrice } });
  }
  if (maxPrice != null && maxPrice > 0) {
    andConditions.push({ price: { lte: maxPrice } });
  }
  if (bedrooms != null && bedrooms > 0) {
    andConditions.push({ bedrooms: { gte: bedrooms } });
  }

  // Location / City matching:
  // In real estate (especially in metros like Bengaluru), buyers and AI models often pass
  // micro-markets, neighborhoods, or landmarks (e.g. "ITPL", "Whitefield", "Panathur", "ECC Road")
  // as the "city" argument. Check across city, address, and title so landmarks like ITPL match.
  if (city && city.trim().length > 0) {
    const c = city.trim();
    andConditions.push({
      OR: [
        { city: { contains: c, mode: 'insensitive' } },
        { microMarket: { contains: c, mode: 'insensitive' } },
        { address: { contains: c, mode: 'insensitive' } },
        { title: { contains: c, mode: 'insensitive' } },
      ],
    });
  }

  if (search && search.trim().length > 0) {
    const q = search.trim();
    andConditions.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  return prisma.property.findMany({
    where: { AND: andConditions },
    orderBy: { createdAt: 'desc' },
  });
}
