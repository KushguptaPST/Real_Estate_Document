import { addDays, isWeekend, format } from 'date-fns';
import Holidays from 'date-holidays';

export function computeDeadline(startDate, numberOfDays, dayType, country = 'IN', state = 'KA') {
    if (dayType === 'calendar') {
        return addDays(startDate, numberOfDays);
    }

    if (dayType === 'business') {
        const hd = new Holidays(country, state);
        const holidayDates = new Set(
            hd.getHolidays(startDate.getFullYear())
                .concat(hd.getHolidays(startDate.getFullYear() + 1)) // handle year rollover
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