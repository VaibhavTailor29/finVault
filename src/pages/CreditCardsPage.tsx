import React, { useState } from 'react';
import {
  CreditCard as CardIcon, Plus, AlertCircle, AlertTriangle, CheckCircle2,
  Calendar, ArrowRight, DollarSign, Layers, Clock, Trash2, Archive, ArchiveRestore,
  Edit3, Sparkles
} from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import { CurrencyInput } from '../components/common/CurrencyInput';
import { CreditCard } from '../types';
import {
  CreditCardVisual,
  MiniCreditCard,
  LUXURY_CARD_PRESETS,
  CARD_NETWORKS,
  detectCardNetwork,
  NetworkLogo,
} from '../components/cards/CreditCardVisual';

export const CreditCardsPage: React.FC = () => {
  const {
    creditCards, cardPayments, cardEmis, expenses,
    addCreditCard, updateCreditCard, deleteCreditCard, recordCardPayment, addCardEmi
  } = useFinanceStore();
  const { currency, privacyMode } = useSettingsStore();
  const { user } = useAuthStore();

  const [activeCardId, setActiveCardId] = useState<string>(creditCards[0]?.id || '');
  const [cardFilter, setCardFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [cardToDelete, setCardToDelete] = useState<CreditCard | null>(null);

  const activeCards = creditCards.filter((c) => !c.isClosed);
  const closedCards = creditCards.filter((c) => c.isClosed);
  const displayedCards = cardFilter === 'active' ? activeCards : cardFilter === 'closed' ? closedCards : creditCards;

  const selectedCard = creditCards.find((c) => c.id === activeCardId) || displayedCards[0] || creditCards[0];

  // Modals
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [isEditCardModalOpen, setIsEditCardModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAddEmiModalOpen, setIsAddEmiModalOpen] = useState(false);

  // New Card Form
  const [nickname, setNickname] = useState('');
  const [issuer, setIssuer] = useState('');
  const [last4, setLast4] = useState('');
  const [creditLimit, setCreditLimit] = useState<number | ''>('');
  const [statementDay, setStatementDay] = useState<number | ''>('' as any);
  const [paymentDueDay, setPaymentDueDay] = useState<number | ''>('' as any);
  const [interestRate, setInterestRate] = useState<number | ''>('');
  const [color, setColor] = useState('#18181B');
  const [network, setNetwork] = useState('visa');
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  const openAddCardModal = () => {
    setNickname('');
    setIssuer('');
    setLast4('');
    setCreditLimit('');
    setStatementDay('');
    setPaymentDueDay('');
    setInterestRate('');
    setColor('#18181B');
    setNetwork('visa');
    setCardErrors({});
    setIsAddCardModalOpen(true);
  };

  // Edit Card Form
  const [editNickname, setEditNickname] = useState('');
  const [editIssuer, setEditIssuer] = useState('');
  const [editLast4, setEditLast4] = useState('');
  const [editCreditLimit, setEditCreditLimit] = useState<number | ''>('');
  const [editStatementDay, setEditStatementDay] = useState<number | ''>('' as any);
  const [editPaymentDueDay, setEditPaymentDueDay] = useState<number | ''>('' as any);
  const [editInterestRate, setEditInterestRate] = useState<number | ''>('');
  const [editColor, setEditColor] = useState('#18181B');
  const [editNetwork, setEditNetwork] = useState('visa');
  const [editCardErrors, setEditCardErrors] = useState<Record<string, string>>({});

  const openEditModal = (card: CreditCard) => {
    setEditNickname(card.nickname);
    setEditIssuer(card.issuer);
    setEditLast4(card.last4);
    setEditCreditLimit(card.creditLimit);
    setEditStatementDay(card.statementDay);
    setEditPaymentDueDay(card.paymentDueDay);
    setEditInterestRate(card.interestRate ?? '');
    setEditColor(card.color || '#18181B');
    setEditNetwork(card.network || detectCardNetwork(card) || 'visa');
    setEditCardErrors({});
    setIsEditCardModalOpen(true);
  };

  const handleUpdateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard) return;

    const newErrors: Record<string, string> = {};
    if (!editNickname.trim()) newErrors.editNickname = 'Card nickname is required';
    if (!editLast4 || editLast4.length !== 4) newErrors.editLast4 = 'Please enter exactly 4 digits';
    if (!editCreditLimit || Number(editCreditLimit) <= 0) newErrors.editCreditLimit = 'Please enter a valid credit limit';

    if (Object.keys(newErrors).length > 0) {
      setEditCardErrors(newErrors);
      return;
    }
    setEditCardErrors({});

    updateCreditCard(selectedCard.id, {
      nickname: editNickname.trim(),
      issuer: editIssuer.trim(),
      last4: editLast4,
      creditLimit: Number(editCreditLimit),
      statementDay: Number(editStatementDay) || 1,
      paymentDueDay: Number(editPaymentDueDay) || 15,
      interestRate: editInterestRate ? Number(editInterestRate) : undefined,
      color: editColor,
      network: editNetwork,
    });
    setIsEditCardModalOpen(false);
  };

  // Payment Form
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentSource, setPaymentSource] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // EMI Form
  const [emiTitle, setEmiTitle] = useState('');
  const [emiPrincipal, setEmiPrincipal] = useState<number | ''>('');
  const [emiTenure, setEmiTenure] = useState(12);
  const [emiMonthly, setEmiMonthly] = useState<number | ''>('');
  const [emiErrors, setEmiErrors] = useState<Record<string, string>>({});

  // Calculate stats for selected card
  const nonDeletedExpenses = expenses.filter((e) => !e.isDeleted);
  const cardExpenses = nonDeletedExpenses.filter((e) => e.cardId === selectedCard?.id);
  const cardPaymentsList = cardPayments.filter((p) => p.cardId === selectedCard?.id);
  const cardEmisList = cardEmis.filter((e) => e.cardId === selectedCard?.id);

  const totalCharges = cardExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPaid = cardPaymentsList.reduce((sum, p) => sum + p.amount, 0);
  const outstanding = Math.max(0, totalCharges - totalPaid);
  const availableCredit = selectedCard ? Math.max(0, selectedCard.creditLimit - outstanding) : 0;
  const utilizationPct = selectedCard?.creditLimit ? (outstanding / selectedCard.creditLimit) * 100 : 0;
  const minDue = outstanding * 0.05; // 5% minimum due

  // Total across all cards
  let totalAllCardsOutstanding = 0;
  creditCards.forEach((c) => {
    const cExpenses = nonDeletedExpenses.filter((e) => e.cardId === c.id);
    const cPayments = cardPayments.filter((p) => p.cardId === c.id);
    const cCharges = cExpenses.reduce((sum, e) => sum + e.amount, 0);
    const cPaid = cPayments.reduce((sum, p) => sum + p.amount, 0);
    totalAllCardsOutstanding += Math.max(0, cCharges - cPaid);
  });

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!nickname.trim()) newErrors.nickname = 'Card nickname is required';
    if (!last4 || last4.length !== 4) newErrors.last4 = 'Please enter exactly 4 digits';
    if (!creditLimit || Number(creditLimit) <= 0) newErrors.creditLimit = 'Please enter a valid credit limit';

    if (Object.keys(newErrors).length > 0) {
      setCardErrors(newErrors);
      return;
    }
    setCardErrors({});

    addCreditCard({
      nickname: nickname.trim(),
      issuer: issuer.trim(),
      last4,
      creditLimit: Number(creditLimit),
      statementDay: Number(statementDay) || 1,
      paymentDueDay: Number(paymentDueDay) || 15,
      interestRate: interestRate ? Number(interestRate) : undefined,
      color,
      network,
    });
    setNickname('');
    setIssuer('');
    setLast4('');
    setCreditLimit('');
    setStatementDay('');
    setPaymentDueDay('');
    setInterestRate('');
    setIsAddCardModalOpen(false);
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setPaymentError('Please enter a valid payment amount greater than ₹0');
      return;
    }
    if (!selectedCard) return;
    setPaymentError(null);

    recordCardPayment(selectedCard.id, Number(paymentAmount), paymentSource, paymentNote || undefined);
    setPaymentAmount('');
    setPaymentNote('');
    setIsPaymentModalOpen(false);
  };

  const handleCreateEmi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard) return;

    const newErrors: Record<string, string> = {};
    if (!emiTitle.trim()) newErrors.emiTitle = 'EMI title or merchant is required';
    if (!emiPrincipal || Number(emiPrincipal) <= 0) newErrors.emiPrincipal = 'Please enter a valid principal amount';
    if (!emiMonthly || Number(emiMonthly) <= 0) newErrors.emiMonthly = 'Please enter monthly installment amount';

    if (Object.keys(newErrors).length > 0) {
      setEmiErrors(newErrors);
      return;
    }
    setEmiErrors({});

    addCardEmi({
      cardId: selectedCard.id,
      title: emiTitle.trim(),
      principal: Number(emiPrincipal),
      tenureMonths: emiTenure,
      monthlyInstallment: Number(emiMonthly),
      remainingInstallments: emiTenure,
      startDate: new Date().toISOString().split('T')[0],
    });
    setEmiTitle('');
    setEmiPrincipal('');
    setEmiMonthly('');
    setIsAddEmiModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Credit Card Management
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Billing cycles, utilization alerts (&gt;30% &amp; &gt;70%), transfer payments, and EMI tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors shadow-xs"
          >
            Record Bill Payment
          </button>
          <button
            onClick={openAddCardModal}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add New Card
          </button>
        </div>
      </div>

      {/* Aggregate Overview Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
        <div>
          <span className="text-xs text-neutral-400">Total Outstanding Across All Cards</span>
          <div className="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
            {formatCurrency(totalAllCardsOutstanding, currency, privacyMode)}
          </div>
        </div>
        <div>
          <span className="text-xs text-neutral-400">Active Managed Cards</span>
          <div className="text-2xl font-bold font-mono tabular-nums text-neutral-900 dark:text-neutral-100 mt-1">
            {activeCards.length} Cards {closedCards.length > 0 && <span className="text-xs font-normal text-neutral-400 font-sans">({closedCards.length} closed)</span>}
          </div>
        </div>
        <div>
          <span className="text-xs text-neutral-400">Bill Payment Classification</span>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
            Payments are classified as <strong>Transfers</strong> and excluded from monthly spending calculations.
          </div>
        </div>
      </div>

      {/* Filter and Card Selector Tabs */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 w-fit text-xs font-medium">
          <button
            onClick={() => setCardFilter('all')}
            className={`px-3 py-1 rounded-lg transition-all ${
              cardFilter === 'all'
                ? 'bg-white text-neutral-900 shadow-xs font-semibold dark:bg-neutral-900 dark:text-neutral-100'
                : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
            }`}
          >
            All ({creditCards.length})
          </button>
          <button
            onClick={() => setCardFilter('active')}
            className={`px-3 py-1 rounded-lg transition-all ${
              cardFilter === 'active'
                ? 'bg-white text-neutral-900 shadow-xs font-semibold dark:bg-neutral-900 dark:text-neutral-100'
                : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
            }`}
          >
            Active ({activeCards.length})
          </button>
          {closedCards.length > 0 && (
            <button
              onClick={() => setCardFilter('closed')}
              className={`px-3 py-1 rounded-lg transition-all ${
                cardFilter === 'closed'
                  ? 'bg-white text-neutral-900 shadow-xs font-semibold dark:bg-neutral-900 dark:text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
              }`}
            >
              Closed ({closedCards.length})
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 overflow-x-auto pb-4 pt-2 px-1 scrollbar-thin">
          {displayedCards.map((card) => {
            const isActive = card.id === (selectedCard?.id || '');
            return (
              <MiniCreditCard
                key={card.id}
                card={card}
                isActive={isActive}
                onClick={() => setActiveCardId(card.id)}
              />
            );
          })}
        </div>
      </div>

      {creditCards.length === 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center dark:border-neutral-800 dark:bg-neutral-900">
          <CardIcon className="mx-auto h-10 w-10 text-neutral-400 mb-2" />
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">No Credit Cards Tracked</h3>
          <p className="text-xs text-neutral-500 mt-1 mb-4">Add your credit cards to track billing cycles, credit utilization, and EMIs.</p>
          <button
            onClick={openAddCardModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Your First Card
          </button>
        </div>
      )}

      {selectedCard && (
        <div className="flex flex-col gap-4">
          {/* Card Status & Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  selectedCard.isClosed
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    selectedCard.isClosed ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
                {selectedCard.isClosed ? 'Closed / Discontinued' : 'Active Card'}
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                {selectedCard.issuer} ···· {selectedCard.last4}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => openEditModal(selectedCard)}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 transition-colors shadow-xs"
                title="Edit card details, billing cycle and design finish"
              >
                <Edit3 className="h-3.5 w-3.5 text-indigo-500" />
                Edit Card
              </button>
              {selectedCard.isClosed ? (
                <button
                  onClick={() => updateCreditCard(selectedCard.id, { isClosed: false })}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60 transition-colors shadow-xs"
                  title="Reactivate this card"
                >
                  <ArchiveRestore className="h-3.5 w-3.5" />
                  Reactivate Card
                </button>
              ) : (
                <button
                  onClick={() => updateCreditCard(selectedCard.id, { isClosed: true })}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/60 transition-colors shadow-xs"
                  title="Close or discontinue this card"
                >
                  <Archive className="h-3.5 w-3.5" />
                  Close / Discontinue Card
                </button>
              )}
              <button
                onClick={() => setCardToDelete(selectedCard)}
                className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/60 transition-colors shadow-xs"
                title="Delete this card"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Card
              </button>
            </div>
          </div>

          {selectedCard.isClosed && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="font-semibold">This credit card is closed / discontinued</p>
                <p className="mt-0.5 text-amber-800/90 dark:text-amber-300/90 text-[11px]">
                  It is excluded from new transaction forms to prevent accidental charges. Past statements and transaction history remain safely stored. You can still record bill payments below to settle any remaining balance.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Card Physical Visual & Status (Left Column) */}
            <div className="flex flex-col gap-4">
              {/* Ultra-Attractive 3D Flip Credit Card */}
              <CreditCardVisual
                card={selectedCard}
                cardholderName={user?.name || 'VALUED CARDMEMBER'}
                showFlipButton={true}
              />

            {/* Utilization & Metrics */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-neutral-500">Credit Utilization</span>
                <span
                  className={`text-xs font-bold font-mono ${
                    utilizationPct >= 70
                      ? 'text-rose-600'
                      : utilizationPct >= 30
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {utilizationPct.toFixed(1)}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-2.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden mb-3">
                <div
                  className={`h-full transition-all duration-300 ${
                    utilizationPct >= 70
                      ? 'bg-rose-600'
                      : utilizationPct >= 30
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, utilizationPct)}%` }}
                />
              </div>

              {utilizationPct >= 70 ? (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 mb-4">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Alert: Utilization &gt; 70% may impact credit score.</span>
                </div>
              ) : utilizationPct >= 30 ? (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 mb-4">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Warning: Recommended utilization is under 30%.</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 mb-4">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Optimal: Utilization is healthy under 30%.</span>
                </div>
              )}

              <div className="space-y-2 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Current Outstanding</span>
                  <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                    {formatCurrency(outstanding, currency, privacyMode)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Available Credit</span>
                  <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                    {formatCurrency(availableCredit, currency, privacyMode)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Total Credit Limit</span>
                  <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                    {formatCurrency(selectedCard.creditLimit, currency, privacyMode)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Estimated Minimum Due (5%)</span>
                  <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                    {formatCurrency(minDue, currency, privacyMode)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right 2 Columns: Statement Transactions & EMI */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Active EMIs */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Active EMI Plans ({cardEmisList.length})
                  </h3>
                </div>
                <button
                  onClick={() => setIsAddEmiModalOpen(true)}
                  className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  + Add EMI
                </button>
              </div>

              {cardEmisList.length === 0 ? (
                <p className="text-xs text-neutral-400 py-3">No active EMIs on this card.</p>
              ) : (
                <div className="space-y-3">
                  {cardEmisList.map((emi) => (
                    <div
                      key={emi.id}
                      className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-800/40"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {emi.title}
                        </span>
                        <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                          {formatCurrency(emi.monthlyInstallment, currency, privacyMode)} / mo
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-neutral-500">
                        <span>
                          {emi.remainingInstallments} of {emi.tenureMonths} installments remaining
                        </span>
                        <span>
                          Principal: {formatCurrency(emi.principal, currency, privacyMode)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Statement Expenses Tagged to Card */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800 mb-3">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Card Charges in Current Cycle ({cardExpenses.length})
                </h3>
                <span className="text-xs font-mono font-semibold text-rose-600">
                  Total: {formatCurrency(totalCharges, currency, privacyMode)}
                </span>
              </div>

              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {cardExpenses.length === 0 ? (
                  <p className="py-6 text-center text-xs text-neutral-400">
                    No charges logged for this card yet.
                  </p>
                ) : (
                  cardExpenses.map((exp) => (
                    <div key={exp.id} className="flex items-center justify-between py-2.5 text-xs">
                      <div className="flex flex-col">
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">
                          {exp.note || 'Card Swipe'}
                        </span>
                        <span className="text-[11px] text-neutral-400 font-mono">
                          {formatDate(exp.date)}
                        </span>
                      </div>
                      <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                        {formatCurrency(exp.amount, currency, privacyMode)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Payments History on this Card */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 pb-3 border-b border-neutral-100 dark:border-neutral-800 mb-3">
                Payment History (Transfers)
              </h3>
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {cardPaymentsList.length === 0 ? (
                  <p className="py-4 text-center text-xs text-neutral-400">
                    No payments logged yet.
                  </p>
                ) : (
                  cardPaymentsList.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2 text-xs">
                      <div className="flex flex-col">
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">
                          {p.paymentSource}
                        </span>
                        <span className="text-[11px] text-neutral-400 font-mono">
                          {formatDate(p.paymentDate)}
                        </span>
                      </div>
                      <span className="font-mono font-semibold text-emerald-600">
                        +{formatCurrency(p.amount, currency, privacyMode)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Add New Card Modal */}
      <Modal
        isOpen={isAddCardModalOpen}
        onClose={() => setIsAddCardModalOpen(false)}
        title="Add Credit Card"
        subtitle="Manage limits, billing cycle, network, and luxury design finish"
      >
        <form noValidate onSubmit={handleCreateCard} className="flex flex-col gap-4">
          {/* Live Realistic Card Preview */}
          <div className="mb-2">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
              Live Card Preview
            </span>
            <div className="max-w-[310px] mx-auto">
              <CreditCardVisual
                card={{
                  id: 'preview',
                  nickname: nickname || 'CARD NICKNAME',
                  issuer: issuer || 'BANK NAME',
                  last4: (last4 || '4421').padEnd(4, '•'),
                  creditLimit: Number(creditLimit) || 100000,
                  statementDay: Number(statementDay) || 1,
                  paymentDueDay: Number(paymentDueDay) || 15,
                  color: color,
                  network: network,
                  isClosed: false,
                }}
                cardholderName={user?.name || 'VALUED CARDMEMBER'}
                showFlipButton={false}
                size="sm"
              />
            </div>
          </div>

          {/* Payment Network Selector */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Payment Network <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {CARD_NETWORKS.map((net) => {
                const isSelected = network === net.id;
                return (
                  <button
                    key={net.id}
                    type="button"
                    onClick={() => setNetwork(net.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-200 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <div className="h-6 flex items-center justify-center mb-1">
                      <NetworkLogo network={net.id} className="h-5" />
                    </div>
                    <span className="text-[11px] font-semibold">{net.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Card Nickname *
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                if (cardErrors.nickname) setCardErrors(prev => { const n = { ...prev }; delete n.nickname; return n; });
              }}
              placeholder="e.g. Coral, Millennia, Infinia, Platinum"
              className={`w-full rounded-lg border bg-white px-3 py-2 text-xs text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
                cardErrors.nickname ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}
            />
            {cardErrors.nickname && <p className="text-[11px] font-medium text-rose-500 mt-1">{cardErrors.nickname}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Bank / Issuer
              </label>
              <input
                type="text"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="e.g. HDFC Bank, ICICI Bank, Axis Bank"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Last 4 Digits *
              </label>
              <input
                type="text"
                maxLength={4}
                value={last4}
                onChange={(e) => {
                  setLast4(e.target.value.replace(/[^0-9]/g, ''));
                  if (cardErrors.last4) setCardErrors(prev => { const n = { ...prev }; delete n.last4; return n; });
                }}
                placeholder="4421"
                className={`w-full rounded-lg border bg-white px-3 py-2 text-xs text-neutral-900 font-mono dark:bg-neutral-900 dark:text-neutral-100 ${
                  cardErrors.last4 ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
                }`}
              />
              {cardErrors.last4 && <p className="text-[11px] font-medium text-rose-500 mt-1">{cardErrors.last4}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Credit Limit *
            </label>
            <CurrencyInput
              value={creditLimit}
              onChange={(val) => {
                setCreditLimit(val);
                if (cardErrors.creditLimit) setCardErrors(prev => { const n = { ...prev }; delete n.creditLimit; return n; });
              }}
              placeholder="200000"
              hasError={!!cardErrors.creditLimit}
            />
            {cardErrors.creditLimit && <p className="text-[11px] font-medium text-rose-500 mt-1">{cardErrors.creditLimit}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Statement Day of Month
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={statementDay}
                onChange={(e) => {
                  let val = e.target.value;
                  if (val.length > 1 && /^0\d/.test(val)) val = val.replace(/^0+(?=\d)/, '');
                  setStatementDay(val === '' ? '' : parseInt(val, 10));
                }}
                onFocus={(e) => e.target.select()}
                placeholder="1"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Payment Due Day of Month
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={paymentDueDay}
                onChange={(e) => {
                  let val = e.target.value;
                  if (val.length > 1 && /^0\d/.test(val)) val = val.replace(/^0+(?=\d)/, '');
                  setPaymentDueDay(val === '' ? '' : parseInt(val, 10));
                }}
                onFocus={(e) => e.target.select()}
                placeholder="15"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Luxury Finish Preset
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-3">
              {LUXURY_CARD_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setColor(preset.color)}
                  className={`group relative flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all ${
                    color === preset.color
                      ? 'border-indigo-600 ring-2 ring-indigo-500/30 dark:border-indigo-400 scale-105 shadow-sm'
                      : 'border-neutral-200 dark:border-neutral-700 hover:scale-102'
                  }`}
                  title={`${preset.name} (${preset.desc})`}
                >
                  <div
                    className="h-5 w-full rounded shadow-inner"
                    style={{ backgroundColor: preset.color }}
                  />
                  <span className="text-[9px] font-medium text-neutral-600 dark:text-neutral-400 truncate w-full text-center mt-1">
                    {preset.name.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-neutral-300 bg-transparent p-0.5"
              />
              <span className="text-xs font-mono text-neutral-500">{color}</span>
              <span className="text-[11px] text-neutral-400">Custom hex finish</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsAddCardModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
            >
              Add Card
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Card Modal */}
      <Modal
        isOpen={isEditCardModalOpen}
        onClose={() => setIsEditCardModalOpen(false)}
        title="Edit Card Details & Style"
        subtitle="Update network, billing dates, limit, and metallic design finish"
      >
        <form noValidate onSubmit={handleUpdateCard} className="flex flex-col gap-4">
          {/* Live Realistic Card Preview */}
          <div className="mb-2">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
              Updated Card Preview
            </span>
            <div className="max-w-[310px] mx-auto">
              <CreditCardVisual
                card={{
                  id: selectedCard?.id || 'edit',
                  nickname: editNickname || 'CARD NICKNAME',
                  issuer: editIssuer || 'BANK NAME',
                  last4: (editLast4 || '0000').padEnd(4, '•'),
                  creditLimit: Number(editCreditLimit) || 100000,
                  statementDay: Number(editStatementDay) || 1,
                  paymentDueDay: Number(editPaymentDueDay) || 15,
                  color: editColor,
                  network: editNetwork,
                  isClosed: selectedCard?.isClosed,
                }}
                cardholderName={user?.name || 'VALUED CARDMEMBER'}
                showFlipButton={false}
                size="sm"
              />
            </div>
          </div>

          {/* Payment Network Selector */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Payment Network <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {CARD_NETWORKS.map((net) => {
                const isSelected = editNetwork === net.id;
                return (
                  <button
                    key={net.id}
                    type="button"
                    onClick={() => setEditNetwork(net.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-200 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <div className="h-6 flex items-center justify-center mb-1">
                      <NetworkLogo network={net.id} className="h-5" />
                    </div>
                    <span className="text-[11px] font-semibold">{net.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Card Nickname *
            </label>
            <input
              type="text"
              value={editNickname}
              onChange={(e) => {
                setEditNickname(e.target.value);
                if (editCardErrors.editNickname) setEditCardErrors(prev => { const n = { ...prev }; delete n.editNickname; return n; });
              }}
              placeholder="e.g. Coral, Millennia, Infinia, Platinum"
              className={`w-full rounded-lg border bg-white px-3 py-2 text-xs text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
                editCardErrors.editNickname ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}
            />
            {editCardErrors.editNickname && <p className="text-[11px] font-medium text-rose-500 mt-1">{editCardErrors.editNickname}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Bank / Issuer
              </label>
              <input
                type="text"
                value={editIssuer}
                onChange={(e) => setEditIssuer(e.target.value)}
                placeholder="e.g. HDFC Bank, ICICI Bank, Axis Bank"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Last 4 Digits *
              </label>
              <input
                type="text"
                maxLength={4}
                value={editLast4}
                onChange={(e) => {
                  setEditLast4(e.target.value.replace(/[^0-9]/g, ''));
                  if (editCardErrors.editLast4) setEditCardErrors(prev => { const n = { ...prev }; delete n.editLast4; return n; });
                }}
                placeholder="4421"
                className={`w-full rounded-lg border bg-white px-3 py-2 text-xs text-neutral-900 font-mono dark:bg-neutral-900 dark:text-neutral-100 ${
                  editCardErrors.editLast4 ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
                }`}
              />
              {editCardErrors.editLast4 && <p className="text-[11px] font-medium text-rose-500 mt-1">{editCardErrors.editLast4}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Credit Limit *
            </label>
            <CurrencyInput
              value={editCreditLimit}
              onChange={(val) => {
                setEditCreditLimit(val);
                if (editCardErrors.editCreditLimit) setEditCardErrors(prev => { const n = { ...prev }; delete n.editCreditLimit; return n; });
              }}
              placeholder="200000"
              hasError={!!editCardErrors.editCreditLimit}
            />
            {editCardErrors.editCreditLimit && <p className="text-[11px] font-medium text-rose-500 mt-1">{editCardErrors.editCreditLimit}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Statement Day of Month
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={editStatementDay}
                onChange={(e) => {
                  let val = e.target.value;
                  if (val.length > 1 && /^0\d/.test(val)) val = val.replace(/^0+(?=\d)/, '');
                  setEditStatementDay(val === '' ? '' : parseInt(val, 10));
                }}
                onFocus={(e) => e.target.select()}
                placeholder="1"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Payment Due Day of Month
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={editPaymentDueDay}
                onChange={(e) => {
                  let val = e.target.value;
                  if (val.length > 1 && /^0\d/.test(val)) val = val.replace(/^0+(?=\d)/, '');
                  setEditPaymentDueDay(val === '' ? '' : parseInt(val, 10));
                }}
                onFocus={(e) => e.target.select()}
                placeholder="15"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Luxury Finish Preset
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-3">
              {LUXURY_CARD_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setEditColor(preset.color)}
                  className={`group relative flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all ${
                    editColor === preset.color
                      ? 'border-indigo-600 ring-2 ring-indigo-500/30 dark:border-indigo-400 scale-105 shadow-sm'
                      : 'border-neutral-200 dark:border-neutral-700 hover:scale-102'
                  }`}
                  title={`${preset.name} (${preset.desc})`}
                >
                  <div
                    className="h-5 w-full rounded shadow-inner"
                    style={{ backgroundColor: preset.color }}
                  />
                  <span className="text-[9px] font-medium text-neutral-600 dark:text-neutral-400 truncate w-full text-center mt-1">
                    {preset.name.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="color"
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-neutral-300 bg-transparent p-0.5"
              />
              <span className="text-xs font-mono text-neutral-500">{editColor}</span>
              <span className="text-[11px] text-neutral-400">Custom hex finish</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsEditCardModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Card Bill Payment"
        subtitle="Saved as balance transfer · NEVER double counted as spending"
      >
        <form noValidate onSubmit={handleRecordPayment} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Payment Amount *
            </label>
            <CurrencyInput
              value={paymentAmount}
              onChange={(val) => {
                setPaymentAmount(val);
                if (paymentError) setPaymentError(null);
              }}
              placeholder={outstanding.toString()}
              hasError={!!paymentError}
            />
            {paymentError && <p className="text-[11px] font-medium text-rose-500 mt-1">{paymentError}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Payment Source
            </label>
            <input
              type="text"
              value={paymentSource}
              onChange={(e) => setPaymentSource(e.target.value)}
              placeholder="e.g. HDFC Salary Account"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="e.g. Net banking bill clearance"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
            >
              Confirm Payment
            </button>
          </div>
        </form>
      </Modal>

      {/* Add EMI Modal */}
      <Modal
        isOpen={isAddEmiModalOpen}
        onClose={() => setIsAddEmiModalOpen(false)}
        title="Track New EMI Plan"
      >
        <form noValidate onSubmit={handleCreateEmi} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              EMI Title *
            </label>
            <input
              type="text"
              value={emiTitle}
              onChange={(e) => {
                setEmiTitle(e.target.value);
                if (emiErrors.emiTitle) setEmiErrors(prev => { const n = { ...prev }; delete n.emiTitle; return n; });
              }}
              placeholder="e.g. Sony Bravia 65-inch TV"
              className={`w-full rounded-lg border bg-white px-3 py-2 text-xs text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
                emiErrors.emiTitle ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}
            />
            {emiErrors.emiTitle && <p className="text-[11px] font-medium text-rose-500 mt-1">{emiErrors.emiTitle}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Principal Amount *
              </label>
              <CurrencyInput
                value={emiPrincipal}
                onChange={(val) => {
                  setEmiPrincipal(val);
                  if (emiErrors.emiPrincipal) setEmiErrors(prev => { const n = { ...prev }; delete n.emiPrincipal; return n; });
                }}
                hasError={!!emiErrors.emiPrincipal}
              />
              {emiErrors.emiPrincipal && <p className="text-[11px] font-medium text-rose-500 mt-1">{emiErrors.emiPrincipal}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Tenure (Months)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={emiTenure}
                onChange={(e) => {
                  let val = e.target.value;
                  if (val.length > 1 && /^0\d/.test(val)) val = val.replace(/^0+(?=\d)/, '');
                  setEmiTenure(val === '' ? ('' as any) : parseInt(val, 10));
                }}
                onFocus={(e) => e.target.select()}
                placeholder="12"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 font-mono dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Monthly Installment *
            </label>
            <CurrencyInput
              value={emiMonthly}
              onChange={(val) => {
                setEmiMonthly(val);
                if (emiErrors.emiMonthly) setEmiErrors(prev => { const n = { ...prev }; delete n.emiMonthly; return n; });
              }}
              hasError={!!emiErrors.emiMonthly}
            />
            {emiErrors.emiMonthly && <p className="text-[11px] font-medium text-rose-500 mt-1">{emiErrors.emiMonthly}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsAddEmiModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
            >
              Save EMI
            </button>
          </div>
        </form>
      </Modal>
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!cardToDelete}
        onClose={() => setCardToDelete(null)}
        title="Delete Credit Card"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold">
                Are you sure you want to delete {cardToDelete?.nickname} (··{cardToDelete?.last4})?
              </p>
              <p className="mt-1 text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Deleting this card will permanently remove it. Associated transactions and recorded payments will no longer be linked to this card.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 p-3 text-xs text-neutral-600 dark:text-neutral-400">
            <span className="font-medium text-neutral-800 dark:text-neutral-200 block mb-1">
              Prefer closing the card instead?
            </span>
            Marking the card as <strong>Closed / Discontinued</strong> preserves your complete transaction history, EMIs, and reports while preventing accidental new charges.
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setCardToDelete(null)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300"
            >
              Cancel
            </button>
            {cardToDelete && !cardToDelete.isClosed && (
              <button
                type="button"
                onClick={() => {
                  updateCreditCard(cardToDelete.id, { isClosed: true });
                  setCardToDelete(null);
                }}
                className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
              >
                Close Card Instead
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (cardToDelete) {
                  deleteCreditCard(cardToDelete.id);
                  if (activeCardId === cardToDelete.id) {
                    const remaining = creditCards.filter((c) => c.id !== cardToDelete.id);
                    setActiveCardId(remaining[0]?.id || '');
                  }
                  setCardToDelete(null);
                }
              }}
              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 shadow-xs"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
