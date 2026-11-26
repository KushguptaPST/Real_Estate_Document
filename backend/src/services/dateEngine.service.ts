/**
 * Date Engine Service
 *
 * Core jurisdiction-aware deadline calculation logic.
 * Calculates legal expiration dates based on acceptance dates, day counts,
 * and day types ('calendar' vs 'business'), skipping weekends and state-specific
 * statutory holidays via date-holidays.
 */

import { addDays, isWeekend, format } from 'date-fns';
import Holidays from 'date-holidays';

export type DayType = 'calendar' | 'business';

export interface DeadlineResult {
  startDate: Date;
  numberOfDays: number;
  dayType: DayType;
  deadline: Date;
}
/**
 * Compute a deadline date from a start date + clause parameters.
 *
 * - calendar: simply add `numberOfDays` calendar days.
 * - business: skip weekends and US federal/state holidays.
 */
function computeDeadline(
  startDate: Date,
  numberOfDays: number,
  dayType: DayType,
  country = 'US',
  state = 'CA',
): Date {
  if (dayType === 'calendar') {
    return addDays(startDate, numberOfDays);
  }

  // business days: skip weekends and public holidays
  const hd = new Holidays(country, state);
  const holidayDates = new Set<string>([
    ...hd.getHolidays(startDate.getFullYear()).map((h) => format(new Date(h.date), 'yyyy-MM-dd')),
    ...hd.getHolidays(startDate.getFullYear() + 1).map((h) => format(new Date(h.date), 'yyyy-MM-dd')),
  ]);

  let current = startDate;
  let daysAdded = 0;

  while (daysAdded < numberOfDays) {
    current = addDays(current, 1);
    const dateStr = format(current, 'yyyy-MM-dd');
    if (!isWeekend(current) && !holidayDates.has(dateStr)) {
      daysAdded++;
    }
  }

  return current;
}

/**
 * Compute a deadline from a contract acceptance date + clause parameters.
 *
 * @param startDate     - The base date (usually acceptance date)
 * @param numberOfDays  - Number of days stated in the clause
 * @param dayType       - "calendar" or "business"
 * @param country       - ISO country code, default "US"
 * @param state         - Subdivision/state code, default "CA"
 */
export function computeContractDeadline(
  startDate: Date,
  numberOfDays: number,
  dayType: DayType,
  country = 'US',
  state = 'CA',
): DeadlineResult {
  const deadline: Date = computeDeadline(startDate, numberOfDays, dayType, country, state);
  return { startDate, numberOfDays, dayType, deadline };
}
