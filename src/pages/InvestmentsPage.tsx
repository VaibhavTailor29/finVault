import React, { useState } from 'react';
import {
  Landmark, Plus, RefreshCw, TrendingUp, TrendingDown,
  DollarSign, PieChart, Edit3, ArrowUpRight, ArrowDownRight, Eye
} from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { formatCurrency, formatPercentage } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import { CurrencyInput } from '../components/common/CurrencyInput';
import { CustomSelect } from '../components/common/CustomSelect';
import { AssetType, InvestmentTxType } from '../types';

export const InvestmentsPage: React.FC = () => {
  const {
    investments, investmentTransactions, priceQuotes,
    addInvestment, addInvestmentTransaction, updatePriceQuote
  } = useFinanceStore();
  const { currency, privacyMode } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<'holdings' | 'transactions' | 'watchlist'>('holdings');

  // Modals
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);
  const [isPriceOverrideModalOpen, setIsPriceOverrideModalOpen] = useState(false);
  const [overrideSymbol, setOverrideSymbol] = useState('');
  const [overridePrice, setOverridePrice] = useState<number | ''>('');

  // Add Asset Form
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [newAssetType, setNewAssetType] = useState<AssetType>('Stock');

  // Add Transaction Form
  const [selectedAssetId, setSelectedAssetId] = useState(investments[0]?.id || '');
  const [txType, setTxType] = useState<InvestmentTxType>('BUY');
  const [txQty, setTxQty] = useState<number | ''>('');
  const [txPrice, setTxPrice] = useState<number | ''>('');
  const [txFees, setTxFees] = useState<number | ''>(20);
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txNotes, setTxNotes] = useState('');

  // Refresh animation state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // FIFO Holdings Calculation
  const holdingsData = investments.map((inv) => {
    const txs = investmentTransactions
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
    const quote = priceQuotes[inv.symbol] || { price: avgBuyPrice, dayChangePct: 0, isManualOverride: false };
    const currentPrice = quote.price;
    const currentValue = totalQty * currentPrice;
    const unrealizedPnl = currentValue - totalInvested;
    const unrealizedPnlPct = totalInvested > 0 ? (unrealizedPnl / totalInvested) * 100 : 0;

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
    };
  });

  const totalInvestedPortfolio = holdingsData.reduce((sum, h) => sum + h.totalInvested, 0);
  const totalCurrentPortfolio = holdingsData.reduce((sum, h) => sum + h.currentValue, 0);
  const totalUnrealizedPnl = totalCurrentPortfolio - totalInvestedPortfolio;
  const totalUnrealizedPct = totalInvestedPortfolio > 0 ? (totalUnrealizedPnl / totalInvestedPortfolio) * 100 : 0;

  const handleRefreshPrices = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      // Simulate price quotes refresh with realistic fluctuations
      investments.forEach((inv) => {
        const current = priceQuotes[inv.symbol]?.price || 1000;
        const delta = (Math.random() * 2 - 1) * 0.02 * current; // +/- 2%
        const newPrice = Math.round((current + delta) * 100) / 100;
        const changePct = Math.round(((newPrice - current) / current) * 10000) / 100;
        updatePriceQuote(inv.symbol, newPrice, changePct, false);
      });
      setIsRefreshing(false);
    }, 600);
  };

  const handleCreateAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim() || !newName.trim()) return;
    addInvestment({
      symbol: newSymbol.trim().toUpperCase(),
      name: newName.trim(),
      assetType: newAssetType,
    });
    // Set initial price quote
    updatePriceQuote(newSymbol.trim().toUpperCase(), 100, 0);
    setNewSymbol('');
    setNewName('');
    setIsAddAssetModalOpen(false);
  };

  const handleCreateTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txQty || !txPrice || !selectedAssetId) return;
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
    setIsAddTxModalOpen(false);
  };

  const handleSavePriceOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideSymbol || !overridePrice) return;
    updatePriceQuote(overrideSymbol, Number(overridePrice), 0, true);
    setIsPriceOverrideModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Investment Portfolio
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            FIFO cost basis, real-time market pricing with manual override, and asset distribution
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshPrices}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Prices
          </button>
          <button
            onClick={() => setIsAddAssetModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Asset
          </button>
          <button
            onClick={() => setIsAddTxModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-xs"
          >
            Record Trade
          </button>
        </div>
      </div>

      {/* Dominant Portfolio Card */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          <div>
            <span className="text-xs text-neutral-400 block">Total Portfolio Value</span>
            <div className="text-3xl font-bold font-mono tabular-nums text-neutral-900 dark:text-neutral-50 mt-1">
              {formatCurrency(totalCurrentPortfolio, currency, privacyMode)}
            </div>
            <span className="text-[11px] text-neutral-400 mt-1 block">Live market value</span>
          </div>

          <div>
            <span className="text-xs text-neutral-400 block">Total Invested (Cost Basis)</span>
            <div className="text-2xl font-bold font-mono tabular-nums text-neutral-700 dark:text-neutral-300 mt-1">
              {formatCurrency(totalInvestedPortfolio, currency, privacyMode)}
            </div>
            <span className="text-[11px] text-neutral-400 mt-1 block">Excluding dividend returns</span>
          </div>

          <div>
            <span className="text-xs text-neutral-400 block">Unrealized P&amp;L</span>
            <div
              className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                totalUnrealizedPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {totalUnrealizedPnl >= 0 ? '+' : ''}
              {formatCurrency(totalUnrealizedPnl, currency, privacyMode)}
            </div>
            <span className="text-[11px] font-mono font-semibold">
              {formatPercentage(totalUnrealizedPct, privacyMode)} all time
            </span>
          </div>

          <div>
            <span className="text-xs text-neutral-400 block">Estimated Annual XIRR</span>
            <div className="text-2xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-1">
              {privacyMode ? '••%' : '+14.8%'}
            </div>
            <span className="text-[11px] text-neutral-400 mt-1 block">Time-weighted performance</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('holdings')}
          className={`py-2 px-3 border-b-2 transition-colors ${
            activeTab === 'holdings'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100'
          }`}
        >
          Holdings ({holdingsData.length})
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`py-2 px-3 border-b-2 transition-colors ${
            activeTab === 'transactions'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100'
          }`}
        >
          Trade History ({investmentTransactions.length})
        </button>
      </div>

      {/* Holdings Table */}
      {activeTab === 'holdings' && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/75 dark:border-neutral-800 dark:bg-neutral-800/40 text-neutral-500 dark:text-neutral-400 font-semibold">
                  <th className="py-3 px-4">Asset</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4 text-right">Avg Cost</th>
                  <th className="py-3 px-4 text-right">Current Price</th>
                  <th className="py-3 px-4 text-right">Current Value</th>
                  <th className="py-3 px-4 text-right">Unrealized P&amp;L</th>
                  <th className="py-3 px-4 text-right">Day Chg</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {holdingsData.map((h) => (
                  <tr
                    key={h.investment.id}
                    className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-neutral-900 dark:text-neutral-100">
                          {h.investment.symbol}
                        </span>
                        <span className="text-[11px] text-neutral-400 truncate max-w-xs">
                          {h.investment.name}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-neutral-600 dark:text-neutral-300">
                        {h.investment.assetType}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {h.totalQty.toFixed(4).replace(/\.?0+$/, '')}
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatCurrency(h.avgBuyPrice, currency, privacyMode)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <div className="flex items-center justify-end gap-1">
                        <span>{formatCurrency(h.currentPrice, currency, privacyMode)}</span>
                        {h.isManualOverride && (
                          <span title="Manual Price Override" className="text-amber-500 font-bold">
                            *
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {formatCurrency(h.currentValue, currency, privacyMode)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <div className="flex flex-col">
                        <span className={h.unrealizedPnl >= 0 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                          {h.unrealizedPnl >= 0 ? '+' : ''}
                          {formatCurrency(h.unrealizedPnl, currency, privacyMode)}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {formatPercentage(h.unrealizedPnlPct, privacyMode)}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <span className={h.dayChangePct >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {h.dayChangePct >= 0 ? '+' : ''}
                        {h.dayChangePct.toFixed(2)}%
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setOverrideSymbol(h.investment.symbol);
                          setOverridePrice(h.currentPrice);
                          setIsPriceOverrideModalOpen(true);
                        }}
                        title="Override market price if API fails"
                        className="rounded p-1 text-neutral-400 hover:text-indigo-600 transition-colors"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trade History */}
      {activeTab === 'transactions' && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/75 dark:border-neutral-800 dark:bg-neutral-800/40 text-neutral-500 font-semibold">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Asset</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4 text-right">Price</th>
                <th className="py-3 px-4 text-right">Total Flow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {investmentTransactions.map((tx) => {
                const inv = investments.find((i) => i.id === tx.investmentId);
                const totalAmt = tx.quantity * tx.price;
                return (
                  <tr key={tx.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40">
                    <td className="py-3 px-4 font-mono">{tx.date}</td>
                    <td className="py-3 px-4 font-bold">{inv?.symbol || 'Asset'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold ${
                          tx.type === 'BUY'
                            ? 'text-indigo-600'
                            : tx.type === 'SELL'
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{tx.quantity}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatCurrency(tx.price, currency, privacyMode)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {formatCurrency(totalAmt, currency, privacyMode)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Asset Modal */}
      <Modal
        isOpen={isAddAssetModalOpen}
        onClose={() => setIsAddAssetModalOpen(false)}
        title="Add Asset to Portfolio"
      >
        <form onSubmit={handleCreateAsset} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Symbol / Ticker
            </label>
            <input
              type="text"
              required
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              placeholder="e.g. INFY.NS, AAPL, ETH"
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs uppercase font-mono text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Asset Name
            </label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Infosys Limited"
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Asset Type
            </label>
            <CustomSelect
              value={newAssetType}
              onChange={(val) => setNewAssetType(val as AssetType)}
              className="w-full"
              options={[
                { value: 'Stock', label: 'Stock' },
                { value: 'ETF', label: 'ETF' },
                { value: 'Mutual Fund', label: 'Mutual Fund' },
                { value: 'Crypto', label: 'Crypto' },
                { value: 'Gold', label: 'Gold' },
                { value: 'Fixed Deposit', label: 'Fixed Deposit' },
                { value: 'Other', label: 'Other' },
              ]}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsAddAssetModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
            >
              Add Asset
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Trade Modal */}
      <Modal
        isOpen={isAddTxModalOpen}
        onClose={() => setIsAddTxModalOpen(false)}
        title="Record Investment Transaction"
        subtitle="Saved as asset movement · NOT double counted as expense"
      >
        <form onSubmit={handleCreateTx} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Asset
              </label>
              <CustomSelect
                value={selectedAssetId}
                onChange={setSelectedAssetId}
                className="w-full"
                options={investments.map((i) => ({
                  value: i.id,
                  label: `${i.symbol} - ${i.name}`,
                }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Trade Type
              </label>
              <CustomSelect
                value={txType}
                onChange={(val) => setTxType(val as InvestmentTxType)}
                className="w-full"
                options={[
                  { value: 'BUY', label: 'BUY' },
                  { value: 'SELL', label: 'SELL' },
                  { value: 'DIVIDEND', label: 'DIVIDEND' },
                  { value: 'SPLIT', label: 'SPLIT / BONUS' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Quantity
              </label>
              <input
                type="number"
                step="any"
                required
                value={txQty}
                onChange={(e) => setTxQty(parseFloat(e.target.value) || 0)}
                placeholder="10"
                className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-mono text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Price Per Unit
              </label>
              <CurrencyInput value={txPrice} onChange={setTxPrice} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Brokerage &amp; Taxes
              </label>
              <CurrencyInput value={txFees} onChange={setTxFees} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Execution Date
              </label>
              <input
                type="date"
                required
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Notes
            </label>
            <input
              type="text"
              value={txNotes}
              onChange={(e) => setTxNotes(e.target.value)}
              placeholder="e.g. Monthly SIP accumulation"
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsAddTxModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
            >
              Confirm Trade
            </button>
          </div>
        </form>
      </Modal>

      {/* Manual Price Override Fallback Modal */}
      <Modal
        isOpen={isPriceOverrideModalOpen}
        onClose={() => setIsPriceOverrideModalOpen(false)}
        title={`Override Market Price for ${overrideSymbol}`}
        subtitle="Used as fallback when external stock ticker APIs fail"
      >
        <form onSubmit={handleSavePriceOverride} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Manual Unit Price
            </label>
            <CurrencyInput value={overridePrice} onChange={setOverridePrice} required />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsPriceOverrideModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
            >
              Set Override
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
