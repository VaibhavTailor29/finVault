import React from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { CURRENCY_SYMBOLS } from '../../utils/formatters';

interface CurrencyInputProps {
  value: number | '';
  onChange: (val: any) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  hasError?: boolean;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  placeholder = '',
  className = '',
  required = false,
  hasError = false,
}) => {
  const { currency } = useSettingsStore();
  const symbol = CURRENCY_SYMBOLS[currency] || `${currency} `;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    // Strip redundant leading zeros (e.g. "022" -> "22", but keep "0" or decimals like "0.5")
    if (raw.length > 1 && /^0\d/.test(raw)) {
      raw = raw.replace(/^0+(?=\d)/, '');
    }
    if (raw === '') {
      onChange('');
      return;
    }
    const num = parseFloat(raw);
    onChange(isNaN(num) ? '' : num);
  };

  return (
    <div className="relative flex rounded-lg shadow-xs">
      <span className={`inline-flex items-center rounded-l-lg border border-r-0 px-3 text-xs font-medium ${
        hasError
          ? 'border-rose-500 bg-rose-50/50 text-rose-600 dark:border-rose-500/60 dark:bg-rose-950/30 dark:text-rose-400'
          : 'border-neutral-300 bg-neutral-50 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
      }`}>
        {symbol}
      </span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={handleChange}
        onFocus={(e) => e.target.select()}
        placeholder={placeholder}
        required={required}
        className={`block w-full rounded-none rounded-r-lg border px-3 py-2 text-sm text-neutral-900 focus:outline-hidden font-mono tabular-nums dark:bg-neutral-900 dark:text-neutral-100 ${
          hasError
            ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20'
            : 'border-neutral-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-neutral-700'
        } ${className}`}
      />
    </div>
  );
};
