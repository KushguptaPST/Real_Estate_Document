import { createError } from '../middleware/errorHandler.js';

/**
 * Every tenant-owned query must be scoped to an organization. Services call this
 * at their boundary so a missing/empty organizationId fails closed (throws)
 * instead of silently dropping the tenant filter.
 */
export function requireOrgId(organizationId: string | null | undefined): string {
  if (typeof organizationId !== 'string' || organizationId.trim().length === 0) {
    const err = createError('Organization scope is required', 500);
    err.isOperational = false;
    throw err;
  }
  return organizationId;
}
