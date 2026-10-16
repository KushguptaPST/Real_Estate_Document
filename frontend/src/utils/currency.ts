/**
 * Currency & Real Estate Price Formatting Utility (INR / Crores & Lakhs)
 */

export function formatIndianPrice(amount: number | string | null | undefined): string {
  if (amount == null || amount === '') return '₹0';
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (isNaN(num) || num === 0) return '₹0';

  if (num >= 10_000_000) {
    const cr = (num / 10_000_000).toFixed(2).replace(/\.00$/, '');
    return `₹${cr} Cr`;
  }

  if (num >= 100_000) {
    const lakh = (num / 100_000).toFixed(2).replace(/\.00$/, '');
    return `₹${lakh} Lakh`;
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatIndianPriceFull(amount: number | string | null | undefined): string {
  if (amount == null || amount === '') return '₹0';
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (isNaN(num) || num === 0) return '₹0';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatPriceDisplay(amount: number | string | null | undefined): { short: string; full: string } {
  if (amount == null || amount === '') {
    return { short: '₹0', full: '₹0' };
  }

  const short = formatIndianPrice(amount);
  const full = formatIndianPriceFull(amount);
  return { short, full };
}

