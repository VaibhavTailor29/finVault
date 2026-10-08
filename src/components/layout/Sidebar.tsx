import React, { useState } from 'react';
import {
  LayoutDashboard, Wallet, ArrowLeftRight, TrendingUp, PieChart,
  Tag, CreditCard, Users, Landmark, FileText, CalendarClock,
  Upload, Settings, ShieldCheck, ShieldAlert, LogOut
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const { user, logout } = useAuthStore();
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Accounts & Wallets', path: '/accounts', icon: Wallet },
    { label: 'Transactions', path: '/transactions', icon: ArrowLeftRight },
    { label: 'Income', path: '/income', icon: TrendingUp },
    { label: 'Budgets', path: '/budgets', icon: PieChart },
    { label: 'Categories & Tags', path: '/categories', icon: Tag },
    { label: 'Credit Cards', path: '/cards', icon: CreditCard },
    { label: 'People Ledger', path: '/people', icon: Users },
    { label: 'Investments', path: '/investments', icon: Landmark },
    { label: 'Reports', path: '/reports', icon: FileText },
    { label: 'Recurring Bills', path: '/recurring', icon: CalendarClock },
    { label: 'Import Statement', path: '/import', icon: Upload },
    { label: 'Settings & Security', path: '/settings', icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex w-64 h-full shrink-0 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 select-none overflow-hidden">
      {/* Brand Wordmark (Single text element wordmark as per Top Bar contract) */}
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => onNavigate('/')}
          className="text-left font-bold tracking-tight text-neutral-900 dark:text-neutral-100 text-lg flex items-center gap-2"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-black text-white shadow-xs">
            FV
          </span>
          <span>FinVault</span>
        </button>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path;
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-neutral-100 text-neutral-900 font-semibold dark:bg-neutral-800 dark:text-neutral-100'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Security Status Footnote */}
      <div className="shrink-0 p-4 border-t border-neutral-200 dark:border-neutral-800">
        <div
          onClick={() => onNavigate('/settings')}
          className="cursor-pointer flex items-center justify-between rounded-lg p-2.5 bg-neutral-50 dark:bg-neutral-800/60 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            {user?.twoFactorEnabled ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-500" />
            )}
            <div className="flex flex-col text-left">
              <span className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200">
                {user?.twoFactorEnabled ? '2FA Enabled' : '2FA Recommended'}
              </span>
              <span className="text-[10px] text-neutral-400">
                {user?.twoFactorEnabled ? 'TOTP Active' : 'Setup now'}
              </span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsLogoutConfirmOpen(true);
            }}
            title="Log out"
            className="text-neutral-400 hover:text-rose-600 transition-colors p-1"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={logout}
        title="Confirm Log Out"
        message="Are you sure you want to log out of your FinVault account? You will need to sign in again to access your finances."
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        isDestructive={true}
      />
    </aside>
  );
};
