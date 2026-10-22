import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { OtpInput } from '../components/security/OtpInput';
import { apiClient } from '../api/client';
import {
  Lock, Mail, User as UserIcon, ArrowRight, CheckCircle2, AlertCircle,
  KeyRound, Sparkles, Eye, EyeOff, ShieldCheck, TrendingUp, Vault,
  Check, ArrowUpRight, Coins, Layers, Laptop
} from 'lucide-react';

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  // Password strength calculation for signup
  const calculatePasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: '', color: 'bg-neutral-200 dark:bg-neutral-800' };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, label: 'Weak', color: 'bg-rose-500' };
      case 2:
        return { score: 2, label: 'Fair', color: 'bg-amber-500' };
      case 3:
        return { score: 3, label: 'Good', color: 'bg-indigo-500' };
      case 4:
        return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
      default:
        return { score: 0, label: '', color: 'bg-neutral-200 dark:bg-neutral-800' };
    }
  };

  const passwordStrength = calculatePasswordStrength(password);

  // Live username guidelines validation for registration
  const usernameRules = useMemo(() => {
    const trimmed = name.trim().toLowerCase();
    const length = trimmed.length >= 3 && trimmed.length <= 20;
    const start = /^[a-z0-9]/.test(trimmed);
    const chars = trimmed.length > 0 && /^[a-z0-9_.-]+$/.test(trimmed);
    const noSpaces = name.length > 0 && !/\s/.test(name);
    return {
      length,
      start,
      chars,
      noSpaces,
      isValid: length && start && chars && noSpaces,
    };
  }, [name]);

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
      const res = await verify2FA(twoFactorCode);
      setLoading(false);
      if (res.success) {
        onSuccess();
      } else {
        setError(res.error || 'Invalid 2FA code.');
      }
      return;
    }

    const isValidEmail = (addr: string) => {
      if (!addr || !addr.includes('@')) return false;
      const parts = addr.split('@');
      return parts.length === 2 && parts[0].length > 0 && parts[1].includes('.') && parts[1].length > 2;
    };

    if (mode === 'login') {
      if (!cleanEmail) {
        setError('Please enter your username or email address.');
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
      const cleanName = name.trim().toLowerCase();
      if (!cleanName || cleanName.length < 3) {
        setError('Username must be at least 3 characters long.');
        return;
      }
      if (cleanName.length > 20) {
        setError('Username must be at most 20 characters long.');
        return;
      }
      if (!/^[a-z0-9]/.test(cleanName)) {
        setError('Username must start with a letter or number.');
        return;
      }
      if (!/^[a-z0-9_.-]+$/.test(cleanName)) {
        setError('Username can only contain letters, numbers, underscores (_), dots (.), and hyphens (-). Spaces are not allowed.');
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

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-neutral-950 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Dynamic Background Effects: Ambient Mesh Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Violet top glow */}
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-indigo-600/25 via-violet-600/20 to-transparent blur-[120px] transform-gpu" />
        {/* Emerald bottom glow */}
        <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-gradient-to-tl from-emerald-600/15 via-teal-600/15 to-transparent blur-[140px] transform-gpu" />
        {/* Indigo center glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[130px] transform-gpu" />
        
        {/* Subtle geometric dot grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.07]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Main Dual-Pane Container */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* ========================================================= */}
          {/* LEFT COLUMN: HERO SHOWCASE (Visible on Desktop/Tablet)    */}
          {/* ========================================================= */}
          <div className="hidden lg:flex lg:col-span-6 flex-col justify-between py-6">
            <div className="space-y-6">
              {/* Brand Logo & Tag */}
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
                  <Vault className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                    FinVault <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">PRO</span>
                  </span>
                  <p className="text-[11px] text-neutral-400 font-medium">Confidential Wealth &amp; Expense Vault</p>
                </div>
              </div>

              {/* Main Headline */}
              <div className="space-y-3">
                <h1 className="text-4xl font-extrabold tracking-tight text-white leading-tight">
                  Sovereign wealth tracking,{' '}
                  <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-emerald-400 bg-clip-text text-transparent">
                    zero compromises.
                  </span>
                </h1>
                <p className="text-sm text-neutral-400 leading-relaxed max-w-md">
                  Keep your entire financial life in one place: multi-broker investment sync, automated tax accounting, debt ledgers, and bank-grade privacy.
                </p>
              </div>

              {/* Showcase Live Preview Card (Glassmorphic) */}
              <div className="relative rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl shadow-2xl space-y-4 max-w-md">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-semibold text-neutral-300">Live Consolidated Portfolio</span>
                  </div>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-white/10 text-neutral-300">
                    Secure Vault
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-2xl font-bold font-mono tracking-tight text-white">
                      $284,920<span className="text-neutral-400 text-lg">.50</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium mt-0.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span>+18.4% YTD return</span>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-neutral-400">
                    <div>Realized Returns</div>
                    <div className="font-mono text-white font-semibold">+$34,120.00</div>
                  </div>
                </div>

                {/* Asset Allocation Mini Visualizer */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[10px] text-neutral-400 font-medium">
                    <span>Equities 58%</span>
                    <span>Mutual Funds 22%</span>
                    <span>Gold / SGB 12%</span>
                    <span>Cash 8%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden flex">
                    <div className="h-full bg-indigo-500 w-[58%]" />
                    <div className="h-full bg-violet-400 w-[22%]" />
                    <div className="h-full bg-amber-400 w-[12%]" />
                    <div className="h-full bg-emerald-400 w-[8%]" />
                  </div>
                </div>
              </div>

              {/* Three Trust Badges */}
              <div className="grid grid-cols-3 gap-3 pt-2 max-w-md">
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 backdrop-blur-md">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 mb-1.5" />
                  <div className="text-xs font-semibold text-white">Bank-Grade Privacy</div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">Protected financial data</div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5 backdrop-blur-md">
                  <Coins className="h-4 w-4 text-indigo-400 mb-1.5" />
                  <div className="text-xs font-semibold text-white">Free Sync</div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">Zerodha, Groww, Upstox</div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5 backdrop-blur-md">
                  <Laptop className="h-4 w-4 text-amber-400 mb-1.5" />
                  <div className="text-xs font-semibold text-white">Self Hosted</div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">Your data stays yours</div>
                </div>
              </div>
            </div>

            {/* Bottom footnote */}
            <div className="text-[11px] text-neutral-500 pt-6">
              Secured with Multi-Factor Protection &bull; Strict Local Privacy
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: INTERACTIVE AUTH CARD                       */}
          {/* ========================================================= */}
          <div className="w-full lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-900/80 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl shadow-black/60 relative overflow-hidden ring-1 ring-white/5">
              
              {/* Subtle top card glow line */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-80" />

              {/* Mobile Brand Header (only visible on small screens) */}
              <div className="lg:hidden flex items-center gap-2.5 mb-6 justify-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
                  <Vault className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <span className="text-lg font-black tracking-tight text-white">FinVault</span>
                  <p className="text-[10px] text-neutral-400">Personal Finance &amp; Wealth Vault</p>
                </div>
              </div>

              {/* Mode Toggle Switcher (Sign In vs Create Account) */}
              {!mfaPending && mode !== 'reset' && mode !== 'forgot' && (
                <div className="flex p-1 rounded-2xl bg-neutral-950/80 border border-white/5 mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                      setInfoMessage(null);
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      mode === 'login'
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setError(null);
                      setInfoMessage(null);
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      mode === 'signup'
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              )}

              {/* Title & Subtitle */}
              <div className="mb-5 text-left">
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  {mfaPending ? (
                    <>
                      <ShieldCheck className="h-5 w-5 text-emerald-400" />
                      Two-Factor Authentication
                    </>
                  ) : mode === 'login' ? (
                    'Welcome back'
                  ) : mode === 'signup' ? (
                    'Get started with FinVault'
                  ) : mode === 'forgot' ? (
                    'Reset your password'
                  ) : (
                    'Set new password'
                  )}
                </h2>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  {mfaPending
                    ? `Enter the authenticator code for ${mfaPendingEmail || 'your account'}`
                    : mode === 'login'
                    ? 'Enter your credentials to access your confidential finances'
                    : mode === 'signup'
                    ? 'Start tracking investments, net worth, and expenses in seconds'
                    : mode === 'forgot'
                    ? 'Enter your registered email to receive a password reset link'
                    : 'Choose a strong new password for your FinVault account'}
                </p>
              </div>

              {/* Alerts & Errors */}
              {error && (
                <div className="mb-4 rounded-xl bg-rose-950/40 border border-rose-800/60 p-3.5 text-xs text-rose-300">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                    <div className="flex-1 font-medium leading-relaxed">{error}</div>
                  </div>

                  {/* Smart Contextual Switchers */}
                  {error.toLowerCase().includes('no account found') && (
                    <div className="mt-2.5 pt-2 border-t border-rose-800/40">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('signup');
                          setError(null);
                        }}
                        className="flex items-center gap-1 font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                      >
                        <span>Create a new FinVault account with this email</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {(error.toLowerCase().includes('already exists') || error.toLowerCase().includes('already taken') || error.toLowerCase().includes('sign in instead')) && (
                    <div className="mt-2.5 pt-2 border-t border-rose-800/40">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login');
                          setError(null);
                        }}
                        className="flex items-center gap-1 font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                      >
                        <span>Sign in with your account instead</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {error.toLowerCase().includes('incorrect password') && (
                    <div className="mt-2.5 pt-2 border-t border-rose-800/40">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setError(null);
                        }}
                        className="flex items-center gap-1 font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                      >
                        <span>Forgot your password? Send reset link</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {infoMessage && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 p-3.5 text-xs text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  <div className="flex-1 leading-relaxed">
                    <p>{infoMessage}</p>
                  </div>
                </div>
              )}

              {/* Form Body */}
              <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
                {mfaPending ? (
                  /* 2FA MFA Challenge */
                  <div className="flex flex-col gap-4 text-center">
                    {!isUsingRecoveryCode ? (
                      <>
                        <div className="p-3 rounded-2xl bg-neutral-950/60 border border-white/5 py-4">
                          <OtpInput value={twoFactorCode} onChange={setTwoFactorCode} />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsUsingRecoveryCode(true);
                            setTwoFactorCode('');
                            setError(null);
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                        >
                          Lost your device? Use an 8-character recovery code
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-neutral-400">
                          Enter one of your single-use emergency recovery codes (e.g. ABCD-1234).
                        </p>
                        <input
                          type="text"
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value.toUpperCase())}
                          placeholder="ABCD-1234"
                          maxLength={9}
                          className="h-12 rounded-xl border border-neutral-700 bg-neutral-950 px-3 text-center font-mono text-base font-bold uppercase tracking-wider text-white focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsUsingRecoveryCode(false);
                            setTwoFactorCode('');
                            setError(null);
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                        >
                          Back to 6-digit authenticator code
                        </button>
                      </>
                    )}

                    <button
                      type="submit"
                      disabled={loading || twoFactorCode.length < 6}
                      className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-xs font-semibold text-white hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
                    >
                      {loading ? 'Verifying...' : 'Verify & Enter Vault'}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : mode === 'reset' ? (
                  /* Reset Password Form */
                  <>
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                        New Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="At least 8 characters"
                          className="w-full rounded-xl border border-neutral-700 bg-neutral-950/70 py-2.5 pl-10 pr-10 text-xs text-white placeholder:text-neutral-500 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-neutral-400 hover:text-white cursor-pointer"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repeat new password"
                          className="w-full rounded-xl border border-neutral-700 bg-neutral-950/70 py-2.5 pl-10 pr-10 text-xs text-white placeholder:text-neutral-500 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-2.5 text-neutral-400 hover:text-white cursor-pointer"
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-xs font-semibold text-white hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
                    >
                      {loading ? 'Updating Password...' : 'Save New Password'}
                      <ArrowRight className="h-4 w-4" />
                    </button>

                    <div className="mt-2 text-center text-xs text-neutral-400">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login');
                          setError(null);
                        }}
                        className="text-indigo-400 hover:underline cursor-pointer"
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
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-neutral-300">
                            Username
                          </label>
                          <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Permanent &amp; Unique
                          </span>
                        </div>
                        <div className="relative">
                          <UserIcon className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s/g, ''))}
                            placeholder="e.g. alex_stone, user123"
                            autoComplete="username"
                            className="w-full rounded-xl border border-neutral-700 bg-neutral-950/70 py-2.5 pl-10 pr-3 text-xs text-white placeholder:text-neutral-500 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>

                        {/* Interactive Username Guidelines */}
                        <div className="mt-2 rounded-xl bg-neutral-900/90 border border-neutral-800 p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                              Username Guidelines
                            </span>
                            {usernameRules.isValid && (
                              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                                <Check className="h-3 w-3" /> Valid format
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                            <div className={`flex items-center gap-1.5 transition-colors ${usernameRules.length ? 'text-emerald-400 font-medium' : 'text-neutral-400'}`}>
                              <Check className={`h-3 w-3 shrink-0 ${usernameRules.length ? 'text-emerald-400' : 'text-neutral-600'}`} />
                              <span>3 to 20 characters</span>
                            </div>
                            <div className={`flex items-center gap-1.5 transition-colors ${usernameRules.start ? 'text-emerald-400 font-medium' : 'text-neutral-400'}`}>
                              <Check className={`h-3 w-3 shrink-0 ${usernameRules.start ? 'text-emerald-400' : 'text-neutral-600'}`} />
                              <span>Starts with a–z or 0–9</span>
                            </div>
                            <div className={`flex items-center gap-1.5 transition-colors ${usernameRules.chars ? 'text-emerald-400 font-medium' : 'text-neutral-400'}`}>
                              <Check className={`h-3 w-3 shrink-0 ${usernameRules.chars ? 'text-emerald-400' : 'text-neutral-600'}`} />
                              <span>Letters, numbers, _ . -</span>
                            </div>
                            <div className={`flex items-center gap-1.5 transition-colors ${usernameRules.noSpaces ? 'text-emerald-400 font-medium' : 'text-neutral-400'}`}>
                              <Check className={`h-3 w-3 shrink-0 ${usernameRules.noSpaces ? 'text-emerald-400' : 'text-neutral-600'}`} />
                              <span>No spaces or symbols</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-neutral-300">
                          {mode === 'login' ? 'Username or Email Address' : 'Email Address'}
                        </label>
                        {mode === 'signup' && (
                          <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Permanent
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        {mode === 'login' ? (
                          <UserIcon className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
                        ) : (
                          <Mail className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
                        )}
                        <input
                          type={mode === 'login' ? 'text' : 'email'}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={mode === 'login' ? 'Enter username or email address' : 'name@example.com'}
                          autoComplete={mode === 'login' ? 'username' : 'email'}
                          className="w-full rounded-xl border border-neutral-700 bg-neutral-950/70 py-2.5 pl-10 pr-3 text-xs text-white placeholder:text-neutral-500 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                      {mode === 'signup' && (
                        <p className="text-[10px] text-neutral-400 mt-1">
                          Email cannot be changed once registered.
                        </p>
                      )}
                    </div>

                    {mode !== 'forgot' && (
                      <div>
                        <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                          Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full rounded-xl border border-neutral-700 bg-neutral-950/70 py-2.5 pl-10 pr-10 text-xs text-white placeholder:text-neutral-500 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-neutral-400 hover:text-white cursor-pointer"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>

                        {mode === 'login' && (
                          <div className="flex justify-end mt-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setMode('forgot');
                                setError(null);
                                setInfoMessage(null);
                              }}
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
                            >
                              Forgot password?
                            </button>
                          </div>
                        )}

                        {/* Password strength bar for registration */}
                        {mode === 'signup' && (
                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-neutral-400">Password strength</span>
                              <span className={`font-semibold ${
                                passwordStrength.score >= 3 ? 'text-emerald-400' : passwordStrength.score === 2 ? 'text-amber-400' : 'text-neutral-400'
                              }`}>
                                {passwordStrength.label || 'Min 8 chars'}
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5 h-1">
                              {[1, 2, 3, 4].map((step) => (
                                <div
                                  key={step}
                                  className={`h-full rounded-full transition-colors ${
                                    passwordStrength.score >= step
                                      ? passwordStrength.color
                                      : 'bg-neutral-800'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Submit CTA Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 py-3 text-xs font-semibold text-white hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 transition-all shadow-lg shadow-indigo-600/25 hover:shadow-indigo-500/40 cursor-pointer active:scale-[0.99]"
                    >
                      {loading ? (
                        'Processing...'
                      ) : mode === 'login' ? (
                        <>
                          <span>Sign In to Vault</span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      ) : mode === 'signup' ? (
                        <>
                          <span>Create Free Account</span>
                          <Sparkles className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          <span>Send Reset Link</span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>

                    {/* Footer Switcher */}
                    <div className="mt-3 text-center text-xs text-neutral-400">
                      {mode === 'login' ? (
                        <p>
                          New to FinVault?{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setMode('signup');
                              setError(null);
                              setInfoMessage(null);
                            }}
                            className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
                          >
                            Create an account
                          </button>
                        </p>
                      ) : mode === 'signup' ? (
                        <p>
                          Already have an account?{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setMode('login');
                              setError(null);
                              setInfoMessage(null);
                            }}
                            className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
                          >
                            Sign in
                          </button>
                        </p>
                      ) : (
                        <p>
                          Remember your password?{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setMode('login');
                              setError(null);
                              setInfoMessage(null);
                            }}
                            className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
                          >
                            Back to Sign in
                          </button>
                        </p>
                      )}
                    </div>
                  </>
                )}
              </form>

              {/* Bottom Security Footer */}
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Private &amp; Confidential</span>
                </span>
                <span className="text-neutral-400">End-to-End Encrypted</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
