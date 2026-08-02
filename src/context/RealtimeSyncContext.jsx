/**
 * RealtimeSyncContext
 *
 * Root-level context that owns all critical Firestore onSnapshot listeners.
 * It subscribes to:
 *   1. The current logged-in user's account document  → `users/{userId}`
 *   2. The school profile document                    → `schoolData/schoolProfile`
 *
 * Exposes:
 *   { liveUserAccount, liveSchoolProfile, syncStatus }
 *
 * Lifecycle:
 *   - Listeners start the moment a userId is available.
 *   - Listeners stop and reset when the user logs out (userId becomes null).
 *   - This context is placed ABOVE AuthProvider so it can be consumed by any
 *     child context without circular dependencies.  AuthProvider passes the
 *     current userId down via a prop-like pattern using a stable setter.
 *
 * Why here?
 *   Centralising all listeners in one place makes it easy to audit what the
 *   app is actively subscribing to, control Firestore billing (read counts),
 *   and clean up deterministically on sign-out.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/firebase.js';
import { COLLECTIONS, SCHOOL_PROFILE_DOC_ID } from '../firebase/firestoreSchema.js';


// ─── Context ──────────────────────────────────────────────────────────────────

const RealtimeSyncContext = createContext(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safely extract plain data from a Firestore DocumentSnapshot. */
const snapToData = (snap) =>
  snap.exists() ? { id: snap.id, ...snap.data() } : null;

/**
 * Status strings surfaced via `syncStatus` so the UI can optionally
 * display a real-time indicator (e.g. "Live", "Offline", "Reconnecting").
 */
export const SYNC_STATUS = {
  IDLE: 'idle',           // No user — listeners are off
  CONNECTING: 'connecting', // Listeners registered, awaiting first snapshot
  LIVE: 'live',           // Receiving fresh snapshots from Firestore server
  CACHED: 'cached',       // Network offline — data from Firestore local cache
  ERROR: 'error',         // Unrecoverable listener error (e.g. permission denied)
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function RealtimeSyncProvider({ children }) {
  // The active userId is set externally by AuthProvider after login.
  // We keep it in a ref AND state: ref for immediate access in closures,
  // state to trigger listener restarts when it changes.
  const [activeUserId, setActiveUserId] = useState(null);

  const [liveUserAccount, setLiveUserAccount] = useState(null);
  const [liveSchoolProfile, setLiveSchoolProfile] = useState(null);
  const [userSyncStatus, setUserSyncStatus] = useState(SYNC_STATUS.IDLE);
  const [profileSyncStatus, setProfileSyncStatus] = useState(SYNC_STATUS.IDLE);

  // Stable setter exposed to AuthProvider so it can register/deregister the
  // current user without causing circular imports.
  const notifyUserChanged = useCallback((userId) => {
    setActiveUserId(userId || null);
  }, []);

  // ── Listener 1: User Account Document ──────────────────────────────────────
  useEffect(() => {
    if (!activeUserId || !db) {
      setLiveUserAccount(null);
      setUserSyncStatus(SYNC_STATUS.IDLE);
      return;
    }

    // Skip only the built-in bootstrap account that never has a Firestore document
    const normalised = String(activeUserId).trim().toLowerCase();
    const isLocalOnly =
      normalised === '@@siam##' ||
      normalised === 'demo';

    if (isLocalOnly) {
      setLiveUserAccount(null);
      setUserSyncStatus(SYNC_STATUS.IDLE);
      return;
    }

    const userDocRef = doc(db, COLLECTIONS.users, String(activeUserId).trim());
    setUserSyncStatus(SYNC_STATUS.CONNECTING);

    let mounted = true;

    const unsubscribe = onSnapshot(
      userDocRef,
      { includeMetadataChanges: true },
      (snap) => {
        if (!mounted) return;
        const data = snapToData(snap);
        setLiveUserAccount(data);
        setUserSyncStatus(
          snap.metadata.fromCache ? SYNC_STATUS.CACHED : SYNC_STATUS.LIVE
        );
      },
      (err) => {
        if (!mounted) return;
        const code = String(err?.code || '').toLowerCase();
        if (code === 'permission-denied') {
          // Non-fatal — user doesn't have a Firestore record yet
          console.warn(
            '[RealtimeSyncContext] User account listener: permission denied.',
            'Account may be local-only. Sync disabled for this user.'
          );
          setUserSyncStatus(SYNC_STATUS.IDLE);
        } else {
          console.error('[RealtimeSyncContext] User account listener error:', err);
          setUserSyncStatus(SYNC_STATUS.ERROR);
        }
        setLiveUserAccount(null);
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
      setLiveUserAccount(null);
      setUserSyncStatus(SYNC_STATUS.IDLE);
    };
  }, [activeUserId]);

  // ── Listener 2: School Profile Document ────────────────────────────────────
  useEffect(() => {
    if (!db) return;

    const profileDocRef = doc(db, COLLECTIONS.schoolData, SCHOOL_PROFILE_DOC_ID);
    setProfileSyncStatus(SYNC_STATUS.CONNECTING);

    let mounted = true;
    let unsubscribe = () => {};

    try {
      unsubscribe = onSnapshot(
        profileDocRef,
        { includeMetadataChanges: true },
        (snap) => {
          if (!mounted) return;
          const data = snapToData(snap);
          setLiveSchoolProfile(data);
          setProfileSyncStatus(
            snap.metadata.fromCache ? SYNC_STATUS.CACHED : SYNC_STATUS.LIVE
          );
        },
        (err) => {
          if (!mounted) return;
          const code = String(err?.code || '').toLowerCase();
          if (code === 'permission-denied') {
            console.warn(
              '[RealtimeSyncContext] School profile listener: permission denied.',
              'Check Firestore security rules for schoolData/schoolProfile.'
            );
            setProfileSyncStatus(SYNC_STATUS.IDLE);
          } else {
            console.error('[RealtimeSyncContext] School profile listener error:', err);
            setProfileSyncStatus(SYNC_STATUS.ERROR);
          }
          setLiveSchoolProfile(null);
        }
      );
    } catch (initErr) {
      // Firestore may not be fully initialized yet on first render (HMR / race).
      // The effect will re-run on the next render cycle.
      console.warn('[RealtimeSyncContext] School profile listener could not start:', initErr?.message);
      setProfileSyncStatus(SYNC_STATUS.IDLE);
    }

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []); // School profile listener runs for the lifetime of the app

  // ── Derived sync status ─────────────────────────────────────────────────────
  const syncStatus = useMemo(() => {
    if (userSyncStatus === SYNC_STATUS.ERROR || profileSyncStatus === SYNC_STATUS.ERROR)
      return SYNC_STATUS.ERROR;
    if (userSyncStatus === SYNC_STATUS.LIVE || profileSyncStatus === SYNC_STATUS.LIVE)
      return SYNC_STATUS.LIVE;
    if (userSyncStatus === SYNC_STATUS.CACHED || profileSyncStatus === SYNC_STATUS.CACHED)
      return SYNC_STATUS.CACHED;
    if (userSyncStatus === SYNC_STATUS.CONNECTING || profileSyncStatus === SYNC_STATUS.CONNECTING)
      return SYNC_STATUS.CONNECTING;
    return SYNC_STATUS.IDLE;
  }, [userSyncStatus, profileSyncStatus]);

  const value = useMemo(
    () => ({
      /** Live Firestore data for the current user's account document, or null */
      liveUserAccount,
      /** Live Firestore data for the school profile document, or null */
      liveSchoolProfile,
      /** Overall real-time sync status string (see SYNC_STATUS enum) */
      syncStatus,
      /**
       * Call this from AuthProvider whenever the logged-in userId changes.
       * This starts/stops the user account listener accordingly.
       */
      notifyUserChanged,
    }),
    [liveUserAccount, liveSchoolProfile, syncStatus, notifyUserChanged]
  );

  return (
    <RealtimeSyncContext.Provider value={value}>
      {children}
    </RealtimeSyncContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRealtimeSyncContext() {
  const ctx = useContext(RealtimeSyncContext);
  if (!ctx) {
    // Safe fallback — allows using the hook in components that are outside the
    // provider during testing or SSR without crashing.
    console.warn(
      '[RealtimeSyncContext] useRealtimeSyncContext called outside of RealtimeSyncProvider. Returning no-op fallback.'
    );
    return {
      liveUserAccount: null,
      liveSchoolProfile: null,
      syncStatus: SYNC_STATUS.IDLE,
      notifyUserChanged: () => {},
    };
  }
  return ctx;
}
