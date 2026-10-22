import React, { useState, useMemo } from 'react';
import { Coins, ShieldCheck, Calendar, Sparkles, AlertCircle } from 'lucide-react';
import { CurrencyInput } from '../../common/CurrencyInput';
import { CustomSelect } from '../../common/CustomSelect';
import { Investment, InvestmentTransaction } from '../../../types';

interface GoldSgbFormProps {
  onSuccess: (investment: Omit<Investment, 'id'>, transaction: Omit<InvestmentTransaction, 'id' | 'createdAt'>, initialPrice: number) => void;
  onCancel: () => void;
}

export const GoldSgbForm: React.FC<GoldSgbFormProps> = ({ onSuccess, onCancel }) => {
  const [goldType, setGoldType] = useState<'Sovereign Gold Bond' | 'Gold'>('Sovereign Gold Bond');
  const [trancheName, setTrancheName] = useState('');
  const [symbolCode, setSymbolCode] = useState('');
  const [grams, setGrams] = useState<number | ''>('');
  const [pricePerGram, setPricePerGram] = useState<number | ''>('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [maturityDate, setMaturityDate] = useState('');
  const [depository, setDepository] = useState('');
  const [linkedBank, setLinkedBank] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Compute live calculations
  const totalCost = (Number(grams) || 0) * (Number(pricePerGram) || 0);
  const annualCoupon = totalCost * 0.025;
  const semiAnnualPayout = Math.round(annualCoupon / 2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (goldType === 'Sovereign Gold Bond' && !trancheName.trim()) {
      newErrors.trancheName = 'SGB Tranche or series name is required';
    }
    if (!grams || Number(grams) <= 0) {
      newErrors.grams = 'Please enter a valid weight in grams';
    }
    if (!pricePerGram || Number(pricePerGram) <= 0) {
      newErrors.pricePerGram = 'Please enter a valid price per gram';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const symbol = goldType === 'Sovereign Gold Bond' ? (symbolCode.trim() || 'SGB-SERIES') : 'GOLD-24K';
    const name = goldType === 'Sovereign Gold Bond' ? trancheName.trim() : (trancheName.trim() || `Physical / 24K Digital Gold (${grams}g)`);

    const newInvestment: Omit<Investment, 'id'> = {
      symbol: symbol.toUpperCase(),
      name,
      assetType: goldType,
      institution: 'Reserve Bank of India',
      interestRate: goldType === 'Sovereign Gold Bond' ? 2.5 : undefined,
      maturityDate: goldType === 'Sovereign Gold Bond' ? maturityDate || undefined : undefined,
      unitsOrGrams: Number(grams),
      categoryTag: goldType === 'Sovereign Gold Bond' ? 'SGB Tranche' : 'Precious Metals',
      notes: goldType === 'Sovereign Gold Bond' ? (depository.trim() || linkedBank.trim() ? `Held in: ${depository.trim()} | Coupon Bank: ${linkedBank.trim()}` : undefined) : 'Stored in safe/vault',
    };

    const newTransaction: Omit<InvestmentTransaction, 'id' | 'createdAt'> = {
      investmentId: '',
      type: 'BUY',
      quantity: Number(grams),
      price: Number(pricePerGram),
      fees: 0,
      date: issueDate,
      notes: goldType === 'Sovereign Gold Bond' ? `Subscribed to ${trancheName}` : 'Gold Purchase',
    };

    onSuccess(newInvestment, newTransaction, Number(pricePerGram));
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      {Object.keys(errors).length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Please fill in the required fields correctly before proceeding.</span>
        </div>
      )}

      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-800 dark:text-yellow-300 text-xs">
        <Coins className="h-4 w-4 shrink-0 text-yellow-600" />
        <span>Sovereign Gold Bonds offer gold appreciation + guaranteed 2.50% annual interest + 100% tax exemption upon maturity.</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Gold Asset Instrument
          </label>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-300 dark:border-neutral-700 p-0.5 bg-neutral-100 dark:bg-neutral-800">
            <button
              type="button"
              onClick={() => setGoldType('Sovereign Gold Bond')}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                goldType === 'Sovereign Gold Bond'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              SGB (RBI Bond)
            </button>
            <button
              type="button"
              onClick={() => setGoldType('Gold')}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                goldType === 'Gold'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              24K / Digital Gold
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            {goldType === 'Sovereign Gold Bond' ? 'SGB Tranche / Series *' : 'Description'}
          </label>
          <input
            type="text"
            value={trancheName}
            onChange={(e) => {
              setTrancheName(e.target.value);
              if (errors.trancheName) setErrors(prev => { const n = { ...prev }; delete n.trancheName; return n; });
            }}
            placeholder={goldType === 'Sovereign Gold Bond' ? 'e.g. SGB 2023-24 Series IV' : 'e.g. 24K Physical Bar / Tanishq'}
            className={`w-full rounded-lg border bg-white p-2 text-xs text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
              errors.trancheName ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
            }`}
          />
          {errors.trancheName && <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.trancheName}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Quantity (Grams of Gold) *
          </label>
          <input
            type="number"
            step="any"
            value={grams}
            onChange={(e) => {
              setGrams(parseFloat(e.target.value) || '');
              if (errors.grams) setErrors(prev => { const n = { ...prev }; delete n.grams; return n; });
            }}
            placeholder="e.g. 10"
            className={`w-full rounded-lg border bg-white p-2 text-xs font-mono font-bold text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
              errors.grams ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
            }`}
          />
          {errors.grams && <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.grams}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Issue / Purchase Price Per Gram *
          </label>
          <CurrencyInput
            value={pricePerGram}
            onChange={(val) => {
              setPricePerGram(val);
              if (errors.pricePerGram) setErrors(prev => { const n = { ...prev }; delete n.pricePerGram; return n; });
            }}
            hasError={!!errors.pricePerGram}
          />
          {errors.pricePerGram && <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.pricePerGram}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Ticker Symbol / NSE Code
          </label>
          <input
            type="text"
            value={symbolCode}
            onChange={(e) => setSymbolCode(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-mono uppercase text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>
      </div>

      {goldType === 'Sovereign Gold Bond' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Allotment / Issue Date *
            </label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => {
                setIssueDate(e.target.value);
                // 8 years maturity
                const d = new Date(e.target.value);
                d.setFullYear(d.getFullYear() + 8);
                setMaturityDate(d.toISOString().split('T')[0]);
              }}
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-mono text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              8-Year RBI Maturity Date
            </label>
            <input
              type="date"
              value={maturityDate}
              onChange={(e) => setMaturityDate(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-mono text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Holding Mode (Demat / Cert)
            </label>
            <input
              type="text"
              value={depository}
              onChange={(e) => setDepository(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>
      )}

      {/* SGB Coupon Calculation Card */}
      {goldType === 'Sovereign Gold Bond' && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-600" />
              RBI 2.50% Coupon Payout Schedule
            </span>
            <span>Semi-Annual Distribution</span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-amber-500/20 text-xs">
            <div>
              <span className="text-neutral-500 dark:text-neutral-400 block text-[11px]">Total Subscription</span>
              <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                ₹{totalCost.toLocaleString('en-IN')}
              </span>
            </div>

            <div>
              <span className="text-neutral-500 dark:text-neutral-400 block text-[11px]">Annual Interest (2.5%)</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                +₹{Math.round(annualCoupon).toLocaleString('en-IN')}/yr
              </span>
            </div>

            <div className="text-right">
              <span className="text-neutral-500 dark:text-neutral-400 block text-[11px]">Per 6-Month Payout</span>
              <span className="font-mono font-bold text-amber-700 dark:text-amber-300 text-sm">
                ₹{semiAnnualPayout.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      )}

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
          className="rounded-xl bg-amber-600 px-5 py-2 text-xs font-semibold text-white hover:bg-amber-500 shadow-xs transition-colors"
        >
          Add {goldType === 'Sovereign Gold Bond' ? 'SGB Position' : 'Gold Holding'}
        </button>
      </div>
    </form>
  );
};
