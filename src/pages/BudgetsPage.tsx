import React, { useState } from 'react';
import { PieChart, Plus, AlertTriangle, AlertCircle, CheckCircle2, RotateCcw, Check, Sparkles } from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { formatCurrency } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import { CurrencyInput } from '../components/common/CurrencyInput';

export const BudgetsPage: React.FC = () => {
  const { budgets, categories, expenses, setOverallBudget, setCategoryBudget, resetCategoriesToDefault } = useFinanceStore();
  const { currency, privacyMode } = useSettingsStore();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const monthName = now.toLocaleString('default', { month: 'long' });

  const currentOverallBudget = budgets.find(
    (b) => b.month === currentMonth && b.year === currentYear
  )?.overallAmount || 0;

  const [isOverallModalOpen, setIsOverallModalOpen] = useState(false);
  const [overallInput, setOverallInput] = useState<number | ''>(currentOverallBudget || '');

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [catBudgetInput, setCatBudgetInput] = useState<number | ''>('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Month-to-date spending
  const currentExpenses = expenses.filter((e) => {
    if (e.isDeleted) return false;
    const d = new Date(e.date);
    return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
  });

  const totalSpent = currentExpenses.reduce((sum, e) => sum + e.amount, 0);
  const overallSpentPct = currentOverallBudget > 0 ? (totalSpent / currentOverallBudget) * 100 : 0;
  const totalCategoryBudgets = categories.reduce((sum, c) => sum + (c.monthlyBudget || 0), 0);
  const categoriesWithBudget = categories.filter((c) => (c.monthlyBudget || 0) > 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Monthly Budget Management
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {monthName} {currentYear} · {categoriesWithBudget.length} category limits active · Alert thresholds at 80% and 100%
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              resetCategoriesToDefault();
              setResetSuccess(true);
              setTimeout(() => setResetSuccess(false), 2500);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 transition-colors shadow-xs"
            title="Reset standard fixed categories with sensible preset monthly limits"
          >
            {resetSuccess ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            <span>{resetSuccess ? 'Restored Fixed Categories' : 'Reset Fixed Categories'}</span>
          </button>

          <button
            onClick={() => {
              setOverallInput(currentOverallBudget);
              setIsOverallModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-xs"
          >
            Edit Overall Budget
          </button>
        </div>
      </div>

      {/* Dominant Overall Budget Anchor & Summary KPI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <span className="text-xs font-medium text-neutral-400">Total Monthly Spending Limit</span>
              <div className="text-3xl font-bold font-mono tabular-nums text-neutral-900 dark:text-neutral-50">
                {formatCurrency(totalSpent, currency, privacyMode)} / {formatCurrency(currentOverallBudget, currency, privacyMode)}
              </div>
            </div>
            <div className="text-right">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold font-mono ${
                  overallSpentPct >= 100
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                    : overallSpentPct >= 80
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                }`}
              >
                {overallSpentPct >= 100 ? (
                  <AlertCircle className="h-3.5 w-3.5" />
                ) : overallSpentPct >= 80 ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {overallSpentPct.toFixed(1)}% used
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-3 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                overallSpentPct >= 100
                  ? 'bg-rose-600'
                  : overallSpentPct >= 80
                  ? 'bg-amber-500'
                  : 'bg-indigo-600'
              }`}
              style={{ width: `${Math.min(100, overallSpentPct)}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>Remaining: {formatCurrency(Math.max(0, currentOverallBudget - totalSpent), currency, privacyMode)}</span>
            <span>80% Warning Threshold: {formatCurrency(currentOverallBudget * 0.8, currency, privacyMode)}</span>
          </div>
        </div>

        {/* Quick KPI Card */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900 flex flex-col justify-between">
          <div>
            <span className="text-xs font-medium text-neutral-400">Category Budgets Sum</span>
            <div className="text-2xl font-bold font-mono tabular-nums text-neutral-900 dark:text-neutral-50 mt-1">
              {formatCurrency(totalCategoryBudgets, currency, privacyMode)}
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2">
              Sum of all {categoriesWithBudget.length} category caps.
              {totalCategoryBudgets > currentOverallBudget && (
                <span className="text-amber-600 dark:text-amber-400 block mt-1 font-medium">
                  Note: Total allocated limits exceed overall monthly cap.
                </span>
              )}
            </p>
          </div>
          <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
            <span>Categories with limits</span>
            <span className="font-semibold text-neutral-900 dark:text-neutral-100 font-mono">
              {categoriesWithBudget.length} / {categories.length}
            </span>
          </div>
        </div>
      </div>

      {/* Category Budgets Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Fixed &amp; Custom Category Limits
          </h3>
          <span className="text-xs text-neutral-400">
            Click 'Set Limit' or 'Edit Limit' on any category to change
          </span>
        </div>

        {categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center bg-white dark:bg-neutral-900">
            <Sparkles className="h-8 w-8 text-indigo-500 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              No categories configured yet
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-md mx-auto">
              Initialize with standard fixed categories (Housing, Food, Groceries, Utilities, Transit, Investments, etc.) with preset monthly budgets.
            </p>
            <button
              onClick={() => resetCategoriesToDefault()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Load Standard Fixed Categories
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const catExpenses = currentExpenses.filter((e) => e.categoryId === cat.id);
              const spent = catExpenses.reduce((sum, e) => sum + e.amount, 0);
              const budget = cat.monthlyBudget || 0;
              const pct = budget > 0 ? (spent / budget) * 100 : 0;

              return (
                <div
                  key={cat.id}
                  className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                          {cat.name}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedCatId(cat.id);
                          setCatBudgetInput(cat.monthlyBudget || '');
                        }}
                        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                      >
                        {budget > 0 ? 'Edit Limit' : '+ Set Limit'}
                      </button>
                    </div>

                    <div className="flex items-baseline justify-between text-xs mb-2">
                      <span className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-neutral-100">
                        {formatCurrency(spent, currency, privacyMode)}
                      </span>
                      <span className="text-neutral-400 font-mono text-[11px]">
                        {budget > 0 ? `of ${formatCurrency(budget, currency, privacyMode)}` : 'No limit set'}
                      </span>
                    </div>

                    {budget > 0 ? (
                      <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    ) : (
                      <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 border border-dashed border-neutral-300 dark:border-neutral-700" />
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-[11px] flex justify-between text-neutral-500 dark:text-neutral-400">
                    {budget > 0 ? (
                      pct >= 100 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">
                          Exceeded by {formatCurrency(spent - budget, currency, privacyMode)}
                        </span>
                      ) : (
                        <span>
                          {formatCurrency(budget - spent, currency, privacyMode)} left ({pct.toFixed(0)}% used)
                        </span>
                      )
                    ) : (
                      <span className="text-neutral-400 italic">Unlimited spending</span>
                    )}

                    <button
                      onClick={() => {
                        setSelectedCatId(cat.id);
                        setCatBudgetInput(cat.monthlyBudget || '');
                      }}
                      className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                      title="Adjust budget"
                    >
                      Configure
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Overall Budget Modal */}
      <Modal
        isOpen={isOverallModalOpen}
        onClose={() => setIsOverallModalOpen(false)}
        title="Set Overall Monthly Spending Cap"
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Define your target aggregate monthly budget for {monthName} {currentYear} across all discretionary and fixed expense categories.
          </p>
          <CurrencyInput
            value={overallInput}
            onChange={setOverallInput}
            placeholder="50000"
          />
          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              onClick={() => setIsOverallModalOpen(false)}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (overallInput && Number(overallInput) > 0) {
                  setOverallBudget(currentMonth, currentYear, Number(overallInput));
                  setIsOverallModalOpen(false);
                }
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
            >
              Save Cap
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Category Budget Modal */}
      {selectedCatId && (
        <Modal
          isOpen={!!selectedCatId}
          onClose={() => setSelectedCatId(null)}
          title={`Set Monthly Budget for ${categories.find((c) => c.id === selectedCatId)?.name}`}
        >
          <div className="flex flex-col gap-4">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Set the monthly spending threshold for this category. Enter 0 to remove the limit.
            </p>
            <CurrencyInput
              value={catBudgetInput}
              onChange={setCatBudgetInput}
              placeholder="e.g. 15000"
            />
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-neutral-400 mr-1">Presets:</span>
              {[2000, 5000, 10000, 15000, 25000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCatBudgetInput(preset)}
                  className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] font-mono text-neutral-700 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                >
                  {formatCurrency(preset, currency, privacyMode)}
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setCategoryBudget(selectedCatId, 0);
                  setSelectedCatId(null);
                }}
                className="text-xs text-rose-600 hover:underline dark:text-rose-400"
              >
                Remove Limit
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedCatId(null)}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setCategoryBudget(selectedCatId, Number(catBudgetInput) || 0);
                    setSelectedCatId(null);
                  }}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
                >
                  Save Budget
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
