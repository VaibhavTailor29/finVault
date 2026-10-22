import { Account } from '../types';

export type PaymentMethodType = 'Cash' | 'UPI' | 'Debit Card' | 'Credit Card' | 'Net Banking' | 'Wallet';

/**
 * Filters accounts based on the selected payment method:
 * - Wallet -> Only Wallet accounts
 * - Cash -> Only Cash accounts
 * - Debit Card / Net Banking -> Only Bank accounts (Savings, Current)
 * - UPI -> Bank accounts and Wallets
 */
export function getFilteredAccountsForPaymentMethod(
  accounts: Account[],
  paymentMethod: PaymentMethodType
): Account[] {
  const active = accounts.filter((a) => !a.isArchived && !a.isDeleted);
  switch (paymentMethod) {
    case 'Wallet':
      return active.filter((a) => a.type === 'Wallet' || a.type.toLowerCase().includes('wallet'));
    case 'Cash':
      return active.filter((a) => a.type === 'Cash');
    case 'Debit Card':
    case 'Net Banking':
      return active.filter((a) => a.type === 'Savings' || a.type === 'Current' || a.type === 'Other');
    case 'UPI':
      return active.filter((a) => a.type === 'Savings' || a.type === 'Current' || a.type === 'Wallet' || a.type === 'Other');
    default:
      return active;
  }
}

export function getPaymentMethodAccountMeta(paymentMethod: PaymentMethodType) {
  switch (paymentMethod) {
    case 'Wallet':
      return {
        label: 'Paid From Wallet',
        placeholder: 'Choose wallet...',
        noneLabel: '— No specific wallet —',
        emptyNotice: 'No Wallet accounts found.',
      };
    case 'Cash':
      return {
        label: 'Paid From Cash Account',
        placeholder: 'Choose cash account...',
        noneLabel: '— No specific cash account —',
        emptyNotice: 'No Cash accounts found.',
      };
    case 'Debit Card':
      return {
        label: 'Paid From Bank Account',
        placeholder: 'Choose bank account...',
        noneLabel: '— No specific bank account —',
        emptyNotice: 'No Bank accounts found.',
      };
    case 'Net Banking':
      return {
        label: 'Paid From Bank Account',
        placeholder: 'Choose bank account...',
        noneLabel: '— No specific bank account —',
        emptyNotice: 'No Bank accounts found.',
      };
    case 'UPI':
    default:
      return {
        label: 'Paid From Account / Wallet',
        placeholder: 'Choose account or wallet...',
        noneLabel: '— No specific account —',
        emptyNotice: 'No bank or wallet accounts found.',
      };
  }
}
