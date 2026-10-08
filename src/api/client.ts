/**
 * API Client for FinVault FastAPI Backend
 * Translates between frontend types and backend schema conventions.
 */

import {
  Account,
  Expense,
  Income,
  CreditCard,
  CardPayment,
  Person,
  LedgerEntry,
  Category,
  Budget,
  Transfer,
} from '../types';

const API_BASE = '/api';

let currentStepUpToken: string | null = null;

export function setStepUpToken(token: string | null) {
  currentStepUpToken = token;
}

export function getStepUpToken(): string | null {
  return currentStepUpToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('finvault_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(currentStepUpToken ? { 'X-Step-Up-Token': currentStepUpToken } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/register')) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('finvault_token');
        localStorage.removeItem('finvault_user');
      }
    }
    let errorDetail = 'API request failed';
    try {
      const err = await response.json();
      if (typeof err.detail === 'string') {
        errorDetail = err.detail;
      } else if (Array.isArray(err.detail) && err.detail.length > 0) {
        errorDetail = err.detail.map((d: any) => d.msg || d.message || String(d)).join('. ');
      } else if (err.message && typeof err.message === 'string') {
        errorDetail = err.message;
      } else {
        errorDetail = JSON.stringify(err);
      }
    } catch {
      errorDetail = `${response.status} ${response.statusText}`;
    }
    console.error(`API Error [${options.method || 'GET'} ${url}]:`, errorDetail);
    throw new Error(errorDetail);
  }

  return response.json();
}

// ========================
// MAPPERS: Backend -> Frontend
// ========================

export function toFrontendAccount(b: any): Account {
  return {
    id: b.id,
    name: b.name,
    type: b.type,
    openingBalance: Number(b.openingBalance ?? b.opening_balance ?? 0),
    currency: b.currency || 'INR',
    color: b.color || '#4F46E5',
    isArchived: Boolean(b.isArchived ?? b.is_archived),
    lastReconciledAt: b.lastReconciledAt ?? b.reconciliation_date ?? undefined,
  };
}

export function toFrontendTransfer(b: any): Transfer {
  return {
    id: b.id,
    fromAccountId: b.fromAccountId ?? b.from_account_id,
    toAccountId: b.toAccountId ?? b.to_account_id,
    amount: Number(b.amount || 0),
    fee: Number(b.fee || 0),
    date: b.date,
    note: b.note || undefined,
    createdAt: b.createdAt ?? b.date ?? new Date().toISOString(),
  };
}

export function toFrontendExpense(b: any): Expense {
  return {
    id: b.id,
    amount: Number(b.amount || 0),
    categoryId: b.categoryId ?? b.category_id,
    date: b.date,
    paymentMethod: b.paymentMethod ?? b.payment_method ?? 'UPI',
    note: b.note || '',
    tags: Array.isArray(b.tags) ? b.tags : [],
    cardId: b.cardId ?? b.card_id ?? undefined,
    personId: b.personId ?? b.person_id ?? undefined,
    isRecurring: Boolean(b.isRecurring ?? b.is_recurring),
    recurringFrequency: b.recurringFrequency ?? b.recurring_frequency ?? undefined,
    createdAt: b.createdAt ?? b.created_at ?? new Date().toISOString(),
  };
}

export function toFrontendIncome(b: any): Income {
  return {
    id: b.id,
    amount: Number(b.amount || 0),
    source: b.source,
    date: b.date,
    note: b.note || '',
    tags: Array.isArray(b.tags) ? b.tags : [],
    isRecurring: Boolean(b.isRecurring ?? b.is_recurring),
    recurringFrequency: b.recurringFrequency ?? b.recurring_frequency ?? undefined,
    createdAt: b.createdAt ?? b.created_at ?? new Date().toISOString(),
  };
}

export function toFrontendCreditCard(b: any): CreditCard {
  return {
    id: b.id,
    nickname: b.nickname,
    issuer: b.issuer,
    last4: b.last4,
    creditLimit: Number(b.creditLimit ?? b.credit_limit ?? 0),
    statementDay: Number(b.statementDay ?? b.statement_day ?? 1),
    paymentDueDay: Number(b.paymentDueDay ?? b.payment_due_day ?? 15),
    interestRate: (b.interestRate ?? b.interest_rate) != null ? Number(b.interestRate ?? b.interest_rate) : undefined,
    color: b.color || '#1E293B',
    network: b.network || 'visa',
    isClosed: Boolean(b.isClosed ?? b.is_closed),
    isDeleted: false,
  };
}

export function toFrontendPerson(b: any): Person {
  return {
    id: b.id,
    name: b.name,
    phone: b.phone || undefined,
    email: b.email || undefined,
    notes: b.notes || undefined,
    avatarColor: b.avatarColor ?? b.avatar_color ?? '#10B981',
  };
}

export function toFrontendLedgerEntry(b: any): LedgerEntry {
  return {
    id: b.id,
    personId: b.personId ?? b.person_id,
    type: b.type,
    amount: Number(b.amount || 0),
    date: b.date,
    note: b.note || undefined,
    dueDate: b.dueDate ?? b.due_date ?? undefined,
    isSettled: Boolean(b.isSettled ?? b.is_settled),
    createdAt: b.createdAt ?? b.created_at ?? new Date().toISOString(),
  };
}

export function toFrontendCategory(b: any): Category {
  return {
    id: b.id,
    name: b.name,
    icon: b.icon || 'tag',
    color: b.color || '#6366F1',
    monthlyBudget: (b.monthlyBudget ?? b.monthly_budget) != null ? Number(b.monthlyBudget ?? b.monthly_budget) : 0,
  };
}

export function toFrontendBudget(b: any): Budget {
  return {
    id: b.id,
    month: Number(b.month),
    year: Number(b.year),
    overallAmount: Number(b.overallAmount ?? b.overall_amount ?? 0),
  };
}

// ========================
// API Service Methods
// ========================

export interface SyncDataResult {
  accounts: Account[];
  transfers: Transfer[];
  expenses: Expense[];
  incomes: Income[];
  creditCards: CreditCard[];
  cardPayments: CardPayment[];
  people: Person[];
  ledgerEntries: LedgerEntry[];
  categories: Category[];
  budgets: Budget[];
}

export const apiClient = {
  // Sync
  async sync(): Promise<SyncDataResult> {
    const raw = await request<any>('/sync');
    return {
      accounts: (raw.accounts || []).map(toFrontendAccount),
      transfers: (raw.transfers || []).map(toFrontendTransfer),
      expenses: (raw.expenses || []).map(toFrontendExpense),
      incomes: (raw.incomes || []).map(toFrontendIncome),
      creditCards: (raw.creditCards || raw.cards || []).map(toFrontendCreditCard),
      cardPayments: (raw.cardPayments || raw.card_payments || []).map((cp: any) => ({
        id: cp.id,
        cardId: cp.cardId || cp.card_id,
        amount: Number(cp.amount || 0),
        paymentDate: cp.paymentDate || cp.payment_date,
        paymentSource: cp.paymentSource || cp.payment_source || 'Bank Account',
        note: cp.note || undefined,
        createdAt: cp.paymentDate || cp.payment_date || new Date().toISOString(),
      })),
      people: (raw.people || []).map(toFrontendPerson),
      ledgerEntries: (raw.ledgerEntries || raw.ledger_entries || []).map(toFrontendLedgerEntry),
      categories: (raw.categories || []).map(toFrontendCategory),
      budgets: (raw.budgets || []).map(toFrontendBudget),
    };
  },

  // Accounts
  async getAccounts(): Promise<Account[]> {
    const raw = await request<any[]>('/accounts');
    return raw.map(toFrontendAccount);
  },

  async createAccount(acc: Omit<Account, 'id'>): Promise<Account> {
    const payload = {
      name: acc.name,
      type: acc.type,
      opening_balance: acc.openingBalance,
      currency: acc.currency,
      color: acc.color,
    };
    const res = await request<any>('/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return toFrontendAccount(res);
  },

  async updateAccount(id: string, acc: Partial<Account>): Promise<Account> {
    const payload: any = {};
    if (acc.name !== undefined) payload.name = acc.name;
    if (acc.type !== undefined) payload.type = acc.type;
    if (acc.currency !== undefined) payload.currency = acc.currency;
    if (acc.color !== undefined) payload.color = acc.color;
    if (acc.isArchived !== undefined) payload.is_archived = acc.isArchived;
    const res = await request<any>(`/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return toFrontendAccount(res);
  },

  async deleteAccount(id: string): Promise<void> {
    await request<void>(`/accounts/${id}`, { method: 'DELETE' });
  },

  async createTransfer(transfer: Omit<Transfer, 'id' | 'createdAt'>): Promise<Transfer> {
    const payload = {
      from_account_id: transfer.fromAccountId,
      to_account_id: transfer.toAccountId,
      amount: transfer.amount,
      fee: transfer.fee || 0,
      date: transfer.date,
      note: transfer.note || null,
    };
    const res = await request<any>('/accounts/transfers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return toFrontendTransfer(res);
  },

  // Expenses
  async getExpenses(): Promise<Expense[]> {
    const raw = await request<any[]>('/transactions/expenses');
    return raw.map(toFrontendExpense);
  },

  async createExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> {
    const payload = {
      amount: expense.amount,
      category_id: expense.categoryId,
      date: expense.date,
      payment_method: expense.paymentMethod,
      note: expense.note || null,
      tags: expense.tags || [],
      card_id: expense.cardId || null,
      person_id: expense.personId || null,
      is_recurring: Boolean(expense.isRecurring),
      recurring_frequency: expense.recurringFrequency || null,
    };
    const res = await request<any>('/transactions/expenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return toFrontendExpense(res);
  },

  async updateExpense(id: string, expense: Partial<Expense>): Promise<Expense> {
    const payload: any = {};
    if (expense.amount !== undefined) payload.amount = expense.amount;
    if (expense.categoryId !== undefined) payload.category_id = expense.categoryId;
    if (expense.date !== undefined) payload.date = expense.date;
    if (expense.paymentMethod !== undefined) payload.payment_method = expense.paymentMethod;
    if (expense.note !== undefined) payload.note = expense.note;
    if (expense.tags !== undefined) payload.tags = expense.tags;
    if (expense.cardId !== undefined) payload.card_id = expense.cardId;
    if (expense.personId !== undefined) payload.person_id = expense.personId;
    if (expense.isRecurring !== undefined) payload.is_recurring = expense.isRecurring;
    if (expense.recurringFrequency !== undefined) payload.recurring_frequency = expense.recurringFrequency;

    const res = await request<any>(`/transactions/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return toFrontendExpense(res);
  },

  async deleteExpense(id: string): Promise<void> {
    await request<void>(`/transactions/expenses/${id}`, { method: 'DELETE' });
  },

  // Incomes
  async getIncomes(): Promise<Income[]> {
    const raw = await request<any[]>('/transactions/incomes');
    return raw.map(toFrontendIncome);
  },

  async createIncome(income: Omit<Income, 'id' | 'createdAt'>): Promise<Income> {
    const payload = {
      amount: income.amount,
      source: income.source,
      date: income.date,
      note: income.note || null,
      tags: income.tags || [],
      is_recurring: Boolean(income.isRecurring),
      recurring_frequency: income.recurringFrequency || null,
    };
    const res = await request<any>('/transactions/incomes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return toFrontendIncome(res);
  },

  async updateIncome(id: string, income: Partial<Income>): Promise<Income> {
    const payload: any = {};
    if (income.amount !== undefined) payload.amount = income.amount;
    if (income.source !== undefined) payload.source = income.source;
    if (income.date !== undefined) payload.date = income.date;
    if (income.note !== undefined) payload.note = income.note;
    if (income.tags !== undefined) payload.tags = income.tags;
    if (income.isRecurring !== undefined) payload.is_recurring = income.isRecurring;
    if (income.recurringFrequency !== undefined) payload.recurring_frequency = income.recurringFrequency;

    const res = await request<any>(`/transactions/incomes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return toFrontendIncome(res);
  },

  async deleteIncome(id: string): Promise<void> {
    await request<void>(`/transactions/incomes/${id}`, { method: 'DELETE' });
  },

  // Credit Cards
  async getCards(): Promise<CreditCard[]> {
    const raw = await request<any[]>('/cards');
    return raw.map(toFrontendCreditCard);
  },

  async createCard(card: Omit<CreditCard, 'id'>): Promise<CreditCard> {
    const payload = {
      nickname: card.nickname,
      issuer: card.issuer,
      last4: card.last4,
      credit_limit: card.creditLimit,
      statement_day: card.statementDay,
      payment_due_day: card.paymentDueDay,
      interest_rate: card.interestRate || null,
      color: card.color || '#1E293B',
      network: card.network || 'visa',
    };
    const res = await request<any>('/cards', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return toFrontendCreditCard(res);
  },

  async updateCard(id: string, card: Partial<CreditCard>): Promise<CreditCard> {
    const payload: any = {};
    if (card.nickname !== undefined) payload.nickname = card.nickname;
    if (card.issuer !== undefined) payload.issuer = card.issuer;
    if (card.creditLimit !== undefined) payload.credit_limit = card.creditLimit;
    if (card.statementDay !== undefined) payload.statement_day = card.statementDay;
    if (card.paymentDueDay !== undefined) payload.payment_due_day = card.paymentDueDay;
    if (card.interestRate !== undefined) payload.interest_rate = card.interestRate;
    if (card.color !== undefined) payload.color = card.color;
    if (card.network !== undefined) payload.network = card.network;
    if (card.isClosed !== undefined) payload.is_closed = card.isClosed;

    const res = await request<any>(`/cards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return toFrontendCreditCard(res);
  },

  async deleteCard(id: string): Promise<void> {
    await request<void>(`/cards/${id}`, { method: 'DELETE' });
  },

  async recordCardPayment(cardId: string, amount: number, paymentSource: string, note?: string): Promise<any> {
    const payload = {
      amount,
      payment_date: new Date().toISOString().split('T')[0],
      payment_source: paymentSource,
      note: note || null,
    };
    return await request<any>(`/cards/${cardId}/payments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // People & Debt Ledger
  async getPeople(): Promise<Person[]> {
    const raw = await request<any[]>('/people');
    return raw.map(toFrontendPerson);
  },

  async createPerson(person: Omit<Person, 'id'>): Promise<Person> {
    const payload = {
      name: person.name,
      phone: person.phone || null,
      email: person.email || null,
      notes: person.notes || null,
      avatar_color: person.avatarColor || '#10B981',
    };
    const res = await request<any>('/people', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return toFrontendPerson(res);
  },

  async updatePerson(id: string, person: Partial<Person>): Promise<Person> {
    const payload: any = {};
    if (person.name !== undefined) payload.name = person.name;
    if (person.phone !== undefined) payload.phone = person.phone;
    if (person.email !== undefined) payload.email = person.email;
    if (person.notes !== undefined) payload.notes = person.notes;
    if (person.avatarColor !== undefined) payload.avatar_color = person.avatarColor;

    const res = await request<any>(`/people/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return toFrontendPerson(res);
  },

  async deletePerson(id: string): Promise<void> {
    await request<void>(`/people/${id}`, { method: 'DELETE' });
  },

  async createLedgerEntry(entry: Omit<LedgerEntry, 'id' | 'createdAt'>): Promise<LedgerEntry> {
    const payload = {
      type: entry.type,
      amount: entry.amount,
      date: entry.date,
      note: entry.note || null,
      due_date: entry.dueDate || null,
    };
    const res = await request<any>(`/people/${entry.personId}/ledger`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return toFrontendLedgerEntry(res);
  },

  async settlePersonDebt(personId: string): Promise<any> {
    return await request<any>(`/people/${personId}/settle`, { method: 'POST' });
  },

  async deleteLedgerEntry(entryId: string): Promise<void> {
    await request<void>(`/people/ledger/${entryId}`, { method: 'DELETE' });
  },

  // Categories & Budgets
  async getCategories(): Promise<Category[]> {
    const raw = await request<any[]>('/categories');
    return raw.map(toFrontendCategory);
  },

  async createCategory(cat: Omit<Category, 'id'>): Promise<Category> {
    const payload = {
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      monthly_budget: cat.monthlyBudget || 0,
    };
    const res = await request<any>('/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return toFrontendCategory(res);
  },

  async setCategoryBudget(categoryId: string, amount: number): Promise<Category> {
    const res = await request<any>(`/categories/${categoryId}/budget`, {
      method: 'PUT',
      body: JSON.stringify({ amount }),
    });
    return toFrontendCategory(res);
  },

  async setMonthlyBudget(month: number, year: number, amount: number): Promise<Budget> {
    const res = await request<any>('/categories/monthly-budget', {
      method: 'POST',
      body: JSON.stringify({ month, year, amount }),
    });
    return toFrontendBudget(res);
  },

  // Auth Methods
  async login(email: string, password: string): Promise<any> {
    return await request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async register(name: string, email: string, password: string): Promise<any> {
    return await request<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },

  async getMe(): Promise<any> {
    return await request<any>('/auth/me');
  },

  async verify2FALogin(mfaToken: string, code: string): Promise<any> {
    return await request<any>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ mfa_token: mfaToken, code }),
    });
  },

  async setup2FA(): Promise<{ secret: string; qr_svg: string; provisioning_uri: string }> {
    return await request<any>('/auth/2fa/setup', { method: 'POST' });
  },

  async enable2FA(secret: string, code: string): Promise<{ message: string; recovery_codes: string[] }> {
    return await request<any>('/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ secret, code }),
    });
  },

  async disable2FA(): Promise<void> {
    await request<any>('/auth/2fa/disable', { method: 'POST' });
  },

  setStepUpToken(token: string | null) {
    setStepUpToken(token);
  },

  async verifyStepUp(code: string): Promise<{ step_up_token: string; message: string }> {
    const res = await request<{ step_up_token: string; message: string }>('/auth/step-up', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    if (res?.step_up_token) {
      setStepUpToken(res.step_up_token);
    }
    return res;
  },

  async logout(): Promise<void> {
    try {
      await request<void>('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors during logout
    }
  },

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    return await request<any>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async verifyResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
    return await request<any>(`/auth/verify-reset-token?token=${encodeURIComponent(token)}`);
  },

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return await request<any>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    });
  },

  // Reminders & Email Notifications
  async sendDebtReminder(data: {
    personId?: string;
    personName: string;
    recipientEmail: string;
    netBalance: number;
    currency?: string;
    entries?: any[];
  }): Promise<{ success: boolean; message: string; mode?: string }> {
    return await request<any>('/reminders/send-debt-reminder', {
      method: 'POST',
      body: JSON.stringify({
        person_id: data.personId,
        person_name: data.personName,
        recipient_email: data.recipientEmail,
        net_balance: data.netBalance,
        currency: data.currency,
        entries: data.entries,
      }),
    });
  },

  async sendEmailReminder(data: {
    recipientEmail: string;
    subject: string;
    body: string;
    htmlBody?: string;
    reminderType?: string;
  }): Promise<{ success: boolean; message: string; mode?: string }> {
    return await request<any>('/reminders/send-email', {
      method: 'POST',
      body: JSON.stringify({
        recipient_email: data.recipientEmail,
        subject: data.subject,
        body: data.body,
        html_body: data.htmlBody,
        reminder_type: data.reminderType,
      }),
    });
  },

  async sendTestReminder(
    email: string,
    currency?: string,
    sampleDues?: Array<{ title: string; due_in: string; amount: number }>
  ): Promise<{ success: boolean; message: string; mode?: string }> {
    return await request<any>('/reminders/send-test', {
      method: 'POST',
      body: JSON.stringify({ email, currency, sample_dues: sampleDues }),
    });
  },

  async getReminderStatus(): Promise<{
    status: string;
    service?: string;
    smtp_configured: boolean;
    mode?: string;
    sender_address?: string;
    smtp_host?: string | null;
    smtp_port?: number | null;
    smtp_user?: string | null;
    info?: string;
  }> {
    return await request<any>('/reminders/status');
  },
};
