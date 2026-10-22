import React, { useState } from 'react';
import { PieChart, Calendar, ShieldCheck, Repeat, AlertCircle } from 'lucide-react';
import { CurrencyInput } from '../../common/CurrencyInput';
import { CustomSelect } from '../../common/CustomSelect';
import { Investment, InvestmentTransaction } from '../../../types';

interface MutualFundFormProps {
  onSuccess: (investment: Omit<Investment, 'id'>, transaction: Omit<InvestmentTransaction, 'id' | 'createdAt'>, initialPrice: number) => void;
  onCancel: () => void;
}

export const MutualFundForm: React.FC<MutualFundFormProps> = ({ onSuccess, onCancel }) => {
  const [schemeName, setSchemeName] = useState('');
  const [symbolCode, setSymbolCode] = useState('');
  const [amcName, setAmcName] = useState('');
  const [fundCategory, setFundCategory] = useState('Flexi Cap Fund');
  const [planType, setPlanType] = useState('Direct Growth');
  const [investmentMode, setInvestmentMode] = useState<'SIP' | 'LUMPSUM'>('SIP');

  // SIP Specific Fields
  const [monthlySipAmount, setMonthlySipAmount] = useState<number | ''>('');
  const [sipDay, setSipDay] = useState<number | ''>('');
  const [linkedBank, setLinkedBank] = useState('');
  const [isSipActive, setIsSipActive] = useState(true);

  // Lumpsum / Initial Holding Details
  const [initialNav, setInitialNav] = useState<number | ''>('');
  const [initialUnits, setInitialUnits] = useState<number | ''>('');
  const [folioNumber, setFolioNumber] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  // Custom validation state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Derived tax section
  const isElss = fundCategory.includes('ELSS') || schemeName.toLowerCase().includes('elss') || schemeName.toLowerCase().includes('tax saver');
  const calculatedOutflow = investmentMode === 'SIP' ? Number(monthlySipAmount) || 0 : (Number(initialUnits) || 0) * (Number(initialNav) || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!schemeName.trim()) {
      newErrors.schemeName = 'Scheme name is required';
    }

    if (investmentMode === 'SIP') {
      if (!monthlySipAmount || Number(monthlySipAmount) <= 0) {
        newErrors.monthlySipAmount = 'Please enter a valid monthly SIP amount';
      }
      if (!sipDay || Number(sipDay) < 1 || Number(sipDay) > 31) {
        newErrors.sipDay = 'Please specify a monthly debit day (1 - 31)';
      }
    }

    if (!initialNav || Number(initialNav) <= 0) {
      newErrors.initialNav = 'Please enter a valid NAV per unit';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const symbol = symbolCode.trim()
      ? symbolCode.trim().toUpperCase()
      : schemeName.split(' ').map(w => w[0]).join('').slice(0, 6).toUpperCase() + '-MF';

    const units = Number(initialUnits) || (investmentMode === 'SIP' && initialNav && monthlySipAmount ? Math.round((Number(monthlySipAmount) / Number(initialNav)) * 1000) / 1000 : 0);
    const nav = Number(initialNav) || 1;

    const newInvestment: Omit<Investment, 'id'> = {
      symbol,
      name: `${schemeName.trim()} (${planType})`,
      assetType: 'Mutual Fund',
      institution: amcName.trim() || undefined,
      categoryTag: fundCategory,
      taxSection: isElss ? '80C' : undefined,
      monthlyDeposit: investmentMode === 'SIP' ? Number(monthlySipAmount) || 0 : undefined,
      sipDay: investmentMode === 'SIP' ? Number(sipDay) || undefined : undefined,
      isSipActive: investmentMode === 'SIP' ? isSipActive : false,
      notes: folioNumber.trim() || linkedBank.trim() ? `Folio: ${folioNumber.trim()} | Bank: ${linkedBank.trim()}` : undefined,
    };

    const newTransaction: Omit<InvestmentTransaction, 'id' | 'createdAt'> = {
      investmentId: '',
      type: 'BUY',
      quantity: units,
      price: nav,
      fees: 0,
      date: startDate,
      notes: investmentMode === 'SIP' ? (linkedBank.trim() ? `SIP Installment (${linkedBank.trim()})` : 'SIP Installment') : 'Lumpsum Mutual Fund Purchase',
    };

    onSuccess(newInvestment, newTransaction, nav);
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      {Object.keys(errors).length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Please fill in the required fields correctly before proceeding.</span>
        </div>
      )}

      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-xs">
        <PieChart className="h-4 w-4 shrink-0" />
        <span>Configure Systematic Investment Plans (SIP), NAV valuation, AMC folios, and 80C ELSS deductions.</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Mutual Fund Scheme Name *
          </label>
          <input
            type="text"
            value={schemeName}
            onChange={(e) => {
              setSchemeName(e.target.value);
              if (errors.schemeName) setErrors(prev => { const n = { ...prev }; delete n.schemeName; return n; });
            }}
            placeholder="e.g. Parag Parikh Flexi Cap Fund"
            className={`w-full rounded-lg border bg-white p-2 text-xs text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
              errors.schemeName ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
            }`}
          />
          {errors.schemeName && <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.schemeName}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Fund House / AMC
          </label>
          <input
            type="text"
            value={amcName}
            onChange={(e) => setAmcName(e.target.value)}
            placeholder="e.g. PPFAS Mutual Fund"
            className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Fund Category
          </label>
          <CustomSelect
            value={fundCategory}
            onChange={setFundCategory}
            className="w-full"
            options={[
              { value: 'Flexi Cap Fund', label: 'Flexi Cap Fund' },
              { value: 'Large Cap Fund', label: 'Large Cap Fund' },
              { value: 'Mid Cap Fund', label: 'Mid Cap Fund' },
              { value: 'Small Cap Fund', label: 'Small Cap Fund' },
              { value: 'ELSS Tax Saver (80C)', label: 'ELSS Tax Saver (Sec 80C)' },
              { value: 'Index Fund / ETF', label: 'Index Fund (Nifty 50)' },
              { value: 'Debt / Liquid Fund', label: 'Debt / Liquid Fund' },
              { value: 'Hybrid / Balanced', label: 'Hybrid / Balanced Advantage' },
            ]}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Plan Type
          </label>
          <CustomSelect
            value={planType}
            onChange={setPlanType}
            className="w-full"
            options={[
              { value: 'Direct Growth', label: 'Direct - Growth (Zero Commission)' },
              { value: 'Regular Growth', label: 'Regular - Growth' },
              { value: 'Direct IDCW', label: 'Direct - Dividend / IDCW' },
            ]}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Investment Style
          </label>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-300 dark:border-neutral-700 p-0.5 bg-neutral-100 dark:bg-neutral-800">
            <button
              type="button"
              onClick={() => setInvestmentMode('SIP')}
              className={`py-1 text-xs font-semibold rounded-md transition-colors ${
                investmentMode === 'SIP'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              Monthly SIP
            </button>
            <button
              type="button"
              onClick={() => setInvestmentMode('LUMPSUM')}
              className={`py-1 text-xs font-semibold rounded-md transition-colors ${
                investmentMode === 'LUMPSUM'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              Lump-sum
            </button>
          </div>
        </div>
      </div>

      {/* SIP Specific Section */}
      {investmentMode === 'SIP' && (
        <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5 text-purple-600" />
              Automated SIP Schedule
            </span>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-purple-800 dark:text-purple-300">
              <input
                type="checkbox"
                checked={isSipActive}
                onChange={(e) => setIsSipActive(e.target.checked)}
                className="rounded text-purple-600 focus:ring-purple-500"
              />
              Auto-Debit Active
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-purple-900 dark:text-purple-200 mb-1">
                Monthly SIP Amount *
              </label>
              <CurrencyInput
                value={monthlySipAmount}
                onChange={(val) => {
                  setMonthlySipAmount(val);
                  if (errors.monthlySipAmount) setErrors(prev => { const n = { ...prev }; delete n.monthlySipAmount; return n; });
                }}
                hasError={!!errors.monthlySipAmount}
              />
              {errors.monthlySipAmount && <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.monthlySipAmount}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-purple-900 dark:text-purple-200 mb-1">
                Debit Day (1 to 31) *
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={sipDay}
                onChange={(e) => {
                  setSipDay(parseInt(e.target.value) || '');
                  if (errors.sipDay) setErrors(prev => { const n = { ...prev }; delete n.sipDay; return n; });
                }}
                className={`w-full rounded-lg border bg-white p-2 text-xs font-mono text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
                  errors.sipDay ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-purple-300 dark:border-purple-700'
                }`}
              />
              {errors.sipDay && <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.sipDay}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-purple-900 dark:text-purple-200 mb-1">
                Auto-Debit Mandate Bank
              </label>
              <input
                type="text"
                value={linkedBank}
                onChange={(e) => setLinkedBank(e.target.value)}
                className="w-full rounded-lg border border-purple-300 bg-white p-2 text-xs text-neutral-900 dark:border-purple-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>
        </div>
      )}

      {/* NAV & Folio Details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Current NAV (Per Unit) *
          </label>
          <CurrencyInput
            value={initialNav}
            onChange={(val) => {
              setInitialNav(val);
              if (errors.initialNav) setErrors(prev => { const n = { ...prev }; delete n.initialNav; return n; });
            }}
            hasError={!!errors.initialNav}
          />
          {errors.initialNav && <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.initialNav}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Units Held / Initial Allotment
          </label>
          <input
            type="number"
            step="any"
            value={initialUnits}
            onChange={(e) => setInitialUnits(parseFloat(e.target.value) || '')}
            className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-mono text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Folio Number (Optional)
          </label>
          <input
            type="text"
            value={folioNumber}
            onChange={(e) => setFolioNumber(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-mono text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>
      </div>

      {isElss && (
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>Tax Benefit: Eligible for up to ₹1,50,000 tax deduction under Section 80C (3-Year lock-in period).</span>
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
          className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-semibold text-white hover:bg-purple-500 shadow-xs transition-colors"
        >
          {investmentMode === 'SIP' ? 'Start Systematic SIP' : 'Add Mutual Fund Holding'}
        </button>
      </div>
    </form>
  );
};
