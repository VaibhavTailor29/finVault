import React, { useState, useMemo } from 'react';
import { Landmark, Calendar, ShieldCheck, Calculator, ArrowRight, AlertCircle } from 'lucide-react';
import { CurrencyInput } from '../../common/CurrencyInput';
import { CustomSelect } from '../../common/CustomSelect';
import { Investment, InvestmentTransaction } from '../../../types';

interface FixedDepositFormProps {
  onSuccess: (investment: Omit<Investment, 'id'>, transaction: Omit<InvestmentTransaction, 'id' | 'createdAt'>, initialPrice: number) => void;
  onCancel: () => void;
}

export const FixedDepositForm: React.FC<FixedDepositFormProps> = ({ onSuccess, onCancel }) => {
  const [depositType, setDepositType] = useState<'Fixed Deposit' | 'Recurring Deposit'>('Fixed Deposit');
  const [bankName, setBankName] = useState('');
  const [principalAmount, setPrincipalAmount] = useState<number | ''>('');
  const [monthlyInstallment, setMonthlyInstallment] = useState<number | ''>('');
  const [interestRate, setInterestRate] = useState<number | ''>('');
  const [tenureYears, setTenureYears] = useState<number | ''>('');
  const [tenureMonths, setTenureMonths] = useState<number | ''>('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [compoundingFreq, setCompoundingFreq] = useState<'Quarterly' | 'Monthly' | 'Cumulative'>('Quarterly');
  const [payoutOption, setPayoutOption] = useState<'At Maturity' | 'Quarterly' | 'Monthly'>('At Maturity');
  const [fdrNumber, setFdrNumber] = useState('');
  const [isTaxSaver, setIsTaxSaver] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Dynamic calculation of Maturity Date and Maturity Value
  const { maturityDateString, maturityAmount, totalInterestEarned } = useMemo(() => {
    const start = new Date(startDate || new Date().toISOString().split('T')[0]);
    const totalMonths = (Number(tenureYears) || 0) * 12 + (Number(tenureMonths) || 0);

    const end = new Date(start);
    end.setMonth(end.getMonth() + totalMonths);
    const maturityDateStr = end.toISOString().split('T')[0];

    const r = (Number(interestRate) || 0) / 100;
    const t = totalMonths / 12;

    let matVal = 0;
    let principal = 0;

    if (depositType === 'Fixed Deposit') {
      principal = Number(principalAmount) || 0;
      if (payoutOption === 'At Maturity') {
        // Standard Quarterly Compounding: A = P * (1 + r/4)^(4*t)
        const n = compoundingFreq === 'Monthly' ? 12 : 4;
        matVal = principal * Math.pow(1 + r / n, n * t);
      } else {
        // Periodic payout: Principal returned at maturity, interest paid out
        matVal = principal;
      }
    } else {
      // Recurring Deposit compound formula
      const mInstall = Number(monthlyInstallment) || 0;
      principal = mInstall * totalMonths;
      // RD standard formula with quarterly compounding
      let rdMaturity = 0;
      for (let m = 1; m <= totalMonths; m++) {
        const timeRemaining = (totalMonths - m + 1) / 12;
        rdMaturity += mInstall * Math.pow(1 + r / 4, 4 * timeRemaining);
      }
      matVal = rdMaturity;
    }

    const interest = Math.max(0, matVal - principal);
    return {
      maturityDateString: maturityDateStr,
      maturityAmount: Math.round(matVal),
      totalInterestEarned: Math.round(interest),
    };
  }, [startDate, tenureYears, tenureMonths, interestRate, depositType, principalAmount, monthlyInstallment, compoundingFreq, payoutOption]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!bankName.trim()) {
      newErrors.bankName = 'Bank or financial institution is required';
    }

    if (depositType === 'Fixed Deposit') {
      if (!principalAmount || Number(principalAmount) <= 0) {
        newErrors.principalAmount = 'Please enter a valid deposit principal amount';
      }
    } else {
      if (!monthlyInstallment || Number(monthlyInstallment) <= 0) {
        newErrors.monthlyInstallment = 'Please enter a valid monthly installment';
      }
    }

    if (!interestRate || Number(interestRate) <= 0) {
      newErrors.interestRate = 'Please enter an interest rate (% p.a.)';
    }

    const totalMonths = (Number(tenureYears) || 0) * 12 + (Number(tenureMonths) || 0);
    if (totalMonths <= 0) {
      newErrors.tenure = 'Tenure must be at least 1 month';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const principal = depositType === 'Fixed Deposit' ? (Number(principalAmount) || 100000) : (Number(monthlyInstallment) || 5000);
    const shortCode = bankName.split(' ').map(w => w[0]).join('').slice(0, 4).toUpperCase();
    const symbol = `${shortCode}-${depositType === 'Fixed Deposit' ? 'FD' : 'RD'}-${interestRate}`;

    const newInvestment: Omit<Investment, 'id'> = {
      symbol,
      name: `${bankName.trim()} ${tenureYears}Y ${depositType}`,
      assetType: depositType,
      institution: bankName.trim(),
      interestRate: Number(interestRate),
      tenureYears: (Number(tenureYears) || 0) + ((Number(tenureMonths) || 0) / 12),
      maturityDate: maturityDateString,
      compoundingFrequency: compoundingFreq,
      payoutFrequency: payoutOption,
      taxSection: isTaxSaver ? '80C' : undefined,
      monthlyDeposit: depositType === 'Recurring Deposit' ? Number(monthlyInstallment) || 0 : undefined,
      notes: fdrNumber ? `FDR/Account: ${fdrNumber.trim()}` : undefined,
    };

    const newTransaction: Omit<InvestmentTransaction, 'id' | 'createdAt'> = {
      investmentId: '',
      type: 'BUY',
      quantity: 1,
      price: principal,
      fees: 0,
      date: startDate,
      notes: `${depositType} Opened at ${bankName}`,
    };

    onSuccess(newInvestment, newTransaction, principal);
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      {Object.keys(errors).length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Please fill in the required fields correctly before proceeding.</span>
        </div>
      )}

      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
        <Landmark className="h-4 w-4 shrink-0" />
        <span>Track bank term deposits, DICGC insurance cover, compounding schedules, and auto-calculated maturity returns.</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Deposit Category
          </label>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-300 dark:border-neutral-700 p-0.5 bg-neutral-100 dark:bg-neutral-800">
            <button
              type="button"
              onClick={() => { setDepositType('Fixed Deposit'); setIsTaxSaver(false); }}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                depositType === 'Fixed Deposit'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              Fixed Deposit (FD)
            </button>
            <button
              type="button"
              onClick={() => { setDepositType('Recurring Deposit'); setIsTaxSaver(false); }}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                depositType === 'Recurring Deposit'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              Recurring Deposit (RD)
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Bank / Financial Institution *
          </label>
          <input
            type="text"
            value={bankName}
            onChange={(e) => {
              setBankName(e.target.value);
              if (errors.bankName) setErrors(prev => { const n = { ...prev }; delete n.bankName; return n; });
            }}
            placeholder="e.g. HDFC Bank, SBI, ICICI"
            className={`w-full rounded-lg border bg-white p-2 text-xs text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
              errors.bankName ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
            }`}
          />
          {errors.bankName && <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.bankName}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {depositType === 'Fixed Deposit' ? (
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Deposit Principal Amount *
            </label>
            <CurrencyInput
              value={principalAmount}
              onChange={(val) => {
                setPrincipalAmount(val);
                if (errors.principalAmount) setErrors(prev => { const n = { ...prev }; delete n.principalAmount; return n; });
              }}
              hasError={!!errors.principalAmount}
            />
            {errors.principalAmount && <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.principalAmount}</p>}
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Monthly RD Installment *
            </label>
            <CurrencyInput
              value={monthlyInstallment}
              onChange={(val) => {
                setMonthlyInstallment(val);
                if (errors.monthlyInstallment) setErrors(prev => { const n = { ...prev }; delete n.monthlyInstallment; return n; });
              }}
              hasError={!!errors.monthlyInstallment}
            />
            {errors.monthlyInstallment && <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.monthlyInstallment}</p>}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Interest Rate (% per annum) *
          </label>
          <input
            type="number"
            step="0.05"
            value={interestRate}
            onChange={(e) => {
              setInterestRate(parseFloat(e.target.value) || '');
              if (errors.interestRate) setErrors(prev => { const n = { ...prev }; delete n.interestRate; return n; });
            }}
            placeholder="e.g. 7.10"
            className={`w-full rounded-lg border bg-white p-2 text-xs font-mono font-bold text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
              errors.interestRate ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
            }`}
          />
          {errors.interestRate && <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.interestRate}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Tenure (Years) *
          </label>
          <input
            type="number"
            min="0"
            max="20"
            value={tenureYears}
            onChange={(e) => {
              setTenureYears(parseInt(e.target.value) || '');
              if (errors.tenure) setErrors(prev => { const n = { ...prev }; delete n.tenure; return n; });
            }}
            className={`w-full rounded-lg border bg-white p-2 text-xs font-mono text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
              errors.tenure ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
            }`}
          />
          {errors.tenure && <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.tenure}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Extra Months
          </label>
          <input
            type="number"
            min="0"
            max="11"
            value={tenureMonths}
            onChange={(e) => setTenureMonths(parseInt(e.target.value) || '')}
            className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-mono text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Start Date *
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-mono text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Compounding
          </label>
          <CustomSelect
            value={compoundingFreq}
            onChange={(val) => setCompoundingFreq(val as any)}
            className="w-full"
            options={[
              { value: 'Quarterly', label: 'Quarterly Compounded (Standard)' },
              { value: 'Monthly', label: 'Monthly Compounded' },
              { value: 'Cumulative', label: 'Cumulative Simple' },
            ]}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Payout Option
          </label>
          <CustomSelect
            value={payoutOption}
            onChange={(val) => setPayoutOption(val as any)}
            className="w-full"
            options={[
              { value: 'At Maturity', label: 'Reinvest (At Maturity)' },
              { value: 'Quarterly', label: 'Quarterly Interest Payout' },
              { value: 'Monthly', label: 'Monthly Interest Payout' },
            ]}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            FDR / Receipt No (Optional)
          </label>
          <input
            type="text"
            value={fdrNumber}
            onChange={(e) => setFdrNumber(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-mono text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>
      </div>

      {depositType === 'Fixed Deposit' && (
        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-700 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={isTaxSaver}
            onChange={(e) => {
              setIsTaxSaver(e.target.checked);
              if (e.target.checked && Number(tenureYears) < 5) {
                setTenureYears(5);
              }
            }}
            className="rounded text-amber-600 focus:ring-amber-500"
          />
          <span>5-Year Tax Saving FD (Eligible for Section 80C Deduction with 5-year lock-in)</span>
        </label>
      )}

      {/* Live Maturity Calculator Result Panel */}
      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
          <span className="flex items-center gap-1.5">
            <Calculator className="h-4 w-4 text-amber-600" />
            Live Maturity Calculation
          </span>
          <span className="font-mono">Matures on: {maturityDateString}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-amber-500/20 text-xs">
          <div>
            <span className="text-neutral-500 dark:text-neutral-400 block text-[11px]">Total Interest Earned</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
              +₹{totalInterestEarned.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="text-right">
            <span className="text-neutral-500 dark:text-neutral-400 block text-[11px]">Guaranteed Maturity Value</span>
            <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 text-base">
              ₹{maturityAmount.toLocaleString('en-IN')}
            </span>
          </div>
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
          className="rounded-xl bg-amber-600 px-5 py-2 text-xs font-semibold text-white hover:bg-amber-500 shadow-xs transition-colors"
        >
          Book {depositType}
        </button>
      </div>
    </form>
  );
};
