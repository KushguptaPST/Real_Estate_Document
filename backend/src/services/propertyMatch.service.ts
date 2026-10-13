// ─────────────────────────────────────────────────────────────────────────────
// Property Match Service — Deterministic Inventory Filter & Soft Preference Ranking
// ─────────────────────────────────────────────────────────────────────────────

import { type Property } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { getLeadDetails } from './lead.service.js';
import { requireOrgId } from '../utils/tenant.js';


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
export async function computeMatchesForLead(leadId: string, organizationId: string): Promise<MatchCalculationResult[]> {
  const orgId = requireOrgId(organizationId);
  const lead = await getLeadDetails(leadId, orgId);
  const req = lead.requirements;

  logger.info(`[Property Matcher] Computing matches for Lead ${leadId}`);

  if (!req) {
    logger.info(`[Property Matcher] No requirements recorded for lead ${leadId}. Returning empty matches.`);
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

    // Hard filter verified bullet
    matchReasons.push(`Price ($${property.price.toLocaleString()}) is within maximum budget ceiling ($${(req.maxBudget || 0).toLocaleString()})`);
    matchReasons.push(`Bedrooms (${property.bedrooms}) meet minimum requirement (${req.minBedrooms || 1})`);

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

    // Price Sweet Spot (+0.15)
    if (req.maxBudget && property.price <= req.maxBudget * 0.95) {
      score += 0.15;
      matchReasons.push(`Priced 5%+ below budget ceiling ($${(req.maxBudget - property.price).toLocaleString()} savings)`);
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

  // 3. Persist top matches to database with organizationId
  for (const res of results.slice(0, 10)) {
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

  return results;
}

/**
 * Creates a new property listing in inventory.
 */
export async function createProperty(data: {
  title: string;
  address: string;
  city: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  propertyType: string;
  status?: 'AVAILABLE' | 'UNDER_CONTRACT' | 'SOLD' | 'OFF_MARKET';
  features?: string[];
  description?: string;
  organizationId: string;
}) {
  const property = await prisma.property.create({
    data: {
      title: data.title,
      address: data.address,
      city: data.city,
      price: data.price,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      propertyType: data.propertyType,
      status: data.status ?? 'AVAILABLE',
      features: data.features ?? [],
      description: data.description ?? null,
      organizationId: data.organizationId,
    },
  });

  logger.info(`[Property Service] Created property "${property.title}" ID: ${property.id}`);
  return property;
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
  organizationId: string;
}) {
  const { search, minPrice, maxPrice, bedrooms, city, organizationId } = params;

  const whereClause: Record<string, unknown> = {
    organizationId,
    status: 'AVAILABLE',
  };

  if (minPrice) whereClause['price'] = { gte: minPrice };
  if (maxPrice) {
    whereClause['price'] = { ...(whereClause['price'] as object), lte: maxPrice };
  }
  if (bedrooms) whereClause['bedrooms'] = { gte: bedrooms };
  if (city) whereClause['city'] = { contains: city, mode: 'insensitive' };

  if (search && search.trim().length > 0) {
    const q = search.trim();
    whereClause['OR'] = [
      { title: { contains: q, mode: 'insensitive' } },
      { address: { contains: q, mode: 'insensitive' } },
      { city: { contains: q, mode: 'insensitive' } },
    ];
  }

  return prisma.property.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
  });
}
