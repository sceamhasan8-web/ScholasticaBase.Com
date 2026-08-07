/**
 * RealtimeSyncContext
 *
 * Root-level context that owns all critical Firestore onSnapshot listeners.
 * It subscribes to:
 *   1. The current logged-in user's account document  → `users/{userId}`
 *   2. The school profile document                    → `schoolData/schoolProfile`
 *   3. The entire users collection (admin-only)       → `users/*`
 *
 * Exposes:
 *   { liveUserAccount, liveSchoolProfile, syncStatus, liveUsersVersion,
 *     notifyUserChanged, notifyIsAdmin }
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
  useRef,
  useState,
} from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
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

// ─── localStorage key (global, unscoped — same as AuthContext) ────────────────
const LOCAL_USERS_KEY = 'schoolAppLocalUsers';

const mergeUsersIntoLocalStorage = (docs) => {
  try {
    const raw = window.localStorage.getItem(LOCAL_USERS_KEY);
    const existing = raw ? JSON.parse(raw) : {};
    let changed = false;

    // Create a set of lowercased user IDs present in Firestore
    const remoteUserIds = new Set(
      docs
        .map((d) => String(d?.userId || d?.id || '').trim().toLowerCase())
        .filter(Boolean)
    );

    // 1. Purge user accounts from localStorage that have been deleted in Firestore
    Object.keys(existing).forEach((key) => {
      const lowerKey = key.toLowerCase();
      // Protect SuperAdmin bootstrap account
      if (lowerKey === '@@siam##') return;

      if (!remoteUserIds.has(lowerKey)) {
        delete existing[key];
        changed = true;
      }
    });

    // 2. Add or update user accounts present in Firestore
    docs.forEach((data) => {
      if (!data?.userId) return;
      const key = data.userId;
      if (key === '@@Siam##') return;
      const prev = existing[key];
      const merged = { ...prev, ...data };
      if (!prev || JSON.stringify(prev) !== JSON.stringify(merged)) {
        existing[key] = merged;
        changed = true;
      }
    });

    if (changed) {
      window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(existing));
      // Notify same-tab listeners (e.g. AdminDashboard, PrincipalDashboard) of the update
      window.dispatchEvent(new CustomEvent('schoolUsersUpdate'));
    }
  } catch {
    // ignore storage errors
  }
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function RealtimeSyncProvider({ children }) {
  // The active userId is set externally by AuthProvider after login.
  // We keep it in a ref AND state: ref for immediate access in closures,
  // state to trigger listener restarts when it changes.
  const [activeUserId, setActiveUserId] = useState(null);

  // Whether the currently logged-in user is an admin or super-admin.
  // Only admins need the users-collection listener.
  const [isAdmin, setIsAdmin] = useState(false);

  // Device storage cache helpers
  const getCachedProfile = () => {
    try {
      const raw = window.localStorage.getItem('scholastic_cached_school_profile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const setCachedProfile = (data) => {
    try {
      if (data) window.localStorage.setItem('scholastic_cached_school_profile', JSON.stringify(data));
    } catch {}
  };

  const getCachedUserAccount = (userId) => {
    if (!userId) return null;
    try {
      const raw = window.localStorage.getItem(`scholastic_cached_user_${userId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const setCachedUserAccount = (userId, data) => {
    if (!userId) return;
    try {
      if (data) window.localStorage.setItem(`scholastic_cached_user_${userId}`, JSON.stringify(data));
    } catch {}
  };

  const [liveUserAccount, setLiveUserAccount] = useState(() => getCachedUserAccount(activeUserId));
  const [liveSchoolProfile, setLiveSchoolProfile] = useState(() => getCachedProfile());
  // Increments each time the users collection changes — consumers watch this
  // to know when to re-load the accounts list.
  const [liveUsersVersion, setLiveUsersVersion] = useState(0);
  const [userSyncStatus, setUserSyncStatus] = useState(SYNC_STATUS.IDLE);
  const [profileSyncStatus, setProfileSyncStatus] = useState(SYNC_STATUS.IDLE);

  // Stable setter exposed to AuthProvider so it can register/deregister the
  // current user without causing circular imports.
  const notifyUserChanged = useCallback((userId) => {
    setActiveUserId(userId || null);
  }, []);

  // Called by AuthProvider after login/logout to enable/disable the
  // users-collection listener. Only admin-role sessions need it.
  const notifyIsAdmin = useCallback((adminFlag) => {
    setIsAdmin(!!adminFlag);
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

    // Hydrate instantly from device cache
    const initialCachedUser = getCachedUserAccount(activeUserId);
    if (initialCachedUser) {
      setLiveUserAccount(initialCachedUser);
    }

    const userDocRef = doc(db, COLLECTIONS.users, String(activeUserId).trim());
    setUserSyncStatus(SYNC_STATUS.CONNECTING);

    let mounted = true;

    const unsubscribe = onSnapshot(
      userDocRef,
      { includeMetadataChanges: true },
      (snap) => {
        if (!mounted) return;
        if (!snap.exists()) {
          // Document was deleted from Firestore server!
          setLiveUserAccount({ _deleted: true, userId: activeUserId });
          setUserSyncStatus(SYNC_STATUS.LIVE);
          return;
        }
        const data = snapToData(snap);
        setLiveUserAccount(data);
        setCachedUserAccount(activeUserId, data);
        setUserSyncStatus(
          snap.metadata.fromCache ? SYNC_STATUS.CACHED : SYNC_STATUS.LIVE
        );
      },
      (err) => {
        if (!mounted) return;
        const code = String(err?.code || '').toLowerCase();
        if (code === 'permission-denied' || String(err?.message || '').toLowerCase().includes('permission')) {
          // Account is local-only — disable cloud sync gracefully
          setUserSyncStatus(SYNC_STATUS.IDLE);
        } else {
          console.warn('[RealtimeSyncContext] User account listener note:', err?.message || err);
          setUserSyncStatus(SYNC_STATUS.ERROR);
        }
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [activeUserId]);

  // ── Listener 2: School Profile Document ────────────────────────────────────
  useEffect(() => {
    if (!db) return;

    // Hydrate instantly from device cache
    const cachedProf = getCachedProfile();
    if (cachedProf) {
      setLiveSchoolProfile(cachedProf);
    }

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
          if (data) {
            setLiveSchoolProfile(data);
            setCachedProfile(data);
          }
          setProfileSyncStatus(
            snap.metadata.fromCache ? SYNC_STATUS.CACHED : SYNC_STATUS.LIVE
          );
        },
        (err) => {
          if (!mounted) return;
          const code = String(err?.code || '').toLowerCase();
          if (code === 'permission-denied' || String(err?.message || '').toLowerCase().includes('permission')) {
            setProfileSyncStatus(SYNC_STATUS.IDLE);
          } else {
            console.warn('[RealtimeSyncContext] School profile listener note:', err?.message || err);
            setProfileSyncStatus(SYNC_STATUS.ERROR);
          }
        }
      );
    } catch (initErr) {
      setProfileSyncStatus(SYNC_STATUS.IDLE);
    }

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // ── Listener 3: Users Collection (admin-only) ───────────────────────────────
  const usersListenerActive = useRef(false);
  useEffect(() => {
    if (!db || !isAdmin || !activeUserId) {
      usersListenerActive.current = false;
      return;
    }

    usersListenerActive.current = true;
    let mounted = true;

    const usersCollectionRef = collection(db, COLLECTIONS.users);

    const unsubscribe = onSnapshot(
      usersCollectionRef,
      { includeMetadataChanges: false },
      (snapshot) => {
        if (!mounted) return;

        const freshDocs = [];
        snapshot.forEach((docSnap) => {
          if (docSnap.exists()) {
            freshDocs.push({ id: docSnap.id, ...docSnap.data() });
          }
        });

        mergeUsersIntoLocalStorage(freshDocs);
        setLiveUsersVersion((v) => v + 1);
      },
      (err) => {
        if (!mounted) return;
        const code = String(err?.code || '').toLowerCase();
        if (code !== 'permission-denied' && !String(err?.message || '').toLowerCase().includes('permission')) {
          console.warn('[RealtimeSyncContext] Users collection listener note:', err?.message || err);
        }
      }
    );

    return () => {
      mounted = false;
      usersListenerActive.current = false;
      unsubscribe();
    };
  }, [isAdmin, activeUserId]); // restart whenever admin status or active user changes

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
       * Increments each time the Firestore users collection changes.
       * AdminDashboard watches this to know when to reload the accounts list.
       */
      liveUsersVersion,
      /**
       * Call this from AuthProvider whenever the logged-in userId changes.
       * This starts/stops the user account listener accordingly.
       */
      notifyUserChanged,
      /**
       * Call this from AuthProvider with true when an admin logs in, false on logout.
       * Enables/disables the users-collection listener to keep accounts in sync.
       */
      notifyIsAdmin,
    }),
    [liveUserAccount, liveSchoolProfile, syncStatus, liveUsersVersion, notifyUserChanged, notifyIsAdmin]
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
    return {
      liveUserAccount: null,
      liveSchoolProfile: null,
      syncStatus: SYNC_STATUS.IDLE,
      liveUsersVersion: 0,
      notifyUserChanged: () => {},
      notifyIsAdmin: () => {},
    };
  }
  return ctx;
}
