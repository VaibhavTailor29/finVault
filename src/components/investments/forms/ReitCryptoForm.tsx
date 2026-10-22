import React, { useState } from 'react';
import { Building2, Boxes, AlertCircle } from 'lucide-react';
import { CurrencyInput } from '../../common/CurrencyInput';
import { CustomSelect } from '../../common/CustomSelect';
import { Investment, InvestmentTransaction, AssetType } from '../../../types';

interface ReitCryptoFormProps {
  initialType?: 'REIT' | 'Crypto';
  onSuccess: (investment: Omit<Investment, 'id'>, transaction: Omit<InvestmentTransaction, 'id' | 'createdAt'>, initialPrice: number) => void;
  onCancel: () => void;
}

export const ReitCryptoForm: React.FC<ReitCryptoFormProps> = ({ initialType = 'REIT', onSuccess, onCancel }) => {
  const [assetType, setAssetType] = useState<AssetType>(initialType);
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [distributionYield, setDistributionYield] = useState<number | ''>('');
  const [custodyOrExchange, setCustodyOrExchange] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalCost = (Number(quantity) || 0) * (Number(unitPrice) || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!symbol.trim()) {
      newErrors.symbol = 'Ticker or symbol is required';
    }
    if (!name.trim()) {
      newErrors.name = 'Full name is required';
    }
    if (quantity === '' || Number(quantity) <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    }
    if (unitPrice === '' || Number(unitPrice) <= 0) {
      newErrors.unitPrice = 'Unit price must be greater than 0';
    }
    if (assetType === 'Crypto' && !purchaseDate) {
      newErrors.purchaseDate = 'Purchase date is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const newInvestment: Omit<Investment, 'id'> = {
      symbol: symbol.trim().toUpperCase(),
      name: name.trim(),
      assetType,
      institution: custodyOrExchange.trim() || undefined,
      interestRate: assetType === 'REIT' && distributionYield !== '' ? Number(distributionYield) : undefined,
      payoutFrequency: assetType === 'REIT' ? 'Quarterly' : undefined,
      unitsOrGrams: Number(quantity),
      notes: custodyOrExchange ? `Custody/Platform: ${custodyOrExchange}` : undefined,
    };

    const newTransaction: Omit<InvestmentTransaction, 'id' | 'createdAt'> = {
      investmentId: '',
      type: 'BUY',
      quantity: Number(quantity),
      price: Number(unitPrice),
      fees: 0,
      date: purchaseDate,
      notes: `Purchased ${quantity} units of ${symbol}`,
    };

    onSuccess(newInvestment, newTransaction, Number(unitPrice));
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      {Object.keys(errors).length > 0 && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Please fill in all required fields marked below.</span>
        </div>
      )}

      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-800 dark:text-pink-300 text-xs">
        {assetType === 'REIT' ? (
          <>
            <Building2 className="h-4 w-4 shrink-0 text-pink-600" />
            <span>Commercial Real Estate Investment Trusts provide regular quarterly rental distributions and commercial property ownership.</span>
          </>
        ) : (
          <>
            <Boxes className="h-4 w-4 shrink-0 text-orange-600" />
            <span>Track high-conviction digital assets and non-correlated alternative investments with on-chain or cold storage records.</span>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Asset Class
          </label>
          <CustomSelect
            value={assetType}
            onChange={(val) => {
              setAssetType(val as AssetType);
            }}
            className="w-full"
            options={[
              { value: 'REIT', label: 'REIT (Real Estate Investment Trust)' },
              { value: 'Crypto', label: 'Cryptocurrency (Digital Assets)' },
            ]}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Ticker / Symbol *
          </label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value.toUpperCase());
              if (errors.symbol) setErrors((prev) => ({ ...prev, symbol: '' }));
            }}
            placeholder="e.g. EMBASSY, BTC"
            className={`w-full rounded-lg border p-2 text-xs font-mono font-bold uppercase text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
              errors.symbol
                ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20'
                : 'border-neutral-300 dark:border-neutral-700'
            }`}
          />
          {errors.symbol && <p className="text-[11px] text-rose-500 font-medium mt-1">{errors.symbol}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Full Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
            }}
            placeholder="e.g. Embassy Office Parks REIT"
            className={`w-full rounded-lg border p-2 text-xs text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
              errors.name
                ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20'
                : 'border-neutral-300 dark:border-neutral-700'
            }`}
          />
          {errors.name && <p className="text-[11px] text-rose-500 font-medium mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Custody / Exchange / Broker
          </label>
          <input
            type="text"
            value={custodyOrExchange}
            onChange={(e) => setCustodyOrExchange(e.target.value)}
            placeholder="e.g. Zerodha, Hardware Wallet"
            className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Quantity (Units / Tokens) *
          </label>
          <input
            type="number"
            step="any"
            value={quantity}
            onChange={(e) => {
              setQuantity(parseFloat(e.target.value) || '');
              if (errors.quantity) setErrors((prev) => ({ ...prev, quantity: '' }));
            }}
            placeholder="0.00"
            className={`w-full rounded-lg border p-2 text-xs font-mono text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
              errors.quantity
                ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20'
                : 'border-neutral-300 dark:border-neutral-700'
            }`}
          />
          {errors.quantity && <p className="text-[11px] text-rose-500 font-medium mt-1">{errors.quantity}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Unit Price / Cost Basis *
          </label>
          <CurrencyInput
            value={unitPrice}
            onChange={(v) => {
              setUnitPrice(v);
              if (errors.unitPrice) setErrors((prev) => ({ ...prev, unitPrice: '' }));
            }}
            hasError={Boolean(errors.unitPrice)}
          />
          {errors.unitPrice && <p className="text-[11px] text-rose-500 font-medium mt-1">{errors.unitPrice}</p>}
        </div>

        {assetType === 'REIT' ? (
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Distribution Yield (% p.a.)
            </label>
            <input
              type="number"
              step="0.1"
              value={distributionYield}
              onChange={(e) => setDistributionYield(parseFloat(e.target.value) || '')}
              placeholder="e.g. 7.2"
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-mono text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Purchase Date *
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => {
                setPurchaseDate(e.target.value);
                if (errors.purchaseDate) setErrors((prev) => ({ ...prev, purchaseDate: '' }));
              }}
              className={`w-full rounded-lg border p-2 text-xs font-mono text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
                errors.purchaseDate
                  ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20'
                  : 'border-neutral-300 dark:border-neutral-700'
              }`}
            />
            {errors.purchaseDate && <p className="text-[11px] text-rose-500 font-medium mt-1">{errors.purchaseDate}</p>}
          </div>
        )}
      </div>

      <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between text-xs">
        <span className="text-neutral-500 font-medium">Total Position Size:</span>
        <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 text-sm">
          ₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
          className="rounded-xl bg-pink-600 px-5 py-2 text-xs font-semibold text-white hover:bg-pink-500 shadow-xs transition-colors"
        >
          Add {assetType === 'REIT' ? 'REIT Investment' : 'Crypto Asset'}
        </button>
      </div>
    </form>
  );
};
