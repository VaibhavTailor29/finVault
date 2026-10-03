import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Copy, Download, Check, AlertTriangle, ShieldCheck } from 'lucide-react';

interface RecoveryCodesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  recoveryCodes: string[];
}

export const RecoveryCodesDialog: React.FC<RecoveryCodesDialogProps> = ({
  isOpen,
  onClose,
  recoveryCodes,
}) => {
  const [copied, setCopied] = useState(false);

  const copyAll = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadText = () => {
    const content = `FINVAULT PERSONAL FINANCE - 2FA RECOVERY CODES\nGenerated: ${new Date().toISOString()}\n\nEach code can only be used once.\n\n${recoveryCodes
      .map((c, i) => `${(i + 1).toString().padStart(2, '0')}. ${c}`)
      .join('\n')}\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finvault-recovery-codes-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Save Your Recovery Codes"
      subtitle="Keep these in a password manager or safe physical location."
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            These codes will <strong>never be shown again</strong>. If you lose access to your authenticator app, these are the ONLY way to regain access to your financial records.
          </p>
        </div>

        {/* 10 codes in a 2-column grid */}
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 font-mono text-xs dark:border-neutral-800 dark:bg-neutral-900">
          {recoveryCodes.map((code, index) => (
            <div
              key={index}
              className="flex items-center gap-2 rounded bg-white px-2.5 py-1.5 border border-neutral-100 dark:border-neutral-800 dark:bg-neutral-800/80"
            >
              <span className="text-neutral-400 select-none text-[10px]">
                {(index + 1).toString().padStart(2, '0')}
              </span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                {code}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={copyAll}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors shadow-xs"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? 'Copied All' : 'Copy All'}
          </button>
          <button
            type="button"
            onClick={downloadText}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 transition-colors shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Download .txt
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-lg bg-neutral-900 py-2.5 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 transition-colors shadow-xs"
        >
          I Have Saved These Codes
        </button>
      </div>
    </Modal>
  );
};
