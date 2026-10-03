import React, { useState } from 'react';
import { CalendarClock, CheckCircle, Clock, Plus, Zap, Mail, Bell, Check, Loader2 } from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { formatCurrency, formatDate } from '../utils/formatters';
import { apiClient } from '../api/client';

export const RecurringPage: React.FC = () => {
  const { expenses, incomes, categories, checkAndGenerateDueReminders, addNotification } = useFinanceStore();
  const { currency, privacyMode, reminderEmail, reminderDaysBeforeDue } = useSettingsStore();
  const { user } = useAuthStore();

  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const recurringExpenses = expenses.filter((e) => e.isRecurring && !e.isDeleted);
  const recurringIncomes = incomes.filter((i) => i.isRecurring && !i.isDeleted);

  const totalMonthlyCommitment = recurringExpenses.reduce((sum, e) => sum + e.amount, 0);

  const handleSendReminderEmail = async () => {
    setIsSending(true);
    setFeedback(null);
    try {
      const email = reminderEmail || user?.email || '';
      // Build real sample dues from user's actual recurring expenses
      const sampleDues = recurringExpenses.slice(0, 5).map((e) => {
        const cat = categories.find((c) => c.id === e.categoryId);
        const dueLabel = (e as any).nextDueDate ? `Due ${new Date((e as any).nextDueDate).toLocaleDateString()}` : `Recurring (${e.recurringFrequency || 'Monthly'})`;
        return { title: cat ? `${cat.name}` : (e.note || 'Recurring Expense'), due_in: dueLabel, amount: e.amount };
      });
      const res = await apiClient.sendTestReminder(email, currency, sampleDues.length > 0 ? sampleDues : undefined);
      checkAndGenerateDueReminders(reminderDaysBeforeDue);
      addNotification({
        title: 'Bill & Subscription Reminders Dispatched',
        message: `Dispatched upcoming payment reminders to ${email}.`,
        type: 'due_reminder',
      });
      setFeedback(res.message || `Reminder email dispatched to ${email}!`);
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback('Failed to send reminder email. Check backend connectivity.');
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setIsSending(false);
    }
  };


  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Recurring Bills &amp; Subscriptions
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Automated schedules processed idempotently via scheduled jobs
          </p>
        </div>

        <button
          onClick={handleSendReminderEmail}
          disabled={isSending}
          className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition-colors shadow-xs disabled:opacity-50"
        >
          {isSending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : feedback ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Mail className="h-3.5 w-3.5" />
          )}
          {isSending ? 'Sending...' : feedback ? feedback : 'Email Due Reminders'}
        </button>
      </div>

      {/* Summary Card */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
        <span className="text-xs text-neutral-400">Total Monthly Recurring Outflow</span>
        <div className="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
          {formatCurrency(totalMonthlyCommitment, currency, privacyMode)} / month
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          {recurringExpenses.length} recurring debits active · Email &amp; in-app reminders configured for {reminderDaysBeforeDue} days prior to due date (Recipient: {reminderEmail || user?.email || 'Not configured'})
        </p>
      </div>

      {/* Recurring Expenses Table */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Recurring Debits &amp; Subscriptions
          </h3>
          <span className="text-xs text-neutral-400">{recurringExpenses.length} active</span>
        </div>

        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {recurringExpenses.map((exp) => {
            const cat = categories.find((c) => c.id === exp.categoryId);
            return (
              <div key={exp.id} className="p-4 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                    <CalendarClock className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {exp.note || cat?.name}
                    </h4>
                    <span className="text-[11px] text-neutral-400">
                      Cadence: {exp.recurringFrequency || 'Monthly'} · {exp.paymentMethod}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono font-bold tabular-nums text-neutral-900 dark:text-neutral-100 block">
                    {formatCurrency(exp.amount, currency, privacyMode)}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-medium">Auto-renew active</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recurring Income Streams */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Recurring Income Credits
          </h3>
          <span className="text-xs text-neutral-400">{recurringIncomes.length} active</span>
        </div>

        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {recurringIncomes.map((inc) => (
            <div key={inc.id} className="p-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {inc.note || inc.source}
                  </h4>
                  <span className="text-[11px] text-neutral-400">
                    Cadence: {inc.recurringFrequency || 'Monthly'} · Source: {inc.source}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="font-mono font-bold tabular-nums text-emerald-600 block">
                  +{formatCurrency(inc.amount, currency, privacyMode)}
                </span>
                <span className="text-[10px] text-neutral-400">Scheduled 1st of month</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
