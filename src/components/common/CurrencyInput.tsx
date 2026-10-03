import React from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { CURRENCY_SYMBOLS } from '../../utils/formatters';

interface CurrencyInputProps {
  value: number | '';
  onChange: (val: number) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  placeholder = '0.00',
  className = '',
  required = false,
}) => {
  const { currency } = useSettingsStore();
  const symbol = CURRENCY_SYMBOLS[currency] || `${currency} `;

  return (
    <div className="relative flex rounded-lg shadow-xs">
      <span className="inline-flex items-center rounded-l-lg border border-r-0 border-neutral-300 bg-neutral-50 px-3 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
        {symbol}
      </span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        placeholder={placeholder}
        required={required}
        className={`block w-full rounded-none rounded-r-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 font-mono tabular-nums ${className}`}
      />
    </div>
  );
};
