/**
 * Market Hours & Country Timezone Configuration
 * Determines whether financial exchanges are currently in an active trading session
 * based on selected country timezone, exchange trading hours, and weekends.
 */

export interface MarketConfig {
  id: string;
  country: string;
  exchange: string;
  timezone: string;
  timezoneLabel: string;
  flag: string;
  currency: string;
  openHour: number;
  openMinute: number;
  closeHour: number;
  closeMinute: number;
  tradingDays: number[]; // 1 = Monday, ..., 5 = Friday
}

export const SUPPORTED_MARKETS: MarketConfig[] = [
  {
    id: 'IN',
    country: 'India',
    exchange: 'NSE / BSE',
    timezone: 'Asia/Kolkata',
    timezoneLabel: 'IST (UTC+5:30)',
    flag: '🇮🇳',
    currency: 'INR',
    openHour: 9,
    openMinute: 15,
    closeHour: 15,
    closeMinute: 30,
    tradingDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'US',
    country: 'United States',
    exchange: 'NYSE / NASDAQ',
    timezone: 'America/New_York',
    timezoneLabel: 'EST/EDT (UTC-5/-4)',
    flag: '🇺🇸',
    currency: 'USD',
    openHour: 9,
    openMinute: 30,
    closeHour: 16,
    closeMinute: 0,
    tradingDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'GB',
    country: 'United Kingdom',
    exchange: 'London Stock Exchange (LSE)',
    timezone: 'Europe/London',
    timezoneLabel: 'GMT/BST (UTC+0/+1)',
    flag: '🇬🇧',
    currency: 'GBP',
    openHour: 8,
    openMinute: 0,
    closeHour: 16,
    closeMinute: 30,
    tradingDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'EU',
    country: 'European Union',
    exchange: 'Euronext / Deutsche Börse',
    timezone: 'Europe/Paris',
    timezoneLabel: 'CET/CEST (UTC+1/+2)',
    flag: '🇪🇺',
    currency: 'EUR',
    openHour: 9,
    openMinute: 0,
    closeHour: 17,
    closeMinute: 30,
    tradingDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'JP',
    country: 'Japan',
    exchange: 'Tokyo Stock Exchange (TSE)',
    timezone: 'Asia/Tokyo',
    timezoneLabel: 'JST (UTC+9)',
    flag: '🇯🇵',
    currency: 'JPY',
    openHour: 9,
    openMinute: 0,
    closeHour: 15,
    closeMinute: 0,
    tradingDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'SG',
    country: 'Singapore',
    exchange: 'Singapore Exchange (SGX)',
    timezone: 'Asia/Singapore',
    timezoneLabel: 'SGT (UTC+8)',
    flag: '🇸🇬',
    currency: 'SGD',
    openHour: 9,
    openMinute: 0,
    closeHour: 17,
    closeMinute: 0,
    tradingDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'AU',
    country: 'Australia',
    exchange: 'Australian Securities Exchange (ASX)',
    timezone: 'Australia/Sydney',
    timezoneLabel: 'AEST/AEDT (UTC+10/+11)',
    flag: '🇦🇺',
    currency: 'AUD',
    openHour: 10,
    openMinute: 0,
    closeHour: 16,
    closeMinute: 0,
    tradingDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'AE',
    country: 'United Arab Emirates',
    exchange: 'Dubai Financial Market (DFM)',
    timezone: 'Asia/Dubai',
    timezoneLabel: 'GST (UTC+4)',
    flag: '🇦🇪',
    currency: 'AED',
    openHour: 10,
    openMinute: 0,
    closeHour: 15,
    closeMinute: 0,
    tradingDays: [1, 2, 3, 4, 5],
  },
];

export interface MarketStatus {
  isOpen: boolean;
  market: MarketConfig;
  localTimeFormatted: string;
  statusText: string;
  reason: string;
}

/**
 * Evaluates whether the given market is currently open in its timezone.
 */
export function getMarketStatus(marketId: string = 'IN', date: Date = new Date()): MarketStatus {
  const market = SUPPORTED_MARKETS.find((m) => m.id === marketId) || SUPPORTED_MARKETS[0];

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: market.timezone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });

    const parts = formatter.formatToParts(date);
    const partMap: Record<string, string> = {};
    parts.forEach((p) => {
      partMap[p.type] = p.value;
    });

    const weekdayStr = partMap['weekday'];
    const hour = parseInt(partMap['hour'], 10);
    const minute = parseInt(partMap['minute'], 10);

    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const currentDayOfWeek = dayMap[weekdayStr] ?? 1;

    const currentMinuteOfDay = hour * 60 + minute;
    const openMinuteOfDay = market.openHour * 60 + market.openMinute;
    const closeMinuteOfDay = market.closeHour * 60 + market.closeMinute;

    const isTradingDay = market.tradingDays.includes(currentDayOfWeek);
    const isWithinHours = currentMinuteOfDay >= openMinuteOfDay && currentMinuteOfDay < closeMinuteOfDay;
    const isOpen = isTradingDay && isWithinHours;

    const pad = (n: number) => String(n).padStart(2, '0');
    const timeFormatted = `${pad(hour)}:${pad(minute)} ${market.timezoneLabel.split(' ')[0]}`;
    const openTimeFormatted = `${pad(market.openHour)}:${pad(market.openMinute)}`;
    const closeTimeFormatted = `${pad(market.closeHour)}:${pad(market.closeMinute)}`;

    let statusText = '';
    let reason = '';

    if (isOpen) {
      statusText = 'Market Open';
      reason = `Live session until ${closeTimeFormatted} ${market.timezoneLabel.split(' ')[0]}`;
    } else if (!isTradingDay) {
      statusText = 'Market Closed';
      reason = `Weekend — reopens Monday at ${openTimeFormatted}`;
    } else if (currentMinuteOfDay < openMinuteOfDay) {
      statusText = 'Pre-Market';
      reason = `Opens today at ${openTimeFormatted} ${market.timezoneLabel.split(' ')[0]}`;
    } else {
      statusText = 'Post-Market';
      const nextDayName = currentDayOfWeek === 5 ? 'Monday' : 'tomorrow';
      reason = `Session ended at ${closeTimeFormatted}. Reopens ${nextDayName} at ${openTimeFormatted}`;
    }

    return {
      isOpen,
      market,
      localTimeFormatted: timeFormatted,
      statusText,
      reason,
    };
  } catch (err) {
    return {
      isOpen: false,
      market,
      localTimeFormatted: '--:--',
      statusText: 'Unknown',
      reason: 'Failed to compute market hours',
    };
  }
}
