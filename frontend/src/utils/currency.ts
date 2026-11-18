/**
 * Real Estate Price Formatting Utility (Indian Rupee / Cr & Lakh format)
 * Formats currency as ₹ and amounts cleanly in Crores (Cr) and Lakhs (L):
 * - 11000000 -> ₹1.1 Cr
 * - 10000000 -> ₹1 Cr
 * - 7500000 -> ₹75 L
 * - 850000 -> ₹8.5 L
 * - 50000 -> ₹50,000
 */

export function formatPrice(amount: number | string | null | undefined): string {
  if (amount == null || amount === '') return '₹0';
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (isNaN(num) || num === 0) return '₹0';

  if (num >= 10_000_000) {
    const cr = (num / 10_000_000).toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1');
    return `₹${cr} Cr`;
  }

  if (num >= 100_000) {
    const lakh = (num / 100_000).toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1');
    return `₹${lakh} L`;
  }

  if (num >= 1_000) {
    const k = (num / 1_000).toFixed(1).replace(/\.0$/, '');
    return `₹${k} K`;
  }

  return `₹${num.toLocaleString('en-IN')}`;
}

export function formatPriceFull(amount: number | string | null | undefined): string {
  if (amount == null || amount === '') return '₹0';
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (isNaN(num) || num === 0) return '₹0';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatPropertyPrice(amount: number | string | null | undefined, _cityOrLocation?: string): string {
  return formatPrice(amount);
}

export function formatPropertyPriceFull(amount: number | string | null | undefined, _cityOrLocation?: string): string {
  return formatPriceFull(amount);
}

// Aliases for backward compatibility across existing components
export const formatIndianPrice = formatPrice;
export const formatIndianPriceFull = formatPriceFull;

export function formatPriceDisplay(amount: number | string | null | undefined): { short: string; full: string } {
  if (amount == null || amount === '') {
    return { short: '₹0', full: '₹0' };
  }

  const short = formatPrice(amount);
  const full = formatPriceFull(amount);
  return { short, full };
}
