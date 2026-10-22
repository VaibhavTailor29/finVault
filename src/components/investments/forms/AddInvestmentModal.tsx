import React, { useState } from 'react';
import {
  TrendingUp, PieChart, Landmark, Coins, ShieldCheck,
  Building2, Award, Boxes, ArrowLeft, X
} from 'lucide-react';
import { Modal } from '../../common/Modal';
import { InvestmentCategory, Investment, InvestmentTransaction } from '../../../types';
import { StockForm } from './StockForm';
import { MutualFundForm } from './MutualFundForm';
import { FixedDepositForm } from './FixedDepositForm';
import { GoldSgbForm } from './GoldSgbForm';
import { BondForm } from './BondForm';
import { RetirementForm } from './RetirementForm';
import { ReitCryptoForm } from './ReitCryptoForm';

interface AddInvestmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: InvestmentCategory;
  onSave: (
    investment: Omit<Investment, 'id'>,
    transaction: Omit<InvestmentTransaction, 'id' | 'createdAt'>,
    initialPrice: number
  ) => void;
}

interface CategoryOption {
  id: InvestmentCategory;
  title: string;
  subtitle: string;
  tag: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgLight: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    id: 'stocks',
    title: 'Stocks & Equity',
    subtitle: 'Direct NSE/BSE shares, ETFs, and index trackers with live market pricing',
    tag: 'Equities',
    icon: TrendingUp,
    color: '#3B82F6',
    bgLight: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  {
    id: 'mutual_funds',
    title: 'Mutual Funds & SIPs',
    subtitle: 'Systematic Investment Plans (SIP), NAV updates, AMC folios, and 80C ELSS',
    tag: 'Wealth SIP',
    icon: PieChart,
    color: '#8B5CF6',
    bgLight: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
  {
    id: 'fixed_income',
    title: 'Fixed Deposits & RDs',
    subtitle: 'Bank term deposits with guaranteed yields, quarterly compounding, and tenure',
    tag: 'Guaranteed',
    icon: Landmark,
    color: '#F59E0B',
    bgLight: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  {
    id: 'gold_sgb',
    title: 'Gold & Sovereign Gold Bonds',
    subtitle: 'RBI 2.50% semi-annual interest, gold grams weight, and tax-exempt maturity',
    tag: 'Hedge & 2.5%',
    icon: Coins,
    color: '#EAB308',
    bgLight: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  },
  {
    id: 'bonds',
    title: 'Bonds & G-Secs',
    subtitle: 'Government securities (G-Sec), corporate NCDs, and periodic coupon yields',
    tag: 'Fixed Income',
    icon: ShieldCheck,
    color: '#06B6D4',
    bgLight: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  },
  {
    id: 'reits',
    title: 'Real Estate / REITs',
    subtitle: 'Commercial real estate trusts and InvITs with quarterly rental dividends',
    tag: 'Real Estate',
    icon: Building2,
    color: '#EC4899',
    bgLight: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
  },
  {
    id: 'retirement',
    title: 'Retirement (PPF / NPS / EPF)',
    subtitle: '15-year statutory lock-in, government interest, Section 80C and 80CCD deductions',
    tag: 'Tax Saver',
    icon: Award,
    color: '#10B981',
    bgLight: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  {
    id: 'crypto_alt',
    title: 'Crypto & Digital Assets',
    subtitle: 'Cryptocurrency holdings, cold storage tracking, and non-correlated assets',
    tag: 'Alternative',
    icon: Boxes,
    color: '#F97316',
    bgLight: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  },
];

export const AddInvestmentModal: React.FC<AddInvestmentModalProps> = ({
  isOpen,
  onClose,
  defaultCategory = 'all',
  onSave,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<InvestmentCategory | null>(
    defaultCategory !== 'all' ? defaultCategory : null
  );

  // Sync category when defaultCategory changes on opening
  React.useEffect(() => {
    if (isOpen) {
      setSelectedCategory(defaultCategory !== 'all' ? defaultCategory : null);
    }
  }, [isOpen, defaultCategory]);

  const handleFormSuccess = (
    investment: Omit<Investment, 'id'>,
    transaction: Omit<InvestmentTransaction, 'id' | 'createdAt'>,
    initialPrice: number
  ) => {
    onSave(investment, transaction, initialPrice);
    onClose();
  };

  const getModalTitle = () => {
    if (!selectedCategory) return 'Select Investment Asset Class';
    const opt = CATEGORY_OPTIONS.find((c) => c.id === selectedCategory);
    return opt ? `Add ${opt.title}` : 'Add Investment';
  };

  const getModalSubtitle = () => {
    if (!selectedCategory) {
      return 'Each asset class features specialized parameters for yield, maturities, tax lots, and auto-debits';
    }
    const opt = CATEGORY_OPTIONS.find((c) => c.id === selectedCategory);
    return opt ? opt.subtitle : undefined;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getModalTitle()}
      subtitle={getModalSubtitle()}
      maxWidth="max-w-2xl"
    >
      <div>
        {selectedCategory && defaultCategory === 'all' && (
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Choose a different investment type
          </button>
        )}

        {/* STEP 1: CATEGORY SELECTION MATRIX */}
        {!selectedCategory && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            {CATEGORY_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedCategory(opt.id)}
                  className="flex items-start gap-3 p-3.5 rounded-2xl border border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600 bg-white dark:bg-neutral-900 text-left transition-all hover:shadow-xs group cursor-pointer"
                >
                  <div
                    className="p-2.5 rounded-xl shrink-0 transition-transform group-hover:scale-105"
                    style={{ backgroundColor: `${opt.color}15`, color: opt.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                        {opt.title}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${opt.bgLight}`}
                      >
                        {opt.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                      {opt.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* STEP 2: SPECIALIZED DEDICATED FORM PER ASSET CLASS */}
        {selectedCategory === 'stocks' && (
          <StockForm onSuccess={handleFormSuccess} onCancel={onClose} />
        )}

        {selectedCategory === 'mutual_funds' && (
          <MutualFundForm onSuccess={handleFormSuccess} onCancel={onClose} />
        )}

        {selectedCategory === 'fixed_income' && (
          <FixedDepositForm onSuccess={handleFormSuccess} onCancel={onClose} />
        )}

        {selectedCategory === 'gold_sgb' && (
          <GoldSgbForm onSuccess={handleFormSuccess} onCancel={onClose} />
        )}

        {selectedCategory === 'bonds' && (
          <BondForm onSuccess={handleFormSuccess} onCancel={onClose} />
        )}

        {selectedCategory === 'retirement' && (
          <RetirementForm onSuccess={handleFormSuccess} onCancel={onClose} />
        )}

        {selectedCategory === 'reits' && (
          <ReitCryptoForm initialType="REIT" onSuccess={handleFormSuccess} onCancel={onClose} />
        )}

        {selectedCategory === 'crypto_alt' && (
          <ReitCryptoForm initialType="Crypto" onSuccess={handleFormSuccess} onCancel={onClose} />
        )}
      </div>
    </Modal>
  );
};
