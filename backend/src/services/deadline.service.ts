/**
 * Deadline Service
 *
 * Core orchestration: given a list of extracted ContingencyClauses and
 * a deal acceptance date, computes Deadline records using the date engine
 * and persists them via Prisma.
 *
 * v1: orchestration stubs only — AI extraction is not yet wired.
 */

import { type ContingencyClause } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { computeContractDeadline } from './dateEngine.service.js';
import { logger } from '../utils/logger.js';
import { createError } from '../middleware/errorHandler.js';
import { requireOrgId } from '../utils/tenant.js';


export interface ComputedDeadline {
  clauseId: string;
  label: string;
  computedDate: Date;
  dayType: 'calendar' | 'business';
}

/**
 * Given an array of clauses (already saved to DB), compute and upsert
 * their corresponding Deadline rows.
 */
export async function computeDeadlinesForDeal(
  dealId: string,
  acceptanceDate: Date,
  clauses: ContingencyClause[],
  organizationId: string,
): Promise<ComputedDeadline[]> {
  const orgId = requireOrgId(organizationId);
  const results: ComputedDeadline[] = [];

  for (const clause of clauses) {
    if (clause.dealId !== dealId) {
      throw createError('Clause does not belong to this deal', 500);
    }
    const numDays = typeof clause.numberOfDays === 'number' && clause.numberOfDays > 0 ? clause.numberOfDays : 10;
    const dayType = (clause.dayType === 'business' ? 'business' : 'calendar') as 'calendar' | 'business';

    const { deadline } = computeContractDeadline(acceptanceDate, numDays, dayType);
    const label = formatClauseLabel(clause.clauseType);

    await prisma.deadline.upsert({
      where: { clauseId: clause.id },
      create: {
        dealId,
        organizationId: orgId,
        clauseId: clause.id,
        label,
        computedDate: deadline,
        dayType,
        status: 'PENDING',
      },
      update: {
        organizationId: orgId,
        computedDate: deadline,
        label,
        status: 'PENDING',
      },
    });

    results.push({ clauseId: clause.id, label, computedDate: deadline, dayType });
    logger.info(`Computed deadline for clause "${label}": ${deadline.toISOString()}`);
  }

  return results;
}

function formatClauseLabel(clauseType: string): string {
  return clauseType
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
