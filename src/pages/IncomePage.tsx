import React, { useState } from 'react';
import { TrendingUp, Plus, Trash2, Calendar, DollarSign, ArrowDownRight } from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import { CurrencyInput } from '../components/common/CurrencyInput';
import { TagInput } from '../components/common/TagInput';
import { CustomSelect } from '../components/common/CustomSelect';
import { IncomeSource } from '../types';

export const IncomePage: React.FC = () => {
  const { incomes, accounts, addIncome, deleteIncome } = useFinanceStore();
  const { currency, privacyMode } = useSettingsStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [amount, setAmount] = useState<number | ''>('');
  const [source, setSource] = useState<IncomeSource>('Salary');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id || '');

  const nonDeletedIncomes = incomes.filter((i) => !i.isDeleted);
  const totalIncome = nonDeletedIncomes.reduce((sum, i) => sum + i.amount, 0);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    addIncome({
      amount: Number(amount),
      source,
      date,
      note: note || undefined,
      tags,
      isRecurring,
      recurringFrequency: isRecurring ? 'Monthly' : undefined,
      accountId: accountId || undefined,
    });
    setAmount('');
    setNote('');
    setTags([]);
    setAccountId(accounts[0]?.id || '');
    setIsAddModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Income Streams
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Track salaries, freelance retainers, dividends, interest, and gifts
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Income
        </button>
      </div>

      {/* Overview Banner */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
        <span className="text-xs text-neutral-400">Total Recorded Inflow</span>
        <div className="text-3xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
          {formatCurrency(totalIncome, currency, privacyMode)}
        </div>
      </div>

      {/* Income Table */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/75 dark:border-neutral-800 dark:bg-neutral-800/40 text-neutral-500 font-semibold">
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Source</th>
              <th className="py-3 px-4">Note</th>
              <th className="py-3 px-4">Tags</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {nonDeletedIncomes.map((inc) => (
              <tr key={inc.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40">
                <td className="py-3 px-4 font-mono whitespace-nowrap">{formatDate(inc.date)}</td>
                <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">
                  {inc.source}
                </td>
                <td className="py-3 px-4 text-neutral-800 dark:text-neutral-200">{inc.note || '—'}</td>
                <td className="py-3 px-4 text-neutral-500">{inc.tags.join(' · ') || '—'}</td>
                <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                  +{formatCurrency(inc.amount, currency, privacyMode)}
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => deleteIncome(inc.id)}
                    className="p-1 text-neutral-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Income Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Record Income">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Amount
            </label>
            <CurrencyInput value={amount} onChange={setAmount} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Source
              </label>
              <CustomSelect
                value={source}
                onChange={(val) => setSource(val as IncomeSource)}
                className="w-full"
                options={[
                  { value: 'Salary', label: 'Salary' },
                  { value: 'Freelance', label: 'Freelance' },
                  { value: 'Business', label: 'Business' },
                  { value: 'Interest', label: 'Interest' },
                  { value: 'Dividend', label: 'Dividend' },
                  { value: 'Gift', label: 'Gift' },
                  { value: 'Other', label: 'Other' },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          {/* Received Into Account */}
          {accounts.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Received Into Account
              </label>
              <CustomSelect
                value={accountId}
                onChange={setAccountId}
                className="w-full"
                placeholder="— No specific account —"
                options={[
                  { value: '', label: '— No specific account —' },
                  ...accounts.filter((acc) => !acc.isArchived || acc.id === accountId).map((acc) => ({
                    value: acc.id,
                    label: `${acc.name} (${acc.type})${acc.isArchived ? ' [Archived]' : ''}`,
                  })),
                ]}
              />
              <p className="text-[11px] text-neutral-400 mt-1">
                Selecting an account credits this income to that account's balance.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Consulting payment"
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Tags
            </label>
            <TagInput selectedTags={tags} onChange={setTags} />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
            >
              Save Income
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
