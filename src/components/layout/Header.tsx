import React, { useState } from 'react';
import { Eye, EyeOff, Bell, Sun, Moon, Laptop, ShieldCheck, Check } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useFinanceStore } from '../../store/useFinanceStore';
import { CURRENCY_SYMBOLS } from '../../utils/formatters';
import { CustomSelect } from '../common/CustomSelect';

interface HeaderProps {
  currentTitle: string;
}

export const Header: React.FC<HeaderProps> = ({ currentTitle }) => {
  const { theme, setTheme, currency, setCurrency, privacyMode, togglePrivacyMode } = useSettingsStore();
  const { user } = useAuthStore();
  const { notifications, markAllNotificationsAsRead } = useFinanceStore();
  const [showNotifications, setShowNotifications] = useState(false);

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
    <header className="shrink-0 sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-neutral-200 bg-white/95 px-4 sm:px-8 backdrop-blur-xs dark:border-neutral-800 dark:bg-neutral-900/95 transition-colors">
      {/* Zone 1: Current Page Title */}
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {currentTitle}
        </h1>
        {privacyMode && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            <EyeOff className="h-3 w-3" />
            Privacy Active
          </span>
        )}
      </div>

      {/* Zone 2 & 3: Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Privacy Mode Toggle */}
        <button
          onClick={togglePrivacyMode}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
            privacyMode
              ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
              : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
          }`}
          title="Toggle privacy mode to mask amounts in public"
        >
          {privacyMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{privacyMode ? 'Masked' : 'Privacy'}</span>
        </button>

        {/* Currency Selector */}
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

        {/* Theme Selector Dropdown */}
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

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-lg border border-neutral-200 p-2 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 transition-colors"
            title="Notifications"
            aria-label="View notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-neutral-200 bg-white p-3 shadow-xl dark:border-neutral-800 dark:bg-neutral-900 z-50">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2 mb-2 dark:border-neutral-800">
                <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Notifications ({unreadCount} new)
                </span>
                {unreadCount > 0 && (
                  <button
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
          )}
        </div>

        {/* Profile Avatar & 2FA status */}
        <div className="flex items-center gap-2 pl-2 border-l border-neutral-200 dark:border-neutral-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-xs font-bold text-white shadow-xs">
            {user?.name?.[0] || 'V'}
          </div>
          {user?.twoFactorEnabled && (
            <span title="2FA Protection Active" className="text-emerald-500">
              <ShieldCheck className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
