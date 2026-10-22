import { create } from 'zustand';

interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  currency: string;
  privacyMode: boolean;
  reminderDaysBeforeDue: number;
  emailRemindersEnabled: boolean;
  reminderEmail: string;
  emailCardDues: boolean;
  emailRecurringDues: boolean;
  emailDebtDues: boolean;
  marketRegion: string;
  autoMarketHoursSync: boolean;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setCurrency: (currency: string) => void;
  setMarketRegion: (region: string) => void;
  setAutoMarketHoursSync: (enabled: boolean) => void;
  togglePrivacyMode: () => void;
  setReminderDays: (days: number) => void;
  setEmailRemindersEnabled: (enabled: boolean) => void;
  setReminderEmail: (email: string) => void;
  setEmailCardDues: (enabled: boolean) => void;
  setEmailRecurringDues: (enabled: boolean) => void;
  setEmailDebtDues: (enabled: boolean) => void;
}

const applyThemeToDOM = (theme: 'light' | 'dark' | 'system') => {
  if (typeof window === 'undefined') return;
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

export const useSettingsStore = create<SettingsState>((set) => {
  const savedCurrency = localStorage.getItem('finvault_currency') || localStorage.getItem('kuber_currency') || 'INR';
  const savedTheme = ((localStorage.getItem('finvault_theme') || localStorage.getItem('kuber_theme')) as 'light' | 'dark' | 'system') || 'light';
  const savedPrivacy = (localStorage.getItem('finvault_privacy') || localStorage.getItem('kuber_privacy')) === 'true';
  const savedLeadDays = parseInt(localStorage.getItem('finvault_reminder_days') || '3', 10);
  const savedEmailReminders = localStorage.getItem('finvault_email_reminders') !== 'false';
  const savedReminderEmail = localStorage.getItem('finvault_reminder_email') || '';
  const savedCardDues = localStorage.getItem('finvault_email_card_dues') !== 'false';
  const savedRecurringDues = localStorage.getItem('finvault_email_rec_dues') !== 'false';
  const savedDebtDues = localStorage.getItem('finvault_email_debt_dues') !== 'false';
  const savedMarketRegion = localStorage.getItem('finvault_market_region') || 'IN';
  const savedAutoMarketHours = localStorage.getItem('finvault_auto_market_hours') !== 'false';

  // Apply immediately on store initialization
  applyThemeToDOM(savedTheme);

  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      const currentTheme = (localStorage.getItem('finvault_theme') || 'light') as 'light' | 'dark' | 'system';
      if (currentTheme === 'system') {
        applyThemeToDOM('system');
      }
    });
  }

  return {
    theme: savedTheme,
    currency: savedCurrency,
    privacyMode: savedPrivacy,
    reminderDaysBeforeDue: isNaN(savedLeadDays) ? 3 : savedLeadDays,
    emailRemindersEnabled: savedEmailReminders,
    reminderEmail: savedReminderEmail,
    emailCardDues: savedCardDues,
    emailRecurringDues: savedRecurringDues,
    emailDebtDues: savedDebtDues,
    marketRegion: savedMarketRegion,
    autoMarketHoursSync: savedAutoMarketHours,

    setTheme: (theme) => {
      localStorage.setItem('finvault_theme', theme);
      localStorage.setItem('kuber_theme', theme);
      applyThemeToDOM(theme);
      set({ theme });
    },
    setCurrency: (currency) => {
      localStorage.setItem('finvault_currency', currency);
      localStorage.setItem('kuber_currency', currency);
      set({ currency });
    },
    setMarketRegion: (region) => {
      localStorage.setItem('finvault_market_region', region);
      set({ marketRegion: region });
    },
    setAutoMarketHoursSync: (enabled) => {
      localStorage.setItem('finvault_auto_market_hours', String(enabled));
      set({ autoMarketHoursSync: enabled });
    },
    togglePrivacyMode: () => {
      set((state) => {
        const next = !state.privacyMode;
        localStorage.setItem('finvault_privacy', String(next));
        localStorage.setItem('kuber_privacy', String(next));
        return { privacyMode: next };
      });
    },
    setReminderDays: (days) => {
      localStorage.setItem('finvault_reminder_days', String(days));
      set({ reminderDaysBeforeDue: days });
    },
    setEmailRemindersEnabled: (enabled) => {
      localStorage.setItem('finvault_email_reminders', String(enabled));
      set({ emailRemindersEnabled: enabled });
    },
    setReminderEmail: (email) => {
      localStorage.setItem('finvault_reminder_email', email);
      set({ reminderEmail: email });
    },
    setEmailCardDues: (enabled) => {
      localStorage.setItem('finvault_email_card_dues', String(enabled));
      set({ emailCardDues: enabled });
    },
    setEmailRecurringDues: (enabled) => {
      localStorage.setItem('finvault_email_rec_dues', String(enabled));
      set({ emailRecurringDues: enabled });
    },
    setEmailDebtDues: (enabled) => {
      localStorage.setItem('finvault_email_debt_dues', String(enabled));
      set({ emailDebtDues: enabled });
    },
  };
});
