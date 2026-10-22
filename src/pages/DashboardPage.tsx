import React, { useState } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, ArrowDownRight, ArrowUpRight,
  Plus, Calendar, CreditCard, Users, Landmark, AlertCircle, Sparkles
} from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { formatCurrency, formatDate, formatPercentage } from '../utils/formatters';
import { ChartCard } from '../components/common/ChartCard';
import { Modal } from '../components/common/Modal';
import { CurrencyInput } from '../components/common/CurrencyInput';
import { TagInput } from '../components/common/TagInput';
import { CustomSelect } from '../components/common/CustomSelect';
import { CardThumbnail, detectCardNetwork } from '../components/cards/CreditCardVisual';
import {
  SplitExpenseSection,
  computeEffectiveSplits,
  PersonSplitItem,
} from '../components/transactions/SplitExpenseSection';
import {
  getFilteredAccountsForPaymentMethod,
  getPaymentMethodAccountMeta,
} from '../utils/paymentMethodUtils';
import { calculateHoldings } from '../utils/investmentUtils';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const {
    expenses, incomes, categories, creditCards, cardPayments,
    people, ledgerEntries, investments, investmentTransactions, priceQuotes,
    budgets, accounts, transfers,
    addExpense, addIncome, addLedgerEntry, addPerson
  } = useFinanceStore();
  const { currency, privacyMode } = useSettingsStore();

  // Quick Add Modal States
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);

  // New Expense form
  const [expAmount, setExpAmount] = useState<number | ''>('');
  const [expAmountError, setExpAmountError] = useState<string | null>(null);
  const [expCategory, setExpCategory] = useState(categories[0]?.id || '');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expPaymentMethod, setExpPaymentMethod] = useState<'Cash' | 'UPI' | 'Debit Card' | 'Credit Card' | 'Net Banking' | 'Wallet'>('UPI');
  const [expCardId, setExpCardId] = useState<string>('');
  const [expAccountId, setExpAccountId] = useState<string>('');
  const [expNote, setExpNote] = useState('');
  const [expTags, setExpTags] = useState<string[]>([]);
  // Split / Lent State in Quick Expense
  const [expIsLent, setExpIsLent] = useState(false);
  const [expSplitTarget, setExpSplitTarget] = useState<'single' | 'multiple'>('single');
  const [expPersonId, setExpPersonId] = useState<string>('');
  const [expLentMode, setExpLentMode] = useState<'full' | 'partial'>('full');
  const [expLentSplitUnit, setExpLentSplitUnit] = useState<'amount' | 'percentage'>('amount');
  const [expLentAmount, setExpLentAmount] = useState<number | ''>('');
  const [expLentPercentage, setExpLentPercentage] = useState<number | ''>('');
  const [expLentDueDate, setExpLentDueDate] = useState<string>('');
  const [expMultiSplitMethod, setExpMultiSplitMethod] = useState<'equal' | 'percentage' | 'exact'>('equal');
  const [expIncludeSelfInEqual, setExpIncludeSelfInEqual] = useState(true);
  const [expPersonSplits, setExpPersonSplits] = useState<PersonSplitItem[]>([]);
  const [expCommonDueDate, setExpCommonDueDate] = useState<string>('');

  // New Income form
  const [incAmount, setIncAmount] = useState<number | ''>('');
  const [incAmountError, setIncAmountError] = useState<string | null>(null);
  const [incSource, setIncSource] = useState<'Salary' | 'Freelance' | 'Business' | 'Interest' | 'Dividend' | 'Gift' | 'Other'>('Salary');
  const [incDate, setIncDate] = useState(new Date().toISOString().split('T')[0]);
  const [incNote, setIncNote] = useState('');
  const [incTags, setIncTags] = useState<string[]>([]);
  const [incAccountId, setIncAccountId] = useState<string>(accounts[0]?.id || '');

  // Current Month calculations
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const todayStr = now.toISOString().split('T')[0];
  const monthName = now.toLocaleString('default', { month: 'long' });

  const nonDeletedExpenses = expenses.filter((e) => !e.isDeleted);
  const nonDeletedIncomes = incomes.filter((i) => !i.isDeleted);

  const monthExpenses = nonDeletedExpenses.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
  });

  const monthIncomes = nonDeletedIncomes.filter((i) => {
    const d = new Date(i.date);
    return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
  });

  const todayExpenses = monthExpenses.filter((e) => e.date === todayStr);

  const totalSpentThisMonth = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const todaySpending = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const daysInMonthSoFar = now.getDate();
  const avgDailySpend = daysInMonthSoFar > 0 ? totalSpentThisMonth / daysInMonthSoFar : 0;
  const totalIncomeThisMonth = monthIncomes.reduce((sum, i) => sum + i.amount, 0);
  const netSavingsThisMonth = totalIncomeThisMonth - totalSpentThisMonth;

  // Monthly Budget (looked up dynamically from store)
  const currentBudgetObj = budgets.find((b) => b.month === currentMonth && b.year === currentYear);
  const monthlyBudget = currentBudgetObj?.overallAmount || 0;
  const remainingBudget = monthlyBudget > 0 ? monthlyBudget - totalSpentThisMonth : 0;
  const budgetSpentPct = monthlyBudget > 0 ? (totalSpentThisMonth / monthlyBudget) * 100 : 0;

  // Net Worth Calculation:
  // Liquid cash (dynamically from accounts) + Investment Portfolio - Card Dues - Borrowed (Net Lent excluded)
  const holdingsData = calculateHoldings(investments, investmentTransactions, priceQuotes);
  const portfolioValue = holdingsData.reduce((sum, h) => sum + h.currentValue, 0);

  let totalCardDues = 0;
  creditCards.forEach((card) => {
    const charges = nonDeletedExpenses
      .filter((e) => e.cardId === card.id)
      .reduce((sum, e) => sum + e.amount, 0);
    const payments = cardPayments
      .filter((p) => p.cardId === card.id)
      .reduce((sum, p) => sum + p.amount, 0);
    totalCardDues += Math.max(0, charges - payments);
  });

  let totalLent = 0;
  let totalBorrowed = 0;
  ledgerEntries
    .filter((l) => !l.isDeleted && !l.isSettled)
    .forEach((l) => {
      if (l.type === 'lent') totalLent += l.amount;
      else if (l.type === 'borrowed') totalBorrowed += l.amount;
    });

  // Calculate actual liquid cash across all active bank accounts and wallets
  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const liquidCash = activeAccounts.reduce((sum, acc) => {
    const accIncomes = nonDeletedIncomes.filter((i) => i.accountId === acc.id).reduce((s, i) => s + i.amount, 0);
    const accExpenses = nonDeletedExpenses.filter((e) => e.accountId === acc.id).reduce((s, e) => s + e.amount, 0);
    const inTransfers = transfers.filter((t) => t.toAccountId === acc.id).reduce((s, t) => s + t.amount, 0);
    const outTransfers = transfers.filter((t) => t.fromAccountId === acc.id).reduce((s, t) => s + t.amount + (t.fee || 0), 0);
    return sum + (acc.openingBalance || 0) + accIncomes + inTransfers - accExpenses - outTransfers;
  }, 0);

  const netWorth = liquidCash + portfolioValue - totalCardDues - totalBorrowed;

  // Highest spending category this month
  const categoryTotals: Record<string, number> = {};
  monthExpenses.forEach((e) => {
    categoryTotals[e.categoryId] = (categoryTotals[e.categoryId] || 0) + e.amount;
  });

  let highestCatId = '';
  let highestCatAmount = 0;
  Object.entries(categoryTotals).forEach(([catId, amt]) => {
    if (amt > highestCatAmount) {
      highestCatAmount = amt;
      highestCatId = catId;
    }
  });
  const highestCategory = categories.find((c) => c.id === highestCatId);
  const highestCatPct = totalSpentThisMonth > 0 ? (highestCatAmount / totalSpentThisMonth) * 100 : 0;

  // Recent transactions (last 6)
  const recentTransactions = [...nonDeletedExpenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expAmount || Number(expAmount) <= 0) {
      setExpAmountError('Please enter a valid expense amount greater than ₹0');
      return;
    }
    setExpAmountError(null);
    const parsedAmount = Number(expAmount);
    const effective = computeEffectiveSplits({
      totalAmount: parsedAmount,
      isLent: expIsLent,
      splitTarget: expSplitTarget,
      lentPersonId: expPersonId,
      lentMode: expLentMode,
      lentSplitUnit: expLentSplitUnit,
      lentAmount: expLentAmount,
      lentPercentage: expLentPercentage,
      lentDueDate: expLentDueDate,
      multiSplitMethod: expMultiSplitMethod,
      includeSelfInEqual: expIncludeSelfInEqual,
      personSplits: expPersonSplits,
      commonDueDate: expCommonDueDate,
    });

    addExpense({
      amount: parsedAmount,
      categoryId: expCategory || categories[0].id,
      date: expDate,
      paymentMethod: expPaymentMethod,
      cardId: expPaymentMethod === 'Credit Card' ? expCardId : undefined,
      accountId: expPaymentMethod !== 'Credit Card' && expAccountId ? expAccountId : undefined,
      personId: effective.splits[0]?.personId || undefined,
      note: expNote || undefined,
      tags: expTags,
      isSplit: effective.isSplit,
      splits: effective.splits.length > 0 ? effective.splits : undefined,
    });

    effective.splits.forEach((split) => {
      if (split.amount > 0) {
        addLedgerEntry({
          personId: split.personId,
          type: 'lent',
          amount: split.amount,
          date: expDate,
          note: expNote
            ? `${expNote} (Split Share${split.percentage ? ` ${split.percentage}%` : ''})`
            : `Split Share (${split.percentage ? `${split.percentage}%` : formatCurrency(split.amount, currency, false)})`,
          dueDate: split.dueDate || undefined,
          isSettled: false,
        });
      }
    });

    setExpAmount('');
    setExpAmountError(null);
    setExpCardId('');
    setExpAccountId('');
    setExpNote('');
    setExpTags([]);
    setExpIsLent(false);
    setExpSplitTarget('single');
    setExpPersonId('');
    setExpLentMode('full');
    setExpLentSplitUnit('amount');
    setExpLentAmount('');
    setExpLentPercentage('');
    setExpLentDueDate('');
    setExpMultiSplitMethod('equal');
    setExpIncludeSelfInEqual(true);
    setExpPersonSplits([]);
    setExpCommonDueDate('');
    setIsExpenseModalOpen(false);
  };

  const handleCreateIncome = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incAmount || Number(incAmount) <= 0) {
      setIncAmountError('Please enter a valid income amount greater than ₹0');
      return;
    }
    setIncAmountError(null);
    addIncome({
      amount: Number(incAmount),
      source: incSource,
      date: incDate,
      note: incNote || undefined,
      tags: incTags,
      accountId: incAccountId || undefined,
    });
    setIncAmount('');
    setIncAmountError(null);
    setIncNote('');
    setIncTags([]);
    setIncAccountId(accounts[0]?.id || '');
    setIsIncomeModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner Action Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Financial Overview
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {monthName} {currentYear} · Real-time portfolio &amp; expense telemetry
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsIncomeModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors shadow-xs"
          >
            <ArrowDownRight className="h-3.5 w-3.5 text-emerald-600" />
            + Income
          </button>
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Net Worth Dominant Visual Anchor Card */}
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
              <Landmark className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Total Estimated Net Worth</span>
              <span className="text-[10px] text-neutral-400">· Cash + Investments - Liabilities</span>
            </div>
            <div className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 font-mono tabular-nums">
              {formatCurrency(netWorth, currency, privacyMode)}
            </div>
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              Includes cash, ₹{privacyMode ? '•••' : (portfolioValue / 1000).toFixed(0)}k in investments, minus ₹{privacyMode ? '•••' : (totalCardDues / 1000).toFixed(1)}k card dues
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto border-t md:border-t-0 md:border-l border-neutral-100 dark:border-neutral-800 pt-4 md:pt-0 md:pl-6">
            <div>
              <span className="text-[11px] text-neutral-400 block">Liquid Cash</span>
              <span className="text-sm font-semibold font-mono tabular-nums text-neutral-800 dark:text-neutral-200">
                {formatCurrency(liquidCash, currency, privacyMode)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-neutral-400 block">Investments</span>
              <span className="text-sm font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(portfolioValue, currency, privacyMode)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-neutral-400 block">Card Dues</span>
              <span className="text-sm font-semibold font-mono tabular-nums text-rose-600 dark:text-rose-400">
                {formatCurrency(totalCardDues, currency, privacyMode)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-neutral-400 block">Net Lent</span>
              <span className="text-sm font-semibold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                {formatCurrency(totalLent - totalBorrowed, currency, privacyMode)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Monthly KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Spent This Month */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2">
            <span>Spent This Month</span>
            <ArrowUpRight className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-neutral-900 dark:text-neutral-100">
            {formatCurrency(totalSpentThisMonth, currency, privacyMode)}
          </div>
          <div className="mt-2 text-xs text-neutral-500 flex items-center justify-between">
            <span>Today: {formatCurrency(todaySpending, currency, privacyMode)}</span>
            <span>Avg: {formatCurrency(avgDailySpend, currency, privacyMode)}/day</span>
          </div>
        </div>

        {/* Income This Month */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2">
            <span>Income This Month</span>
            <ArrowDownRight className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-neutral-900 dark:text-neutral-100">
            {formatCurrency(totalIncomeThisMonth, currency, privacyMode)}
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            <span>Net Savings: </span>
            <span className={`font-semibold font-mono ${netSavingsThisMonth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(netSavingsThisMonth, currency, privacyMode)}
            </span>
          </div>
        </div>

        {/* Remaining Budget */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2">
            <span>Remaining Budget</span>
            <span className="font-mono text-[11px] font-semibold">
              {budgetSpentPct.toFixed(0)}% used
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-neutral-900 dark:text-neutral-100">
            {formatCurrency(remainingBudget, currency, privacyMode)}
          </div>
          <div className="mt-2.5 h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                budgetSpentPct > 90 ? 'bg-rose-500' : budgetSpentPct > 75 ? 'bg-amber-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${Math.min(100, budgetSpentPct)}%` }}
            />
          </div>
        </div>

        {/* Highest Category */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2">
            <span>Top Category</span>
            <span className="text-[11px] text-neutral-400">{highestCatPct.toFixed(0)}% of total</span>
          </div>
          <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100 truncate">
            {highestCategory?.name || 'Rent & Housing'}
          </div>
          <div className="mt-2 text-xs text-neutral-500 font-mono tabular-nums">
            {formatCurrency(highestCatAmount, currency, privacyMode)} spent
          </div>
        </div>
      </div>

      {/* Middle Grid: Recent Transactions & Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions List (2 columns wide) */}
        <div className="lg:col-span-2 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Recent Expenses
              </h3>
              <p className="text-xs text-neutral-500">Live synchronized telemetry</p>
            </div>
            <button
              onClick={() => onNavigate('/transactions')}
              className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              View all ({nonDeletedExpenses.length})
            </button>
          </div>

          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {recentTransactions.map((exp) => {
              const cat = categories.find((c) => c.id === exp.categoryId);
              return (
                <div key={exp.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-white font-bold text-xs"
                      style={{ backgroundColor: cat?.color || '#6366F1' }}
                    >
                      {cat?.name?.[0] || 'E'}
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                        {exp.note || cat?.name || 'Expense'}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                        <span>{cat?.name || 'General'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDate(exp.date)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{exp.paymentMethod}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold font-mono tabular-nums text-neutral-900 dark:text-neutral-100">
                      -{formatCurrency(exp.amount, currency, privacyMode)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Mini Widgets */}
        <div className="flex flex-col gap-4">
          {/* Card Dues Reminder Widget */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                <CreditCard className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>Credit Card Statements</span>
              </div>
              <button
                onClick={() => onNavigate('/cards')}
                className="text-[11px] text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Manage
              </button>
            </div>
            <div className="space-y-2">
              {creditCards.map((card) => {
                const charged = nonDeletedExpenses
                  .filter((e) => e.cardId === card.id)
                  .reduce((sum, e) => sum + e.amount, 0);
                const paid = cardPayments
                  .filter((p) => p.cardId === card.id)
                  .reduce((sum, p) => sum + p.amount, 0);
                const outstanding = Math.max(0, charged - paid);

                const normNick = (card.nickname || '').trim();
                const normIssuer = (card.issuer || '').trim();
                const isSameIssuer =
                  !normIssuer ||
                  normNick.toLowerCase() === normIssuer.toLowerCase() ||
                  normNick.toLowerCase().includes(normIssuer.toLowerCase());

                return (
                  <div
                    key={card.id}
                    onClick={() => onNavigate('/cards')}
                    className={`group flex items-center justify-between rounded-xl bg-neutral-50/80 p-2.5 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/50 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/80 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all cursor-pointer ${
                      card.isClosed ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Compact Card Thumbnail */}
                      <CardThumbnail card={card} />

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className={`text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate ${
                              card.isClosed ? 'line-through text-neutral-400' : ''
                            }`}
                          >
                            {card.nickname}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                            (··{card.last4})
                          </span>
                          {card.isClosed && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shrink-0">
                              Closed
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                          {isSameIssuer
                            ? `Payment due on ${card.paymentDueDay}th`
                            : `${card.issuer} · Due on ${card.paymentDueDay}th`}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-3">
                      <span
                        className={`text-xs font-bold font-mono tabular-nums block ${
                          outstanding > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {formatCurrency(outstanding, currency, privacyMode)}
                      </span>
                      <span className="text-[9px] text-neutral-400 uppercase tracking-wider font-semibold">
                        {outstanding > 0 ? 'Due' : 'Settled'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* People Ledger Due Widget */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Pending People Dues</span>
              </div>
              <button
                onClick={() => onNavigate('/people')}
                className="text-[11px] text-indigo-600 hover:underline dark:text-indigo-400"
              >
                View
              </button>
            </div>
            {/* Dynamic Pending People Dues */}
            {(() => {
              const activeLedger = ledgerEntries.filter((l) => !l.isDeleted && !l.isSettled);
              // Compute net balance per person
              const netByPerson: Record<string, number> = {};
              activeLedger.forEach((l) => {
                const sign = l.type === 'lent' ? 1 : -1;
                netByPerson[l.personId] = (netByPerson[l.personId] || 0) + sign * l.amount;
              });
              const sortedPeople = Object.entries(netByPerson)
                .map(([personId, net]) => ({ personId, net, person: people.find((p) => p.id === personId && !p.isDeleted) }))
                .filter((x) => x.person)
                .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
                .slice(0, 3);

              if (sortedPeople.length === 0) {
                return (
                  <p className="text-xs text-neutral-400 italic text-center py-2">
                    No pending dues — all settled!
                  </p>
                );
              }
              return (
                <div className="space-y-2">
                  {sortedPeople.map(({ personId, net, person }) => (
                    <div key={personId} className="flex items-center justify-between text-xs">
                      <span className="text-neutral-700 dark:text-neutral-300">
                        {net > 0 ? `${person!.name} owes you` : `You owe ${person!.name}`}
                      </span>
                      <span className={`font-semibold font-mono ${
                        net > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {net > 0 ? '+' : ''}{formatCurrency(Math.abs(net), currency, privacyMode)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Dynamic Portfolio Snapshot */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                <Landmark className="h-4 w-4 text-violet-600" />
                <span>Portfolio Watch</span>
              </div>
              <button
                onClick={() => onNavigate('/investments')}
                className="text-[11px] text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Holdings
              </button>
            </div>
            {(() => {
              const activeInvestments = investments.filter((inv) => !inv.isDeleted);
              const withQuotes = activeInvestments
                .map((inv) => ({ inv, quote: priceQuotes[inv.symbol] }))
                .filter((x) => x.quote)
                .slice(0, 4);

              if (withQuotes.length === 0) {
                return (
                  <p className="text-xs text-neutral-400 italic text-center py-2">
                    No investments tracked yet.
                  </p>
                );
              }
              return (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {withQuotes.map(({ inv, quote }) => (
                    <div key={inv.id} className="rounded-md bg-neutral-50 p-2 dark:bg-neutral-800/60">
                      <span className="text-[10px] text-neutral-400 block truncate">{inv.symbol}</span>
                      <span className={`font-semibold font-mono ${
                        quote!.dayChangePct >= 0 ? 'text-emerald-600' : 'text-rose-500'
                      }`}>
                        {quote!.dayChangePct >= 0 ? '+' : ''}{quote!.dayChangePct.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title="Add Expense"
        subtitle="Saved securely to your vault"
        maxWidth={expIsLent ? "max-w-4xl" : "max-w-lg"}
      >
        <form noValidate onSubmit={handleCreateExpense} className="flex flex-col gap-4">
          <div className={expIsLent ? "grid grid-cols-1 md:grid-cols-12 gap-5 items-start" : "flex flex-col gap-4"}>
            {/* Primary Details */}
            <div className={expIsLent ? "md:col-span-5 flex flex-col gap-3.5" : "contents"}>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Amount *
                </label>
                <CurrencyInput
                  value={expAmount}
                  onChange={(val) => {
                    setExpAmount(val);
                    if (expAmountError) setExpAmountError(null);
                  }}
                  placeholder="0.00"
                  hasError={!!expAmountError}
                />
                {expAmountError && <p className="text-[11px] font-medium text-rose-500 mt-1">{expAmountError}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Category
                  </label>
                  <CustomSelect
                    value={expCategory}
                    onChange={setExpCategory}
                    className="w-full"
                    placeholder="Choose category..."
                    options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 focus:border-indigo-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>

              {(() => {
                const filteredAccounts = getFilteredAccountsForPaymentMethod(accounts, expPaymentMethod);
                const accountMeta = getPaymentMethodAccountMeta(expPaymentMethod);

                return (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Payment Method
                      </label>
                      <CustomSelect
                        value={expPaymentMethod}
                        onChange={(v) => {
                          const newMethod = v as any;
                          setExpPaymentMethod(newMethod);
                          if (newMethod === 'Credit Card') {
                            setExpAccountId('');
                          } else {
                            setExpCardId('');
                            const matching = getFilteredAccountsForPaymentMethod(accounts, newMethod);
                            if (!matching.some((a) => a.id === expAccountId)) {
                              setExpAccountId(matching.length === 1 ? matching[0].id : '');
                            }
                          }
                        }}
                        className="w-full"
                        options={[
                          { value: 'UPI', label: 'UPI' },
                          { value: 'Credit Card', label: 'Credit Card' },
                          { value: 'Debit Card', label: 'Debit Card' },
                          { value: 'Net Banking', label: 'Net Banking' },
                          { value: 'Cash', label: 'Cash' },
                          { value: 'Wallet', label: 'Wallet' },
                        ]}
                      />
                    </div>

                    {expPaymentMethod === 'Credit Card' ? (
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                          Select Card
                        </label>
                        <CustomSelect
                          value={expCardId}
                          onChange={setExpCardId}
                          className="w-full"
                          placeholder="Choose card..."
                          options={[
                            { value: '', label: 'Choose card...' },
                            ...creditCards
                              .filter((c) => !c.isClosed)
                              .map((c) => ({
                                value: c.id,
                                label: `${c.nickname} (··${c.last4})`,
                              })),
                          ]}
                        />
                      </div>
                    ) : filteredAccounts.length > 0 ? (
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                          {accountMeta.label}
                        </label>
                        <CustomSelect
                          value={expAccountId}
                          onChange={setExpAccountId}
                          className="w-full"
                          placeholder={accountMeta.noneLabel}
                          options={[
                            { value: '', label: accountMeta.noneLabel },
                            ...filteredAccounts.map((acc) => ({
                              value: acc.id,
                              label: `${acc.name} (${acc.type})${acc.isArchived ? ' [Archived]' : ''}`,
                            })),
                          ]}
                        />
                      </div>
                    ) : expPaymentMethod === 'Cash' ? (
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                          Source
                        </label>
                        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-300">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span>Physical Cash (Out of pocket)</span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                          {accountMeta.label}
                        </label>
                        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <span>{accountMeta.emptyNotice} </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsExpenseModalOpen(false);
                              onNavigate('/accounts');
                            }}
                            className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline inline cursor-pointer"
                          >
                            + Add in Accounts
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Note
                </label>
                <input
                  type="text"
                  value={expNote}
                  onChange={(e) => setExpNote(e.target.value)}
                  placeholder="e.g. Organic produce at market"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 focus:border-indigo-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Tags
                </label>
                <TagInput selectedTags={expTags} onChange={setExpTags} />
              </div>
            </div>

            {/* Split / Debt Ledger Details */}
            <div className={expIsLent ? "md:col-span-7 flex flex-col gap-3.5" : "contents"}>
              <SplitExpenseSection
                totalAmount={expAmount}
                currency={currency}
                people={people}
                onAddPerson={addPerson}
                isLent={expIsLent}
                setIsLent={setExpIsLent}
                splitTarget={expSplitTarget}
                setSplitTarget={setExpSplitTarget}
                lentPersonId={expPersonId}
                setLentPersonId={setExpPersonId}
                lentMode={expLentMode}
                setLentMode={setExpLentMode}
                lentSplitUnit={expLentSplitUnit}
                setLentSplitUnit={setExpLentSplitUnit}
                lentAmount={expLentAmount}
                setLentAmount={setExpLentAmount}
                lentPercentage={expLentPercentage}
                setLentPercentage={setExpLentPercentage}
                lentDueDate={expLentDueDate}
                setLentDueDate={setExpLentDueDate}
                multiSplitMethod={expMultiSplitMethod}
                setMultiSplitMethod={setExpMultiSplitMethod}
                includeSelfInEqual={expIncludeSelfInEqual}
                setIncludeSelfInEqual={setExpIncludeSelfInEqual}
                personSplits={expPersonSplits}
                setPersonSplits={setExpPersonSplits}
                commonDueDate={expCommonDueDate}
                setCommonDueDate={setExpCommonDueDate}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsExpenseModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors shadow-xs"
            >
              Save Expense
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Income Modal */}
      <Modal
        isOpen={isIncomeModalOpen}
        onClose={() => setIsIncomeModalOpen(false)}
        title="Add Income"
        subtitle="Record earnings, freelancing, dividends or gifts"
      >
        <form noValidate onSubmit={handleCreateIncome} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Amount *
            </label>
            <CurrencyInput
              value={incAmount}
              onChange={(val) => {
                setIncAmount(val);
                if (incAmountError) setIncAmountError(null);
              }}
              placeholder="0.00"
              hasError={!!incAmountError}
            />
            {incAmountError && <p className="text-[11px] font-medium text-rose-500 mt-1">{incAmountError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Source
              </label>
              <CustomSelect
                value={incSource}
                onChange={(v) => setIncSource(v as any)}
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
                value={incDate}
                onChange={(e) => setIncDate(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 focus:border-indigo-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Note
            </label>
            <input
              type="text"
              value={incNote}
              onChange={(e) => setIncNote(e.target.value)}
              placeholder="e.g. Monthly salary credit"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 focus:border-indigo-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          {accounts.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Received Into Account
              </label>
              <CustomSelect
                value={incAccountId}
                onChange={setIncAccountId}
                className="w-full"
                placeholder="— No specific account —"
                options={[
                  { value: '', label: '— No specific account —' },
                  ...accounts
                    .filter((a) => !a.isArchived || a.id === incAccountId)
                    .map((acc) => ({
                      value: acc.id,
                      label: `${acc.name} (${acc.type})${acc.isArchived ? ' [Archived]' : ''}`,
                    })),
                ]}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Tags
            </label>
            <TagInput selectedTags={incTags} onChange={setIncTags} />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsIncomeModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors shadow-xs"
            >
              Save Income
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
