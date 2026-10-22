import React, { useState } from 'react';
import { ShieldCheck, Calendar, DollarSign, Award, AlertCircle } from 'lucide-react';
import { CurrencyInput } from '../../common/CurrencyInput';
import { CustomSelect } from '../../common/CustomSelect';
import { Investment, InvestmentTransaction, AssetType } from '../../../types';

interface BondFormProps {
  onSuccess: (investment: Omit<Investment, 'id'>, transaction: Omit<InvestmentTransaction, 'id' | 'createdAt'>, initialPrice: number) => void;
  onCancel: () => void;
}

export const BondForm: React.FC<BondFormProps> = ({ onSuccess, onCancel }) => {
  const [bondType, setBondType] = useState<AssetType>('Government Bond');
  const [issuer, setIssuer] = useState('');
  const [symbolCode, setSymbolCode] = useState('');
  const [faceValue, setFaceValue] = useState<number | ''>('');
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [units, setUnits] = useState<number | ''>('');
  const [couponRate, setCouponRate] = useState<number | ''>('');
  const [payoutFreq, setPayoutFreq] = useState<'Semi-Annual' | 'Annual' | 'Monthly' | 'Quarterly'>('Semi-Annual');
  const [creditRating, setCreditRating] = useState('SOVEREIGN');
  const [maturityDate, setMaturityDate] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [isTaxFree, setIsTaxFree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalInvestment = (Number(units) || 0) * (Number(unitPrice) || 0);
  const totalFaceValue = (Number(units) || 0) * (Number(faceValue) || 100);
  const annualCouponAmt = Math.round(totalFaceValue * ((Number(couponRate) || 0) / 100));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!issuer.trim()) {
      newErrors.issuer = 'Issuer or institution name is required';
    }
    if (!symbolCode.trim()) {
      newErrors.symbolCode = 'Ticker or ISIN symbol is required';
    }
    if (couponRate === '' || Number(couponRate) < 0) {
      newErrors.couponRate = 'Please enter a valid coupon rate';
    }
    if (!units || Number(units) <= 0) {
      newErrors.units = 'Please enter a valid number of units';
    }
    if (!unitPrice || Number(unitPrice) <= 0) {
      newErrors.unitPrice = 'Please enter purchase price per bond';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const symbol = symbolCode.trim().toUpperCase();

    const newInvestment: Omit<Investment, 'id'> = {
      symbol,
      name: `${issuer.trim()} ${couponRate}% ${bondType}`,
      assetType: bondType,
      institution: issuer.trim(),
      interestRate: Number(couponRate),
      maturityDate: maturityDate || undefined,
      creditRating,
      payoutFrequency: payoutFreq,
      taxSection: isTaxFree ? 'Tax-Free' : undefined,
      notes: `Credit Rating: ${creditRating} | Face Value: ₹${faceValue}`,
    };

    const newTransaction: Omit<InvestmentTransaction, 'id' | 'createdAt'> = {
      investmentId: '',
      type: 'BUY',
      quantity: Number(units),
      price: Number(unitPrice),
      fees: 0,
      date: purchaseDate,
      notes: `Bought ${units} units of ${symbol}`,
    };

    onSuccess(newInvestment, newTransaction, Number(unitPrice));
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      {Object.keys(errors).length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Please fill in the required fields correctly before proceeding.</span>
        </div>
      )}

      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-800 dark:text-cyan-300 text-xs">
        <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-600" />
        <span>Fixed-income securities, sovereign debt, and corporate debentures with guaranteed periodic coupon cash flows.</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Security Classification
          </label>
          <CustomSelect
            value={bondType}
            onChange={(val) => {
              setBondType(val as AssetType);
              if (val === 'Government Bond') {
                setCreditRating('SOVEREIGN');
              } else {
                setCreditRating('AAA');
              }
            }}
            className="w-full"
            options={[
              { value: 'Government Bond', label: 'Government Security (G-Sec / SDL)' },
              { value: 'Corporate Bond', label: 'Corporate Bond / Debenture (NCD)' },
            ]}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Issuer / Institution *
          </label>
          <input
            type="text"
            value={issuer}
            onChange={(e) => {
              setIssuer(e.target.value);
              if (errors.issuer) setErrors(prev => { const n = { ...prev }; delete n.issuer; return n; });
            }}
            placeholder="e.g. Government of India, HDFC"
            className={`w-full rounded-lg border bg-white p-2 text-xs text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
              errors.issuer ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
            }`}
          />
          {errors.issuer && <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.issuer}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Ticker / ISIN Symbol *
          </label>
          <input
            type="text"
            value={symbolCode}
            onChange={(e) => {
              setSymbolCode(e.target.value.toUpperCase());
              if (errors.symbolCode) setErrors(prev => { const n = { ...prev }; delete n.symbolCode; return n; });
            }}
            placeholder="e.g. IN0020230085"
            className={`w-full rounded-lg border bg-white p-2 text-xs font-mono uppercase text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
              errors.symbolCode ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
            }`}
          />
          {errors.symbolCode && <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.symbolCode}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Coupon Rate (% p.a.) *
          </label>
          <input
            type="number"
            step="0.01"
            value={couponRate}
            onChange={(e) => {
              setCouponRate(parseFloat(e.target.value) || '');
              if (errors.couponRate) setErrors(prev => { const n = { ...prev }; delete n.couponRate; return n; });
            }}
            placeholder="e.g. 7.18"
            className={`w-full rounded-lg border bg-white p-2 text-xs font-mono font-bold text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
              errors.couponRate ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
            }`}
          />
          {errors.couponRate && <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.couponRate}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Credit Rating
          </label>
          <CustomSelect
            value={creditRating}
            onChange={setCreditRating}
            className="w-full"
            options={[
              { value: 'SOVEREIGN', label: 'SOVEREIGN (Govt Backed)' },
              { value: 'AAA', label: 'CRISIL / ICRA AAA (Highest Safety)' },
              { value: 'AA+', label: 'AA+ (High Safety)' },
              { value: 'AA', label: 'AA (Adequate Safety)' },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Number of Bonds (Units) *
          </label>
          <input
            type="number"
            value={units}
            onChange={(e) => {
              setUnits(parseInt(e.target.value) || '');
              if (errors.units) setErrors(prev => { const n = { ...prev }; delete n.units; return n; });
            }}
            placeholder="e.g. 100"
            className={`w-full rounded-lg border bg-white p-2 text-xs font-mono text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
              errors.units ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
            }`}
          />
          {errors.units && <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.units}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Purchase Price per Bond *
          </label>
          <CurrencyInput
            value={unitPrice}
            onChange={(val) => {
              setUnitPrice(val);
              if (errors.unitPrice) setErrors(prev => { const n = { ...prev }; delete n.unitPrice; return n; });
            }}
            hasError={!!errors.unitPrice}
          />
          {errors.unitPrice && <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.unitPrice}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Face Value per Unit
          </label>
          <CurrencyInput value={faceValue} onChange={setFaceValue} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Coupon Frequency
          </label>
          <CustomSelect
            value={payoutFreq}
            onChange={(val) => setPayoutFreq(val as any)}
            className="w-full"
            options={[
              { value: 'Semi-Annual', label: 'Semi-Annual (Every 6 Months)' },
              { value: 'Annual', label: 'Annual (Once a year)' },
              { value: 'Quarterly', label: 'Quarterly' },
              { value: 'Monthly', label: 'Monthly' },
            ]}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Maturity Date *
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
            Purchase Date *
          </label>
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-mono text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>
      </div>

      {/* Yield Cash Flow Card */}
      <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between font-bold text-cyan-900 dark:text-cyan-200">
          <span>Total Capital Outflow: ₹{totalInvestment.toLocaleString('en-IN')}</span>
          <span className="font-mono text-emerald-600 dark:text-emerald-400">
            Annual Coupon: +₹{annualCouponAmt.toLocaleString('en-IN')}/yr
          </span>
        </div>
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
          className="rounded-xl bg-cyan-600 px-5 py-2 text-xs font-semibold text-white hover:bg-cyan-500 shadow-xs transition-colors"
        >
          Add Bond Security
        </button>
      </div>
    </form>
  );
};
