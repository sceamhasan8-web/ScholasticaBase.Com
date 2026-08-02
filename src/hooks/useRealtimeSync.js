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
 * @param {import('firebase/firestore').DocumentReference | import('firebase/firestore').CollectionReference | import('firebase/firestore').Query | null} ref
 *   Firestore ref to listen to. Pass null to skip (hook is a no-op while null).
 * @param {{ debounceMs?: number, onUpdate?: (data: any) => void }} [options]
 * @returns {{ data: any, loading: boolean, error: Error|null, isStale: boolean }}
 */
export function useRealtimeSync(ref, options = {}) {
  const { debounceMs = 50, onUpdate } = options;

  const [state, setState] = useState({
    data: null,
    loading: ref !== null,
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
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const unsubscribe = onSnapshot(
      ref,
      { includeMetadataChanges: false },
      (snapshot) => {
        if (!mounted) return;

        const data = normaliseSnapshot(snapshot);

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
          // Non-fatal: mark data as stale but don't throw away existing data
          console.warn('[useRealtimeSync] Permission denied — listener paused. Using cached data.', err.message);
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
  }, [ref?.path ?? ref]);

  return state;
}
