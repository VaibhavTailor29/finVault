import React, { useState } from 'react';
import { TrendingUp, AlertCircle } from 'lucide-react';
import { CurrencyInput } from '../../common/CurrencyInput';
import { CustomSelect } from '../../common/CustomSelect';
import { Investment, InvestmentTransaction, AssetType } from '../../../types';

interface StockFormProps {
  onSuccess: (investment: Omit<Investment, 'id'>, transaction: Omit<InvestmentTransaction, 'id' | 'createdAt'>, initialPrice: number) => void;
  onCancel: () => void;
}

export const StockForm: React.FC<StockFormProps> = ({ onSuccess, onCancel }) => {
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [exchange, setExchange] = useState('NSE');
  const [assetType, setAssetType] = useState<AssetType>('Stock');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [buyPrice, setBuyPrice] = useState<number | ''>('');
  const [brokerage, setBrokerage] = useState<number | ''>('');
  const [brokerName, setBrokerName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalInvestment = (Number(quantity) || 0) * (Number(buyPrice) || 0) + (Number(brokerage) || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!symbol.trim()) {
      newErrors.symbol = 'Stock symbol / ticker is required';
    }
    if (!name.trim()) {
      newErrors.name = 'Company / ETF name is required';
    }
    if (quantity === '' || Number(quantity) <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    }
    if (buyPrice === '' || Number(buyPrice) <= 0) {
      newErrors.buyPrice = 'Purchase price must be greater than 0';
    }
    if (!purchaseDate) {
      newErrors.purchaseDate = 'Purchase date is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const fullSymbol = exchange ? `${symbol.trim().toUpperCase()}.${exchange}` : symbol.trim().toUpperCase();

    const newInvestment: Omit<Investment, 'id'> = {
      symbol: fullSymbol,
      name: name.trim(),
      assetType,
      institution: brokerName.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    const newTransaction: Omit<InvestmentTransaction, 'id' | 'createdAt'> = {
      investmentId: '', // Will be assigned by manager
      type: 'BUY',
      quantity: Number(quantity),
      price: Number(buyPrice),
      fees: Number(brokerage) || 0,
      date: purchaseDate,
      notes: brokerName.trim() ? `Purchased via ${brokerName.trim()} on ${exchange}` : undefined,
    };

    onSuccess(newInvestment, newTransaction, Number(buyPrice));
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      {Object.keys(errors).length > 0 && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Please fill in all required fields marked below.</span>
        </div>
      )}

      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs">
        <TrendingUp className="h-4 w-4 shrink-0" />
        <span>Add equities and ETFs with real-time ticker tracking, exchange routing, and cost basis.</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Stock Symbol / Ticker *
          </label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value.toUpperCase());
              if (errors.symbol) setErrors(prev => ({ ...prev, symbol: '' }));
            }}
            className={`w-full rounded-lg border bg-white p-2 text-xs font-mono font-bold text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 uppercase ${
              errors.symbol ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
            }`}
          />
          {errors.symbol && (
            <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.symbol}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Exchange
          </label>
          <CustomSelect
            value={exchange}
            onChange={setExchange}
            className="w-full"
            options={[
              { value: 'NSE', label: 'NSE (India)' },
              { value: 'BSE', label: 'BSE (India)' },
              { value: 'NASDAQ', label: 'NASDAQ (US)' },
              { value: 'NYSE', label: 'NYSE (US)' },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Company / ETF Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
            }}
            className={`w-full rounded-lg border bg-white p-2 text-xs text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
              errors.name ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
            }`}
          />
          {errors.name && (
            <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.name}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Instrument Type
          </label>
          <CustomSelect
            value={assetType}
            onChange={(val) => setAssetType(val as AssetType)}
            className="w-full"
            options={[
              { value: 'Stock', label: 'Direct Stock (Equities)' },
              { value: 'ETF', label: 'Exchange Traded Fund (ETF)' },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Quantity (Shares / Units) *
          </label>
          <input
            type="number"
            step="any"
            value={quantity}
            onChange={(e) => {
              setQuantity(parseFloat(e.target.value) || '');
              if (errors.quantity) setErrors(prev => ({ ...prev, quantity: '' }));
            }}
            className={`w-full rounded-lg border bg-white p-2 text-xs font-mono text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
              errors.quantity ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
            }`}
          />
          {errors.quantity && (
            <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.quantity}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Purchase Price per Share *
          </label>
          <CurrencyInput
            value={buyPrice}
            onChange={(val) => {
              setBuyPrice(val);
              if (errors.buyPrice) setErrors(prev => ({ ...prev, buyPrice: '' }));
            }}
            hasError={!!errors.buyPrice}
          />
          {errors.buyPrice && (
            <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.buyPrice}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Broker / Platform
          </label>
          <input
            type="text"
            value={brokerName}
            onChange={(e) => setBrokerName(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Brokerage &amp; STT / Taxes
          </label>
          <CurrencyInput value={brokerage} onChange={setBrokerage} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Purchase Date *
          </label>
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => {
              setPurchaseDate(e.target.value);
              if (errors.purchaseDate) setErrors(prev => ({ ...prev, purchaseDate: '' }));
            }}
            className={`w-full rounded-lg border bg-white p-2 text-xs font-mono text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
              errors.purchaseDate ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
            }`}
          />
          {errors.purchaseDate && (
            <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.purchaseDate}</p>
          )}
        </div>
      </div>

      {/* Live Investment Summary */}
      <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between text-xs">
        <span className="text-neutral-600 dark:text-neutral-400 font-medium">Calculated Outflow:</span>
        <span className="font-mono font-bold text-sm text-neutral-900 dark:text-neutral-100">
          ₹{totalInvestment.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 shadow-xs transition-colors"
        >
          Add Stock Position
        </button>
      </div>
    </form>
  );
};
