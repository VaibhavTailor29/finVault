import React, { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, PieChart, ShieldCheck,
  Calendar, ArrowRight, Sparkles, AlertCircle, CheckCircle2,
  ChevronRight, Landmark, Coins, Building2, Award, Boxes,
  DollarSign
} from 'lucide-react';
import { InvestmentCategory, InvestmentTransaction } from '../../types';
import {
  CalculatedHolding,
  UpcomingCashFlowItem,
  calculateDiversificationScore,
  calculatePortfolioTrajectory,
  calculateAnnualizedReturn
} from '../../utils/investmentUtils';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

interface OverallDashboardViewProps {
  holdings: CalculatedHolding[];
  transactions: InvestmentTransaction[];
  upcomingCashFlows: UpcomingCashFlowItem[];
  currency: string;
  privacyMode: boolean;
  onNavigateCategory: (category: InvestmentCategory) => void;
  onOpenTradeModal: (assetId?: string) => void;
}

interface AssetClassSummary {
  id: InvestmentCategory;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  currentValue: number;
  totalInvested: number;
  pnl: number;
  pnlPct: number;
  topPickOrYield: string;
  count: number;
  sparkline: number[];
}

export const OverallDashboardView: React.FC<OverallDashboardViewProps> = ({
  holdings,
  transactions,
  upcomingCashFlows,
  currency,
  privacyMode,
  onNavigateCategory,
  onOpenTradeModal,
}) => {
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<'1M' | '6M' | '1Y' | 'ALL'>('1Y');

  // 1. Dynamic Portfolio Totals from real holdings
  const totalInvested = useMemo(() => holdings.reduce((sum, h) => sum + h.totalInvested, 0), [holdings]);
  const currentValue = useMemo(() => holdings.reduce((sum, h) => sum + h.currentValue, 0), [holdings]);
  const totalPnl = currentValue - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  // 2. Dynamic Annualized Return (XIRR / CAGR) from actual transaction dates
  const annualizedPerformance = useMemo(() => {
    return calculateAnnualizedReturn(totalInvested, currentValue, transactions);
  }, [totalInvested, currentValue, transactions]);

  // 3. Dynamic Diversification Health Score (Herfindahl-Hirschman Index entropy)
  const diversification = useMemo(() => {
    return calculateDiversificationScore(holdings);
  }, [holdings]);

  // 4. Category breakdown configurations
  const categoriesConfig: Array<{
    id: InvestmentCategory;
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }> = [
    { id: 'stocks', name: 'Stocks & Equity', icon: TrendingUp, color: '#3B82F6' },
    { id: 'mutual_funds', name: 'Mutual Funds & SIPs', icon: PieChart, color: '#8B5CF6' },
    { id: 'fixed_income', name: 'Fixed Deposits & RDs', icon: Landmark, color: '#F59E0B' },
    { id: 'gold_sgb', name: 'Gold & SGB', icon: Coins, color: '#EAB308' },
    { id: 'bonds', name: 'Bonds & G-Sec', icon: ShieldCheck, color: '#06B6D4' },
    { id: 'reits', name: 'Real Estate / REITs', icon: Building2, color: '#EC4899' },
    { id: 'retirement', name: 'Retirement (PPF / NPS)', icon: Award, color: '#10B981' },
    { id: 'crypto_alt', name: 'Crypto & Alternatives', icon: Boxes, color: '#F97316' },
  ];

  // 5. Aggregate by Category with dynamic metrics & real transaction sparklines
  const categorySummaries: AssetClassSummary[] = useMemo(() => {
    return categoriesConfig.map((cfg) => {
      const catHoldings = holdings.filter((h) => h.category === cfg.id);
      const catInvested = catHoldings.reduce((s, h) => s + h.totalInvested, 0);
      const catCurrent = catHoldings.reduce((s, h) => s + h.currentValue, 0);
      const catPnl = catCurrent - catInvested;
      const catPnlPct = catInvested > 0 ? (catPnl / catInvested) * 100 : 0;

      // Real dynamic top metric / pick
      let topPickOrYield = '0 Holdings';
      if (catHoldings.length > 0) {
        if (cfg.id === 'fixed_income') {
          const weightedRate = catHoldings.reduce((acc, h) => acc + (h.investment.interestRate || 7) * h.currentValue, 0) / (catCurrent || 1);
          topPickOrYield = `Avg ${weightedRate.toFixed(2)}% p.a.`;
        } else if (cfg.id === 'gold_sgb') {
          const totalGrams = catHoldings.reduce((acc, h) => acc + (h.investment.unitsOrGrams || h.totalQty || 0), 0);
          topPickOrYield = `${totalGrams.toFixed(1)}g Gold + 2.5%`;
        } else if (cfg.id === 'mutual_funds') {
          const totalMonthlySip = catHoldings.reduce((acc, h) => acc + (h.investment.monthlyDeposit || 0), 0);
          topPickOrYield = totalMonthlySip > 0 ? `₹${totalMonthlySip.toLocaleString('en-IN')}/mo SIP` : catHoldings[0]?.investment.symbol || '';
        } else if (cfg.id === 'bonds') {
          const weightedCoupon = catHoldings.reduce((acc, h) => acc + (h.investment.interestRate || 7.2) * h.currentValue, 0) / (catCurrent || 1);
          topPickOrYield = `${weightedCoupon.toFixed(2)}% Coupon`;
        } else if (cfg.id === 'retirement') {
          const total80C = catHoldings.filter(h => h.investment.taxSection === '80C').reduce((acc, h) => acc + h.totalInvested, 0);
          topPickOrYield = total80C > 0 ? `₹${total80C.toLocaleString('en-IN')} 80C` : `${catHoldings.length} Accounts`;
        } else {
          const sorted = [...catHoldings].sort((a, b) => b.currentValue - a.currentValue);
          topPickOrYield = sorted[0]?.investment.symbol || 'Active';
        }
      }

      // Dynamic sparkline derived from actual transaction history in this category
      const catAssetIds = new Set(catHoldings.map(h => h.investment.id));
      const catTxs = transactions
        .filter(t => catAssetIds.has(t.investmentId))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let sparkline: number[] = [];
      if (catTxs.length >= 2) {
        let runTotal = 0;
        const pts = catTxs.map(t => {
          runTotal += t.type === 'BUY' ? t.quantity * t.price : -(t.quantity * t.price);
          return Math.max(0, runTotal);
        });
        // Sample down to 8 points
        const step = Math.max(1, Math.floor(pts.length / 8));
        sparkline = pts.filter((_, idx) => idx % step === 0).slice(0, 8);
        while (sparkline.length < 8) sparkline.push(catCurrent);
      } else {
        // Linear transition from cost basis to current market value
        const s0 = catInvested;
        const sEnd = catCurrent;
        sparkline = [0, 1, 2, 3, 4, 5, 6, 7].map(step => Math.round(s0 + ((sEnd - s0) * step) / 7));
      }

      return {
        id: cfg.id,
        name: cfg.name,
        icon: cfg.icon,
        color: cfg.color,
        currentValue: catCurrent,
        totalInvested: catInvested,
        pnl: catPnl,
        pnlPct: catPnlPct,
        topPickOrYield,
        count: catHoldings.length,
        sparkline,
      };
    }).filter((c) => c.currentValue > 0 || c.totalInvested > 0);
  }, [holdings, categoriesConfig, transactions]);

  // Asset allocation percentages for donut chart
  const allocationSlices = useMemo(() => {
    return categorySummaries.map((cat) => {
      const percentage = currentValue > 0 ? (cat.currentValue / currentValue) * 100 : 0;
      return {
        id: cat.id,
        name: cat.name,
        value: cat.currentValue,
        percentage: Math.round(percentage * 10) / 10,
        color: cat.color,
      };
    });
  }, [categorySummaries, currentValue]);

  // Calculate SVG Donut Geometry
  let cumulativeAngle = 0;
  const donutRadius = 70;
  const donutInnerRadius = 48;
  const centerCoord = 90;

  const donutPaths = allocationSlices.map((slice) => {
    const angle = (slice.percentage / 100) * 360;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle += angle;

    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);

    const x1 = centerCoord + donutRadius * Math.cos(startRad);
    const y1 = centerCoord + donutRadius * Math.sin(startRad);
    const x2 = centerCoord + donutRadius * Math.cos(endRad);
    const y2 = centerCoord + donutRadius * Math.sin(endRad);

    const x3 = centerCoord + donutInnerRadius * Math.cos(endRad);
    const y3 = centerCoord + donutInnerRadius * Math.sin(endRad);
    const x4 = centerCoord + donutInnerRadius * Math.cos(startRad);
    const y4 = centerCoord + donutInnerRadius * Math.sin(startRad);

    const largeArc = angle > 180 ? 1 : 0;
    const pathData = `M ${x1} ${y1} A ${donutRadius} ${donutRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${donutInnerRadius} ${donutInnerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;

    return { ...slice, pathData };
  });

  // Dynamic Historical Trajectory filtered by active timeRange
  const trajectoryPoints = useMemo(() => {
    const pts = calculatePortfolioTrajectory(holdings, transactions, timeRange);
    if (pts.length >= 2) return pts;
    if (currentValue > 0) {
      return [
        { month: 'Start', value: totalInvested, invested: totalInvested },
        { month: 'Now', value: currentValue, invested: totalInvested },
      ];
    }
    return [];
  }, [holdings, transactions, timeRange, currentValue, totalInvested]);

  const maxTraj = trajectoryPoints.length > 0 ? Math.max(...trajectoryPoints.map((p) => p.value)) * 1.05 : 100;
  const minTraj = trajectoryPoints.length > 0 ? Math.min(...trajectoryPoints.map((p) => Math.min(p.value, p.invested))) * 0.95 : 0;
  const graphWidth = 460;
  const graphHeight = 150;

  const pointsString = trajectoryPoints
    .map((pt, i) => {
      const x = trajectoryPoints.length > 1 ? (i / (trajectoryPoints.length - 1)) * graphWidth : graphWidth / 2;
      const divisor = maxTraj - minTraj || 1;
      const y = graphHeight - ((pt.value - minTraj) / divisor) * (graphHeight - 20) - 10;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPath = pointsString.length > 0
    ? `M 0,${graphHeight} L ${pointsString.split(' ')[0]} ${pointsString.replace(/ /g, ' L ')} L ${graphWidth},${graphHeight} Z`
    : '';

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Bento Hero Row: Left (7 Cols) Value & Trajectory, Right (5 Cols) Macro Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Hero Card: Net Worth, Key Metrics & Growth Trajectory */}
        <div className="lg:col-span-7 rounded-2xl border border-neutral-200/80 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 p-6 text-white shadow-lg dark:border-neutral-800 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle ambient gradients */}
          <div className="absolute -right-16 -top-16 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-56 h-56 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Total Portfolio Value
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Live
                </span>
              </div>
              <div className="flex items-center gap-1 bg-neutral-800/80 border border-neutral-700/60 p-0.5 rounded-lg text-[11px] font-semibold">
                {(['1M', '6M', '1Y', 'ALL'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                      timeRange === r
                        ? 'bg-neutral-100 text-neutral-900 font-bold shadow-xs'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-baseline gap-3 sm:gap-4 mt-2">
              <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-white tabular-nums">
                {formatCurrency(currentValue, currency, privacyMode)}
              </span>
              <div
                className={`flex items-center gap-1 text-sm sm:text-base font-bold font-mono ${
                  totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {totalPnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span>
                  {totalPnl >= 0 ? '+' : ''}
                  {formatCurrency(totalPnl, currency, privacyMode)}
                </span>
                <span className="text-xs opacity-90 font-normal">
                  ({formatPercentage(totalPnlPct, privacyMode)})
                </span>
              </div>
            </div>

            {/* Quick stats strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-neutral-800/80">
              <div>
                <span className="text-[11px] text-neutral-400 block">Total Invested</span>
                <span className="text-sm font-bold font-mono text-neutral-200">
                  {formatCurrency(totalInvested, currency, privacyMode)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-neutral-400 block">Estimated XIRR</span>
                <span className="text-sm font-bold font-mono text-indigo-400">
                  {privacyMode ? '••%' : annualizedPerformance.label}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[11px] text-neutral-400 block">Holdings Active</span>
                <span className="text-sm font-bold font-mono text-neutral-200">
                  {holdings.length} assets in {categorySummaries.length} classes
                </span>
              </div>
            </div>
          </div>

          {/* SVG Trajectory Chart */}
          <div className="mt-5 pt-3 border-t border-neutral-800/60">
            {trajectoryPoints.length > 0 ? (
              <div className="relative w-full h-28">
                <svg viewBox={`0 0 ${graphWidth} ${graphHeight}`} className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="trajGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="20" x2={graphWidth} y2="20" stroke="currentColor" strokeDasharray="3 3" className="text-neutral-800" />
                  <line x1="0" y1="75" x2={graphWidth} y2="75" stroke="currentColor" strokeDasharray="3 3" className="text-neutral-800" />
                  <line x1="0" y1="130" x2={graphWidth} y2="130" stroke="currentColor" strokeDasharray="3 3" className="text-neutral-800" />
                  <path d={areaPath} fill="url(#trajGradient)" />
                  <polyline
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={pointsString}
                  />
                  {trajectoryPoints.map((pt, i) => {
                    const x = trajectoryPoints.length > 1 ? (i / (trajectoryPoints.length - 1)) * graphWidth : graphWidth / 2;
                    const divisor = maxTraj - minTraj || 1;
                    const y = graphHeight - ((pt.value - minTraj) / divisor) * (graphHeight - 20) - 10;
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="3.5"
                        className="fill-emerald-500 stroke-neutral-900 stroke-2"
                      />
                    );
                  })}
                </svg>
                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 mt-1 px-1">
                  {trajectoryPoints.map((p, idx) => (
                    <span key={idx}>{p.month}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-28 flex items-center justify-center text-xs text-neutral-400">
                Record your first trade or SIP to populate the growth curve
              </div>
            )}
          </div>
        </div>

        {/* Right Hero Card: Macro Asset Allocation Donut */}
        <div className="lg:col-span-5 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Asset Allocation
              </h3>
              <p className="text-[11px] text-neutral-400">Portfolio distribution by category</p>
            </div>
            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              {allocationSlices.length} Active Classes
            </span>
          </div>

          <div className="flex items-center justify-center gap-6 py-3">
            {/* SVG Donut */}
            <div className="relative w-36 h-36 shrink-0">
              {allocationSlices.length > 0 ? (
                <svg viewBox="0 0 180 180" className="w-full h-full transform -rotate-90">
                  {donutPaths.map((slice, idx) => (
                    <path
                      key={slice.id}
                      d={slice.pathData}
                      fill={slice.color}
                      className="transition-all duration-300 cursor-pointer hover:opacity-85"
                      onMouseEnter={() => setHoveredSlice(idx)}
                      onMouseLeave={() => setHoveredSlice(null)}
                    />
                  ))}
                </svg>
              ) : (
                <div className="w-full h-full rounded-full border-4 border-dashed border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-xs text-neutral-400">
                  No Assets
                </div>
              )}

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  {hoveredSlice !== null && allocationSlices[hoveredSlice]
                    ? allocationSlices[hoveredSlice].name
                    : 'Portfolio'}
                </span>
                <span className="text-sm font-extrabold font-mono text-neutral-900 dark:text-neutral-100">
                  {hoveredSlice !== null && allocationSlices[hoveredSlice]
                    ? `${allocationSlices[hoveredSlice].percentage}%`
                    : '100%'}
                </span>
              </div>
            </div>

            {/* Allocation List */}
            <div className="flex flex-col gap-1.5 w-full text-xs max-h-40 overflow-y-auto pr-1">
              {allocationSlices.map((slice, idx) => (
                <div
                  key={slice.id}
                  onMouseEnter={() => setHoveredSlice(idx)}
                  onMouseLeave={() => setHoveredSlice(null)}
                  className={`flex items-center justify-between p-1.5 rounded-lg transition-colors cursor-pointer ${
                    hoveredSlice === idx
                      ? 'bg-neutral-100 dark:bg-neutral-800'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                  }`}
                  onClick={() => onNavigateCategory(slice.id)}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="text-neutral-700 dark:text-neutral-300 truncate text-[11px]">
                      {slice.name}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 shrink-0 text-[11px]">
                    {slice.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Diversification Banner */}
          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Diversification: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{diversification.score.toFixed(1)}/10</strong>
                </span>
                <span className="text-[11px] text-neutral-400 block">{diversification.label}</span>
              </div>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
              diversification.score >= 8
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : diversification.score >= 5
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
            }`}>
              {diversification.score >= 8 ? 'Optimal' : diversification.score >= 5 ? 'Moderate' : 'Low'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Middle Bento Row: 3 Modular Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card A: Top Performers / Movers */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                Top Holdings
              </h3>
              <span className="text-[10px] text-neutral-400">By Value</span>
            </div>

            <div className="divide-y divide-neutral-100 dark:divide-neutral-800 mt-2">
              {holdings.length > 0 ? (
                [...holdings]
                  .sort((a, b) => b.currentValue - a.currentValue)
                  .slice(0, 4)
                  .map((h) => (
                    <div key={h.investment.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="truncate pr-2">
                        <span className="font-bold text-neutral-900 dark:text-neutral-100 block truncate">
                          {h.investment.symbol}
                        </span>
                        <span className="text-[10px] text-neutral-400 truncate block">
                          {h.investment.name}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 block">
                          {formatCurrency(h.currentValue, currency, privacyMode)}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-semibold ${
                            h.unrealizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {h.unrealizedPnl >= 0 ? '+' : ''}
                          {h.unrealizedPnlPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="py-8 text-center text-xs text-neutral-400">No active assets</div>
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigateCategory('stocks')}
            className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center justify-between cursor-pointer"
          >
            <span>Explore all holdings</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Card B: Upcoming Liquidity & SIP Events */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                Upcoming Cash Events
              </h3>
              <span className="text-[10px] text-neutral-400">Next 60 Days</span>
            </div>

            <div className="divide-y divide-neutral-100 dark:divide-neutral-800 mt-2">
              {upcomingCashFlows.length > 0 ? (
                upcomingCashFlows.slice(0, 4).map((flow) => (
                  <div key={flow.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="truncate pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                          {flow.type}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400">{flow.date}</span>
                      </div>
                      <span className="font-medium text-neutral-900 dark:text-neutral-100 block truncate mt-0.5">
                        {flow.title}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 shrink-0">
                      {formatCurrency(flow.amount, currency, privacyMode)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-neutral-400">No scheduled payouts</div>
              )}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between">
            <span>Automated tracking</span>
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              {upcomingCashFlows.length} upcoming
            </span>
          </div>
        </div>

        {/* Card C: Portfolio Health & Rebalancing Pulse */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Diversification Health
              </h3>
              <span className="text-[10px] text-neutral-400">HHI Index</span>
            </div>

            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-neutral-100 dark:text-neutral-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-emerald-500 transition-all duration-1000 ease-out"
                    strokeDasharray={`${diversification.score * 10}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-black font-mono text-neutral-900 dark:text-white">
                    {diversification.score.toFixed(1)}
                  </span>
                  <span className="text-[9px] uppercase font-bold text-neutral-400">out of 10</span>
                </div>
              </div>

              <p className="text-xs text-center text-neutral-600 dark:text-neutral-400 mt-2 px-2">
                {diversification.label}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between">
            <span>Risk dispersion</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Balanced</span>
          </div>
        </div>
      </div>

      {/* 3. Asset Class Breakdown Grid (Sleek Modern Cards) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Asset Class Breakdown
            </h3>
            <p className="text-xs text-neutral-400">
              Click any category card to drill down into dedicated analytics &amp; holdings
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categorySummaries.map((cat) => {
            const Icon = cat.icon;
            const percentage = currentValue > 0 ? (cat.currentValue / currentValue) * 100 : 0;
            const isProfit = cat.pnl >= 0;

            return (
              <div
                key={cat.id}
                onClick={() => onNavigateCategory(cat.id)}
                className="group relative flex flex-col justify-between p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-400 dark:hover:border-neutral-600 hover:shadow-md transition-all cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="p-2 rounded-xl text-white shrink-0"
                        style={{ backgroundColor: cat.color }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        {cat.name}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:translate-x-0.5 group-hover:text-neutral-900 dark:group-hover:text-white transition-all" />
                  </div>

                  <div className="mt-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-base font-bold font-mono tabular-nums text-neutral-900 dark:text-neutral-50">
                        {formatCurrency(cat.currentValue, currency, privacyMode)}
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-1">
                      <span>Cost: {formatCurrency(cat.totalInvested, currency, privacyMode)}</span>
                      <span
                        className={`font-mono font-semibold ${
                          isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isProfit ? '+' : ''}
                        {cat.pnlPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400 truncate max-w-[130px]">{cat.topPickOrYield}</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold group-hover:underline">
                    View →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
