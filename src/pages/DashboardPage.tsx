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

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const {
    expenses, incomes, categories, creditCards, cardPayments,
    people, ledgerEntries, investments, priceQuotes,
    budgets, accounts, transfers,
    addExpense, addIncome, addLedgerEntry, addPerson
  } = useFinanceStore();
  const { currency, privacyMode } = useSettingsStore();

  // Quick Add Modal States
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);

  // New Expense form
  const [expAmount, setExpAmount] = useState<number | ''>('');
  const [expCategory, setExpCategory] = useState(categories[0]?.id || '');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expPaymentMethod, setExpPaymentMethod] = useState<'Cash' | 'UPI' | 'Debit Card' | 'Credit Card' | 'Net Banking' | 'Wallet'>('UPI');
  const [expCardId, setExpCardId] = useState<string>('');
  const [expNote, setExpNote] = useState('');
  const [expTags, setExpTags] = useState<string[]>([]);
  const [expPersonId, setExpPersonId] = useState<string>('');
  const [expIsLent, setExpIsLent] = useState(false);
  const [expLentMode, setExpLentMode] = useState<'full' | 'partial'>('full');
  const [expLentAmount, setExpLentAmount] = useState<number | ''>('');
  const [expLentDueDate, setExpLentDueDate] = useState<string>('');

  // New Income form
  const [incAmount, setIncAmount] = useState<number | ''>('');
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
  let portfolioValue = 0;
  investments.forEach((inv) => {
    const quote = priceQuotes[inv.symbol];
    if (quote) {
      portfolioValue += quote.price * 10; // aggregate holdings
    }
  });

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
    if (!expAmount || Number(expAmount) <= 0) return;
    const parsedAmount = Number(expAmount);
    const effectiveLent = expIsLent && expPersonId
      ? (expLentMode === 'full' ? parsedAmount : Math.min(parsedAmount, Number(expLentAmount) || 0))
      : 0;

    addExpense({
      amount: parsedAmount,
      categoryId: expCategory || categories[0].id,
      date: expDate,
      paymentMethod: expPaymentMethod,
      cardId: expPaymentMethod === 'Credit Card' ? expCardId : undefined,
      personId: expIsLent && expPersonId ? expPersonId : undefined,
      note: expNote || undefined,
      tags: expTags,
      isSplit: effectiveLent > 0 && effectiveLent < parsedAmount,
    });

    if (effectiveLent > 0 && expPersonId) {
      addLedgerEntry({
        personId: expPersonId,
        type: 'lent',
        amount: effectiveLent,
        date: expDate,
        note: expNote ? `${expNote} (Lent via Quick Add)` : 'Lent via Quick Add',
        dueDate: expLentDueDate || undefined,
        isSettled: false,
      });
    }

    setExpAmount('');
    setExpNote('');
    setExpTags([]);
    setExpIsLent(false);
    setExpPersonId('');
    setExpLentMode('full');
    setExpLentAmount('');
    setExpLentDueDate('');
    setIsExpenseModalOpen(false);
  };

  const handleCreateIncome = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incAmount || Number(incAmount) <= 0) return;
    addIncome({
      amount: Number(incAmount),
      source: incSource,
      date: incDate,
      note: incNote || undefined,
      tags: incTags,
      accountId: incAccountId || undefined,
    });
    setIncAmount('');
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
            <div className="space-y-2.5">
              {creditCards.map((card) => {
                const charged = nonDeletedExpenses
                  .filter((e) => e.cardId === card.id)
                  .reduce((sum, e) => sum + e.amount, 0);
                const paid = cardPayments
                  .filter((p) => p.cardId === card.id)
                  .reduce((sum, p) => sum + p.amount, 0);
                const outstanding = Math.max(0, charged - paid);
                return (
                  <div
                    key={card.id}
                    className={`flex items-center justify-between rounded-lg bg-neutral-50 p-2.5 dark:bg-neutral-800/60 ${
                      card.isClosed ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-medium text-neutral-800 dark:text-neutral-200 ${card.isClosed ? 'line-through text-neutral-400' : ''}`}>
                          {card.nickname} (··{card.last4})
                        </span>
                        {card.isClosed && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Closed
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-neutral-400">
                        Due Day: {card.paymentDueDay}th of month
                      </span>
                    </div>
                    <span className="text-xs font-semibold font-mono tabular-nums text-rose-600 dark:text-rose-400">
                      {formatCurrency(outstanding, currency, privacyMode)}
                    </span>
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
      >
        <form onSubmit={handleCreateExpense} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Amount
            </label>
            <CurrencyInput
              value={expAmount}
              onChange={setExpAmount}
              placeholder="0.00"
              required
            />
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
                required
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 focus:border-indigo-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Payment Method
              </label>
              <CustomSelect
                value={expPaymentMethod}
                onChange={(v) => setExpPaymentMethod(v as any)}
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

            {expPaymentMethod === 'Credit Card' && (
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
            )}
          </div>

          {/* Lent to Person Section */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/40 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <label htmlFor="exp-is-lent-toggle" className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 cursor-pointer">
                    Lend to a Person
                  </label>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Track full or partial amount in People Debt Ledger
                  </p>
                </div>
              </div>
              <input
                id="exp-is-lent-toggle"
                type="checkbox"
                checked={expIsLent}
                onChange={(e) => {
                  setExpIsLent(e.target.checked);
                  if (e.target.checked) {
                    if (!expPersonId && people.length > 0) {
                      setExpPersonId(people[0].id);
                    }
                    if (expLentMode === 'full' && expAmount) {
                      setExpLentAmount(Number(expAmount));
                    }
                  }
                }}
                className="h-4 w-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>

            {expIsLent && (
              <div className="space-y-3 pt-2 border-t border-neutral-200/70 dark:border-neutral-700/60">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Select Person
                  </label>
                  {people.length === 0 ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      No people found in People Ledger. Go to People Ledger to add persons.
                    </p>
                  ) : (
                    <CustomSelect
                      value={expPersonId}
                      onChange={setExpPersonId}
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

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Lent Amount
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setExpLentMode('full');
                        setExpLentAmount(expAmount ? Number(expAmount) : '');
                      }}
                      className={`rounded-lg py-1.5 px-3 text-xs font-medium border text-center transition-colors ${
                        expLentMode === 'full'
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-700 dark:text-indigo-300 font-semibold'
                          : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800'
                      }`}
                    >
                      Full Amount ({expAmount ? formatCurrency(Number(expAmount), currency, false) : 'Total'})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExpLentMode('partial');
                        if (!expLentAmount || Number(expLentAmount) >= Number(expAmount)) {
                          setExpLentAmount(expAmount ? Math.round(Number(expAmount) / 2) : '');
                        }
                      }}
                      className={`rounded-lg py-1.5 px-3 text-xs font-medium border text-center transition-colors ${
                        expLentMode === 'partial'
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-700 dark:text-indigo-300 font-semibold'
                          : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800'
                      }`}
                    >
                      Partial / Split Amount
                    </button>
                  </div>

                  {expLentMode === 'partial' && (
                    <CurrencyInput
                      value={expLentAmount}
                      onChange={(val) => setExpLentAmount(val)}
                      placeholder="Enter amount lent"
                    />
                  )}

                  {expAmount && Number(expAmount) > 0 && expPersonId && (
                    <div className="mt-2 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 p-2.5 text-[11px] space-y-1">
                      <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
                        <span>Total Paid:</span>
                        <span className="font-mono font-medium">{formatCurrency(Number(expAmount), currency, false)}</span>
                      </div>
                      <div className="flex justify-between text-indigo-600 dark:text-indigo-400 font-semibold">
                        <span>Lent to {people.find((p) => p.id === expPersonId)?.name || 'Person'}:</span>
                        <span className="font-mono">
                          {formatCurrency(
                            expLentMode === 'full' ? Number(expAmount) : Math.min(Number(expAmount), Number(expLentAmount) || 0),
                            currency,
                            false
                          )}
                        </span>
                      </div>
                      {expLentMode === 'partial' && Number(expLentAmount) < Number(expAmount) && (
                        <div className="flex justify-between text-neutral-500 dark:text-neutral-400 border-t border-indigo-100 dark:border-indigo-900/50 pt-1">
                          <span>Personal Expense Share:</span>
                          <span className="font-mono font-medium">
                            {formatCurrency(Number(expAmount) - Math.min(Number(expAmount), Number(expLentAmount) || 0), currency, false)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Expected Repayment Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={expLentDueDate}
                    onChange={(e) => setExpLentDueDate(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 focus:border-indigo-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>
            )}
          </div>

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
        <form onSubmit={handleCreateIncome} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Amount
            </label>
            <CurrencyInput
              value={incAmount}
              onChange={setIncAmount}
              placeholder="0.00"
              required
            />
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
                required
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
