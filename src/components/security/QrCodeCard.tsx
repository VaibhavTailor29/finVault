import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Copy, Check } from 'lucide-react';
import { createTotpUri } from '../../utils/totp';

interface QrCodeCardProps {
  secret: string;
  email?: string;
  issuer?: string;
  qrSvg?: string;
}

export const QrCodeCard: React.FC<QrCodeCardProps> = ({
  secret,
  email = 'user@finvault.app',
  issuer = 'FinVault',
  qrSvg,
}) => {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const otpUri = createTotpUri(secret, email, issuer);

  useEffect(() => {
    if (!secret) return;
    QRCode.toDataURL(otpUri, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        setQrDataUrl(url);
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to generate 2FA QR code:', err);
        setError('Could not generate QR code image.');
      });
  }, [otpUri, secret]);

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center rounded-xl border border-neutral-200 bg-neutral-50/60 p-6 text-center dark:border-neutral-800 dark:bg-neutral-900/60">
      {/* Real QR Code Image */}
      <div className="relative mb-4 flex h-52 w-52 items-center justify-center rounded-xl border border-neutral-200 bg-white p-2 shadow-xs dark:border-neutral-700">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="Google Authenticator QR Code"
            className="h-full w-full object-contain rounded-lg"
          />
        ) : qrSvg ? (
          <div
            dangerouslySetInnerHTML={{ __html: qrSvg }}
            className="h-full w-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
          />
        ) : error ? (
          <p className="text-xs text-rose-500 p-2">{error}</p>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <span className="text-[11px] text-neutral-400">Generating QR...</span>
          </div>
        )}
      </div>

      <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
        Scan with Google Authenticator, Aegis, Authy, or 1Password
      </p>
      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
        Can't scan? Enter the manual setup key below into your authenticator app.
      </p>

      {/* Manual Setup Key */}
      <div className="mt-4 flex w-full max-w-xs items-center justify-between gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800">
        <div className="flex flex-col text-left overflow-hidden">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-400">
            Manual Key (Base32)
          </span>
          <span className="font-mono text-xs font-semibold tracking-wider text-neutral-900 dark:text-neutral-100 select-all">
            {secret.match(/.{1,4}/g)?.join(' ') || secret}
          </span>
        </div>
        <button
          type="button"
          onClick={copySecret}
          className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors shrink-0"
          title="Copy key"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
};
