/**
 * Timezone Utility — Converts local date/time in IANA timezones to/from UTC instants.
 * Uses native Node.js Intl for accurate standard and daylight-saving time conversions.
 */

/**
 * Validates whether a timezone identifier is a recognized IANA timezone.
 */
export function isValidIanaTimezone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export interface ParseLocalDateTimeOptions {
  /**
   * Defines how to resolve ambiguous local times that occur twice during a daylight-saving fall-back transition.
   * - 'reject' (default): Throws an error explaining the ambiguity with both UTC candidates.
   * - 'earlier': Selects the earlier UTC instant (e.g. EDT before the turn-back).
   * - 'later': Selects the later UTC instant (e.g. EST after the turn-back).
   */
  disambiguation?: 'earlier' | 'later' | 'reject';
}

/**
 * Converts a local date string (YYYY-MM-DD) and local time string (HH:MM)
 * in an IANA timezone into the exact UTC Date instant.
 *
 * Rejects:
 * - Invalid date/time formats
 * - Out-of-bounds calendar values
 * - Nonexistent local times during DST spring-forward gaps
 * - Ambiguous local times during DST fall-back repeats (unless explicit disambiguation option is provided)
 */
export function parseLocalDateTimeToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string = 'America/New_York',
  options: ParseLocalDateTimeOptions = {},
): Date {
  const disambiguation = options.disambiguation ?? 'reject';

  if (!isValidIanaTimezone(timeZone)) {
    throw new Error(`Invalid or unrecognized IANA timezone: "${timeZone}"`);
  }

  // Validate format
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeStr);
  if (!dateMatch || !timeMatch) {
    throw new Error(`Invalid date/time format: expected YYYY-MM-DD and HH:MM, got "${dateStr}" and "${timeStr}"`);
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Date or time values out of calendar bounds: ${dateStr} ${timeStr}`);
  }

  // Verify month day boundaries (e.g. Feb 30, April 31)
  const testDate = new Date(Date.UTC(year, month - 1, day));
  if (testDate.getUTCMonth() !== month - 1 || testDate.getUTCDate() !== day) {
    throw new Error(`Invalid calendar date: "${dateStr}"`);
  }

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Start with naive UTC estimate
  let guessUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  // Iteratively converge to find the exact UTC instant that formats to (year, month, day, hour, minute) in target timezone
  for (let iter = 0; iter < 4; iter++) {
    const parts = dtf.formatToParts(new Date(guessUtcMs));
    const p: Record<string, string> = {};
    for (const part of parts) p[part.type] = part.value;

    const renderedH = Number(p['hour']) === 24 ? 0 : Number(p['hour']);
    const renderedMs = Date.UTC(
      Number(p['year']),
      Number(p['month']) - 1,
      Number(p['day']),
      renderedH,
      Number(p['minute']),
      Number(p['second']),
    );

    const targetLocalMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    const diff = targetLocalMs - renderedMs;
    if (diff === 0) break;
    guessUtcMs += diff;
  }

  // Strict roundtrip validation: ensure the computed UTC instant formats to the exact local time
  const verifyParts = dtf.formatToParts(new Date(guessUtcMs));
  const vp: Record<string, string> = {};
  for (const part of verifyParts) vp[part.type] = part.value;

  const vH = Number(vp['hour']) === 24 ? 0 : Number(vp['hour']);
  if (
    Number(vp['year']) !== year ||
    Number(vp['month']) !== month ||
    Number(vp['day']) !== day ||
    vH !== hour ||
    Number(vp['minute']) !== minute
  ) {
    throw new Error(
      `Nonexistent local time due to daylight saving spring-forward transition: "${dateStr} ${timeStr}" in ${timeZone}`,
    );
  }

  // Ambiguity detection: check if another distinct UTC instant also formats to this local time (fall-back transition)
  const formatsToTarget = (utcMs: number): boolean => {
    const parts = dtf.formatToParts(new Date(utcMs));
    const p: Record<string, string> = {};
    for (const part of parts) p[part.type] = part.value;
    const h = Number(p['hour']) === 24 ? 0 : Number(p['hour']);
    return (
      Number(p['year']) === year &&
      Number(p['month']) === month &&
      Number(p['day']) === day &&
      h === hour &&
      Number(p['minute']) === minute
    );
  };

  // Candidate DST shift offsets to test: ±30 min, ±1 hr, ±2 hr
  const candidateShifts = [-7200000, -3600000, -1800000, 1800000, 3600000, 7200000];
  let ambiguousUtcMs: number | null = null;
  for (const shift of candidateShifts) {
    if (formatsToTarget(guessUtcMs + shift)) {
      ambiguousUtcMs = guessUtcMs + shift;
      break;
    }
  }

  if (ambiguousUtcMs !== null) {
    const earlierMs = Math.min(guessUtcMs, ambiguousUtcMs);
    const laterMs = Math.max(guessUtcMs, ambiguousUtcMs);

    if (disambiguation === 'reject') {
      throw new Error(
        `Ambiguous local time due to daylight saving fall-back transition: "${dateStr} ${timeStr}" in ${timeZone} occurs twice (corresponds to ${new Date(earlierMs).toISOString()} and ${new Date(laterMs).toISOString()}). Explicit offset or disambiguation is required.`,
      );
    }
    return new Date(disambiguation === 'earlier' ? earlierMs : laterMs);
  }

  return new Date(guessUtcMs);
}

/**
 * Formats a UTC Date instant into local date and time strings in a target IANA timezone.
 */
export function formatUtcToLocalDateTime(
  utcDate: Date,
  timeZone: string = 'America/New_York',
): { date: string; time: string; timeZone: string } {
  if (!isValidIanaTimezone(timeZone)) {
    throw new Error(`Invalid or unrecognized IANA timezone: "${timeZone}"`);
  }

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = dtf.formatToParts(utcDate);
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;

  const hourStr = p['hour'] === '24' ? '00' : p['hour']!;
  return {
    date: `${p['year']}-${p['month']}-${p['day']}`,
    time: `${hourStr}:${p['minute']}`,
    timeZone,
  };
}
