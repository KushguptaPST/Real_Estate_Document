import { addDays, isWeekend, format } from 'date-fns';
import Holidays from 'date-holidays';

export type DayType = 'business' | 'calendar';

export function computeDeadline(
  startDate: Date,
  numberOfDays: number,
  dayType: DayType,
  country: string = 'US',
  state: string = 'CA'
): Date {
  if (dayType === 'calendar') {
    return addDays(startDate, numberOfDays);
  }

  if (dayType === 'business') {
    const hd = new Holidays(country, state);
    const holidayDates = new Set(
      hd.getHolidays(startDate.getFullYear())
        .concat(hd.getHolidays(startDate.getFullYear() + 1))
        .map(h => format(new Date(h.date), 'yyyy-MM-dd'))
    );

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

  throw new Error("dayType must be 'business' or 'calendar'");
}