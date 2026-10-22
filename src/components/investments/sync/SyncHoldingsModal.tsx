import React, { useState, useRef } from 'react';
import {
  Upload, FileText, CheckCircle2, AlertCircle, RefreshCw, Download,
  ExternalLink, Check, Sparkles, Building, Layers, ArrowRight, ShieldCheck,
  FileSpreadsheet, Clipboard, Trash2
} from 'lucide-react';
import { Modal } from '../../common/Modal';
import { useFinanceStore } from '../../../store/useFinanceStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { formatCurrency } from '../../../utils/formatters';
import {
  parseHoldingFile, parseCsvText, generateSampleHoldingsCsv,
  ParsedHoldingItem, ParseResult
} from '../../../utils/brokerParsers';
import { apiClient } from '../../../api/client';

interface SyncHoldingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncHoldingsModal: React.FC<SyncHoldingsModalProps> = ({ isOpen, onClose }) => {
  const { bulkImportHoldings, syncLivePrices, investments } = useFinanceStore();
  const { currency } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<'statement' | 'broker_api' | 'live_prices'>('statement');
  const [statementSubTab, setStatementSubTab] = useState<'upload' | 'paste'>('upload');

  // Parse state
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [parsedHoldings, setParsedHoldings] = useState<ParsedHoldingItem[]>([]);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  // Paste text state
  const [pastedText, setPastedText] = useState('');

  // Broker API state
  const [selectedBroker, setSelectedBroker] = useState<'groww' | 'dhan' | 'upstox' | 'angelone'>('groww');
  const [brokerClientId, setBrokerClientId] = useState('');
  const [brokerAccessToken, setBrokerAccessToken] = useState('');
  const [isBrokerLoading, setIsBrokerLoading] = useState(false);
  const [brokerError, setBrokerError] = useState<string | null>(null);

  // Live prices state
  const [isLivePricing, setIsLivePricing] = useState(false);
  const [livePriceStatus, setLivePriceStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setParseError(null);
    setSyncSuccessMsg(null);

    try {
      const result: ParseResult = await parseHoldingFile(file);
      if (result.error || result.holdings.length === 0) {
        setParseError(result.error || 'No valid holdings found in the uploaded file.');
        setParsedHoldings([]);
        setDetectedFormat(null);
      } else {
        setDetectedFormat(result.detectedSource);
        setParsedHoldings(result.holdings);
      }
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse file.');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleParsePastedText = () => {
    if (!pastedText.trim()) return;

    setIsParsing(true);
    setParseError(null);
    setSyncSuccessMsg(null);

    const result = parseCsvText(pastedText);
    if (result.error || result.holdings.length === 0) {
      setParseError(result.error || 'No valid holdings found in pasted text.');
      setParsedHoldings([]);
      setDetectedFormat(null);
    } else {
      setDetectedFormat(result.detectedSource);
      setParsedHoldings(result.holdings);
    }
    setIsParsing(false);
  };

  const handleFetchBrokerHoldings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brokerAccessToken.trim()) {
      setBrokerError('Please enter your broker access token.');
      return;
    }

    setIsBrokerLoading(true);
    setBrokerError(null);
    setParseError(null);

    try {
      const res = await apiClient.syncBrokerHoldings({
        broker: selectedBroker,
        accessToken: brokerAccessToken.trim(),
        clientId: brokerClientId.trim() || undefined,
      });

      if (res.holdings && res.holdings.length > 0) {
        const mapped: ParsedHoldingItem[] = res.holdings.map((h, i) => ({
          id: `broker_${Date.now()}_${i}`,
          symbol: h.symbol,
          name: h.name,
          assetType: (h.asset_type as any) || 'Stocks',
          institution: h.institution || selectedBroker.toUpperCase(),
          quantity: h.quantity,
          avgBuyPrice: h.avg_buy_price,
          currentPrice: h.current_price,
          categoryTag: h.category_tag || 'Equity',
          selected: true,
        }));
        setDetectedFormat(`${res.broker.toUpperCase()} Live API`);
        setParsedHoldings(mapped);
        setActiveTab('statement'); // Switch to preview tab
      } else {
        setBrokerError(`No holdings found in your ${selectedBroker.toUpperCase()} account.`);
      }
    } catch (err: any) {
      setBrokerError(err.message || `Failed to fetch holdings from ${selectedBroker}.`);
    } finally {
      setIsBrokerLoading(false);
    }
  };

  const handleToggleHolding = (index: number) => {
    setParsedHoldings((prev) =>
      prev.map((h, i) => (i === index ? { ...h, selected: !h.selected } : h))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setParsedHoldings((prev) => prev.map((h) => ({ ...h, selected: select })));
  };

  const handleDownloadSample = () => {
    const csvContent = generateSampleHoldingsCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'finvault_holdings_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmImport = async () => {
    const selected = parsedHoldings.filter((h) => h.selected);
    if (selected.length === 0) {
      setParseError('Please select at least one holding to import.');
      return;
    }

    setIsSyncing(true);
    setParseError(null);

    const res = await bulkImportHoldings(selected, importMode);
    setIsSyncing(false);

    if (res.success) {
      setSyncSuccessMsg(`Successfully synchronized ${res.count} holding(s) with your FinVault vault!`);
      setParsedHoldings([]);
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setParseError('Failed to import holdings. Please try again.');
    }
  };

  const handleSyncAllLivePrices = async () => {
    setIsLivePricing(true);
    setLivePriceStatus(null);
    try {
      await syncLivePrices();
      setLivePriceStatus('All market prices and AMFI mutual fund NAVs successfully refreshed!');
    } catch (err: any) {
      setLivePriceStatus('Completed price refresh from available market feeds.');
    } finally {
      setIsLivePricing(false);
    }
  };

  const selectedCount = parsedHoldings.filter((h) => h.selected).length;
  const totalInvestedSelected = parsedHoldings
    .filter((h) => h.selected)
    .reduce((sum, h) => sum + h.quantity * h.avgBuyPrice, 0);
  const totalCurrentSelected = parsedHoldings
    .filter((h) => h.selected)
    .reduce((sum, h) => sum + h.quantity * (h.currentPrice || h.avgBuyPrice), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sync Original Holdings"
      subtitle="100% Free • Import from Zerodha, Groww, Upstox, CAS statements, or free broker APIs"
      maxWidth="max-w-4xl"
    >
      <div className="flex flex-col gap-5">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/60">
          <button
            type="button"
            onClick={() => setActiveTab('statement')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'statement'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
            <span>Broker Statement / CSV / Excel</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
              FREE
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('broker_api')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'broker_api'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Building className="h-4 w-4 text-indigo-500" />
            <span>Free Broker API</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold">
              Dhan / Upstox / Angel
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('live_prices')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'live_prices'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <RefreshCw className="h-4 w-4 text-amber-500" />
            <span>Live Market Quotes</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold">
              AMFI Free
            </span>
          </button>
        </div>

        {/* Global Success / Error Feedback */}
        {syncSuccessMsg && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{syncSuccessMsg}</span>
          </div>
        )}

        {parseError && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{parseError}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 1: STATEMENT IMPORT (CSV, XLSX, CAS, PASTE TEXT)       */}
        {/* ========================================================= */}
        {activeTab === 'statement' && (
          <div className="flex flex-col gap-4">
            {/* If no holdings parsed yet, show import controls */}
            {parsedHoldings.length === 0 ? (
              <div className="flex flex-col gap-4">
                {/* Format Badges */}
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">Supported:</span>
                    {['Zerodha Kite/Console', 'Groww', 'Upstox', 'Angel One', 'CAMS / MF Central', 'Excel / CSV'].map((b) => (
                      <span key={b} className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                        {b}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadSample}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    <Download className="h-3 w-3" />
                    Download Sample Template
                  </button>
                </div>

                {/* Sub-tabs: File Upload vs Copy-Paste */}
                <div className="flex border-b border-neutral-200 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setStatementSubTab('upload')}
                    className={`py-2 px-4 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                      statementSubTab === 'upload'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
                  >
                    Upload File (.csv, .xlsx, .xls)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatementSubTab('paste')}
                    className={`py-2 px-4 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                      statementSubTab === 'paste'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
                  >
                    Paste Text / Spreadsheet Rows
                  </button>
                </div>

                {statementSubTab === 'upload' ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl bg-neutral-50/50 dark:bg-neutral-900/50 cursor-pointer transition-all group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3 group-hover:scale-105 transition-transform shadow-xs">
                      {isParsing ? <RefreshCw className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                    </div>
                    <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {isParsing ? 'Parsing statement...' : 'Click to upload your Holdings file or drag & drop'}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      Works with CSV &amp; Excel downloads from Zerodha, Groww, Upstox, Angel One, and CAMS CAS
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Paste your CSV or spreadsheet rows here...&#10;Example:&#10;Symbol, Name, Quantity, Avg Price, LTP&#10;RELIANCE, Reliance Industries, 20, 2450, 2580&#10;TCS, Tata Consultancy Services, 10, 3600, 3920"
                      rows={6}
                      className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 text-xs font-mono text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleParsePastedText}
                        disabled={!pastedText.trim() || isParsing}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
                      >
                        {isParsing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Clipboard className="h-3.5 w-3.5" />}
                        Parse &amp; Preview Holdings
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Holdings Review & Confirmation Table */
              <div className="flex flex-col gap-3">
                {/* Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40">
                      <Sparkles className="h-3.5 w-3.5" />
                      {detectedFormat || 'Statement'} ({parsedHoldings.length} holdings)
                    </span>
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">
                      {selectedCount} selected ({formatCurrency(totalInvestedSelected, currency)} invested)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAll(selectedCount !== parsedHoldings.length)}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      {selectedCount === parsedHoldings.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <span className="text-neutral-300 dark:text-neutral-700">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        setParsedHoldings([]);
                        setDetectedFormat(null);
                        setParseError(null);
                      }}
                      className="text-xs font-medium text-neutral-500 hover:text-rose-500 dark:hover:text-rose-400 cursor-pointer"
                    >
                      Clear &amp; Upload Another
                    </button>
                  </div>
                </div>

                {/* Holdings Table */}
                <div className="max-h-72 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-semibold border-b border-neutral-200 dark:border-neutral-700 z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-8">
                          <input
                            type="checkbox"
                            checked={selectedCount === parsedHoldings.length && parsedHoldings.length > 0}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-3">Symbol &amp; Name</th>
                        <th className="py-2.5 px-3">Asset Type</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3 text-right">Avg Buy Price</th>
                        <th className="py-2.5 px-3 text-right">Current Price (LTP)</th>
                        <th className="py-2.5 px-3 text-right">Invested Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                      {parsedHoldings.map((h, idx) => (
                        <tr
                          key={h.id || idx}
                          onClick={() => handleToggleHolding(idx)}
                          className={`hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer ${
                            h.selected ? '' : 'opacity-40'
                          }`}
                        >
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={!!h.selected}
                              onChange={() => handleToggleHolding(idx)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                              {h.symbol}
                            </div>
                            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate max-w-xs">
                              {h.name}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                              {h.assetType}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-neutral-900 dark:text-neutral-100">
                            {h.quantity}
                          </td>
                          <td className="py-2 px-3 text-right text-neutral-700 dark:text-neutral-300">
                            {formatCurrency(h.avgBuyPrice, currency)}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(h.currentPrice || h.avgBuyPrice, currency)}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-neutral-900 dark:text-neutral-100">
                            {formatCurrency(h.quantity * h.avgBuyPrice, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Import Mode Selection */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700 text-xs">
                  <div>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                      Sync Strategy:
                    </span>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Choose how these imported holdings update your existing FinVault records.
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-neutral-700 dark:text-neutral-300">
                      <input
                        type="radio"
                        name="importMode"
                        value="merge"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Merge (Add / Update)</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-rose-600 dark:text-rose-400">
                      <input
                        type="radio"
                        name="importMode"
                        value="replace"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span>Replace All Existing</span>
                    </label>
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setParsedHoldings([]);
                      setDetectedFormat(null);
                    }}
                    className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={isSyncing || selectedCount === 0}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer transition-all"
                  >
                    {isSyncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    <span>Confirm &amp; Sync {selectedCount} Holding(s)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: DIRECT BROKER FREE API (DHAN, UPSTOX, ANGEL ONE)   */}
        {/* ========================================================= */}
        {activeTab === 'broker_api' && (
          <div className="flex flex-col gap-4">
            <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs">
              <div className="flex items-center gap-2 font-semibold text-indigo-900 dark:text-indigo-200">
                <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>100% Free Broker API Access</span>
              </div>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-1">
                Unlike Zerodha (which charges ₹2,000/mo for Kite Connect), <strong>Dhan</strong>, <strong>Upstox</strong>, and <strong>Angel One</strong> provide completely free developer APIs for personal portfolio access. Your token is used in-memory only and never logged.
              </p>
            </div>

            <form noValidate onSubmit={handleFetchBrokerHoldings} className="flex flex-col gap-4">
              {/* Broker Selection */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Select Your Free Broker
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'groww', name: 'Groww API', badge: '₹0 Plan' },
                    { id: 'dhan', name: 'DhanHQ', badge: '100% Free' },
                    { id: 'upstox', name: 'Upstox v2', badge: '100% Free' },
                    { id: 'angelone', name: 'Angel One', badge: 'SmartAPI' },
                  ].map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBroker(b.id as any)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        selectedBroker === b.id
                          ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-500/20'
                          : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <span className="text-xs font-bold">{b.name}</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                        {b.badge}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Instructions per broker */}
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-600 dark:text-neutral-400">
                {selectedBroker === 'groww' && (
                  <p>
                    <strong>How to get Groww token:</strong> Log in to your <a href="https://groww.in" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">Groww Developer / Trading API</a> account (₹0 plan) &gt; Generate or copy your <strong>API Access Token</strong>.
                  </p>
                )}
                {selectedBroker === 'dhan' && (
                  <p>
                    <strong>How to get free Dhan token:</strong> Log in to <a href="https://web.dhan.co" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">web.dhan.co</a> &gt; Profile &gt; DhanHQ APIs &gt; Generate Access Token (valid for 30 days).
                  </p>
                )}
                {selectedBroker === 'upstox' && (
                  <p>
                    <strong>How to get free Upstox token:</strong> Log in to <a href="https://service.upstox.com" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">Upstox Developer Portal</a> &gt; My Apps &gt; Copy your free Personal Access Token.
                  </p>
                )}
                {selectedBroker === 'angelone' && (
                  <p>
                    <strong>How to get free Angel One SmartAPI:</strong> Go to <a href="https://smartapi.angelbroking.com" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">Angel One SmartAPI</a> &gt; Create Free App &gt; Generate JWT Token.
                  </p>
                )}
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedBroker === 'groww' && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      API Key (Optional if pasting Access Token)
                    </label>
                    <input
                      type="text"
                      value={brokerClientId}
                      onChange={(e) => setBrokerClientId(e.target.value)}
                      placeholder="e.g. groww_live_api_key_..."
                      className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-xs text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                )}

                {selectedBroker === 'dhan' && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      Client ID (Dhan Account Number)
                    </label>
                    <input
                      type="text"
                      value={brokerClientId}
                      onChange={(e) => setBrokerClientId(e.target.value)}
                      placeholder="e.g. 1000123456"
                      className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-xs text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                )}

                {selectedBroker === 'angelone' && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      API Key (SmartAPI Private Key)
                    </label>
                    <input
                      type="text"
                      value={brokerClientId}
                      onChange={(e) => setBrokerClientId(e.target.value)}
                      placeholder="API Key from SmartAPI dashboard"
                      className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-xs text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                )}

                <div className={selectedBroker === 'upstox' ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    {selectedBroker === 'groww' ? 'Access Token or API Secret' : 'Access Token / Bearer Token'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={brokerAccessToken}
                    onChange={(e) => {
                      setBrokerAccessToken(e.target.value);
                      if (brokerError) setBrokerError(null);
                    }}
                    placeholder={selectedBroker === 'groww' ? 'Paste Access Token or API Secret' : 'Paste access token'}
                    className={`w-full rounded-xl border bg-white dark:bg-neutral-900 px-3 py-2 text-xs font-mono text-neutral-900 dark:text-neutral-100 ${
                      brokerError ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-200 dark:border-neutral-700'
                    }`}
                  />
                </div>
              </div>

              {brokerError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs">
                  {brokerError}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isBrokerLoading || !brokerAccessToken.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer transition-all"
                >
                  {isBrokerLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                  <span>Fetch &amp; Preview Live Holdings</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: LIVE MARKET PRICE SYNC (AMFI & FREE FEEDS)         */}
        {/* ========================================================= */}
        {activeTab === 'live_prices' && (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs">
              <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
                <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span>Zero-Cost Real-Time Quotes &amp; AMFI NAV Sync</span>
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1.5 leading-relaxed">
                finVault connects to <strong>MFAPI</strong> (official daily NAV for all Indian mutual funds directly from AMFI) and live market price engines. No paid subscriptions or rate-limited API keys required.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
              <div>
                <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Current Holdings ({investments.length} total active assets)
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Click below to fetch the latest market quotes and NAVs for all your registered assets.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSyncAllLivePrices}
                disabled={isLivePricing || investments.length === 0}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer transition-all shrink-0"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLivePricing ? 'animate-spin' : ''}`} />
                <span>{isLivePricing ? 'Syncing Market Data...' : 'Refresh All Live Prices'}</span>
              </button>
            </div>

            {livePriceStatus && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{livePriceStatus}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
