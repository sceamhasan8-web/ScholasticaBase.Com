import {
  buildGroupSubjectDocId,
  loadGroupSubjectRecords,
  saveGroupSubjectRecord,
} from './firestoreSchema.js';

const isPermissionOrOfflineError = (err) => {
  const errStr = String(err?.message || err || '').toLowerCase();
  const code = String(err?.code || '').toLowerCase();
  return (
    code.includes('permission') ||
    errStr.includes('permission') ||
    errStr.includes('insufficient') ||
    errStr.includes('client is offline') ||
    errStr.includes('failed to get document') ||
    errStr.includes('offline') ||
    code.includes('unavailable') ||
    code.includes('failed-precondition') ||
    code.includes('offline')
  );
};

export const loadGroupSubjectsFromFirestore = async () => {
  try {
    return await loadGroupSubjectRecords();
  } catch (err) {
    if (!isPermissionOrOfflineError(err)) {
      console.warn('[groupSubjects] Load Note:', err?.message || err);
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
    if (!isPermissionOrOfflineError(err)) {
      console.warn('[groupSubjects] Save Note:', err?.message || err);
    }
    return { docId, subjects: normalizedSubjects };
  }
};
