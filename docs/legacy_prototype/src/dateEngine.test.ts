import { computeDeadline } from './dateEngine.js';

test('calendar days', () => {
  const start = new Date(2026, 0, 1);
  const result = computeDeadline(start, 10, 'calendar');
  expect(result).toEqual(new Date(2026, 0, 11));
});

test('business days crossing weekend', () => {
  const start = new Date(2026, 0, 1);
  const result = computeDeadline(start, 3, 'business');
  expect(result).toEqual(new Date(2026, 0, 6));
});

test('business days crossing US holiday', () => {
  const start = new Date(2026, 11, 24);
  const result = computeDeadline(start, 1, 'business', 'US', 'CA');
  expect(result).toEqual(new Date(2026, 11, 28));
});

test('business days crossing India holiday', () => {
  const start = new Date(2026, 0, 24);
  const result = computeDeadline(start, 1, 'business', 'IN', 'KA');
  expect(result).toEqual(new Date(2026, 0, 27));
});