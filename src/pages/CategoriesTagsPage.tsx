import React, { useState } from 'react';
import {
  Tag as TagIcon, Plus, Edit2, Trash2, ArrowRightLeft,
  PieChart, DollarSign, FolderPlus, Palette, RotateCcw, Check
} from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { formatCurrency } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { CurrencyInput } from '../components/common/CurrencyInput';
import { CustomSelect } from '../components/common/CustomSelect';

export const CategoriesTagsPage: React.FC = () => {
  const {
    categories, tags, expenses,
    addCategory, updateCategory, deleteCategory, resetCategoriesToDefault,
    addTag, renameTag, mergeTags, deleteTag
  } = useFinanceStore();
  const { currency, privacyMode } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<'categories' | 'tags' | 'tag_report'>('categories');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Category Modal
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catNameError, setCatNameError] = useState<string | null>(null);
  const [catColor, setCatColor] = useState('#6366F1');
  const [catBudget, setCatBudget] = useState<number | ''>('');
  const [catToDelete, setCatToDelete] = useState<string | null>(null);
  const [reassignTargetCatId, setReassignTargetCatId] = useState<string>('');

  // Tag Modal / Actions
  const [isNewTagModalOpen, setIsNewTagModalOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');

  const [isRenameTagModalOpen, setIsRenameTagModalOpen] = useState(false);
  const [tagToRename, setTagToRename] = useState<string | null>(null);
  const [renamedTagName, setRenamedTagName] = useState('');

  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [sourceTag, setSourceTag] = useState('');
  const [targetTag, setTargetTag] = useState('');

  // Calculate tag-wise spending this month
  const currentMonthExpenses = expenses.filter((e) => !e.isDeleted);
  const tagSpendMap: Record<string, { total: number; count: number }> = {};
  currentMonthExpenses.forEach((exp) => {
    exp.tags.forEach((t) => {
      if (!tagSpendMap[t]) tagSpendMap[t] = { total: 0, count: 0 };
      tagSpendMap[t].total += exp.amount;
      tagSpendMap[t].count += 1;
    });
  });

  const sortedTagReport = Object.entries(tagSpendMap).sort(
    ([, a], [, b]) => b.total - a.total
  );

  const openAddCategory = () => {
    setEditingCatId(null);
    setCatName('');
    setCatNameError(null);
    setCatColor('#6366F1');
    setCatBudget('');
    setIsCatModalOpen(true);
  };

  const openEditCategory = (cat: any) => {
    setEditingCatId(cat.id);
    setCatName(cat.name);
    setCatNameError(null);
    setCatColor(cat.color);
    setCatBudget(cat.monthlyBudget || '');
    setIsCatModalOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      setCatNameError('Category name is required');
      return;
    }
    setCatNameError(null);

    if (editingCatId) {
      updateCategory(editingCatId, {
        name: catName.trim(),
        color: catColor,
        monthlyBudget: catBudget ? Number(catBudget) : undefined,
      });
    } else {
      addCategory({
        name: catName.trim(),
        icon: 'Tag',
        color: catColor,
        monthlyBudget: catBudget ? Number(catBudget) : undefined,
      });
    }
    setCatName('');
    setCatNameError(null);
    setCatBudget('');
    setIsCatModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Categories &amp; Tags
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Organize transactions with custom icons, color themes, and tag analytics
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
          <button
            onClick={() => setActiveTab('categories')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'categories'
                ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-900 dark:text-neutral-100 font-semibold'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
            }`}
          >
            Categories ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'tags'
                ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-900 dark:text-neutral-100 font-semibold'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
            }`}
          >
            Tags ({tags.length})
          </button>
          <button
            onClick={() => setActiveTab('tag_report')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'tag_report'
                ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-900 dark:text-neutral-100 font-semibold'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
            }`}
          >
            Tag Analytics
          </button>
        </div>
      </div>

      {/* Categories View */}
      {activeTab === 'categories' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {categories.length} categories active · Configure spending limits &amp; icons
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  resetCategoriesToDefault();
                  setResetSuccess(true);
                  setTimeout(() => setResetSuccess(false), 2500);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 transition-colors shadow-xs"
                title="Restore all default fixed categories with standard preset monthly budgets"
              >
                {resetSuccess ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                <span>{resetSuccess ? 'Restored Defaults' : 'Reset Standard Categories'}</span>
              </button>

              <button
                onClick={openAddCategory}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                New Category
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const catExpenses = expenses.filter((e) => e.categoryId === cat.id && !e.isDeleted);
              const catSpend = catExpenses.reduce((sum, e) => sum + e.amount, 0);

              return (
                <div
                  key={cat.id}
                  className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold text-sm shadow-xs"
                        style={{ backgroundColor: cat.color }}
                      >
                        {cat.name[0]}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                          {cat.name}
                        </h4>
                        <span className="text-[11px] text-neutral-400">
                          {catExpenses.length} transactions
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditCategory(cat)}
                        className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setCatToDelete(cat.id);
                          const otherCats = categories.filter((c) => c.id !== cat.id);
                          setReassignTargetCatId(otherCats[0]?.id || '');
                        }}
                        className="rounded p-1 text-neutral-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Monthly Budget</span>
                    <span className="font-semibold font-mono tabular-nums text-neutral-900 dark:text-neutral-100">
                      {cat.monthlyBudget
                        ? formatCurrency(cat.monthlyBudget, currency, privacyMode)
                        : 'No limit set'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tags View */}
      {activeTab === 'tags' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500">
              Tags can be attached to expenses and income for multi-dimensional reporting.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSourceTag(tags[0]?.name || '');
                  setTargetTag(tags[1]?.name || '');
                  setIsMergeModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Merge Tags
              </button>
              <button
                onClick={() => {
                  setNewTagName('');
                  setIsNewTagModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Tag
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {tags.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                    {t.name}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setTagToRename(t.name);
                      setRenamedTagName(t.name);
                      setIsRenameTagModalOpen(true);
                    }}
                    title="Rename"
                    className="rounded p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => deleteTag(t.name)}
                    title="Delete"
                    className="rounded p-1 text-neutral-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tag Analytics Report */}
      {activeTab === 'tag_report' && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
            Tag-wise Spending Analysis
          </h3>
          <p className="text-xs text-neutral-500 mb-6">
            Aggregated expenditure grouped across multi-tagged transactions
          </p>

          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {sortedTagReport.map(([tagName, stats]) => (
              <div key={tagName} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-100 dark:bg-neutral-800 text-xs font-bold">
                    #
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                      {tagName}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      {stats.count} transactions tagged
                    </span>
                  </div>
                </div>

                <span className="text-xs font-bold font-mono tabular-nums text-neutral-900 dark:text-neutral-100">
                  {formatCurrency(stats.total, currency, privacyMode)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Create/Edit Modal */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title={editingCatId ? 'Edit Category' : 'Create Category'}
      >
        <form noValidate onSubmit={handleSaveCategory} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Category Name *
            </label>
            <input
              type="text"
              value={catName}
              onChange={(e) => {
                setCatName(e.target.value);
                if (catNameError) setCatNameError(null);
              }}
              placeholder="e.g. Fitness &amp; Gym"
              className={`w-full rounded-lg border bg-white px-3 py-2 text-xs text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
                catNameError ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}
            />
            {catNameError && <p className="text-[11px] font-medium text-rose-500 mt-1">{catNameError}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Color Accent
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={catColor}
                onChange={(e) => setCatColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-neutral-300 bg-transparent p-0.5"
              />
              <span className="text-xs font-mono text-neutral-500">{catColor}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Monthly Budget (Optional)
            </label>
            <CurrencyInput value={catBudget} onChange={setCatBudget} placeholder="Optional" />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsCatModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-xs"
            >
              Save Category
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Category with Reassign prompt */}
      {catToDelete && (
        <Modal
          isOpen={!!catToDelete}
          onClose={() => setCatToDelete(null)}
          title="Delete Category"
          subtitle="Reassign transactions to another category"
        >
          <div className="flex flex-col gap-4">
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              This category may contain transactions. Choose another category to reassign them to:
            </p>
            <CustomSelect
              value={reassignTargetCatId}
              onChange={setReassignTargetCatId}
              className="w-full"
              options={categories
                .filter((c) => c.id !== catToDelete)
                .map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
            />
            <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setCatToDelete(null)}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteCategory(catToDelete, reassignTargetCatId);
                  setCatToDelete(null);
                }}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition-colors shadow-xs"
              >
                Reassign &amp; Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* New Tag Modal */}
      <Modal
        isOpen={isNewTagModalOpen}
        onClose={() => setIsNewTagModalOpen(false)}
        title="Create New Tag"
      >
        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Tag name (e.g. Work, Travel)"
            className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              onClick={() => setIsNewTagModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (newTagName.trim()) {
                  addTag(newTagName.trim(), newTagColor);
                  setIsNewTagModalOpen(false);
                }
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Add Tag
            </button>
          </div>
        </div>
      </Modal>

      {/* Rename Tag Modal */}
      <Modal
        isOpen={isRenameTagModalOpen}
        onClose={() => setIsRenameTagModalOpen(false)}
        title="Rename Tag"
      >
        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={renamedTagName}
            onChange={(e) => setRenamedTagName(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              onClick={() => setIsRenameTagModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (tagToRename && renamedTagName.trim()) {
                  renameTag(tagToRename, renamedTagName.trim());
                  setIsRenameTagModalOpen(false);
                }
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Rename
            </button>
          </div>
        </div>
      </Modal>

      {/* Merge Tags Modal */}
      <Modal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        title="Merge Two Tags"
        subtitle="All transactions with the source tag will be updated to the target tag"
      >
        <div className="flex flex-col gap-4 text-xs">
          <div>
            <label className="block text-neutral-500 mb-1">Source Tag (will be removed)</label>
            <CustomSelect
              value={sourceTag}
              onChange={setSourceTag}
              className="w-full"
              options={tags.map((t) => ({ value: t.name, label: t.name }))}
            />
          </div>

          <div>
            <label className="block text-neutral-500 mb-1">Target Tag (merged into)</label>
            <CustomSelect
              value={targetTag}
              onChange={setTargetTag}
              className="w-full"
              options={tags
                .filter((t) => t.name !== sourceTag)
                .map((t) => ({ value: t.name, label: t.name }))}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              onClick={() => setIsMergeModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (sourceTag && targetTag && sourceTag !== targetTag) {
                  mergeTags(sourceTag, targetTag);
                  setIsMergeModalOpen(false);
                }
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Merge Tags
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
