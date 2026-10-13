/**
 * Lead Conversion Service — Production-grade Lead-to-Deal Conversion
 *
 * Implements:
 *  - Explicit server-side role and assignment authorization
 *  - Lead stage eligibility checks and override verification
 *  - Property inventory verification and status update to UNDER_CONTRACT
 *  - Atomic database transaction creating Deal, updating Lead, initializing NotificationSettings, and recording AuditLogs
 *  - Database-level duplicate prevention and race-condition safety (409 Conflict)
 *  - Idempotency and failure rollback
 */

import { type UserRole, type Deal, type Lead } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { createError } from '../middleware/errorHandler.js';
import { requireOrgId } from '../utils/tenant.js';

export interface ConvertLeadToDealParams {
  leadId: string;
  organizationId: string;
  callerId: string;
  callerRole: UserRole;
  callerEmail?: string;
  propertyId?: string;
  propertyAddress?: string;
  buyerName?: string;
  sellerName?: string;
  acceptanceDate?: string;
  timezone?: string;
  eligibilityOverride?: boolean;
  overrideReason?: string;
}

export interface ConvertLeadToDealResult {
  deal: Deal;
  lead: Lead;
  contingencyStatus: 'PENDING_DOCUMENT_UPLOAD' | 'DEADLINES_INITIALIZED';
  initializedDeadlinesCount: number;
}

/**
 * Converts a qualified Lead into an active Deal with associated property and contingency tracking.
 */
export async function convertLeadToDeal(params: ConvertLeadToDealParams): Promise<ConvertLeadToDealResult> {
  const {
    leadId,
    callerId,
    callerRole,
    callerEmail,
    propertyId,
    propertyAddress,
    buyerName,
    sellerName,
    acceptanceDate,
    timezone = 'America/New_York',
    eligibilityOverride = false,
    overrideReason,
  } = params;

  const organizationId = requireOrgId(params.organizationId);

  // 1. Load lead with organization scope
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId },
    include: { deal: true },
  });

  if (!lead) {
    throw createError('Lead not found or access denied', 404);
  }

  // 2. Role authorization: AGENT can only convert leads assigned to them
  if (callerRole === 'AGENT') {
    if (!lead.assignedUserId) {
      throw createError('Agents cannot convert unassigned leads', 403);
    }
    if (lead.assignedUserId !== callerId) {
      throw createError('Agents can only convert leads assigned to them', 403);
    }
  }

  // 3. Duplicate conversion check (idempotency)
  if (lead.deal) {
    logger.warn(`[Lead Conversion] Lead ${leadId} already converted to Deal ${lead.deal.id}`);
    const err = createError('Lead has already been converted into a deal', 409);
    (err as any).dealId = lead.deal.id;
    throw err;
  }

  if (lead.status === 'WON') {
    // Check if a deal exists for this lead
    const existingDeal = await prisma.deal.findFirst({
      where: { leadId, organizationId },
    });
    if (existingDeal) {
      const err = createError('Lead has already been converted into a deal', 409);
      (err as any).dealId = existingDeal.id;
      throw err;
    }
  }

  // 4. Terminal status check: Cannot convert LOST leads
  if (lead.status === 'LOST') {
    throw createError('Cannot convert a lost lead into a deal', 400);
  }

  // 5. Stage eligibility check
  const eligibleStages = ['QUALIFIED', 'PROPOSAL'];
  if (!eligibleStages.includes(lead.status)) {
    if (!eligibilityOverride || !overrideReason || !overrideReason.trim()) {
      throw createError(
        `Lead in "${lead.status}" stage is not eligible for conversion. Lead must be in QUALIFIED or PROPOSAL stage, or provide an explicit eligibility override with reason.`,
        400,
      );
    }
  }

  // 6. Property validation (if propertyId provided)
  let property: { id: string; address: string; city: string; status: string } | null = null;
  if (propertyId) {
    property = await prisma.property.findFirst({
      where: { id: propertyId, organizationId },
      select: { id: true, address: true, city: true, status: true },
    });

    if (!property) {
      throw createError('Property not found in this organization', 404);
    }

    if (property.status === 'SOLD' || property.status === 'OFF_MARKET') {
      throw createError(
        `Selected property is unavailable for deal conversion (status: ${property.status})`,
        400,
      );
    }
  }

  // 7. Resolve mandatory property address
  const resolvedAddress = (propertyAddress?.trim()) || (property ? `${property.address}, ${property.city}` : '');
  if (!resolvedAddress) {
    throw createError('Property address is required to create a deal', 422);
  }

  const resolvedBuyerName = (buyerName?.trim()) || lead.fullName;

  // 8. Atomic database transaction
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-verify no race condition created a deal for this lead
      const raceCheck = await tx.deal.findFirst({
        where: { leadId: lead.id },
      });
      if (raceCheck) {
        const err = createError('Lead has already been converted into a deal', 409);
        (err as any).dealId = raceCheck.id;
        throw err;
      }

      // a. Create Deal
      const createdDeal = await tx.deal.create({
        data: {
          organizationId,
          leadId: lead.id,
          propertyId: property?.id ?? null,
          propertyAddress: resolvedAddress,
          buyerName: resolvedBuyerName,
          sellerName: sellerName?.trim() || null,
          acceptanceDate: acceptanceDate ? new Date(acceptanceDate) : null,
          timezone,
          status: 'ACTIVE',
        },
      });

      // b. Update Lead status to WON
      const updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: { status: 'WON' },
      });

      // c. Update Property status to UNDER_CONTRACT (if property was linked)
      if (property) {
        await tx.property.update({
          where: { id: property.id },
          data: { status: 'UNDER_CONTRACT' },
        });
      }

      // d. Initialize NotificationSettings for the deal
      const recipientList: string[] = [];
      if (callerEmail && callerEmail.includes('@')) recipientList.push(callerEmail.toLowerCase().trim());
      if (lead.email && lead.email.includes('@')) {
        const leadEmail = lead.email.toLowerCase().trim();
        if (!recipientList.includes(leadEmail)) recipientList.push(leadEmail);
      }

      await tx.notificationSetting.create({
        data: {
          dealId: createdDeal.id,
          organizationId,
          recipients: recipientList,
          timezone: createdDeal.timezone,
          enabled: true,
        },
      });

      // e. Audit log for Deal creation
      await tx.auditLog.create({
        data: {
          dealId: createdDeal.id,
          organizationId,
          action: 'DEAL_CREATED',
          entityType: 'Deal',
          entityId: createdDeal.id,
          actor: callerEmail ?? 'system',
          note: `Deal created from Lead ${lead.fullName} (${lead.id})${
            eligibilityOverride ? ` [Override Reason: ${overrideReason}]` : ''
          }`,
          newValue: {
            leadId: lead.id,
            propertyAddress: resolvedAddress,
            propertyId: property?.id ?? null,
            buyerName: resolvedBuyerName,
          },
        },
      });

      // f. Audit log for Lead status transition to WON
      await tx.auditLog.create({
        data: {
          dealId: createdDeal.id,
          organizationId,
          action: 'LEAD_UPDATED',
          entityType: 'Lead',
          entityId: lead.id,
          actor: callerEmail ?? 'system',
          note: `Lead converted to Deal ${createdDeal.id} (Status transitioned from ${lead.status} to WON)`,
          previousValue: { status: lead.status },
          newValue: { status: 'WON', dealId: createdDeal.id },
        },
      });

      return { deal: createdDeal, lead: updatedLead };
    });

    logger.info(
      `[Lead Conversion] Successfully converted Lead ${leadId} to Deal ${result.deal.id} for org ${organizationId}`,
    );

    return {
      deal: result.deal,
      lead: result.lead,
      contingencyStatus: 'PENDING_DOCUMENT_UPLOAD',
      initializedDeadlinesCount: 0,
    };
  } catch (err: any) {
    if (err.code === 'P2002' && err.meta?.target?.includes('leadId')) {
      logger.warn(`[Lead Conversion Concurrency] Unique constraint caught duplicate deal for lead ${leadId}`);
      const conflictErr = createError('Lead has already been converted into a deal', 409);
      throw conflictErr;
    }
    throw err;
  }
}
