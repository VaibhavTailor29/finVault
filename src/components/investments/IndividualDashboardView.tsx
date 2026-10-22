import React, { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, ArrowLeft, Plus, Calendar,
  CheckCircle2, AlertCircle, RefreshCw, Sparkles, Building2,
  Landmark, ShieldCheck, Coins, Award, Boxes, PieChart,
  Sliders, ExternalLink, Edit3, Repeat
} from 'lucide-react';
import { InvestmentCategory, Investment, AssetType, InvestmentTransaction } from '../../types';
import { CalculatedHolding, calculateAssetPriceHistory, PriceHistoryPoint } from '../../utils/investmentUtils';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

interface IndividualDashboardViewProps {
  category: InvestmentCategory;
  holdings: CalculatedHolding[];
  transactions: InvestmentTransaction[];
  currency: string;
  privacyMode: boolean;
  onBackToOverview: () => void;
  onOpenTradeModal: (assetId?: string) => void;
  onOpenAddAssetModal?: (category: InvestmentCategory) => void;
  onOpenPriceOverrideModal: (symbol: string, currentPrice: number) => void;
  onToggleSipStatus?: (assetId: string) => void;
}

export const IndividualDashboardView: React.FC<IndividualDashboardViewProps> = ({
  category,
  holdings,
  transactions,
  currency,
  privacyMode,
  onBackToOverview,
  onOpenTradeModal,
  onOpenAddAssetModal,
  onOpenPriceOverrideModal,
  onToggleSipStatus,
}) => {
  // Filter holdings belonging to this category
  const categoryHoldings = useMemo(() => {
    return holdings.filter((h) => h.category === category);
  }, [holdings, category]);

  const [selectedAsset, setSelectedAsset] = useState<CalculatedHolding | null>(
    categoryHoldings[0] || null
  );

  // Keep selectedAsset in sync when category changes
  React.useEffect(() => {
    setSelectedAsset(categoryHoldings[0] || null);
  }, [category, categoryHoldings]);

  const [chartRange, setChartRange] = useState<'1M' | '6M' | '1Y' | 'ALL'>('1Y');

  // Dynamic Category Totals
  const totalInvested = useMemo(() => categoryHoldings.reduce((s, h) => s + h.totalInvested, 0), [categoryHoldings]);
  const currentValue = useMemo(() => categoryHoldings.reduce((s, h) => s + h.currentValue, 0), [categoryHoldings]);
  const totalPnl = currentValue - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  // Dynamic Category Configuration Details & Badges
  const meta = useMemo(() => {
    switch (category) {
      case 'mutual_funds': {
        const totalMonthlySip = categoryHoldings.reduce((s, h) => s + (h.investment.monthlyDeposit || 0), 0);
        return {
          title: 'Mutual Funds & Systematic SIPs',
          subtitle: 'Active Systematic Investment Plans, NAV performance, fund category allocation, and auto-debits',
          icon: PieChart,
          color: '#8B5CF6',
          badgeLabel: 'Active Monthly SIP Outflow',
          badgeValue: totalMonthlySip > 0 ? `${formatCurrency(totalMonthlySip, currency, privacyMode)}/mo` : 'No Active SIP',
          leftPanelTitle: 'Systematic Investment Plans (SIP) Mandates',
          addBtnText: '+ Start / Add SIP',
        };
      }
      case 'fixed_income': {
        const weightedRate = categoryHoldings.length > 0
          ? categoryHoldings.reduce((s, h) => s + (h.investment.interestRate || 7) * h.currentValue, 0) / (currentValue || 1)
          : 0;
        return {
          title: 'Fixed Deposits & Recurring Deposits',
          subtitle: 'Term deposits with guaranteed bank yields, compounding interest, and maturity ladders',
          icon: Landmark,
          color: '#F59E0B',
          badgeLabel: 'Weighted Average Rate',
          badgeValue: weightedRate > 0 ? `${weightedRate.toFixed(2)}% p.a.` : '0% p.a.',
          leftPanelTitle: 'Term Deposit Maturity Ladder',
          addBtnText: '+ New Fixed Deposit / RD',
        };
      }
      case 'gold_sgb': {
        const totalGrams = categoryHoldings.reduce((s, h) => s + (h.investment.unitsOrGrams || h.totalQty || 0), 0);
        return {
          title: 'Gold & Sovereign Gold Bonds (SGB)',
          subtitle: 'Reserve Bank of India gold bonds with gold appreciation + 2.50% p.a. guaranteed interest',
          icon: Coins,
          color: '#EAB308',
          badgeLabel: 'Total Gold Accumulation',
          badgeValue: `${totalGrams.toFixed(2)} Grams`,
          leftPanelTitle: 'SGB Tranches & Semi-Annual Payouts',
          addBtnText: '+ Add SGB / Gold Holding',
        };
      }
      case 'bonds': {
        const weightedCoupon = categoryHoldings.length > 0
          ? categoryHoldings.reduce((s, h) => s + (h.investment.interestRate || 7.2) * h.currentValue, 0) / (currentValue || 1)
          : 0;
        return {
          title: 'Government Securities & Bonds',
          subtitle: 'Sovereign G-Secs, State Development Loans, and corporate debentures with coupon flows',
          icon: ShieldCheck,
          color: '#06B6D4',
          badgeLabel: 'Weighted Annual Coupon',
          badgeValue: weightedCoupon > 0 ? `${weightedCoupon.toFixed(2)}% p.a.` : '0% p.a.',
          leftPanelTitle: 'Bond Holdings & Credit Ratings',
          addBtnText: '+ Add Bond / G-Sec',
        };
      }
      case 'reits': {
        const weightedYield = categoryHoldings.length > 0
          ? categoryHoldings.reduce((s, h) => s + (h.investment.interestRate || 6.8) * h.currentValue, 0) / (currentValue || 1)
          : 0;
        return {
          title: 'Real Estate & REITs',
          subtitle: 'Commercial Grade-A office parks, retail malls, and infrastructure trusts with quarterly yield',
          icon: Building2,
          color: '#EC4899',
          badgeLabel: 'Distribution Yield',
          badgeValue: weightedYield > 0 ? `${weightedYield.toFixed(2)}% p.a.` : '0% Yield',
          leftPanelTitle: 'REIT Distribution Schedules',
          addBtnText: '+ Add REIT Holding',
        };
      }
      case 'retirement': {
        const total80C = categoryHoldings.filter(h => h.investment.taxSection === '80C').reduce((s, h) => s + h.totalInvested, 0);
        return {
          title: 'Retirement (PPF / NPS / EPF)',
          subtitle: 'Sovereign statutory retirement vaults with statutory compounding and Section 80C tax exemption',
          icon: Award,
          color: '#10B981',
          badgeLabel: 'Section 80C Utilization',
          badgeValue: `${formatCurrency(total80C, currency, privacyMode)} / ₹1.5L`,
          leftPanelTitle: 'Statutory Retirement Accounts',
          addBtnText: '+ Link PPF / NPS Account',
        };
      }
      case 'crypto_alt': {
        return {
          title: 'Crypto & Digital Assets',
          subtitle: 'Cryptocurrency holdings, cold storage custody, and non-correlated alternative assets',
          icon: Boxes,
          color: '#F97316',
          badgeLabel: 'Portfolio Share',
          badgeValue: `${formatPercentage(totalPnlPct, privacyMode)} Return`,
          leftPanelTitle: 'Digital Assets & Cold Storage',
          addBtnText: '+ Add Crypto Position',
        };
      }
      default: {
        return {
          title: 'Stocks & Equity Portfolio',
          subtitle: 'Direct NSE/BSE equity shares, sector ETFs, and index trackers with live market pricing',
          icon: TrendingUp,
          color: '#3B82F6',
          badgeLabel: 'Total Equity Holdings',
          badgeValue: `${categoryHoldings.length} Stocks`,
          leftPanelTitle: 'Holding Weights & Allocation',
          addBtnText: '+ Buy Stock / Equity',
        };
      }
    }
  }, [category, categoryHoldings, currentValue, totalPnlPct, currency, privacyMode]);

  const Icon = meta.icon;

  // Real Historical Price Curve derived from actual transaction history & range
  const priceHistoryPoints: PriceHistoryPoint[] = useMemo(() => {
    if (!selectedAsset) return [];
    return calculateAssetPriceHistory(selectedAsset, transactions, chartRange);
  }, [selectedAsset, transactions, chartRange]);

  // Chart Geometry
  const minPrice = priceHistoryPoints.length > 0 ? Math.min(...priceHistoryPoints.map((p) => p.price)) * 0.98 : 0;
  const maxPrice = priceHistoryPoints.length > 0 ? Math.max(...priceHistoryPoints.map((p) => p.price)) * 1.02 : 100;
  const chartWidth = 420;
  const chartHeight = 130;

  const chartPointsString = priceHistoryPoints
    .map((pt, i) => {
      const x = priceHistoryPoints.length > 1 ? (i / (priceHistoryPoints.length - 1)) * chartWidth : chartWidth / 2;
      const divisor = maxPrice - minPrice || 1;
      const y = chartHeight - ((pt.price - minPrice) / divisor) * (chartHeight - 20) - 10;
      return `${x},${y}`;
    })
    .join(' ');

  const chartAreaPath = chartPointsString.length > 0
    ? `M 0,${chartHeight} L ${chartPointsString.split(' ')[0]} ${chartPointsString.replace(/ /g, ' L ')} L ${chartWidth},${chartHeight} Z`
    : '';

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Category Header & Top Navigation Breadcrumb */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToOverview}
            className="p-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors shadow-xs cursor-pointer"
            title="Back to Consolidated Overview"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <div
                className="p-1.5 rounded-lg text-white shrink-0"
                style={{ backgroundColor: meta.color }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                {meta.title}
              </h2>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {meta.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenAddAssetModal && (
            <button
              onClick={() => onOpenAddAssetModal(category)}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
              style={{ backgroundColor: meta.color }}
            >
              <Plus className="h-3.5 w-3.5" />
              {meta.addBtnText}
            </button>
          )}
          <button
            onClick={() => onOpenTradeModal(selectedAsset?.investment.id)}
            className="flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 transition-colors shadow-xs cursor-pointer"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Record Trade
          </button>
        </div>
      </div>

      {/* 2. Category Performance Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-5 rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
        <div>
          <span className="text-xs text-neutral-400 block font-medium">Category Valuation</span>
          <div className="text-2xl font-bold font-mono tabular-nums text-neutral-900 dark:text-neutral-50 mt-1">
            {formatCurrency(currentValue, currency, privacyMode)}
          </div>
          <span className="text-[11px] text-neutral-400 mt-0.5 block">
            {categoryHoldings.length} Instruments Active
          </span>
        </div>

        <div>
          <span className="text-xs text-neutral-400 block font-medium">Total Capital Invested</span>
          <div className="text-xl font-bold font-mono tabular-nums text-neutral-700 dark:text-neutral-300 mt-1">
            {formatCurrency(totalInvested, currency, privacyMode)}
          </div>
          <span className="text-[11px] text-neutral-400 mt-0.5 block">Net Outflow Basis</span>
        </div>

        <div>
          <span className="text-xs text-neutral-400 block font-medium">Absolute Returns / P&amp;L</span>
          <div
            className={`text-xl font-bold font-mono tabular-nums mt-1 ${
              totalPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {totalPnl >= 0 ? '+' : ''}
            {formatCurrency(totalPnl, currency, privacyMode)}
          </div>
          <span className="text-[11px] font-mono font-semibold">
            {formatPercentage(totalPnlPct, privacyMode)} all time
          </span>
        </div>

        <div>
          <span className="text-xs text-neutral-400 block font-medium">{meta.badgeLabel}</span>
          <div
            className="text-xl font-bold font-mono tabular-nums mt-1"
            style={{ color: meta.color }}
          >
            {meta.badgeValue}
          </div>
          <span className="text-[11px] text-neutral-400 mt-0.5 block">Specialized Metric</span>
        </div>
      </div>

      {/* 3. Specialized Layout: Left Utility Panel + Right Performance & Holdings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Utility Widget (5 Cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              {meta.leftPanelTitle}
            </h3>
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
              Live Schedules
            </span>
          </div>

          {/* Conditional Utility Content based on Category */}
          <div className="py-4 flex flex-col gap-3">
            {/* MUTUAL FUNDS: Real SIP Schedules */}
            {category === 'mutual_funds' && (
              <div className="flex flex-col gap-2.5">
                {categoryHoldings.filter(h => h.investment.monthlyDeposit).length > 0 ? (
                  categoryHoldings.filter(h => h.investment.monthlyDeposit).map((h) => (
                    <div
                      key={h.investment.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                            {h.investment.symbol}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-400">
                            • {h.investment.sipDay || 5}th of every month
                          </span>
                        </div>
                        <span className="text-[11px] text-neutral-500 truncate block max-w-xs">
                          {h.investment.name}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-bold text-xs text-neutral-900 dark:text-neutral-100 block">
                          {formatCurrency(h.investment.monthlyDeposit || 0, currency, privacyMode)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onToggleSipStatus && onToggleSipStatus(h.investment.id)}
                          className={`text-[10px] font-bold ${
                            h.investment.isSipActive !== false
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-neutral-400'
                          }`}
                        >
                          {h.investment.isSipActive !== false ? '● Auto-Debit Active' : '○ Paused'}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-neutral-400 border border-dashed rounded-xl">
                    No active SIPs configured yet. Click "+ Start / Add SIP" to schedule recurring wealth creation.
                  </div>
                )}
              </div>
            )}

            {/* FIXED INCOME: Real FD Ladder with Compound Math */}
            {category === 'fixed_income' && (
              <div className="flex flex-col gap-2.5">
                {categoryHoldings.length > 0 ? (
                  categoryHoldings.map((h) => {
                    const r = (h.investment.interestRate || 7.5) / 100;
                    const t = h.investment.tenureYears || 3;
                    const maturityAmount = Math.round(h.totalInvested * Math.pow(1 + r / 4, 4 * t));
                    return (
                      <div
                        key={h.investment.id}
                        className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                            {h.investment.institution || 'Bank'} {h.investment.assetType}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            {h.investment.interestRate || 7.2}% p.a.
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
                          <span>Matures: <strong>{h.investment.maturityDate || 'At Tenure'}</strong></span>
                          <span className="text-neutral-900 dark:text-neutral-100 font-bold">
                            Maturity: {formatCurrency(maturityAmount, currency, privacyMode)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-neutral-400 border border-dashed rounded-xl">
                    No fixed deposits added yet.
                  </div>
                )}
              </div>
            )}

            {/* GOLD / SGB: Real Holdings & RBI Coupon */}
            {category === 'gold_sgb' && (
              <div className="flex flex-col gap-3">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                  <span className="font-bold text-amber-800 dark:text-amber-300 block mb-1">
                    Sovereign Gold Bond Tax &amp; Interest Privileges
                  </span>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    Earn <strong>2.50% annual coupon interest</strong> credited directly into your linked bank account, plus 100% tax exemption on capital gains at RBI maturity.
                  </p>
                </div>

                {categoryHoldings.map((h) => {
                  const grams = h.investment.unitsOrGrams || h.totalQty;
                  const semiAnnualInterest = Math.round((grams * (h.avgBuyPrice || 5000) * 0.025) / 2);
                  return (
                    <div
                      key={h.investment.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60"
                    >
                      <div>
                        <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 block">
                          {h.investment.symbol}
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          Weight: <strong>{grams} Grams</strong>
                        </span>
                      </div>

                      <div className="text-right font-mono">
                        <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 block">
                          {formatCurrency(h.currentValue, currency, privacyMode)}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold">
                          +₹{semiAnnualInterest.toLocaleString('en-IN')}/6-mo interest
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* RETIREMENT: Real 80C Calculation */}
            {category === 'retirement' && (() => {
              const total80C = categoryHoldings.filter(h => h.investment.taxSection === '80C').reduce((s, h) => s + h.totalInvested, 0);
              const pct80C = Math.min(100, (total80C / 150000) * 100);
              return (
                <div className="flex flex-col gap-3">
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-900 dark:text-emerald-200">
                        Section 80C Ceiling Progress
                      </span>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(total80C, currency, privacyMode)} / ₹1,50,000
                      </span>
                    </div>

                    <div className="w-full h-2.5 rounded-full bg-emerald-200/60 dark:bg-emerald-900/60 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct80C}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                      {pct80C >= 100
                        ? 'Maximized tax deduction achieved for the current financial year.'
                        : `₹${(150000 - total80C).toLocaleString('en-IN')} additional 80C investment eligible.`}
                    </span>
                  </div>

                  {categoryHoldings.map((h) => (
                    <div
                      key={h.investment.id}
                      className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 block">
                          {h.investment.name}
                        </span>
                        <span className="text-[11px] text-neutral-400 font-mono">
                          {h.investment.notes || h.investment.symbol}
                        </span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 block">
                          {formatCurrency(h.currentValue, currency, privacyMode)}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600">
                          {h.investment.taxSection || 'Tax Exempt'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* DEFAULT / STOCKS / BONDS / REITS / CRYPTO */}
            {category !== 'mutual_funds' && category !== 'fixed_income' && category !== 'gold_sgb' && category !== 'retirement' && (
              <div className="flex flex-col gap-2">
                {categoryHoldings.map((h) => (
                  <div
                    key={h.investment.id}
                    onClick={() => setSelectedAsset(h)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                      selectedAsset?.investment.id === h.investment.id
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30'
                        : 'border-neutral-200/60 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 block">
                        {h.investment.symbol}
                      </span>
                      <span className="text-[11px] text-neutral-400 truncate block max-w-[160px]">
                        {h.investment.name}
                      </span>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 block">
                        {formatCurrency(h.currentValue, currency, privacyMode)}
                      </span>
                      <span
                        className={`text-[10px] font-semibold ${
                          h.unrealizedPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {h.unrealizedPnl >= 0 ? '+' : ''}
                        {h.unrealizedPnlPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
            <span>Portfolio Allocation</span>
            <span className="font-bold text-neutral-700 dark:text-neutral-300 font-mono">
              {currentValue > 0 ? `${formatCurrency(currentValue, currency, privacyMode)}` : '₹0'}
            </span>
          </div>
        </div>

        {/* Right Asset Performance & Holdings (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Selected Instrument Performance Card with Real History SVG Chart */}
          {selectedAsset && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                      {selectedAsset.investment.name}
                    </span>
                    <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                      {selectedAsset.investment.symbol}
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-400">
                    Live Price Trajectory &amp; Execution Audit Trail
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Real Time-Range Filter */}
                  <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg text-xs font-semibold">
                    {(['1M', '6M', '1Y', 'ALL'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setChartRange(r)}
                        className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                          chartRange === r
                            ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 shadow-xs font-bold'
                            : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => onOpenPriceOverrideModal(selectedAsset.investment.symbol, selectedAsset.currentPrice)}
                    className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                    title="Manual Price Override"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onOpenTradeModal(selectedAsset.investment.id)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors cursor-pointer"
                  >
                    Trade
                  </button>
                </div>
              </div>

              {/* Real SVG Price & Execution Chart */}
              <div className="py-4">
                {priceHistoryPoints.length > 0 ? (
                  <div className="relative w-full h-36">
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="assetGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={meta.color} stopOpacity="0.25" />
                          <stop offset="100%" stopColor={meta.color} stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Grid lines */}
                      <line x1="0" y1="20" x2={chartWidth} y2="20" stroke="currentColor" strokeDasharray="3 3" className="text-neutral-100 dark:text-neutral-800" />
                      <line x1="0" y1="70" x2={chartWidth} y2="70" stroke="currentColor" strokeDasharray="3 3" className="text-neutral-100 dark:text-neutral-800" />
                      <line x1="0" y1="115" x2={chartWidth} y2="115" stroke="currentColor" strokeDasharray="3 3" className="text-neutral-100 dark:text-neutral-800" />

                      {/* Area Fill */}
                      <path d={chartAreaPath} fill="url(#assetGrad)" />

                      {/* Stroke Line */}
                      <polyline
                        fill="none"
                        stroke={meta.color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={chartPointsString}
                      />

                      {/* Interactive Nodes */}
                      {priceHistoryPoints.map((pt, i) => {
                        const x = priceHistoryPoints.length > 1 ? (i / (priceHistoryPoints.length - 1)) * chartWidth : chartWidth / 2;
                        const divisor = maxPrice - minPrice || 1;
                        const y = chartHeight - ((pt.price - minPrice) / divisor) * (chartHeight - 20) - 10;
                        return (
                          <g key={i} className="group/node">
                            <circle
                              cx={x}
                              cy={y}
                              r="4"
                              fill={meta.color}
                              className="stroke-white dark:stroke-neutral-900 stroke-2 cursor-pointer transition-transform group-hover/node:scale-150"
                            />
                            {/* Hover tooltip text */}
                            <text
                              x={x}
                              y={y - 8}
                              textAnchor="middle"
                              className="text-[9px] font-mono fill-neutral-600 dark:fill-neutral-300 opacity-0 group-hover/node:opacity-100 transition-opacity"
                            >
                              ₹{pt.price.toLocaleString('en-IN')}
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    {/* X-Axis Real Labels */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 mt-2 px-1">
                      {priceHistoryPoints.map((p, idx) => (
                        <span key={idx}>{p.label}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-36 flex items-center justify-center text-xs text-neutral-400">
                    No trade executions recorded yet in this time frame.
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[11px] text-neutral-400 block">Avg Cost</span>
                  <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(selectedAsset.avgBuyPrice, currency, privacyMode)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-neutral-400 block">Current Price / NAV</span>
                  <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(selectedAsset.currentPrice, currency, privacyMode)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-neutral-400 block">Unrealized P&amp;L</span>
                  <span
                    className={`font-mono font-bold ${
                      selectedAsset.unrealizedPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {selectedAsset.unrealizedPnl >= 0 ? '+' : ''}
                    {formatCurrency(selectedAsset.unrealizedPnl, currency, privacyMode)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Holdings Table for this category */}
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {meta.title} Holdings ({categoryHoldings.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/75 dark:border-neutral-800 dark:bg-neutral-800/40 text-neutral-500 dark:text-neutral-400 font-semibold">
                    <th className="py-2.5 px-3">Asset</th>
                    <th className="py-2.5 px-3 text-right">Qty / Units</th>
                    <th className="py-2.5 px-3 text-right">Avg Cost</th>
                    <th className="py-2.5 px-3 text-right">Price</th>
                    <th className="py-2.5 px-3 text-right">Current Value</th>
                    <th className="py-2.5 px-3 text-right">P&amp;L</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {categoryHoldings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-neutral-400">
                        No {meta.title.toLowerCase()} added yet. Click &ldquo;{meta.addBtnText}&rdquo; above to record your first asset.
                      </td>
                    </tr>
                  ) : (
                    categoryHoldings.map((h) => (
                    <tr
                      key={h.investment.id}
                      onClick={() => setSelectedAsset(h)}
                      className={`hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors cursor-pointer ${
                        selectedAsset?.investment.id === h.investment.id
                          ? 'bg-neutral-50/80 dark:bg-neutral-800/60'
                          : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                          {h.investment.symbol}
                        </span>
                        <span className="text-[11px] text-neutral-400 truncate max-w-xs block">
                          {h.investment.name}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {h.totalQty.toFixed(4).replace(/\.?0+$/, '')}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {formatCurrency(h.avgBuyPrice, currency, privacyMode)}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {formatCurrency(h.currentPrice, currency, privacyMode)}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                        {formatCurrency(h.currentValue, currency, privacyMode)}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        <span
                          className={
                            h.unrealizedPnl >= 0 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'
                          }
                        >
                          {h.unrealizedPnl >= 0 ? '+' : ''}
                          {formatCurrency(h.unrealizedPnl, currency, privacyMode)}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenTradeModal(h.investment.id);
                          }}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300"
                        >
                          Trade
                        </button>
                      </td>
                    </tr>
                  ))
                )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
