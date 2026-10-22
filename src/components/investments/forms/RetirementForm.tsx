import React, { useState } from 'react';
import { Award, ShieldCheck, Landmark, AlertCircle } from 'lucide-react';
import { CurrencyInput } from '../../common/CurrencyInput';
import { CustomSelect } from '../../common/CustomSelect';
import { Investment, InvestmentTransaction, AssetType } from '../../../types';

interface RetirementFormProps {
  onSuccess: (investment: Omit<Investment, 'id'>, transaction: Omit<InvestmentTransaction, 'id' | 'createdAt'>, initialPrice: number) => void;
  onCancel: () => void;
}

export const RetirementForm: React.FC<RetirementFormProps> = ({ onSuccess, onCancel }) => {
  const [schemeType, setSchemeType] = useState<AssetType>('PPF');
  const [institution, setInstitution] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [currentBalance, setCurrentBalance] = useState<number | ''>('');
  const [interestRate, setInterestRate] = useState<number | ''>('');
  const [monthlyContribution, setMonthlyContribution] = useState<number | ''>('');
  const [openingDate, setOpeningDate] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const taxTag = schemeType === 'NPS' ? '80CCD(1B)' : '80C';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!institution.trim()) {
      newErrors.institution = 'Managing institution or bank is required';
    }
    if (!currentBalance || Number(currentBalance) <= 0) {
      newErrors.currentBalance = 'Please enter a valid current balance';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const symbol = `${schemeType}-${institution.split(' ').map(w => w[0]).join('').slice(0, 4).toUpperCase() || 'ACC'}`;
    const name = institution.trim() ? `${institution.trim()} ${schemeType} Account` : `${schemeType} Account`;

    const newInvestment: Omit<Investment, 'id'> = {
      symbol,
      name,
      assetType: schemeType,
      institution: institution.trim() || undefined,
      interestRate: Number(interestRate) || undefined,
      maturityDate: schemeType === 'PPF' && maturityDate ? maturityDate : undefined,
      taxSection: taxTag,
      monthlyDeposit: Number(monthlyContribution) || undefined,
      notes: accountNumber ? `Account/PRAN: ${accountNumber.trim()}` : undefined,
    };

    const newTransaction: Omit<InvestmentTransaction, 'id' | 'createdAt'> = {
      investmentId: '',
      type: 'BUY',
      quantity: 1,
      price: Number(currentBalance),
      fees: 0,
      date: openingDate || new Date().toISOString().split('T')[0],
      notes: `Current accumulated balance in ${schemeType}`,
    };

    onSuccess(newInvestment, newTransaction, Number(currentBalance));
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      {Object.keys(errors).length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Please fill in the required fields correctly before proceeding.</span>
        </div>
      )}

      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs">
        <Award className="h-4 w-4 shrink-0 text-emerald-600" />
        <span>Manage sovereign retirement accounts with Section 80C and Section 80CCD tax optimization and statutory compounding.</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Retirement Vehicle
          </label>
          <CustomSelect
            value={schemeType}
            onChange={(val) => {
              setSchemeType(val as AssetType);
            }}
            className="w-full"
            options={[
              { value: 'PPF', label: 'PPF (Public Provident Fund - 15 Yr Lock-in)' },
              { value: 'NPS', label: 'NPS (National Pension System Tier 1)' },
              { value: 'EPF', label: 'EPF / VPF (Employees Provident Fund)' },
            ]}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Managing Institution / PFM / Bank *
          </label>
          <input
            type="text"
            value={institution}
            onChange={(e) => {
              setInstitution(e.target.value);
              if (errors.institution) setErrors(prev => { const n = { ...prev }; delete n.institution; return n; });
            }}
            placeholder="e.g. State Bank of India, NSDL PFM"
            className={`w-full rounded-lg border bg-white p-2 text-xs text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
              errors.institution ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
            }`}
          />
          {errors.institution && <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.institution}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Current Corpus / Balance *
          </label>
          <CurrencyInput
            value={currentBalance}
            onChange={(val) => {
              setCurrentBalance(val);
              if (errors.currentBalance) setErrors(prev => { const n = { ...prev }; delete n.currentBalance; return n; });
            }}
            hasError={!!errors.currentBalance}
          />
          {errors.currentBalance && <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.currentBalance}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Interest / CAGR (% p.a.)
          </label>
          <input
            type="number"
            step="0.05"
            value={interestRate}
            onChange={(e) => setInterestRate(parseFloat(e.target.value) || '')}
            className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-mono font-bold text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Monthly / Regular Deposit
          </label>
          <CurrencyInput value={monthlyContribution} onChange={setMonthlyContribution} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Account No / PRAN (Optional)
          </label>
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-mono text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Account Opening Date
          </label>
          <input
            type="date"
            value={openingDate}
            onChange={(e) => setOpeningDate(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-mono text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>

        {schemeType === 'PPF' && (
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              15-Year Maturity Date
            </label>
            <input
              type="date"
              value={maturityDate}
              onChange={(e) => setMaturityDate(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-mono text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>
        )}
      </div>

      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 text-xs flex items-center justify-between">
        <span className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Tax Advantage: Section {taxTag}
        </span>
        <span className="text-[11px] text-neutral-500">
          {schemeType === 'NPS' ? 'Exclusive ₹50,000 additional deduction' : 'Included in ₹1.5L Annual 80C Ceiling'}
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
          className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 shadow-xs transition-colors"
        >
          Link {schemeType} Account
        </button>
      </div>
    </form>
  );
};
