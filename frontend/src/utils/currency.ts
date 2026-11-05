/**
 * Real Estate Price Formatting Utility (US Dollar / Standard MLS format)
 * Preserves legacy function names (formatIndianPrice) for backward compatibility
 * while formatting cleanly as US Dollars ($925,000 / $1.25M).
 */

export function formatPrice(amount: number | string | null | undefined): string {
  if (amount == null || amount === '') return '$0';
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (isNaN(num) || num === 0) return '$0';

  if (num >= 1_000_000) {
    const m = (num / 1_000_000).toFixed(2).replace(/\.00$/, '');
    return `$${m}M`;
  }

  if (num >= 100_000) {
    const k = Math.round(num / 1_000);
    return `$${k}K`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatPriceFull(amount: number | string | null | undefined): string {
  if (amount == null || amount === '') return '$0';
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (isNaN(num) || num === 0) return '$0';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatPropertyPrice(amount: number | string | null | undefined, cityOrLocation?: string): string {
  if (amount == null || amount === '') return '$0';
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (isNaN(num) || num === 0) return '$0';

  const isIndia = Boolean(
    cityOrLocation &&
      (cityOrLocation.toLowerCase().includes('bengaluru') ||
        cityOrLocation.toLowerCase().includes('bangalore') ||
        cityOrLocation.toLowerCase().includes('whitefield') ||
        cityOrLocation.toLowerCase().includes('india'))
  );

  if (isIndia) {
    if (num >= 10_000_000) {
      const cr = (num / 10_000_000).toFixed(2).replace(/\.00$/, '');
      return `₹${cr} Cr`;
    }
    if (num >= 100_000) {
      const lakh = (num / 100_000).toFixed(2).replace(/\.00$/, '');
      return `₹${lakh} Lakh`;
    }
    return `₹${num.toLocaleString('en-IN')}`;
  }

  return formatPrice(num);
}

export function formatPropertyPriceFull(amount: number | string | null | undefined, cityOrLocation?: string): string {
  if (amount == null || amount === '') return '$0';
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (isNaN(num) || num === 0) return '$0';

  const isIndia = Boolean(
    cityOrLocation &&
      (cityOrLocation.toLowerCase().includes('bengaluru') ||
        cityOrLocation.toLowerCase().includes('bangalore') ||
        cityOrLocation.toLowerCase().includes('whitefield') ||
        cityOrLocation.toLowerCase().includes('india'))
  );

  if (isIndia) {
    return `₹${num.toLocaleString('en-IN')}`;
  }

  return formatPriceFull(num);
}

// Aliases for backward compatibility across existing components
export const formatIndianPrice = formatPrice;
export const formatIndianPriceFull = formatPriceFull;

export function formatPriceDisplay(amount: number | string | null | undefined): { short: string; full: string } {
  if (amount == null || amount === '') {
    return { short: '$0', full: '$0' };
  }

  const short = formatPrice(amount);
  const full = formatPriceFull(amount);
  return { short, full };
}
