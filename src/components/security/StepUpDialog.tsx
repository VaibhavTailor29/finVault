import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { OtpInput } from './OtpInput';
import { useAuthStore } from '../../store/useAuthStore';
import { ShieldAlert, KeyRound } from 'lucide-react';

interface StepUpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionTitle: string;
}

export const StepUpDialog: React.FC<StepUpDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  actionTitle,
}) => {
  const { verifyStepUp, verify2FA, user } = useAuthStore();
  const [code, setCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If 2FA is not enabled on this account, skip step-up
  if (user && !user.twoFactorEnabled) {
    onSuccess();
    return null;
  }

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = code.trim();
    if (!cleanCode || (useRecoveryCode ? cleanCode.length < 8 : cleanCode.length < 6)) {
      setError(useRecoveryCode ? 'Please enter a valid recovery code (e.g. ABCD-1234).' : 'Please enter a valid 6-digit code.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const verifier = verifyStepUp || verify2FA;
      const res = await verifier(cleanCode);
      setLoading(false);

      if (res.success) {
        setCode('');
        setUseRecoveryCode(false);
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Verification failed. Try again.');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Verification failed. Try again.');
    }
  };

  const handleClose = () => {
    setCode('');
    setError(null);
    setUseRecoveryCode(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Security Verification Required"
      subtitle={`Please verify your identity before: ${actionTitle}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleVerify} className="flex flex-col gap-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
          <ShieldAlert className="h-6 w-6" />
        </div>

        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          {useRecoveryCode
            ? 'Enter an unused 8-character recovery code.'
            : 'Enter the 6-digit code from your authenticator app.'}
        </p>

        <div className="py-2">
          {useRecoveryCode ? (
            <div className="relative">
              <input
                type="text"
                autoFocus
                placeholder="ABCD-1234"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full text-center tracking-widest uppercase font-mono text-lg py-2.5 px-4 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          ) : (
            <OtpInput value={code} onChange={setCode} />
          )}
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              setCode('');
              setError(null);
              setUseRecoveryCode(!useRecoveryCode);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
          >
            <KeyRound className="h-3.5 w-3.5" />
            {useRecoveryCode ? 'Use Authenticator App 6-digit code' : 'Lost access? Use recovery code'}
          </button>
        </div>

        {error && (
          <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || (useRecoveryCode ? code.trim().length < 8 : code.length < 6)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-xs"
          >
            {loading ? 'Verifying...' : 'Authorize Action'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
