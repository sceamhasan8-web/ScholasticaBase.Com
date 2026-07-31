import { readStorage, writeStorage } from '../utils/schoolData.js';

// ─────────────────────────────────────────────────────────────
// localPersistence.js — Scoped localStorage helpers
// ─────────────────────────────────────────────────────────────
// FIX #6: Previously, getLocalResults / saveLocalResults used raw unscoped
// localStorage keys, meaning exam results were shared across ALL schools.
// Now they use readStorage / writeStorage from schoolData.js, which
// automatically scopes keys per active school (e.g. school_ABC123_schoolAppLocalResults).
//
// NOTE: schoolAppLocalUsers is intentionally kept GLOBAL (unscoped) because
// user accounts need to be accessible at the login screen before a school
// is selected. School isolation for users is enforced in the signIn() logic
// via EIIN and schoolCode matching in AuthContext.
// ─────────────────────────────────────────────────────────────

const readLocal = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeLocal = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
};

// Global (cross-school) — intentionally unscoped. Login requires access
// to user accounts before a school context is established.
export const LOCAL_USERS_KEY = 'schoolAppLocalUsers';
export const getLocalUsers = () => readLocal(LOCAL_USERS_KEY, {});
export const saveLocalUsers = (users) => writeLocal(LOCAL_USERS_KEY, users);

// School-scoped — each school gets its own isolated results key.
export const LOCAL_RESULTS_KEY = 'schoolAppLocalResults';
export const getLocalResults = () => readStorage(LOCAL_RESULTS_KEY, {});
export const saveLocalResults = (results) => writeStorage(LOCAL_RESULTS_KEY, results);
