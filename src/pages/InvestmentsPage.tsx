import React, { useState, useMemo, useEffect } from 'react';
import {
  RefreshCw, Plus, TrendingUp, TrendingDown,
  DollarSign, PieChart, Edit3, ArrowUpRight, ArrowDownRight,
  Landmark, ShieldCheck, Coins, Award, Building2, Boxes,
  Calendar, Layers, ListFilter, Sparkles, Radio
} from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { formatCurrency, formatPercentage } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import { CurrencyInput } from '../components/common/CurrencyInput';
import { CustomSelect } from '../components/common/CustomSelect';
import { AssetType, InvestmentTxType, InvestmentCategory, Investment, InvestmentTransaction } from '../types';
import { InvestmentCategoryNav } from '../components/investments/InvestmentCategoryNav';
import { OverallDashboardView } from '../components/investments/OverallDashboardView';
import { IndividualDashboardView } from '../components/investments/IndividualDashboardView';
import { AddInvestmentModal } from '../components/investments/forms/AddInvestmentModal';
import { SyncHoldingsModal } from '../components/investments/sync/SyncHoldingsModal';
import { calculateHoldings, generateUpcomingCashFlows, mapAssetTypeToCategory } from '../utils/investmentUtils';
import { getMarketStatus } from '../utils/marketHours';

export const InvestmentsPage: React.FC = () => {
  const {
    investments, investmentTransactions, priceQuotes,
    addInvestment, updateInvestment, addInvestmentTransaction, updatePriceQuote,
    syncLivePrices, isLiveStreamActive, toggleLiveStream
  } = useFinanceStore();
  const { currency, privacyMode, marketRegion, autoMarketHoursSync } = useSettingsStore();
  const marketStatus = useMemo(() => getMarketStatus(marketRegion), [marketRegion]);

  // Active Category state: 'all' represents consolidated dashboard
  const [activeCategory, setActiveCategory] = useState<InvestmentCategory>('all');
  const [consolidatedTab, setConsolidatedTab] = useState<'visual' | 'holdings_table' | 'trade_history'>('visual');

  // Modals
  const [isSyncHoldingsModalOpen, setIsSyncHoldingsModalOpen] = useState(false);
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  const [targetAddCategory, setTargetAddCategory] = useState<InvestmentCategory>('all');
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);
  const [isPriceOverrideModalOpen, setIsPriceOverrideModalOpen] = useState(false);
  const [overrideSymbol, setOverrideSymbol] = useState('');
  const [overridePrice, setOverridePrice] = useState<number | ''>('');
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // Add Transaction Form States
  const [selectedAssetId, setSelectedAssetId] = useState(investments[0]?.id || '');
  const [txType, setTxType] = useState<InvestmentTxType>('BUY');
  const [txQty, setTxQty] = useState<number | ''>('');
  const [txPrice, setTxPrice] = useState<number | ''>('');
  const [txFees, setTxFees] = useState<number | ''>('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txNotes, setTxNotes] = useState('');
  const [txErrors, setTxErrors] = useState<Record<string, string>>({});

  // Refresh animation state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Compute FIFO Holdings dynamically
  const holdingsData = useMemo(() => {
    return calculateHoldings(investments, investmentTransactions, priceQuotes);
  }, [investments, investmentTransactions, priceQuotes]);

  // Compute Upcoming Cash Flows & Maturities dynamically from actual holdings
  const upcomingCashFlows = useMemo(() => {
    return generateUpcomingCashFlows(investments, holdingsData);
  }, [investments, holdingsData]);

  // Compute Category Totals for Badge values in Nav dynamically
  const categoryTotals = useMemo(() => {
    const totals: Record<InvestmentCategory, number> = {
      all: 0,
      stocks: 0,
      mutual_funds: 0,
      fixed_income: 0,
      gold_sgb: 0,
      bonds: 0,
      reits: 0,
      retirement: 0,
      crypto_alt: 0,
    };

    holdingsData.forEach((h) => {
      totals.all += h.currentValue;
      if (totals[h.category] !== undefined) {
        totals[h.category] += h.currentValue;
      }
    });

    return totals;
  }, [holdingsData]);

  const handleRefreshPrices = async () => {
    setIsRefreshing(true);
    try {
      await syncLivePrices();
    } catch (err) {
      console.error('Failed to sync live prices:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveInvestmentFromModal = async (
    newInvestment: Omit<Investment, 'id'>,
    transaction: Omit<InvestmentTransaction, 'id' | 'createdAt'>,
    initialPrice: number
  ) => {
    // Generate deterministic id prefix
    const generatedId = `inv_${Date.now()}`;
    const invWithId: Investment = { ...newInvestment, id: generatedId };
    await addInvestment(invWithId);

    // Record initial transaction
    if (transaction.quantity > 0 && transaction.price > 0) {
      await addInvestmentTransaction({
        ...transaction,
        investmentId: generatedId,
      });
    }

    // Set initial price quote
    if (initialPrice > 0) {
      updatePriceQuote(newInvestment.symbol, initialPrice, 0);
    }
  };

  const handleCreateTx = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!selectedAssetId) {
      newErrors.assetId = 'Please select an asset';
    }
    if (!txQty || Number(txQty) <= 0) {
      newErrors.quantity = 'Please enter a valid quantity';
    }
    if (!txPrice || Number(txPrice) <= 0) {
      newErrors.price = 'Please enter execution price';
    }

    if (Object.keys(newErrors).length > 0) {
      setTxErrors(newErrors);
      return;
    }
    setTxErrors({});

    addInvestmentTransaction({
      investmentId: selectedAssetId,
      type: txType,
      quantity: Number(txQty),
      price: Number(txPrice),
      fees: Number(txFees) || 0,
      date: txDate,
      notes: txNotes || undefined,
    });

    setTxQty('');
    setTxPrice('');
    setTxNotes('');
    setTxErrors({});
    setIsAddTxModalOpen(false);
  };

  const handleSavePriceOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overridePrice || Number(overridePrice) <= 0) {
      setOverrideError('Please enter a valid unit price greater than ₹0');
      return;
    }
    if (!overrideSymbol) return;
    setOverrideError(null);
    updatePriceQuote(overrideSymbol, Number(overridePrice), 0, true);
    setIsPriceOverrideModalOpen(false);
  };

  // Top Workspace Tab navigation: 'overview' | 'holdings' | 'cash_flows' | 'ledger'
  const [activeTab, setActiveTab] = useState<'overview' | 'holdings' | 'cash_flows' | 'ledger'>('overview');
  const [holdingsCategoryFilter, setHoldingsCategoryFilter] = useState<string>('all');
  const [holdingsSearchQuery, setHoldingsSearchQuery] = useState('');
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);


  // Filtered holdings for the Holdings tab
  const filteredHoldings = useMemo(() => {
    return holdingsData.filter((h) => {
      const matchesCategory = holdingsCategoryFilter === 'all' || h.category === holdingsCategoryFilter;
      const matchesSearch =
        h.investment.symbol.toLowerCase().includes(holdingsSearchQuery.toLowerCase()) ||
        h.investment.name.toLowerCase().includes(holdingsSearchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [holdingsData, holdingsCategoryFilter, holdingsSearchQuery]);

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Header & Consolidated Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Wealth &amp; Investments
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300/40">
              Live Engine
            </span>
            {isLiveStreamActive ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Live WebSocket Feed
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700"
                title={`${marketStatus.market.country} • ${marketStatus.reason}`}
              >
                <span>{marketStatus.market.flag}</span>
                <span>{marketStatus.market.exchange}: {marketStatus.statusText}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Consolidated portfolio wealth, holdings, automated SIP cash flows, and trade executions
          </p>
        </div>

        {/* Action Button Strip: Live Ticker Toggle + Sync + Refresh + "+ New Investment" */}
        <div className="flex items-center gap-2 flex-wrap relative">
          {/* Live Zero-Auth Ticker Button */}
          <button
            onClick={toggleLiveStream}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all cursor-pointer shadow-xs ${
              isLiveStreamActive
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-600 ring-2 ring-emerald-500/20'
                : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700'
            }`}
            title={`${marketStatus.market.flag} ${marketStatus.market.exchange} • ${marketStatus.statusText} (${marketStatus.reason})`}
          >
            <Radio className={`h-3.5 w-3.5 ${isLiveStreamActive ? 'text-emerald-600 dark:text-emerald-400 animate-pulse' : 'text-neutral-400'}`} />
            <span>{isLiveStreamActive ? 'Live Ticker: ON' : 'Live Ticker'}</span>
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                marketStatus.isOpen
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {marketStatus.isOpen ? 'Open' : 'Closed'}
            </span>
          </button>

          <button
            onClick={() => setIsSyncHoldingsModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/90 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition-colors shadow-xs cursor-pointer"
            title="Import holdings from Zerodha, Groww, Upstox, CAS, etc."
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Sync Holdings</span>
            <span className="rounded bg-indigo-200/70 dark:bg-indigo-900/80 px-1 py-0.2 text-[9px] font-bold text-indigo-800 dark:text-indigo-300">
              FREE
            </span>
          </button>

          <button
            onClick={handleRefreshPrices}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 transition-colors shadow-xs cursor-pointer"
            title="Refresh latest market prices"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Consolidated "+ New" Action Menu */}
          <div className="relative">
            <button
              onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ New Investment</span>
              <span className="text-[10px] ml-0.5 opacity-80">▾</span>
            </button>

            {isAddMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsAddMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-52 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl dark:border-neutral-700 dark:bg-neutral-800 z-30 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      setIsAddMenuOpen(false);
                      setTargetAddCategory(activeCategory === 'all' ? 'stocks' : activeCategory);
                      setIsAddAssetModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700 cursor-pointer"
                  >
                    <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <span>Add New Asset</span>
                      <span className="block text-[10px] font-normal text-neutral-400">Stock, MF, FD, SGB, Bond</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setIsAddMenuOpen(false);
                      if (investments.length === 0) {
                        setIsAddAssetModalOpen(true);
                        return;
                      }
                      if (!selectedAssetId) {
                        setSelectedAssetId(investments[0]?.id || '');
                      }
                      setIsAddTxModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700 cursor-pointer"
                  >
                    <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <span>Record Trade / SIP</span>
                      <span className="block text-[10px] font-normal text-neutral-400">Execute buy, sell, or installment</span>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Top-Level Workspace Tabs: 4 Clean Tabs */}
      <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => {
              setActiveTab('overview');
              setActiveCategory('all');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('holdings');
              setActiveCategory('all');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'holdings'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
            }`}
          >
            <ListFilter className="h-3.5 w-3.5" />
            <span>Holdings &amp; Positions</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
              activeTab === 'holdings' ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
            }`}>
              {holdingsData.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('cash_flows');
              setActiveCategory('all');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'cash_flows'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Cash Flows &amp; SIPs</span>
            {upcomingCashFlows.length > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                activeTab === 'cash_flows' ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
              }`}>
                {upcomingCashFlows.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('ledger');
              setActiveCategory('all');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'ledger'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Trade Ledger</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
              activeTab === 'ledger' ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
            }`}>
              {investmentTransactions.length}
            </span>
          </button>
        </div>

        {activeCategory !== 'all' && (
          <button
            onClick={() => setActiveCategory('all')}
            className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 flex items-center gap-1 cursor-pointer"
          >
            <span>← Back to All Assets</span>
          </button>
        )}
      </div>

      {/* VIEWPORT ROUTING: Render view based on activeTab & activeCategory */}
      {activeCategory !== 'all' ? (
        /* INDIVIDUAL ASSET CLASS DEEP-DIVE VIEW */
        <IndividualDashboardView
          category={activeCategory}
          holdings={holdingsData}
          transactions={investmentTransactions}
          currency={currency}
          privacyMode={privacyMode}
          onBackToOverview={() => setActiveCategory('all')}
          onOpenTradeModal={(assetId) => {
            if (assetId) setSelectedAssetId(assetId);
            setIsAddTxModalOpen(true);
          }}
          onOpenAddAssetModal={(cat) => {
            setTargetAddCategory(cat);
            setIsAddAssetModalOpen(true);
          }}
          onOpenPriceOverrideModal={(symbol, currentPrice) => {
            setOverrideSymbol(symbol);
            setOverridePrice(currentPrice);
            setIsPriceOverrideModalOpen(true);
          }}
          onToggleSipStatus={(assetId) => {
            const curr = investments.find((i) => i.id === assetId);
            if (curr) {
              updateInvestment(assetId, { isSipActive: !curr.isSipActive });
            }
          }}
        />
      ) : activeTab === 'overview' ? (
        /* 1. OVERVIEW: Sleek Bento Grid Dashboard */
        <OverallDashboardView
          holdings={holdingsData}
          transactions={investmentTransactions}
          upcomingCashFlows={upcomingCashFlows}
          currency={currency}
          privacyMode={privacyMode}
          onNavigateCategory={setActiveCategory}
          onOpenTradeModal={(assetId) => {
            if (assetId) setSelectedAssetId(assetId);
            setIsAddTxModalOpen(true);
          }}
        />
      ) : activeTab === 'holdings' ? (
        /* 2. HOLDINGS & POSITIONS: Clean table with category filter chips */
        <div className="flex flex-col gap-4">
          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'stocks', label: 'Stocks' },
                { id: 'mutual_funds', label: 'Mutual Funds' },
                { id: 'fixed_income', label: 'Fixed Deposits' },
                { id: 'gold_sgb', label: 'Gold & SGB' },
                { id: 'bonds', label: 'Bonds' },
                { id: 'reits', label: 'REITs' },
                { id: 'retirement', label: 'PPF / NPS' },
                { id: 'crypto_alt', label: 'Crypto' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setHoldingsCategoryFilter(pill.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    holdingsCategoryFilter === pill.id
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="shrink-0 sm:w-64">
              <input
                type="text"
                placeholder="Search holdings..."
                value={holdingsSearchQuery}
                onChange={(e) => setHoldingsSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:bg-neutral-900"
              />
            </div>
          </div>

          {/* Holdings Table */}
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Holdings Portfolio ({filteredHoldings.length})
                </h3>
                <p className="text-xs text-neutral-400">
                  Real-time market values, weighted cost basis, and profit &amp; loss
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-neutral-400">Holdings Value</span>
                <div className="text-base font-bold font-mono text-neutral-900 dark:text-neutral-100">
                  {formatCurrency(
                    filteredHoldings.reduce((s, h) => s + h.currentValue, 0),
                    currency,
                    privacyMode
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/75 dark:border-neutral-800 dark:bg-neutral-800/40 text-neutral-500 dark:text-neutral-400 font-semibold">
                    <th className="py-3 px-4">Asset / Symbol</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Holding Qty</th>
                    <th className="py-3 px-4 text-right">Avg Cost</th>
                    <th className="py-3 px-4 text-right">Market Price</th>
                    <th className="py-3 px-4 text-right">Total Value</th>
                    <th className="py-3 px-4 text-right">Unrealized P&amp;L</th>
                    <th className="py-3 px-4 text-right">Day Chg</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {filteredHoldings.length > 0 ? (
                    filteredHoldings.map((h) => (
                      <tr
                        key={h.investment.id}
                        className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-neutral-900 dark:text-neutral-100">
                              {h.investment.symbol}
                            </span>
                            <span className="text-[11px] text-neutral-400 truncate max-w-xs">
                              {h.investment.name}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                            {h.investment.assetType}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                          {h.totalQty.toFixed(4).replace(/\.?0+$/, '')}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                          {formatCurrency(h.avgBuyPrice, currency, privacyMode)}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                          <div className="flex items-center justify-end gap-1">
                            <span>{formatCurrency(h.currentPrice, currency, privacyMode)}</span>
                            {h.isManualOverride && (
                              <span title="Manual Price Override Active" className="text-amber-500 font-bold">
                                *
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold">
                          {formatCurrency(h.currentValue, currency, privacyMode)}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                          <div className="flex flex-col">
                            <span
                              className={
                                h.unrealizedPnl >= 0 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'
                              }
                            >
                              {h.unrealizedPnl >= 0 ? '+' : ''}
                              {formatCurrency(h.unrealizedPnl, currency, privacyMode)}
                            </span>
                            <span className="text-[10px] text-neutral-400">
                              {formatPercentage(h.unrealizedPnlPct, privacyMode)}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                          <span className={h.dayChangePct >= 0 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                            {h.dayChangePct >= 0 ? '+' : ''}
                            {h.dayChangePct.toFixed(2)}%
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedAssetId(h.investment.id);
                                setIsAddTxModalOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-[11px] font-semibold transition-colors cursor-pointer"
                              title="Trade or record SIP for this asset"
                            >
                              Trade
                            </button>
                            <button
                              onClick={() => {
                                setOverrideSymbol(h.investment.symbol);
                                setOverridePrice(h.currentPrice);
                                setIsPriceOverrideModalOpen(true);
                              }}
                              title="Override market unit price"
                              className="rounded p-1 text-neutral-400 hover:text-indigo-600 transition-colors"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-neutral-400">
                        No holdings found matching criteria
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'cash_flows' ? (
        /* 3. CASH FLOWS & SIPS: Dedicated Timeline View */
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-600" />
                Upcoming Cash Flows, SIP Debits &amp; Maturities
              </h3>
              <p className="text-xs text-neutral-400">
                Scheduled liquidity events, mutual fund SIP debits, FD maturities, and semi-annual coupon payouts
              </p>
            </div>
            <span className="text-xs font-semibold text-neutral-400">
              Next 60 Days
            </span>
          </div>

          {upcomingCashFlows.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {upcomingCashFlows.map((flow) => (
                <div
                  key={flow.id}
                  className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/40 flex flex-col justify-between gap-3 shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        {flow.type}
                      </span>
                      <span className="text-xs font-mono font-semibold text-neutral-500">
                        {flow.date}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mt-2 truncate">
                      {flow.title}
                    </h4>
                    <span className="text-xs text-neutral-400 truncate block">
                      {flow.assetName}
                    </span>
                  </div>

                  <div className="pt-2.5 border-t border-neutral-200/40 dark:border-neutral-700/40 flex items-center justify-between">
                    <span className="text-xs text-neutral-400">Expected Flow</span>
                    <span className="text-base font-bold font-mono text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(flow.amount, currency, privacyMode)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-neutral-400">
              No upcoming cash flow events or maturities in the next 60 days
            </div>
          )}
        </div>
      ) : (
        /* 4. TRADE LEDGER: Comprehensive Audit Trail */
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Transaction Audit Trail ({investmentTransactions.length})
              </h3>
              <p className="text-xs text-neutral-400">
                Recorded asset allocations, buy/sell executions, and SIP investments
              </p>
            </div>
            <button
              onClick={() => {
                if (investments.length > 0) {
                  setSelectedAssetId(investments[0].id);
                  setIsAddTxModalOpen(true);
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold transition-colors cursor-pointer"
            >
              + Record Execution
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/75 dark:border-neutral-800 dark:bg-neutral-800/40 text-neutral-500 font-semibold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Asset Symbol</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4 text-right">Units / Quantity</th>
                  <th className="py-3 px-4 text-right">Execution Price</th>
                  <th className="py-3 px-4 text-right">Brokerage / Fees</th>
                  <th className="py-3 px-4 text-right">Total Net Cash Flow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {investmentTransactions.length > 0 ? (
                  investmentTransactions.map((tx) => {
                    const inv = investments.find((i) => i.id === tx.investmentId);
                    const totalAmt = tx.quantity * tx.price + (tx.fees || 0);
                    return (
                      <tr key={tx.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40">
                        <td className="py-3 px-4 font-mono">{tx.date}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-neutral-900 dark:text-neutral-100">
                            {inv?.symbol || 'ASSET'}
                          </span>
                          <span className="block text-[11px] text-neutral-400">{inv?.name}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              tx.type === 'BUY'
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400'
                                : tx.type === 'SELL'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">{tx.quantity}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {formatCurrency(tx.price, currency, privacyMode)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-neutral-400">
                          {formatCurrency(tx.fees, currency, privacyMode)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                          {formatCurrency(totalAmt, currency, privacyMode)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-400">
                      No transactions recorded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DEDICATED MULTI-CATEGORY ADD INVESTMENT MODAL */}
      <AddInvestmentModal
        isOpen={isAddAssetModalOpen}
        onClose={() => setIsAddAssetModalOpen(false)}
        defaultCategory={targetAddCategory}
        onSave={handleSaveInvestmentFromModal}
      />

      {/* RECORD TRADE / TRANSACTION MODAL */}
      <Modal
        isOpen={isAddTxModalOpen}
        onClose={() => setIsAddTxModalOpen(false)}
        title="Record Investment Transaction"
        subtitle="Saved as asset movement · NOT double counted as regular expense"
      >
        <form noValidate onSubmit={handleCreateTx} className="flex flex-col gap-4">
          {Object.keys(txErrors).length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
              <span className="font-semibold">Please check the highlighted fields below.</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Select Asset *
              </label>
              <CustomSelect
                value={selectedAssetId}
                onChange={(val) => {
                  setSelectedAssetId(val);
                  if (txErrors.assetId) setTxErrors(prev => ({ ...prev, assetId: '' }));
                }}
                className={`w-full ${txErrors.assetId ? 'ring-1 ring-rose-500 rounded-lg' : ''}`}
                options={investments.map((i) => ({
                  value: i.id,
                  label: `${i.symbol} · ${i.name}`,
                }))}
              />
              {txErrors.assetId && (
                <p className="text-[11px] font-medium text-rose-500 mt-1">{txErrors.assetId}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Action Type
              </label>
              <CustomSelect
                value={txType}
                onChange={(val) => setTxType(val as InvestmentTxType)}
                className="w-full"
                options={[
                  { value: 'BUY', label: 'BUY (Acquire / SIP)' },
                  { value: 'SELL', label: 'SELL (Redeem / Exit)' },
                  { value: 'DIVIDEND', label: 'DIVIDEND / Coupon Payout' },
                  { value: 'SPLIT', label: 'SPLIT / Bonus Issue' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Quantity / Units / Grams *
              </label>
              <input
                type="number"
                step="any"
                value={txQty}
                onChange={(e) => {
                  let raw = e.target.value;
                  if (raw.length > 1 && /^0\d/.test(raw)) raw = raw.replace(/^0+(?=\d)/, '');
                  setTxQty(raw === '' ? '' : parseFloat(raw));
                  if (txErrors.quantity) setTxErrors(prev => ({ ...prev, quantity: '' }));
                }}
                onFocus={(e) => e.target.select()}
                className={`w-full rounded-lg border bg-white p-2 text-xs font-mono text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
                  txErrors.quantity ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
                }`}
              />
              {txErrors.quantity && (
                <p className="text-[11px] font-medium text-rose-500 mt-1">{txErrors.quantity}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Execution Price Per Unit *
              </label>
              <CurrencyInput
                value={txPrice}
                onChange={(val) => {
                  setTxPrice(val);
                  if (txErrors.price) setTxErrors(prev => ({ ...prev, price: '' }));
                }}
                hasError={!!txErrors.price}
              />
              {txErrors.price && (
                <p className="text-[11px] font-medium text-rose-500 mt-1">{txErrors.price}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Brokerage, STT &amp; Taxes
              </label>
              <CurrencyInput value={txFees} onChange={setTxFees} />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Execution Date
              </label>
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-mono text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Notes &amp; Folio / Order ID
            </label>
            <input
              type="text"
              value={txNotes}
              onChange={(e) => setTxNotes(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsAddTxModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs cursor-pointer"
            >
              Confirm Transaction
            </button>
          </div>
        </form>
      </Modal>

      {/* MANUAL PRICE OVERRIDE MODAL */}
      <Modal
        isOpen={isPriceOverrideModalOpen}
        onClose={() => setIsPriceOverrideModalOpen(false)}
        title={`Override Market Price for ${overrideSymbol}`}
        subtitle="Used as fallback when external stock ticker or NAV feeds are delayed"
      >
        <form noValidate onSubmit={handleSavePriceOverride} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Manual Unit Price *
            </label>
            <CurrencyInput
              value={overridePrice}
              onChange={(val) => {
                setOverridePrice(val);
                if (overrideError) setOverrideError(null);
              }}
              hasError={!!overrideError}
            />
            {overrideError && (
              <p className="text-[11px] font-medium text-rose-500 mt-1">{overrideError}</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsPriceOverrideModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs cursor-pointer"
            >
              Set Override
            </button>
          </div>
        </form>
      </Modal>

      {/* Sync Original Holdings Modal */}
      <SyncHoldingsModal
        isOpen={isSyncHoldingsModalOpen}
        onClose={() => setIsSyncHoldingsModalOpen(false)}
      />
    </div>
  );
};
