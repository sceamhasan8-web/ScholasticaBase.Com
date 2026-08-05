// ─────────────────────────────────────────────────────────────
// ViewModeContext.jsx — Super Admin View Mode & Impersonation
// ─────────────────────────────────────────────────────────────
// This context allows a super admin to:
//   1. Switch their "view mode" to any panel (admin, teacher, student, principal)
//   2. Impersonate a specific user profile so panels render that user's data
//   3. Stop impersonation and return to their own admin context
//
// Non-super-admin users will see viewMode = their own role and cannot switch.
// ─────────────────────────────────────────────────────────────

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';

const ViewModeContext = createContext(null);

/** All panels the Super Admin can switch between */
export const VIEW_MODES = [
  { key: 'admin', label: 'Admin Panel', icon: '🛡️', color: '#8b5cf6' },
  { key: 'teacher', label: 'Teacher Panel', icon: '👨‍🏫', color: '#2563eb' },
  { key: 'student', label: 'Student Panel', icon: '🎓', color: '#06b6d4' },
  { key: 'principal', label: 'Principal Panel', icon: '🏛️', color: '#f59e0b' },
];

/**
 * Check if a user object has super admin privileges.
 * Exported so other modules can do quick checks without the context.
 */
export function isSuperAdminUser(user) {
  if (!user) return false;
  const real = user?._realUser || user;
  const uid = String(real?.userId || real?.id || '').toLowerCase();
  return !!(real?.isSuperAdmin || uid === '@@siam##');
}

export function isAdminUser(user) {
  if (!user) return false;
  if (isSuperAdminUser(user)) return true;
  const real = user?._realUser || user;
  const role = String(real?.role || '').toLowerCase();
  const uid = String(real?.userId || real?.id || '').toLowerCase();
  return role === 'admin' || uid === 'admin';
}

export function ViewModeProvider({ children }) {
  const { user } = useAuth();
  const realUser = user?._realUser || user;
  const superAdmin = isSuperAdminUser(realUser);
  const canSwitch = !!(realUser && (realUser.isSuperAdmin || realUser.role === 'admin' || isAdminUser(realUser)));

  // The currently active view mode — defaults to the user's own role
  const [viewMode, setViewModeRaw] = useState(() => user?.role || 'admin');

  // The profile being impersonated (null = no impersonation, viewing generically)
  const [impersonatedUser, setImpersonatedUser] = useState(null);

  // ── Switch view mode ──────────────────────────────────────
  const setViewMode = useCallback((mode) => {
    if (!canSwitch) return; // Only authorized admins can switch
    const valid = VIEW_MODES.find((v) => v.key === mode);
    if (!valid) return;
    setViewModeRaw(mode);
    // Clear impersonation when switching panels
    setImpersonatedUser(null);
  }, [canSwitch]);

  // ── Impersonation ─────────────────────────────────────────
  const impersonate = useCallback((userProfile) => {
    if (!canSwitch || !userProfile) return;
    setImpersonatedUser(userProfile);
    // Auto-switch view mode to match the impersonated user's role
    const targetRole = String(userProfile.role || '').trim().toLowerCase();
    const match = VIEW_MODES.find((v) => v.key === targetRole);
    if (match) setViewModeRaw(match.key);
  }, [canSwitch]);

  const stopImpersonating = useCallback(() => {
    setImpersonatedUser(null);
  }, []);

  // ── Effective user ────────────────────────────────────────
  // When impersonating, panels should use this instead of the auth user
  // to render data as if the impersonated user is logged in.
  const effectiveUser = useMemo(() => {
    if (canSwitch && impersonatedUser) {
      return {
        ...impersonatedUser,
        // Preserve the fact that the *real* user is an admin / super admin
        _realUser: user,
        _isImpersonated: true,
      };
    }
    return user;
  }, [canSwitch, impersonatedUser, user]);

  // ── Context value ─────────────────────────────────────────
  const value = useMemo(() => ({
    // State
    viewMode,
    impersonatedUser,
    effectiveUser,
    isSuperAdmin: superAdmin,
    canSwitch,
    isImpersonating: !!(canSwitch && impersonatedUser),

    // Actions
    setViewMode,
    impersonate,
    stopImpersonating,
  }), [viewMode, impersonatedUser, effectiveUser, superAdmin, canSwitch, setViewMode, impersonate, stopImpersonating]);

  return (
    <ViewModeContext.Provider value={value}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) {
    return {
      viewMode: 'admin',
      impersonatedUser: null,
      effectiveUser: null,
      isSuperAdmin: false,
      canSwitch: false,
      isImpersonating: false,
      setViewMode: () => {},
      impersonate: () => {},
      stopImpersonating: () => {},
    };
  }
  return context;
}
