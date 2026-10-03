import React, { useState, useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { useSettingsStore } from './store/useSettingsStore';
import { AppLayout } from './components/layout/AppLayout';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { IncomePage } from './pages/IncomePage';
import { BudgetsPage } from './pages/BudgetsPage';
import { CategoriesTagsPage } from './pages/CategoriesTagsPage';
import { CreditCardsPage } from './pages/CreditCardsPage';
import { PeopleLedgerPage } from './pages/PeopleLedgerPage';
import { InvestmentsPage } from './pages/InvestmentsPage';
import { ReportsPage } from './pages/ReportsPage';
import { RecurringPage } from './pages/RecurringPage';
import { SettingsPage } from './pages/SettingsPage';
import { AccountsPage } from './pages/AccountsPage';
import { ImportPage } from './pages/ImportPage';
import { useFinanceStore } from './store/useFinanceStore';

export default function App() {
  const { isAuthenticated, mfaPending } = useAuthStore();
  const { theme } = useSettingsStore();
  const { fetchFromBackend } = useFinanceStore();
  const [currentPath, setCurrentPath] = useState('/');

  // Synchronize state with backend on mount only when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchFromBackend();
    }
  }, [isAuthenticated, fetchFromBackend]);

  // Initialize and synchronize theme on mount
  useEffect(() => {
    const applyTheme = () => {
      const isDark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
      }
    };

    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  // Page titles map
  const pageTitles: Record<string, string> = {
    '/': 'Dashboard Overview',
    '/accounts': 'Bank Accounts & Wallets',
    '/transactions': 'Transactions & Ledger',
    '/income': 'Income Streams',
    '/budgets': 'Budgets & Spending Limits',
    '/categories': 'Categories & Tags',
    '/cards': 'Credit Card Manager',
    '/people': 'People Debt Ledger',
    '/investments': 'Portfolio & Asset Holdings',
    '/reports': 'Monthly & Annual Reports',
    '/recurring': 'Recurring Bills & Schedules',
    '/import': 'Statement & CSV Import',
    '/settings': 'Account & Security Settings',
  };

  // If not logged in or in MFA challenge, render Auth page
  if (!isAuthenticated || mfaPending) {
    return <AuthPage onSuccess={() => setCurrentPath('/')} />;
  }

  const renderActivePage = () => {
    switch (currentPath) {
      case '/':
        return <DashboardPage onNavigate={setCurrentPath} />;
      case '/accounts':
        return <AccountsPage />;
      case '/transactions':
        return <TransactionsPage />;
      case '/income':
        return <IncomePage />;
      case '/budgets':
        return <BudgetsPage />;
      case '/categories':
        return <CategoriesTagsPage />;
      case '/cards':
        return <CreditCardsPage />;
      case '/people':
        return <PeopleLedgerPage />;
      case '/investments':
        return <InvestmentsPage />;
      case '/reports':
        return <ReportsPage />;
      case '/recurring':
        return <RecurringPage />;
      case '/import':
        return <ImportPage />;
      case '/settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={setCurrentPath} />;
    }
  };

  return (
    <AppLayout
      currentPath={currentPath}
      onNavigate={setCurrentPath}
      title={pageTitles[currentPath] || 'FinVault'}
    >
      {renderActivePage()}
    </AppLayout>
  );
}
