import { LeadTaskType, LeadTaskStatus, LeadPriority, UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { createError } from '../middleware/errorHandler.js';
import { requireOrgId } from '../utils/tenant.js';


export interface CreateLeadTaskInput {
  leadId: string;
  organizationId: string;
  callerId: string;
  callerRole: UserRole;
  callerEmail?: string;
  taskType?: LeadTaskType;
  title: string;
  description?: string | null;
  dueDate: Date;
  priority?: LeadPriority;
  assignedUserId?: string;
  callLogId?: string;
}

export interface UpdateLeadTaskInput {
  taskId: string;
  leadId?: string;
  organizationId: string;
  callerId: string;
  callerRole: UserRole;
  callerEmail?: string;
  title?: string;
  description?: string | null;
  dueDate?: Date;
  priority?: LeadPriority;
  assignedUserId?: string;
  taskType?: LeadTaskType;
}

export interface GetAdvisorTasksQuery {
  filter?: 'upcoming' | 'overdue' | 'completed' | 'all';
  status?: LeadTaskStatus;
  assignedUserId?: string;
  leadId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Creates a persistent follow-up task for a lead.
 */
export async function createLeadTask(params: CreateLeadTaskInput) {
  const orgId = requireOrgId(params.organizationId);
  const { leadId, callerId, callerRole, callerEmail } = params;

  // 1. Verify lead belongs to caller's organization
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: orgId },
    select: { id: true, assignedUserId: true, fullName: true },
  });

  if (!lead) {
    throw createError('Lead not found', 404);
  }

  // 2. Ownership check: AGENT cannot create tasks on a lead assigned to another advisor
  if (callerRole === 'AGENT' && lead.assignedUserId && lead.assignedUserId !== callerId) {
    throw createError('Advisors cannot create tasks for leads owned by another advisor', 403);
  }

  // 3. Validation
  const title = params.title?.trim();
  if (!title) {
    throw createError('Task title is required', 422);
  }

  const dueDate = new Date(params.dueDate);
  if (isNaN(dueDate.getTime())) {
    throw createError('Invalid task due date', 422);
  }

  const taskType = params.taskType ?? 'CALL';
  const priority = params.priority ?? 'MEDIUM';

  // 4. Target assignee resolution & tenant check
  const targetUserId = params.assignedUserId ?? lead.assignedUserId ?? callerId;
  const targetUser = await prisma.user.findFirst({
    where: { id: targetUserId, organizationId: orgId },
    select: { id: true, email: true },
  });

  if (!targetUser) {
    throw createError('Assigned advisor not found in organization', 422);
  }

  // AGENT cannot assign tasks to other advisors unless OWNER
  if (callerRole === 'AGENT' && targetUserId !== callerId) {
    throw createError('Advisors can only assign tasks to themselves', 403);
  }

  // 5. Prevent duplicate task for the same call log
  if (params.callLogId) {
    const existing = await prisma.leadTask.findUnique({
      where: { callLogId: params.callLogId },
    });
    if (existing) {
      throw createError('A task has already been created for this call log', 409);
    }
  }

  // 6. Persistence in transaction
  return prisma.$transaction(async (tx) => {
    const task = await tx.leadTask.create({
      data: {
        leadId,
        organizationId: orgId,
        taskType,
        title,
        description: params.description?.trim() || null,
        dueDate,
        status: 'OPEN',
        priority,
        assignedUserId: targetUserId,
        createdById: callerId,
        callLogId: params.callLogId || null,
      },
      include: {
        lead: { select: { id: true, fullName: true, status: true, priority: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'LEAD_TASK_CREATED',
        entityType: 'LeadTask',
        entityId: task.id,
        actor: callerEmail ?? callerId,
        note: `Task created: "${title}" (${taskType}) for lead ${lead.fullName}`,
        newValue: {
          title,
          taskType,
          dueDate: task.dueDate,
          priority,
          assignedUserId: targetUserId,
        },
      },
    });

    return {
      ...task,
      isOverdue: task.status === 'OPEN' && task.dueDate.getTime() < Date.now(),
    };
  });
}

/**
 * Returns all tasks associated with a specific lead.
 */
export async function getLeadTasks(
  leadId: string,
  organizationId: string,
  callerId: string,
  callerRole: UserRole,
  options?: { status?: LeadTaskStatus },
) {
  const orgId = requireOrgId(organizationId);

  // Verify lead exists in organization
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: orgId },
    select: { id: true, assignedUserId: true },
  });

  if (!lead) {
    throw createError('Lead not found', 404);
  }

  // AGENT cannot read tasks for a lead owned by another advisor
  if (callerRole === 'AGENT' && lead.assignedUserId && lead.assignedUserId !== callerId) {
    throw createError('Advisors cannot view tasks for leads owned by another advisor', 403);
  }

  const where: any = {
    leadId,
    organizationId: orgId,
  };

  if (options?.status) {
    where.status = options.status;
  }

  const tasks = await prisma.leadTask.findMany({
    where,
    orderBy: [
      { status: 'asc' }, // OPEN first, then COMPLETED/CANCELLED
      { dueDate: 'asc' }, // earlier due date first
      { createdAt: 'desc' },
    ],
    include: {
      lead: { select: { id: true, fullName: true, status: true, priority: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
      createdByUser: { select: { id: true, name: true, email: true } },
      completedUser: { select: { id: true, name: true, email: true } },
    },
  });

  const now = Date.now();
  return tasks.map((t) => ({
    ...t,
    isOverdue: t.status === 'OPEN' && t.dueDate.getTime() < now,
  }));
}

/**
 * Returns advisor tasks with filtering for upcoming, overdue, completed, and all tasks.
 */
export async function getAdvisorTasks(
  organizationId: string,
  callerId: string,
  callerRole: UserRole,
  query: GetAdvisorTasksQuery,
) {
  const orgId = requireOrgId(organizationId);
  const now = new Date();

  const where: any = {
    organizationId: orgId,
  };

  // Ownership filtering
  if (callerRole === 'AGENT') {
    where.assignedUserId = callerId;
  } else if (callerRole === 'OWNER') {
    if (query.assignedUserId) {
      where.assignedUserId = query.assignedUserId;
    }
  }

  if (query.leadId) {
    where.leadId = query.leadId;
  }

  // Filter categorization
  if (query.filter === 'overdue') {
    where.status = 'OPEN';
    where.dueDate = { lt: now };
  } else if (query.filter === 'upcoming') {
    where.status = 'OPEN';
    where.dueDate = { gte: now };
  } else if (query.filter === 'completed') {
    where.status = 'COMPLETED';
  } else if (query.status) {
    where.status = query.status;
  }

  const limit = Math.min(query.limit ?? 50, 100);
  const offset = query.offset ?? 0;

  // Order based on filter
  let orderBy: any = [{ dueDate: 'asc' }, { createdAt: 'desc' }];
  if (query.filter === 'completed') {
    orderBy = [{ completedAt: 'desc' }, { dueDate: 'desc' }];
  } else if (query.filter === 'all') {
    orderBy = [{ status: 'asc' }, { dueDate: 'asc' }];
  }

  const tasks = await prisma.leadTask.findMany({
    where,
    orderBy,
    include: {
      lead: { select: { id: true, fullName: true, status: true, priority: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
      createdByUser: { select: { id: true, name: true, email: true } },
      completedUser: { select: { id: true, name: true, email: true } },
    },
    take: limit,
    skip: offset,
  });

  const nowMs = now.getTime();
  return tasks.map((t) => ({
    ...t,
    isOverdue: t.status === 'OPEN' && t.dueDate.getTime() < nowMs,
  }));
}

/**
 * Updates permitted fields on an open task.
 */
export async function updateLeadTask(params: UpdateLeadTaskInput) {
  const orgId = requireOrgId(params.organizationId);
  const { taskId, callerId, callerRole, callerEmail } = params;

  const existing = await prisma.leadTask.findFirst({
    where: {
      id: taskId,
      organizationId: orgId,
      ...(params.leadId ? { leadId: params.leadId } : {}),
    },
    include: {
      lead: { select: { id: true, assignedUserId: true } },
    },
  });

  if (!existing) {
    throw createError('Task not found', 404);
  }

  // AGENT can only update tasks assigned to themselves on leads they own/pool
  if (callerRole === 'AGENT') {
    if (existing.assignedUserId !== callerId) {
      throw createError('Advisors cannot modify tasks assigned to another advisor', 403);
    }
  }

  if (existing.status !== 'OPEN') {
    throw createError(`Cannot edit a task that is ${existing.status.toLowerCase()}`, 422);
  }

  const data: any = {};

  if (params.title !== undefined) {
    const trimmed = params.title.trim();
    if (!trimmed) throw createError('Task title cannot be empty', 422);
    data.title = trimmed;
  }

  if (params.description !== undefined) {
    data.description = params.description?.trim() || null;
  }

  if (params.dueDate !== undefined) {
    const d = new Date(params.dueDate);
    if (isNaN(d.getTime())) throw createError('Invalid task due date', 422);
    data.dueDate = d;
  }

  if (params.taskType !== undefined) {
    data.taskType = params.taskType;
  }

  if (params.priority !== undefined) {
    data.priority = params.priority;
  }

  if (params.assignedUserId !== undefined && params.assignedUserId !== existing.assignedUserId) {
    if (callerRole === 'AGENT') {
      throw createError('Advisors cannot reassign tasks to other advisors', 403);
    }
    const targetUser = await prisma.user.findFirst({
      where: { id: params.assignedUserId, organizationId: orgId },
      select: { id: true },
    });
    if (!targetUser) throw createError('Assigned advisor not found in organization', 422);
    data.assignedUserId = params.assignedUserId;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.leadTask.update({
      where: { id: taskId },
      data,
      include: {
        lead: { select: { id: true, fullName: true, status: true, priority: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'LEAD_TASK_UPDATED',
        entityType: 'LeadTask',
        entityId: taskId,
        actor: callerEmail ?? callerId,
        note: `Task "${updated.title}" updated`,
        previousValue: {
          title: existing.title,
          dueDate: existing.dueDate,
          priority: existing.priority,
          assignedUserId: existing.assignedUserId,
        },
        newValue: data,
      },
    });

    return {
      ...updated,
      isOverdue: updated.status === 'OPEN' && updated.dueDate.getTime() < Date.now(),
    };
  });
}

/**
 * Completes a task, recording the completion timestamp and actor. Idempotent on repeated calls.
 */
export async function completeLeadTask(params: {
  taskId: string;
  leadId?: string;
  organizationId: string;
  callerId: string;
  callerRole: UserRole;
  callerEmail?: string;
}) {
  const orgId = requireOrgId(params.organizationId);
  const { taskId, callerId, callerRole, callerEmail } = params;

  const existing = await prisma.leadTask.findFirst({
    where: {
      id: taskId,
      organizationId: orgId,
      ...(params.leadId ? { leadId: params.leadId } : {}),
    },
    include: {
      lead: { select: { id: true, assignedUserId: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
      createdByUser: { select: { id: true, name: true, email: true } },
      completedUser: { select: { id: true, name: true, email: true } },
    },
  });

  if (!existing) {
    throw createError('Task not found', 404);
  }

  // AGENT can only complete tasks assigned to themselves or on leads they own
  if (callerRole === 'AGENT') {
    const isAssignee = existing.assignedUserId === callerId;
    const isLeadOwner = existing.lead.assignedUserId === callerId;
    if (!isAssignee && !isLeadOwner) {
      throw createError('Advisors cannot complete tasks assigned to another advisor', 403);
    }
  }

  // If already completed, idempotent return without overwriting original completedAt or actor
  if (existing.status === 'COMPLETED') {
    return {
      ...existing,
      isOverdue: false,
    };
  }

  if (existing.status === 'CANCELLED') {
    throw createError('Cannot complete a cancelled task', 422);
  }

  const completedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.leadTask.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        completedAt,
        completedById: callerId,
      },
      include: {
        lead: { select: { id: true, fullName: true, status: true, priority: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
        completedUser: { select: { id: true, name: true, email: true } },
      },
    });

    // Touch lead's updatedAt on task completion to record fresh advisor activity
    await tx.lead.update({
      where: { id: existing.leadId },
      data: { updatedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'LEAD_TASK_COMPLETED',
        entityType: 'LeadTask',
        entityId: taskId,
        actor: callerEmail ?? callerId,
        note: `Task "${updated.title}" marked completed`,
        newValue: {
          status: 'COMPLETED',
          completedAt,
          completedById: callerId,
        },
      },
    });

    return {
      ...updated,
      isOverdue: false, // Completed tasks are never overdue
    };
  });
}

/**
 * Cancels a task with audit tracking.
 */
export async function cancelLeadTask(params: {
  taskId: string;
  leadId?: string;
  organizationId: string;
  callerId: string;
  callerRole: UserRole;
  callerEmail?: string;
  reason?: string;
}) {
  const orgId = requireOrgId(params.organizationId);
  const { taskId, callerId, callerRole, callerEmail, reason } = params;

  const existing = await prisma.leadTask.findFirst({
    where: {
      id: taskId,
      organizationId: orgId,
      ...(params.leadId ? { leadId: params.leadId } : {}),
    },
    include: {
      lead: { select: { id: true, assignedUserId: true } },
    },
  });

  if (!existing) {
    throw createError('Task not found', 404);
  }

  if (callerRole === 'AGENT') {
    const isAssignee = existing.assignedUserId === callerId;
    const isLeadOwner = existing.lead.assignedUserId === callerId;
    if (!isAssignee && !isLeadOwner) {
      throw createError('Advisors cannot cancel tasks assigned to another advisor', 403);
    }
  }

  if (existing.status === 'COMPLETED') {
    throw createError('Cannot cancel a completed task', 422);
  }

  if (existing.status === 'CANCELLED') {
    return {
      ...existing,
      isOverdue: false,
    };
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.leadTask.update({
      where: { id: taskId },
      data: {
        status: 'CANCELLED',
      },
      include: {
        lead: { select: { id: true, fullName: true, status: true, priority: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
        completedUser: { select: { id: true, name: true, email: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'LEAD_TASK_CANCELLED',
        entityType: 'LeadTask',
        entityId: taskId,
        actor: callerEmail ?? callerId,
        note: `Task "${updated.title}" cancelled${reason ? `: ${reason}` : ''}`,
        newValue: {
          status: 'CANCELLED',
          reason,
        },
      },
    });

    return {
      ...updated,
      isOverdue: false, // Cancelled tasks are never overdue
    };
  });
}

export type ActionQueueBucket = 'all' | 'overdue' | 'today' | 'upcoming' | 'attention' | 'completed';

export interface ActionQueueItem {
  id: string;
  actionType: 'TASK' | 'SITE_VISIT' | 'ATTENTION_LEAD';
  bucket: 'overdue' | 'today' | 'upcoming' | 'attention' | 'completed';
  title: string;
  description?: string | null;
  priority: LeadPriority;
  dueDate: string;
  attentionReason?: string | null;
  lead: {
    id: string;
    fullName: string;
    status: string;
    priority: string;
    email?: string | null;
    phone?: string | null;
  };
  assignedUser?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
  leadTaskId?: string | null;
  siteVisitId?: string | null;
  property?: {
    id: string;
    title: string;
    address: string;
    city: string;
    price: number;
  } | null;
  completedAt?: string | null;
  completedByUser?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
}

export interface ActionQueueSummary {
  overdueCount: number;
  dueTodayCount: number;
  upcomingCount: number;
  attentionCount: number;
  completedCount: number;
  totalActive: number;
}

export interface ActionQueueResponse {
  summary: ActionQueueSummary;
  items: ActionQueueItem[];
  timezone: string;
  advisorId?: string | null;
}

export interface GetAdvisorActionQueueParams {
  organizationId: string;
  callerId: string;
  callerRole: UserRole;
  advisorId?: string;
  timezone?: string;
  bucket?: ActionQueueBucket;
  limit?: number;
  offset?: number;
}

/**
 * Returns the unified advisor action queue with deduplication of linked tasks/visits,
 * bucketing by overdue, due today, upcoming, attention required, and recently completed.
 */
export async function getAdvisorActionQueue(
  params: GetAdvisorActionQueueParams,
): Promise<ActionQueueResponse> {
  const orgId = requireOrgId(params.organizationId);

  // 1. Role Authorization
  let targetAdvisorId: string | undefined = undefined;

  if (params.callerRole === 'AGENT') {
    if (params.advisorId && params.advisorId !== params.callerId) {
      throw createError('Advisors cannot inspect other advisors’ action queues', 403);
    }
    targetAdvisorId = params.callerId;
  } else if (params.callerRole === 'OWNER') {
    if (params.advisorId) {
      const advisor = await prisma.user.findFirst({
        where: { id: params.advisorId, organizationId: orgId },
        select: { id: true },
      });
      if (!advisor) {
        throw createError('Assigned advisor not found in organization', 400);
      }
      targetAdvisorId = params.advisorId;
    }
  }

  // 2. Timezone Resolution
  let validTz = 'UTC';
  if (params.timezone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: params.timezone });
      validTz = params.timezone;
    } catch {
      validTz = 'UTC';
    }
  }

  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: validTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayStr = formatter.format(now); // "YYYY-MM-DD"

  // 3. Concurrent Data Fetching
  const [openTasks, scheduledVisits, completedTasks, completedVisits, activeLeads] =
    await Promise.all([
      // 3a. Open Tasks
      prisma.leadTask.findMany({
        where: {
          organizationId: orgId,
          status: 'OPEN',
          ...(targetAdvisorId ? { assignedUserId: targetAdvisorId } : {}),
        },
        include: {
          lead: {
            select: { id: true, fullName: true, status: true, priority: true, email: true, phone: true },
          },
          assignedUser: { select: { id: true, name: true, email: true } },
          siteVisit: {
            include: {
              property: { select: { id: true, title: true, address: true, city: true, price: true } },
            },
          },
        },
      }),

      // 3b. Scheduled Site Visits
      prisma.siteVisit.findMany({
        where: {
          organizationId: orgId,
          status: 'SCHEDULED',
          ...(targetAdvisorId ? { assignedUserId: targetAdvisorId } : {}),
        },
        include: {
          lead: {
            select: { id: true, fullName: true, status: true, priority: true, email: true, phone: true },
          },
          assignedUser: { select: { id: true, name: true, email: true } },
          property: { select: { id: true, title: true, address: true, city: true, price: true } },
          leadTask: { select: { id: true, title: true, status: true, priority: true, dueDate: true } },
        },
      }),

      // 3c. Completed Tasks
      prisma.leadTask.findMany({
        where: {
          organizationId: orgId,
          status: 'COMPLETED',
          completedAt: { not: null },
          ...(targetAdvisorId ? { assignedUserId: targetAdvisorId } : {}),
        },
        include: {
          lead: {
            select: { id: true, fullName: true, status: true, priority: true, email: true, phone: true },
          },
          assignedUser: { select: { id: true, name: true, email: true } },
          completedUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { completedAt: 'desc' },
        take: 100,
      }),

      // 3d. Completed Visits
      prisma.siteVisit.findMany({
        where: {
          organizationId: orgId,
          status: 'COMPLETED',
          completedAt: { not: null },
          ...(targetAdvisorId ? { assignedUserId: targetAdvisorId } : {}),
        },
        include: {
          lead: {
            select: { id: true, fullName: true, status: true, priority: true, email: true, phone: true },
          },
          assignedUser: { select: { id: true, name: true, email: true } },
          property: { select: { id: true, title: true, address: true, city: true, price: true } },
          completedUser: { select: { id: true, name: true, email: true } },
          leadTask: { select: { id: true } },
        },
        orderBy: { completedAt: 'desc' },
        take: 100,
      }),

      // 3e. Active Leads for Attention Rules
      prisma.lead.findMany({
        where: {
          organizationId: orgId,
          status: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] },
          ...(targetAdvisorId ? { assignedUserId: targetAdvisorId } : {}),
        },
        include: {
          assignedUser: { select: { id: true, name: true, email: true } },
          tasks: { where: { status: 'OPEN' }, select: { id: true } },
          siteVisits: { where: { status: 'SCHEDULED' }, select: { id: true } },
          callLogs: { orderBy: { calledAt: 'desc' }, take: 1, select: { calledAt: true } },
        },
      }),
    ]);

  const items: ActionQueueItem[] = [];
  const handledTaskIds = new Set<string>();

  // 4. Map Scheduled Site Visits (and mark linked tasks as handled to prevent duplicate items)
  for (const visit of scheduledVisits) {
    if (visit.leadTask) {
      handledTaskIds.add(visit.leadTask.id);
    }
    const visitDateStr = formatter.format(visit.startAt);
    let bucket: ActionQueueItem['bucket'] = 'upcoming';
    if (visitDateStr < todayStr) {
      bucket = 'overdue';
    } else if (visitDateStr === todayStr) {
      bucket = 'today';
    }

    const priority: LeadPriority = visit.leadTask?.priority || 'HIGH';
    items.push({
      id: `queue-visit-${visit.id}`,
      actionType: 'SITE_VISIT',
      bucket,
      title: visit.property ? `Tour: ${visit.property.title}` : `Site Visit with ${visit.lead.fullName}`,
      description: visit.meetingLocation ? `Location: ${visit.meetingLocation}` : (visit.notes || null),
      priority,
      dueDate: visit.startAt.toISOString(),
      lead: visit.lead,
      assignedUser: visit.assignedUser,
      siteVisitId: visit.id,
      leadTaskId: visit.leadTask?.id || null,
      property: visit.property,
    });
  }

  // 5. Map Open Tasks (deduplicating linked tasks already represented in site visits)
  for (const task of openTasks) {
    if (handledTaskIds.has(task.id) || task.siteVisitId) {
      continue;
    }
    const taskDateStr = formatter.format(task.dueDate);
    let bucket: ActionQueueItem['bucket'] = 'upcoming';
    if (taskDateStr < todayStr) {
      bucket = 'overdue';
    } else if (taskDateStr === todayStr) {
      bucket = 'today';
    }

    items.push({
      id: `queue-task-${task.id}`,
      actionType: 'TASK',
      bucket,
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate.toISOString(),
      lead: task.lead,
      assignedUser: task.assignedUser,
      leadTaskId: task.id,
      siteVisitId: null,
      property: null,
    });
  }

  // 6. Map Attention-Required Leads
  for (const lead of activeLeads) {
    let attentionReason: string | null = null;
    let priority: LeadPriority = 'MEDIUM';

    const hasOpenAction = lead.tasks.length > 0 || lead.siteVisits.length > 0;
    const lastCall = lead.callLogs[0]?.calledAt;
    const daysSinceCall = lastCall
      ? Math.floor((now.getTime() - new Date(lastCall).getTime()) / (1000 * 60 * 60 * 24))
      : Math.floor((now.getTime() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    if (lead.status === 'NEW' && lead.callLogs.length === 0) {
      attentionReason = 'New lead awaiting first contact';
      priority = lead.priority === 'URGENT' ? 'URGENT' : 'HIGH';
    } else if (daysSinceCall >= 7 && lead.callLogs.length > 0) {
      attentionReason = `No recorded outreach for ${daysSinceCall} days`;
      priority = lead.priority === 'URGENT' ? 'URGENT' : 'HIGH';
    } else if (!hasOpenAction) {
      attentionReason = 'No open task or site visit scheduled';
      priority = lead.priority === 'URGENT' ? 'URGENT' : (lead.priority === 'HIGH' ? 'HIGH' : 'MEDIUM');
    }

    if (attentionReason) {
      items.push({
        id: `queue-attention-${lead.id}`,
        actionType: 'ATTENTION_LEAD',
        bucket: 'attention',
        title: `Follow Up: ${lead.fullName}`,
        description: `Lead Status: ${lead.status}. ${attentionReason}.`,
        priority,
        dueDate: now.toISOString(),
        attentionReason,
        lead: {
          id: lead.id,
          fullName: lead.fullName,
          status: lead.status,
          priority: lead.priority,
          email: null,
          phone: null,
        },
        assignedUser: lead.assignedUser,
        leadTaskId: null,
        siteVisitId: null,
        property: null,
      });
    }
  }

  // 7. Map Completed Today Items (deduplicated)
  const handledCompletedTaskIds = new Set<string>();

  for (const visit of completedVisits) {
    if (!visit.completedAt) continue;
    if (formatter.format(visit.completedAt) === todayStr) {
      if (visit.leadTask) handledCompletedTaskIds.add(visit.leadTask.id);
      items.push({
        id: `queue-comp-visit-${visit.id}`,
        actionType: 'SITE_VISIT',
        bucket: 'completed',
        title: visit.property
          ? `Completed Tour: ${visit.property.title}`
          : `Completed Visit with ${visit.lead.fullName}`,
        description: null,
        priority: 'MEDIUM',
        dueDate: visit.startAt.toISOString(),
        completedAt: visit.completedAt.toISOString(),
        completedByUser: visit.completedUser,
        lead: visit.lead,
        assignedUser: visit.assignedUser,
        siteVisitId: visit.id,
        property: visit.property,
      });
    }
  }

  for (const task of completedTasks) {
    if (!task.completedAt) continue;
    if (handledCompletedTaskIds.has(task.id)) continue;
    if (formatter.format(task.completedAt) === todayStr) {
      items.push({
        id: `queue-comp-task-${task.id}`,
        actionType: 'TASK',
        bucket: 'completed',
        title: task.title,
        description: null,
        priority: task.priority,
        dueDate: task.dueDate.toISOString(),
        completedAt: task.completedAt.toISOString(),
        completedByUser: task.completedUser,
        lead: task.lead,
        assignedUser: task.assignedUser,
        leadTaskId: task.id,
      });
    }
  }

  // 8. Compute Summary Counters
  const overdueCount = items.filter((i) => i.bucket === 'overdue').length;
  const dueTodayCount = items.filter((i) => i.bucket === 'today').length;
  const upcomingCount = items.filter((i) => i.bucket === 'upcoming').length;
  const attentionCount = items.filter((i) => i.bucket === 'attention').length;
  const completedCount = items.filter((i) => i.bucket === 'completed').length;
  const totalActive = overdueCount + dueTodayCount + upcomingCount + attentionCount;

  const summary: ActionQueueSummary = {
    overdueCount,
    dueTodayCount,
    upcomingCount,
    attentionCount,
    completedCount,
    totalActive,
  };

  // 9. Filter by Bucket if specified
  let filteredItems = items;
  if (params.bucket && params.bucket !== 'all') {
    filteredItems = items.filter((i) => i.bucket === params.bucket);
  }

  // 10. Deterministic Sorting
  const priorityWeight: Record<string, number> = {
    URGENT: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  filteredItems.sort((a, b) => {
    if (a.bucket === 'completed' && b.bucket === 'completed') {
      const tA = new Date(a.completedAt || a.dueDate).getTime();
      const tB = new Date(b.completedAt || b.dueDate).getTime();
      if (tB !== tA) return tB - tA;
      return a.id.localeCompare(b.id);
    }

    // Sort by Priority DESC
    const pA = priorityWeight[a.priority] || 2;
    const pB = priorityWeight[b.priority] || 2;
    if (pB !== pA) return pB - pA;

    // Secondary sort by dueDate ASC
    const dA = new Date(a.dueDate).getTime();
    const dB = new Date(b.dueDate).getTime();
    if (dA !== dB) return dA - dB;

    // Tie-breaker: ID ASC
    return a.id.localeCompare(b.id);
  });

  // 11. Bounded Pagination
  const limit = Math.min(params.limit ?? 50, 100);
  const offset = Math.max(params.offset ?? 0, 0);
  const paginated = filteredItems.slice(offset, offset + limit);

  return {
    summary,
    items: paginated,
    timezone: validTz,
    advisorId: targetAdvisorId || null,
  };
}
