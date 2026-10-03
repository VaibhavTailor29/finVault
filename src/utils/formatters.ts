export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED ',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
  SGD: 'S$'
};

export const EXCHANGE_RATES_TO_INR: Record<string, number> = {
  INR: 1,
  USD: 83.5,
  EUR: 90.2,
  GBP: 106.1,
  AED: 22.7,
  CAD: 61.2,
  AUD: 54.8,
  JPY: 0.55,
  SGD: 62.4
};

export function formatCurrency(
  amount: number,
  currency: string = 'INR',
  privacyMode: boolean = false
): string {
  if (privacyMode) {
    return '••••••';
  }

  const symbol = CURRENCY_SYMBOLS[currency] || `${currency} `;
  const absAmount = Math.abs(amount);
  
  const formatted = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(absAmount);

  const sign = amount < 0 ? '-' : '';
  return `${sign}${symbol}${formatted}`;
}

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

export function formatPercentage(val: number, privacyMode: boolean = false): string {
  if (privacyMode) return '••%';
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
}
