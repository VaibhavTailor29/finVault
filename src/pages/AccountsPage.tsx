import React, { useState } from 'react';
import {
  Wallet, Plus, ArrowLeftRight, CheckCircle2, AlertCircle,
  Building2, Landmark, DollarSign, Calendar, Edit3, Trash2, Archive, ArchiveRestore
} from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import { CurrencyInput } from '../components/common/CurrencyInput';
import { CustomSelect } from '../components/common/CustomSelect';
import { AccountType } from '../types';

export const AccountsPage: React.FC = () => {
  const {
    accounts, transfers, expenses, incomes,
    addAccount, updateAccount, deleteAccount,
    reconcileAccount, addTransfer
  } = useFinanceStore();
  const { currency, privacyMode } = useSettingsStore();

  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || '');

  // New Account Form
  const [name, setName] = useState('');
  const [accountNameError, setAccountNameError] = useState<string | null>(null);
  const [type, setType] = useState<AccountType>('Savings');
  const [openingBalance, setOpeningBalance] = useState<number | ''>('');
  const [color, setColor] = useState('#4F46E5');

  // Transfer Form
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id || '');
  const [transferAmount, setTransferAmount] = useState<number | ''>('');
  const [transferAmountError, setTransferAmountError] = useState<string | null>(null);
  const [transferFee, setTransferFee] = useState<number | ''>('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferNote, setTransferNote] = useState('');

  // Reconcile Form
  const [actualStatementBalance, setActualStatementBalance] = useState<number | ''>('');
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  // Delete confirmation
  const [accountToDelete, setAccountToDelete] = useState<typeof accounts[0] | null>(null);

  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const archivedAccounts = accounts.filter((a) => a.isArchived);

  // Dynamic balance calculation per account from records
  const calculateBalance = (account: typeof accounts[0]) => {
    const accIncomes = incomes.filter((i) => i.accountId === account.id && !i.isDeleted);
    const accExpenses = expenses.filter((e) => e.accountId === account.id && !e.isDeleted);
    const inTransfers = transfers.filter((t) => t.toAccountId === account.id);
    const outTransfers = transfers.filter((t) => t.fromAccountId === account.id);

    const totalIn = accIncomes.reduce((s, i) => s + i.amount, 0);
    const totalOut = accExpenses.reduce((s, e) => s + e.amount, 0);
    const totalTrIn = inTransfers.reduce((s, t) => s + t.amount, 0);
    const totalTrOut = outTransfers.reduce((s, t) => s + t.amount, 0);

    return account.openingBalance + totalIn + totalTrIn - totalOut - totalTrOut;
  };

  const totalLiquidCash = activeAccounts.reduce((sum, acc) => sum + calculateBalance(acc), 0);

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setAccountNameError('Account name is required');
      return;
    }
    setAccountNameError(null);
    addAccount({
      name: name.trim(),
      type,
      openingBalance: Number(openingBalance) || 0,
      currency,
      color,
    });
    setName('');
    setOpeningBalance('');
    setIsAddAccountModalOpen(false);
  };

  const handleCreateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferAmount || Number(transferAmount) <= 0) {
      setTransferAmountError('Please enter a valid transfer amount greater than ₹0');
      return;
    }
    if (fromAccountId === toAccountId) {
      setTransferAmountError('Source and destination accounts must be different');
      return;
    }
    setTransferAmountError(null);
    addTransfer({
      fromAccountId,
      toAccountId,
      amount: Number(transferAmount),
      date: transferDate,
      fee: transferFee ? Number(transferFee) : undefined,
      note: transferNote || undefined,
    });
    setTransferAmount('');
    setTransferFee('');
    setTransferNote('');
    setIsTransferModalOpen(false);
  };

  const handleReconcile = (e: React.FormEvent) => {
    e.preventDefault();
    if (actualStatementBalance === '') {
      setReconcileError('Please enter the statement balance');
      return;
    }
    if (!selectedAccountId) return;
    setReconcileError(null);
    reconcileAccount(selectedAccountId, Number(actualStatementBalance));
    setActualStatementBalance('');
    setIsReconcileModalOpen(false);
  };

  const activeReconcileAccount = accounts.find((a) => a.id === selectedAccountId);
  const activeComputedBal = activeReconcileAccount ? calculateBalance(activeReconcileAccount) : 0;
  const reconcileDiff = actualStatementBalance !== '' ? Number(actualStatementBalance) - activeComputedBal : 0;

  const handleDeleteAccount = () => {
    if (!accountToDelete) return;
    deleteAccount(accountToDelete.id);
    setAccountToDelete(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Bank Accounts &amp; Wallets
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Dynamic ledger balances, first-class transfers, and statement reconciliation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors shadow-xs"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-600" />
            Transfer Money
          </button>
          <button
            onClick={() => setIsAddAccountModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Account
          </button>
        </div>
      </div>

      {/* Dominant Total Cash Card */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <span className="text-xs text-neutral-400">Total Liquid Cash Across Accounts</span>
        <div className="text-3xl font-bold font-mono tabular-nums text-neutral-900 dark:text-neutral-50 mt-1">
          {formatCurrency(totalLiquidCash, currency, privacyMode)}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Transfers between accounts are recorded as balance shifts and never counted as spending or income.
        </p>
      </div>

      {/* Accounts Grid — Active */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeAccounts.map((acc) => {
          const bal = calculateBalance(acc);
          return (
            <div
              key={acc.id}
              className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold text-sm shadow-xs"
                      style={{ backgroundColor: acc.color }}
                    >
                      {acc.name[0]}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {acc.name}
                      </h4>
                      <span className="text-[11px] text-neutral-400">{acc.type}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        setActualStatementBalance('');
                        setIsReconcileModalOpen(true);
                      }}
                      className="text-[11px] text-indigo-600 hover:underline dark:text-indigo-400 font-medium"
                    >
                      Reconcile
                    </button>
                    <button
                      onClick={() => updateAccount(acc.id, { isArchived: true })}
                      className="rounded p-1 text-neutral-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/40 dark:hover:text-amber-400 transition-colors"
                      title="Archive (deactivate) account"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setAccountToDelete(acc)}
                      className="rounded p-1 text-neutral-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
                      title="Delete account"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <span className="text-xs text-neutral-400 block">Computed Balance</span>
                  <span className="text-xl font-bold font-mono tabular-nums text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(bal, currency, privacyMode)}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
                <span>Opening: {formatCurrency(acc.openingBalance, currency, privacyMode)}</span>
                {acc.lastReconciledAt && (
                  <span>Reconciled: {formatDate(acc.lastReconciledAt)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Archived Accounts */}
      {archivedAccounts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Archive className="h-4 w-4 text-neutral-400" />
            <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
              Archived Accounts ({archivedAccounts.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {archivedAccounts.map((acc) => {
              const bal = calculateBalance(acc);
              return (
                <div
                  key={acc.id}
                  className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/50 shadow-xs opacity-60"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold text-sm shadow-xs grayscale"
                          style={{ backgroundColor: acc.color }}
                        >
                          {acc.name[0]}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-neutral-600 dark:text-neutral-400 line-through">
                            {acc.name}
                          </h4>
                          <span className="text-[11px] text-neutral-400">{acc.type} · Archived</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateAccount(acc.id, { isArchived: false })}
                          className="rounded p-1 text-neutral-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 transition-colors"
                          title="Reactivate account"
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setAccountToDelete(acc)}
                          className="rounded p-1 text-neutral-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
                          title="Delete account"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-4">
                      <span className="text-xs text-neutral-400 block">Last Balance</span>
                      <span className="text-xl font-bold font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
                        {formatCurrency(bal, currency, privacyMode)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transfer History Table */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Recent Account Transfers ({transfers.length})
          </h3>
          <span className="text-xs text-neutral-400">Internal balance shifts</span>
        </div>

        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {transfers.length === 0 ? (
            <p className="py-6 text-center text-xs text-neutral-400">No transfers recorded.</p>
          ) : (
            transfers.map((tr) => {
              const fromAcc = accounts.find((a) => a.id === tr.fromAccountId);
              const toAcc = accounts.find((a) => a.id === tr.toAccountId);
              return (
                <div key={tr.id} className="p-4 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                      <ArrowLeftRight className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold text-neutral-900 dark:text-neutral-100">
                        <span>{fromAcc?.name || 'Account'}</span>
                        <span className="text-neutral-400">→</span>
                        <span>{toAcc?.name || 'Account'}</span>
                      </div>
                      <span className="text-[11px] text-neutral-400 font-mono">
                        {formatDate(tr.date)} {tr.note && `· ${tr.note}`}
                      </span>
                    </div>
                  </div>

                  <span className="font-mono font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(tr.amount, currency, privacyMode)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Account Modal */}
      <Modal
        isOpen={isAddAccountModalOpen}
        onClose={() => setIsAddAccountModalOpen(false)}
        title="Add Bank Account or Wallet"
      >
        <form noValidate onSubmit={handleCreateAccount} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Account Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (accountNameError) setAccountNameError(null);
              }}
              placeholder="e.g. Axis Priority Salary"
              className={`w-full rounded-lg border bg-white p-2 text-xs text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
                accountNameError ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}
            />
            {accountNameError && <p className="text-[11px] font-medium text-rose-500 mt-1">{accountNameError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Account Type
              </label>
              <CustomSelect
                value={type}
                onChange={(val) => setType(val as AccountType)}
                className="w-full"
                options={[
                  { value: 'Savings', label: 'Savings' },
                  { value: 'Current', label: 'Current' },
                  { value: 'Cash', label: 'Cash' },
                  { value: 'Wallet', label: 'Wallet / UPI' },
                  { value: 'Investment cash', label: 'Investment cash' },
                  { value: 'Other', label: 'Other' },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Opening Balance
              </label>
              <CurrencyInput value={openingBalance} onChange={setOpeningBalance} placeholder="0.00" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Theme Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-12 cursor-pointer rounded border border-neutral-300 p-0.5"
              />
              <span className="text-xs font-mono text-neutral-500">{color}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsAddAccountModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
            >
              Save Account
            </button>
          </div>
        </form>
      </Modal>

      {/* Transfer Money Modal */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Transfer Money Between Accounts"
        subtitle="Excluded from spending reports"
      >
        <form noValidate onSubmit={handleCreateTransfer} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                From Account
              </label>
              <CustomSelect
                value={fromAccountId}
                onChange={setFromAccountId}
                className="w-full"
                options={activeAccounts.map((a) => ({
                  value: a.id,
                  label: `${a.name} (${formatCurrency(calculateBalance(a), currency, privacyMode)})`,
                }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                To Account
              </label>
              <CustomSelect
                value={toAccountId}
                onChange={setToAccountId}
                className="w-full"
                options={activeAccounts
                  .filter((a) => a.id !== fromAccountId)
                  .map((a) => ({
                    value: a.id,
                    label: a.name,
                  }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Transfer Amount *
              </label>
              <CurrencyInput
                value={transferAmount}
                onChange={(val) => {
                  setTransferAmount(val);
                  if (transferAmountError) setTransferAmountError(null);
                }}
                hasError={!!transferAmountError}
              />
              {transferAmountError && <p className="text-[11px] font-medium text-rose-500 mt-1">{transferAmountError}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Date
              </label>
              <input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Note
            </label>
            <input
              type="text"
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
              placeholder="e.g. ATM withdrawal / UPI topup"
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
            >
              Record Transfer
            </button>
          </div>
        </form>
      </Modal>

      {/* Reconciliation Wizard Modal */}
      <Modal
        isOpen={isReconcileModalOpen}
        onClose={() => setIsReconcileModalOpen(false)}
        title={`Reconcile ${activeReconcileAccount?.name}`}
        subtitle="Compare calculated ledger balance with real bank statement"
      >
        <form noValidate onSubmit={handleReconcile} className="flex flex-col gap-4 text-xs">
          <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800">
            <div className="flex justify-between mb-1">
              <span className="text-neutral-500">Current Computed Balance:</span>
              <span className="font-mono font-bold">
                {formatCurrency(activeComputedBal, currency, privacyMode)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-neutral-700 dark:text-neutral-300 mb-1 font-medium">
              Actual Bank Statement Balance *
            </label>
            <CurrencyInput
              value={actualStatementBalance}
              onChange={(val) => {
                setActualStatementBalance(val);
                if (reconcileError) setReconcileError(null);
              }}
              placeholder="Enter exact figure from bank statement"
              hasError={!!reconcileError}
            />
            {reconcileError && <p className="text-[11px] font-medium text-rose-500 mt-1">{reconcileError}</p>}
          </div>

          {actualStatementBalance !== '' && (
            <div
              className={`rounded-lg p-3 ${
                reconcileDiff === 0
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
              }`}
            >
              {reconcileDiff === 0 ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Perfect match! No adjustment entry needed.</span>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">
                      Discrepancy: {formatCurrency(reconcileDiff, currency, false)}
                    </span>
                    <span className="text-[11px]">
                      Confirming will create a reconciliation balance adjustment entry to synchronize balances.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsReconcileModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 shadow-xs"
            >
              Confirm Reconciliation
            </button>
          </div>
        </form>
      </Modal>
      {/* Delete Account Confirmation Modal */}
      <Modal
        isOpen={!!accountToDelete}
        onClose={() => setAccountToDelete(null)}
        title="Delete Account"
      >
        <div className="flex flex-col gap-4 text-xs">
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
            <p className="font-semibold mb-1">Are you sure you want to delete <span className="font-bold">{accountToDelete?.name}</span>?</p>
            <p className="text-[11px] opacity-80">This account will be removed. Past transactions linked to it will remain in your records but the account balance will no longer be tracked.</p>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setAccountToDelete(null)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 shadow-xs transition-colors"
            >
              Delete Account
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
