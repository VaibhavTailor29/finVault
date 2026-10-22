import React from 'react';
import {
  LayoutDashboard, TrendingUp, PieChart, Landmark,
  Coins, ShieldCheck, Building2, Award, Boxes
} from 'lucide-react';
import { InvestmentCategory } from '../../types';

export interface CategoryTabItem {
  id: InvestmentCategory;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badgeCount?: number;
  totalValue?: number;
}

interface InvestmentCategoryNavProps {
  activeCategory: InvestmentCategory;
  onSelectCategory: (cat: InvestmentCategory) => void;
  categoryTotals?: Record<InvestmentCategory, number>;
}

export const INVESTMENT_CATEGORIES: CategoryTabItem[] = [
  {
    id: 'all',
    label: 'All Assets (Consolidated)',
    shortLabel: 'Overview',
    icon: LayoutDashboard,
    color: '#10B981',
  },
  {
    id: 'stocks',
    label: 'Stocks & Equity',
    shortLabel: 'Stocks',
    icon: TrendingUp,
    color: '#3B82F6',
  },
  {
    id: 'mutual_funds',
    label: 'Mutual Funds & SIPs',
    shortLabel: 'Mutual Funds',
    icon: PieChart,
    color: '#8B5CF6',
  },
  {
    id: 'fixed_income',
    label: 'Fixed Deposits & RDs',
    shortLabel: 'FDs & RDs',
    icon: Landmark,
    color: '#F59E0B',
  },
  {
    id: 'gold_sgb',
    label: 'Gold & SGBs',
    shortLabel: 'Gold & SGB',
    icon: Coins,
    color: '#EAB308',
  },
  {
    id: 'bonds',
    label: 'Bonds & G-Sec',
    shortLabel: 'Bonds',
    icon: ShieldCheck,
    color: '#06B6D4',
  },
  {
    id: 'reits',
    label: 'Real Estate / REITs',
    shortLabel: 'REITs',
    icon: Building2,
    color: '#EC4899',
  },
  {
    id: 'retirement',
    label: 'Retirement (PPF / NPS)',
    shortLabel: 'PPF & NPS',
    icon: Award,
    color: '#14B8A6',
  },
  {
    id: 'crypto_alt',
    label: 'Crypto & Alternatives',
    shortLabel: 'Crypto',
    icon: Boxes,
    color: '#F97316',
  },
];

export const InvestmentCategoryNav: React.FC<InvestmentCategoryNavProps> = ({
  activeCategory,
  onSelectCategory,
  categoryTotals,
}) => {
  return (
    <div className="w-full overflow-x-auto pb-1 no-scrollbar">
      <div className="flex items-center gap-1.5 min-w-max p-1 bg-neutral-100/80 dark:bg-neutral-800/60 rounded-xl border border-neutral-200/80 dark:border-neutral-700/60 shadow-xs">
        {INVESTMENT_CATEGORIES.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeCategory === tab.id;
          const totalVal = categoryTotals ? categoryTotals[tab.id] : undefined;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectCategory(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none ${
                isActive
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 shadow-sm border border-neutral-200/80 dark:border-neutral-700/80 ring-1 ring-black/5 dark:ring-white/10'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-white/60 dark:hover:bg-neutral-800/40'
              }`}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: tab.color }}
              />
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
              <span>{tab.label}</span>
              {totalVal !== undefined && totalVal > 0 && (
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
                  isActive
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                    : 'bg-neutral-200/60 dark:bg-neutral-700/60 text-neutral-600 dark:text-neutral-300'
                }`}>
                  ₹{totalVal >= 100000 ? `${(totalVal / 100000).toFixed(1)}L` : `${(totalVal / 1000).toFixed(0)}k`}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
