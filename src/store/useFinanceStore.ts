import { create } from 'zustand';
import {
  Expense, Income, Category, Tag, Budget, CreditCard,
  CardPayment, CardEMI, Person, LedgerEntry, Investment,
  InvestmentTransaction, PriceQuote, AppNotification,
  Account, Transfer, SavingsGoal, SubscriptionItem, AutoRuleItem,
  SIPScheduleItem, SMSInboxItem, HouseholdMemberItem
} from '../types';
import { apiClient } from '../api/client';
import { offlineDb } from '../utils/offlineDb';
import { yahooLiveStreamer } from '../utils/yahooLiveStreamer';
import { getMarketStatus } from '../utils/marketHours';

interface DeletedRecordItem {
  id: string;
  type: 'expense' | 'income' | 'category' | 'ledger' | 'investment' | 'account' | 'goal';
  data: any;
  timestamp: number;
}

interface FinanceState {
  isSyncing: boolean;
  fetchFromBackend: () => Promise<void>;

  // Phase 1 Data
  accounts: Account[];
  transfers: Transfer[];
  expenses: Expense[];
  incomes: Income[];
  categories: Category[];
  tags: Tag[];
  budgets: Budget[];
  creditCards: CreditCard[];
  cardPayments: CardPayment[];
  cardEmis: CardEMI[];
  people: Person[];
  ledgerEntries: LedgerEntry[];
  investments: Investment[];
  investmentTransactions: InvestmentTransaction[];
  priceQuotes: Record<string, PriceQuote>;
  notifications: AppNotification[];
  dismissedNotificationIds: string[];
  undoQueue: DeletedRecordItem[];

  // Phase 2-6 Data
  goals: SavingsGoal[];
  subscriptions: SubscriptionItem[];
  rules: AutoRuleItem[];
  sips: SIPScheduleItem[];
  smsInbox: SMSInboxItem[];
  householdMembers: HouseholdMemberItem[];

  // Accounts & Transfers
  addAccount: (acc: Omit<Account, 'id'>) => void;
  updateAccount: (id: string, acc: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  reconcileAccount: (id: string, actualBalance: number) => void;
  addTransfer: (transfer: Omit<Transfer, 'id' | 'createdAt'>) => void;

  // Expenses & Incomes
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  updateExpense: (id: string, expense: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  restoreExpense: (id: string) => void;
  duplicateExpense: (id: string) => void;

  addIncome: (income: Omit<Income, 'id' | 'createdAt'>) => void;
  updateIncome: (id: string, income: Partial<Income>) => void;
  deleteIncome: (id: string) => void;

  // Split Expense
  addSplitExpense: (expenseData: Omit<Expense, 'id' | 'createdAt'>, splits: { personId: string; amount: number }[]) => void;

  // Categories & Tags
  addCategory: (cat: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, cat: Partial<Category>) => void;
  deleteCategory: (id: string, reassignCategoryId?: string) => void;
  resetCategoriesToDefault: () => void;
  addTag: (name: string, color?: string) => void;
  renameTag: (oldName: string, newName: string) => void;
  mergeTags: (sourceName: string, targetName: string) => void;
  deleteTag: (name: string) => void;

  // Budgets
  setOverallBudget: (month: number, year: number, amount: number) => void;
  setCategoryBudget: (categoryId: string, amount: number) => void;

  // Credit Cards
  addCreditCard: (card: Omit<CreditCard, 'id'>) => void;
  updateCreditCard: (id: string, card: Partial<CreditCard>) => void;
  deleteCreditCard: (id: string) => void;
  recordCardPayment: (cardId: string, amount: number, paymentSource: string, note?: string) => void;
  addCardEmi: (emi: Omit<CardEMI, 'id'>) => void;

  // People Ledger
  addPerson: (person: Omit<Person, 'id'>) => void;
  updatePerson: (id: string, person: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  addLedgerEntry: (entry: Omit<LedgerEntry, 'id' | 'createdAt'>) => void;
  deleteLedgerEntry: (id: string) => void;
  settlePersonDebt: (personId: string) => void;

  // Investments
  addInvestment: (inv: Omit<Investment, 'id'>) => void;
  updateInvestment: (id: string, updates: Partial<Investment>) => void;
  deleteInvestment: (id: string) => void;
  addInvestmentTransaction: (tx: Omit<InvestmentTransaction, 'id' | 'createdAt'>) => void;
  updatePriceQuote: (symbol: string, price: number, dayChangePct: number, isManual?: boolean) => void;
  bulkImportHoldings: (holdings: any[], mode?: 'merge' | 'replace') => Promise<{ success: boolean; count: number }>;
  syncLivePrices: (symbols?: string[]) => Promise<void>;
  isLiveStreamActive: boolean;
  startLiveStream: () => void;
  stopLiveStream: () => void;
  toggleLiveStream: () => void;
  syncWithMarketHours: (marketRegion?: string, autoSync?: boolean) => void;

  // Goals
  addGoal: (goal: Omit<SavingsGoal, 'id'>) => void;
  contributeToGoal: (goalId: string, amount: number, fromAccountId?: string) => void;

  // Subscriptions & Rules
  addSubscription: (sub: Omit<SubscriptionItem, 'id'>) => void;
  dismissSubscription: (id: string) => void;
  addRule: (rule: Omit<AutoRuleItem, 'id'>) => void;
  deleteRule: (id: string) => void;

  // SIPs & Ingest
  addSip: (sip: Omit<SIPScheduleItem, 'id'>) => void;
  acceptSmsTransaction: (inboxId: string, categoryId: string, accountId?: string) => void;
  dismissSms: (inboxId: string) => void;

  // Notifications
  addNotification: (notification: { title: string; message: string; type: AppNotification['type'] }) => void;
  checkAndGenerateDueReminders: (leadDays?: number) => AppNotification[];
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAllNotifications: () => void;

  // Undo System
  undoLastDelete: () => void;
  dismissUndo: (id: string) => void;

  // Backup & Restore
  exportAllData: () => any;
  importAllData: (data: any, mode: 'merge' | 'replace') => void;
  clearAllData: () => Promise<void>;
}

const DEFAULT_ACCOUNTS: Account[] = [];

export const DEFAULT_FIXED_CATEGORIES: Category[] = [
  { id: 'cat_housing', name: 'Housing & Rent', icon: 'Home', color: '#6366F1', monthlyBudget: 0 },
  { id: 'cat_food', name: 'Food & Dining', icon: 'Utensils', color: '#F97316', monthlyBudget: 0 },
  { id: 'cat_groceries', name: 'Groceries & Essentials', icon: 'ShoppingCart', color: '#10B981', monthlyBudget: 0 },
  { id: 'cat_transit', name: 'Transportation & Fuel', icon: 'Car', color: '#3B82F6', monthlyBudget: 0 },
  { id: 'cat_utilities', name: 'Utilities & Bills', icon: 'Zap', color: '#EC4899', monthlyBudget: 0 },
  { id: 'cat_healthcare', name: 'Health & Medical', icon: 'HeartPulse', color: '#EF4444', monthlyBudget: 0 },
  { id: 'cat_shopping', name: 'Shopping & Lifestyle', icon: 'ShoppingBag', color: '#8B5CF6', monthlyBudget: 0 },
  { id: 'cat_entertainment', name: 'Entertainment & Leisure', icon: 'Film', color: '#14B8A6', monthlyBudget: 0 },
  { id: 'cat_subscriptions', name: 'Subscriptions & Software', icon: 'CreditCard', color: '#F59E0B', monthlyBudget: 0 },
  { id: 'cat_investments', name: 'Investments & Savings', icon: 'TrendingUp', color: '#059669', monthlyBudget: 0 },
  { id: 'cat_education', name: 'Education & Courses', icon: 'GraduationCap', color: '#84CC16', monthlyBudget: 0 },
  { id: 'cat_personal', name: 'Personal Care & Wellness', icon: 'Smile', color: '#06B6D4', monthlyBudget: 0 },
  { id: 'cat_travel', name: 'Travel & Holidays', icon: 'Plane', color: '#0EA5E9', monthlyBudget: 0 },
  { id: 'cat_gifts', name: 'Gifts & Charity', icon: 'Gift', color: '#D946EF', monthlyBudget: 0 },
  { id: 'cat_other', name: 'Miscellaneous', icon: 'MoreHorizontal', color: '#64748B', monthlyBudget: 0 },
];

export const DEFAULT_TAGS: Tag[] = [
  { id: 'tag_1', name: 'Personal', color: '#3B82F6' },
  { id: 'tag_2', name: 'Work', color: '#10B981' },
  { id: 'tag_3', name: 'Urgent', color: '#EF4444' },
  { id: 'tag_4', name: 'Tax Deductible', color: '#8B5CF6' },
  { id: 'tag_5', name: 'Family', color: '#F59E0B' },
  { id: 'tag_6', name: 'Delivery', color: '#EC4899' },
  { id: 'tag_7', name: 'Reimbursable', color: '#06B6D4' },
];

export const DEFAULT_EXPENSES: Expense[] = [];
export const DEFAULT_INCOMES: Income[] = [];
export const DEFAULT_CREDIT_CARDS: CreditCard[] = [];
export const DEFAULT_PEOPLE: Person[] = [];
export const DEFAULT_LEDGER: LedgerEntry[] = [];
export const DEFAULT_INVESTMENTS: Investment[] = [];
export const DEFAULT_INVESTMENT_TXS: InvestmentTransaction[] = [];
export const DEFAULT_PRICE_QUOTES: Record<string, PriceQuote> = {};
export const DEFAULT_BUDGETS: Budget[] = [];
const DEFAULT_TRANSFERS: Transfer[] = [];
const DEFAULT_GOALS: SavingsGoal[] = [];
const DEFAULT_SUBSCRIPTIONS: SubscriptionItem[] = [];
const DEFAULT_RULES: AutoRuleItem[] = [];
const DEFAULT_SIPS: SIPScheduleItem[] = [];
const DEFAULT_SMS_INBOX: SMSInboxItem[] = [];
const DEFAULT_HOUSEHOLD: HouseholdMemberItem[] = [];

export const useFinanceStore = create<FinanceState>((set, get) => {
  const loadState = () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('finvault_finance_store_v2');
        localStorage.removeItem('kuber_finance_store_v2');
        const saved = localStorage.getItem('finvault_finance_store_v3');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed.investments)) {
            // Strip out legacy mock/default investments
            parsed.investments = parsed.investments.filter(
              (i: any) => !['inv_rel', 'inv_tcs', 'inv_hdfcb', 'inv_ppfcf', 'inv_hdfc100', 'inv_axismid', 'inv_sbi_fd', 'inv_hdfc_fd', 'inv_icici_rd', 'inv_sgb_23', 'inv_sgb_22', 'inv_gsec_33', 'inv_lt_ncd', 'inv_embassy', 'inv_brookfield', 'inv_ppf', 'inv_nps', 'inv_btc', 'inv_eth'].includes(i.id)
            );
          }
          if (Array.isArray(parsed.investmentTransactions)) {
            parsed.investmentTransactions = parsed.investmentTransactions.filter(
              (t: any) => !['tx_1', 'tx_2', 'tx_3', 'tx_4', 'tx_5', 'tx_6', 'tx_7', 'tx_8', 'tx_9', 'tx_10', 'tx_11', 'tx_12', 'tx_13', 'tx_14', 'tx_15', 'tx_16', 'tx_17', 'tx_18', 'tx_19'].includes(t.id)
            );
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  const initial = loadState();

  return {
    accounts: initial?.accounts ?? [],
    transfers: initial?.transfers ?? [],
    expenses: initial?.expenses ?? [],
    incomes: initial?.incomes ?? [],
    categories: initial?.categories && initial.categories.length > 0 ? initial.categories : DEFAULT_FIXED_CATEGORIES,
    tags: initial?.tags && initial.tags.length > 0 ? initial.tags : DEFAULT_TAGS,
    budgets: initial?.budgets ?? [],
    creditCards: initial?.creditCards ?? [],
    cardPayments: initial?.cardPayments ?? [],
    cardEmis: initial?.cardEmis ?? [],
    people: initial?.people ?? [],
    ledgerEntries: initial?.ledgerEntries ?? [],
    investments: initial?.investments ?? [],
    investmentTransactions: initial?.investmentTransactions ?? [],
    priceQuotes: initial?.priceQuotes ?? {},
    notifications: initial?.notifications ?? [],
    dismissedNotificationIds: initial?.dismissedNotificationIds ?? [],
    undoQueue: [],

    // Phase 2 State
    goals: initial?.goals ?? [],
    subscriptions: initial?.subscriptions ?? [],
    rules: initial?.rules ?? [],
    sips: initial?.sips ?? [],
    smsInbox: initial?.smsInbox ?? [],
    householdMembers: initial?.householdMembers ?? [],

    isSyncing: false,
    isLiveStreamActive: typeof window !== 'undefined' ? localStorage.getItem('finvault_live_ticker_active') === 'true' : false,
    fetchFromBackend: async () => {
      try {
        set({ isSyncing: true });
        const data = await apiClient.sync();
        set((state) => ({
          accounts: data.accounts,
          transfers: data.transfers,
          expenses: data.expenses,
          incomes: data.incomes,
          categories: data.categories.length > 0 ? data.categories : state.categories,
          creditCards: data.creditCards,
          cardPayments: data.cardPayments,
          people: data.people,
          ledgerEntries: data.ledgerEntries,
          budgets: data.budgets,
          investments: data.investments ?? [],
          investmentTransactions: data.investmentTransactions ?? [],
          isSyncing: false,
        }));
        if (get().isLiveStreamActive) {
          get().startLiveStream();
        }
      } catch (err) {
        console.error('Failed to sync from backend:', err);
        set({ isSyncing: false });
      }
    },

    // Accounts
    addAccount: async (acc) => {
      const tempId = `acc_${Date.now()}`;
      const newAcc: Account = { ...acc, id: tempId };
      set((state) => ({ accounts: [...state.accounts, newAcc] }));
      try {
        const saved = await apiClient.createAccount(acc);
        set((state) => ({
          accounts: state.accounts.map((a) => (a.id === tempId ? saved : a)),
        }));
      } catch (e) {
        console.error('Backend addAccount error:', e);
      }
    },
    updateAccount: async (id, updated) => {
      set((state) => ({
        accounts: state.accounts.map((a) => (a.id === id ? { ...a, ...updated } : a)),
      }));
      try {
        await apiClient.updateAccount(id, updated);
      } catch (e) {
        console.error('Backend updateAccount error:', e);
      }
    },
    deleteAccount: async (id) => {
      set((state) => ({
        accounts: state.accounts.filter((a) => a.id !== id),
      }));
      try {
        await apiClient.deleteAccount(id);
      } catch (e) {
        console.error('Backend deleteAccount error:', e);
      }
    },
    reconcileAccount: (id, actualBalance) => {
      // Calculates discrepancy and logs adjustment if non-zero
      set((state) => {
        const acc = state.accounts.find((a) => a.id === id);
        if (!acc) return state;

        // Current calculated balance
        const inAmt = state.incomes.filter((i) => i.accountId === id && !i.isDeleted).reduce((s, i) => s + i.amount, 0);
        const exAmt = state.expenses.filter((e) => e.accountId === id && !e.isDeleted).reduce((s, e) => s + e.amount, 0);
        const trIn = state.transfers.filter((t) => t.toAccountId === id).reduce((s, t) => s + t.amount, 0);
        const trOut = state.transfers.filter((t) => t.fromAccountId === id).reduce((s, t) => s + t.amount, 0);
        const calcBal = acc.openingBalance + inAmt + trIn - exAmt - trOut;

        const diff = actualBalance - calcBal;
        let nextExpenses = state.expenses;
        let nextIncomes = state.incomes;

        if (diff < 0) {
          // Add reconciliation expense adjustment
          nextExpenses = [
            {
              id: `exp_adj_${Date.now()}`,
              amount: Math.abs(diff),
              categoryId: 'cat_other',
              date: new Date().toISOString().split('T')[0],
              paymentMethod: 'Net Banking',
              accountId: id,
              note: 'Reconciliation Balance Adjustment (Excluded from budget)',
              tags: ['Reconciliation'],
              createdAt: new Date().toISOString(),
            },
            ...nextExpenses,
          ];
        } else if (diff > 0) {
          nextIncomes = [
            {
              id: `inc_adj_${Date.now()}`,
              amount: diff,
              source: 'Other',
              date: new Date().toISOString().split('T')[0],
              accountId: id,
              note: 'Reconciliation Balance Adjustment',
              tags: ['Reconciliation'],
              createdAt: new Date().toISOString(),
            },
            ...nextIncomes,
          ];
        }

        return {
          expenses: nextExpenses,
          incomes: nextIncomes,
          accounts: state.accounts.map((a) =>
            a.id === id ? { ...a, lastReconciledAt: new Date().toISOString() } : a
          ),
        };
      });
    },

    addTransfer: async (transferData) => {
      const tempId = `tr_${Date.now()}`;
      const newTransfer: Transfer = {
        ...transferData,
        id: tempId,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({ transfers: [newTransfer, ...state.transfers] }));
      try {
        const saved = await apiClient.createTransfer(transferData);
        set((state) => ({
          transfers: state.transfers.map((t) => (t.id === tempId ? saved : t)),
        }));
      } catch (e) {
        console.error('Backend addTransfer error:', e);
      }
    },

    // Expenses
    addExpense: async (expenseData) => {
      const tempId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const newExpense: Expense = {
        ...expenseData,
        id: tempId,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({ expenses: [newExpense, ...state.expenses] }));
      try {
        const saved = await apiClient.createExpense(expenseData);
        set((state) => ({
          expenses: state.expenses.map((e) => (e.id === tempId ? saved : e)),
        }));
      } catch (e) {
        console.error('Backend addExpense error:', e);
      }
    },
    updateExpense: async (id, updated) => {
      set((state) => ({
        expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...updated } : e)),
      }));
      try {
        await apiClient.updateExpense(id, updated);
      } catch (e) {
        console.error('Backend updateExpense error:', e);
      }
    },
    deleteExpense: async (id) => {
      set((state) => {
        const target = state.expenses.find((e) => e.id === id);
        if (!target) return state;
        const nextExpenses = state.expenses.map((e) =>
          e.id === id ? { ...e, isDeleted: true, deletedAt: new Date().toISOString() } : e
        );
        return {
          expenses: nextExpenses,
          undoQueue: [{ id: target.id, type: 'expense', data: target, timestamp: Date.now() }, ...state.undoQueue],
        };
      });
      try {
        await apiClient.deleteExpense(id);
      } catch (e) {
        console.error('Backend deleteExpense error:', e);
      }
    },
    restoreExpense: (id) => {
      set((state) => ({
        expenses: state.expenses.map((e) => (e.id === id ? { ...e, isDeleted: false } : e)),
        undoQueue: state.undoQueue.filter((u) => u.id !== id),
      }));
    },
    duplicateExpense: (id) => {
      const target = get().expenses.find((e) => e.id === id);
      if (!target) return;
      get().addExpense({
        amount: target.amount,
        categoryId: target.categoryId,
        date: new Date().toISOString().split('T')[0],
        paymentMethod: target.paymentMethod,
        accountId: target.accountId,
        note: target.note ? `${target.note} (Copy)` : undefined,
        tags: [...target.tags],
      });
    },

    // Incomes
    addIncome: async (incomeData) => {
      const tempId = `inc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const newIncome: Income = {
        ...incomeData,
        id: tempId,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({ incomes: [newIncome, ...state.incomes] }));
      try {
        const saved = await apiClient.createIncome(incomeData);
        set((state) => ({
          incomes: state.incomes.map((i) => (i.id === tempId ? saved : i)),
        }));
      } catch (e) {
        console.error('Backend addIncome error:', e);
      }
    },
    updateIncome: async (id, updated) => {
      set((state) => ({
        incomes: state.incomes.map((i) => (i.id === id ? { ...i, ...updated } : i)),
      }));
      try {
        await apiClient.updateIncome(id, updated);
      } catch (e) {
        console.error('Backend updateIncome error:', e);
      }
    },
    deleteIncome: async (id) => {
      set((state) => {
        const target = state.incomes.find((i) => i.id === id);
        if (!target) return state;
        return {
          incomes: state.incomes.map((i) => (i.id === id ? { ...i, isDeleted: true } : i)),
          undoQueue: [{ id: target.id, type: 'income', data: target, timestamp: Date.now() }, ...state.undoQueue],
        };
      });
      try {
        await apiClient.deleteIncome(id);
      } catch (e) {
        console.error('Backend deleteIncome error:', e);
      }
    },

    // Split Expense
    addSplitExpense: (expenseData, splits) => {
      const totalAmount = expenseData.amount;
      const otherShares = splits.reduce((sum, s) => sum + s.amount, 0);
      const userShare = Math.max(0, totalAmount - otherShares);

      // Main expense recorded ONLY for the user's actual share
      const newExpense: Expense = {
        ...expenseData,
        amount: userShare,
        isSplit: true,
        note: `${expenseData.note || 'Group Dinner'} (My Share)`,
        id: `exp_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };

      // Automatically create ledger entries for people who owe the user
      const newLedgerEntries: LedgerEntry[] = splits.map((s) => ({
        id: `led_${Date.now()}_${s.personId}`,
        personId: s.personId,
        type: 'lent',
        amount: s.amount,
        date: expenseData.date,
        note: `Split share of ${expenseData.note || 'bill'}`,
        isSettled: false,
        createdAt: new Date().toISOString(),
      }));

      set((state) => ({
        expenses: [newExpense, ...state.expenses],
        ledgerEntries: [...newLedgerEntries, ...state.ledgerEntries],
      }));

      // Async backend persistence
      apiClient.createExpense({ ...expenseData, amount: userShare }).catch(console.error);
      splits.forEach((s) => {
        apiClient.createLedgerEntry({
          personId: s.personId,
          type: 'lent',
          amount: s.amount,
          date: expenseData.date,
          note: `Split share of ${expenseData.note || 'bill'}`,
        }).catch(console.error);
      });
    },

    // Categories & Tags
    addCategory: async (cat) => {
      const tempId = `cat_${Date.now()}`;
      set((s) => ({ categories: [...s.categories, { ...cat, id: tempId }] }));
      try {
        const saved = await apiClient.createCategory(cat);
        set((s) => ({ categories: s.categories.map((c) => (c.id === tempId ? saved : c)) }));
      } catch (e) {
        console.error('Backend addCategory error:', e);
      }
    },
    updateCategory: (id, updated) => set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, ...updated } : c)) })),
    deleteCategory: (id, reassignCategoryId) => {
      set((s) => ({
        categories: s.categories.filter((c) => c.id !== id),
        expenses: reassignCategoryId ? s.expenses.map((e) => (e.categoryId === id ? { ...e, categoryId: reassignCategoryId } : e)) : s.expenses,
      }));
    },
    resetCategoriesToDefault: () => {
      set({ categories: DEFAULT_FIXED_CATEGORIES });
    },
    addTag: (name, color = '#6366F1') => {
      const clean = name.trim();
      if (!clean) return;
      set((s) => {
        if (s.tags.some((t) => t.name.toLowerCase() === clean.toLowerCase())) return s;
        return { tags: [...s.tags, { id: `tag_${Date.now()}`, name: clean, color }] };
      });
    },
    renameTag: (oldName, newName) => {
      set((s) => ({
        tags: s.tags.map((t) => (t.name === oldName ? { ...t, name: newName } : t)),
        expenses: s.expenses.map((e) => ({ ...e, tags: e.tags.map((tg) => (tg === oldName ? newName : tg)) })),
      }));
    },
    mergeTags: (sourceName, targetName) => {
      set((s) => ({
        tags: s.tags.filter((t) => t.name !== sourceName),
        expenses: s.expenses.map((e) => ({ ...e, tags: Array.from(new Set(e.tags.map((tg) => (tg === sourceName ? targetName : tg)))) })),
      }));
    },
    deleteTag: (name) => {
      set((s) => ({
        tags: s.tags.filter((t) => t.name !== name),
        expenses: s.expenses.map((e) => ({ ...e, tags: e.tags.filter((tg) => tg !== name) })),
      }));
    },

    // Budgets
    setOverallBudget: async (month, year, amount) => {
      set((s) => {
        const existing = s.budgets.find((b) => b.month === month && b.year === year);
        if (existing) {
          return { budgets: s.budgets.map((b) => (b.id === existing.id ? { ...b, overallAmount: amount } : b)) };
        }
        return { budgets: [...s.budgets, { id: `b_${month}_${year}`, month, year, overallAmount: amount }] };
      });
      try {
        const saved = await apiClient.setMonthlyBudget(month, year, amount);
        set((s) => ({
          budgets: s.budgets.map((b) => (b.month === month && b.year === year ? saved : b)),
        }));
      } catch (e) {
        console.error('Backend setOverallBudget error:', e);
      }
    },
    setCategoryBudget: async (categoryId, amount) => {
      set((s) => ({ categories: s.categories.map((c) => (c.id === categoryId ? { ...c, monthlyBudget: amount } : c)) }));
      try {
        await apiClient.setCategoryBudget(categoryId, amount);
      } catch (e) {
        console.error('Backend setCategoryBudget error:', e);
      }
    },

    // Credit Cards
    addCreditCard: async (card) => {
      const tempId = `card_${Date.now()}`;
      set((s) => ({ creditCards: [...s.creditCards, { ...card, id: tempId }] }));
      try {
        const saved = await apiClient.createCard(card);
        set((s) => ({ creditCards: s.creditCards.map((c) => (c.id === tempId ? saved : c)) }));
      } catch (e) {
        console.error('Backend addCreditCard error:', e);
      }
    },
    updateCreditCard: async (id, card) => {
      set((s) => ({ creditCards: s.creditCards.map((c) => (c.id === id ? { ...c, ...card } : c)) }));
      try {
        await apiClient.updateCard(id, card);
      } catch (e) {
        console.error('Backend updateCreditCard error:', e);
      }
    },
    deleteCreditCard: async (id) => {
      set((s) => ({ creditCards: s.creditCards.filter((c) => c.id !== id) }));
      try {
        await apiClient.deleteCard(id);
      } catch (e) {
        console.error('Backend deleteCreditCard error:', e);
      }
    },
    recordCardPayment: async (cardId, amount, paymentSource, note) => {
      const payment: CardPayment = {
        id: `pay_${Date.now()}`,
        cardId,
        amount,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentSource,
        note,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ cardPayments: [payment, ...s.cardPayments] }));
      try {
        await apiClient.recordCardPayment(cardId, amount, paymentSource, note);
      } catch (e) {
        console.error('Backend recordCardPayment error:', e);
      }
    },
    addCardEmi: (emi) => set((s) => ({ cardEmis: [...s.cardEmis, { ...emi, id: `emi_${Date.now()}` }] })),

    // People
    addPerson: async (person) => {
      const tempId = `person_${Date.now()}`;
      set((s) => ({ people: [...s.people, { ...person, id: tempId }] }));
      try {
        const saved = await apiClient.createPerson(person);
        set((s) => ({ people: s.people.map((p) => (p.id === tempId ? saved : p)) }));
      } catch (e) {
        console.error('Backend addPerson error:', e);
      }
    },
    updatePerson: async (id, person) => {
      set((s) => ({ people: s.people.map((p) => (p.id === id ? { ...p, ...person } : p)) }));
      try {
        await apiClient.updatePerson(id, person);
      } catch (e) {
        console.error('Backend updatePerson error:', e);
      }
    },
    deletePerson: async (id) => {
      set((s) => ({
        people: s.people.filter((p) => p.id !== id),
        ledgerEntries: s.ledgerEntries.filter((l) => l.personId !== id),
      }));
      try {
        await apiClient.deletePerson(id);
      } catch (e) {
        console.error('Backend deletePerson error:', e);
      }
    },
    deleteLedgerEntry: async (id) => {
      set((s) => ({
        ledgerEntries: s.ledgerEntries.filter((l) => l.id !== id),
      }));
      try {
        await apiClient.deleteLedgerEntry(id);
      } catch (e) {
        console.error('Backend deleteLedgerEntry error:', e);
      }
    },
    addLedgerEntry: async (entryData) => {
      const tempId = `led_${Date.now()}`;
      const newEntry: LedgerEntry = { ...entryData, id: tempId, createdAt: new Date().toISOString() };
      set((s) => ({ ledgerEntries: [newEntry, ...s.ledgerEntries] }));
      try {
        const saved = await apiClient.createLedgerEntry(entryData);
        set((s) => ({ ledgerEntries: s.ledgerEntries.map((l) => (l.id === tempId ? saved : l)) }));
      } catch (e) {
        console.error('Backend addLedgerEntry error:', e);
      }
    },
    settlePersonDebt: async (personId) => {
      set((s) => {
        const entries = s.ledgerEntries.filter((e) => e.personId === personId && !e.isSettled);
        let net = 0;
        entries.forEach((e) => {
          if (e.type === 'lent') net += e.amount;
          else if (e.type === 'borrowed') net -= e.amount;
        });
        if (net === 0) return s;

        const settlement: LedgerEntry = {
          id: `led_${Date.now()}`,
          personId,
          type: 'settlement',
          amount: Math.abs(net),
          date: new Date().toISOString().split('T')[0],
          note: net > 0 ? 'Full settlement received' : 'Full settlement paid',
          isSettled: true,
          createdAt: new Date().toISOString(),
        };

        return {
          ledgerEntries: [settlement, ...s.ledgerEntries.map((e) => (e.personId === personId ? { ...e, isSettled: true } : e))],
        };
      });
      try {
        await apiClient.settlePersonDebt(personId);
      } catch (e) {
        console.error('Backend settlePersonDebt error:', e);
      }
    },

    // Investments
    addInvestment: async (inv) => {
      const tempId = (inv as any).id || `inv_${Date.now()}`;
      const newInv: Investment = { ...inv, id: tempId };
      set((s) => ({ investments: [...s.investments, newInv] }));
      try {
        const saved = await apiClient.createInvestment(newInv);
        set((s) => ({
          investments: s.investments.map((item) => (item.id === tempId ? saved : item)),
        }));
      } catch (err) {
        console.error('Backend addInvestment error:', err);
      }
    },
    updateInvestment: async (id, updates) => {
      set((s) => ({
        investments: s.investments.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv)),
      }));
      try {
        await apiClient.updateInvestment(id, updates);
      } catch (err) {
        console.error('Backend updateInvestment error:', err);
      }
    },
    deleteInvestment: async (id) => {
      set((s) => ({
        investments: s.investments.filter((inv) => inv.id !== id),
      }));
      try {
        await apiClient.deleteInvestment(id);
      } catch (err) {
        console.error('Backend deleteInvestment error:', err);
      }
    },
    addInvestmentTransaction: async (tx) => {
      const tempId = `tx_${Date.now()}`;
      const newTx: InvestmentTransaction = { ...tx, id: tempId, createdAt: new Date().toISOString() };
      set((s) => ({ investmentTransactions: [...s.investmentTransactions, newTx] }));
      try {
        const saved = await apiClient.recordInvestmentTransaction(newTx);
        set((s) => ({
          investmentTransactions: s.investmentTransactions.map((item) => (item.id === tempId ? saved : item)),
        }));
      } catch (err) {
        console.error('Backend addInvestmentTransaction error:', err);
      }
    },
    updatePriceQuote: (symbol, price, dayChangePct, isManual = false) => {
      set((s) => ({
        priceQuotes: {
          ...s.priceQuotes,
          [symbol]: { symbol, price, dayChangePct, lastUpdated: new Date().toISOString(), isManualOverride: isManual },
        },
      }));
    },
    bulkImportHoldings: async (holdings, mode = 'merge') => {
      try {
        const payload = holdings.map((h) => ({
          symbol: h.symbol,
          name: h.name,
          asset_type: h.assetType || 'Stocks',
          institution: h.institution || 'Broker',
          quantity: Number(h.quantity),
          avg_buy_price: Number(h.avgBuyPrice),
          current_price: h.currentPrice ? Number(h.currentPrice) : undefined,
          category_tag: h.categoryTag,
          tax_section: h.taxSection,
          notes: h.notes,
        }));
        const res = await apiClient.bulkImportInvestments(payload, mode);

        // Update local priceQuotes immediately if provided
        holdings.forEach((h) => {
          if (h.currentPrice && h.currentPrice > 0) {
            get().updatePriceQuote(h.symbol, Number(h.currentPrice), 0, false);
          }
        });

        // Re-sync entire investment state from backend
        await get().fetchFromBackend();
        return { success: true, count: res.imported_count };
      } catch (err) {
        console.error('Failed to bulk import holdings:', err);
        return { success: false, count: 0 };
      }
    },
    syncLivePrices: async (symbols) => {
      try {
        const quotes = await apiClient.fetchLivePrices(symbols);
        Object.entries(quotes).forEach(([sym, data]) => {
          get().updatePriceQuote(sym, data.price, data.day_change_pct, false);
        });
      } catch (err) {
        console.error('Failed to sync live prices:', err);
      }
    },
    startLiveStream: () => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('finvault_live_ticker_active', 'true');
      }
      set({ isLiveStreamActive: true });
      const currentInvestments = get().investments;
      const symbols = currentInvestments.map((inv) => inv.symbol);
      if (symbols.length > 0) {
        yahooLiveStreamer.subscribe(symbols, (tick) => {
          const normalize = (s: string) => s.replace(/\.(NS|BO)$/i, '').trim().toUpperCase();
          const matched = get().investments.find(
            (inv) => normalize(inv.symbol) === normalize(tick.symbol)
          );
          if (matched && tick.price > 0) {
            get().updatePriceQuote(matched.symbol, tick.price, tick.changePercent, false);
          }
        });
      }
    },
    stopLiveStream: () => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('finvault_live_ticker_active', 'false');
      }
      set({ isLiveStreamActive: false });
      yahooLiveStreamer.disconnect();
    },
    toggleLiveStream: () => {
      if (get().isLiveStreamActive) {
        get().stopLiveStream();
      } else {
        get().startLiveStream();
      }
    },
    syncWithMarketHours: (marketRegion, autoSync) => {
      const isAuto = autoSync !== undefined ? autoSync : (typeof window !== 'undefined' ? localStorage.getItem('finvault_auto_market_hours') !== 'false' : true);
      if (!isAuto) return;
      const reg = marketRegion || (typeof window !== 'undefined' ? localStorage.getItem('finvault_market_region') || 'IN' : 'IN');
      const status = getMarketStatus(reg);
      if (status.isOpen && !get().isLiveStreamActive) {
        get().startLiveStream();
      } else if (!status.isOpen && get().isLiveStreamActive) {
        get().stopLiveStream();
      }
    },

    // Savings Goals
    addGoal: (goal) => set((s) => ({ goals: [...s.goals, { ...goal, id: `g_${Date.now()}` }] })),
    contributeToGoal: (goalId, amount, fromAccountId) => {
      set((s) => {
        const nextGoals = s.goals.map((g) => {
          if (g.id === goalId) {
            const nextAmt = g.currentAmount + amount;
            return { ...g, currentAmount: nextAmt, isCompleted: nextAmt >= g.targetAmount };
          }
          return g;
        });

        // Record as transfer (excluded from spending)
        let nextTransfers = s.transfers;
        if (fromAccountId) {
          nextTransfers = [
            {
              id: `tr_${Date.now()}`,
              fromAccountId,
              toAccountId: fromAccountId, // Internal allocation
              amount,
              date: new Date().toISOString().split('T')[0],
              note: `Goal Contribution: ${s.goals.find((g) => g.id === goalId)?.name}`,
              createdAt: new Date().toISOString(),
            },
            ...nextTransfers,
          ];
        }

        return { goals: nextGoals, transfers: nextTransfers };
      });
    },

    // Subscriptions & Rules
    addSubscription: (sub) => set((s) => ({ subscriptions: [...s.subscriptions, { ...sub, id: `sub_${Date.now()}` }] })),
    dismissSubscription: (id) => set((s) => ({ subscriptions: s.subscriptions.filter((sub) => sub.id !== id) })),
    addRule: (rule) => set((s) => ({ rules: [...s.rules, { ...rule, id: `r_${Date.now()}` }] })),
    deleteRule: (id) => set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),

    // SIPs & Ingest
    addSip: (sip) => set((s) => ({ sips: [...s.sips, { ...sip, id: `sip_${Date.now()}` }] })),
    acceptSmsTransaction: (inboxId, categoryId, accountId) => {
      set((s) => {
        const item = s.smsInbox.find((i) => i.id === inboxId);
        if (!item || !item.parsedAmount) return s;

        const newExp: Expense = {
          id: `exp_sms_${Date.now()}`,
          amount: item.parsedAmount,
          categoryId,
          date: item.parsedDate || new Date().toISOString().split('T')[0],
          paymentMethod: 'UPI',
          accountId,
          note: item.parsedMerchant || 'SMS Ingested Expense',
          tags: ['SMS Ingest'],
          createdAt: new Date().toISOString(),
        };

        return {
          expenses: [newExp, ...s.expenses],
          smsInbox: s.smsInbox.map((i) => (i.id === inboxId ? { ...i, status: 'accepted' } : i)),
        };
      });
    },
    dismissSms: (inboxId) => {
      set((s) => ({
        smsInbox: s.smsInbox.map((i) => (i.id === inboxId ? { ...i, status: 'dismissed' } : i)),
      }));
    },

    // Notifications
    addNotification: (n) => {
      const newNotif: AppNotification = {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        title: n.title,
        message: n.message,
        type: n.type,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ notifications: [newNotif, ...s.notifications] }));
    },
    checkAndGenerateDueReminders: (leadDays = 3) => {
      const s = get();
      const now = new Date();
      const currentDay = now.getDate();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const newNotifs: AppNotification[] = [];

      // 1. Credit Cards Due Reminders
      s.creditCards.forEach((card) => {
        let diff = card.paymentDueDay - currentDay;
        if (diff < 0) {
          const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
          diff += daysInMonth;
        }
        if (diff >= 0 && diff <= leadDays) {
          const notifId = `notif_card_${card.id}_${currentMonth}_${diff}`;
          const title = `Credit Card Due: ${card.nickname}`;
          const message = `${card.nickname} (··${card.last4}) payment is due ${
            diff === 0 ? 'today' : `in ${diff} day${diff > 1 ? 's' : ''}`
          } (Day ${card.paymentDueDay} of month).`;
          // Check persisted notifications, queued ones, AND dismissed IDs
          const alreadyExists =
            newNotifs.some((n) => n.id === notifId) ||
            s.notifications.some((n) => n.id === notifId) ||
            (s.dismissedNotificationIds || []).includes(notifId);
          if (!alreadyExists) {
            newNotifs.push({
              id: notifId,
              title,
              message,
              type: 'due_reminder',
              isRead: false,
              createdAt: new Date().toISOString(),
            });
          }
        }
      });

      // 2. Unsettled Lent Debits with upcoming due dates
      s.ledgerEntries
        .filter((e) => !e.isSettled && e.type === 'lent' && e.dueDate)
        .forEach((entry) => {
          const due = new Date(entry.dueDate!);
          const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= leadDays) {
            const notifId = `notif_debt_${entry.id}`;
            const person = s.people.find((p) => p.id === entry.personId);
            const pName = person ? person.name : 'Contact';
            const title = `Debt Reminder: ${pName}`;
            const message = `${pName} owes ₹${entry.amount.toLocaleString()} (Due: ${diffDays < 0 ? 'Overdue' : diffDays === 0 ? 'Today' : `in ${diffDays}d`}).`;
            const alreadyExists =
              newNotifs.some((n) => n.id === notifId) ||
              s.notifications.some((n) => n.id === notifId) ||
              (s.dismissedNotificationIds || []).includes(notifId);
            if (!alreadyExists) {
              newNotifs.push({
                id: notifId,
                title,
                message,
                type: 'due_reminder',
                isRead: false,
                createdAt: new Date().toISOString(),
              });
            }
          }
        });

      // 3. Recurring Debits due soon
      s.expenses
        .filter((e) => e.isRecurring)
        .forEach((exp) => {
          const expDate = new Date(exp.date);
          const expDay = expDate.getDate();
          let diff = expDay - currentDay;
          if (diff < 0) {
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            diff += daysInMonth;
          }
          if (diff >= 0 && diff <= leadDays) {
            const notifId = `notif_rec_${exp.id}_${currentMonth}_${diff}`;
            const title = `Upcoming Bill: ${exp.note || 'Subscription'}`;
            const message = `${exp.note || 'Recurring Bill'} (₹${exp.amount.toLocaleString()}) due ${
              diff === 0 ? 'today' : `in ${diff} day${diff > 1 ? 's' : ''}`
            }.`;
            const alreadyExists =
              newNotifs.some((n) => n.id === notifId) ||
              s.notifications.some((n) => n.id === notifId) ||
              (s.dismissedNotificationIds || []).includes(notifId);
            if (!alreadyExists) {
              newNotifs.push({
                id: notifId,
                title,
                message,
                type: 'due_reminder',
                isRead: false,
                createdAt: new Date().toISOString(),
              });
            }
          }
        });

      if (newNotifs.length > 0) {
        set((state) => {
          // Merge and deduplicate by ID — prevents duplicate keys if called multiple times
          const existingIds = new Set(state.notifications.map((n) => n.id));
          const uniqueNew = newNotifs.filter((n) => !existingIds.has(n.id));
          return { notifications: [...uniqueNew, ...state.notifications] };
        });
      }
      return newNotifs;
    },
    markNotificationAsRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)) })),
    markAllNotificationsAsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, isRead: true })) })),
    clearNotification: (id) => set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
      dismissedNotificationIds: [...(s.dismissedNotificationIds || []), id],
    })),
    clearAllNotifications: () => set((s) => ({
      dismissedNotificationIds: [...(s.dismissedNotificationIds || []), ...s.notifications.map((n) => n.id)],
      notifications: [],
    })),

    // Undo
    undoLastDelete: () => {
      const queue = get().undoQueue;
      if (queue.length === 0) return;
      const [lastItem] = queue;
      if (lastItem.type === 'expense') get().restoreExpense(lastItem.id);
    },
    dismissUndo: (id) => set((s) => ({ undoQueue: s.undoQueue.filter((u) => u.id !== id) })),

    // Backup & Restore
    exportAllData: () => {
      const s = get();
      return {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        accounts: s.accounts,
        transfers: s.transfers,
        expenses: s.expenses.filter((e) => !e.isDeleted),
        incomes: s.incomes.filter((i) => !i.isDeleted),
        categories: s.categories,
        tags: s.tags,
        budgets: s.budgets,
        creditCards: s.creditCards,
        cardPayments: s.cardPayments,
        people: s.people,
        ledgerEntries: s.ledgerEntries.filter((l) => !l.isDeleted),
        investments: s.investments,
        investmentTransactions: s.investmentTransactions,
        goals: s.goals,
        subscriptions: s.subscriptions,
        rules: s.rules,
        sips: s.sips,
      };
    },
    importAllData: (data, mode) => {
      if (mode === 'replace') {
        set({
          accounts: data.accounts || DEFAULT_ACCOUNTS,
          transfers: data.transfers || DEFAULT_TRANSFERS,
          expenses: data.expenses || [],
          incomes: data.incomes || [],
          categories: data.categories || [],
          tags: data.tags || [],
          budgets: data.budgets || [],
          creditCards: data.creditCards || [],
          cardPayments: data.cardPayments || [],
          people: data.people || [],
          ledgerEntries: data.ledgerEntries || [],
          investments: data.investments || [],
          investmentTransactions: data.investmentTransactions || [],
          goals: data.goals || DEFAULT_GOALS,
          subscriptions: data.subscriptions || DEFAULT_SUBSCRIPTIONS,
          rules: data.rules || DEFAULT_RULES,
          sips: data.sips || DEFAULT_SIPS,
        });
      } else {
        set((s) => ({
          expenses: [...(data.expenses || []), ...s.expenses],
          incomes: [...(data.incomes || []), ...s.incomes],
          transfers: [...(data.transfers || []), ...s.transfers],
          goals: [...(data.goals || []), ...s.goals],
          subscriptions: [...(data.subscriptions || []), ...s.subscriptions],
        }));
      }
    },

    clearAllData: async () => {
      // 1. Wipe backend database state
      try {
        await apiClient.resetAllData();
      } catch (e) {
        console.warn('Backend resetAllData error:', e);
      }

      // 2. Clear offline Dexie queue
      try {
        await offlineDb.offlineQueue.clear();
      } catch (e) {
        console.warn('Failed to clear offline indexedDB queue:', e);
      }

      // 3. Clear local storage cache
      try {
        localStorage.removeItem('finvault_finance_store_v3');
        localStorage.removeItem('finvault_finance_store_v2');
        localStorage.removeItem('kuber_finance_store_v2');
      } catch (e) {
        console.error('Failed to clear localStorage keys:', e);
      }

      // 4. Reset in-memory Zustand store
      set({
        accounts: [],
        transfers: [],
        expenses: [],
        incomes: [],
        budgets: [],
        creditCards: [],
        cardPayments: [],
        cardEmis: [],
        people: [],
        ledgerEntries: [],
        investments: [],
        investmentTransactions: [],
        priceQuotes: {},
        notifications: [],
        undoQueue: [],
        goals: [],
        subscriptions: [],
        rules: [],
        sips: [],
        smsInbox: [],
        householdMembers: [],
        categories: DEFAULT_FIXED_CATEGORIES,
      });

      // 5. Re-fetch fresh synced categories from backend
      try {
        await get().fetchFromBackend();
      } catch (e) {
        console.warn('Post-reset sync error:', e);
      }
    },
  };
});

// Auto-persist store changes to localStorage & sync with backend on initial load
if (typeof window !== 'undefined') {
  // Fetch fresh dynamic state from FastAPI backend
  useFinanceStore.getState().fetchFromBackend();

  // Evaluate market hours vs user live stream preference
  const autoSync = localStorage.getItem('finvault_auto_market_hours') !== 'false';
  const region = localStorage.getItem('finvault_market_region') || 'IN';
  if (autoSync) {
    useFinanceStore.getState().syncWithMarketHours(region, true);
  } else if (localStorage.getItem('finvault_live_ticker_active') === 'true') {
    useFinanceStore.getState().startLiveStream();
  }

  // Periodic heartbeat every 60 seconds to auto-start/stop when session opens/closes
  setInterval(() => {
    const isAuto = localStorage.getItem('finvault_auto_market_hours') !== 'false';
    const reg = localStorage.getItem('finvault_market_region') || 'IN';
    if (isAuto) {
      useFinanceStore.getState().syncWithMarketHours(reg, true);
    }
  }, 60000);

  useFinanceStore.subscribe((state) => {
    try {
      const serialized = JSON.stringify({
        accounts: state.accounts,
        transfers: state.transfers,
        expenses: state.expenses,
        incomes: state.incomes,
        categories: state.categories,
        tags: state.tags,
        budgets: state.budgets,
        creditCards: state.creditCards,
        cardPayments: state.cardPayments,
        cardEmis: state.cardEmis,
        people: state.people,
        ledgerEntries: state.ledgerEntries,
        investments: state.investments,
        investmentTransactions: state.investmentTransactions,
        priceQuotes: state.priceQuotes,
        goals: state.goals,
        subscriptions: state.subscriptions,
        rules: state.rules,
        sips: state.sips,
        smsInbox: state.smsInbox,
        householdMembers: state.householdMembers,
        notifications: state.notifications,
        dismissedNotificationIds: state.dismissedNotificationIds,
      });
      localStorage.setItem('finvault_finance_store_v3', serialized);
    } catch (e) {
      console.error('Failed to auto-save finance store:', e);
    }
  });
}


