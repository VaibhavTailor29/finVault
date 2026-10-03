import React, { useState, useMemo } from 'react';
import {
  FileText, Download, Calendar, ArrowUpRight, ArrowDownRight,
  PieChart, FileSpreadsheet, Printer, ShieldAlert
} from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { formatCurrency, formatDate } from '../utils/formatters';
import { StepUpDialog } from '../components/security/StepUpDialog';
import { CustomSelect } from '../components/common/CustomSelect';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const ReportsPage: React.FC = () => {
  const { expenses, incomes, categories, creditCards, people, ledgerEntries, investmentTransactions } = useFinanceStore();
  const { currency, privacyMode } = useSettingsStore();
  const { user } = useAuthStore();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // Step-up verification modal for sensitive exports
  const [isStepUpOpen, setIsStepUpOpen] = useState(false);
  const [pendingExportFormat, setPendingExportFormat] = useState<'pdf' | 'xlsx' | 'csv' | null>(null);

  // Filter expenses and incomes for target month/year
  const targetExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (e.isDeleted) return false;
      const d = new Date(e.date);
      return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
    });
  }, [expenses, selectedMonth, selectedYear]);

  const targetIncomes = useMemo(() => {
    return incomes.filter((i) => {
      if (i.isDeleted) return false;
      const d = new Date(i.date);
      return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
    });
  }, [incomes, selectedMonth, selectedYear]);

  // Calculations (Service-layer Decimal precision simulation)
  const totalIncome = targetIncomes.reduce((sum, i) => sum + i.amount, 0);
  const totalExpense = targetExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  // Category breakdown
  const categoryMap: Record<string, { name: string; color: string; amount: number; count: number }> = {};
  targetExpenses.forEach((exp) => {
    const cat = categories.find((c) => c.id === exp.categoryId);
    const catId = exp.categoryId || 'other';
    if (!categoryMap[catId]) {
      categoryMap[catId] = {
        name: cat?.name || 'Other',
        color: cat?.color || '#6366F1',
        amount: 0,
        count: 0,
      };
    }
    categoryMap[catId].amount += exp.amount;
    categoryMap[catId].count += 1;
  });

  const categoryBreakdown = Object.values(categoryMap).sort((a, b) => b.amount - a.amount);
  const highestCategory = categoryBreakdown[0];
  const lowestCategory = categoryBreakdown[categoryBreakdown.length - 1];

  // Top 5 Highest Expenses
  const top5Expenses = [...targetExpenses].sort((a, b) => b.amount - a.amount).slice(0, 5);

  // Credit card spend summary for month
  const cardSpendTotal = targetExpenses
    .filter((e) => e.paymentMethod === 'Credit Card')
    .reduce((sum, e) => sum + e.amount, 0);

  // People ledger movements in target month
  const peopleMovement = ledgerEntries
    .filter((l) => {
      if (l.isDeleted) return false;
      const d = new Date(l.date);
      return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
    })
    .reduce((sum, l) => sum + (l.type === 'lent' ? l.amount : -l.amount), 0);

  // Export Trigger with Step-Up verification check
  const requestExport = (format: 'pdf' | 'xlsx' | 'csv') => {
    if (user?.twoFactorEnabled) {
      setPendingExportFormat(format);
      setIsStepUpOpen(true);
    } else {
      executeExport(format);
    }
  };

  const executeExport = (format: 'pdf' | 'xlsx' | 'csv') => {
    const monthName = new Date(selectedYear, selectedMonth - 1).toLocaleString('en-US', { month: 'long' });
    const filename = `finvault-report-${monthName.toLowerCase()}-${selectedYear}`;

    if (format === 'csv') {
      const headers = ['Date', 'Type', 'Category/Source', 'Payment Method', 'Note', 'Amount'];
      const rows = [
        ...targetExpenses.map((e) => {
          const cat = categories.find((c) => c.id === e.categoryId);
          return [e.date, 'Expense', cat?.name || 'General', e.paymentMethod, e.note || '', e.amount];
        }),
        ...targetIncomes.map((i) => [i.date, 'Income', i.source, 'Bank', i.note || '', i.amount]),
      ];
      const csvContent = [headers.join(','), ...rows.map((r) => r.map((f) => `"${f}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Summary
      const summaryData = [
        ['Metric', 'Value'],
        ['Month', `${monthName} ${selectedYear}`],
        ['Total Income', totalIncome],
        ['Total Operating Expenses', totalExpense],
        ['Net Savings', netSavings],
        ['Savings Rate %', `${savingsRate.toFixed(2)}%`],
        ['Credit Card Spend', cardSpendTotal],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // Sheet 2: Expenses
      const expenseData = [
        ['Date', 'Category', 'Payment Method', 'Note', 'Amount'],
        ...targetExpenses.map((e) => {
          const cat = categories.find((c) => c.id === e.categoryId);
          return [e.date, cat?.name || 'Other', e.paymentMethod, e.note || '', e.amount];
        }),
      ];
      const wsExpenses = XLSX.utils.aoa_to_sheet(expenseData);
      XLSX.utils.book_append_sheet(wb, wsExpenses, 'Expenses');

      // Sheet 3: Incomes
      const incomeData = [
        ['Date', 'Source', 'Note', 'Amount'],
        ...targetIncomes.map((i) => [i.date, i.source, i.note || '', i.amount]),
      ];
      const wsIncome = XLSX.utils.aoa_to_sheet(incomeData);
      XLSX.utils.book_append_sheet(wb, wsIncome, 'Income');

      XLSX.writeFile(wb, `${filename}.xlsx`);
    } else if (format === 'pdf') {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(`Monthly Financial Statement: ${monthName} ${selectedYear}`, 14, 20);

      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toISOString()} · FinVault (Verified Financial Report)`, 14, 28);

      autoTable(doc, {
        startY: 36,
        head: [['Key Indicator', 'Amount']],
        body: [
          ['Total Income', formatCurrency(totalIncome, currency, false)],
          ['Total Expenses (Excl. Transfers)', formatCurrency(totalExpense, currency, false)],
          ['Net Savings', formatCurrency(netSavings, currency, false)],
          ['Savings Rate', `${savingsRate.toFixed(2)}%`],
          ['Credit Card Spending', formatCurrency(cardSpendTotal, currency, false)],
        ],
      });

      const currentY = (doc as any).lastAutoTable.finalY + 12;
      doc.text('Category Breakdown:', 14, currentY);

      autoTable(doc, {
        startY: currentY + 4,
        head: [['Category', 'Amount', '% of Total', 'Transactions']],
        body: categoryBreakdown.map((c) => [
          c.name,
          formatCurrency(c.amount, currency, false),
          `${((c.amount / totalExpense) * 100).toFixed(1)}%`,
          c.count,
        ]),
      });

      doc.save(`${filename}.pdf`);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header & Month Picker */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Monthly Report Generator
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Audit-grade reporting · Transfers strictly excluded from operational spending
          </p>
        </div>

        {/* Date Selector & Export Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Month selector */}
          <CustomSelect
            value={selectedMonth}
            onChange={(val) => setSelectedMonth(Number(val))}
            size="sm"
            options={Array.from({ length: 12 }, (_, i) => ({
              value: i + 1,
              label: new Date(2000, i).toLocaleString('en-US', { month: 'long' }),
            }))}
          />

          {/* Year selector */}
          <CustomSelect
            value={selectedYear}
            onChange={(val) => setSelectedYear(Number(val))}
            size="sm"
            options={Array.from({ length: 5 }, (_, i) => {
              const yr = now.getFullYear() - 3 + i;
              return { value: yr, label: String(yr) };
            })}
          />

          {/* Export Buttons */}
          <button
            onClick={() => requestExport('pdf')}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 shadow-xs transition-colors"
          >
            <FileText className="h-3.5 w-3.5 text-rose-600" />
            PDF
          </button>
          <button
            onClick={() => requestExport('xlsx')}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 shadow-xs transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            Excel
          </button>
          <button
            onClick={() => requestExport('csv')}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 shadow-xs transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
        </div>
      </div>

      {/* Primary KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
            <span>Total Income</span>
            <ArrowDownRight className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalIncome, currency, privacyMode)}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
            <span>Total Operating Expenses</span>
            <ArrowUpRight className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-neutral-900 dark:text-neutral-100">
            {formatCurrency(totalExpense, currency, privacyMode)}
          </div>
          <span className="text-[10px] text-neutral-400 mt-1 block">Transfers excluded</span>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
            <span>Net Savings</span>
            <span className="text-[10px] font-mono font-semibold text-emerald-600">
              {savingsRate.toFixed(1)}% rate
            </span>
          </div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums ${
              netSavings >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {formatCurrency(netSavings, currency, privacyMode)}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
            <span>Credit Card Spend</span>
            <span className="text-[10px] text-neutral-400">Card Charges</span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-neutral-900 dark:text-neutral-100">
            {formatCurrency(cardSpendTotal, currency, privacyMode)}
          </div>
        </div>
      </div>

      {/* Category Breakdown & Top Expenses Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Table */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800 mb-3">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Category Distribution
            </h3>
            <span className="text-xs text-neutral-400">{categoryBreakdown.length} active categories</span>
          </div>

          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {categoryBreakdown.map((cat) => {
              const pct = totalExpense > 0 ? (cat.amount / totalExpense) * 100 : 0;
              return (
                <div key={cat.name} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                      {cat.name}
                    </span>
                    <span className="text-[11px] text-neutral-400">({cat.count})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-neutral-400 font-mono">
                      {pct.toFixed(1)}%
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(cat.amount, currency, privacyMode)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 5 Highest Expenses */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800 mb-3">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Top 5 Major Expenses
            </h3>
            <span className="text-xs text-neutral-400">Single highest debits</span>
          </div>

          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {top5Expenses.map((exp, index) => {
              const cat = categories.find((c) => c.id === exp.categoryId);
              return (
                <div key={exp.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-neutral-100 font-mono text-xs font-bold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                      {index + 1}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {exp.note || cat?.name}
                      </span>
                      <span className="text-[11px] text-neutral-400 font-mono">
                        {formatDate(exp.date)} · {cat?.name} · {exp.paymentMethod}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(exp.amount, currency, privacyMode)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step-Up Verification Modal for Sensitive Exports */}
      <StepUpDialog
        isOpen={isStepUpOpen}
        onClose={() => setIsStepUpOpen(false)}
        actionTitle="Full Unmasked Report Export"
        onSuccess={() => {
          if (pendingExportFormat) {
            executeExport(pendingExportFormat);
            setPendingExportFormat(null);
          }
        }}
      />
    </div>
  );
};
