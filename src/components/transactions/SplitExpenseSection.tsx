import React, { useState } from 'react';
import {
  Users,
  User,
  Plus,
  Trash2,
  Percent,
  Coins,
  Equal,
  Calendar,
  AlertCircle,
  Check,
  ChevronDown,
} from 'lucide-react';
import { Person } from '../../types';
import { CurrencyInput } from '../common/CurrencyInput';
import { CustomSelect } from '../common/CustomSelect';
import { formatCurrency } from '../../utils/formatters';

export interface PersonSplitItem {
  id: string;
  personId: string;
  amount: number | '';
  percentage: number | '';
  dueDate?: string;
}

export interface SplitExpenseSectionProps {
  totalAmount: number | '';
  currency: string;
  people: Person[];
  onAddPerson: (person: Omit<Person, 'id'>) => Promise<string | void> | void;
  // Master Lent Toggle
  isLent: boolean;
  setIsLent: (val: boolean) => void;
  // Target: Single vs Multiple
  splitTarget: 'single' | 'multiple';
  setSplitTarget: (val: 'single' | 'multiple') => void;
  // Single Person State
  lentPersonId: string;
  setLentPersonId: (id: string) => void;
  lentMode: 'full' | 'partial';
  setLentMode: (mode: 'full' | 'partial') => void;
  lentSplitUnit: 'amount' | 'percentage';
  setLentSplitUnit: (unit: 'amount' | 'percentage') => void;
  lentAmount: number | '';
  setLentAmount: (amt: number | '') => void;
  lentPercentage: number | '';
  setLentPercentage: (pct: number | '') => void;
  lentDueDate: string;
  setLentDueDate: (date: string) => void;
  // Multiple People State
  multiSplitMethod: 'equal' | 'percentage' | 'exact';
  setMultiSplitMethod: (method: 'equal' | 'percentage' | 'exact') => void;
  includeSelfInEqual: boolean;
  setIncludeSelfInEqual: (val: boolean) => void;
  personSplits: PersonSplitItem[];
  setPersonSplits: React.Dispatch<React.SetStateAction<PersonSplitItem[]>>;
  commonDueDate: string;
  setCommonDueDate: (d: string) => void;
}

export function computeEffectiveSplits({
  totalAmount,
  isLent,
  splitTarget,
  lentPersonId,
  lentMode,
  lentSplitUnit,
  lentAmount,
  lentPercentage,
  lentDueDate,
  multiSplitMethod,
  includeSelfInEqual,
  personSplits,
  commonDueDate,
}: {
  totalAmount: number;
  isLent: boolean;
  splitTarget: 'single' | 'multiple';
  lentPersonId: string;
  lentMode: 'full' | 'partial';
  lentSplitUnit: 'amount' | 'percentage';
  lentAmount: number | '';
  lentPercentage: number | '';
  lentDueDate: string;
  multiSplitMethod: 'equal' | 'percentage' | 'exact';
  includeSelfInEqual: boolean;
  personSplits: PersonSplitItem[];
  commonDueDate: string;
}) {
  if (!isLent || totalAmount <= 0) {
    return {
      splits: [],
      totalLent: 0,
      yourShare: totalAmount,
      isSplit: false,
      hasOverAllocation: false,
    };
  }

  // 1. Single Person Mode
  if (splitTarget === 'single') {
    if (!lentPersonId) {
      return {
        splits: [],
        totalLent: 0,
        yourShare: totalAmount,
        isSplit: false,
        hasOverAllocation: false,
      };
    }

    let allocated = 0;
    let pct = 100;

    if (lentMode === 'full') {
      allocated = totalAmount;
      pct = 100;
    } else {
      if (lentSplitUnit === 'percentage') {
        pct = Number(lentPercentage) || 0;
        allocated = Math.round(((totalAmount * pct) / 100) * 100) / 100;
      } else {
        allocated = Number(lentAmount) || 0;
        pct = totalAmount > 0 ? Math.round(((allocated / totalAmount) * 100) * 10) / 10 : 0;
      }
    }

    const hasOver = allocated > totalAmount;
    const finalAllocated = Math.max(0, allocated);
    const yourShare = Math.max(0, totalAmount - finalAllocated);

    return {
      splits: [
        {
          personId: lentPersonId,
          amount: finalAllocated,
          percentage: pct,
          dueDate: lentDueDate || undefined,
        },
      ],
      totalLent: finalAllocated,
      yourShare,
      isSplit: finalAllocated > 0 && finalAllocated < totalAmount,
      hasOverAllocation: hasOver,
    };
  }

  // 2. Multiple People Mode
  const validSplits = personSplits.filter((s) => !!s.personId);
  if (validSplits.length === 0) {
    return {
      splits: [],
      totalLent: 0,
      yourShare: totalAmount,
      isSplit: false,
      hasOverAllocation: false,
    };
  }

  const resultSplits: { personId: string; amount: number; percentage?: number; dueDate?: string }[] = [];
  let totalLent = 0;

  if (multiSplitMethod === 'equal') {
    const totalShares = includeSelfInEqual ? validSplits.length + 1 : validSplits.length;
    const shareAmt = totalShares > 0 ? Math.round((totalAmount / totalShares) * 100) / 100 : 0;
    const sharePct = totalShares > 0 ? Math.round((100 / totalShares) * 10) / 10 : 0;

    validSplits.forEach((s) => {
      resultSplits.push({
        personId: s.personId,
        amount: shareAmt,
        percentage: sharePct,
        dueDate: s.dueDate || commonDueDate || undefined,
      });
      totalLent += shareAmt;
    });
  } else if (multiSplitMethod === 'percentage') {
    validSplits.forEach((s) => {
      const p = Number(s.percentage) || 0;
      const amt = Math.round(((totalAmount * p) / 100) * 100) / 100;
      resultSplits.push({
        personId: s.personId,
        amount: amt,
        percentage: p,
        dueDate: s.dueDate || commonDueDate || undefined,
      });
      totalLent += amt;
    });
  } else {
    // Exact Amount
    validSplits.forEach((s) => {
      const amt = Number(s.amount) || 0;
      const p = totalAmount > 0 ? Math.round(((amt / totalAmount) * 100) * 10) / 10 : 0;
      resultSplits.push({
        personId: s.personId,
        amount: amt,
        percentage: p,
        dueDate: s.dueDate || commonDueDate || undefined,
      });
      totalLent += amt;
    });
  }

  totalLent = Math.round(totalLent * 100) / 100;
  const hasOverAllocation = totalLent > totalAmount;
  const yourShare = Math.max(0, Math.round((totalAmount - totalLent) * 100) / 100);

  return {
    splits: resultSplits,
    totalLent,
    yourShare,
    isSplit: totalLent > 0,
    hasOverAllocation,
  };
}

export const SplitExpenseSection: React.FC<SplitExpenseSectionProps> = ({
  totalAmount,
  currency,
  people,
  onAddPerson,
  isLent,
  setIsLent,
  splitTarget,
  setSplitTarget,
  lentPersonId,
  setLentPersonId,
  lentMode,
  setLentMode,
  lentSplitUnit,
  setLentSplitUnit,
  lentAmount,
  setLentAmount,
  lentPercentage,
  setLentPercentage,
  lentDueDate,
  setLentDueDate,
  multiSplitMethod,
  setMultiSplitMethod,
  includeSelfInEqual,
  setIncludeSelfInEqual,
  personSplits,
  setPersonSplits,
  commonDueDate,
  setCommonDueDate,
}) => {
  const [showQuickAddPerson, setShowQuickAddPerson] = useState(false);
  const [quickPersonName, setQuickPersonName] = useState('');
  const [targetSplitIndexForNewPerson, setTargetSplitIndexForNewPerson] = useState<number | null>(null);

  const numTotal = Number(totalAmount) || 0;

  // Calculation summaries
  const effective = computeEffectiveSplits({
    totalAmount: numTotal,
    isLent,
    splitTarget,
    lentPersonId,
    lentMode,
    lentSplitUnit,
    lentAmount,
    lentPercentage,
    lentDueDate,
    multiSplitMethod,
    includeSelfInEqual,
    personSplits,
    commonDueDate,
  });

  const handleCreateQuickPerson = async () => {
    if (!quickPersonName.trim()) return;
    const tempId = `person_${Date.now()}`;
    const newName = quickPersonName.trim();
    setQuickPersonName('');
    setShowQuickAddPerson(false);

    await onAddPerson({
      name: newName,
      avatarColor: '#6366F1',
    });

    if (splitTarget === 'single') {
      setLentPersonId(tempId);
    } else if (targetSplitIndexForNewPerson !== null) {
      setPersonSplits((prev) =>
        prev.map((s, idx) => (idx === targetSplitIndexForNewPerson ? { ...s, personId: tempId } : s))
      );
      setTargetSplitIndexForNewPerson(null);
    }
  };

  const handleAddSplitRow = () => {
    // Select first unused person if available
    const usedIds = new Set(personSplits.map((s) => s.personId));
    const nextUnused = people.find((p) => !usedIds.has(p.id));

    setPersonSplits((prev) => [
      ...prev,
      {
        id: `split_${Date.now()}_${Math.random()}`,
        personId: nextUnused?.id || '',
        amount: '',
        percentage: '',
        dueDate: commonDueDate,
      },
    ]);
  };

  const handleRemoveSplitRow = (id: string) => {
    setPersonSplits((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateSplitPerson = (index: number, newPersonId: string) => {
    setPersonSplits((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, personId: newPersonId } : s))
    );
  };

  const handleUpdateSplitAmount = (index: number, val: number | '') => {
    setPersonSplits((prev) =>
      prev.map((s, idx) => {
        if (idx !== index) return s;
        const amt = val;
        const pct = numTotal > 0 && typeof val === 'number' ? Math.round(((val / numTotal) * 100) * 10) / 10 : '';
        return { ...s, amount: amt, percentage: pct };
      })
    );
  };

  const handleUpdateSplitPercentage = (index: number, val: number | '') => {
    setPersonSplits((prev) =>
      prev.map((s, idx) => {
        if (idx !== index) return s;
        const pct = val;
        const amt = numTotal > 0 && typeof val === 'number' ? Math.round(((numTotal * val) / 100) * 100) / 100 : '';
        return { ...s, percentage: pct, amount: amt };
      })
    );
  };

  const handleDistributeRemaining = () => {
    if (personSplits.length === 0 || numTotal <= 0) return;

    if (multiSplitMethod === 'percentage') {
      const evenPct = Math.round((100 / personSplits.length) * 10) / 10;
      setPersonSplits((prev) =>
        prev.map((s) => ({
          ...s,
          percentage: evenPct,
          amount: Math.round(((numTotal * evenPct) / 100) * 100) / 100,
        }))
      );
    } else if (multiSplitMethod === 'exact') {
      const evenAmt = Math.round((numTotal / personSplits.length) * 100) / 100;
      setPersonSplits((prev) =>
        prev.map((s) => ({
          ...s,
          amount: evenAmt,
          percentage: Math.round(((evenAmt / numTotal) * 100) * 10) / 10,
        }))
      );
    }
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3.5 dark:border-neutral-800 dark:bg-neutral-900/60 transition-all">
      {/* Master Toggle Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <label
              htmlFor="split-lent-toggle"
              className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 cursor-pointer"
            >
              Split Expense / Record Money Lent
            </label>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Split with single or multiple friends by percentage or amount
            </p>
          </div>
        </div>
        <input
          id="split-lent-toggle"
          type="checkbox"
          checked={isLent}
          onChange={(e) => {
            const checked = e.target.checked;
            setIsLent(checked);
            if (checked) {
              if (!lentPersonId && people.length > 0) {
                setLentPersonId(people[0].id);
              }
              if (personSplits.length === 0 && people.length > 0) {
                setPersonSplits([
                  {
                    id: `split_${Date.now()}_1`,
                    personId: people[0].id,
                    amount: numTotal ? Math.round(numTotal / 2) : '',
                    percentage: 50,
                  },
                ]);
              }
              if (lentMode === 'full' && numTotal) {
                setLentAmount(numTotal);
                setLentPercentage(100);
              }
            }
          }}
          className="h-4 w-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
        />
      </div>

      {isLent && (
        <div className="mt-3.5 space-y-3.5 pt-3 border-t border-neutral-200 dark:border-neutral-800">
          {/* Target Switcher: Single Person vs Multiple People */}
          <div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSplitTarget('single')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border font-medium transition-all cursor-pointer ${
                  splitTarget === 'single'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200 ring-2 ring-indigo-500/20 font-semibold'
                    : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/60'
                }`}
              >
                <User className="h-3.5 w-3.5" />
                <span>Single Person</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSplitTarget('multiple');
                  if (personSplits.length === 0) {
                    const firstP = lentPersonId || people[0]?.id || '';
                    const secondP = people.find((p) => p.id !== firstP)?.id || '';
                    setPersonSplits([
                      {
                        id: `split_${Date.now()}_1`,
                        personId: firstP,
                        amount: numTotal ? Math.round(numTotal / 3) : '',
                        percentage: 33.3,
                      },
                      ...(secondP
                        ? [
                            {
                              id: `split_${Date.now()}_2`,
                              personId: secondP,
                              amount: numTotal ? Math.round(numTotal / 3) : '',
                              percentage: 33.3,
                            },
                          ]
                        : []),
                    ]);
                  }
                }}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border font-medium transition-all cursor-pointer ${
                  splitTarget === 'multiple'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200 ring-2 ring-indigo-500/20 font-semibold'
                    : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/60'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Split with Multiple People</span>
              </button>
            </div>
          </div>

          {/* ======================================================== */}
          {/* TAB A: SINGLE PERSON SPLIT                               */}
          {/* ======================================================== */}
          {splitTarget === 'single' && (
            <div className="space-y-3">
              {/* Person Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Select Person
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetSplitIndexForNewPerson(null);
                      setShowQuickAddPerson(true);
                    }}
                    className="text-[11px] text-indigo-600 font-semibold hover:underline dark:text-indigo-400 cursor-pointer"
                  >
                    + Add New Person
                  </button>
                </div>

                {people.length === 0 && !showQuickAddPerson ? (
                  <div className="flex items-center justify-between rounded-lg border border-dashed border-neutral-300 p-2.5 text-xs text-neutral-500 dark:border-neutral-700">
                    <span>No contacts saved in ledger</span>
                    <button
                      type="button"
                      onClick={() => setShowQuickAddPerson(true)}
                      className="text-indigo-600 font-semibold hover:underline dark:text-indigo-400"
                    >
                      Add Person
                    </button>
                  </div>
                ) : (
                  <CustomSelect
                    value={lentPersonId}
                    onChange={setLentPersonId}
                    className="w-full"
                    placeholder="-- Choose person from list --"
                    options={[
                      { value: '', label: '-- Choose person from list --' },
                      ...people.map((p) => ({
                        value: p.id,
                        label: `${p.name}${p.phone ? ` (${p.phone})` : ''}`,
                      })),
                    ]}
                  />
                )}
              </div>

              {/* Lent Mode: Full vs Partial */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Lent Amount Allocation
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLentMode('full');
                      setLentAmount(numTotal ? numTotal : '');
                      setLentPercentage(100);
                    }}
                    className={`rounded-lg py-1.5 px-3 text-xs font-medium border text-center transition-colors cursor-pointer ${
                      lentMode === 'full'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800'
                    }`}
                  >
                    Full Amount ({numTotal ? formatCurrency(numTotal, currency, false) : '100%'})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLentMode('partial');
                      if (!lentAmount || Number(lentAmount) >= numTotal) {
                        setLentAmount(numTotal ? Math.round(numTotal / 2) : '');
                        setLentPercentage(50);
                      }
                    }}
                    className={`rounded-lg py-1.5 px-3 text-xs font-medium border text-center transition-colors cursor-pointer ${
                      lentMode === 'partial'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800'
                    }`}
                  >
                    Partial / Custom Split
                  </button>
                </div>

                {lentMode === 'partial' && (
                  <div className="space-y-2 mt-2 p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700">
                    {/* Amount vs Percentage Toggle */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-neutral-100 dark:border-neutral-800">
                      <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                        Split By:
                      </span>
                      <div className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700 p-0.5 bg-neutral-100 dark:bg-neutral-800 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setLentSplitUnit('amount')}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                            lentSplitUnit === 'amount'
                              ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs'
                              : 'text-neutral-600 dark:text-neutral-400'
                          }`}
                        >
                          <Coins className="h-3 w-3" />
                          <span>Exact Amount ({currency})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLentSplitUnit('percentage')}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                            lentSplitUnit === 'percentage'
                              ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs'
                              : 'text-neutral-600 dark:text-neutral-400'
                          }`}
                        >
                          <Percent className="h-3 w-3" />
                          <span>Percentage (%)</span>
                        </button>
                      </div>
                    </div>

                    {/* Input Field with live paired display */}
                    <div className="pt-1">
                      {lentSplitUnit === 'amount' ? (
                        <div>
                          <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                            Amount Lent to Person
                          </label>
                          <CurrencyInput
                            value={lentAmount}
                            onChange={(val) => {
                              setLentAmount(val);
                              if (numTotal > 0 && typeof val === 'number') {
                                setLentPercentage(Math.round(((val / numTotal) * 100) * 10) / 10);
                              }
                            }}
                            placeholder="Enter amount lent to person"
                          />
                          {numTotal > 0 && typeof lentAmount === 'number' && (
                            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 flex justify-between">
                              <span>Calculated percentage share:</span>
                              <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                {Math.round(((lentAmount / numTotal) * 100) * 10) / 10}% of total
                              </span>
                            </p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                            Percentage Lent to Person (%)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              value={lentPercentage}
                              onChange={(e) => {
                                let raw = e.target.value;
                                if (raw.length > 1 && /^0\d/.test(raw)) raw = raw.replace(/^0+(?=\d)/, '');
                                const val = raw === '' ? '' : parseFloat(raw);
                                setLentPercentage(val);
                                if (numTotal > 0 && typeof val === 'number') {
                                  setLentAmount(Math.round(((numTotal * val) / 100) * 100) / 100);
                                }
                              }}
                              onFocus={(e) => e.target.select()}
                              placeholder="e.g. 50"
                              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 py-2 pl-3 pr-8 text-xs font-mono font-medium text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                            <Percent className="absolute right-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                          </div>
                          {numTotal > 0 && typeof lentPercentage === 'number' && (
                            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 flex justify-between">
                              <span>Calculated cash equivalent:</span>
                              <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                {formatCurrency(
                                  Math.round(((numTotal * lentPercentage) / 100) * 100) / 100,
                                  currency,
                                  false
                                )}
                              </span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick Percentage Presets */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">Quick:</span>
                      {[25, 33.33, 50, 75].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            setLentPercentage(pct);
                            if (numTotal > 0) {
                              setLentAmount(Math.round(((numTotal * pct) / 100) * 100) / 100);
                            }
                          }}
                          className="rounded-md border border-neutral-200 dark:border-neutral-700 px-2 py-0.5 text-[10px] font-mono font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                        >
                          {pct === 33.33 ? '1/3' : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Repayment Date */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Expected Repayment Date (Optional)
                </label>
                <input
                  type="date"
                  value={lentDueDate}
                  onChange={(e) => setLentDueDate(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 focus:border-indigo-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB B: SPLIT WITH MULTIPLE PEOPLE                        */}
          {/* ======================================================== */}
          {splitTarget === 'multiple' && (
            <div className="space-y-3.5">
              {/* Split Method Selector */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Split Method
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setMultiSplitMethod('equal')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border font-medium transition-all cursor-pointer ${
                      multiSplitMethod === 'equal'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200 font-semibold ring-2 ring-indigo-500/20'
                        : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100'
                    }`}
                  >
                    <Equal className="h-3.5 w-3.5" />
                    <span>Split Equally</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMultiSplitMethod('percentage');
                      handleDistributeRemaining();
                    }}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border font-medium transition-all cursor-pointer ${
                      multiSplitMethod === 'percentage'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200 font-semibold ring-2 ring-indigo-500/20'
                        : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100'
                    }`}
                  >
                    <Percent className="h-3.5 w-3.5" />
                    <span>By Percent (%)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMultiSplitMethod('exact');
                      handleDistributeRemaining();
                    }}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border font-medium transition-all cursor-pointer ${
                      multiSplitMethod === 'exact'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200 font-semibold ring-2 ring-indigo-500/20'
                        : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100'
                    }`}
                  >
                    <Coins className="h-3.5 w-3.5" />
                    <span>Exact Amounts</span>
                  </button>
                </div>
              </div>

              {/* Equal split option: Include self */}
              {multiSplitMethod === 'equal' && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-xs">
                  <div>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      Include myself in the equal split
                    </span>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {includeSelfInEqual
                        ? `Divides total bill into ${personSplits.length + 1} shares (you + ${personSplits.length} friends)`
                        : `Divides total bill into ${personSplits.length} shares (friends pay 100% of bill)`}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeSelfInEqual}
                    onChange={(e) => setIncludeSelfInEqual(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
              )}

              {/* List of People in Split */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Participants ({personSplits.length})
                  </label>
                  {(multiSplitMethod === 'percentage' || multiSplitMethod === 'exact') && (
                    <button
                      type="button"
                      onClick={handleDistributeRemaining}
                      className="text-[11px] text-indigo-600 font-medium hover:underline dark:text-indigo-400 cursor-pointer"
                    >
                      Distribute Evenly
                    </button>
                  )}
                </div>

                {personSplits.map((item, idx) => {
                  const usedPersonIds = new Set(
                    personSplits.map((s, i) => (i !== idx ? s.personId : null)).filter(Boolean)
                  );

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xs"
                    >
                      {/* Person Select */}
                      <div className="flex-1 min-w-0">
                        <CustomSelect
                          value={item.personId}
                          onChange={(val) => handleUpdateSplitPerson(idx, val)}
                          className="w-full text-xs"
                          placeholder="-- Select participant --"
                          options={[
                            { value: '', label: '-- Select participant --' },
                            ...people.map((p) => ({
                              value: p.id,
                              label: `${p.name}${p.phone ? ` (${p.phone})` : ''}${
                                usedPersonIds.has(p.id) ? ' (Already added)' : ''
                              }`,
                            })),
                          ]}
                        />
                      </div>

                      {/* Input based on method */}
                      {multiSplitMethod === 'equal' ? (
                        <div className="w-32 shrink-0 text-right px-2">
                          <span className="block font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(
                              includeSelfInEqual
                                ? Math.round((numTotal / (personSplits.length + 1)) * 100) / 100
                                : Math.round((numTotal / personSplits.length) * 100) / 100,
                              currency,
                              false
                            )}
                          </span>
                          <span className="text-[10px] text-neutral-400">
                            {includeSelfInEqual
                              ? `${Math.round((100 / (personSplits.length + 1)) * 10) / 10}%`
                              : `${Math.round((100 / personSplits.length) * 10) / 10}%`}
                          </span>
                        </div>
                      ) : multiSplitMethod === 'percentage' ? (
                        <div className="w-32 shrink-0 flex flex-col items-end">
                          <div className="relative w-full">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              value={item.percentage}
                              onChange={(e) => {
                                let raw = e.target.value;
                                if (raw.length > 1 && /^0\d/.test(raw)) raw = raw.replace(/^0+(?=\d)/, '');
                                handleUpdateSplitPercentage(
                                  idx,
                                  raw === '' ? '' : parseFloat(raw)
                                );
                              }}
                              onFocus={(e) => e.target.select()}
                              placeholder="%"
                              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 py-1.5 pl-2 pr-6 text-xs font-mono font-medium text-neutral-900 dark:text-neutral-100 text-right"
                            />
                            <Percent className="absolute right-2 top-2 h-3 w-3 text-neutral-400 pointer-events-none" />
                          </div>
                          <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                            {formatCurrency(
                              Math.round(((numTotal * (Number(item.percentage) || 0)) / 100) * 100) / 100,
                              currency,
                              false
                            )}
                          </span>
                        </div>
                      ) : (
                        <div className="w-32 shrink-0 flex flex-col items-end">
                          <CurrencyInput
                            value={item.amount}
                            onChange={(val) => handleUpdateSplitAmount(idx, val)}
                            placeholder="Amount"
                            className="text-right"
                          />
                          <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                            {numTotal > 0 && typeof item.amount === 'number'
                              ? `${Math.round(((item.amount / numTotal) * 100) * 10) / 10}%`
                              : '0%'}
                          </span>
                        </div>
                      )}

                      {/* Remove Button */}
                      {personSplits.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSplitRow(item.id)}
                          className="p-1.5 text-neutral-400 hover:text-rose-500 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                          title="Remove from split"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Add Participant and Add New Person Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleAddSplitRow}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-950/20 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Participant</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetSplitIndexForNewPerson(personSplits.length);
                      setShowQuickAddPerson(true);
                    }}
                    className="flex items-center gap-1 py-2 px-3 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>New Contact</span>
                  </button>
                </div>

                {/* Common Expected Repayment Date */}
                <div className="pt-2">
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Expected Repayment Date for All Participants (Optional)
                  </label>
                  <input
                    type="date"
                    value={commonDueDate}
                    onChange={(e) => setCommonDueDate(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 focus:border-indigo-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Quick Add Person Sub-Form Modal/Box */}
          {showQuickAddPerson && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-3 dark:border-indigo-800 dark:bg-indigo-950/50 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                <span>Quick Add New Contact to Debt Ledger</span>
                <button
                  type="button"
                  onClick={() => setShowQuickAddPerson(false)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-sm font-bold"
                >
                  ✕
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter contact name (e.g. John Doe)"
                  value={quickPersonName}
                  onChange={(e) => setQuickPersonName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateQuickPerson();
                    }
                  }}
                  autoFocus
                  className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                />
                <button
                  type="button"
                  onClick={handleCreateQuickPerson}
                  className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs cursor-pointer"
                >
                  Save &amp; Use
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* COMPREHENSIVE LIVE BREAKDOWN & PROGRESS SUMMARY          */}
          {/* ======================================================== */}
          {numTotal > 0 && (
            <div className="rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between font-semibold text-neutral-800 dark:text-neutral-200">
                <span>Split Breakdown Summary</span>
                {effective.hasOverAllocation ? (
                  <span className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-bold">
                    <AlertCircle className="h-3.5 w-3.5" /> Over-allocated
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    <Check className="h-3.5 w-3.5" /> Balanced
                  </span>
                )}
              </div>

              {/* Visual Split Ratio Bar */}
              <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden flex">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (effective.totalLent / numTotal) * 100)}%`,
                  }}
                  title={`Lent: ${formatCurrency(effective.totalLent, currency, false)}`}
                />
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100 - (effective.totalLent / numTotal) * 100, (effective.yourShare / numTotal) * 100)
                    )}%`,
                  }}
                  title={`Your Share: ${formatCurrency(effective.yourShare, currency, false)}`}
                />
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Total Transaction Amount:</span>
                  <span className="font-mono font-medium">{formatCurrency(numTotal, currency, false)}</span>
                </div>

                <div className="flex justify-between text-indigo-700 dark:text-indigo-300 font-semibold">
                  <span>
                    Total Lent to {splitTarget === 'single' ? 'Person' : `${effective.splits.length} People`}:
                  </span>
                  <span className="font-mono">
                    {formatCurrency(effective.totalLent, currency, false)}{' '}
                    <span className="text-[10px] font-normal opacity-80">
                      ({numTotal > 0 ? Math.round(((effective.totalLent / numTotal) * 100) * 10) / 10 : 0}%)
                    </span>
                  </span>
                </div>

                <div className="flex justify-between text-neutral-700 dark:text-neutral-300 border-t border-indigo-100 dark:border-indigo-900/50 pt-1">
                  <span>Your Personal Expense Share:</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(effective.yourShare, currency, false)}{' '}
                    <span className="text-[10px] font-normal opacity-80">
                      ({numTotal > 0 ? Math.round(((effective.yourShare / numTotal) * 100) * 10) / 10 : 0}%)
                    </span>
                  </span>
                </div>

                {effective.hasOverAllocation && (
                  <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 pt-1">
                    Warning: Total allocated shares ({formatCurrency(effective.totalLent, currency, false)}) exceed
                    the total transaction by{' '}
                    {formatCurrency(effective.totalLent - numTotal, currency, false)}. Please adjust values.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
