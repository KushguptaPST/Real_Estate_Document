import { SiteVisitStatus, UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { createError } from '../middleware/errorHandler.js';
import { requireOrgId } from '../utils/tenant.js';


export interface ScheduleSiteVisitInput {
  leadId: string;
  organizationId: string;
  callerId: string;
  callerRole: UserRole;
  callerEmail?: string;
  propertyId?: string | null;
  startAt: string | Date;
  endAt?: string | Date;
  durationMinutes?: number;
  meetingLocation?: string | null;
  notes?: string | null;
  assignedUserId?: string;
}

export interface GetLeadSiteVisitsQuery {
  leadId: string;
  organizationId: string;
  callerId: string;
  callerRole: UserRole;
}

export interface GetSiteVisitsQuery {
  organizationId: string;
  callerId: string;
  callerRole: UserRole;
  status?: SiteVisitStatus;
  startDate?: string;
  endDate?: string;
  advisorId?: string;
  propertyId?: string;
  leadId?: string;
}

export interface CheckAvailabilityQuery {
  organizationId: string;
  callerId: string;
  callerRole: UserRole;
  advisorId?: string;
  startAt: string | Date;
  endAt?: string | Date;
  durationMinutes?: number;
  excludeVisitId?: string;
}

export interface RescheduleSiteVisitInput {
  visitId: string;
  organizationId: string;
  callerId: string;
  callerRole: UserRole;
  callerEmail?: string;
  startAt?: string | Date;
  endAt?: string | Date;
  durationMinutes?: number;
  meetingLocation?: string | null;
  notes?: string | null;
  propertyId?: string | null;
  assignedUserId?: string;
}

export interface CompleteSiteVisitInput {
  visitId: string;
  organizationId: string;
  callerId: string;
  callerRole: UserRole;
  callerEmail?: string;
  outcomeNotes?: string | null;
}

export interface CancelSiteVisitInput {
  visitId: string;
  organizationId: string;
  callerId: string;
  callerRole: UserRole;
  callerEmail?: string;
  reason?: string | null;
}

export interface MarkNoShowSiteVisitInput {
  visitId: string;
  organizationId: string;
  callerId: string;
  callerRole: UserRole;
  callerEmail?: string;
  notes?: string | null;
}

/**
 * Helper to parse and validate startAt / endAt timestamps.
 */
function parseAndValidateInterval(
  startInput: string | Date | undefined,
  endInput?: string | Date,
  durationMinutes?: number,
): { startAt: Date; endAt: Date } {
  if (!startInput) {
    throw createError('Start time is required', 400);
  }

  // Validate calendar bounds if input is string matching YYYY-MM-DD
  if (typeof startInput === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(startInput);
    if (match) {
      const y = Number(match[1]);
      const m = Number(match[2]);
      const d = Number(match[3]);
      const test = new Date(Date.UTC(y, m - 1, d));
      if (test.getUTCFullYear() !== y || test.getUTCMonth() !== m - 1 || test.getUTCDate() !== d) {
        throw createError(`Invalid calendar date: "${match[0]}"`, 400);
      }
    }
  }

  const startAt = startInput instanceof Date ? startInput : new Date(startInput);
  if (isNaN(startAt.getTime())) {
    throw createError('Invalid start time format', 400);
  }

  let endAt: Date;
  if (endInput) {
    if (typeof endInput === 'string') {
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(endInput);
      if (match) {
        const y = Number(match[1]);
        const m = Number(match[2]);
        const d = Number(match[3]);
        const test = new Date(Date.UTC(y, m - 1, d));
        if (test.getUTCFullYear() !== y || test.getUTCMonth() !== m - 1 || test.getUTCDate() !== d) {
          throw createError(`Invalid calendar date: "${match[0]}"`, 400);
        }
      }
    }

    endAt = endInput instanceof Date ? endInput : new Date(endInput);
    if (isNaN(endAt.getTime())) {
      throw createError('Invalid end time format', 400);
    }
  } else if (typeof durationMinutes === 'number' && durationMinutes > 0) {
    endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
  } else {
    // Default to 60 minutes if duration is not provided
    endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
  }

  if (endAt.getTime() <= startAt.getTime()) {
    throw createError('End time must be strictly after start time', 400);
  }

  return { startAt, endAt };
}


/**
 * Schedule a site visit with concurrency-safe conflict prevention and automatic follow-up task linking.
 */
export async function scheduleSiteVisit(params: ScheduleSiteVisitInput) {
  const orgId = requireOrgId(params.organizationId);
  const callerId = params.callerId;
  const callerRole = params.callerRole;

  const { startAt, endAt } = parseAndValidateInterval(
    params.startAt,
    params.endAt,
    params.durationMinutes,
  );

  // 1. Verify Lead belongs to tenant
  const lead = await prisma.lead.findFirst({
    where: { id: params.leadId, organizationId: orgId },
  });

  if (!lead) {
    throw createError('Lead not found', 404);
  }

  // 2. Role Authorization for Lead
  if (callerRole === 'AGENT') {
    if (lead.assignedUserId !== callerId) {
      throw createError('Agents can only schedule site visits for their assigned leads', 403);
    }
    if (params.assignedUserId && params.assignedUserId !== callerId) {
      throw createError('Agents cannot assign site visits to other advisors', 403);
    }
  }

  // Determine target advisor
  const targetAdvisorId =
    callerRole === 'AGENT'
      ? callerId
      : params.assignedUserId || lead.assignedUserId || callerId;

  // Verify target advisor belongs to this organization
  const targetAdvisor = await prisma.user.findFirst({
    where: { id: targetAdvisorId, organizationId: orgId },
  });

  if (!targetAdvisor) {
    throw createError('Assigned advisor must belong to the same organization', 400);
  }

  // 3. Property verification (optional)
  let property = null;
  if (params.propertyId) {
    property = await prisma.property.findFirst({
      where: { id: params.propertyId, organizationId: orgId },
    });
    if (!property) {
      throw createError('Property not found in this organization', 404);
    }
  }

  // 4. Concurrency-Safe Booking Transaction
  // We lock the advisor user row with `SELECT id FROM users WHERE id = $1 FOR UPDATE`
  // so concurrent booking attempts for this advisor serialize, preventing race condition double bookings.
  const result = await prisma.$transaction(async (tx) => {
    // Acquire row-level lock on the advisor
    await tx.$executeRaw`SELECT id FROM users WHERE id = ${targetAdvisorId} FOR UPDATE`;

    // Check for interval overlap against active (non-cancelled) visits:
    // existing.startAt < requested.endAt AND existing.endAt > requested.startAt
    const conflictingVisit = await tx.siteVisit.findFirst({
      where: {
        organizationId: orgId,
        assignedUserId: targetAdvisorId,
        status: { not: 'CANCELLED' },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true, startAt: true, endAt: true },
    });

    if (conflictingVisit) {
      throw createError(
        'Advisor has a conflicting site visit during the requested time window',
        409,
      );
    }

    // Create the SiteVisit record
    const visit = await tx.siteVisit.create({
      data: {
        organizationId: orgId,
        leadId: lead.id,
        propertyId: property ? property.id : null,
        assignedUserId: targetAdvisorId,
        createdById: callerId,
        startAt,
        endAt,
        status: 'SCHEDULED',
        meetingLocation: params.meetingLocation?.trim() || null,
        notes: params.notes?.trim() || null,
      },
      include: {
        lead: { select: { id: true, fullName: true, status: true, priority: true } },
        property: { select: { id: true, title: true, address: true, city: true, price: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
      },
    });

    // Create linked actionable LeadTask (Type: SITE_VISIT, Priority: HIGH)
    const taskTitle = property
      ? `Site Visit: ${property.title}`
      : `Site Visit with ${lead.fullName}`;

    const leadTask = await tx.leadTask.create({
      data: {
        leadId: lead.id,
        organizationId: orgId,
        taskType: 'SITE_VISIT',
        title: taskTitle,
        description:
          params.notes?.trim() ||
          (params.meetingLocation ? `Location: ${params.meetingLocation}` : null),
        dueDate: startAt,
        status: 'OPEN',
        priority: 'HIGH',
        assignedUserId: targetAdvisorId,
        createdById: callerId,
        siteVisitId: visit.id,
      },
      select: {
        id: true,
        title: true,
        taskType: true,
        dueDate: true,
        status: true,
        priority: true,
        assignedUserId: true,
      },
    });

    // Touch lead updatedAt
    await tx.lead.update({
      where: { id: lead.id },
      data: { updatedAt: new Date() },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'SITE_VISIT_SCHEDULED',
        entityType: 'SiteVisit',
        entityId: visit.id,
        actor: params.callerEmail ?? callerId,
        note: `Site visit scheduled for lead ${lead.fullName}${property ? ` at "${property.title}"` : ''} on ${startAt.toISOString()}`,
        newValue: {
          visitId: visit.id,
          leadId: lead.id,
          propertyId: property?.id ?? null,
          assignedUserId: targetAdvisorId,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          taskId: leadTask.id,
        },
      },
    });

    return {
      ...visit,
      leadTask,
    };
  });

  return result;
}

/**
 * List visits for a lead.
 */
export async function getLeadSiteVisits(params: GetLeadSiteVisitsQuery) {
  const orgId = requireOrgId(params.organizationId);
  const callerId = params.callerId;
  const callerRole = params.callerRole;

  const lead = await prisma.lead.findFirst({
    where: { id: params.leadId, organizationId: orgId },
  });

  if (!lead) {
    throw createError('Lead not found', 404);
  }

  if (callerRole === 'AGENT' && lead.assignedUserId !== callerId) {
    throw createError('Agents can only view site visits for their assigned leads', 403);
  }

  const visits = await prisma.siteVisit.findMany({
    where: {
      leadId: lead.id,
      organizationId: orgId,
    },
    include: {
      lead: { select: { id: true, fullName: true, status: true, priority: true } },
      property: { select: { id: true, title: true, address: true, city: true, price: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
      createdByUser: { select: { id: true, name: true, email: true } },
      cancelledUser: { select: { id: true, name: true, email: true } },
      completedUser: { select: { id: true, name: true, email: true } },
      leadTask: { select: { id: true, title: true, status: true, dueDate: true, priority: true } },
    },
    orderBy: { startAt: 'asc' },
  });

  return visits;
}

/**
 * List authorized site visits with date and status filters.
 */
export async function getSiteVisits(params: GetSiteVisitsQuery) {
  const orgId = requireOrgId(params.organizationId);
  const callerId = params.callerId;
  const callerRole = params.callerRole;

  const where: Record<string, unknown> = {
    organizationId: orgId,
  };

  if (callerRole === 'AGENT') {
    where.assignedUserId = callerId;
  } else if (params.advisorId) {
    where.assignedUserId = params.advisorId;
  }

  if (params.status) {
    where.status = params.status;
  }

  if (params.leadId) {
    where.leadId = params.leadId;
  }

  if (params.propertyId) {
    where.propertyId = params.propertyId;
  }

  if (params.startDate || params.endDate) {
    const startRange: Record<string, Date> = {};
    if (params.startDate) {
      const d = new Date(params.startDate);
      if (!isNaN(d.getTime())) startRange.gte = d;
    }
    if (params.endDate) {
      const d = new Date(params.endDate);
      if (!isNaN(d.getTime())) startRange.lte = d;
    }
    if (Object.keys(startRange).length > 0) {
      where.startAt = startRange;
    }
  }

  const visits = await prisma.siteVisit.findMany({
    where,
    include: {
      lead: { select: { id: true, fullName: true, status: true, priority: true } },
      property: { select: { id: true, title: true, address: true, city: true, price: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
      createdByUser: { select: { id: true, name: true, email: true } },
      cancelledUser: { select: { id: true, name: true, email: true } },
      completedUser: { select: { id: true, name: true, email: true } },
      leadTask: { select: { id: true, title: true, status: true, dueDate: true, priority: true } },
    },
    orderBy: { startAt: 'asc' },
  });

  return visits;
}

/**
 * Advisory check to determine if an advisor is available for a requested interval.
 */
export async function checkAdvisorAvailability(params: CheckAvailabilityQuery) {
  const orgId = requireOrgId(params.organizationId);
  const callerId = params.callerId;
  const callerRole = params.callerRole;

  const { startAt, endAt } = parseAndValidateInterval(
    params.startAt,
    params.endAt,
    params.durationMinutes,
  );

  const advisorId =
    callerRole === 'AGENT' ? callerId : params.advisorId || callerId;

  // Verify advisor belongs to org
  const advisor = await prisma.user.findFirst({
    where: { id: advisorId, organizationId: orgId },
  });

  if (!advisor) {
    throw createError('Advisor not found in this organization', 404);
  }

  const conflictingVisit = await prisma.siteVisit.findFirst({
    where: {
      organizationId: orgId,
      assignedUserId: advisorId,
      status: { not: 'CANCELLED' },
      id: params.excludeVisitId ? { not: params.excludeVisitId } : undefined,
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true },
  });

  return {
    available: !conflictingVisit,
    advisorId,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
  };
}

/**
 * Reschedule or update a site visit with concurrency-safe conflict checking.
 */
export async function rescheduleSiteVisit(params: RescheduleSiteVisitInput) {
  const orgId = requireOrgId(params.organizationId);
  const callerId = params.callerId;
  const callerRole = params.callerRole;

  const existing = await prisma.siteVisit.findFirst({
    where: { id: params.visitId, organizationId: orgId },
    include: {
      lead: true,
      leadTask: true,
    },
  });

  if (!existing) {
    throw createError('Site visit not found', 404);
  }

  // Authorization check
  if (callerRole === 'AGENT') {
    if (existing.assignedUserId !== callerId && existing.lead.assignedUserId !== callerId) {
      throw createError('Agents can only reschedule their assigned site visits', 403);
    }
    if (params.assignedUserId && params.assignedUserId !== callerId) {
      throw createError('Agents cannot reassign site visits to other advisors', 403);
    }
  }

  // State lifecycle check
  if (existing.status === 'CANCELLED') {
    throw createError('Cannot reschedule a cancelled site visit', 422);
  }
  if (existing.status === 'COMPLETED') {
    throw createError('Cannot reschedule a completed site visit', 422);
  }
  if (existing.status === 'NO_SHOW') {
    throw createError('Cannot reschedule a visit marked as no-show', 422);
  }

  const newStartAt = params.startAt ? new Date(params.startAt) : existing.startAt;
  let newEndAt = params.endAt ? new Date(params.endAt) : existing.endAt;

  if (params.startAt && !params.endAt) {
    if (params.durationMinutes && params.durationMinutes > 0) {
      newEndAt = new Date(newStartAt.getTime() + params.durationMinutes * 60 * 1000);
    } else {
      // Preserve prior visit duration
      const prevDuration = existing.endAt.getTime() - existing.startAt.getTime();
      newEndAt = new Date(newStartAt.getTime() + Math.max(prevDuration, 15 * 60 * 1000));
    }
  }

  if (isNaN(newStartAt.getTime()) || isNaN(newEndAt.getTime())) {
    throw createError('Invalid date/time provided', 400);
  }

  if (newEndAt.getTime() <= newStartAt.getTime()) {
    throw createError('End time must be strictly after start time', 400);
  }

  const targetAdvisorId =
    callerRole === 'AGENT'
      ? callerId
      : params.assignedUserId || existing.assignedUserId;

  if (params.assignedUserId && params.assignedUserId !== existing.assignedUserId) {
    const advisorExists = await prisma.user.findFirst({
      where: { id: targetAdvisorId, organizationId: orgId },
    });
    if (!advisorExists) {
      throw createError('Assigned advisor must belong to the same organization', 400);
    }
  }

  // SEC-01: Validate propertyId ownership within tenant scope
  let targetPropertyId: string | null = existing.propertyId;
  if (params.propertyId !== undefined) {
    if (params.propertyId) {
      const prop = await prisma.property.findFirst({
        where: { id: params.propertyId, organizationId: orgId },
      });
      if (!prop) {
        throw createError('Property not found in this organization', 404);
      }
      targetPropertyId = prop.id;
    } else {
      // Explicitly null / empty -> clears property
      targetPropertyId = null;
    }
  }

  // Concurrency-Safe Transaction
  const updated = await prisma.$transaction(async (tx) => {
    // 1. Lock advisor row to serialize concurrent bookings targeting this advisor
    await tx.$executeRaw`SELECT id FROM users WHERE id = ${targetAdvisorId} FOR UPDATE`;

    // 2. CONC-01: Re-read site visit inside the transaction under lock to prevent race with concurrent cancellation/completion
    const currentVisit = await tx.siteVisit.findFirst({
      where: { id: existing.id, organizationId: orgId },
      include: { leadTask: true },
    });

    if (!currentVisit) {
      throw createError('Site visit not found', 404);
    }

    if (currentVisit.status === 'CANCELLED') {
      throw createError('Cannot reschedule a cancelled site visit', 422);
    }
    if (currentVisit.status === 'COMPLETED') {
      throw createError('Cannot reschedule a completed site visit', 422);
    }
    if (currentVisit.status === 'NO_SHOW') {
      throw createError('Cannot reschedule a visit marked as no-show', 422);
    }

    // Overlap check (excluding current visit)
    const conflict = await tx.siteVisit.findFirst({
      where: {
        organizationId: orgId,
        assignedUserId: targetAdvisorId,
        status: { not: 'CANCELLED' },
        id: { not: existing.id },
        startAt: { lt: newEndAt },
        endAt: { gt: newStartAt },
      },
      select: { id: true },
    });

    if (conflict) {
      throw createError(
        'Advisor has a conflicting site visit during the requested time window',
        409,
      );
    }

    const visit = await tx.siteVisit.update({
      where: { id: existing.id },
      data: {
        startAt: newStartAt,
        endAt: newEndAt,
        assignedUserId: targetAdvisorId,
        meetingLocation:
          params.meetingLocation !== undefined
            ? params.meetingLocation?.trim() || null
            : currentVisit.meetingLocation,
        notes:
          params.notes !== undefined
            ? params.notes?.trim() || null
            : currentVisit.notes,
        propertyId: targetPropertyId,
      },
      include: {
        lead: { select: { id: true, fullName: true, status: true, priority: true } },
        property: { select: { id: true, title: true, address: true, city: true, price: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
        leadTask: { select: { id: true, title: true, status: true, dueDate: true, priority: true } },
      },
    });

    // Keep linked task due date synchronized if open (conditional update to prevent mutating cancelled/completed tasks)
    if (currentVisit.leadTask && currentVisit.leadTask.status === 'OPEN') {
      await tx.leadTask.updateMany({
        where: { id: currentVisit.leadTask.id, status: 'OPEN' },
        data: {
          dueDate: newStartAt,
          assignedUserId: targetAdvisorId,
        },
      });
    }

    // Touch lead updatedAt
    await tx.lead.update({
      where: { id: existing.leadId },
      data: { updatedAt: new Date() },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'SITE_VISIT_RESCHEDULED',
        entityType: 'SiteVisit',
        entityId: visit.id,
        actor: params.callerEmail ?? callerId,
        note: `Site visit rescheduled to ${newStartAt.toISOString()} for lead ${existing.lead.fullName}`,
        previousValue: {
          startAt: existing.startAt.toISOString(),
          endAt: existing.endAt.toISOString(),
          assignedUserId: existing.assignedUserId,
        },
        newValue: {
          startAt: newStartAt.toISOString(),
          endAt: newEndAt.toISOString(),
          assignedUserId: targetAdvisorId,
        },
      },
    });

    return visit;
  });

  return updated;
}

/**
 * Cancel a site visit with reason tracking and linked task cancellation.
 */
export async function cancelSiteVisit(params: CancelSiteVisitInput) {
  const orgId = requireOrgId(params.organizationId);
  const callerId = params.callerId;
  const callerRole = params.callerRole;

  const existing = await prisma.siteVisit.findFirst({
    where: { id: params.visitId, organizationId: orgId },
    include: {
      lead: true,
      leadTask: true,
    },
  });

  if (!existing) {
    throw createError('Site visit not found', 404);
  }

  if (callerRole === 'AGENT') {
    if (existing.assignedUserId !== callerId && existing.lead.assignedUserId !== callerId) {
      throw createError('Agents can only cancel their assigned site visits', 403);
    }
  }

  // Idempotency: if already cancelled, return existing
  if (existing.status === 'CANCELLED') {
    return existing;
  }

  if (existing.status === 'COMPLETED') {
    throw createError('Cannot cancel a completed site visit', 422);
  }

  const updated = await prisma.$transaction(async (tx) => {
    // CONC-01: Re-read inside transaction under lock
    const currentVisit = await tx.siteVisit.findFirst({
      where: { id: existing.id, organizationId: orgId },
      include: { leadTask: true },
    });

    if (!currentVisit) {
      throw createError('Site visit not found', 404);
    }

    if (currentVisit.status === 'CANCELLED') {
      return currentVisit;
    }

    if (currentVisit.status === 'COMPLETED') {
      throw createError('Cannot cancel a completed site visit', 422);
    }

    const visit = await tx.siteVisit.update({
      where: { id: existing.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledById: callerId,
        cancelReason: params.reason?.trim() || null,
      },
      include: {
        lead: { select: { id: true, fullName: true, status: true, priority: true } },
        property: { select: { id: true, title: true, address: true, city: true, price: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        cancelledUser: { select: { id: true, name: true, email: true } },
        leadTask: { select: { id: true, title: true, status: true, dueDate: true, priority: true } },
      },
    });

    // Cancel linked task if open
    if (currentVisit.leadTask && currentVisit.leadTask.status === 'OPEN') {
      await tx.leadTask.updateMany({
        where: { id: currentVisit.leadTask.id, status: 'OPEN' },
        data: {
          status: 'CANCELLED',
        },
      });
    }

    // Touch lead updatedAt
    await tx.lead.update({
      where: { id: existing.leadId },
      data: { updatedAt: new Date() },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'SITE_VISIT_CANCELLED',
        entityType: 'SiteVisit',
        entityId: visit.id,
        actor: params.callerEmail ?? callerId,
        note: `Site visit cancelled: "${params.reason?.trim() || 'No reason provided'}"`,
        newValue: {
          status: 'CANCELLED',
          cancelReason: params.reason?.trim() || null,
        },
      },
    });

    return visit;
  });

  return updated;
}

/**
 * Record a completed site visit with outcome metadata.
 */
export async function completeSiteVisit(params: CompleteSiteVisitInput) {
  const orgId = requireOrgId(params.organizationId);
  const callerId = params.callerId;
  const callerRole = params.callerRole;

  const existing = await prisma.siteVisit.findFirst({
    where: { id: params.visitId, organizationId: orgId },
    include: {
      lead: true,
      leadTask: true,
    },
  });

  if (!existing) {
    throw createError('Site visit not found', 404);
  }

  if (callerRole === 'AGENT') {
    if (existing.assignedUserId !== callerId && existing.lead.assignedUserId !== callerId) {
      throw createError('Agents can only complete their assigned site visits', 403);
    }
  }

  // Idempotency: if already completed, return existing
  if (existing.status === 'COMPLETED') {
    return existing;
  }

  if (existing.status === 'CANCELLED') {
    throw createError('Cannot complete a cancelled site visit', 422);
  }

  if (existing.status === 'NO_SHOW') {
    throw createError('Cannot complete a visit marked as no-show', 422);
  }

  // LIFE-01: Reject premature completion if visit start time is in the future
  if (existing.startAt.getTime() > Date.now()) {
    throw createError('Cannot complete a site visit before its scheduled start time', 422);
  }

  const updated = await prisma.$transaction(async (tx) => {
    // CONC-01: Re-read inside transaction under lock
    const currentVisit = await tx.siteVisit.findFirst({
      where: { id: existing.id, organizationId: orgId },
      include: { leadTask: true },
    });

    if (!currentVisit) {
      throw createError('Site visit not found', 404);
    }

    if (currentVisit.status === 'COMPLETED') {
      return currentVisit;
    }

    if (currentVisit.status === 'CANCELLED') {
      throw createError('Cannot complete a cancelled site visit', 422);
    }

    if (currentVisit.status === 'NO_SHOW') {
      throw createError('Cannot complete a visit marked as no-show', 422);
    }

    if (currentVisit.startAt.getTime() > Date.now()) {
      throw createError('Cannot complete a site visit before its scheduled start time', 422);
    }

    const completedAt = new Date();
    const visit = await tx.siteVisit.update({
      where: { id: existing.id },
      data: {
        status: 'COMPLETED',
        completedAt,
        completedById: callerId,
        outcomeNotes: params.outcomeNotes?.trim() || null,
      },
      include: {
        lead: { select: { id: true, fullName: true, status: true, priority: true } },
        property: { select: { id: true, title: true, address: true, city: true, price: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        completedUser: { select: { id: true, name: true, email: true } },
        leadTask: { select: { id: true, title: true, status: true, dueDate: true, priority: true } },
      },
    });

    // Complete linked task if open
    if (currentVisit.leadTask && currentVisit.leadTask.status === 'OPEN') {
      await tx.leadTask.updateMany({
        where: { id: currentVisit.leadTask.id, status: 'OPEN' },
        data: {
          status: 'COMPLETED',
          completedAt,
          completedById: callerId,
        },
      });
    }

    // Touch lead updatedAt
    await tx.lead.update({
      where: { id: existing.leadId },
      data: { updatedAt: completedAt },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'SITE_VISIT_COMPLETED',
        entityType: 'SiteVisit',
        entityId: visit.id,
        actor: params.callerEmail ?? callerId,
        note: `Site visit completed. Outcome: "${params.outcomeNotes?.trim() || 'No outcome notes recorded'}"`,
        newValue: {
          status: 'COMPLETED',
          outcomeNotes: params.outcomeNotes?.trim() || null,
        },
      },
    });

    return visit;
  });

  return updated;
}

/**
 * Mark a site visit as NO_SHOW with outcome notes and cancel open linked task.
 */
export async function markNoShowSiteVisit(params: MarkNoShowSiteVisitInput) {
  const orgId = requireOrgId(params.organizationId);
  const callerId = params.callerId;
  const callerRole = params.callerRole;

  const existing = await prisma.siteVisit.findFirst({
    where: { id: params.visitId, organizationId: orgId },
    include: {
      lead: true,
      leadTask: true,
    },
  });

  if (!existing) {
    throw createError('Site visit not found', 404);
  }

  if (callerRole === 'AGENT') {
    if (existing.assignedUserId !== callerId && existing.lead.assignedUserId !== callerId) {
      throw createError('Agents can only update their assigned site visits', 403);
    }
  }

  // Idempotency: if already NO_SHOW, return existing
  if (existing.status === 'NO_SHOW') {
    return existing;
  }

  if (existing.status === 'CANCELLED') {
    throw createError('Cannot mark a cancelled site visit as no-show', 422);
  }
  if (existing.status === 'COMPLETED') {
    throw createError('Cannot mark a completed site visit as no-show', 422);
  }

  // LIFE-01: Reject premature no-show if visit start time is in the future
  if (existing.startAt.getTime() > Date.now()) {
    throw createError('Cannot mark a site visit as no-show before its scheduled start time', 422);
  }

  const updated = await prisma.$transaction(async (tx) => {
    // CONC-01: Re-read inside transaction under lock
    const currentVisit = await tx.siteVisit.findFirst({
      where: { id: existing.id, organizationId: orgId },
      include: { leadTask: true },
    });

    if (!currentVisit) {
      throw createError('Site visit not found', 404);
    }

    if (currentVisit.status === 'NO_SHOW') {
      return currentVisit;
    }

    if (currentVisit.status === 'CANCELLED') {
      throw createError('Cannot mark a cancelled site visit as no-show', 422);
    }
    if (currentVisit.status === 'COMPLETED') {
      throw createError('Cannot mark a completed site visit as no-show', 422);
    }

    if (currentVisit.startAt.getTime() > Date.now()) {
      throw createError('Cannot mark a site visit as no-show before its scheduled start time', 422);
    }

    const noShowAt = new Date();
    const visit = await tx.siteVisit.update({
      where: { id: existing.id },
      data: {
        status: 'NO_SHOW',
        noShowAt,
        noShowById: callerId,
        outcomeNotes: params.notes?.trim() || existing.outcomeNotes,
      },
      include: {
        lead: { select: { id: true, fullName: true, status: true, priority: true } },
        property: { select: { id: true, title: true, address: true, city: true, price: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        leadTask: { select: { id: true, title: true, status: true, dueDate: true, priority: true } },
      },
    });

    // Cancel linked task if open
    if (currentVisit.leadTask && currentVisit.leadTask.status === 'OPEN') {
      await tx.leadTask.updateMany({
        where: { id: currentVisit.leadTask.id, status: 'OPEN' },
        data: {
          status: 'CANCELLED',
        },
      });
    }

    // Touch lead updatedAt
    await tx.lead.update({
      where: { id: existing.leadId },
      data: { updatedAt: noShowAt },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'SITE_VISIT_NO_SHOW',
        entityType: 'SiteVisit',
        entityId: visit.id,
        actor: params.callerEmail ?? callerId,
        note: `Lead marked as no-show for site visit`,
        newValue: {
          status: 'NO_SHOW',
          notes: params.notes?.trim() || null,
        },
      },
    });

    return visit;
  });

  return updated;
}
