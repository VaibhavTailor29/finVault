import React, { useState, KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';
import { useFinanceStore } from '../../store/useFinanceStore';

interface TagInputProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export const TagInput: React.FC<TagInputProps> = ({ selectedTags, onChange }) => {
  const { tags, addTag } = useFinanceStore();
  const [inputVal, setInputVal] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addCurrentTag();
    }
  };

  const addCurrentTag = () => {
    const clean = inputVal.trim();
    if (!clean) return;
    if (!selectedTags.includes(clean)) {
      onChange([...selectedTags, clean]);
    }
    // Also save in store if new
    addTag(clean);
    setInputVal('');
  };

  const removeTag = (t: string) => {
    onChange(selectedTags.filter((tag) => tag !== t));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 min-h-[38px] rounded-lg border border-neutral-300 bg-white p-1.5 dark:border-neutral-700 dark:bg-neutral-900">
        {selectedTags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200"
          >
            {t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-100"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addCurrentTag}
          placeholder={selectedTags.length === 0 ? 'Type tag and press enter...' : ''}
          className="flex-1 min-w-[120px] bg-transparent px-2 py-1 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden dark:text-neutral-100"
        />
      </div>

      {/* Suggested tags autocomplete row */}
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs text-neutral-500">
          <span>Suggestions:</span>
          {tags
            .filter((t) => !selectedTags.includes(t.name))
            .slice(0, 5)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange([...selectedTags, t.name])}
                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 transition-colors"
              >
                <Plus className="h-2.5 w-2.5" />
                {t.name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
};
