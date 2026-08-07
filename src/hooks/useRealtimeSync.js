/**
 * useRealtimeSync
 *
 * A reusable hook that wraps Firestore's onSnapshot API to provide live,
 * real-time data synchronization for a given document or collection reference.
 *
 * Features:
 * - Subscribes to a Firestore DocumentReference or CollectionReference
 * - Returns { data, loading, error, isStale }
 * - Automatically unsubscribes on unmount (no memory leaks)
 * - Handles offline gracefully — Firestore SDK serves from local cache
 * - Debounces rapid successive snapshots (50ms) to avoid render storms
 * - Safely ignores updates after unmount
 *
 * Usage:
 *   const { data, loading, error } = useRealtimeSync(docRef);
 *   const { data, loading, error } = useRealtimeSync(collectionRef);
 */

import { useEffect, useRef, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

/**
 * Normalise a Firestore snapshot into a plain JS object.
 * For a DocumentSnapshot  → { id, ...fields }  |  null if not found.
 * For a QuerySnapshot     → Array<{ id, ...fields }>
 */
const normaliseSnapshot = (snapshot) => {
  // QuerySnapshot has a `docs` array
  if (typeof snapshot.docs !== 'undefined') {
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  // DocumentSnapshot
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() };
  }
  return null;
};

/**
 * LocalStorage cache helper functions
 */
const getCacheKey = (ref, customKey) => {
  if (customKey) return `scholastic_cache_${customKey}`;
  if (ref?.path) return `scholastic_cache_${ref.path}`;
  if (typeof ref === 'string') return `scholastic_cache_${ref}`;
  return null;
};

const loadDeviceCache = (key) => {
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveDeviceCache = (key, data) => {
  if (!key || typeof window === 'undefined' || data === undefined) return;
  try {
    if (data === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(data));
    }
  } catch {
    // ignore storage quota errors gracefully
  }
};

/**
 * @param {import('firebase/firestore').DocumentReference | import('firebase/firestore').CollectionReference | import('firebase/firestore').Query | null} ref
 *   Firestore ref to listen to. Pass null to skip (hook is a no-op while null).
 * @param {{ debounceMs?: number, cacheKey?: string, onUpdate?: (data: any) => void }} [options]
 * @returns {{ data: any, loading: boolean, error: Error|null, isStale: boolean }}
 */
export function useRealtimeSync(ref, options = {}) {
  const { debounceMs = 50, cacheKey: customCacheKey, onUpdate } = options;
  const storageKey = getCacheKey(ref, customCacheKey);

  // Initialize state using device local cache if available (0ms instant boot)
  const initialCache = storageKey ? loadDeviceCache(storageKey) : null;

  const [state, setState] = useState({
    data: initialCache,
    loading: ref !== null && initialCache === null,
    error: null,
    isStale: false,
  });

  // Keep a stable ref to the onUpdate callback so the effect doesn't re-run
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!ref) {
      setState({ data: null, loading: false, error: null, isStale: false });
      return;
    }

    let mounted = true;
    let debounceTimer = null;

    // Check device cache on ref change
    const cached = storageKey ? loadDeviceCache(storageKey) : null;
    if (cached !== null) {
      setState({ data: cached, loading: false, error: null, isStale: false });
    } else {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }

    const unsubscribe = onSnapshot(
      ref,
      { includeMetadataChanges: false },
      (snapshot) => {
        if (!mounted) return;

        const data = normaliseSnapshot(snapshot);

        // Auto-persist snapshot updates into device local storage cache
        if (storageKey) {
          saveDeviceCache(storageKey, data);
        }

        // Debounce: clear any pending update before scheduling a new one
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (!mounted) return;
          setState({ data, loading: false, error: null, isStale: false });
          if (onUpdateRef.current) {
            try {
              onUpdateRef.current(data);
            } catch (callbackErr) {
              console.error('[useRealtimeSync] onUpdate callback threw:', callbackErr);
            }
          }
        }, debounceMs);
      },
      (err) => {
        if (!mounted) return;
        const isPermissionError =
          err?.code === 'permission-denied' ||
          err?.code === 'PERMISSION_DENIED';

        if (isPermissionError) {
          // Non-fatal: mark data as stale but serve device cached data
          console.warn('[useRealtimeSync] Permission denied — listener paused. Serving cached device data.', err.message);
          setState((prev) => ({ ...prev, loading: false, isStale: true, error: err }));
        } else {
          console.error('[useRealtimeSync] Listener error:', err);
          setState((prev) => ({ ...prev, loading: false, error: err, isStale: true }));
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(debounceTimer);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref?.path ?? ref, storageKey]);

  return state;
}
