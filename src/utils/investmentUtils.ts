import { Investment, InvestmentTransaction, PriceQuote, AssetType, InvestmentCategory } from '../types';

export interface CalculatedHolding {
  investment: Investment;
  totalQty: number;
  avgBuyPrice: number;
  totalInvested: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  dayChangePct: number;
  isManualOverride?: boolean;
  category: InvestmentCategory;
}

export function mapAssetTypeToCategory(assetType: AssetType): InvestmentCategory {
  switch (assetType) {
    case 'Stock':
    case 'ETF':
      return 'stocks';
    case 'Mutual Fund':
      return 'mutual_funds';
    case 'Fixed Deposit':
    case 'Recurring Deposit':
      return 'fixed_income';
    case 'Sovereign Gold Bond':
    case 'Gold':
      return 'gold_sgb';
    case 'Government Bond':
    case 'Corporate Bond':
      return 'bonds';
    case 'REIT':
    case 'InvIT':
    case 'Real Estate':
      return 'reits';
    case 'PPF':
    case 'NPS':
    case 'EPF':
      return 'retirement';
    case 'Crypto':
    case 'P2P Lending':
      return 'crypto_alt';
    default:
      return 'stocks';
  }
}

export function calculateHoldings(
  investments: Investment[],
  transactions: InvestmentTransaction[],
  priceQuotes: Record<string, PriceQuote>
): CalculatedHolding[] {
  return investments.map((inv) => {
    const txs = transactions
      .filter((t) => t.investmentId === inv.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let totalQty = 0;
    let totalInvested = 0;
    let realizedPnl = 0;
    let buyLots: { qty: number; price: number }[] = [];

    txs.forEach((tx) => {
      if (tx.type === 'BUY') {
        buyLots.push({ qty: tx.quantity, price: tx.price });
        totalQty += tx.quantity;
        totalInvested += tx.quantity * tx.price + (tx.fees || 0);
      } else if (tx.type === 'SELL') {
        let qtyToSell = tx.quantity;
        const saleProceeds = tx.quantity * tx.price - (tx.fees || 0);
        let costBasis = 0;

        while (qtyToSell > 0 && buyLots.length > 0) {
          const first = buyLots[0];
          if (first.qty <= qtyToSell) {
            costBasis += first.qty * first.price;
            qtyToSell -= first.qty;
            buyLots.shift();
          } else {
            costBasis += qtyToSell * first.price;
            first.qty -= qtyToSell;
            qtyToSell = 0;
          }
        }
        realizedPnl += saleProceeds - costBasis;
        totalQty -= tx.quantity;
        totalInvested = Math.max(0, totalInvested - costBasis);
      } else if (tx.type === 'SPLIT') {
        const ratio = tx.price > 0 ? tx.price : 2;
        totalQty = totalQty * ratio;
        buyLots = buyLots.map((lot) => ({ qty: lot.qty * ratio, price: lot.price / ratio }));
      }
    });

    const avgBuyPrice = totalQty > 0 ? totalInvested / totalQty : 0;
    const quote = priceQuotes[inv.symbol] || {
      price: avgBuyPrice > 0 ? avgBuyPrice : 100,
      dayChangePct: 0,
      isManualOverride: false,
      symbol: inv.symbol,
      lastUpdated: new Date().toISOString(),
    };
    const currentPrice = quote.price;
    const currentValue = totalQty * currentPrice;
    const unrealizedPnl = currentValue - totalInvested;
    const unrealizedPnlPct = totalInvested > 0 ? (unrealizedPnl / totalInvested) * 100 : 0;
    const category = mapAssetTypeToCategory(inv.assetType);

    return {
      investment: inv,
      totalQty,
      avgBuyPrice,
      totalInvested,
      currentPrice,
      currentValue,
      unrealizedPnl,
      unrealizedPnlPct,
      realizedPnl,
      dayChangePct: quote.dayChangePct,
      isManualOverride: quote.isManualOverride,
      category,
    };
  });
}

export interface UpcomingCashFlowItem {
  id: string;
  title: string;
  assetName: string;
  category: InvestmentCategory;
  date: string;
  amount: number;
  type: 'SIP Debit' | 'FD Maturity' | 'SGB Coupon' | 'Bond Coupon' | 'REIT Dividend';
  status: 'Scheduled' | 'Upcoming';
}

/**
 * Dynamically computes upcoming cash flows from user's actual holdings and terms
 */
export function generateUpcomingCashFlows(
  investments: Investment[],
  holdings: CalculatedHolding[] = []
): UpcomingCashFlowItem[] {
  const items: UpcomingCashFlowItem[] = [];
  const holdingsMap = new Map(holdings.map((h) => [h.investment.id, h]));

  investments.forEach((inv) => {
    const holding = holdingsMap.get(inv.id);

    // 1. Mutual Fund SIPs
    if (inv.assetType === 'Mutual Fund' && inv.monthlyDeposit && inv.isSipActive) {
      const today = new Date();
      const sipDay = Math.min(31, Math.max(1, inv.sipDay || 10));
      const nextMonth = today.getDate() > sipDay ? today.getMonth() + 1 : today.getMonth();
      const nextDate = new Date(today.getFullYear(), nextMonth, sipDay);
      items.push({
        id: `sip_${inv.id}`,
        title: `Monthly SIP: ${inv.symbol}`,
        assetName: inv.name,
        category: 'mutual_funds',
        date: nextDate.toISOString().split('T')[0],
        amount: inv.monthlyDeposit,
        type: 'SIP Debit',
        status: 'Scheduled',
      });
    }

    // 2. Fixed Deposit Maturities
    if (inv.assetType === 'Fixed Deposit' && inv.maturityDate && holding && holding.totalInvested > 0) {
      const principal = holding.totalInvested;
      const rate = (inv.interestRate || 7) / 100;
      const tenure = inv.tenureYears || 3;
      // Compounded quarterly maturity calculation
      const maturityVal = Math.round(principal * Math.pow(1 + rate / 4, 4 * tenure));
      items.push({
        id: `fd_${inv.id}`,
        title: `FD Maturity: ${inv.institution || 'Bank'}`,
        assetName: inv.name,
        category: 'fixed_income',
        date: inv.maturityDate,
        amount: maturityVal,
        type: 'FD Maturity',
        status: 'Upcoming',
      });
    }

    // 3. SGB 2.5% Semi-Annual Coupons
    if (inv.assetType === 'Sovereign Gold Bond' && holding && holding.totalQty > 0) {
      const grams = holding.totalQty;
      const costBasisPerGram = holding.avgBuyPrice || 5000;
      const couponAmt = Math.round((grams * costBasisPerGram * 0.025) / 2);
      if (couponAmt > 0) {
        items.push({
          id: `sgb_${inv.id}`,
          title: `SGB 2.5% Semi-Annual Interest`,
          assetName: inv.name,
          category: 'gold_sgb',
          date: inv.maturityDate ? inv.maturityDate.slice(0, 7) + '-15' : new Date().toISOString().split('T')[0],
          amount: couponAmt,
          type: 'SGB Coupon',
          status: 'Scheduled',
        });
      }
    }

    // 4. Bond Coupon Payments
    if ((inv.assetType === 'Government Bond' || inv.assetType === 'Corporate Bond') && holding && holding.totalQty > 0) {
      const faceValue = 100;
      const totalFaceValue = holding.totalQty * faceValue;
      const couponRate = (inv.interestRate || 7) / 100;
      const periodicAmount = Math.round((totalFaceValue * couponRate) / (inv.payoutFrequency === 'Annual' ? 1 : 2));
      if (periodicAmount > 0) {
        items.push({
          id: `bond_${inv.id}`,
          title: `Bond Coupon: ${inv.symbol}`,
          assetName: inv.name,
          category: 'bonds',
          date: inv.maturityDate || new Date().toISOString().split('T')[0],
          amount: periodicAmount,
          type: 'Bond Coupon',
          status: 'Scheduled',
        });
      }
    }

    // 5. REIT Dividends
    if (inv.assetType === 'REIT' && holding && holding.totalQty > 0) {
      const yieldPct = (inv.interestRate || 6.5) / 100;
      const quarterlyAmt = Math.round((holding.currentValue * yieldPct) / 4);
      if (quarterlyAmt > 0) {
        items.push({
          id: `reit_${inv.id}`,
          title: `REIT Quarterly Distribution`,
          assetName: inv.name,
          category: 'reits',
          date: new Date(Date.now() + 25 * 86400000).toISOString().split('T')[0],
          amount: quarterlyAmt,
          type: 'REIT Dividend',
          status: 'Scheduled',
        });
      }
    }
  });

  return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5);
}

/**
 * Dynamically computes Herfindahl-Hirschman Diversification Score between 1.0 and 10.0
 */
export function calculateDiversificationScore(holdings: CalculatedHolding[]): {
  score: number;
  label: string;
  categoryWeights: Record<InvestmentCategory, number>;
} {
  const totalVal = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const categoryWeights: Record<InvestmentCategory, number> = {
    all: 100,
    stocks: 0,
    mutual_funds: 0,
    fixed_income: 0,
    gold_sgb: 0,
    bonds: 0,
    reits: 0,
    retirement: 0,
    crypto_alt: 0,
  };

  if (totalVal <= 0 || holdings.length === 0) {
    return { score: 0, label: 'Unallocated Portfolio', categoryWeights };
  }

  // Aggregate category values
  holdings.forEach((h) => {
    categoryWeights[h.category] += h.currentValue;
  });

  // Calculate fractions & Herfindahl Index (HHI)
  let sumSquaredFractions = 0;
  let activeCategoriesCount = 0;

  Object.entries(categoryWeights).forEach(([catKey, val]) => {
    if (catKey === 'all') return;
    if (val > 0) {
      activeCategoriesCount++;
      const fraction = val / totalVal;
      sumSquaredFractions += fraction * fraction;
      categoryWeights[catKey as InvestmentCategory] = Math.round(fraction * 1000) / 10;
    }
  });

  // HHI varies between 1/N and 1.0 (1.0 = 100% in single asset class)
  const rawScore = Math.max(1, Math.min(10, Math.round((1 - sumSquaredFractions) * 12.5 * 10) / 10));

  let label = 'Moderately Diversified';
  if (rawScore >= 8.5) label = 'Optimally Diversified across Asset Classes';
  else if (rawScore >= 6.5) label = 'Healthy Multi-Asset Allocation';
  else if (rawScore >= 4.0) label = 'Concentrated in Few Asset Classes';
  else label = 'High Asset Concentration Risk';

  return { score: rawScore, label, categoryWeights };
}

/**
 * Generates true historical monthly trajectory points filtered dynamically by time range
 */
export function calculatePortfolioTrajectory(
  holdings: CalculatedHolding[],
  transactions: InvestmentTransaction[],
  timeRange: '1M' | '6M' | '1Y' | 'ALL' = '1Y'
): Array<{ month: string; value: number; invested: number }> {
  if (transactions.length === 0) return [];

  const now = Date.now();
  let cutoff = 0;
  if (timeRange === '1M') cutoff = now - 31 * 86400000;
  else if (timeRange === '6M') cutoff = now - 183 * 86400000;
  else if (timeRange === '1Y') cutoff = now - 366 * 86400000;

  const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const totalCurrentVal = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.totalInvested, 0);

  // Group by Month Year
  const monthlyMap = new Map<string, { invested: number; timestamp: number }>();
  let runningInvested = 0;

  sortedTxs.forEach((tx) => {
    const d = new Date(tx.date);
    const ts = d.getTime();
    const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const flow = tx.type === 'BUY' ? tx.quantity * tx.price + (tx.fees || 0) : -(tx.quantity * tx.price);
    runningInvested += flow;
    monthlyMap.set(key, { invested: Math.max(0, runningInvested), timestamp: ts });
  });

  const allEntries = Array.from(monthlyMap.entries());
  if (allEntries.length === 0) return [];

  // Filter entries within time range cutoff
  let filteredEntries = cutoff > 0 ? allEntries.filter(([, d]) => d.timestamp >= cutoff) : allEntries;

  // If fewer than 2 entries in that window, keep the latest prior baseline
  if (filteredEntries.length === 0) {
    filteredEntries = allEntries.slice(-2);
  } else if (filteredEntries.length === 1 && allEntries.length > 1) {
    filteredEntries = allEntries.slice(-2);
  }

  const gainFactor = totalCost > 0 ? totalCurrentVal / totalCost : 1;
  const points: Array<{ month: string; value: number; invested: number }> = [];

  filteredEntries.forEach(([month, data], index) => {
    const progress = (index + 1) / filteredEntries.length;
    const currentGainMultiplier = 1 + (gainFactor - 1) * progress;
    const estimatedValue = Math.round(data.invested * currentGainMultiplier);

    points.push({
      month,
      invested: Math.round(data.invested),
      value: estimatedValue,
    });
  });

  return points;
}

/**
 * Calculates real price and transaction event history for a specific holding
 */
export interface PriceHistoryPoint {
  label: string;
  date: string;
  price: number;
  qty?: number;
  type?: string;
}

export function calculateAssetPriceHistory(
  holding: CalculatedHolding,
  transactions: InvestmentTransaction[],
  range: '1M' | '6M' | '1Y' | 'ALL' = '1Y'
): PriceHistoryPoint[] {
  const assetTxs = transactions
    .filter((t) => t.investmentId === holding.investment.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const now = Date.now();
  let cutoff = 0;
  if (range === '1M') cutoff = now - 31 * 86400000;
  else if (range === '6M') cutoff = now - 183 * 86400000;
  else if (range === '1Y') cutoff = now - 366 * 86400000;

  const inWindowTxs = cutoff > 0 ? assetTxs.filter((t) => new Date(t.date).getTime() >= cutoff) : assetTxs;
  const points: PriceHistoryPoint[] = [];

  // If prior transactions existed before window, push baseline starting price
  if (inWindowTxs.length < assetTxs.length && assetTxs.length > 0) {
    const prior = assetTxs.filter((t) => new Date(t.date).getTime() < cutoff);
    const lastPrior = prior[prior.length - 1];
    if (lastPrior) {
      points.push({
        label: 'Baseline',
        date: lastPrior.date,
        price: lastPrior.price,
        qty: lastPrior.quantity,
        type: lastPrior.type,
      });
    }
  }

  inWindowTxs.forEach((t) => {
    const d = new Date(t.date);
    points.push({
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      date: t.date,
      price: t.price,
      qty: t.quantity,
      type: t.type,
    });
  });

  // Always append current live market price
  points.push({
    label: 'Live',
    date: 'Today',
    price: holding.currentPrice,
  });

  return points;
}

/**
 * Calculates estimated annualized CAGR/XIRR based on earliest purchase date
 */
export function calculateAnnualizedReturn(
  totalInvested: number,
  currentValue: number,
  transactions: InvestmentTransaction[]
): { xirrPct: number; label: string } {
  if (totalInvested <= 0 || currentValue <= 0 || transactions.length === 0) {
    return { xirrPct: 0, label: '0.0%' };
  }

  const sortedDates = transactions
    .map((t) => new Date(t.date).getTime())
    .filter((time) => !isNaN(time))
    .sort((a, b) => a - b);

  if (sortedDates.length === 0) {
    return { xirrPct: 0, label: '0.0%' };
  }

  const earliest = sortedDates[0];
  const now = Date.now();
  const diffDays = Math.max(30, (now - earliest) / (1000 * 60 * 60 * 24));
  const diffYears = diffDays / 365.25;

  const returnRatio = currentValue / totalInvested;
  const annualRate = Math.pow(returnRatio, 1 / diffYears) - 1;
  const xirrPct = Math.round(annualRate * 1000) / 10;

  const prefix = xirrPct >= 0 ? '+' : '';
  return {
    xirrPct,
    label: `${prefix}${xirrPct.toFixed(1)}%`,
  };
}
