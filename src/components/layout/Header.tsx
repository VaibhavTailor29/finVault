import React, { useState } from 'react';
import { Eye, EyeOff, Bell, Sun, Moon, Laptop, ShieldCheck, Check, LogOut } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useFinanceStore } from '../../store/useFinanceStore';
import { CURRENCY_SYMBOLS } from '../../utils/formatters';
import { CustomSelect } from '../common/CustomSelect';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface HeaderProps {
  currentTitle: string;
}

export const Header: React.FC<HeaderProps> = ({ currentTitle }) => {
  const { theme, setTheme, currency, setCurrency, privacyMode, togglePrivacyMode } = useSettingsStore();
  const { user, logout } = useAuthStore();
  const { notifications, markAllNotificationsAsRead } = useFinanceStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const isEffectiveDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTheme = () => {
    setTheme(isEffectiveDark ? 'light' : 'dark');
  };

  return (
    <header className="shrink-0 sticky top-0 z-30 flex h-14 sm:h-16 w-full items-center justify-between border-b border-neutral-200 bg-white/95 px-3 sm:px-6 lg:px-8 backdrop-blur-xs dark:border-neutral-800 dark:bg-neutral-900/95 transition-colors">
      {/* Zone 1: Current Page Title & Brand (Mobile) */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial mr-2">
        {/* Mobile Brand Wordmark */}
        <div className="lg:hidden flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-xs font-black text-white shadow-xs">
          FV
        </div>

        <h1 className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-neutral-100 truncate">
          {currentTitle}
        </h1>

        {privacyMode && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            <EyeOff className="h-3 w-3" />
            <span className="hidden sm:inline">Privacy Active</span>
          </span>
        )}
      </div>

      {/* Zone 2 & 3: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Privacy Mode Toggle */}
        <button
          type="button"
          onClick={togglePrivacyMode}
          className={`flex h-8 sm:h-9 items-center justify-center gap-1.5 rounded-lg border px-2 sm:px-2.5 text-xs font-medium transition-colors ${
            privacyMode
              ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
              : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
          }`}
          title={privacyMode ? 'Privacy Mode Active (Tap to Unmask)' : 'Toggle privacy mode to mask amounts in public'}
          aria-label="Toggle privacy mode"
        >
          {privacyMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          <span className="hidden md:inline">{privacyMode ? 'Masked' : 'Privacy'}</span>
        </button>

        {/* Currency Selector (Tablet & Desktop) */}
        <div className="hidden sm:block">
          <CustomSelect
            value={currency}
            onChange={setCurrency}
            size="sm"
            align="right"
            aria-label="Select Currency"
            title="Select Currency"
            options={Object.keys(CURRENCY_SYMBOLS).map((c) => ({
              value: c,
              label: `${c} (${CURRENCY_SYMBOLS[c].trim()})`,
            }))}
          />
        </div>

        {/* Theme Selector Dropdown (Desktop) */}
        <div className="hidden md:block">
          <CustomSelect
            value={theme}
            onChange={(val) => setTheme(val as 'light' | 'dark' | 'system')}
            size="sm"
            align="right"
            aria-label="Select Theme"
            title="Select Theme"
            options={[
              {
                value: 'light',
                label: 'Light',
                icon: <Sun className="h-3.5 w-3.5 text-amber-500" />,
              },
              {
                value: 'dark',
                label: 'Dark',
                icon: <Moon className="h-3.5 w-3.5 text-indigo-400" />,
              },
              {
                value: 'system',
                label: 'System',
                icon: <Laptop className="h-3.5 w-3.5 text-neutral-400" />,
              },
            ]}
          />
        </div>

        {/* Quick Theme Toggle Button (Mobile & Tablet) */}
        <button
          type="button"
          onClick={toggleTheme}
          className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 transition-colors"
          title={isEffectiveDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          {isEffectiveDark ? (
            <Sun className="h-3.5 w-3.5 text-amber-500" />
          ) : (
            <Moon className="h-3.5 w-3.5 text-indigo-400" />
          )}
        </button>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className="relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 transition-colors"
            title="Notifications"
            aria-label="View notifications"
          >
            <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] sm:w-80 max-w-sm rounded-xl border border-neutral-200 bg-white p-3 shadow-xl dark:border-neutral-800 dark:bg-neutral-900 z-50">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2 mb-2 dark:border-neutral-800">
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    Notifications ({unreadCount} new)
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllNotificationsAsRead()}
                      className="text-[11px] text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto flex flex-col gap-2">
                  {notifications.length === 0 ? (
                    <p className="py-4 text-center text-xs text-neutral-400">
                      No new notifications
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`flex flex-col gap-0.5 rounded-lg p-2 text-xs transition-colors ${
                          n.isRead
                            ? 'bg-transparent text-neutral-600 dark:text-neutral-400'
                            : 'bg-indigo-50/60 dark:bg-indigo-950/30 text-neutral-900 dark:text-neutral-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{n.title}</span>
                          {!n.isRead && (
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {n.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Profile Avatar & User Menu */}
        <div className="relative flex items-center pl-1 sm:pl-2 border-l border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-1.5 rounded-full p-0.5 hover:ring-2 hover:ring-indigo-500/20 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 cursor-pointer transition-all"
            title="User Account"
            aria-label="User Account"
          >
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-xs font-bold text-white shadow-xs">
              {user?.name?.[0] || 'V'}
            </div>
            {user?.twoFactorEnabled && (
              <span title="2FA Protection Active" className="text-emerald-500">
                <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </span>
            )}
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 top-11 mt-1 w-[calc(100vw-1.5rem)] sm:w-64 max-w-xs rounded-xl border border-neutral-200 bg-white p-2.5 shadow-xl dark:border-neutral-800 dark:bg-neutral-900 z-50">
                <div className="px-2.5 py-2 border-b border-neutral-100 dark:border-neutral-800">
                  <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {user?.name || 'FinVault User'}
                  </p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                    {user?.email || ''}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-[10px]">
                    {user?.twoFactorEnabled ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <ShieldCheck className="h-3 w-3" /> 2FA Active
                      </span>
                    ) : (
                      <span className="text-amber-500 font-medium">
                        2FA Not Enabled
                      </span>
                    )}
                  </div>
                </div>

                {/* Mobile-only Quick Currency Selector */}
                <div className="sm:hidden px-2.5 py-2 border-b border-neutral-100 dark:border-neutral-800">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Currency
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {Object.keys(CURRENCY_SYMBOLS).slice(0, 6).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setCurrency(c);
                        }}
                        className={`py-1 px-1.5 rounded text-[11px] font-medium border text-center transition-colors ${
                          currency === c
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                            : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
                        }`}
                      >
                        {c} {CURRENCY_SYMBOLS[c].trim()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      setIsLogoutConfirmOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
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
    </header>
  );
};
