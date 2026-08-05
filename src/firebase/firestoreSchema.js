import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocFromServer,
    getDocs,
    onSnapshot,
    query,
    serverTimestamp,
    where,
    writeBatch,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from './firebase.js';
import { saveAndVerifyDoc } from './writeVerification.js';
import { getBranchKeyByClass } from '../utils/schoolResolver.js';

export const COLLECTIONS = {
    users: 'users',
    students: 'students',
    teachers: 'teachers',
    classes: 'classes',
    subjects: 'subjects',
    groupSubjects: 'groupSubjects',
    exams: 'exams',
    results: 'results',
    grades: 'grades',
    positions: 'positions',
    schoolData: 'schoolData',
    schools: 'schools',
};

export const SCHOOL_PROFILE_DOC_ID = 'schoolProfile';
export const TEACHER_PANEL_DOC_ID = 'teacherPanel';

export const cleanId = (value, fallback = 'item') => {
    if (value == null) return fallback;
    const str = String(value).trim().toLowerCase();
    if (!str) return fallback;

    const sanitized = str
        .replace(/[^\w\s\u0980-\u09FF-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

    return sanitized || fallback;
};

export const buildGroupSubjectDocId = (classId, groupName) => `${cleanId(classId, 'class')}-${cleanId(groupName, 'group')}`;
export const buildResultDocId = ({ studentId, subject, examId = 'current' }) => (
    `${cleanId(studentId, 'student')}-${cleanId(examId, 'current')}-${cleanId(subject, 'subject')}`
);
export const buildPositionDocId = ({ classId, groupName, examId = 'current', studentId }) => (
    `${cleanId(classId, 'class')}-${cleanId(groupName, 'group')}-${cleanId(examId, 'current')}-${cleanId(studentId, 'student')}`
);

export const getSchoolCollectionName = (baseCollection) => {
    return baseCollection;
};

export const refs = {
    user: (userId) => doc(db, COLLECTIONS.users, String(userId).trim()),
    student: (studentId) => doc(db, COLLECTIONS.students, cleanId(studentId, 'student')),
    teacher: (teacherId) => doc(db, COLLECTIONS.teachers, cleanId(teacherId, 'teacher')),
    class: (classId) => doc(db, COLLECTIONS.classes, cleanId(classId, 'class')),
    subject: (subjectId) => doc(db, COLLECTIONS.subjects, cleanId(subjectId, 'subject')),
    groupSubject: (classId, groupName) => doc(db, COLLECTIONS.groupSubjects, buildGroupSubjectDocId(classId, groupName)),
    exam: (examId) => doc(db, COLLECTIONS.exams, cleanId(examId, 'exam')),
    result: (resultId) => doc(db, COLLECTIONS.results, cleanId(resultId, 'result')),
    grade: (gradeId) => doc(db, COLLECTIONS.grades, cleanId(gradeId, 'grade')),
    position: (positionId) => doc(db, COLLECTIONS.positions, cleanId(positionId, 'position')),
    school: (schoolId) => doc(db, COLLECTIONS.schools, String(schoolId || 'PROGGA_DEFAULT').trim()),
    schoolProfile: () => doc(db, COLLECTIONS.schoolData, SCHOOL_PROFILE_DOC_ID),
    teacherPanel: (schoolId) => {
        // Each school gets its own isolated teacherPanel document.
        // e.g. "teacherPanel" for the default school, "teacherPanel_school-123" for others.
        const safeSid = String(schoolId || '').trim();
        const docId = (safeSid && safeSid !== 'PROGGA_DEFAULT' && safeSid !== 'SCHOLASTICBASE_DEFAULT')
            ? `${TEACHER_PANEL_DOC_ID}_${safeSid}`
            : TEACHER_PANEL_DOC_ID;
        return doc(db, COLLECTIONS.schoolData, docId);
    },
};

export const withWriteMetadata = (data, extra = {}) => ({
    ...data,
    ...extra,
    updatedAt: serverTimestamp(),
});

export const getDocumentData = async (docRef) => {
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
};

export const ensureFirebaseAuth = async () => {
    if (auth && !auth.currentUser) {
        try {
            await signInAnonymously(auth);
        } catch (anonErr) {
            console.warn('[Firebase Auth] Anonymous auth sign-in warning:', anonErr?.message || anonErr);
        }
    }
    return auth?.currentUser;
};

export const saveDocument = async (docRef, data, options = { merge: true }) => {
    await ensureFirebaseAuth();
    return saveAndVerifyDoc(docRef, data, options);
};
export const deleteDocument = async (docRef) => {
    await ensureFirebaseAuth();
    return deleteDoc(docRef);
};

export const getSchoolProfile = async (schoolId) => {
    if (schoolId && schoolId !== 'PROGGA_DEFAULT') {
        const isolatedSchool = await getDocumentData(refs.school(schoolId));
        if (isolatedSchool) return isolatedSchool;
    }
    return getDocumentData(refs.schoolProfile());
};

export const saveSchoolProfile = (profile, schoolId) => {
    const targetId = schoolId || profile?.schoolId || profile?.schoolCode || profile?.eiinNumber;
    if (targetId && targetId !== 'PROGGA_DEFAULT') {
        return saveDocument(refs.school(targetId), withWriteMetadata(profile));
    }
    saveDocument(refs.school('PROGGA_DEFAULT'), withWriteMetadata(profile)).catch(() => {});
    return saveDocument(refs.schoolProfile(), withWriteMetadata(profile));
};

/**
 * Real-time dynamic lookup of school profile by EIIN or School ID/Code
 */
export const fetchSchoolProfileByEiin = async (eiinOrId) => {
    if (!eiinOrId) return null;
    const cleanKey = String(eiinOrId).trim();
    if (!cleanKey) return null;

    try {
        // 1. Direct document lookup in 'schools' collection by ID
        const directSnap = await getDoc(refs.school(cleanKey));
        if (directSnap.exists()) {
            return { id: directSnap.id, ...directSnap.data() };
        }

        // 2. Query 'schools' collection where eiinNumber == cleanKey
        const eiinQuery = query(collection(db, 'schools'), where('eiinNumber', '==', cleanKey));
        const eiinSnap = await getDocs(eiinQuery);
        if (!eiinSnap.empty) {
            const firstDoc = eiinSnap.docs[0];
            return { id: firstDoc.id, ...firstDoc.data() };
        }

        // 3. Query 'schools' collection where schoolCode == cleanKey
        const codeQuery = query(collection(db, 'schools'), where('schoolCode', '==', cleanKey.toUpperCase()));
        const codeSnap = await getDocs(codeQuery);
        if (!codeSnap.empty) {
            const firstDoc = codeSnap.docs[0];
            return { id: firstDoc.id, ...firstDoc.data() };
        }

        // 4. Fallback: Lookup single default schoolProfile document
        const defaultProfileSnap = await getDoc(refs.schoolProfile());
        if (defaultProfileSnap.exists()) {
            const defData = defaultProfileSnap.data() || {};
            const defEiin = String(defData.eiinNumber || '130743').trim();
            const defCode = String(defData.schoolCode || 'PROGGA').trim().toUpperCase();
            const defId = String(defData.schoolId || 'PROGGA_DEFAULT').trim();
            if (
                cleanKey === defEiin ||
                cleanKey.toUpperCase() === defCode ||
                cleanKey === defId
            ) {
                return { id: defaultProfileSnap.id, ...defData };
            }
        }
    } catch (err) {
        console.warn('Could not query Firestore school profile by EIIN:', err);
    }
    return null;
};

export const getTeacherPanelData = async (schoolId) => {
    const targetRef = refs.teacherPanel(schoolId);
    const data = await getDocumentData(targetRef);
    return data ? {
        classes: data.classes || [],
        teachers: data.teachers || [],
        teacherRoutines: data.teacherRoutines || {},
        timeSlots: data.timeSlots || [
            "৯:০০-৯:৫০", "৯:৫০-১০:৩৫", "১০:৩৫-১১:২০",
            "১১:২০-১২:০৫", "১২:০৫-১২:৫০", "১:৩০-২:১০", "২:১০-২:৫০"
        ]
    } : null;
};

export const saveTeacherPanelData = (payload = {}, schoolId) => {
    const { classes, teachers, teacherRoutines, timeSlots } = payload || {};
    const dataToSave = {
        schoolId: schoolId || 'PROGGA_DEFAULT',
        schemaVersion: 1,
    };

    if (classes !== undefined) dataToSave.classes = classes;
    if (teachers !== undefined) dataToSave.teachers = teachers;
    if (teacherRoutines !== undefined) dataToSave.teacherRoutines = teacherRoutines;
    if (timeSlots !== undefined) dataToSave.timeSlots = timeSlots;

    return saveDocument(
        refs.teacherPanel(schoolId),
        withWriteMetadata(dataToSave)
    );
};

export const getUserAccount = async (userId) => {
    const cleanId = String(userId || '').trim();
    if (!cleanId) return null;
    try {
        await ensureFirebaseAuth();
        const snapshot = await getDoc(refs.user(cleanId));
        if (snapshot.exists()) return snapshot.data();

        const lowerId = cleanId.toLowerCase();
        if (lowerId !== cleanId) {
            const lowerSnap = await getDoc(refs.user(lowerId));
            if (lowerSnap.exists()) return lowerSnap.data();
        }

        const q = query(collection(db, COLLECTIONS.users), where('userId', '==', cleanId));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) return querySnap.docs[0].data();
    } catch (err) {
        console.warn('[getUserAccount] Failed to fetch account:', err?.message || err);
    }
    return null;
};

/**
 * Fetch a user account directly from the Firestore server, bypassing
 * the IndexedDB persistent cache completely.
 *
 * Uses multi-strategy lookup (exact doc ID, lowercased doc ID, collection query,
 * and cached fallback) to ensure passwords sync seamlessly even if case or cache differs.
 */
export const getUserAccountFresh = async (userId) => {
    const cleanId = String(userId || '').trim();
    if (!cleanId) return null;

    try {
        await ensureFirebaseAuth();
    } catch {
        // ignore
    }

    // 1. Try server fetch for exact userId document
    try {
        const snapshot = await getDocFromServer(refs.user(cleanId));
        if (snapshot.exists()) return snapshot.data();
    } catch {
        // Fall through to next strategy
    }

    // 2. Try server fetch for lowercased userId document
    const lowerId = cleanId.toLowerCase();
    if (lowerId !== cleanId) {
        try {
            const lowerSnap = await getDocFromServer(refs.user(lowerId));
            if (lowerSnap.exists()) return lowerSnap.data();
        } catch {
            // Fall through
        }
    }

    // 3. Try query on users collection by userId field
    try {
        const q = query(collection(db, COLLECTIONS.users), where('userId', '==', cleanId));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) return querySnap.docs[0].data();
    } catch {
        // Fall through
    }

    // 4. Fallback to cached/IndexedDB fetch if server read failed or timed out
    return getUserAccount(cleanId);
};

export const saveUserAccount = (account) => saveDocument(
    refs.user(account.userId),
    withWriteMetadata({
        ...account,
        status: account.status || 'active',
        schemaVersion: 1,
    })
);

export const deleteUserAccount = (userId) => deleteDocument(refs.user(userId));

export const saveStudentProfile = (student, schoolId) => {
    const targetSchoolId = schoolId || student.schoolId || student.eiinNumber || student.schoolCode;
    return saveDocument(
        refs.student(student.id || student.studentId, targetSchoolId),
        withWriteMetadata({
            studentId: student.id || student.studentId,
            schoolId: targetSchoolId || '',
            eiinNumber: student.eiinNumber || '',
            name: student.name || student.studentName || '',
            roll: student.roll || '',
            class: student.class || student.className || '',
            classId: cleanId(student.classId || student.class || student.className, 'class'),
            group: student.group || student.section || '',
            fatherName: student.fatherName || 'N/A',
            motherName: student.motherName || 'N/A',
            profilePic: student.profilePic || '',
            status: student.status || 'active',
            schemaVersion: 1,
        })
    );
};

export const saveTeacherProfile = (teacher, schoolId) => {
    const targetSchoolId = schoolId || teacher.schoolId || teacher.eiinNumber || teacher.schoolCode;
    return saveDocument(
        refs.teacher(teacher.id || teacher.userId || teacher.email || teacher.name, targetSchoolId),
        withWriteMetadata({
            teacherId: teacher.id || teacher.userId || cleanId(teacher.email || teacher.name, 'teacher'),
            schoolId: targetSchoolId || '',
            eiinNumber: teacher.eiinNumber || '',
            name: teacher.name || '',
            subject: teacher.subject || '',
            email: teacher.email || '',
            phone: teacher.phone || '',
            assignments: Array.isArray(teacher.assignments) ? teacher.assignments : [],
            status: teacher.status || 'active',
            schemaVersion: 1,
        })
    );
};

export const saveClassRecord = (classRecord, schoolId) => {
    const targetSchoolId = schoolId || classRecord.schoolId || classRecord.eiinNumber || classRecord.schoolCode;
    const resolvedBranch = classRecord.branchKey || classRecord.branchId || classRecord.branch || getBranchKeyByClass(classRecord.className);
    return saveDocument(
        refs.class(classRecord.classId || classRecord.className, targetSchoolId),
        withWriteMetadata({
            classId: cleanId(classRecord.classId || classRecord.className, 'class'),
            schoolId: targetSchoolId || '',
            eiinNumber: classRecord.eiinNumber || '',
            branchKey: resolvedBranch,
            branchId: resolvedBranch,
            sectionId: classRecord.sectionId || resolvedBranch,
            className: classRecord.className || '',
            classNum: classRecord.classNum || null,
            groups: Array.isArray(classRecord.groups) ? classRecord.groups : [],
            studentCount: Array.isArray(classRecord.students) ? classRecord.students.length : 0,
            status: classRecord.status || 'active',
            schemaVersion: 1,
        })
    );
};

export const saveSubjectRecord = (subjectName, schoolId) => saveDocument(
    refs.subject(subjectName, schoolId),
    withWriteMetadata({ subjectId: cleanId(subjectName, 'subject'), name: subjectName, status: 'active', schemaVersion: 1 })
);

export const saveGroupSubjectRecord = ({ classId, className, classIdx, groupName, subjects = [], schoolId }) => {
    const normalizedSubjects = [...new Set((Array.isArray(subjects) ? subjects : []).filter(Boolean))];
    return saveDocument(
        refs.groupSubject(classId ?? classIdx ?? className, groupName, schoolId),
        withWriteMetadata({
            classId: cleanId(classId ?? className ?? classIdx, 'class'),
            classIdx,
            className: className || '',
            groupName,
            subjects: normalizedSubjects,
            subjectIds: normalizedSubjects.map((subject) => cleanId(subject, 'subject')),
            status: 'active',
            schemaVersion: 1,
        })
    );
};

export const loadGroupSubjectRecords = async (schoolId) => {
    const snapshot = await getDocs(collection(db, getSchoolCollectionName(COLLECTIONS.groupSubjects, schoolId)));
    const result = {};
    snapshot.forEach((item) => {
        const data = item.data() || {};
        result[item.id] = {
            classIdx: data.classIdx,
            classId: data.classId,
            className: data.className,
            groupName: data.groupName,
            subjects: Array.isArray(data.subjects) ? data.subjects.filter(Boolean) : [],
        };
    });
    return result;
};

export const getStoredResultsFromLocal = (schoolId) => {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
        const key = schoolId ? `progga_stored_results_${schoolId}` : 'progga_stored_results';
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

export const saveStoredResultToLocal = (result, schoolId) => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const key = schoolId ? `progga_stored_results_${schoolId}` : 'progga_stored_results';
        const current = getStoredResultsFromLocal(schoolId);
        const resultKey = result.key || result.id || result.resultId;
        const filtered = current.filter(r => (r.key || r.id || r.resultId) !== resultKey);
        const updated = [...filtered, { ...result, key: resultKey, id: resultKey }];
        window.localStorage.setItem(key, JSON.stringify(updated));
    } catch (err) {
        console.warn('Error persisting stored result to localStorage:', err);
    }
};

export const removeStoredResultFromLocal = (resultId, schoolId) => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const key = schoolId ? `progga_stored_results_${schoolId}` : 'progga_stored_results';
        const current = getStoredResultsFromLocal(schoolId);
        const updated = current.filter(r => (r.key || r.id || r.resultId) !== resultId);
        window.localStorage.setItem(key, JSON.stringify(updated));
    } catch (err) {
        console.warn('Error removing stored result from localStorage:', err);
    }
};

export const saveResultEntry = async (result, schoolId) => {
    const targetSchoolId = schoolId || result.schoolId || result.eiinNumber || result.schoolCode;
    const resultId = result.key || buildResultDocId({
        studentId: result.studentId,
        subject: result.subject,
        examId: result.examId || result.term || 'current',
    });

    const docData = withWriteMetadata({
        resultId,
        schoolId: targetSchoolId || '',
        eiinNumber: result.eiinNumber || '',
        studentId: result.studentId,
        studentName: result.studentName || result.name || '',
        name: result.name || result.studentName || '',
        fatherName: result.fatherName || 'N/A',
        motherName: result.motherName || 'N/A',
        profilePic: result.profilePic || '',
        roll: result.roll || '',
        class: result.class || '',
        classId: cleanId(result.classId || result.class, 'class'),
        section: result.section || result.group || '',
        group: result.group || result.section || '',
        subject: result.subject || '',
        subjectId: cleanId(result.subject, 'subject'),
        examId: cleanId(result.examId || result.term || 'current', 'current'),
        session: result.session || new Date().getFullYear().toString(),
        marks: Number(result.marks),
        cqMarks: result.cqMarks != null && result.cqMarks !== '' ? Number(result.cqMarks) : null,
        mcqMarks: result.mcqMarks != null && result.mcqMarks !== '' ? Number(result.mcqMarks) : null,
        grade: result.grade || '',
        gradePoint: Number(result.gradePoint || 0),
        status: result.status || '',
        remarks: result.remarks || '',
        verification: {
            state: 'verified',
            source: result.verification?.source || 'app',
        },
        schemaVersion: 1,
    });

    saveStoredResultToLocal({ ...docData, key: resultId }, targetSchoolId);

    try {
        return await saveDocument(refs.result(resultId, targetSchoolId), docData);
    } catch (err) {
        if (err?.code === 'permission-denied' || String(err?.message || '').includes('permissions')) {
            console.warn('[Firestore] School-isolated result collection write blocked, writing to default collection fallback:', err);
            return await saveDocument(doc(db, COLLECTIONS.results, cleanId(resultId, 'result')), docData);
        }
        console.warn('Firestore result save warning (result kept locally):', err);
        return { id: resultId, ...docData };
    }
};

export const deleteResultEntry = (resultId, schoolId) => {
    removeStoredResultFromLocal(resultId, schoolId);
    return deleteDocument(refs.result(resultId, schoolId));
};
export const subscribeToResults = (onNext, onError, schoolId) => onSnapshot(collection(db, getSchoolCollectionName(COLLECTIONS.results, schoolId)), onNext, onError);
export const getResultsForStudent = async (studentId, schoolId) => {
    const resultsQuery = query(collection(db, getSchoolCollectionName(COLLECTIONS.results, schoolId)), where('studentId', '==', studentId));
    const snapshot = await getDocs(resultsQuery);
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
};

/**
 * Cascade deletion: Purges all result documents associated with deleted students.
 * @param {Array<{id?: string, studentId?: string, roll?: string, class?: string, className?: string, name?: string, studentName?: string}>} deletedStudents
 * @param {string} [schoolId]
 */
export const purgeResultsForStudents = async (deletedStudents = [], schoolId) => {
    if (!Array.isArray(deletedStudents) || deletedStudents.length === 0) return;

    try {
        const resultsCollName = getSchoolCollectionName(COLLECTIONS.results, schoolId);
        const resultsRef = collection(db, resultsCollName);
        const snapshot = await getDocs(resultsRef);

        const docsToDelete = [];
        snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const docId = docSnap.id;

            const isMatch = deletedStudents.some((st) => {
                if (!st) return false;
                const targetId = String(st.id || st.studentId || st.userId || '').trim().toLowerCase();
                const targetRoll = String(st.roll || '').trim();
                const targetClass = String(st.class || st.className || '').trim();
                const targetName = String(st.name || st.studentName || '').trim().toLowerCase();

                const dataStudentId = String(data.studentId || '').trim().toLowerCase();
                const dataRoll = String(data.roll || '').trim();
                const dataClass = String(data.class || '').trim();
                const dataName = String(data.name || data.studentName || '').trim().toLowerCase();

                // 1. Exact student ID match
                if (targetId && dataStudentId && targetId === dataStudentId) return true;

                // 2. Class + Roll match
                if (targetClass && dataClass && targetClass === dataClass && targetRoll && dataRoll && targetRoll === dataRoll) return true;

                // 3. Class + Name match
                if (targetClass && dataClass && targetClass === dataClass && targetName && dataName && targetName === dataName) return true;

                // 4. Document ID prefix match
                if (targetId && docId.toLowerCase().includes(targetId)) return true;

                return false;
            });

            if (isMatch) {
                docsToDelete.push(docSnap.ref);
            }
        });

        // Batch deletion in chunks of 500
        const CHUNK_SIZE = 500;
        for (let i = 0; i < docsToDelete.length; i += CHUNK_SIZE) {
            const chunk = docsToDelete.slice(i, i + CHUNK_SIZE);
            const batch = writeBatch(db);
            chunk.forEach((ref) => batch.delete(ref));
            await batch.commit();
        }
    } catch (err) {
        console.warn('Could not purge student results from Firestore:', err);
    }
};

export const saveExamSession = async (examSession, schoolId) => {
    const targetSchoolId = schoolId || examSession.schoolId || examSession.eiinNumber || examSession.schoolCode;
    const examId = examSession.examId || examSession.key || cleanId(`${examSession.name}-${examSession.targetClass}`, 'exam');
    const docData = withWriteMetadata({
        examId,
        schoolId: targetSchoolId || '',
        eiinNumber: examSession.eiinNumber || '',
        name: examSession.name,
        targetClass: examSession.targetClass,
        branchKey: examSession.branchKey || '',
        subjectRules: examSession.subjectRules || {},
        status: examSession.status || 'active',
        schemaVersion: 1,
    });

    try {
        return await saveDocument(refs.exam(examId, targetSchoolId), docData);
    } catch (err) {
        if (err?.code === 'permission-denied' || String(err?.message || '').includes('permissions')) {
            console.warn('[Firestore] School-isolated exam collection write blocked, writing to default collection fallback:', err);
            return await saveDocument(doc(db, COLLECTIONS.exams, cleanId(examId, 'exam')), docData);
        }
        throw err;
    }
};

export const deleteExamSession = (examId, schoolId) => deleteDocument(refs.exam(examId, schoolId));
export const subscribeToExams = (onNext, onError, schoolId) => onSnapshot(collection(db, getSchoolCollectionName(COLLECTIONS.exams, schoolId)), onNext, onError);
export const subscribeToTeacherPanelData = (onNext, onError, schoolId) => onSnapshot(refs.teacherPanel(schoolId), onNext, onError);

/**
 * Provision a brand-new, isolated school portal in Firebase Firestore
 * linked to the Google Admin UID.
 */
export const provisionNewSchoolPortal = async ({ googleUser, schoolDetails }) => {
    const schoolCode = cleanId(schoolDetails.schoolCode || schoolDetails.schoolName, 'school');
    const adminUserId = cleanId(schoolDetails.adminUserId || `admin-${schoolCode}`, 'admin');

    // Ensure active Firebase Auth session for Firestore security rule compliance
    let currentAuthUser = auth?.currentUser;
    if (!currentAuthUser && auth) {
        try {
            const anonCred = await signInAnonymously(auth);
            currentAuthUser = anonCred.user;
        } catch (anonErr) {
            console.warn('[Firebase Auth] Anonymous auth initialization warning:', anonErr?.message || anonErr);
        }
    }

    const effectiveUid = googleUser?.uid || currentAuthUser?.uid || googleUser?.userId || null;
    const effectiveName = schoolDetails.adminName || googleUser?.displayName || currentAuthUser?.displayName || googleUser?.name || 'School Admin';
    const effectiveEmail = schoolDetails.adminEmail || googleUser?.email || currentAuthUser?.email || '';
    const effectiveRole = googleUser?.role || (googleUser?.isSuperAdmin ? 'superadmin' : 'admin');

    const profileData = {
        schoolId: schoolCode,
        schoolName: schoolDetails.schoolName || 'New School Portal',
        eiinNumber: String(schoolDetails.eiinNumber || '').trim(),
        location: schoolDetails.location || '',
        schoolCode: schoolCode,
        schoolType: schoolDetails.schoolType || 'combined',
        logo: schoolDetails.logo || '',
        adminName: effectiveName,
        adminTitle: schoolDetails.adminTitle || 'Administrator',
        adminEmail: effectiveEmail,
        adminPhone: schoolDetails.adminPhone || '',
        ownerUid: effectiveUid,
        createdByRole: effectiveRole,
        language: 'bn',
        schemaVersion: 1,
    };

    // Default classes based on school branch / type
    let defaultClasses = [];
    const type = String(schoolDetails.schoolType || 'combined').toLowerCase();
    if (type === 'primary') {
        defaultClasses = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'];
    } else if (type === 'secondary') {
        defaultClasses = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
    } else if (type === 'college') {
        defaultClasses = ['Class 11', 'Class 12'];
    } else {
        defaultClasses = [
            'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
            'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
            'Class 11', 'Class 12'
        ];
    }

    const defaultTeacherPanel = {
        classes: defaultClasses,
        teachers: [],
        teacherRoutines: {},
        timeSlots: [
            "৯:০০-৯:৫০", "৯:৫০-১০:৩৫", "১০:৩৫-১১:২০",
            "১১:২০-১২:০৫", "১২:০৫-১২:৫০", "১:৩০-২:১০", "২:১০-২:৫০"
        ],
        schoolId: schoolCode,
        schemaVersion: 1
    };

    const adminAccount = {
        userId: adminUserId,
        name: profileData.adminName,
        password: schoolDetails.adminPassword || 'admin',
        role: 'admin',
        isSuperAdmin: false,
        email: profileData.adminEmail,
        phone: profileData.adminPhone,
        eiinNumber: profileData.eiinNumber,
        schoolCode: schoolCode,
        schoolId: schoolCode,
        schoolName: profileData.schoolName,
        googleUid: effectiveUid,
        createdByRole: effectiveRole,
        status: 'active',
        schemaVersion: 1,
    };

    // 1. Attempt Cloud Firestore provisioning with graceful error catching
    let cloudSynced = false;
    let cloudSyncError = null;

    try {
        await saveSchoolProfile(profileData, schoolCode);
        await saveUserAccount(adminAccount);
        await saveTeacherPanelData(defaultTeacherPanel, schoolCode);
        cloudSynced = true;
    } catch (err) {
        cloudSyncError = err?.message || String(err);
        console.warn('[Firestore Provisioning Warning] Cloud write skipped or failed (permission/offline). Falling back to local store:', err);
    }

    // 2. Return provisioned structures for local state & storage sync
    return {
        schoolProfile: profileData,
        adminAccount,
        teacherPanel: defaultTeacherPanel,
        cloudSynced,
        cloudSyncError,
    };
};

/**
 * Fetch all registered school profiles from Firestore schools collection.
 */
export const getRegisteredSchoolsFromFirestore = async () => {
    try {
        const snapshot = await getDocs(collection(db, 'schools'));
        const schools = [];
        snapshot.forEach((item) => {
            if (item.exists()) {
                schools.push({ id: item.id, ...item.data() });
            }
        });
        return schools;
    } catch (err) {
        console.warn('Could not fetch registered schools from Firestore:', err);
        return [];
    }
};

export const deleteSchoolPortalFromFirestore = async (schoolId) => {
    if (!schoolId || schoolId === 'PROGGA_DEFAULT' || schoolId === 'SCHOLASTICBASE_DEFAULT') return;
    try {
        await ensureFirebaseAuth();
        const clean = cleanId(schoolId, 'school');
        const raw = String(schoolId).trim();
        await deleteDocument(doc(db, 'schools', clean));
        if (raw && raw !== clean) {
            await deleteDocument(doc(db, 'schools', raw));
        }
    } catch (err) {
        console.warn('Could not delete school document from Firestore:', err);
    }
};



