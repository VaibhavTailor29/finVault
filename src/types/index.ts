export type PaymentMethod = 'Cash' | 'UPI' | 'Debit Card' | 'Credit Card' | 'Net Banking' | 'Wallet';

export type IncomeSource = 'Salary' | 'Freelance' | 'Business' | 'Interest' | 'Dividend' | 'Gift' | 'Other';

export type RecurringFrequency = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

export type LedgerType = 'lent' | 'borrowed' | 'settlement';

export type AssetType = 'Stock' | 'ETF' | 'Mutual Fund' | 'Crypto' | 'Gold' | 'Fixed Deposit' | 'Other';

export type InvestmentTxType = 'BUY' | 'SELL' | 'DIVIDEND' | 'SPLIT';

export type AccountType = 'Savings' | 'Current' | 'Cash' | 'Wallet' | 'Credit Card' | 'Investment cash' | 'Other';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  twoFactorEnabled: boolean;
  currency: string;
  theme: 'light' | 'dark' | 'system';
  privacyMode: boolean;
  createdAt: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: number;
  currency: string;
  color: string;
  isArchived?: boolean;
  lastReconciledAt?: string;
}

export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  fee?: number;
  note?: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  monthlyBudget?: number;
  isDeleted?: boolean;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Expense {
  id: string;
  amount: number;
  categoryId: string;
  date: string;
  paymentMethod: PaymentMethod;
  accountId?: string;
  note?: string;
  tags: string[];
  cardId?: string;
  personId?: string;
  isRecurring?: boolean;
  recurringFrequency?: RecurringFrequency;
  isSplit?: boolean;
  taxSection?: string; // 80C, 80D, etc.
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
}

export interface Income {
  id: string;
  amount: number;
  source: IncomeSource;
  date: string;
  accountId?: string;
  note?: string;
  tags: string[];
  isRecurring?: boolean;
  recurringFrequency?: RecurringFrequency;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  month: number;
  year: number;
  overallAmount: number;
}

export interface CreditCard {
  id: string;
  nickname: string;
  issuer: string;
  last4: string;
  creditLimit: number;
  statementDay: number;
  paymentDueDay: number;
  interestRate?: number;
  color: string;
  network?: string;
  isClosed?: boolean;
  isDeleted?: boolean;
}

export interface CardPayment {
  id: string;
  cardId: string;
  amount: number;
  paymentDate: string;
  paymentSource: string;
  note?: string;
  createdAt: string;
}

export interface CardEMI {
  id: string;
  cardId: string;
  title: string;
  principal: number;
  tenureMonths: number;
  monthlyInstallment: number;
  remainingInstallments: number;
  startDate: string;
}

export interface Person {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  avatarColor: string;
  isDeleted?: boolean;
}

export interface LedgerEntry {
  id: string;
  personId: string;
  type: LedgerType;
  amount: number;
  date: string;
  note?: string;
  dueDate?: string;
  isSettled?: boolean;
  isDeleted?: boolean;
  createdAt: string;
}

export interface Investment {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  taxSection?: string;
  notes?: string;
  isDeleted?: boolean;
}

export interface InvestmentTransaction {
  id: string;
  investmentId: string;
  type: InvestmentTxType;
  quantity: number;
  price: number;
  fees: number;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface PriceQuote {
  symbol: string;
  price: number;
  dayChangePct: number;
  lastUpdated: string;
  isManualOverride?: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'budget_alert' | 'due_reminder' | 'security_event' | 'anomaly_alert' | 'info';
  isRead: boolean;
  createdAt: string;
}

export interface UserSession {
  id: string;
  deviceName: string;
  browser: string;
  ipAddress: string;
  isCurrent: boolean;
  lastActive: string;
}

// Phase 2 Types
export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  linkedAccountId?: string;
  color: string;
  isCompleted?: boolean;
}

export interface SubscriptionItem {
  id: string;
  merchant: string;
  cadence: 'Monthly' | 'Weekly' | 'Yearly';
  expectedAmount: number;
  previousAmount?: number;
  priceIncreased?: boolean;
  nextRenewalDate: string;
  isActive: boolean;
}

export interface AutoRuleItem {
  id: string;
  name: string;
  priority: number;
  isEnabled: boolean;
  matchField: 'description' | 'amount' | 'account';
  matchType: 'contains' | 'equals' | 'regex';
  matchValue: string;
  actionCategoryId?: string;
  actionTags: string[];
  actionMarkTransfer?: boolean;
}

export interface SIPScheduleItem {
  id: string;
  fundName: string;
  schemeCode?: string;
  amount: number;
  sipDay: number;
  isActive: boolean;
}

export interface SMSInboxItem {
  id: string;
  rawMessage: string;
  sender: string;
  parsedAmount?: number;
  parsedMerchant?: string;
  parsedDate?: string;
  status: 'pending' | 'accepted' | 'dismissed';
  createdAt: string;
}

export interface HouseholdMemberItem {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
}
