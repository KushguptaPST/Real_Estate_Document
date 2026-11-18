/**
 * Smoke tests verifying the TS service wrapper correctly proxies
 * the underlying dateEngine.js logic.
 */
import { computeContractDeadline } from '../src/services/dateEngine.service.js';

describe('computeContractDeadline (service wrapper)', () => {
  test('calendar days — 10 days from Jan 1 2026 = Jan 11 2026', () => {
    const start = new Date(2026, 0, 1);
    const { deadline } = computeContractDeadline(start, 10, 'calendar');
    expect(deadline).toEqual(new Date(2026, 0, 11));
  });

  test('business days — skips weekend (Jan 1 Thu + 3 business = Jan 6 Tue)', () => {
    const start = new Date(2026, 0, 1);
    const { deadline } = computeContractDeadline(start, 3, 'business');
    expect(deadline).toEqual(new Date(2026, 0, 6));
  });

  test('business days — skips US holiday Christmas (Dec 24 + 1 business = Dec 28)', () => {
    const start = new Date(2026, 11, 24);
    const { deadline } = computeContractDeadline(start, 1, 'business', 'US', 'CA');
    expect(deadline).toEqual(new Date(2026, 11, 28));
  });

  test('business days — skips India holiday Republic Day (Jan 24 Sat + 1 business = Jan 27 Tue)', () => {
    const start = new Date(2026, 0, 24); // Saturday Jan 24, 2026
    const { deadline } = computeContractDeadline(start, 1, 'business', 'IN', 'KA');
    expect(deadline).toEqual(new Date(2026, 0, 27)); // Sunday 25 skipped, Republic Day Mon 26 skipped -> Tue 27
  });

  test('returns correct shape', () => {
    const start = new Date(2026, 0, 1);
    const result = computeContractDeadline(start, 5, 'calendar');
    expect(result).toMatchObject({
      startDate: start,
      numberOfDays: 5,
      dayType: 'calendar',
    });
    expect(result.deadline).toBeInstanceOf(Date);
  });
});
