import React, { useState, useMemo } from 'react';
import {
  Search, Filter, Plus, Copy, Trash2, Edit3, ArrowUpRight, ArrowDownRight,
  RotateCcw, SlidersHorizontal, ChevronLeft, ChevronRight, X, Users
} from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { CurrencyInput } from '../components/common/CurrencyInput';
import { TagInput } from '../components/common/TagInput';
import { CustomSelect } from '../components/common/CustomSelect';
import { PaymentMethod, RecurringFrequency } from '../types';
import {
  SplitExpenseSection,
  computeEffectiveSplits,
  PersonSplitItem,
} from '../components/transactions/SplitExpenseSection';
import {
  getFilteredAccountsForPaymentMethod,
  getPaymentMethodAccountMeta,
} from '../utils/paymentMethodUtils';

export const TransactionsPage: React.FC = () => {
  const {
    expenses, incomes, categories, tags, creditCards, people, ledgerEntries, accounts,
    addExpense, updateExpense, deleteExpense, duplicateExpense,
    addIncome, updateIncome, deleteIncome, addLedgerEntry, addPerson
  } = useFinanceStore();
  const { currency, privacyMode } = useSettingsStore();

  // Unified items
  const nonDeletedExpenses = useMemo(() => expenses.filter((e) => !e.isDeleted), [expenses]);
  const nonDeletedIncomes = useMemo(() => incomes.filter((i) => !i.isDeleted), [incomes]);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [cardFilter, setCardFilter] = useState<string>('all');
  const [personFilter, setPersonFilter] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [tagMatchMode, setTagMatchMode] = useState<'OR' | 'AND'>('OR');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id?: string; type: 'expense' | 'income' } | null>(null);

  // Form State
  const [formType, setFormType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState<number | ''>('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [incomeSource, setIncomeSource] = useState<string>('Salary');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [cardId, setCardId] = useState<string>('');
  const [personId, setPersonId] = useState<string>('');
  const [note, setNote] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('Monthly');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Split / Lent State
  const [isLent, setIsLent] = useState(false);
  const [splitTarget, setSplitTarget] = useState<'single' | 'multiple'>('single');
  const [lentPersonId, setLentPersonId] = useState<string>('');
  const [lentMode, setLentMode] = useState<'full' | 'partial'>('full');
  const [lentSplitUnit, setLentSplitUnit] = useState<'amount' | 'percentage'>('amount');
  const [lentAmount, setLentAmount] = useState<number | ''>('');
  const [lentPercentage, setLentPercentage] = useState<number | ''>('');
  const [lentDueDate, setLentDueDate] = useState<string>('');
  const [multiSplitMethod, setMultiSplitMethod] = useState<'equal' | 'percentage' | 'exact'>('equal');
  const [includeSelfInEqual, setIncludeSelfInEqual] = useState(true);
  const [personSplits, setPersonSplits] = useState<PersonSplitItem[]>([]);
  const [commonDueDate, setCommonDueDate] = useState<string>('');

  // Delete Confirmation
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'expense' | 'income' } | null>(null);

  // Combine and normalize items
  const combinedList = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'expense' | 'income';
      amount: number;
      date: string;
      note?: string;
      tags: string[];
      categoryId?: string;
      paymentMethod?: PaymentMethod;
      cardId?: string;
      accountId?: string;
      personId?: string;
      source?: string;
      isRecurring?: boolean;
    }> = [];

    if (typeFilter !== 'income') {
      nonDeletedExpenses.forEach((e) => {
        list.push({ ...e, type: 'expense' });
      });
    }

    if (typeFilter !== 'expense') {
      nonDeletedIncomes.forEach((i) => {
        list.push({ ...i, type: 'income' });
      });
    }

    return list;
  }, [nonDeletedExpenses, nonDeletedIncomes, typeFilter]);

  // Filtered List
  const filteredList = useMemo(() => {
    return combinedList.filter((item) => {
      // Search note, category name, or person name
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const noteMatch = item.note?.toLowerCase().includes(term);
        const cat = categories.find((c) => c.id === item.categoryId);
        const catMatch = cat?.name.toLowerCase().includes(term);
        const person = people.find((p) => p.id === item.personId);
        const personMatch = person?.name.toLowerCase().includes(term);
        const tagMatch = item.tags.some((t) => t.toLowerCase().includes(term));
        if (!noteMatch && !catMatch && !personMatch && !tagMatch) return false;
      }

      // Category
      if (categoryFilter !== 'all' && item.type === 'expense' && item.categoryId !== categoryFilter) {
        return false;
      }

      // Method
      if (methodFilter !== 'all' && item.type === 'expense' && item.paymentMethod !== methodFilter) {
        return false;
      }

      // Card
      if (cardFilter !== 'all' && item.type === 'expense' && item.cardId !== cardFilter) {
        return false;
      }

      // Person
      if (personFilter !== 'all' && item.type === 'expense' && item.personId !== personFilter) {
        return false;
      }

      // Tag
      if (selectedTag !== 'all' && !item.tags.includes(selectedTag)) {
        return false;
      }

      // Date Range
      if (startDate && item.date < startDate) return false;
      if (endDate && item.date > endDate) return false;

      // Amount Range
      if (minAmount && item.amount < parseFloat(minAmount)) return false;
      if (maxAmount && item.amount > parseFloat(maxAmount)) return false;

      return true;
    });
  }, [
    combinedList, searchTerm, categoryFilter, methodFilter, cardFilter,
    personFilter, selectedTag, startDate, endDate, minAmount, maxAmount, categories, people
  ]);

  // Sorted List
  const sortedList = useMemo(() => {
    return [...filteredList].sort((a, b) => {
      if (sortField === 'date') {
        const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
        return sortOrder === 'desc' ? diff : -diff;
      } else {
        const diff = b.amount - a.amount;
        return sortOrder === 'desc' ? diff : -diff;
      }
    });
  }, [filteredList, sortField, sortOrder]);

  // Pagination slice
  const totalPages = Math.ceil(sortedList.length / pageSize) || 1;
  const paginatedList = sortedList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openAddModal = (type: 'expense' | 'income' = 'expense') => {
    setEditingItem(null);
    setFormType(type);
    setAmount('');
    setAmountError(null);
    setCategoryId(categories[0]?.id || '');
    setIncomeSource('Salary');
    setDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('UPI');
    setCardId('');
    setPersonId('');
    setNote('');
    setFormTags([]);
    setIsRecurring(false);
    setRecurringFrequency('Monthly');
    setSelectedAccountId('');
    setIsLent(false);
    setSplitTarget('single');
    setLentPersonId(people[0]?.id || '');
    setLentMode('full');
    setLentSplitUnit('amount');
    setLentAmount('');
    setLentPercentage('');
    setLentDueDate('');
    setMultiSplitMethod('equal');
    setIncludeSelfInEqual(true);
    setPersonSplits([]);
    setCommonDueDate('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setEditingItem({ id: item.id, type: item.type });
    setFormType(item.type);
    setAmount(item.amount);
    setAmountError(null);
    setDate(item.date);
    setNote(item.note || '');
    setFormTags([...item.tags]);
    setIsRecurring(!!item.isRecurring);
    setRecurringFrequency(item.recurringFrequency || 'Monthly');
    setSelectedAccountId(item.accountId || '');

    if (item.type === 'expense') {
      setCategoryId(item.categoryId || categories[0]?.id);
      setPaymentMethod(item.paymentMethod || 'UPI');
      setCardId(item.cardId || '');
      setPersonId(item.personId || '');

      if (item.splits && item.splits.length > 1) {
        setIsLent(true);
        setSplitTarget('multiple');
        setPersonSplits(
          item.splits.map((s: any, idx: number) => ({
            id: `split_${Date.now()}_${idx}`,
            personId: s.personId,
            amount: s.amount,
            percentage: s.percentage || (item.amount > 0 ? Math.round(((s.amount / item.amount) * 100) * 10) / 10 : ''),
            dueDate: s.dueDate || '',
          }))
        );
        setMultiSplitMethod('exact');
      } else {
        const relatedLedger = ledgerEntries.find(
          (l) => !l.isDeleted && l.personId === item.personId && l.date === item.date && l.type === 'lent'
        );
        if (item.personId || relatedLedger) {
          setIsLent(true);
          setSplitTarget('single');
          setLentPersonId(item.personId || relatedLedger?.personId || people[0]?.id || '');
          if (relatedLedger && relatedLedger.amount < item.amount) {
            setLentMode('partial');
            setLentSplitUnit('amount');
            setLentAmount(relatedLedger.amount);
            setLentPercentage(item.amount > 0 ? Math.round(((relatedLedger.amount / item.amount) * 100) * 10) / 10 : '');
          } else {
            setLentMode('full');
            setLentAmount(relatedLedger ? relatedLedger.amount : item.amount);
            setLentPercentage(100);
          }
          setLentDueDate(relatedLedger?.dueDate || '');
        } else {
          setIsLent(false);
          setSplitTarget('single');
          setLentPersonId(people[0]?.id || '');
          setLentMode('full');
          setLentSplitUnit('amount');
          setLentAmount('');
          setLentPercentage('');
          setLentDueDate('');
        }
      }
    } else {
      setIncomeSource(item.source || 'Salary');
      setIsLent(false);
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setAmountError('Please enter a valid transaction amount greater than ₹0');
      return;
    }
    setAmountError(null);
    const parsedAmount = Number(amount);    if (editingItem?.id) {
      if (formType === 'expense') {
        const effective = computeEffectiveSplits({
          totalAmount: parsedAmount,
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

        updateExpense(editingItem.id, {
          amount: parsedAmount,
          categoryId,
          date,
          paymentMethod,
          cardId: paymentMethod === 'Credit Card' ? cardId : undefined,
          accountId: paymentMethod !== 'Credit Card' && selectedAccountId ? selectedAccountId : undefined,
          personId: effective.splits[0]?.personId || undefined,
          note: note || undefined,
          tags: formTags,
          isRecurring,
          recurringFrequency: isRecurring ? recurringFrequency : undefined,
          isSplit: effective.isSplit,
          splits: effective.splits.length > 0 ? effective.splits : undefined,
        });

        effective.splits.forEach((split) => {
          if (split.amount > 0) {
            addLedgerEntry({
              personId: split.personId,
              type: 'lent',
              amount: split.amount,
              date,
              note: note
                ? `${note} (Split Share${split.percentage ? ` ${split.percentage}%` : ''})`
                : `Split Share (${split.percentage ? `${split.percentage}%` : formatCurrency(split.amount, currency, false)})`,
              dueDate: split.dueDate || undefined,
              isSettled: false,
            });
          }
        });
      } else {
        updateIncome(editingItem.id, {
          amount: parsedAmount,
          source: incomeSource as any,
          date,
          accountId: selectedAccountId || undefined,
          note: note || undefined,
          tags: formTags,
          isRecurring,
          recurringFrequency: isRecurring ? recurringFrequency : undefined,
        });
      }
    } else {
      if (formType === 'expense') {
        const effective = computeEffectiveSplits({
          totalAmount: parsedAmount,
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

        addExpense({
          amount: parsedAmount,
          categoryId: categoryId || categories[0]?.id,
          date,
          paymentMethod,
          cardId: paymentMethod === 'Credit Card' ? cardId : undefined,
          accountId: paymentMethod !== 'Credit Card' && selectedAccountId ? selectedAccountId : undefined,
          personId: effective.splits[0]?.personId || undefined,
          note: note || undefined,
          tags: formTags,
          isRecurring,
          recurringFrequency: isRecurring ? recurringFrequency : undefined,
          isSplit: effective.isSplit,
          splits: effective.splits.length > 0 ? effective.splits : undefined,
        });

        effective.splits.forEach((split) => {
          if (split.amount > 0) {
            addLedgerEntry({
              personId: split.personId,
              type: 'lent',
              amount: split.amount,
              date,
              note: note
                ? `${note} (Split Share${split.percentage ? ` ${split.percentage}%` : ''})`
                : `Split Share (${split.percentage ? `${split.percentage}%` : formatCurrency(split.amount, currency, false)})`,
              dueDate: split.dueDate || undefined,
              isSettled: false,
            });
          }
        });
      } else {
        addIncome({
          amount: parsedAmount,
          source: incomeSource as any,
          date,
          accountId: selectedAccountId || undefined,
          note: note || undefined,
          tags: formTags,
          isRecurring,
          recurringFrequency: isRecurring ? recurringFrequency : undefined,
        });
      }
    }

    setIsLent(false);
    setSplitTarget('single');
    setLentPersonId('');
    setLentMode('full');
    setLentSplitUnit('amount');
    setLentAmount('');
    setLentPercentage('');
    setLentDueDate('');
    setMultiSplitMethod('equal');
    setIncludeSelfInEqual(true);
    setPersonSplits([]);
    setCommonDueDate('');
    setIsModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'expense') {
      deleteExpense(itemToDelete.id);
    } else {
      deleteIncome(itemToDelete.id);
    }
    setItemToDelete(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            All Transactions
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Unified ledger · Protected with 30-day recoverable trash
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilterDrawer(!showFilterDrawer)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              showFilterDrawer
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-300'
                : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-100'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </button>
          <button
            onClick={() => openAddModal('income')}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors shadow-xs"
          >
            <ArrowDownRight className="h-3.5 w-3.5 text-emerald-600" />
            + Income
          </button>
          <button
            onClick={() => openAddModal('expense')}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by note, category, person, or tag..."
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50/50 py-2 pl-9 pr-3 text-xs text-neutral-900 focus:border-indigo-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>

          {/* Segmented Type Filter */}
          <div className="flex items-center rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
            <button
              onClick={() => setTypeFilter('all')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === 'all'
                  ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-900 dark:text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTypeFilter('expense')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === 'expense'
                  ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-900 dark:text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
              }`}
            >
              Expenses
            </button>
            <button
              onClick={() => setTypeFilter('income')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === 'income'
                  ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-900 dark:text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
              }`}
            >
              Income
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters Drawer */}
        {showFilterDrawer && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-xs">
            {/* Category Filter */}
            <div>
              <label className="block text-neutral-500 mb-1">Category</label>
              <CustomSelect
                value={categoryFilter}
                onChange={setCategoryFilter}
                className="w-full"
                options={[
                  { value: 'all', label: 'All Categories' },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>

            {/* Payment Method Filter */}
            <div>
              <label className="block text-neutral-500 mb-1">Payment Method</label>
              <CustomSelect
                value={methodFilter}
                onChange={setMethodFilter}
                className="w-full"
                options={[
                  { value: 'all', label: 'All Methods' },
                  { value: 'UPI', label: 'UPI' },
                  { value: 'Credit Card', label: 'Credit Card' },
                  { value: 'Debit Card', label: 'Debit Card' },
                  { value: 'Net Banking', label: 'Net Banking' },
                  { value: 'Cash', label: 'Cash' },
                  { value: 'Wallet', label: 'Wallet' },
                ]}
              />
            </div>

            {/* Credit Card Filter */}
            <div>
              <label className="block text-neutral-500 mb-1">Linked Card</label>
              <CustomSelect
                value={cardFilter}
                onChange={setCardFilter}
                className="w-full"
                options={[
                  { value: 'all', label: 'All Cards' },
                  ...creditCards.map((c) => ({
                    value: c.id,
                    label: `${c.nickname} (··${c.last4})${c.isClosed ? ' [Closed]' : ''}`,
                  })),
                ]}
              />
            </div>

            {/* Linked Person Filter */}
            <div>
              <label className="block text-neutral-500 mb-1">Person</label>
              <CustomSelect
                value={personFilter}
                onChange={setPersonFilter}
                className="w-full"
                options={[
                  { value: 'all', label: 'All People' },
                  ...people.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </div>

            {/* Date Range Start & End */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-neutral-500 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white p-1.5 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                />
              </div>
              <div className="flex-1">
                <label className="block text-neutral-500 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white p-1.5 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                />
              </div>
            </div>

            {/* Amount Range */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-neutral-500 mb-1">Min Amount</label>
                <input
                  type="number"
                  placeholder="0"
                  value={minAmount}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val.length > 1 && /^0\d/.test(val)) val = val.replace(/^0+(?=\d)/, '');
                    setMinAmount(val);
                  }}
                  onFocus={(e) => e.target.select()}
                  className="w-full rounded-lg border border-neutral-300 bg-white p-1.5 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 font-mono tabular-nums"
                />
              </div>
              <div className="flex-1">
                <label className="block text-neutral-500 mb-1">Max Amount</label>
                <input
                  type="number"
                  placeholder="100000"
                  value={maxAmount}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val.length > 1 && /^0\d/.test(val)) val = val.replace(/^0+(?=\d)/, '');
                    setMaxAmount(val);
                  }}
                  onFocus={(e) => e.target.select()}
                  className="w-full rounded-lg border border-neutral-300 bg-white p-1.5 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 font-mono tabular-nums"
                />
              </div>
            </div>

            {/* Tag Filter */}
            <div>
              <label className="block text-neutral-500 mb-1">Tag</label>
              <CustomSelect
                value={selectedTag}
                onChange={setSelectedTag}
                className="w-full"
                options={[
                  { value: 'all', label: 'All Tags' },
                  ...tags.map((t) => ({ value: t.name, label: t.name })),
                ]}
              />
            </div>

            {/* Clear All */}
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('all');
                  setMethodFilter('all');
                  setCardFilter('all');
                  setPersonFilter('all');
                  setSelectedTag('all');
                  setStartDate('');
                  setEndDate('');
                  setMinAmount('');
                  setMaxAmount('');
                  setSearchTerm('');
                }}
                className="w-full rounded-lg border border-neutral-300 bg-neutral-50 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* High-Density Data Grid Table */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/75 dark:border-neutral-800 dark:bg-neutral-800/40 text-neutral-500 dark:text-neutral-400">
                <th className="py-3 px-4 font-semibold">
                  <button
                    onClick={() => {
                      if (sortField === 'date') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortField('date'); setSortOrder('desc'); }
                    }}
                    className="flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100"
                  >
                    Date
                    {sortField === 'date' && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
                  </button>
                </th>
                <th className="py-3 px-4 font-semibold">Type &amp; Note</th>
                <th className="py-3 px-4 font-semibold">Category / Source</th>
                <th className="py-3 px-4 font-semibold">Method / Entity</th>
                <th className="py-3 px-4 font-semibold">Tags</th>
                <th className="py-3 px-4 font-semibold text-right">
                  <button
                    onClick={() => {
                      if (sortField === 'amount') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortField('amount'); setSortOrder('desc'); }
                    }}
                    className="inline-flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100"
                  >
                    Amount
                    {sortField === 'amount' && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
                  </button>
                </th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    No transactions match your current search or filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedList.map((item) => {
                  const cat = categories.find((c) => c.id === item.categoryId);
                  const card = creditCards.find((c) => c.id === item.cardId);
                  const acc = accounts.find((a) => a.id === item.accountId);
                  const person = people.find((p) => p.id === item.personId);

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap text-neutral-600 dark:text-neutral-300 font-mono">
                        {formatDate(item.date)}
                      </td>

                      {/* Note & Type indicator */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                              item.type === 'expense'
                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                            }`}
                          >
                            {item.type === 'expense' ? '−' : '+'}
                          </span>
                          <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-xs">
                            {item.note || (item.type === 'expense' ? cat?.name : item.source)}
                          </span>
                        </div>
                      </td>

                      {/* Category or Source */}
                      <td className="py-3 px-4 text-neutral-600 dark:text-neutral-300">
                        {item.type === 'expense' ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: cat?.color || '#6366F1' }}
                            />
                            <span>{cat?.name || 'General'}</span>
                          </div>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {item.source}
                          </span>
                        )}
                      </td>

                      {/* Method or Linked Card/Person */}
                      <td className="py-3 px-4 text-neutral-500 dark:text-neutral-400">
                        {item.type === 'expense' ? (
                          <div className="flex flex-col text-[11px]">
                            <span>{item.paymentMethod}</span>
                            {card && (
                              <span className="text-neutral-400">
                                {card.nickname} (··{card.last4})
                              </span>
                            )}
                            {acc && !card && (
                              <span className="text-neutral-400">
                                {acc.name}
                              </span>
                            )}
                            {(item as any).splits && (item as any).splits.length > 1 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                                <Users className="h-3 w-3" />
                                <span>Split ({(item as any).splits.length} people)</span>
                              </span>
                            ) : person ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                                <Users className="h-3 w-3" />
                                <span>Lent to {person.name}</span>
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex flex-col text-[11px]">
                            <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                              {acc ? `Deposited to ${acc.name}` : 'Bank Deposit'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Tags (Zero-Pill Discipline: Unboxed clean text metadata) */}
                      <td className="py-3 px-4">
                        {item.tags.length > 0 ? (
                          <span className="text-neutral-500 text-[11px]">
                            {item.tags.join(' · ')}
                          </span>
                        ) : (
                          <span className="text-neutral-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-mono tabular-nums font-semibold ${
                            item.type === 'expense'
                              ? 'text-neutral-900 dark:text-neutral-100'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {item.type === 'expense' ? '-' : '+'}
                          {formatCurrency(item.amount, currency, privacyMode)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            title="Edit"
                            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          {item.type === 'expense' && (
                            <button
                              onClick={() => duplicateExpense(item.id)}
                              title="Duplicate"
                              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setItemToDelete({ id: item.id, type: item.type })}
                            title="Delete"
                            className="rounded p-1 text-neutral-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3 dark:border-neutral-800 text-xs text-neutral-500">
          <span>
            Showing {Math.min((currentPage - 1) * pageSize + 1, sortedList.length)}–
            {Math.min(currentPage * pageSize, sortedList.length)} of {sortedList.length} items
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded p-1 text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-mono">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded p-1 text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Transaction Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? `Edit ${formType === 'expense' ? 'Expense' : 'Income'}` : `Add ${formType === 'expense' ? 'Expense' : 'Income'}`}
        subtitle="Saved securely to your vault"
        maxWidth={formType === 'expense' && isLent ? "max-w-4xl" : "max-w-lg"}
      >
        <form noValidate onSubmit={handleSave} className="flex flex-col gap-4">
          <div className={formType === 'expense' && isLent ? "grid grid-cols-1 md:grid-cols-12 gap-5 items-start" : "flex flex-col gap-4"}>
            {/* Primary Details */}
            <div className={formType === 'expense' && isLent ? "md:col-span-5 flex flex-col gap-3.5" : "contents"}>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Amount *
                </label>
                <CurrencyInput
                  value={amount}
                  onChange={(val) => {
                    setAmount(val);
                    if (amountError) setAmountError(null);
                  }}
                  hasError={!!amountError}
                />
                {amountError && <p className="text-[11px] font-medium text-rose-500 mt-1">{amountError}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {formType === 'expense' ? (
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Category
                    </label>
                    <CustomSelect
                      value={categoryId}
                      onChange={setCategoryId}
                      className="w-full"
                      placeholder="Select category..."
                      options={categories.map((c) => ({ value: c.id, label: c.name }))}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Source
                    </label>
                    <CustomSelect
                      value={incomeSource}
                      onChange={setIncomeSource}
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
                )}

                {formType === 'income' && accounts.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Received Into Account
                    </label>
                    <CustomSelect
                      value={selectedAccountId}
                      onChange={setSelectedAccountId}
                      className="w-full"
                      placeholder="— No specific account —"
                      options={[
                        { value: '', label: '— No specific account —' },
                        ...accounts
                          .filter((a) => !a.isArchived || a.id === selectedAccountId)
                          .map((acc) => ({
                            value: acc.id,
                            label: `${acc.name} (${acc.type})${acc.isArchived ? ' [Archived]' : ''}`,
                          })),
                      ]}
                    />
                    <p className="text-[11px] text-neutral-400 mt-1">
                      Credits this amount to the chosen bank account/wallet balance.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>

              {formType === 'expense' && (
                <div className="grid grid-cols-2 gap-3">
                  {(() => {
                    const filteredAccounts = getFilteredAccountsForPaymentMethod(accounts, paymentMethod);
                    const accountMeta = getPaymentMethodAccountMeta(paymentMethod);

                    return (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                            Payment Method
                          </label>
                          <CustomSelect
                            value={paymentMethod}
                            onChange={(v) => {
                              const newMethod = v as any;
                              setPaymentMethod(newMethod);
                              if (newMethod === 'Credit Card') {
                                setSelectedAccountId('');
                              } else {
                                setCardId('');
                                const matching = getFilteredAccountsForPaymentMethod(accounts, newMethod);
                                if (!matching.some((a) => a.id === selectedAccountId)) {
                                  setSelectedAccountId(matching.length === 1 ? matching[0].id : '');
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

                        {paymentMethod === 'Credit Card' && (
                          <div>
                            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                              Select Card
                            </label>
                            <CustomSelect
                              value={cardId}
                              onChange={setCardId}
                              className="w-full"
                              placeholder="Choose card..."
                              options={[
                                { value: '', label: 'Choose card...' },
                                ...creditCards
                                  .filter((c) => !c.isClosed || c.id === cardId)
                                  .map((c) => ({
                                    value: c.id,
                                    label: `${c.nickname} (··${c.last4})${c.isClosed ? ' [Closed]' : ''}`,
                                  })),
                              ]}
                            />
                          </div>
                        )}

                        {paymentMethod !== 'Credit Card' && (
                          filteredAccounts.length > 0 ? (
                            <div>
                              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                                {accountMeta.label}
                              </label>
                              <CustomSelect
                                value={selectedAccountId}
                                onChange={setSelectedAccountId}
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
                          ) : paymentMethod === 'Cash' ? (
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
                                <span>{accountMeta.emptyNotice}</span>
                              </div>
                            </div>
                          )
                        )}
                      </>
                    );
                  })()}
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
                  placeholder="e.g. Flight tickets to Delhi"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Tags
                </label>
                <TagInput selectedTags={formTags} onChange={setFormTags} />
              </div>
            </div>

            {/* Split with Percent & Multiple Person Section */}
            <div className={formType === 'expense' && isLent ? "md:col-span-7 flex flex-col gap-3.5" : "contents"}>
              {formType === 'expense' && (
                <SplitExpenseSection
                  totalAmount={amount}
                  currency={currency}
                  people={people}
                  onAddPerson={addPerson}
                  isLent={isLent}
                  setIsLent={setIsLent}
                  splitTarget={splitTarget}
                  setSplitTarget={setSplitTarget}
                  lentPersonId={lentPersonId}
                  setLentPersonId={setLentPersonId}
                  lentMode={lentMode}
                  setLentMode={setLentMode}
                  lentSplitUnit={lentSplitUnit}
                  setLentSplitUnit={setLentSplitUnit}
                  lentAmount={lentAmount}
                  setLentAmount={setLentAmount}
                  lentPercentage={lentPercentage}
                  setLentPercentage={setLentPercentage}
                  lentDueDate={lentDueDate}
                  setLentDueDate={setLentDueDate}
                  multiSplitMethod={multiSplitMethod}
                  setMultiSplitMethod={setMultiSplitMethod}
                  includeSelfInEqual={includeSelfInEqual}
                  setIncludeSelfInEqual={setIncludeSelfInEqual}
                  personSplits={personSplits}
                  setPersonSplits={setPersonSplits}
                  commonDueDate={commonDueDate}
                  setCommonDueDate={setCommonDueDate}
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-xs"
            >
              Save Transaction
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog with Undo assurance */}
      <ConfirmDialog
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Transaction"
        message="Are you sure you want to delete this record? It will be moved to recoverable trash for 30 days and can be undone immediately."
        confirmLabel="Move to Trash"
      />
    </div>
  );
};
