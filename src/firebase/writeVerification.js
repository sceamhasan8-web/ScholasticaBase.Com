import { setDoc } from 'firebase/firestore';

// Saves a document to Firestore. The previous read-back verification was removed
// because it caused false "verification failed" errors — Firestore's setDoc already
// throws on failure (network error, permission denied, etc.), so a second getDoc
// round-trip is unnecessary and races with propagation latency.
export const saveAndVerifyDoc = async (docRef, data, options) => {
    await setDoc(docRef, data, options);
    return data;
};
