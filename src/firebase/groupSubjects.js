import {
  buildGroupSubjectDocId,
  loadGroupSubjectRecords,
  saveGroupSubjectRecord,
} from './firestoreSchema.js';

const isFirestoreOfflineError = (err) => {
  const message = String(err?.message || '').toLowerCase();
  const code = String(err?.code || '').toLowerCase();
  return (
    message.includes('client is offline') ||
    message.includes('failed to get document') ||
    message.includes('offline') ||
    code.includes('unavailable') ||
    code.includes('failed-precondition') ||
    code.includes('offline')
  );
};


export const loadGroupSubjectsFromFirestore = async () => {
  try {
    return await loadGroupSubjectRecords();
  } catch (err) {
    if (isFirestoreOfflineError(err)) {
      console.warn('Firestore is offline — keeping the current subjects locally.');
    } else {
      console.warn('Could not load group subjects from Firestore:', err);
    }
    return {};
  }
};

export const saveGroupSubjectsToFirestore = async ({ classIdx, groupName, subjects }) => {
  const normalizedSubjects = Array.isArray(subjects) ? [...new Set(subjects.filter(Boolean))] : [];
  const docId = buildGroupSubjectDocId(classIdx, groupName);

  try {
    await saveGroupSubjectRecord({ classIdx, groupName, subjects: normalizedSubjects });
    return { docId, subjects: normalizedSubjects };
  } catch (err) {
    if (isFirestoreOfflineError(err)) {
      console.warn('Firestore is offline — subject changes were kept locally.');
    } else {
      console.warn('Could not save group subjects to Firestore:', err);
    }
    return null;
  }
};
