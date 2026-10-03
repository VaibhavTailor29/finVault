import React, { useState } from 'react';
import {
  Users, Plus, ArrowUpRight, ArrowDownRight, CheckCircle2,
  Share2, Calendar, Phone, Mail, FileText, Check, DollarSign,
  Send, AlertCircle, Loader2, Trash2
} from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { CurrencyInput } from '../components/common/CurrencyInput';
import { LedgerType, Person, LedgerEntry } from '../types';
import { apiClient } from '../api/client';

export const PeopleLedgerPage: React.FC = () => {
  const {
    people, ledgerEntries, expenses, categories,
    addPerson, updatePerson, deletePerson, addLedgerEntry, deleteLedgerEntry,
    settlePersonDebt, addNotification
  } = useFinanceStore();
  const { currency, privacyMode } = useSettingsStore();

  const [activePersonId, setActivePersonId] = useState<string>(people[0]?.id || '');
  const selectedPerson = people.find((p) => p.id === activePersonId) || people[0];

  // Modals
  const [isAddPersonModalOpen, setIsAddPersonModalOpen] = useState(false);
  const [isAddEntryModalOpen, setIsAddEntryModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedStatement, setCopiedStatement] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatusMessage, setEmailStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Deletion Confirmation States
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<LedgerEntry | null>(null);

  // New Person Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [avatarColor, setAvatarColor] = useState('#10B981');

  // New Entry Form
  const [entryType, setEntryType] = useState<LedgerType>('lent');
  const [entryAmount, setEntryAmount] = useState<number | ''>('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryNote, setEntryNote] = useState('');
  const [entryDueDate, setEntryDueDate] = useState('');

  // Calculations
  const nonDeletedEntries = ledgerEntries.filter((l) => !l.isDeleted);
  const personEntries = nonDeletedEntries.filter((l) => l.personId === selectedPerson?.id);

  let netBalance = 0;
  let totalLent = 0;
  let totalBorrowed = 0;
  personEntries.forEach((e) => {
    if (!e.isSettled) {
      if (e.type === 'lent') {
        netBalance += e.amount;
        totalLent += e.amount;
      } else if (e.type === 'borrowed') {
        netBalance -= e.amount;
        totalBorrowed += e.amount;
      }
    }
  });

  // Global calculations across all people
  let globalLent = 0;
  let globalBorrowed = 0;
  nonDeletedEntries.forEach((e) => {
    if (!e.isSettled) {
      if (e.type === 'lent') globalLent += e.amount;
      else if (e.type === 'borrowed') globalBorrowed += e.amount;
    }
  });
  const globalNet = globalLent - globalBorrowed;

  // Expenses spent on this person
  const spentOnPersonExpenses = expenses.filter(
    (e) => !e.isDeleted && e.personId === selectedPerson?.id
  );
  const totalSpentOnPerson = spentOnPersonExpenses.reduce((sum, e) => sum + e.amount, 0);

  const handleCreatePerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addPerson({
      name: name.trim(),
      phone: phone || undefined,
      email: email || undefined,
      notes: notes || undefined,
      avatarColor,
    });
    setName('');
    setPhone('');
    setEmail('');
    setNotes('');
    setIsAddPersonModalOpen(false);
  };

  const handleCreateEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryAmount || Number(entryAmount) <= 0 || !selectedPerson) return;
    addLedgerEntry({
      personId: selectedPerson.id,
      type: entryType,
      amount: Number(entryAmount),
      date: entryDate,
      note: entryNote || undefined,
      dueDate: entryDueDate || undefined,
      isSettled: false,
    });
    setEntryAmount('');
    setEntryNote('');
    setEntryDueDate('');
    setIsAddEntryModalOpen(false);
  };

  const generateStatementText = () => {
    if (!selectedPerson) return '';
    const statusLine =
      netBalance > 0
        ? `Net Owed to Me: ${formatCurrency(netBalance, currency, false)}`
        : netBalance < 0
        ? `Net I Owe: ${formatCurrency(Math.abs(netBalance), currency, false)}`
        : 'All accounts settled.';

    const lines = [
      `LEDGER STATEMENT: ${selectedPerson.name}`,
      `Date: ${formatDate(new Date().toISOString())}`,
      `Status: ${statusLine}`,
      '',
      'Unsettled Entries:',
      ...personEntries
        .filter((e) => !e.isSettled)
        .map(
          (e) =>
            `- [${formatDate(e.date)}] ${e.type.toUpperCase()}: ${formatCurrency(
              e.amount,
              currency,
              false
            )} (${e.note || 'No note'})`
        ),
    ];
    return lines.join('\n');
  };

  const handleSendEmailReminder = async (via: 'api' | 'mailto') => {
    if (!selectedPerson) return;
    const targetEmail = (recipientEmail || selectedPerson.email || '').trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setEmailStatusMessage({ type: 'error', text: 'Please enter a valid recipient email address.' });
      return;
    }

    if (!selectedPerson.email && recipientEmail) {
      updatePerson(selectedPerson.id, { email: recipientEmail });
    }

    const statement = generateStatementText();
    const formattedAmount = formatCurrency(Math.abs(netBalance), currency, false);
    const subject = `Payment Reminder: Pending balance of ${formattedAmount} with FinVault`;

    if (via === 'mailto') {
      const mailtoUrl = `mailto:${encodeURIComponent(targetEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(statement)}`;
      window.open(mailtoUrl, '_blank');
      setEmailStatusMessage({ type: 'success', text: `Opened default mail client for ${targetEmail}.` });
      return;
    }

    try {
      setIsSendingEmail(true);
      setEmailStatusMessage(null);
      const unsettled = personEntries.filter((e) => !e.isSettled);
      const res = await apiClient.sendDebtReminder({
        personId: selectedPerson.id,
        personName: selectedPerson.name,
        recipientEmail: targetEmail,
        netBalance: netBalance,
        currency: currency,
        entries: unsettled,
      });

      setEmailStatusMessage({
        type: 'success',
        text: res.message || `Reminder email dispatched successfully to ${targetEmail}!`
      });
      addNotification({
        title: `Reminder Sent to ${selectedPerson.name}`,
        message: `Statement reminder dispatched to ${targetEmail} for ${formattedAmount}.`,
        type: 'due_reminder',
      });
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to dispatch email via server.';
      setEmailStatusMessage({ type: 'error', text: `${errorMsg} Opening mail app instead...` });
      const mailtoUrl = `mailto:${encodeURIComponent(targetEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(statement)}`;
      window.open(mailtoUrl, '_blank');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleConfirmDeletePerson = () => {
    if (!personToDelete) return;
    const targetId = personToDelete.id;
    deletePerson(targetId);
    const remaining = people.filter((p) => p.id !== targetId);
    setActivePersonId(remaining[0]?.id || '');
    setPersonToDelete(null);
  };

  const handleConfirmDeleteEntry = () => {
    if (!entryToDelete) return;
    deleteLedgerEntry(entryToDelete.id);
    setEntryToDelete(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            People Debt Ledger
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Lend, borrow, settle debts, and track mutual spending with contacts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddPersonModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Contact
          </button>
          <button
            onClick={() => setIsAddEntryModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-xs"
          >
            New Ledger Entry
          </button>
        </div>
      </div>

      {/* Global Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
            <span>Total I'm Owed (Lent)</span>
            <ArrowDownRight className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            +{formatCurrency(globalLent, currency, privacyMode)}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
            <span>Total I Owe (Borrowed)</span>
            <ArrowUpRight className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
            -{formatCurrency(globalBorrowed, currency, privacyMode)}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
            <span>Net Balance Position</span>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums ${
              globalNet >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {globalNet >= 0 ? '+' : ''}
            {formatCurrency(globalNet, currency, privacyMode)}
          </div>
        </div>
      </div>

      {/* Main Split Layout: Contacts List on Left, Active Ledger on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contacts Sidebar */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
            Contacts ({people.length})
          </h3>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {people.map((p) => {
              const entries = nonDeletedEntries.filter((l) => l.personId === p.id && !l.isSettled);
              let pNet = 0;
              entries.forEach((e) => {
                if (e.type === 'lent') pNet += e.amount;
                else if (e.type === 'borrowed') pNet -= e.amount;
              });

              const isSelected = p.id === (selectedPerson?.id || '');

              return (
                <div
                  key={p.id}
                  onClick={() => setActivePersonId(p.id)}
                  className={`group w-full flex items-center justify-between p-3 text-left transition-colors rounded-lg my-1 cursor-pointer ${
                    isSelected
                      ? 'bg-neutral-100 dark:bg-neutral-800'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white font-bold text-xs"
                      style={{ backgroundColor: p.avatarColor }}
                    >
                      {p.name[0]}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                        {p.name}
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        {entries.length === 0 ? 'Settled' : `${entries.length} pending`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-xs font-bold tabular-nums ${
                        pNet > 0
                          ? 'text-emerald-600'
                          : pNet < 0
                          ? 'text-rose-600'
                          : 'text-neutral-400'
                      }`}
                    >
                      {pNet === 0 ? '₹0' : formatCurrency(pNet, currency, privacyMode)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPersonToDelete(p);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-rose-600 rounded transition-opacity"
                      title="Delete contact ledger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Person Ledger Detail (Right 2 cols) */}
        {selectedPerson && (
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Person Banner & Settle Button */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-white font-bold text-base"
                    style={{ backgroundColor: selectedPerson.avatarColor }}
                  >
                    {selectedPerson.name[0]}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                      {selectedPerson.name}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-neutral-400 mt-0.5">
                      {selectedPerson.phone && <span>{selectedPerson.phone}</span>}
                      {selectedPerson.email && <span>{selectedPerson.email}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {netBalance > 0 && (
                    <button
                      onClick={() => {
                        setRecipientEmail(selectedPerson.email || '');
                        setEmailStatusMessage(null);
                        setIsShareModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition-colors shadow-xs"
                      title="Send payment reminder email"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Email Reminder
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setRecipientEmail(selectedPerson.email || '');
                      setEmailStatusMessage(null);
                      setIsShareModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share Statement
                  </button>
                  {netBalance !== 0 && (
                    <button
                      onClick={() => settlePersonDebt(selectedPerson.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Settle Up ({formatCurrency(Math.abs(netBalance), currency, privacyMode)})
                    </button>
                  )}
                  <button
                    onClick={() => setPersonToDelete(selectedPerson)}
                    className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60 transition-colors shadow-xs"
                    title="Delete this contact and all associated ledger transactions"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Ledger
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-neutral-400 block">Current Status</span>
                  <span
                    className={`font-semibold font-mono tabular-nums text-sm ${
                      netBalance > 0
                        ? 'text-emerald-600'
                        : netBalance < 0
                        ? 'text-rose-600'
                        : 'text-neutral-500'
                    }`}
                  >
                    {netBalance > 0
                      ? `They owe you ${formatCurrency(netBalance, currency, privacyMode)}`
                      : netBalance < 0
                      ? `You owe ${formatCurrency(Math.abs(netBalance), currency, privacyMode)}`
                      : 'All settled up'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400 block">Total Spent On Person</span>
                  <span className="font-semibold font-mono tabular-nums text-sm text-neutral-800 dark:text-neutral-200">
                    {formatCurrency(totalSpentOnPerson, currency, privacyMode)}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400 block">Pending Entries</span>
                  <span className="font-semibold text-sm text-neutral-800 dark:text-neutral-200">
                    {personEntries.filter((e) => !e.isSettled).length} items
                  </span>
                </div>
              </div>
            </div>

            {/* Ledger Running History */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
              <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 pb-3 border-b border-neutral-100 dark:border-neutral-800 mb-3">
                Ledger Transactions
              </h4>

              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {personEntries.length === 0 ? (
                  <p className="py-6 text-center text-xs text-neutral-400">
                    No debt records found for {selectedPerson.name}.
                  </p>
                ) : (
                  personEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between py-3 text-xs ${
                        entry.isSettled ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            entry.type === 'lent'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : entry.type === 'borrowed'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                              : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
                          }`}
                        >
                          {entry.type === 'lent' ? '↑' : entry.type === 'borrowed' ? '↓' : '✓'}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {entry.note || (entry.type === 'lent' ? 'I Lent' : 'I Borrowed')}
                          </span>
                          <span className="text-[11px] text-neutral-400 font-mono">
                            {formatDate(entry.date)}
                            {entry.dueDate && ` · Due: ${formatDate(entry.dueDate)}`}
                            {entry.isSettled && ' · Settled'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span
                          className={`font-mono font-bold text-sm tabular-nums ${
                            entry.type === 'lent'
                              ? 'text-emerald-600'
                              : entry.type === 'borrowed'
                              ? 'text-rose-600'
                              : 'text-indigo-600'
                          }`}
                        >
                          {entry.type === 'lent' ? '+' : entry.type === 'borrowed' ? '-' : ''}
                          {formatCurrency(entry.amount, currency, privacyMode)}
                        </span>
                        <button
                          onClick={() => setEntryToDelete(entry)}
                          className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Delete this ledger transaction"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Spent On Person Report */}
            {spentOnPersonExpenses.length > 0 && (
              <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 pb-3 border-b border-neutral-100 dark:border-neutral-800 mb-3">
                  Expenses Spent on / with {selectedPerson.name}
                </h4>
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {spentOnPersonExpenses.map((exp) => {
                    const cat = categories.find((c) => c.id === exp.categoryId);
                    return (
                      <div key={exp.id} className="flex items-center justify-between py-2 text-xs">
                        <div className="flex flex-col">
                          <span className="font-medium text-neutral-900 dark:text-neutral-100">
                            {exp.note || cat?.name}
                          </span>
                          <span className="text-[11px] text-neutral-400">
                            {cat?.name} · {formatDate(exp.date)}
                          </span>
                        </div>
                        <span className="font-mono tabular-nums text-neutral-800 dark:text-neutral-200">
                          {formatCurrency(exp.amount, currency, privacyMode)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Contact Modal */}
      <Modal
        isOpen={isAddPersonModalOpen}
        onClose={() => setIsAddPersonModalOpen(false)}
        title="Add Contact"
      >
        <form onSubmit={handleCreatePerson} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Contact Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Arjun Kapoor"
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765..."
                className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="arjun@example.com"
                className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Roommate, split rent"
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsAddPersonModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
            >
              Add Contact
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Ledger Entry Modal */}
      <Modal
        isOpen={isAddEntryModalOpen}
        onClose={() => setIsAddEntryModalOpen(false)}
        title={`New Ledger Entry with ${selectedPerson?.name}`}
      >
        <form onSubmit={handleCreateEntry} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Entry Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEntryType('lent')}
                className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                  entryType === 'lent'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-neutral-300 text-neutral-700'
                }`}
              >
                I Lent (They owe me)
              </button>
              <button
                type="button"
                onClick={() => setEntryType('borrowed')}
                className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                  entryType === 'borrowed'
                    ? 'border-rose-600 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                    : 'border-neutral-300 text-neutral-700'
                }`}
              >
                I Borrowed (I owe them)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Amount
            </label>
            <CurrencyInput value={entryAmount} onChange={setEntryAmount} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Expected Due Date (Optional)
              </label>
              <input
                type="date"
                value={entryDueDate}
                onChange={(e) => setEntryDueDate(e.target.value)}
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
              value={entryNote}
              onChange={(e) => setEntryNote(e.target.value)}
              placeholder="e.g. Lunch bill split"
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsAddEntryModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
            >
              Record Entry
            </button>
          </div>
        </form>
      </Modal>

      {/* Share Statement Modal */}
      <Modal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title={`Share Statement & Email Reminder: ${selectedPerson?.name}`}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Recipient Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                placeholder="contact@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 pl-8"
              />
              <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
            </div>
            {!selectedPerson?.email && recipientEmail && (
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 block">
                Will save this email to {selectedPerson?.name}'s contact profile.
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Statement Preview
            </label>
            <textarea
              readOnly
              rows={7}
              value={generateStatementText()}
              className="w-full rounded-lg border border-neutral-300 bg-neutral-50 p-3 font-mono text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            />
          </div>

          {emailStatusMessage && (
            <div
              className={`flex items-center gap-2 p-2.5 rounded-lg text-xs ${
                emailStatusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {emailStatusMessage.type === 'success' ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{emailStatusMessage.text}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(generateStatementText());
                setCopiedStatement(true);
                setTimeout(() => setCopiedStatement(false), 2000);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
            >
              {copiedStatement ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Share2 className="h-3.5 w-3.5" />}
              {copiedStatement ? 'Copied' : 'Copy Text'}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSendEmailReminder('mailto')}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                title="Open system email client"
              >
                <Mail className="h-3.5 w-3.5" />
                Open Email App
              </button>

              <button
                type="button"
                disabled={isSendingEmail}
                onClick={() => handleSendEmailReminder('api')}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs disabled:opacity-50"
              >
                {isSendingEmail ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {isSendingEmail ? 'Dispatching...' : 'Send Email Reminder'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Contact Ledger Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!personToDelete}
        onClose={() => setPersonToDelete(null)}
        onConfirm={handleConfirmDeletePerson}
        title="Delete Contact Ledger"
        message={`Are you sure you want to delete ${personToDelete?.name}? All associated ledger entries and transactions will be permanently removed.`}
        confirmLabel="Delete Ledger"
        isDestructive={true}
      />

      {/* Delete Single Ledger Entry Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!entryToDelete}
        onClose={() => setEntryToDelete(null)}
        onConfirm={handleConfirmDeleteEntry}
        title="Delete Ledger Transaction"
        message={`Are you sure you want to delete this ${entryToDelete?.type || 'ledger'} entry for ${formatCurrency(entryToDelete?.amount || 0, currency, false)} (${entryToDelete?.note || 'No note'})?`}
        confirmLabel="Delete Entry"
        isDestructive={true}
      />
    </div>
  );
};
