import { create } from 'zustand';
import { User, UserSession } from '../types';
import { apiClient } from '../api/client';
import { verifyTOTP } from '../utils/totp';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  mfaPending: boolean;
  mfaPendingEmail: string | null;
  mfaToken: string | null;
  totpSecret: string | null;
  recoveryCodes: string[];
  lastUsedTimeStep: number;
  sessions: UserSession[];
  
  // Actions
  login: (email: string, password: string) => Promise<{ success: boolean; requires2FA?: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  verify2FA: (code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  enable2FA: (secret: string, recoveryCodes: string[]) => void;
  disable2FA: () => void;
  regenerateRecoveryCodes: (codes: string[]) => void;
  revokeSession: (sessionId: string) => void;
  logoutEverywhere: () => void;
  updateProfile: (name: string, email: string) => void;
  initSessions: () => void;
}

function toFrontendUser(u: any): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    twoFactorEnabled: Boolean(u.twoFactorEnabled ?? u.two_factor_enabled),
    currency: u.currency || 'INR',
    theme: u.theme || 'system',
    privacyMode: Boolean(u.privacyMode ?? u.privacy_mode),
    createdAt: u.createdAt || u.created_at || new Date().toISOString(),
  };
}

const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('finvault_token');
};

const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('finvault_user');
    return raw ? toFrontendUser(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

function detectClientDeviceInfo(): { deviceName: string; browser: string } {
  if (typeof window === 'undefined') {
    return { deviceName: 'Web Browser', browser: 'Browser' };
  }

  const ua = navigator.userAgent;
  let deviceName = 'Desktop Device';
  if (/Windows/i.test(ua)) deviceName = 'Windows PC';
  else if (/Macintosh|Mac OS X/i.test(ua)) deviceName = 'MacBook / macOS Device';
  else if (/Android/i.test(ua)) deviceName = 'Android Mobile';
  else if (/iPhone|iPad|iPod/i.test(ua)) deviceName = 'Apple iOS Device';
  else if (/Linux/i.test(ua)) deviceName = 'Linux Workstation';

  let browser = 'Web Browser';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Google Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Apple Safari';
  else if (/Opera|OPR\//i.test(ua)) browser = 'Opera';

  return { deviceName, browser };
}

function getStoredSessions(): UserSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('finvault_sessions');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [];
}

function ensureCurrentSession(existingSessions: UserSession[]): UserSession[] {
  if (typeof window === 'undefined') return existingSessions;
  
  let currentSessionId = localStorage.getItem('finvault_current_session_id');
  if (!currentSessionId) {
    currentSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    localStorage.setItem('finvault_current_session_id', currentSessionId);
  }

  const { deviceName, browser } = detectClientDeviceInfo();

  const currentSession: UserSession = {
    id: currentSessionId,
    deviceName,
    browser,
    ipAddress: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '127.0.0.1 (Local)' : window.location.hostname,
    isCurrent: true,
    lastActive: 'Active now',
  };

  const otherSessions = existingSessions
    .filter((s) => s.id !== currentSessionId)
    .map((s) => ({ ...s, isCurrent: false }));

  const updated = [currentSession, ...otherSessions];
  try {
    localStorage.setItem('finvault_sessions', JSON.stringify(updated));
  } catch {}
  return updated;
}

const initialToken = getStoredToken();
const initialUser = getStoredUser();

// 2FA bypass prevention:
// If the user has 2FA enabled, a previously stored access token could let them
// skip the 2FA challenge on page reload. We force a fresh login unless the
// current session was already verified through the 2FA challenge this session.
function computeInitialAuthState(): { token: string | null; user: User | null; isAuthenticated: boolean; sessions: UserSession[] } {
  if (initialToken && initialUser) {
    const alreadyVerified2FA = typeof window !== 'undefined'
      ? localStorage.getItem('finvault_2fa_session_verified') === 'true'
      : false;
    if (initialUser.twoFactorEnabled && !alreadyVerified2FA) {
      // 2FA-enabled user without a verified 2FA session — clear stale token,
      // forcing a fresh login and 2FA challenge.
      if (typeof window !== 'undefined') {
        localStorage.removeItem('finvault_token');
        localStorage.removeItem('finvault_user');
        localStorage.removeItem('finvault_sessions');
        localStorage.removeItem('finvault_current_session_id');
      }
      return { token: null, user: null, isAuthenticated: false, sessions: [] };
    }
    return {
      token: initialToken,
      user: initialUser,
      isAuthenticated: true,
      sessions: ensureCurrentSession(getStoredSessions()),
    };
  }
  return { token: null, user: null, isAuthenticated: false, sessions: [] };
}

const { token: bootToken, user: bootUser, isAuthenticated: bootAuth, sessions: bootSessions } = computeInitialAuthState();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: bootUser,
  token: bootToken,
  isAuthenticated: bootAuth,
  mfaPending: false,
  mfaPendingEmail: null,
  mfaToken: null,
  totpSecret: null,
  recoveryCodes: [],
  lastUsedTimeStep: 0,
  sessions: bootSessions,

  login: async (email, password) => {
    try {
      const res = await apiClient.login(email.trim(), password);
      
      if (res.two_factor_required) {
        set({
          mfaPending: true,
          mfaPendingEmail: email.trim(),
          mfaToken: res.mfa_token,
        });
        return { success: true, requires2FA: true };
      }

      if (res.access_token && res.user) {
        const user = toFrontendUser(res.user);
        if (typeof window !== 'undefined') {
          localStorage.setItem('finvault_token', res.access_token);
          localStorage.setItem('finvault_user', JSON.stringify(user));
        }
        set({
          token: res.access_token,
          user,
          isAuthenticated: true,
          mfaPending: false,
          mfaPendingEmail: null,
          mfaToken: null,
          sessions: ensureCurrentSession(getStoredSessions()),
        });
        return { success: true, requires2FA: false };
      }

      return { success: false, error: 'Unexpected login response.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed.' };
    }
  },

  register: async (name, email, password) => {
    try {
      const res = await apiClient.register(name.trim(), email.trim(), password);
      if (res.access_token && res.user) {
        const user = toFrontendUser(res.user);
        if (typeof window !== 'undefined') {
          localStorage.setItem('finvault_token', res.access_token);
          localStorage.setItem('finvault_user', JSON.stringify(user));
        }
        set({
          token: res.access_token,
          user,
          isAuthenticated: true,
          mfaPending: false,
          mfaPendingEmail: null,
          mfaToken: null,
          sessions: ensureCurrentSession(getStoredSessions()),
        });
        return { success: true };
      }
      return { success: false, error: 'Registration failed.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration failed.' };
    }
  },

  verify2FA: async (code) => {
    const { mfaToken } = get();
    if (!mfaToken) {
      return { success: false, error: 'No pending 2FA authentication session.' };
    }

    try {
      const res = await apiClient.verify2FALogin(mfaToken, code.trim());
      if (res.access_token) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('finvault_token', res.access_token);
          localStorage.setItem('finvault_2fa_session_verified', 'true');
        }
        const me = await apiClient.getMe();
        const user = toFrontendUser(me);
        if (typeof window !== 'undefined') {
          localStorage.setItem('finvault_user', JSON.stringify(user));
        }
        set({
          token: res.access_token,
          user,
          isAuthenticated: true,
          mfaPending: false,
          mfaPendingEmail: null,
          mfaToken: null,
          sessions: ensureCurrentSession(getStoredSessions()),
        });
        return { success: true };
      }
      return { success: false, error: 'Invalid 2FA code.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Invalid 2FA code.' };
    }
  },

  logout: async () => {
    try {
      await apiClient.logout();
    } catch {}

    if (typeof window !== 'undefined') {
      localStorage.removeItem('finvault_token');
      localStorage.removeItem('finvault_user');
      localStorage.removeItem('finvault_finance_store_v3');
      localStorage.removeItem('finvault_sessions');
      localStorage.removeItem('finvault_current_session_id');
      localStorage.removeItem('finvault_2fa_session_verified');
    }

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      mfaPending: false,
      mfaPendingEmail: null,
      mfaToken: null,
      sessions: [],
    });
  },

  enable2FA: (secret, codes) => {
    set((state) => {
      const updatedUser = state.user ? { ...state.user, twoFactorEnabled: true } : null;
      if (typeof window !== 'undefined' && updatedUser) {
        localStorage.setItem('finvault_user', JSON.stringify(updatedUser));
        localStorage.setItem('finvault_2fa_session_verified', 'true');
      }
      return {
        totpSecret: secret,
        recoveryCodes: codes,
        user: updatedUser,
      };
    });
  },

  disable2FA: () => {
    set((state) => {
      const updatedUser = state.user ? { ...state.user, twoFactorEnabled: false } : null;
      if (typeof window !== 'undefined' && updatedUser) {
        localStorage.setItem('finvault_user', JSON.stringify(updatedUser));
        localStorage.removeItem('finvault_2fa_session_verified');
      }
      return {
        totpSecret: null,
        recoveryCodes: [],
        user: updatedUser,
      };
    });
  },

  regenerateRecoveryCodes: (codes) => {
    set({ recoveryCodes: codes });
  },

  revokeSession: (sessionId) => {
    set((state) => {
      const updated = state.sessions.filter((s) => s.id !== sessionId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('finvault_sessions', JSON.stringify(updated));
      }
      return { sessions: updated };
    });
  },

  logoutEverywhere: () => {
    set((state) => {
      const updated = state.sessions.filter((s) => s.isCurrent);
      if (typeof window !== 'undefined') {
        localStorage.setItem('finvault_sessions', JSON.stringify(updated));
      }
      return { sessions: updated };
    });
  },

  initSessions: () => {
    if (get().isAuthenticated) {
      const sessions = ensureCurrentSession(getStoredSessions());
      set({ sessions });
    }
  },

  updateProfile: (name, email) => {
    set((state) => ({
      user: state.user ? { ...state.user, name, email } : null,
    }));
  },
}));
