/**
 * Type declarations for dateEngine.js — kept alongside the implementation
 * so TypeScript NodeNext resolution can find them.
 */
export declare function computeDeadline(
  startDate: Date,
  numberOfDays: number,
  dayType: 'calendar' | 'business',
  country?: string,
  state?: string,
): Date;
