import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { OtpInput } from './OtpInput';
import { useAuthStore } from '../../store/useAuthStore';
import { ShieldAlert } from 'lucide-react';

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
  const { verify2FA, user } = useAuthStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If 2FA is not enabled on this account, skip step-up
  if (user && !user.twoFactorEnabled) {
    onSuccess();
    return null;
  }

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (code.length < 6) {
      setError('Please enter a valid 6-digit code or recovery code.');
      return;
    }
    setError(null);
    setLoading(true);

    const res = await verify2FA(code);
    setLoading(false);

    if (res.success) {
      setCode('');
      onSuccess();
      onClose();
    } else {
      setError(res.error || 'Verification failed. Try again.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Security Verification Required"
      subtitle={`Please verify your identity before: ${actionTitle}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleVerify} className="flex flex-col gap-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
          <ShieldAlert className="h-6 w-6" />
        </div>

        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          Enter the 6-digit code from your authenticator app or an unused 8-character recovery code.
        </p>

        <div className="py-2">
          <OtpInput value={code} onChange={setCode} />
        </div>

        {error && (
          <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-xs"
          >
            {loading ? 'Verifying...' : 'Authorize Action'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
