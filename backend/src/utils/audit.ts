import type { Prisma } from '@prisma/client';

/**
 * Builds audit-log before/after values for the fields a request actually changed.
 * Personal-data fields are recorded only as "[changed]" markers so audit rows do
 * not become a second copy of customer PII.
 */
export function auditFieldChanges(
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
  piiFields: readonly string[],
): { previousValue: Prisma.InputJsonObject; newValue: Prisma.InputJsonObject } {
  const previousValue: Record<string, Prisma.InputJsonValue | null> = {};
  const newValue: Record<string, Prisma.InputJsonValue | null> = {};
  for (const [field, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (piiFields.includes(field)) {
      previousValue[field] = '[redacted]';
      newValue[field] = '[changed]';
    } else {
      previousValue[field] = toJson(before[field]);
      newValue[field] = toJson(value);
    }
  }
  return { previousValue, newValue };
}

function toJson(value: unknown): Prisma.InputJsonValue | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  return value as Prisma.InputJsonValue;
}

/**
 * Masks an email address for logging and diagnostic purposes (e.g. j***e@example.com)
 * so raw personal information is not leaked into log aggregators.
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string') return '[redacted]';
  const parts = email.trim().split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return '[redacted]';
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

