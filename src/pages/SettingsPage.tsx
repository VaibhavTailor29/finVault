import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, ShieldAlert, KeyRound, Download, Upload,
  Smartphone, Trash2, Eye, EyeOff, Lock, User, RefreshCw, Check, Copy,
  Sun, Moon, Monitor, Mail, Bell, Send, AlertCircle, Loader2
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useFinanceStore } from '../store/useFinanceStore';
import { generateBase32Secret, generateRecoveryCodes, verifyTOTP } from '../utils/totp';
import { encryptBackupData, decryptBackupData } from '../utils/crypto';
import { CURRENCY_SYMBOLS } from '../utils/formatters';
import { apiClient } from '../api/client';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { QrCodeCard } from '../components/security/QrCodeCard';
import { OtpInput } from '../components/security/OtpInput';
import { RecoveryCodesDialog } from '../components/security/RecoveryCodesDialog';
import { StepUpDialog } from '../components/security/StepUpDialog';
import { CustomSelect } from '../components/common/CustomSelect';
import { SUPPORTED_MARKETS, getMarketStatus } from '../utils/marketHours';

export const SettingsPage: React.FC = () => {
  const {
    user, enable2FA, disable2FA,
    regenerateRecoveryCodes, sessions, revokeSession, logoutEverywhere, initSessions, logout
  } = useAuthStore();
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isLogoutEverywhereConfirmOpen, setIsLogoutEverywhereConfirmOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const {
    currency, setCurrency, theme, setTheme,
    privacyMode, togglePrivacyMode, reminderDaysBeforeDue, setReminderDays,
    emailRemindersEnabled, setEmailRemindersEnabled,
    reminderEmail, setReminderEmail,
    emailCardDues, setEmailCardDues,
    emailRecurringDues, setEmailRecurringDues,
    emailDebtDues, setEmailDebtDues,
    marketRegion, setMarketRegion,
    autoMarketHoursSync, setAutoMarketHoursSync
  } = useSettingsStore();
  const {
    exportAllData, importAllData, clearAllData,
    checkAndGenerateDueReminders, addNotification,
    syncWithMarketHours
  } = useFinanceStore();



  // Email Reminders
  const [localReminderEmail, setLocalReminderEmail] = useState(reminderEmail || user?.email || '');
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<{
    status: string;
    service?: string;
    smtp_configured: boolean;
    mode?: string;
    sender_address?: string;
    smtp_host?: string | null;
    smtp_port?: number | null;
    smtp_user?: string | null;
    info?: string;
  } | null>(null);

  // 2FA Setup Wizard
  const [is2FaSetupOpen, setIs2FaSetupOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<'qr' | 'verify'>('qr');
  const [generatedSecret, setGeneratedSecret] = useState('');
  const [backendQrSvg, setBackendQrSvg] = useState<string | undefined>(undefined);
  const [setupLoading, setSetupLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);

  // Recovery Codes Modal
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [activeRecoveryCodes, setActiveRecoveryCodes] = useState<string[]>([]);

  // Step-Up Actions
  const [isStepUpOpen, setIsStepUpOpen] = useState(false);
  const [stepUpAction, setStepUpAction] = useState<(() => void) | null>(null);
  const [stepUpTitle, setStepUpTitle] = useState('');

  // Backup / Restore
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [importJsonText, setImportJsonText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [backupStatusMessage, setBackupStatusMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    initSessions();
    apiClient.getReminderStatus().then(setSmtpStatus).catch(() => {});
  }, [initSessions]);



  const handleSendTestEmail = async () => {
    const target = (localReminderEmail || user?.email || '').trim();
    if (!target || !target.includes('@')) {
      setTestEmailFeedback({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }
    setReminderEmail(target);
    setTestEmailLoading(true);
    setTestEmailFeedback(null);
    try {
      const res = await apiClient.sendTestReminder(target, currency);
      const generated = checkAndGenerateDueReminders(reminderDaysBeforeDue);
      addNotification({
        title: 'Test Email Reminder Sent',
        message: `Dispatched test payment alert to ${target}. ${generated.length} upcoming dues synced.`,
        type: 'due_reminder',
      });
      setTestEmailFeedback({
        type: 'success',
        text: res.message || `Test reminder email successfully dispatched to ${target}!`,
      });
    } catch (err: any) {
      setTestEmailFeedback({
        type: 'error',
        text: err?.message || 'Failed to dispatch email. Check server configuration.',
      });
    } finally {
      setTestEmailLoading(false);
    }
  };

  const handleScanDuesNow = () => {
    const notifs = checkAndGenerateDueReminders(reminderDaysBeforeDue);
    setScanFeedback(
      notifs.length > 0
        ? `Found ${notifs.length} upcoming dues within ${reminderDaysBeforeDue} days. Added to notification bell!`
        : `All clear! No pending card dues or bills within the next ${reminderDaysBeforeDue} days.`
    );
    setTimeout(() => setScanFeedback(null), 5000);
  };

  const start2FASetup = async () => {
    setVerificationCode('');
    setSetupError(null);
    setSetupStep('qr');
    setIs2FaSetupOpen(true);
    setSetupLoading(true);

    try {
      const res = await apiClient.setup2FA();
      if (res && res.secret) {
        setGeneratedSecret(res.secret);
        setBackendQrSvg(res.qr_svg);
      } else {
        const sec = generateBase32Secret(16);
        setGeneratedSecret(sec);
      }
    } catch {
      const sec = generateBase32Secret(16);
      setGeneratedSecret(sec);
    } finally {
      setSetupLoading(false);
    }
  };

  const handleVerifyAndEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length !== 6) {
      setSetupError('Please enter the complete 6-digit code.');
      return;
    }

    setSetupLoading(true);
    setSetupError(null);

    try {
      const res = await apiClient.enable2FA(generatedSecret, verificationCode.trim());
      const recovery = res.recovery_codes && res.recovery_codes.length > 0 ? res.recovery_codes : generateRecoveryCodes(10);
      enable2FA(generatedSecret, recovery);
      setIs2FaSetupOpen(false);
      setActiveRecoveryCodes(recovery);
      setIsRecoveryModalOpen(true);
    } catch (err: any) {
      setSetupError(err?.message || 'Invalid verification code. Please check your authenticator app and make sure your phone time is accurate.');
    } finally {
      setSetupLoading(false);
    }
  };

  const triggerStepUp = (title: string, action: () => void) => {
    if (user?.twoFactorEnabled) {
      setStepUpTitle(title);
      setStepUpAction(() => action);
      setIsStepUpOpen(true);
    } else {
      action();
    }
  };

  const handleExportBackup = async () => {
    triggerStepUp('Full Data Export', async () => {
      const data = exportAllData();
      const rawJson = JSON.stringify(data, null, 2);

      let payload = rawJson;
      let filename = `finvault-backup-${new Date().toISOString().split('T')[0]}.json`;

      if (backupPassphrase.trim()) {
        payload = await encryptBackupData(rawJson, backupPassphrase.trim());
        filename = `finvault-backup-${new Date().toISOString().split('T')[0]}.finvault`;
      }

      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setBackupStatusMessage('Backup downloaded successfully.');
      setTimeout(() => setBackupStatusMessage(null), 3000);
    });
  };

  const handleImportBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importJsonText.trim()) {
      setImportError('Please enter or paste your backup JSON payload.');
      return;
    }
    setImportError(null);
    try {
      let jsonToParse = importJsonText.trim();
      if (backupPassphrase.trim() && (jsonToParse.includes('finvault_enc_v1') || jsonToParse.includes('kuber_enc_v1'))) {
        jsonToParse = await decryptBackupData(jsonToParse, backupPassphrase.trim());
      }
      const parsed = JSON.parse(jsonToParse);
      importAllData(parsed, importMode);
      setIsImportModalOpen(false);
      setImportJsonText('');
      setImportError(null);
      setBackupStatusMessage(`Backup successfully imported with mode '${importMode}'.`);
      setTimeout(() => setBackupStatusMessage(null), 3000);
    } catch (err) {
      setImportError('Failed to import backup: Invalid JSON or incorrect passphrase.');
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Account &amp; Security Settings
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Two-factor authentication, cryptographic key rotation, active sessions, and data exports
        </p>
      </div>

      {backupStatusMessage && (
        <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {backupStatusMessage}
        </div>
      )}

      {/* Security Status Card */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                user?.twoFactorEnabled
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
              }`}
            >
              {user?.twoFactorEnabled ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <ShieldAlert className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Two-Factor Authentication (2FA)
              </h3>
              <p className="text-xs text-neutral-500">
                {user?.twoFactorEnabled
                  ? 'Active · Verification code required at login and authorization'
                  : 'Disabled · Protect your financial records with an authenticator app'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user?.twoFactorEnabled ? (
              <>
                <button
                  onClick={() =>
                    triggerStepUp('Regenerate Recovery Codes', () => {
                      const newCodes = generateRecoveryCodes(10);
                      regenerateRecoveryCodes(newCodes);
                      setActiveRecoveryCodes(newCodes);
                      setIsRecoveryModalOpen(true);
                    })
                  }
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors shadow-xs"
                >
                  Regenerate Codes
                </button>
                <button
                  onClick={() =>
                    triggerStepUp('Disable Two-Factor Authentication', async () => {
                      try {
                        await apiClient.disable2FA();
                        disable2FA();
                        addNotification({
                          title: 'Two-Factor Authentication Disabled',
                          message: 'Two-factor authentication has been turned off for your account.',
                          type: 'info',
                        });
                      } catch (err: any) {
                        alert(err?.message || 'Failed to disable 2FA');
                      }
                    })
                  }
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60 transition-colors"
                >
                  Disable 2FA
                </button>
              </>
            ) : (
              <button
                onClick={start2FASetup}
                className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
              >
                Enable 2FA
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Security Architecture Card */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
            <Lock className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Selective Security Architecture (Protected &amp; Secure)
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                ✓ Confidential Only · Zero Extra Overhead
              </span>
            </div>
            <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
              Your security keys, passwords, recovery codes, and sensitive personal notes are encrypted, while calculations and portfolio charts remain instantaneous.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 font-mono text-neutral-600 dark:text-neutral-300">
                2FA: Protected
              </span>
              <span className="rounded bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 font-mono text-neutral-600 dark:text-neutral-300">
                Passwords: Securely Hashed
              </span>
              <span className="rounded bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 font-mono text-emerald-700 dark:text-emerald-300">
                Amounts: High-Precision Calculation
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Profile & Identity */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Account Identity
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Your registered credentials are cryptographically bound to your financial vault and cannot be modified.
            </p>
          </div>
          <span className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            <Lock className="h-3 w-3 text-neutral-500" /> Locked &amp; Permanent
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Username
              </label>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-neutral-400">
                <Lock className="h-3 w-3" /> Permanent
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                disabled
                readOnly
                value={user?.name || ''}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-100/80 p-2 pl-2.5 pr-8 text-xs text-neutral-500 cursor-not-allowed select-none dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-400 font-medium"
              />
              <Lock className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
            </div>
            <p className="mt-1 text-[11px] text-neutral-400">
              Username cannot be changed after registration.
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Email Address
              </label>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-neutral-400">
                <Lock className="h-3 w-3" /> Permanent
              </span>
            </div>
            <div className="relative">
              <input
                type="email"
                disabled
                readOnly
                value={user?.email || ''}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-100/80 p-2 pl-2.5 pr-8 text-xs text-neutral-500 cursor-not-allowed select-none dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-400 font-medium"
              />
              <Lock className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
            </div>
            <p className="mt-1 text-[11px] text-neutral-400">
              Email address cannot be changed after registration.
            </p>
          </div>
        </div>
      </div>

      {/* Preferences & Privacy Mode */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
          Preferences &amp; Display
        </h3>

        <div className="space-y-4 text-xs">
          {/* Appearance / Theme */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-neutral-100 dark:border-neutral-800">
            <div>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                Theme &amp; Appearance
              </span>
              <span className="text-neutral-400">
                Choose between Light mode, Dark mode, or follow your System preferences
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-800 dark:bg-neutral-800/80">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  theme === 'light'
                    ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-700 dark:text-white'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
                }`}
              >
                <Sun className="h-3.5 w-3.5 text-amber-500" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  theme === 'dark'
                    ? 'bg-neutral-900 text-white shadow-xs dark:bg-neutral-700 dark:text-white'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
                }`}
              >
                <Moon className="h-3.5 w-3.5 text-indigo-400" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  theme === 'system'
                    ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-700 dark:text-white'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
                }`}
              >
                <Monitor className="h-3.5 w-3.5 text-neutral-500" />
                <span>System</span>
              </button>
            </div>
          </div>

          {/* Privacy Mode Toggle */}
          <div className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800">
            <div>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                Public Privacy Mode
              </span>
              <span className="text-neutral-400">
                Mask financial figures with •••• on all screens for privacy in public places
              </span>
            </div>
            <button
              type="button"
              onClick={togglePrivacyMode}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold transition-colors ${
                privacyMode
                  ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'border-neutral-300 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
              }`}
            >
              {privacyMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {privacyMode ? 'Masked' : 'Normal'}
            </button>
          </div>

          {/* Primary Currency */}
          <div className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800">
            <div>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                Display Currency
              </span>
              <span className="text-neutral-400">Select reporting and display denomination</span>
            </div>
            <CustomSelect
              value={currency}
              onChange={setCurrency}
              size="sm"
              align="right"
              options={Object.keys(CURRENCY_SYMBOLS).map((c) => ({
                value: c,
                label: `${c} (${CURRENCY_SYMBOLS[c].trim()})`,
              }))}
            />
          </div>

          {/* Market & Country Timezone */}
          <div className="py-2.5 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                  Market &amp; Country Timezone
                </span>
                <span className="text-neutral-400">
                  Controls trading session hours &amp; auto live tracker scheduling
                </span>
              </div>
              <CustomSelect
                value={marketRegion}
                onChange={(val) => {
                  setMarketRegion(val);
                  syncWithMarketHours(val, autoMarketHoursSync);
                }}
                size="sm"
                align="right"
                options={SUPPORTED_MARKETS.map((m) => ({
                  value: m.id,
                  label: `${m.flag} ${m.country} (${m.timezoneLabel.split(' ')[0]})`,
                }))}
              />
            </div>

            {/* Live Market Hours Status Pill */}
            {(() => {
              const status = getMarketStatus(marketRegion);
              return (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      status.isOpen
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        status.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                      }`}
                    />
                    {status.statusText} • {status.localTimeFormatted}
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {status.reason}
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Auto-sync Live Tracker with Market Hours */}
          <div className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800">
            <div>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                Auto-sync Live Tracker with Market Hours
              </span>
              <span className="text-neutral-400">
                Automatically activates Live Ticker during trading sessions and turns it off after market close
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !autoMarketHoursSync;
                setAutoMarketHoursSync(next);
                syncWithMarketHours(marketRegion, next);
              }}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold transition-colors cursor-pointer ${
                autoMarketHoursSync
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-neutral-300 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  autoMarketHoursSync ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'
                }`}
              />
              {autoMarketHoursSync ? 'Enabled' : 'Disabled'}
            </button>
          </div>


          {/* Due Date Reminders */}
          <div className="flex items-center justify-between py-2">
            <div>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                Reminder Lead Time
              </span>
              <span className="text-neutral-400">Days before credit card &amp; loan due dates</span>
            </div>
            <CustomSelect
              value={reminderDaysBeforeDue}
              onChange={(val) => setReminderDays(Number(val))}
              size="sm"
              align="right"
              options={[
                { value: 1, label: '1 day before' },
                { value: 3, label: '3 days before' },
                { value: 5, label: '5 days before' },
                { value: 7, label: '7 days before' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Email Notifications & Due Reminders Card */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Email Notifications &amp; Due Date Reminders
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {smtpStatus && (
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                  smtpStatus.smtp_configured
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                }`}
              >
                {smtpStatus.smtp_configured
                  ? 'Email Service: Connected'
                  : 'Email Service: Not Configured'}
              </span>
            )}
            <button
              onClick={() => setEmailRemindersEnabled(!emailRemindersEnabled)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                emailRemindersEnabled
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
              }`}
            >
              {emailRemindersEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 text-xs">
          {/* Recipient Email */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Reminder Recipient Email Address
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="email"
                  value={localReminderEmail}
                  onChange={(e) => {
                    setLocalReminderEmail(e.target.value);
                    setReminderEmail(e.target.value);
                  }}
                  placeholder="your-email@example.com"
                  className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 pl-8"
                />
                <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
              </div>
              <button
                type="button"
                disabled={testEmailLoading}
                onClick={handleSendTestEmail}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-xs disabled:opacity-50 shrink-0"
              >
                {testEmailLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {testEmailLoading ? 'Sending...' : 'Send Test Reminder'}
              </button>
            </div>
            <span className="text-[11px] text-neutral-400 mt-1 block">
              Where credit card statements, loan due notices, and debt reminder digests are delivered.
            </span>
          </div>

          {/* Test Email Feedback */}
          {testEmailFeedback && (
            <div
              className={`flex items-center gap-2 p-2.5 rounded-lg text-xs ${
                testEmailFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {testEmailFeedback.type === 'success' ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{testEmailFeedback.text}</span>
            </div>
          )}

          {/* Categories Enabled */}
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100 block mb-2">
              Notify For
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 p-2.5 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <input
                  type="checkbox"
                  checked={emailCardDues}
                  onChange={(e) => setEmailCardDues(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-neutral-700 dark:text-neutral-300 font-medium">Credit Card Dues</span>
              </label>

              <label className="flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 p-2.5 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <input
                  type="checkbox"
                  checked={emailRecurringDues}
                  onChange={(e) => setEmailRecurringDues(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-neutral-700 dark:text-neutral-300 font-medium">Subscriptions &amp; Bills</span>
              </label>

              <label className="flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 p-2.5 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <input
                  type="checkbox"
                  checked={emailDebtDues}
                  onChange={(e) => setEmailDebtDues(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-neutral-700 dark:text-neutral-300 font-medium">People Debts (Lent)</span>
              </label>
            </div>
          </div>

          {/* Manual Scan Action */}
          <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                Instant Due Scan
              </span>
              <span className="text-neutral-400">
                Scan all cards, recurring bills, and ledger records right now.
              </span>
            </div>
            <button
              type="button"
              onClick={handleScanDuesNow}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 shadow-xs"
            >
              <Bell className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Scan Dues Now
            </button>
          </div>

          {scanFeedback && (
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {scanFeedback}
            </div>
          )}
        </div>
      </div>

      {/* Active Sessions & Devices */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Active Sessions &amp; Trusted Devices ({sessions.length})
            </h3>
          </div>

          {sessions.length > 1 && (
            <button
              onClick={() => setIsLogoutEverywhereConfirmOpen(true)}
              className="text-xs text-rose-600 hover:underline dark:text-rose-400"
            >
              Log out everywhere else
            </button>
          )}
        </div>

        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {sessions.length === 0 ? (
            <p className="py-4 text-center text-xs text-neutral-400">
              No active sessions detected.
            </p>
          ) : (
            sessions.map((sess) => (
            <div key={sess.id} className="py-3 flex items-center justify-between text-xs">
              <div className="flex flex-col">
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {sess.deviceName}
                </span>
                <span className="text-[11px] text-neutral-400">
                  {sess.browser} · IP: {sess.ipAddress} · {sess.lastActive}
                </span>
              </div>

              {sess.isCurrent ? (
                <div className="flex items-center gap-2">
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                    Current Device
                  </span>
                  <button
                    onClick={() => setIsLogoutConfirmOpen(true)}
                    className="text-xs text-rose-600 hover:underline dark:text-rose-400 cursor-pointer"
                  >
                    Log Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => revokeSession(sess.id)}
                  className="text-neutral-400 hover:text-rose-600"
                >
                  Revoke
                </button>
              )}
            </div>
          )))}
        </div>
      </div>

      {/* Data Backup & Restore */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
          Data Backup &amp; Disaster Recovery
        </h3>
        <p className="text-xs text-neutral-500 mb-4">
          Export your complete database snapshot. Optionally secure it with a passphrase-derived security envelope.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="password"
            value={backupPassphrase}
            onChange={(e) => setBackupPassphrase(e.target.value)}
            placeholder="Passphrase for protected export (optional)"
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />

          <button
            onClick={handleExportBackup}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 shadow-xs transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export Backup
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 shadow-xs transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            Import Backup
          </button>
        </div>
      </div>

      {/* Danger Zone: Reset to Clean Slate */}
      <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-5 dark:border-rose-900/50 dark:bg-rose-950/20">
        <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-300 flex items-center gap-2">
          <Trash2 className="h-4 w-4" /> Reset All Data (Clean Slate)
        </h3>
        <p className="text-xs text-rose-700 dark:text-rose-400 mt-1 mb-4">
          Permanently clear all accounts, transactions, budgets, cards, and investments to start fresh with zero data.
        </p>
        <button
          type="button"
          disabled={isResetting}
          onClick={() => setIsResetConfirmOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-colors cursor-pointer"
        >
          {isResetting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Resetting Stored Data...
            </>
          ) : (
            'Clear All Stored Data'
          )}
        </button>
      </div>

      {/* 2FA Setup Wizard Modal */}
      <Modal
        isOpen={is2FaSetupOpen}
        onClose={() => setIs2FaSetupOpen(false)}
        title="Set Up Two-Factor Authentication"
        subtitle="RFC 6238 Time-Based One-Time Password"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          {setupStep === 'qr' ? (
            <>
              <QrCodeCard
                secret={generatedSecret}
                email={user?.email || ''}
                qrSvg={backendQrSvg}
              />
              <button
                type="button"
                onClick={() => setSetupStep('verify')}
                className="rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs transition-colors"
              >
                I Have Scanned the QR Code
              </button>
            </>
          ) : (
            <form noValidate onSubmit={handleVerifyAndEnable2FA} className="flex flex-col gap-4 text-center">
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Enter the 6-digit code currently shown in your authenticator app to confirm setup.
              </p>

              <div className="py-2">
                <OtpInput value={verificationCode} onChange={setVerificationCode} />
              </div>

              {setupError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">{setupError}</p>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSetupStep('qr')}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  Back to QR Code
                </button>
                <button
                  type="submit"
                  disabled={setupLoading || verificationCode.length !== 6}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {setupLoading ? 'Verifying...' : 'Verify & Activate 2FA'}
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* Recovery Codes Dialog */}
      <RecoveryCodesDialog
        isOpen={isRecoveryModalOpen}
        onClose={() => setIsRecoveryModalOpen(false)}
        recoveryCodes={activeRecoveryCodes}
      />

      {/* Step-Up Verification Modal */}
      <StepUpDialog
        isOpen={isStepUpOpen}
        onClose={() => setIsStepUpOpen(false)}
        actionTitle={stepUpTitle}
        onSuccess={() => {
          if (stepUpAction) {
            stepUpAction();
            setStepUpAction(null);
          }
        }}
      />

      {/* Confirm Log Out Dialog */}
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

      {/* Confirm Log Out Everywhere Dialog */}
      <ConfirmDialog
        isOpen={isLogoutEverywhereConfirmOpen}
        onClose={() => setIsLogoutEverywhereConfirmOpen(false)}
        onConfirm={logoutEverywhere}
        title="Confirm Log Out Everywhere"
        message="Are you sure you want to log out all other active sessions and devices?"
        confirmLabel="Log Out Everywhere"
        cancelLabel="Cancel"
        isDestructive={true}
      />

      {/* Confirm Reset All Data Dialog */}
      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={async () => {
          setIsResetting(true);
          try {
            await clearAllData();
            addNotification({
              title: 'Vault Reset Complete',
              message: 'All your accounts, transactions, cards, and investments have been permanently cleared.',
              type: 'info',
            });
            setTimeout(() => {
              window.location.reload();
            }, 600);
          } catch (err) {
            console.error('Failed to reset all data:', err);
            setIsResetting(false);
          }
        }}
        title="Permanently Reset All Data?"
        message="This will permanently delete all your accounts, transactions, cards, investments, budgets, and loans from your vault. Your login credentials will remain intact, and fresh default categories will be prepared. This action CANNOT be undone."
        confirmLabel="Yes, Clear All Data"
        cancelLabel="Cancel"
        isDestructive={true}
      />

      {/* Import Backup Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Restore or Import Backup"
        subtitle="Paste JSON or enter backup envelope"
      >
        <form noValidate onSubmit={handleImportBackup} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Import Mode
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setImportMode('merge')}
                className={`py-2 px-3 rounded-lg border font-semibold ${
                  importMode === 'merge'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200'
                    : 'border-neutral-300 text-neutral-700'
                }`}
              >
                Merge (Add to existing)
              </button>
              <button
                type="button"
                onClick={() => setImportMode('replace')}
                className={`py-2 px-3 rounded-lg border font-semibold ${
                  importMode === 'replace'
                    ? 'border-rose-600 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200'
                    : 'border-neutral-300 text-neutral-700'
                }`}
              >
                Replace (Overwrite all)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Security Passphrase (if protected)
            </label>
            <input
              type="password"
              value={backupPassphrase}
              onChange={(e) => setBackupPassphrase(e.target.value)}
              placeholder="Leave empty if backup was not password-protected"
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Backup JSON Payload *
            </label>
            <textarea
              rows={6}
              value={importJsonText}
              onChange={(e) => {
                setImportJsonText(e.target.value);
                if (importError) setImportError(null);
              }}
              placeholder='Paste {"version": "1.0", ...} or {"version": "finvault_enc_v1", ...}'
              className={`w-full rounded-lg border bg-white p-2 font-mono text-xs text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${
                importError ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}
            />
            {importError && (
              <p className="text-[11px] font-medium text-rose-500 mt-1">{importError}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
            >
              Import Data
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
