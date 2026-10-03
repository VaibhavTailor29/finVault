import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { OtpInput } from '../components/security/OtpInput';
import { apiClient } from '../api/client';
import { Lock, Mail, User as UserIcon, ArrowRight, CheckCircle2, AlertCircle, KeyRound, Sparkles } from 'lucide-react';

interface AuthPageProps {
  onSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const { login, register, verify2FA, mfaPending, mfaPendingEmail } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>('login');
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isUsingRecoveryCode, setIsUsingRecoveryCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Check URL parameters on mount for reset token
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      let token = searchParams.get('token') || searchParams.get('reset_token');
      
      // Fallback: check hash (e.g. #token=xyz)
      if (!token && window.location.hash.includes('token=')) {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        token = hashParams.get('token') || hashParams.get('reset_token');
      }

      if (token) {
        setResetToken(token);
        setMode('reset');
        apiClient.verifyResetToken(token)
          .then((res) => {
            if (res.email) setEmail(res.email);
          })
          .catch((err) => {
            setError(err.message || 'The password reset link is invalid or has expired.');
          });
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const cleanEmail = email.trim().toLowerCase();

    if (mfaPending) {
      if (twoFactorCode.length < 6) {
        setError('Please enter your complete 6-digit verification code or recovery code.');
        return;
      }
      setLoading(true);
      // 2FA Verification step
      const res = await verify2FA(twoFactorCode);
      setLoading(false);
      if (res.success) {
        onSuccess();
      } else {
        setError(res.error || 'Invalid 2FA code.');
      }
      return;
    }

    // Common Email Format Check
    const isValidEmail = (addr: string) => {
      if (!addr || !addr.includes('@')) return false;
      const parts = addr.split('@');
      return parts.length === 2 && parts[0].length > 0 && parts[1].includes('.') && parts[1].length > 2;
    };

    if (mode === 'login') {
      if (!cleanEmail) {
        setError('Please enter your email address.');
        return;
      }
      if (!isValidEmail(cleanEmail)) {
        setError('Please enter a valid email address (e.g. name@example.com).');
        return;
      }
      if (!password) {
        setError('Please enter your password.');
        return;
      }

      setLoading(true);
      const res = await login(cleanEmail, password);
      setLoading(false);
      if (res.success) {
        if (!res.requires2FA) {
          onSuccess();
        }
      } else {
        setError(res.error || 'Login failed. Please check your credentials.');
      }
    } else if (mode === 'signup') {
      const cleanName = name.trim();
      if (!cleanName || cleanName.length < 2) {
        setError('Please enter your full name (minimum 2 characters).');
        return;
      }
      if (!cleanEmail || !isValidEmail(cleanEmail)) {
        setError('Please enter a valid email address (e.g. name@example.com).');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }

      setLoading(true);
      const res = await register(cleanName, cleanEmail, password);
      setLoading(false);
      if (res.success) {
        onSuccess();
      } else {
        setError(res.error || 'Registration failed.');
      }
    } else if (mode === 'forgot') {
      if (!cleanEmail || !isValidEmail(cleanEmail)) {
        setError('Please enter a valid email address to receive your password reset link.');
        return;
      }

      setLoading(true);
      try {
        const res = await apiClient.forgotPassword(cleanEmail);
        setLoading(false);
        setInfoMessage(res.message);
      } catch (err: any) {
        setLoading(false);
        setError(err?.message || 'Failed to dispatch password reset request.');
      }
    } else if (mode === 'reset') {
      if (!resetToken) {
        setError('Missing password reset token. Please request a new reset link.');
        return;
      }
      if (password.length < 8) {
        setError('New password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please ensure both passwords are identical.');
        return;
      }

      setLoading(true);
      try {
        const res = await apiClient.resetPassword(resetToken, password);
        setLoading(false);
        setInfoMessage(res.message || 'Password has been reset successfully!');
        setPassword('');
        setConfirmPassword('');
        setResetToken('');
        // Clean URL query string
        if (typeof window !== 'undefined' && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        setMode('login');
      } catch (err: any) {
        setLoading(false);
        setError(err?.message || 'Failed to reset password. The link may have expired.');
      }
    }
  };

  const handleUseSimulatedLink = (url: string) => {
    try {
      const urlObj = new URL(url);
      const token = urlObj.searchParams.get('token');
      if (token) {
        setResetToken(token);
        setMode('reset');
        setError(null);
        setInfoMessage('Loaded token from local simulated email. Please set your new password below.');
      }
    } catch {
      window.location.href = url;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4 dark:bg-neutral-950 font-sans">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md mb-3">
            <span className="text-xl font-bold">FV</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            {mfaPending
              ? 'Two-Factor Authentication'
              : mode === 'login'
              ? 'Sign in to FinVault'
              : mode === 'signup'
              ? 'Create your FinVault account'
              : mode === 'forgot'
              ? 'Reset your password'
              : 'Set new password'}
          </h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {mfaPending
              ? `Enter the code for ${mfaPendingEmail || 'your account'}`
              : mode === 'forgot'
              ? 'Enter your registered email address to receive a secure reset link'
              : mode === 'reset'
              ? 'Choose a strong new password for your account'
              : 'Smart personal finance & expense tracker with confidential security'}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-rose-50 p-3.5 text-xs text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>

            {/* Smart Contextual Action Links */}
            {error.toLowerCase().includes('no account found') && (
              <div className="mt-2.5 pt-2 border-t border-rose-200/60 dark:border-rose-900/50">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                    setInfoMessage(null);
                  }}
                  className="flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline"
                >
                  <span>Create a new FinVault account with this email</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}

            {(error.toLowerCase().includes('already exists') || error.toLowerCase().includes('sign in instead')) && (
              <div className="mt-2.5 pt-2 border-t border-rose-200/60 dark:border-rose-900/50">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setInfoMessage(null);
                  }}
                  className="flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline"
                >
                  <span>Sign in with this email instead</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}

            {error.toLowerCase().includes('incorrect password') && (
              <div className="mt-2.5 pt-2 border-t border-rose-200/60 dark:border-rose-900/50">
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError(null);
                    setInfoMessage(null);
                  }}
                  className="flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline"
                >
                  <span>Forgot your password? Send reset link to this email</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {infoMessage && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{infoMessage}</p>
            </div>
          </div>
        )}



        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mfaPending ? (
            /* 2FA MFA Challenge */
            <div className="flex flex-col gap-4 text-center">
              {!isUsingRecoveryCode ? (
                <>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300">
                    Open your authenticator app (Google Authenticator, Aegis) and enter the 6-digit code.
                  </p>
                  <div className="py-2">
                    <OtpInput value={twoFactorCode} onChange={setTwoFactorCode} />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUsingRecoveryCode(true);
                      setTwoFactorCode('');
                      setError(null);
                    }}
                    className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Lost your device? Use an 8-character recovery code
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300">
                    Enter one of your single-use emergency recovery codes (e.g. ABCD-1234).
                  </p>
                  <input
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.toUpperCase())}
                    placeholder="ABCD-1234"
                    maxLength={9}
                    className="h-11 rounded-lg border border-neutral-300 px-3 text-center font-mono text-base font-semibold uppercase tracking-wider focus:border-indigo-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsUsingRecoveryCode(false);
                      setTwoFactorCode('');
                      setError(null);
                    }}
                    className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Back to 6-digit authenticator code
                  </button>
                </>
              )}

              <button
                type="submit"
                disabled={loading || twoFactorCode.length < 6}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-xs"
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : mode === 'reset' ? (
            /* Reset Password Form */
            <>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-xs text-neutral-900 focus:border-indigo-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-xs text-neutral-900 focus:border-indigo-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-xs"
              >
                {loading ? 'Updating Password...' : 'Save New Password'}
                <ArrowRight className="h-4 w-4" />
              </button>

              <div className="mt-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setInfoMessage(null);
                  }}
                  className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Back to Sign in
                </button>
              </div>
            </>
          ) : (
            /* Standard Login / Signup / Forgot Form */
            <>
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-xs text-neutral-900 focus:border-indigo-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-xs text-neutral-900 focus:border-indigo-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Password
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setError(null);
                          setInfoMessage(null);
                        }}
                        className="text-[11px] text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-xs text-neutral-900 focus:border-indigo-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                    />
                  </div>
                  {mode === 'signup' && (
                    <p className="mt-1 text-[11px] text-neutral-400">
                      Must be at least 8 characters
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-xs"
              >
                {loading
                  ? 'Processing...'
                  : mode === 'login'
                  ? 'Sign In'
                  : mode === 'signup'
                  ? 'Create Free Account'
                  : 'Send Reset Link'}
                <ArrowRight className="h-4 w-4" />
              </button>

              <div className="mt-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
                {mode === 'login' ? (
                  <>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signup');
                        setError(null);
                        setInfoMessage(null);
                      }}
                      className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      Sign up
                    </button>
                  </>
                ) : mode === 'signup' ? (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setError(null);
                        setInfoMessage(null);
                      }}
                      className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    Remembered your password?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setError(null);
                        setInfoMessage(null);
                      }}
                      className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

