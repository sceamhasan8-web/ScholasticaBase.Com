import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { deleteResultEntry, saveResultEntry, subscribeToResults, subscribeToExams, saveExamSession, deleteExamSession, getStoredResultsFromLocal, subscribeToTeacherPanelData, saveTeacherPanelData } from '../firebase/firestoreSchema.js';
import { getBangladeshGradeInfo, getDynamicGradeInfo, getDynamicGradeInfoWithComponents, resolveRuleTotals } from '../utils/bangladeshGrading.js';
import { useSchoolProfile } from '../context/SchoolProfileContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useViewMode } from '../context/ViewModeContext.jsx';
import { getSchoolNameByClass, getBranchKeyByClass, getBranchByClass, SCHOOL_BRANCHES, sortClasses } from '../utils/schoolResolver.js';
import useTranslation from '../hooks/useTranslation.js';
import useConfirm from '../hooks/useConfirm.js';
import useAlert from '../hooks/useAlert.js';
import { convertToWebP } from '../utils/imageOptimizer.js';
import PrintContainer from './PrintContainer.jsx';
import './ExamResultView.css';

/* ─────────────────────────────────────────────────────────────
   Student Results Data with Father's Name
   ───────────────────────────────────────────────────────────── */
const STUDENT_RESULTS_DATA = [];

const ChevronLeft = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

/* ─────────────────────────────────────────────────────────────
   Status Badge Component
   ───────────────────────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const colors = {
    'Pass': { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
    'Fail': { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
  };
  const style = colors[status] || { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };

  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 14px',
      borderRadius: '20px',
      background: style.bg,
      color: style.text,
      fontSize: '12px',
      fontWeight: '700',
      border: `1px solid ${style.border}`,
      letterSpacing: '.02em',
    }}>
      {status}
    </span>
  );
};

/* ─────────────────────────────────────────────────────────────
   Grade Badge Component
   ───────────────────────────────────────────────────────────── */
const GradeBadge = ({ grade }) => {
  const gradeColors = {
    'A+': '#6d28d9',
    'A': '#1d4ed8',
    'A-': '#0369a1',
    'B': '#15803d',
    'C': '#b45309',
    'D': '#c2410c',
    'F': '#b91c1c',
  };

  return (
    <span style={{
      display: 'inline-block',
      padding: '5px 12px',
      borderRadius: '6px',
      background: gradeColors[grade] || '#475569',
      color: '#fff',
      fontSize: '13px',
      fontWeight: '800',
      minWidth: '36px',
      textAlign: 'center',
      letterSpacing: '.04em',
    }}>
      {grade}
    </span>
  );
};

const DEFAULT_SUBJECTS = ['Mathematics', 'English', 'Science'];

const getStoredExamSessions = (schoolId) => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const key = schoolId ? `progga_exam_sessions_${schoolId}` : 'progga_exam_sessions';
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStoredExamSessions = (sessions, schoolId) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const key = schoolId ? `progga_exam_sessions_${schoolId}` : 'progga_exam_sessions';
    const jsonStr = JSON.stringify(sessions);
    window.localStorage.setItem(key, jsonStr);
  } catch (err) {
    console.warn('Error writing exam sessions to localStorage:', err);
  }
};

const normalizeSubjects = (subjects) => Array.isArray(subjects)
  ? [...new Set(subjects.map((subject) => String(subject || '').trim()).filter(Boolean))]
  : [];

const getSubjectResults = (student = {}, className = '', configuredSubjects = DEFAULT_SUBJECTS) => {
  const seed = `${className}-${student?.roll || '00'}-${student?.name || 'student'}`.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const subjects = normalizeSubjects(configuredSubjects);
  const subjectList = subjects.length > 0 ? subjects : DEFAULT_SUBJECTS;

  return subjectList.map((subjectName, index) => {
    const base = 56 + ((index * 4) % 12);
    const marks = Math.min(100, base + (seed % 20) + (subjectName.length % 8));
    const gradeInfo = getBangladeshGradeInfo(marks);

    return {
      subject: subjectName,
      marks,
      status: gradeInfo.status,
      grade: gradeInfo.grade,
      gradePoint: gradeInfo.gradePoint,
      remarks: gradeInfo.remarks,
    };
  });
};

/* ═════════════════════════════════════════════════════════════
   Main Component
   ═════════════════════════════════════════════════════════════ */
export default function ExamResultView({ classes = [], defaultToEntry = false, readOnly = false }) {
  const schoolProfileCtx = useSchoolProfile() || {};
  const schoolProfile = schoolProfileCtx.schoolProfile || schoolProfileCtx.defaultSchoolProfile || {};

  const authCtx = useAuth() || {};
  const user = authCtx.user || null;

  const viewModeCtx = useViewMode() || {};
  const effectiveUser = viewModeCtx.effectiveUser || user;

  const translationCtx = useTranslation() || {};
  const t = translationCtx.t || ((key) => key);

  const confirm = useConfirm();
  const { showAlert } = useAlert();

  const activeSchoolId = schoolProfile?.schoolId
    || schoolProfile?.schoolCode
    || schoolProfile?.eiinNumber
    || effectiveUser?.schoolId
    || effectiveUser?.schoolCode
    || effectiveUser?.eiinNumber
    || user?.schoolId
    || user?.schoolCode
    || user?.eiinNumber
    || (Array.isArray(classes) && classes.find((c) => c?.schoolId)?.schoolId)
    || (typeof window !== 'undefined' && window.localStorage
      ? (window.localStorage.getItem('schoolId') || window.localStorage.getItem('schoolCode') || window.localStorage.getItem('schoolEiinNumber'))
      : '')
    || '';

  // Search & Filter States
  const [searchClass, setSearchClass] = useState('');
  const [searchRoll, setSearchRoll] = useState('');
  const [searchGroup, setSearchGroup] = useState('');
  const [searchSubject, setSearchSubject] = useState('');
  const [selectedStudentKey, setSelectedStudentKey] = useState(null);
  const [showEntryForm, setShowEntryForm] = useState(!readOnly && defaultToEntry);
  const [editingResultKey, setEditingResultKey] = useState(null);
  const [editingResultSource, setEditingResultSource] = useState(null);
  const [entryMeta, setEntryMeta] = useState({
    class: '',
    roll: '',
    name: '',
    fatherName: '',
    motherName: '',
    studentId: '',
    group: '',
    profilePic: '',
  });
  const [entryRows, setEntryRows] = useState([
    { id: `${Date.now()}-1`, subject: DEFAULT_SUBJECTS[0], cqMarks: '', mcqMarks: '' },
  ]);
  const [enteredResults, setEnteredResults] = useState([]);
  const [firestoreResults, setFirestoreResults] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedResultKeys, setSelectedResultKeys] = useState([]);
  const [deletedResultKeys, setDeletedResultKeys] = useState([]);
  const [screenScale, setScreenScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      const w = window.innerWidth;
      if (w < 820) {
        const padding = 16;
        const targetW = 794;
        const availableW = Math.max(280, w - padding);
        const scale = Math.max(0.35, Math.min(1.0, availableW / targetW));
        setScreenScale(scale);
      } else {
        setScreenScale(1);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Ref for the tabulation sheet DOM node (used for targeted print)
  const tabulationRef = useRef(null);

  // Exam States
  const [examSessions, setExamSessions] = useState(() => getStoredExamSessions(activeSchoolId));
  const [selectedExamSession, setSelectedExamSession] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [deletedExamKeys, setDeletedExamKeys] = useState(() => {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const key = activeSchoolId ? `progga_deleted_exams_${activeSchoolId}` : 'progga_deleted_exams';
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const key = activeSchoolId ? `progga_deleted_exams_${activeSchoolId}` : 'progga_deleted_exams';
      const raw = window.localStorage.getItem(key);
      setDeletedExamKeys(raw ? JSON.parse(raw) : []);
    } catch {
      setDeletedExamKeys([]);
    }
  }, [activeSchoolId]);

  const handleDeleteExamSessionCard = async (e, exam) => {
    if (e) e.stopPropagation();
    const examName = exam?.name || 'Exam';
    const targetClass = exam?.targetClass ? ` (${exam.targetClass})` : '';
    const isConfirmed = await confirm({
      title: 'Delete Exam Confirmation',
      message: `Are you sure you want to delete the exam "${examName}"${targetClass}? This will permanently remove the exam configuration and its results.`,
      confirmText: 'OK, Delete',
      cancelText: 'Cancel'
    });
    if (isConfirmed) {
      const targetExamId = exam?.examId || exam?.id || exam?.key;
      const examClass = exam?.targetClass;

      const matchingResults = (firestoreResults || []).filter(
        (r) => (r.examId || 'current') === targetExamId && (!examClass || r.class === examClass)
      );

      let nextExamSessions = [];
      setExamSessions((prev) => {
        nextExamSessions = prev.filter(
          (item) =>
            (item?.examId || item?.id || item?.key) !== targetExamId ||
            (examClass && item?.targetClass !== examClass)
        );
        saveStoredExamSessions(nextExamSessions, activeSchoolId);
        return nextExamSessions;
      });

      let nextResults = [];
      const matchingKeys = new Set(matchingResults.map((r) => r.key || r.id));

      setFirestoreResults((prev) => {
        nextResults = prev.filter((r) => !matchingKeys.has(r.key || r.id));
        try {
          const key = activeSchoolId ? `progga_stored_results_${activeSchoolId}` : 'progga_stored_results';
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(key, JSON.stringify(nextResults));
          }
        } catch { }
        return nextResults;
      });

      setEnteredResults((prev) =>
        prev.filter(
          (r) => !((r.examId || 'current') === targetExamId && (!examClass || r.class === examClass))
        )
      );

      const keysToAdd = [
        targetExamId,
        `${targetExamId}::${examClass}`,
        `${examName}::${examClass}`,
      ].filter(Boolean);

      setDeletedExamKeys((prev) => {
        const next = [...new Set([...prev, ...keysToAdd])];
        if (typeof window !== 'undefined' && window.localStorage) {
          const key = activeSchoolId ? `progga_deleted_exams_${activeSchoolId}` : 'progga_deleted_exams';
          window.localStorage.setItem(key, JSON.stringify(next));
        }
        return next;
      });

      // Synchronize deletion to Central TeacherPanel Firestore document (Class-style Realtime Delete Sync!)
      saveTeacherPanelData({ examSessions: nextExamSessions, storedResults: nextResults }, activeSchoolId).catch(() => { });

      // Perform async deletion in background collections
      (async () => {
        if (targetExamId) {
          try {
            await deleteExamSession(targetExamId, activeSchoolId);
          } catch (err) {
            console.warn('Document delete in exams collection failed or missing:', err);
          }
        }

        if (matchingResults.length > 0) {
          try {
            await Promise.all(
              matchingResults.map((r) => deleteResultEntry(r.key || r.id, activeSchoolId))
            );
          } catch (err) {
            console.warn('Deleting result entries failed:', err);
          }
        }
      })();

      if (
        selectedExamSession &&
        ((selectedExamSession?.examId || selectedExamSession?.id || selectedExamSession?.key) === targetExamId &&
          (!examClass || selectedExamSession?.targetClass === examClass))
      ) {
        setSelectedExamSession(null);
      }
    }
  };

  useEffect(() => {
    // Initial load from local storage
    const initialLocal = getStoredResultsFromLocal(activeSchoolId);
    if (initialLocal.length > 0) {
      setFirestoreResults(initialLocal);
    }

    const unsubscribe = subscribeToResults(
      (snapshot) => {
        if (!snapshot || !snapshot.docs) return;
        const firestoreDocs = snapshot.docs.map((item) => {
          const data = item.data() || {};
          const key = data.resultId || item.id;
          return { key, id: key, resultId: key, ...data };
        });
        const localDocs = getStoredResultsFromLocal(activeSchoolId);
        const map = new Map();
        // Add local docs first
        localDocs.forEach((item) => {
          const key = item?.key || item?.id || item?.resultId;
          if (key) map.set(key, item);
        });
        // Let live Firestore snapshot override local docs with authoritative server data
        firestoreDocs.forEach((item) => {
          const key = item?.key || item?.id || item?.resultId;
          if (key) map.set(key, item);
        });

        const mergedResults = Array.from(map.values());
        setFirestoreResults(mergedResults);

        // Sync local storage with latest merged snapshot
        try {
          const key = activeSchoolId ? `progga_stored_results_${activeSchoolId}` : 'progga_stored_results';
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(key, JSON.stringify(mergedResults));
          }
        } catch {
          // ignore storage quota error
        }
      },
      (err) => {
        const code = String(err?.code || '').toLowerCase();
        const msg = String(err?.message || '').toLowerCase();
        if (code !== 'permission-denied' && !msg.includes('permission')) {
          console.warn('Could not subscribe to result entries:', err?.message || err);
        }
        const localDocs = getStoredResultsFromLocal(activeSchoolId);
        if (localDocs.length > 0) setFirestoreResults(localDocs);
      },
      activeSchoolId
    );

    const handleStorageChange = (e) => {
      const storageKey = activeSchoolId ? `progga_stored_results_${activeSchoolId}` : 'progga_stored_results';
      if (e.key === storageKey && e.newValue) {
        try {
          const updatedLocal = JSON.parse(e.newValue);
          if (Array.isArray(updatedLocal)) {
            setFirestoreResults(updatedLocal);
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const unsubscribeTeacherPanel = subscribeToTeacherPanelData(
      (docSnap) => {
        if (!docSnap || !docSnap.exists()) return;
        const remoteData = docSnap.data();

        if (Array.isArray(remoteData?.examSessions)) {
          const freshExams = remoteData.examSessions.filter((exam) => {
            const k = exam?.examId || exam?.id || exam?.key;
            return k && !isExamDeleted(k, exam?.targetClass, exam?.name);
          });
          setExamSessions(freshExams);
          saveStoredExamSessions(freshExams, activeSchoolId);
        }

        if (Array.isArray(remoteData?.storedResults)) {
          setFirestoreResults(remoteData.storedResults);
          try {
            const key = activeSchoolId ? `progga_stored_results_${activeSchoolId}` : 'progga_stored_results';
            if (typeof window !== 'undefined' && window.localStorage) {
              window.localStorage.setItem(key, JSON.stringify(remoteData.storedResults));
            }
          } catch { }
        }
      },
      () => { },
      activeSchoolId
    );

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      if (typeof unsubscribeTeacherPanel === 'function') unsubscribeTeacherPanel();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [activeSchoolId]);

  useEffect(() => {
    const unsubscribe = subscribeToExams(
      (snapshot) => {
        if (!snapshot || !snapshot.docs) return;
        const firestoreDocs = snapshot.docs.map((item) => {
          const data = item.data() || {};
          const examId = data.examId || item.id;
          return { key: item.id, id: item.id, examId, ...data };
        });

        const localDocs = getStoredExamSessions(activeSchoolId);
        const map = new Map();
        localDocs.forEach((item) => {
          const id = item?.examId || item?.id || item?.key;
          if (id && !deletedExamKeys.includes(id)) map.set(id, item);
        });

        const activeServerExamIds = new Set();
        firestoreDocs.forEach((item) => {
          const id = item?.examId || item?.id || item?.key;
          if (id && item?.status !== 'deleted') {
            activeServerExamIds.add(id);
            map.set(id, item);
          }
        });

        if (activeServerExamIds.size > 0 && Array.isArray(deletedExamKeys) && deletedExamKeys.length > 0) {
          const hasStaleKeys = deletedExamKeys.some((k) => activeServerExamIds.has(k) || activeServerExamIds.has(k.split('::')[0]));
          if (hasStaleKeys) {
            setDeletedExamKeys((prev) => {
              const next = prev.filter((k) => !activeServerExamIds.has(k) && !activeServerExamIds.has(k.split('::')[0]));
              if (typeof window !== 'undefined' && window.localStorage) {
                const storageKey = activeSchoolId ? `progga_deleted_exams_${activeSchoolId}` : 'progga_deleted_exams';
                window.localStorage.setItem(storageKey, JSON.stringify(next));
              }
              return next;
            });
          }
        }

        const merged = Array.from(map.values());
        setExamSessions(merged);
        saveStoredExamSessions(merged, activeSchoolId);
      },
      (err) => {
        const code = String(err?.code || '').toLowerCase();
        const msg = String(err?.message || '').toLowerCase();
        if (code !== 'permission-denied' && !msg.includes('permission')) {
          console.warn('Could not subscribe to exam sessions:', err?.message || err);
        }
        const localDocs = getStoredExamSessions(activeSchoolId);
        if (localDocs.length > 0) setExamSessions(localDocs);
      },
      activeSchoolId
    );

    const handleExamStorageChange = (e) => {
      const key = activeSchoolId ? `progga_exam_sessions_${activeSchoolId}` : 'progga_exam_sessions';
      if (e.key === key && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          if (Array.isArray(updated)) setExamSessions(updated);
        } catch {
          // ignore
        }
      }
    };
    const handleCustomExamsUpdate = () => {
      const localDocs = getStoredExamSessions(activeSchoolId);
      if (localDocs.length > 0) setExamSessions(localDocs);
    };

    window.addEventListener('storage', handleExamStorageChange);
    window.addEventListener('schoolExamsUpdate', handleCustomExamsUpdate);

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      window.removeEventListener('storage', handleExamStorageChange);
      window.removeEventListener('schoolExamsUpdate', handleCustomExamsUpdate);
    };
  }, [activeSchoolId, deletedExamKeys]);


  // Preset search class and entry form class when selecting exam session
  useEffect(() => {
    if (selectedExamSession) {
      setSearchClass(selectedExamSession.targetClass);
      if (showEntryForm && !editingResultKey) {
        setEntryMeta(prev => ({
          ...prev,
          class: selectedExamSession.targetClass,
        }));
      }
    } else {
      setSearchClass('');
    }
  }, [selectedExamSession, showEntryForm, editingResultKey]);

  useEffect(() => {
    if (readOnly) {
      setShowEntryForm(false);
      setSelectionMode(false);
      setSelectedResultKeys([]);
    }
  }, [readOnly]);

  const getGradeFromMarks = (marks) => getBangladeshGradeInfo(marks).grade;

  const safeClasses = useMemo(() => sortClasses(Array.isArray(classes) ? classes : []), [classes]);
  const allowedClassNamesNormalized = useMemo(() =>
    new Set(safeClasses.map(c => String(c?.className || '').trim().toLowerCase()).filter(Boolean)),
    [safeClasses]
  );
  const hasClassScope = allowedClassNamesNormalized.size > 0;
  const isResultInAllowedClass = useCallback((result) => {
    if (!hasClassScope) return true;
    const resClass = String(result?.class || result?.targetClass || '').trim().toLowerCase();
    return allowedClassNamesNormalized.has(resClass);
  }, [hasClassScope, allowedClassNamesNormalized]);

  const classOptions = useMemo(() => sortClasses(safeClasses.map(c => c?.className).filter(Boolean)), [safeClasses]);
  const selectedClassData = safeClasses.find(c => c?.className === entryMeta.class);
  const selectedClassGroups = selectedClassData?.groups || [];
  const searchClassGroups = safeClasses.find(c => c?.className === searchClass)?.groups || [];
  const entrySubjectOptions = useMemo(() => {
    const groupSubjects = selectedClassData?.groupSubjects?.[entryMeta.group] || [];
    const classSubjects = Object.values(selectedClassData?.groupSubjects || {}).flat();
    const subjects = normalizeSubjects(groupSubjects.length > 0 ? groupSubjects : classSubjects);
    return subjects.length > 0 ? subjects : DEFAULT_SUBJECTS;
  }, [selectedClassData, entryMeta.group]);

  const handleEntryMetaChange = (field) => (event) => {
    setEntryMeta(prev => ({ ...prev, [field]: event.target.value }));
  };

  const handleClassChange = (event) => {
    const selectedClass = event.target.value;
    const classObject = safeClasses.find(c => c?.className === selectedClass);
    setEntryMeta(prev => ({
      ...prev,
      class: selectedClass,
      group: classObject?.groups?.[0] || '',
    }));
  };

  const handleRowChange = (rowId, field) => (event) => {
    setEntryRows(prev => prev.map(row => row.id === rowId ? { ...row, [field]: event.target.value } : row));
  };

  const addEntryRow = () => {
    if (readOnly) return;
    setEntryRows(prev => [
      ...prev,
      { id: `${Date.now()}-${prev.length + 1}`, subject: entrySubjectOptions[0] || DEFAULT_SUBJECTS[0], cqMarks: '', mcqMarks: '' },
    ]);
  };

  const cloneEntryRow = (rowId) => {
    if (readOnly) return;
    setEntryRows(prev => {
      const row = prev.find(r => r.id === rowId);
      if (!row) return prev;
      return [
        ...prev,
        { id: `${Date.now()}-${prev.length + 1}`, subject: row.subject, cqMarks: row.cqMarks, mcqMarks: row.mcqMarks },
      ];
    });
  };

  const removeEntryRow = (rowId) => {
    if (readOnly) return;
    setEntryRows(prev => prev.length > 1 ? prev.filter(row => row.id !== rowId) : prev);
  };

  const handleEditResult = (resultKey, source = 'local') => {
    if (readOnly) return;
    const results = (source === 'firestore' ? firestoreResults : enteredResults).filter(isResultInAllowedClass);
    const result = results.find(r => r.key === resultKey);
    if (!result) return;
    setEditingResultKey(resultKey);
    setEditingResultSource(source);
    setEntryMeta({
      class: result.class || '',
      roll: result.roll || '',
      name: result.name || result.studentName || '',
      fatherName: result.fatherName || '',
      motherName: result.motherName || '',
      studentId: result.studentId || '',
      group: result.group || result.section || '',
      profilePic: result.profilePic || '',
    });
    // Populate cqMarks/mcqMarks if available, otherwise put combined marks in cqMarks (legacy)
    setEntryRows([{
      id: `${Date.now()}-edit`,
      subject: result.subject,
      cqMarks: result.cqMarks != null ? String(result.cqMarks) : String(result.marks ?? ''),
      mcqMarks: result.mcqMarks != null ? String(result.mcqMarks) : '',
    }]);
    setShowEntryForm(true);
  };

  const resetEntryForm = () => {
    setEditingResultKey(null);
    setEditingResultSource(null);
    setEntryMeta({ class: '', roll: '', name: '', fatherName: '', motherName: '', studentId: '', group: '', profilePic: '' });
    setEntryRows([{ id: `${Date.now()}-1`, subject: DEFAULT_SUBJECTS[0], cqMarks: '', mcqMarks: '' }]);
  };

  const handlePhotoUpload = async (event) => {
    if (readOnly) return;
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const optimized = await convertToWebP(file, { maxWidth: 600, maxHeight: 600, quality: 0.8 });
      setEntryMeta(prev => ({ ...prev, profilePic: optimized.dataUrl }));
    } catch (err) {
      console.error('WebP conversion failed, falling back:', err);
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        setEntryMeta(prev => ({ ...prev, profilePic: loadEvent.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const getSelectionId = (resultKey, source = 'local') => `${source || 'local'}::${resultKey}`;

  const handleToggleResultSelection = (resultKey, source = 'local') => {
    if (readOnly || !resultKey) return;
    const selectionId = getSelectionId(resultKey, source);
    setSelectedResultKeys(prev => prev.includes(selectionId)
      ? prev.filter(item => item !== selectionId)
      : [...prev, selectionId]
    );
  };

  const handleToggleStudentSelection = (subjects = []) => {
    if (readOnly) return;
    const selectableIds = subjects
      .filter((subject) => subject?.resultKey)
      .map((subject) => getSelectionId(subject.resultKey, subject.resultSource));
    if (selectableIds.length === 0) return;

    setSelectedResultKeys((prev) => {
      const allSelected = selectableIds.every((selectionId) => prev.includes(selectionId));
      if (allSelected) return prev.filter((selectionId) => !selectableIds.includes(selectionId));
      return [...new Set([...prev, ...selectableIds])];
    });
  };

  const isStudentSelected = (subjects = []) => {
    const selectableIds = subjects
      .filter((subject) => subject?.resultKey)
      .map((subject) => getSelectionId(subject.resultKey, subject.resultSource));
    return selectableIds.length > 0 && selectableIds.every((selectionId) => selectedResultKeys.includes(selectionId));
  };

  const handleDeleteSelectedResults = async () => {
    if (readOnly || selectedResultKeys.length === 0) return;
    const count = selectedResultKeys.length;
    const shouldDelete = await confirm({
      title: 'Delete Selected Results?',
      message: `Are you sure you want to delete ${count} selected result ${count === 1 ? 'entry' : 'entries'}?`,
      confirmText: 'OK, Delete',
      cancelText: 'Cancel'
    });
    if (!shouldDelete) return;

    const localKeys = [];
    const firestoreKeys = [];
    const generatedKeys = [];
    selectedResultKeys.forEach((selectionId) => {
      const [source, ...keyParts] = selectionId.split('::');
      const resultKey = keyParts.join('::');
      if (source === 'firestore') {
        firestoreKeys.push(resultKey);
      } else if (source === 'generated') {
        generatedKeys.push(resultKey);
      } else {
        localKeys.push(resultKey);
      }
    });

    // Optimistically update UI local states instantly
    if (localKeys.length > 0) {
      setEnteredResults(prev => prev.filter(result => !localKeys.includes(result.key)));
    }
    if (firestoreKeys.length > 0) {
      const firestoreSet = new Set(firestoreKeys);
      setFirestoreResults(prev => prev.filter(r => !firestoreSet.has(r.key || r.id)));
    }
    if (generatedKeys.length > 0) {
      setDeletedResultKeys(prev => [...new Set([...prev, ...generatedKeys])]);
    }
    setSelectedResultKeys([]);
    setSelectionMode(false);
    setEditingResultKey(null);
    setEditingResultSource(null);

    // Asynchronously delete from Firestore in background
    if (firestoreKeys.length > 0) {
      Promise.all(firestoreKeys.map((resultKey) => deleteResultEntry(resultKey, activeSchoolId))).catch((err) => {
        console.warn('Could not delete selected results from Firestore:', err);
      });
    }
  };

  const handleDeleteResult = async (resultKey, source = 'local') => {
    if (readOnly || !resultKey) return;
    const shouldDelete = await confirm({
      title: 'Delete Result Entry?',
      message: 'Are you sure you want to delete this result entry? This operation cannot be undone.',
      confirmText: 'OK, Delete',
      cancelText: 'Cancel'
    });
    if (!shouldDelete) return;

    // Optimistically update UI local states instantly
    setSelectedResultKeys(prev => prev.filter(item => item !== getSelectionId(resultKey, source)));
    if (editingResultKey === resultKey) {
      resetEntryForm();
      setShowEntryForm(false);
    }

    if (source === 'generated') {
      setDeletedResultKeys(prev => [...new Set([...prev, resultKey])]);
      return;
    }

    if (source === 'firestore') {
      setFirestoreResults(prev => prev.filter(r => (r.key || r.id) !== resultKey));
      deleteResultEntry(resultKey, activeSchoolId).catch(err => {
        console.warn('Could not delete result from Firestore:', err);
      });
      return;
    }

    setEnteredResults(prev => prev.filter(result => result.key !== resultKey));
  };

  const handleAddResult = async (event) => {
    event.preventDefault();
    if (readOnly || !isResultInAllowedClass(entryMeta)) {
      return;
    }
    if (!entryMeta.class.trim() || !entryMeta.roll.trim() || !entryMeta.name.trim()) {
      return;
    }

    // A row is valid when it has a subject and at least a CQ mark (or legacy marks)
    const validRows = entryRows.filter(row =>
      row.subject.trim() && (String(row.cqMarks ?? '').trim() !== '' || String(row.marks ?? '').trim() !== '')
    );
    if (validRows.length === 0) {
      return;
    }

    if (editingResultKey) {
      const row = validRows[0];
      // Resolve rule for this subject from the exam session
      const results = (editingResultSource === 'firestore' ? firestoreResults : enteredResults).filter(isResultInAllowedClass);
      const originalResult = results.find(r => r.key === editingResultKey);
      const examIdToSave = originalResult?.examId || selectedExamSession?.examId || selectedExamSession?.id || selectedExamSession?.key || 'current';
      const examObj = examSessions.find(e => (e.examId || e.id || e.key) === examIdToSave) || selectedExamSession;
      const rule = examObj?.subjectRules?.[row.subject] || { totalMarks: 100, passMarks: 33 };
      const resolved = resolveRuleTotals(rule);

      let cqMarks, mcqMarks, marks;
      if (resolved.hasCqMcq) {
        cqMarks = Number(row.cqMarks ?? 0);
        mcqMarks = resolved.hasMcq ? Number(row.mcqMarks ?? 0) : 0;
        marks = cqMarks + mcqMarks;
      } else {
        // Legacy: cqMarks holds the single combined mark
        marks = parseInt(row.cqMarks ?? row.marks, 10);
        if (Number.isNaN(marks)) return;
        cqMarks = marks;
        mcqMarks = 0;
      }

      const gradeInfo = getDynamicGradeInfoWithComponents(cqMarks, mcqMarks, rule);
      const updatedResult = {
        class: entryMeta.class,
        roll: entryMeta.roll,
        name: entryMeta.name,
        studentName: entryMeta.name,
        fatherName: entryMeta.fatherName || 'N/A',
        motherName: entryMeta.motherName || 'N/A',
        studentId: entryMeta.studentId || 'N/A',
        group: entryMeta.group || 'N/A',
        section: entryMeta.group || 'N/A',
        profilePic: entryMeta.profilePic || '',
        subject: row.subject,
        marks,
        cqMarks,
        mcqMarks,
        status: gradeInfo.status,
        grade: gradeInfo.grade,
        gradePoint: gradeInfo.gradePoint,
        remarks: gradeInfo.remarks,
        examId: examIdToSave,
      };

      await saveResultEntry({ ...updatedResult, schoolId: activeSchoolId, key: editingResultKey }, activeSchoolId);
      setEnteredResults(prev => prev.map(result => result.key === editingResultKey ? {
        ...result,
        ...updatedResult,
      } : result));
    } else {
      const examIdToSave = selectedExamSession?.examId || selectedExamSession?.id || selectedExamSession?.key || 'current';
      const cleanStudentId = String(entryMeta.studentId || entryMeta.roll || entryMeta.name || 'stu')
        .trim()
        .toLowerCase()
        .replace(/[^\w\s\u0980-\u09FF-]/g, '')
        .replace(/[\s_]+/g, '-');
      const newRows = validRows.map(row => {
        const rule = selectedExamSession?.subjectRules?.[row.subject] || { totalMarks: 100, passMarks: 33 };
        const resolved = resolveRuleTotals(rule);

        let cqMarks, mcqMarks, marks;
        if (resolved.hasCqMcq) {
          cqMarks = Number(row.cqMarks ?? 0);
          mcqMarks = resolved.hasMcq ? Number(row.mcqMarks ?? 0) : 0;
          marks = cqMarks + mcqMarks;
        } else {
          marks = parseInt(row.cqMarks ?? row.marks, 10);
          cqMarks = Number.isNaN(marks) ? 0 : marks;
          mcqMarks = 0;
          marks = Number.isNaN(marks) ? 0 : marks;
        }

        const gradeInfo = getDynamicGradeInfoWithComponents(cqMarks, mcqMarks, rule);
        const resultKey = `${cleanStudentId}-${examIdToSave}-${row.subject}`.toLowerCase().replace(/[^\w\s\u0980-\u09FF-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-');
        return {
          class: entryMeta.class,
          roll: entryMeta.roll,
          name: entryMeta.name,
          studentName: entryMeta.name,
          fatherName: entryMeta.fatherName || 'N/A',
          motherName: entryMeta.motherName || 'N/A',
          studentId: cleanStudentId,
          group: entryMeta.group || 'N/A',
          section: entryMeta.group || 'N/A',
          profilePic: entryMeta.profilePic || '',
          subject: row.subject,
          marks,
          cqMarks,
          mcqMarks,
          status: gradeInfo.status,
          grade: gradeInfo.grade,
          gradePoint: gradeInfo.gradePoint,
          remarks: gradeInfo.remarks,
          examId: examIdToSave,
          schoolId: activeSchoolId,
          key: resultKey,
        };
      });

      await Promise.all(newRows.map(({ key, ...result }) => saveResultEntry({ ...result, schoolId: activeSchoolId, key }, activeSchoolId)));
      const allUpdatedResults = [...(enteredResults || []), ...(firestoreResults || []), ...newRows];
      saveTeacherPanelData({ storedResults: allUpdatedResults }, activeSchoolId).catch(() => { });
    }

    showAlert('Result saved and verified in Firebase successfully.', 'Result Saved', 'success');
    resetEntryForm();
    setShowEntryForm(false);
    setEditingResultKey(null);
    setEditingResultSource(null);
    setSelectedStudentKey(null);
  };

  // Get unique classes and prepare sorted data
  const uniqueClasses = useMemo(() => {
    const classNames = (classes || []).map(cls => cls.className).filter(Boolean);
    return [...new Set(classNames)].sort();
  }, [classes]);

  // Helper to check if an exam has been deleted
  const isExamDeleted = useCallback((examId, targetClass, examName) => {
    if (!deletedExamKeys || deletedExamKeys.length === 0) return false;
    const cleanId = String(examId || '').trim();
    const cleanClass = String(targetClass || '').trim();
    const cleanName = String(examName || '').trim();

    const existsInActiveExamSessions = Array.isArray(examSessions) && examSessions.some((e) => {
      const eId = String(e?.examId || e?.id || e?.key || '').trim();
      return eId && eId === cleanId && e?.status !== 'deleted';
    });
    if (existsInActiveExamSessions) return false;

    return (
      (cleanId && deletedExamKeys.includes(cleanId)) ||
      (cleanId && cleanClass && deletedExamKeys.includes(`${cleanId}::${cleanClass}`)) ||
      (cleanName && cleanClass && deletedExamKeys.includes(`${cleanName}::${cleanClass}`))
    );
  }, [deletedExamKeys, examSessions]);

  const allResults = useMemo(() => {
    return [...(enteredResults || []), ...(firestoreResults || [])];
  }, [enteredResults, firestoreResults]);

  // Helper to filter results for an exam card
  const getEnrolledResultsForExamCard = useCallback((examId, targetClass) => {
    const targetClassClean = String(targetClass || '').trim().toLowerCase();

    return (allResults || []).filter((r) => {
      if (!r) return false;
      const rClassClean = String(r?.class || '').trim().toLowerCase();
      const rExamClean = String(r?.examId || r?.term || 'current').trim().toLowerCase();
      const targetExamClean = String(examId || 'current').trim().toLowerCase();
      return rClassClean === targetClassClean && rExamClean === targetExamClean && isResultInAllowedClass(r);
    });
  }, [allResults, isResultInAllowedClass]);

  // Helper to resolve exams with results
  const uniqueExamIdsInResults = useMemo(() => {
    const ids = new Set();
    allResults.forEach((r) => {
      if (r) ids.add(r.examId || 'current');
    });
    return [...ids];
  }, [allResults]);

  const examsWithResults = useMemo(() => {
    const list = [];

    // 1. Add all configured exam sessions from Firebase
    if (Array.isArray(examSessions)) {
      examSessions.forEach((e) => {
        const examId = e?.examId || e?.id || e?.key;
        if (e && examId) {
          if (!isExamDeleted(examId, e.targetClass, e.name)) {
            list.push({
              ...e,
              examId,
              branchKey: e.branchKey || getBranchKeyByClass(e.targetClass || e),
            });
          }
        }
      });
    }

    // 2. Add legacy exam sessions only if they have results for enrolled students
    if (Array.isArray(uniqueExamIdsInResults)) {
      uniqueExamIdsInResults.forEach((examId) => {
        const matchingResults = allResults.filter(r => (r.examId || 'current') === examId);
        const targetClasses = [...new Set(matchingResults.map(r => r.class).filter(Boolean))];

        targetClasses.forEach((cls) => {
          const name = examId === 'current' ? 'General Term (Legacy)' : examId;
          if (isExamDeleted(examId, cls, name)) return;
          if (list.some((e) => e.examId === examId && String(e.targetClass || '').trim().toLowerCase() === String(cls || '').trim().toLowerCase())) return;

          // Do not include legacy exams if no enrolled students have results in this class
          const enrolledResults = getEnrolledResultsForExamCard(examId, cls);
          if (enrolledResults.length === 0) return;

          list.push({
            examId: examId,
            name: name,
            targetClass: cls,
            branchKey: getBranchKeyByClass(cls),
            subjectRules: {},
            isLegacy: true,
          });
        });
      });
    }
    return list;
  }, [examSessions, uniqueExamIdsInResults, allResults, isExamDeleted, getEnrolledResultsForExamCard]);

  // Group results by student for the selected exam session
  const studentResults = useMemo(() => {
    if (!selectedExamSession) return [];
    const grouped = {};
    let sequence = 0;

    const addStudent = (student, className) => {
      if (!student) return;
      const key = `${className}-${student?.roll || '00'}-${student?.name || 'Student'}`;
      if (!grouped[key]) {
        sequence += 1;
        grouped[key] = {
          key,
          class: className,
          roll: student?.roll || '00',
          name: student?.name || 'Student',
          fatherName: student?.fatherName || 'N/A',
          motherName: student?.motherName || 'N/A',
          studentId: student?.id || student?.studentId || 'N/A',
          group: student?.group || student?.section || 'N/A',
          profilePic: student?.profilePic || '',
          subjects: [],
          _resultOrder: sequence,
        };
      }
    };

    if (Array.isArray(classes) && classes.length > 0) {
      classes
        .filter((cls) => cls && cls.className === selectedExamSession?.targetClass)
        .forEach((cls) => {
          (cls.students || []).forEach((student) => addStudent(student, cls.className));
        });
    }

    const targetExamId = selectedExamSession?.examId || selectedExamSession?.id || selectedExamSession?.key;
    const targetClassClean = String(selectedExamSession?.targetClass || '').trim().toLowerCase();

    const activeResults = allResults.filter((r) => {
      if (!r) return false;
      const rClassClean = String(r?.class || '').trim().toLowerCase();
      const rExamClean = String(r?.examId || r?.term || 'current').trim().toLowerCase();
      const targetExamClean = String(targetExamId || 'current').trim().toLowerCase();

      const matchesClass = rClassClean === targetClassClean;
      const matchesExam = rExamClean === targetExamClean;
      return matchesClass && matchesExam && isResultInAllowedClass(r);
    });

    const targetClassData = (classes || []).find((cls) => cls && String(cls.className || '').trim().toLowerCase() === targetClassClean);
    const isClassDefinedInSchool = Boolean(targetClassData);
    const enrolledStudents = targetClassData?.students || [];

    activeResults.forEach((result) => {
      if (!result) return;
      const resultName = result?.name || result?.studentName || 'Unknown Student';

      let targetKey = null;

      if (isClassDefinedInSchool && enrolledStudents.length > 0) {
        const matchingStudent = enrolledStudents.find((s) => {
          if (!s) return false;
          const sId = String(s?.id || s?.studentId || s?.userId || '').trim().toLowerCase();
          const rId = String(result?.studentId || '').trim().toLowerCase();
          if (sId && rId && sId === rId) return true;

          const sRoll = String(s?.roll || '').trim().toLowerCase();
          const rRoll = String(result?.roll || '').trim().toLowerCase();
          const sRollNum = parseInt(sRoll, 10);
          const rRollNum = parseInt(rRoll, 10);
          const rollMatch = sRoll && rRoll && (sRoll === rRoll || (!isNaN(sRollNum) && sRollNum === rRollNum));

          const sName = String(s?.name || s?.studentName || '').trim().toLowerCase();
          const rName = String(resultName).trim().toLowerCase();
          const nameMatch = sName && rName && sName === rName;

          if (rollMatch && nameMatch) return true;
          if (rollMatch && (!rName || !sName)) return true;
          if (nameMatch && (!rRoll || !sRoll)) return true;

          return false;
        });

        if (matchingStudent) {
          targetKey = `${selectedExamSession?.targetClass || ''}-${matchingStudent?.roll || result?.roll || '00'}-${matchingStudent?.name || resultName}`;
        } else {
          targetKey = `${result?.class || selectedExamSession?.targetClass || ''}-${result?.roll || '00'}-${resultName}`;
        }
      } else {
        targetKey = `${result?.class || selectedExamSession?.targetClass || ''}-${result?.roll || '00'}-${resultName}`;
      }

      if (!grouped[targetKey]) {
        sequence += 1;
        grouped[targetKey] = {
          key: targetKey,
          class: result?.class || selectedExamSession?.targetClass || '',
          roll: result?.roll || '00',
          name: resultName,
          fatherName: result?.fatherName || 'N/A',
          motherName: result?.motherName || 'N/A',
          studentId: result?.studentId || 'N/A',
          group: result?.group || 'N/A',
          profilePic: result?.profilePic || '',
          subjects: [],
          _resultOrder: sequence,
        };
      }

      const rule = selectedExamSession?.subjectRules?.[result?.subject] || { totalMarks: 100, passMarks: 33 };

      const resolved = resolveRuleTotals(rule);

      const rawCq = result.cqMarks != null && result.cqMarks !== '' ? Number(result.cqMarks) : null;
      const rawMcq = result.mcqMarks != null && result.mcqMarks !== '' ? Number(result.mcqMarks) : null;
      const hasCqMcqData = rawCq != null && Number.isFinite(rawCq);

      const calculatedMarks = hasCqMcqData
        ? (rawCq + (rawMcq != null && Number.isFinite(rawMcq) ? rawMcq : 0))
        : Number(result.marks ?? 0);

      const gradeInfo = hasCqMcqData || resolved.hasCqMcq
        ? getDynamicGradeInfoWithComponents(
          hasCqMcqData ? rawCq : calculatedMarks,
          rawMcq ?? 0,
          rule
        )
        : getDynamicGradeInfo(calculatedMarks, resolved.totalMarks, resolved.passMarks);

      grouped[targetKey].subjects.push({
        subject: result.subject,
        marks: calculatedMarks,
        cqMarks: rawCq,
        mcqMarks: rawMcq,
        status: gradeInfo.status,
        grade: gradeInfo.grade,
        gradePoint: gradeInfo.gradePoint,
        remarks: gradeInfo.remarks,
        componentStatus: gradeInfo.componentStatus ?? null,
        failReason: gradeInfo.failReason ?? null,
        resultKey: result.key || result.resultId || `${result.studentId}-${result.subject}`,
        resultSource: firestoreResults.some((item) => (item.key || item.resultId) === (result.key || result.resultId)) ? 'firestore' : 'local',
      });
    });

    return Object.values(grouped);
  }, [classes, enteredResults, firestoreResults, selectedExamSession, isResultInAllowedClass]);

  // Filter based on search criteria
  const subjectOptions = useMemo(() => {
    const subjects = new Set();
    studentResults.forEach((student) => {
      (student.subjects || []).forEach((subject) => {
        if (subject?.subject) subjects.add(subject.subject);
      });
    });
    return [...subjects].sort();
  }, [studentResults]);

  const filteredResults = useMemo(() => {
    const hasClassFilter = Boolean(searchClass);
    const hasGroupFilter = Boolean(searchGroup);

    return studentResults.filter(student => {
      const classMatch = !hasClassFilter || student.class.toLowerCase() === searchClass.toLowerCase();
      const rollMatch = !searchRoll || student.roll === searchRoll;
      const groupMatch = !hasGroupFilter || student.group.toLowerCase() === searchGroup.toLowerCase();
      const subjectMatch = !searchSubject || (student.subjects || []).some((subject) => subject?.subject?.toLowerCase().includes(searchSubject.toLowerCase()));
      return classMatch && rollMatch && groupMatch && subjectMatch;
    });
  }, [studentResults, searchClass, searchRoll, searchGroup, searchSubject]);

  const calculateAverageMarks = (subjects = []) => {
    const marks = (subjects || [])
      .map((subject) => Number(subject?.marks))
      .filter((value) => Number.isFinite(value));

    if (marks.length === 0) return 0;
    return Math.round((marks.reduce((sum, value) => sum + value, 0) / marks.length) * 10) / 10;
  };

  const calculateAverageGpa = (subjects = []) => {
    const rules = selectedExamSession?.subjectRules || {};
    let hasSubjectFail = false;
    const gradePoints = (subjects || [])
      .map((subject) => {
        const rule = rules[subject.subject] || { totalMarks: 100, passMarks: 33 };
        const resolved = resolveRuleTotals(rule);
        const hasCqMcqData = subject.cqMarks != null && Number.isFinite(Number(subject.cqMarks));
        const gradeInfo = hasCqMcqData || resolved.hasCqMcq
          ? getDynamicGradeInfoWithComponents(
            hasCqMcqData ? subject.cqMarks : subject.marks,
            subject.mcqMarks ?? 0,
            rule
          )
          : getDynamicGradeInfo(subject.marks, resolved.totalMarks, resolved.passMarks);

        if (subject.status === 'Fail' || subject.grade === 'F' || gradeInfo.grade === 'F' || gradeInfo.status === 'Fail') {
          hasSubjectFail = true;
        }
        return gradeInfo.gradePoint;
      });

    if (hasSubjectFail) return 0.00;
    if (gradePoints.length === 0) return 0;
    return Math.round((gradePoints.reduce((sum, value) => sum + value, 0) / gradePoints.length) * 100) / 100;
  };

  const getProficiencyFromPercentage = (percentage) => getBangladeshGradeInfo(percentage).remarks;

  // Returns the expected subject list for a student based on their exam config or class+group config
  const getExpectedSubjects = (student) => {
    if (selectedExamSession?.subjectRules && Object.keys(selectedExamSession.subjectRules).length > 0) {
      return Object.keys(selectedExamSession.subjectRules).map((sub) => String(sub || '').trim()).filter(Boolean);
    }

    const classData = (classes || []).find((c) => c.className === student.class);
    if (!classData || !classData.groupSubjects) return [];

    const studentGroup = String(student.group || '').trim();
    let expected = [];
    if (studentGroup && classData.groupSubjects[studentGroup]) {
      expected = classData.groupSubjects[studentGroup] || [];
    } else {
      // If student.group is N/A, empty or not matched, check if there is only one group configured
      const groups = Object.keys(classData.groupSubjects);
      if (groups.length === 1) {
        expected = classData.groupSubjects[groups[0]] || [];
      } else {
        // Fallback: union of all configured group subjects
        const allSubjects = Object.values(classData.groupSubjects).flat();
        expected = [...new Set(allSubjects)];
      }
    }
    return expected.map((sub) => String(sub || '').trim()).filter(Boolean);
  };

  // A student's result is complete only when ALL expected subjects have been entered
  const isResultComplete = (student) => {
    const expected = getExpectedSubjects(student);
    if (expected.length === 0) return student.subjects.length > 0;
    const enteredSubjectNames = new Set(
      (student.subjects || []).map((s) => String(s.subject || '').trim().toLowerCase())
    );
    return expected.every((sub) => enteredSubjectNames.has(sub.toLowerCase()));
  };

  const calculateResultSummary = (subjects = [], complete = true, studentObj = null) => {
    const rules = selectedExamSession?.subjectRules || {};
    let totalMarksObtained = 0;
    let maxConfiguredMarks = 0;
    let totalGradePoint = 0;
    let hasSubjectFail = false;

    // Resolve expected subject list for accurate total max marks calculation
    const expectedSubjectsList = studentObj ? getExpectedSubjects(studentObj) : (selectedExamSession?.subjectRules ? Object.keys(selectedExamSession.subjectRules) : []);
    const countedSubjectKeys = new Set();

    if (expectedSubjectsList.length > 0) {
      expectedSubjectsList.forEach((subName) => {
        const key = String(subName).trim().toLowerCase();
        countedSubjectKeys.add(key);
        const rule = rules[subName] || { totalMarks: 100, passMarks: 33 };
        const resolved = resolveRuleTotals(rule);
        maxConfiguredMarks += resolved.totalMarks;
      });
    }

    subjects.forEach((sub) => {
      const key = String(sub.subject || '').trim().toLowerCase();
      const rule = rules[sub.subject] || { totalMarks: 100, passMarks: 33 };
      const resolved = resolveRuleTotals(rule);
      const marks = Number(sub.marks);
      if (Number.isFinite(marks)) {
        totalMarksObtained += marks;
      }
      if (!countedSubjectKeys.has(key)) {
        countedSubjectKeys.add(key);
        maxConfiguredMarks += resolved.totalMarks;
      }

      // Re-compute with components if the subject has them
      const hasCqMcq = sub.cqMarks != null && Number.isFinite(Number(sub.cqMarks));
      const gradeInfo = hasCqMcq
        ? getDynamicGradeInfoWithComponents(sub.cqMarks, sub.mcqMarks ?? 0, rule)
        : getDynamicGradeInfo(marks, resolved.totalMarks, resolved.passMarks);

      if (gradeInfo.grade === 'F' || gradeInfo.status === 'Fail') {
        hasSubjectFail = true;
      }
      totalGradePoint += gradeInfo.gradePoint;
    });

    if (!complete || subjects.length === 0) {
      const percentage = maxConfiguredMarks > 0 ? (totalMarksObtained / maxConfiguredMarks) * 100 : 0;
      return {
        totalMarks: totalMarksObtained,
        maxMarks: maxConfiguredMarks,
        percentage: Math.round(percentage * 10) / 10,
        average: subjects.length > 0 ? Math.round((totalMarksObtained / subjects.length) * 10) / 10 : 0,
        averageGrade: 'Pending',
        gradePoint: 0.00,
        proficiency: 'Result Pending',
        status: 'Pending',
      };
    }

    const averageGpa = subjects.length > 0 ? totalGradePoint / subjects.length : 0;
    const percentage = maxConfiguredMarks > 0 ? (totalMarksObtained / maxConfiguredMarks) * 100 : 0;
    const averagePercentage = Math.round(percentage * 10) / 10;

    const gradeInfo = getBangladeshGradeInfo(averagePercentage);

    return {
      totalMarks: totalMarksObtained,
      maxMarks: maxConfiguredMarks,
      percentage: averagePercentage,
      average: subjects.length > 0 ? Math.round((totalMarksObtained / subjects.length) * 10) / 10 : 0,
      averageGrade: hasSubjectFail ? 'F' : gradeInfo.grade,
      gradePoint: hasSubjectFail ? 0.00 : Math.round(averageGpa * 100) / 100,
      proficiency: hasSubjectFail ? 'Fail' : gradeInfo.remarks,
      status: hasSubjectFail ? 'Fail' : 'Pass',
    };
  };

  const rankedFilteredResults = useMemo(() => {
    const withFlags = filteredResults.map((student) => {
      const complete = isResultComplete(student);
      const summary = calculateResultSummary(student.subjects, complete);
      return {
        ...student,
        averageMarks: complete ? calculateAverageMarks(student.subjects) : 0,
        averageGpa: complete ? calculateAverageGpa(student.subjects) : 0,
        isComplete: complete,
        status: summary.status,
      };
    });

    // Split student records into two distinct arrays: passedStudents and failedOrIncompleteStudents
    const passedStudents = withFlags.filter((s) => s.isComplete && s.status === 'Pass');
    const failedOrIncompleteStudents = withFlags.filter((s) => !s.isComplete || s.status === 'Fail');

    // Sort ONLY the passedStudents array down in descending order based on their cumulative average marks or GPA scores.
    passedStudents.sort((a, b) => {
      if (b.averageMarks !== a.averageMarks) return b.averageMarks - a.averageMarks;
      if ((a._resultOrder || 0) !== (b._resultOrder || 0)) return (a._resultOrder || 0) - (b._resultOrder || 0);
      return a.name.localeCompare(b.name);
    });

    const ranked = passedStudents.map((student, index) => ({ ...student, position: index + 1 }));
    const unranked = failedOrIncompleteStudents.map((student) => ({ ...student, position: null }));

    return [...ranked, ...unranked];
  }, [filteredResults, classes, t]);

  const overviewRows = useMemo(() => {
    return rankedFilteredResults.map((student) => {
      const subjectMap = {};
      (student.subjects || []).forEach((subject) => {
        subjectMap[subject.subject] = subject;
      });

      return {
        ...student,
        subjectMap,
        selectableSubjects: student.subjects || [],
      };
    });
  }, [rankedFilteredResults, t]);

  const visibleSubjectColumns = useMemo(() => {
    const subjectsSet = new Set();

    // 1. If selectedExamSession has configured subjectRules, prioritize those exact subjects for this exam
    if (selectedExamSession?.subjectRules && Object.keys(selectedExamSession.subjectRules).length > 0) {
      Object.keys(selectedExamSession.subjectRules).forEach((sub) => {
        if (sub && (!searchSubject || sub.toLowerCase().includes(searchSubject.toLowerCase()))) {
          subjectsSet.add(sub);
        }
      });
    }

    // 2. Add any subjects that already have results recorded in this specific exam session
    (rankedFilteredResults || []).forEach((student) => {
      (student.subjects || []).forEach((subObj) => {
        const subName = subObj?.subject;
        if (subName && (!searchSubject || subName.toLowerCase().includes(searchSubject.toLowerCase()))) {
          subjectsSet.add(subName);
        }
      });
    });

    // 3. Fallback ONLY if selectedExamSession has NO subjectRules configured and NO results entered yet
    if (subjectsSet.size === 0 && selectedExamSession?.targetClass) {
      const classObj = (classes || []).find((c) => c && c.className === selectedExamSession.targetClass);
      if (classObj?.groupSubjects) {
        Object.values(classObj.groupSubjects).forEach((subList) => {
          if (Array.isArray(subList)) {
            subList.forEach((s) => {
              if (s && (!searchSubject || s.toLowerCase().includes(searchSubject.toLowerCase()))) {
                subjectsSet.add(String(s).trim());
              }
            });
          }
        });
      }
      if (Array.isArray(classObj?.subjects)) {
        classObj.subjects.forEach((s) => {
          if (s && (!searchSubject || s.toLowerCase().includes(searchSubject.toLowerCase()))) {
            subjectsSet.add(String(s).trim());
          }
        });
      }
    }

    return [...subjectsSet].filter(Boolean);
  }, [selectedExamSession, classes, rankedFilteredResults, searchSubject]);

  const handleReset = () => {
    setSearchClass('');
    setSearchRoll('');
    setSearchGroup('');
    setSearchSubject('');
    setSelectedStudentKey(null);
  };

  const computeMarksheetZoom = () => {
    // Usable printable height safety limit for A4 portrait (@ 96 DPI: 289mm = ~1092px max, 900px is safe 1-page target)
    const TARGET_H = 900;

    const el = document.querySelector('.transcript-container');
    if (!el) return 1.0;

    const wasTranscriptMode = document.body.classList.contains('print-mode-transcript');
    document.body.classList.add('print-mode-transcript');

    // Force layout measurement at standard desktop print width
    const prevWidth = el.style.width;
    const prevZoom = el.style.zoom;

    el.style.width = '764px';
    el.style.zoom = '1';

    const measuredH = el.scrollHeight || 900;

    el.style.width = prevWidth;
    el.style.zoom = prevZoom;

    if (!wasTranscriptMode) {
      document.body.classList.remove('print-mode-transcript');
    }

    if (measuredH <= TARGET_H) {
      return 1.0;
    }

    const calculatedZoom = TARGET_H / measuredH;
    return Math.max(0.60, Math.min(1.0, calculatedZoom));
  };

  const _triggerMarksheetPrint = () => {
    document.body.classList.remove('print-mode-tabulation');
    document.body.classList.add('print-mode-transcript');

    const buildStyleContent = (zoomVal) => [
      '@media print {',
      '  @page { size: A4 portrait !important; margin: 3mm !important; }',
      '  @page portrait-page { size: A4 portrait !important; margin: 3mm !important; }',
      '  html, body {',
      '    width: 100% !important;',
      '    min-width: 100% !important;',
      '    max-width: 100% !important;',
      '    margin: 0 !important;',
      '    padding: 0 !important;',
      '    background: #ffffff !important;',
      '    overflow: visible !important;',
      '  }',
      '  body.print-mode-transcript,',
      '  body.print-mode-transcript #root,',
      '  body.print-mode-transcript .single-marksheet-page-view,',
      '  body.print-mode-transcript .single-marksheet-content-container,',
      '  body.print-mode-transcript .mark-sheet-print-area-wrapper,',
      '  body.print-mode-transcript .print-wrapper-root,',
      '  body.print-mode-transcript .print-container,',
      '  body.print-mode-transcript [data-print-container="true"] {',
      '    page: portrait-page !important;',
      '    position: static !important;',
      '    top: auto !important;',
      '    left: auto !important;',
      '    right: auto !important;',
      '    bottom: auto !important;',
      '    display: block !important;',
      '    width: 100% !important;',
      '    min-width: 100% !important;',
      '    max-width: 100% !important;',
      '    height: auto !important;',
      '    min-height: 0 !important;',
      '    max-height: none !important;',
      '    margin: 0 !important;',
      '    padding: 0 !important;',
      '    background: transparent !important;',
      '    box-shadow: none !important;',
      '    border: none !important;',
      '    transform: none !important;',
      '    overflow: visible !important;',
      '    z-index: auto !important;',
      '  }',
      '  body.print-mode-transcript .single-marksheet-content-container > div {',
      '    width: 100% !important;',
      '    max-width: 100% !important;',
      '  }',
      '  body.print-mode-transcript .mark-sheet-no-print,',
      '  body.print-mode-transcript .mark-sheet-actions,',
      '  body.print-mode-transcript .mark-sheet-screen-only,',
      '  body.print-mode-transcript .print-trigger-bar {',
      '    display: none !important;',
      '    visibility: hidden !important;',
      '    height: 0 !important;',
      '  }',
      '  body.print-mode-transcript .mark-sheet-screen-hidden {',
      '    display: block !important;',
      '    visibility: visible !important;',
      '    width: 100% !important;',
      '    min-width: 100% !important;',
      '    max-width: 100% !important;',
      '    margin: 0 !important;',
      '  }',
      '  .mark-sheet-print-area-wrapper {',
      '    display: block !important;',
      '    width: 100% !important;',
      '    min-width: 100% !important;',
      '    max-width: 100% !important;',
      '    margin: 0 !important;',
      '    padding: 0 !important;',
      '    box-sizing: border-box !important;',
      '  }',
      '  body.print-mode-transcript .transcript-container {',
      `    zoom: ${zoomVal.toFixed(4)} !important;`,
      '    transform: none !important;',
      '    -webkit-transform: none !important;',
      '    width: 100% !important;',
      '    min-width: 100% !important;',
      '    max-width: 100% !important;',
      '    box-sizing: border-box !important;',
      '    margin: 0 !important;',
      '    border: 4px double #1e3a8a !important;',
      '    outline: 2px solid #b91c1c !important;',
      '    outline-offset: -6px !important;',
      '    border-radius: 12px !important;',
      '    background: #FFF2F2 !important;',
      '    -webkit-print-color-adjust: exact !important;',
      '    print-color-adjust: exact !important;',
      '    overflow: visible !important;',
      '    page-break-inside: avoid !important;',
      '    break-inside: avoid !important;',
      '  }',
      '  body.print-mode-transcript .transcript-student-section {',
      '    display: grid !important;',
      '    grid-template-columns: 1fr 190px 105px !important;',
      '    gap: 10px !important;',
      '    align-items: start !important;',
      '    flex-direction: row !important;',
      '    width: 100% !important;',
      '  }',
      '  body.print-mode-transcript .transcript-student-grid {',
      '    display: flex !important;',
      '    flex-direction: column !important;',
      '    grid-template-columns: none !important;',
      '    width: 100% !important;',
      '    order: 1 !important;',
      '  }',
      '  body.print-mode-transcript .transcript-info-field {',
      '    display: flex !important;',
      '    justify-content: space-between !important;',
      '    align-items: center !important;',
      '    gap: 8px !important;',
      '    border-bottom: 1.5px dotted #a3b8cc !important;',
      '  }',
      '  body.print-mode-transcript .transcript-info-label {',
      '    font-size: 11.5px !important;',
      '    white-space: nowrap !important;',
      '  }',
      '  body.print-mode-transcript .transcript-info-value {',
      '    font-size: 13px !important;',
      '    text-align: right !important;',
      '  }',
      '  body.print-mode-transcript .transcript-grading-box {',
      '    width: 190px !important;',
      '    max-width: 190px !important;',
      '    margin: 0 !important;',
      '    order: 2 !important;',
      '  }',
      '  body.print-mode-transcript .transcript-photo-box {',
      '    margin: 0 !important;',
      '    order: 3 !important;',
      '  }',
      '  body.print-mode-transcript .transcript-performance-table {',
      '    width: 100% !important;',
      '    table-layout: auto !important;',
      '  }',
      '  body.print-mode-transcript .transcript-performance-table th,',
      '  body.print-mode-transcript .transcript-performance-table td {',
      '    word-break: normal !important;',
      '    white-space: normal !important;',
      '  }',
      '  body.print-mode-transcript .transcript-table-container {',
      '    overflow: visible !important;',
      '    width: 100% !important;',
      '  }',
      '  body.print-mode-transcript .transcript-summary-grid {',
      '    display: grid !important;',
      '    grid-template-columns: repeat(5, 1fr) !important;',
      '    background: #ffffff !important;',
      '    width: 100% !important;',
      '  }',
      '  body.print-mode-transcript .transcript-summary-cell {',
      '    border-right: 1px solid #cbd5e1 !important;',
      '    background: #ffffff !important;',
      '  }',
      '  body.print-mode-transcript .transcript-summary-cell:last-child {',
      '    border-right: none !important;',
      '    grid-column: auto !important;',
      '  }',
      '  body.print-mode-transcript .transcript-summary-label {',
      '    font-size: 9px !important;',
      '  }',
      '  body.print-mode-transcript .transcript-summary-value {',
      '    font-size: 14px !important;',
      '  }',
      '  body.print-mode-transcript .transcript-footer {',
      '    display: grid !important;',
      '    grid-template-columns: repeat(3, 1fr) !important;',
      '    align-items: end !important;',
      '    padding-top: 6px !important;',
      '    margin-bottom: 4px !important;',
      '    width: 100% !important;',
      '    box-sizing: border-box !important;',
      '    page-break-inside: avoid !important;',
      '    break-inside: avoid !important;',
      '  }',
      '  .transcript-signature-col {',
      '    display: flex !important;',
      '    flex-direction: column !important;',
      '    align-items: center !important;',
      '    width: 100% !important;',
      '  }',
      '  .transcript-signature-line {',
      '    width: 100% !important;',
      '    max-width: 170px !important;',
      '    border-top: 1.5px solid #1e3a8a !important;',
      '  }',
      '  .transcript-signature-label {',
      '    font-size: 10.5px !important;',
      '  }',
      '}',
    ].join('\n');

    const styleEl = document.createElement('style');
    styleEl.id = 'marksheet-portrait-override';
    styleEl.textContent = buildStyleContent(1.0);
    document.head.appendChild(styleEl);

    // Measure zoom after styles are applied
    const zoom = computeMarksheetZoom();
    styleEl.textContent = buildStyleContent(zoom);

    const cleanup = () => {
      document.body.classList.remove('print-mode-transcript');
      const el = document.getElementById('marksheet-portrait-override');
      if (el) el.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  const handlePrintMarkSheet = () => {
    if (typeof window !== 'undefined') _triggerMarksheetPrint();
  };

  const handleDownloadPdf = async () => {
    if (typeof window === 'undefined') return;
    const element = document.querySelector('.transcript-container');
    if (!element) return;

    try {
      const studentName = (selectedStudent?.name || 'Student').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
      const className = (selectedStudent?.class || 'Class').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
      const rollNo = (selectedStudent?.roll || '0').toString().trim();
      const filename = `${studentName}_Official_Marksheet_Class${className}_Roll${rollNo}.pdf`;

      // Store original inline style properties
      const prevZoom = element.style.zoom;
      const prevWebkitZoom = element.style.WebkitZoom;
      const prevWidth = element.style.width;
      const prevMargin = element.style.margin;

      // Force 1:1 scale during capture
      element.style.zoom = '1';
      element.style.WebkitZoom = '1';
      element.style.width = '794px';
      element.style.margin = '0 auto';

      // Load html2pdf dynamically if needed
      if (!window.html2pdf) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      if (window.html2pdf) {
        const opt = {
          margin: 0,
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            scrollY: 0,
            scrollX: 0,
            windowWidth: 794,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        };

        await window.html2pdf().set(opt).from(element).save();
      }

      // Restore original inline styles
      element.style.zoom = prevZoom;
      element.style.WebkitZoom = prevWebkitZoom;
      element.style.width = prevWidth;
      element.style.margin = prevMargin;
    } catch (err) {
      console.warn('html2pdf download error:', err);
    }
  };

  /**
   * handlePrintTabulation
   * Hides all DOM siblings of the tabulation sheet's ancestor chain so only
   * the sheet is in layout — allows multi-page pagination with position:static.
   */
  const handlePrintTabulation = useCallback(() => {
    if (typeof window === 'undefined') return;
    const sheet = tabulationRef.current;
    if (!sheet) { window.print(); return; }

    // Build ancestor set (from sheet up to body)
    const ancestors = new Set();
    let el = sheet.parentElement;
    while (el && el !== document.body) {
      ancestors.add(el);
      el = el.parentElement;
    }

    // Mark siblings at each ancestor level as print-hidden
    const hiddenEls = [];
    ancestors.forEach((ancestor) => {
      Array.from(ancestor.children).forEach((child) => {
        if (!ancestors.has(child) && child !== sheet && !sheet.contains(child)) {
          child.dataset.printHidden = 'true';
          hiddenEls.push(child);
        }
      });
    });
    // Also hide direct children of body that are not ancestors
    Array.from(document.body.children).forEach((child) => {
      if (!ancestors.has(child) && child !== sheet && !sheet.contains(child)) {
        child.dataset.printHidden = 'true';
        hiddenEls.push(child);
      }
    });

    document.body.classList.remove('print-mode-transcript');
    document.body.classList.add('print-mode-tabulation');

    const cleanup = () => {
      document.body.classList.remove('print-mode-tabulation');
      hiddenEls.forEach((hiddenEl) => delete hiddenEl.dataset.printHidden);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    // Small delay lets React flush DOM updates before print dialog opens
    setTimeout(() => window.print(), 60);
  }, []);

  const selectedStudent = useMemo(() => {
    const student = rankedFilteredResults.find(student => student.key === selectedStudentKey) || null;
    if (!student) return null;

    const matchedSubjects = (student.subjects || []).filter((subject) => {
      if (!searchSubject) return true;
      return subject?.subject?.toLowerCase().includes(searchSubject.toLowerCase());
    });

    return {
      ...student,
      subjects: matchedSubjects,
    };
  }, [rankedFilteredResults, selectedStudentKey, searchSubject]);

  const highestMarksMap = useMemo(() => {
    const map = {};
    const dataset = rankedFilteredResults.length > 0 ? rankedFilteredResults : (enteredResults || []);
    dataset.forEach((student) => {
      (student.subjects || []).forEach((sub) => {
        if (sub && sub.subject && sub.marks != null) {
          const val = Number(sub.marks);
          if (Number.isFinite(val)) {
            if (map[sub.subject] === undefined || val > map[sub.subject]) {
              map[sub.subject] = val;
            }
          }
        }
      });
    });
    return map;
  }, [rankedFilteredResults, enteredResults]);

  const classHighestTotalMarks = useMemo(() => {
    const dataset = rankedFilteredResults.length > 0 ? rankedFilteredResults : (enteredResults || []);
    let maxTotal = 0;
    dataset.forEach((student) => {
      const summary = calculateResultSummary(student.subjects || [], student.isComplete);
      if (summary && summary.totalMarks > maxTotal) {
        maxTotal = summary.totalMarks;
      }
    });
    return maxTotal > 0 ? maxTotal : null;
  }, [rankedFilteredResults, enteredResults]);

  const renderEntrySection = () => (
    <div className="mark-sheet-no-print" style={{
      background: '#fff',
      padding: '24px',
      borderRadius: '16px',
      marginBottom: '24px',
      border: '1.5px solid #bfdbfe',
      boxShadow: '0 4px 16px rgba(37,99,235,0.08)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '2px solid #eff6ff',
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#1a2e4a', letterSpacing: '-.01em' }}>{t('results.enterResult')}</h3>
          <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '13px', fontWeight: '500' }}>Add marks for multiple subjects in one submission.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowEntryForm(false);
            resetEntryForm();
          }}
          style={{
            padding: '9px 18px',
            fontSize: '13px',
            fontWeight: '700',
            background: '#f1f5f9',
            color: '#475569',
            border: '1.5px solid #e2e8f0',
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          ✕ Cancel
        </button>
      </div>

      <div style={{
        background: 'linear-gradient(135deg,#1e3a8a,#2563eb)',
        borderRadius: '14px',
        padding: '18px 20px',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '16px', color: '#fff', fontWeight: '800' }}>{entryMeta.name || 'Student Information'}</h4>
            <p style={{ margin: '5px 0 0', color: '#bfdbfe', fontSize: '13px', fontWeight: '500' }}>
              Roll: <strong style={{ color: '#fff' }}>{entryMeta.roll || 'N/A'}</strong> • Father: <strong style={{ color: '#fff' }}>{entryMeta.fatherName || 'N/A'}</strong> • Group: <strong style={{ color: '#fff' }}>{entryMeta.group || 'N/A'}</strong>
            </p>
          </div>
          <span style={{
            background: 'rgba(255,255,255,0.2)',
            color: '#fff',
            padding: '7px 16px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: '800',
            border: '1px solid rgba(255,255,255,0.3)',
          }}>
            {entryMeta.class || 'Class N/A'}
          </span>
        </div>
      </div>

      <form onSubmit={handleAddResult}>
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#1a2e4a', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em' }}>Class</label>
            <select value={entryMeta.class} onChange={handleClassChange} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #bfdbfe', background: '#f8fafc', color: '#0f172a', fontWeight: '600', cursor: 'pointer', outline: 'none' }}>
              <option value="">{t('results.selectClassFirst')}</option>
              {classOptions.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#1a2e4a', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('results.rollNumber')}</label>
            <input value={entryMeta.roll} onChange={handleEntryMetaChange('roll')} placeholder={t('results.rollNumber')} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#0f172a', fontWeight: '600', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#1a2e4a', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('results.studentName')}</label>
            <input value={entryMeta.name} onChange={handleEntryMetaChange('name')} placeholder={t('results.studentName')} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#0f172a', fontWeight: '600', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#1a2e4a', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('results.fatherName')}</label>
            <input value={entryMeta.fatherName} onChange={handleEntryMetaChange('fatherName')} placeholder={t('results.fatherName')} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#0f172a', fontWeight: '600', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#1a2e4a', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('results.motherName')}</label>
            <input value={entryMeta.motherName} onChange={handleEntryMetaChange('motherName')} placeholder={t('results.motherName')} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#0f172a', fontWeight: '600', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#1a2e4a', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('results.studentId')}</label>
            <input value={entryMeta.studentId} onChange={handleEntryMetaChange('studentId')} placeholder={t('results.studentId')} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#0f172a', fontWeight: '600', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#1a2e4a', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('results.photo')}</label>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#0f172a' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#1a2e4a', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('results.group')}</label>
            <select value={entryMeta.group} onChange={handleEntryMetaChange('group')} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #bfdbfe', background: '#f8fafc', color: '#0f172a', fontWeight: '600', cursor: 'pointer', outline: 'none' }}>
              <option value="">{t('results.selectGroupFirst')}</option>
              {selectedClassGroups.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: '24px', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '20px', background: '#f8fafc' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#1a2e4a' }}>{t('results.subjectRows')}</h4>
            <button
              type="button"
              onClick={addEntryRow}
              style={{
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: '700',
                background: 'linear-gradient(135deg,#1d4ed8,#2563eb)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
              }}
            >
              + Add Subject
            </button>
          </div>

          {entryRows.map((row, index) => {
            const rowRule = selectedExamSession?.subjectRules?.[row.subject] || { totalMarks: 100, passMarks: 33 };
            const rowResolved = resolveRuleTotals(rowRule);
            const rowHasCqMcq = rowResolved.hasCqMcq;
            const rowHasMcq = rowResolved.hasMcq;
            const cqMax = rowHasCqMcq ? Number(rowRule.cqTotal) : rowResolved.totalMarks;
            const mcqMax = rowHasCqMcq && rowHasMcq ? Number(rowRule.mcqTotal) : 40;
            const cqV = String(row.cqMarks ?? '');
            const mcqV = String(row.mcqMarks ?? '');
            const liveTotal = rowHasCqMcq
              ? (cqV !== '' || mcqV !== '' ? Number(cqV || 0) + Number(mcqV || 0) : null)
              : (cqV !== '' ? Number(cqV) : null);
            const rowCqFail = rowHasCqMcq && cqV !== '' && Number(cqV) < Number(rowRule.cqPass);
            const rowMcqFail = rowHasCqMcq && rowHasMcq && mcqV !== '' && Number(mcqV) < Number(rowRule.mcqPass);

            const isPrimarySession = selectedExamSession?.branchKey === 'primary' || getBranchKeyByClass(selectedExamSession?.targetClass) === 'primary';

            return (
              <div
                key={row.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: rowHasCqMcq
                    ? (rowHasMcq ? '1.6fr 1fr 1fr 0.7fr auto' : '1.6fr 1fr 0.7fr auto')
                    : '1.5fr 1fr auto',
                  gap: '12px',
                  alignItems: 'end',
                  marginBottom: '12px',
                  background: '#fff',
                  padding: '14px',
                  borderRadius: '12px',
                  border: `1px solid ${rowCqFail || rowMcqFail ? '#fca5a5' : '#e2e8f0'}`,
                }}
              >
                {/* Subject selector */}
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#1a2e4a', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em' }}>Subject</label>
                  <select value={row.subject} onChange={handleRowChange(row.id, 'subject')} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #bfdbfe', background: '#f0f7ff', color: '#0f172a', fontWeight: '600', cursor: 'pointer' }}>
                    {entrySubjectOptions.map((subject) => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>

                {/* CQ input */}
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: rowCqFail ? '#b91c1c' : '#1a2e4a', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    CQ <span style={{ fontWeight: 500, textTransform: 'none' }}>(0–{cqMax})</span>
                    {rowHasCqMcq && <span style={{ color: '#64748b' }}> Pass:{rowRule.cqPass}</span>}
                  </label>
                  <input
                    value={cqV}
                    onChange={handleRowChange(row.id, 'cqMarks')}
                    type="number"
                    min="0"
                    max={cqMax}
                    placeholder={`0–${cqMax}`}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: `1.5px solid ${rowCqFail ? '#fca5a5' : '#e2e8f0'}`,
                      background: rowCqFail ? '#fff5f5' : '#f8fafc',
                      color: '#0f172a',
                      fontWeight: '700',
                    }}
                  />
                </div>

                {/* MCQ / Tutorial input — only when rule has MCQ/Tutorial component */}
                {rowHasCqMcq && rowHasMcq && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', color: rowMcqFail ? '#b91c1c' : '#1a2e4a', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      {isPrimarySession ? 'Tutorial' : 'MCQ'} <span style={{ fontWeight: 500, textTransform: 'none' }}>(0–{mcqMax})</span>
                      <span style={{ color: '#64748b' }}> Pass:{rowRule.mcqPass}</span>
                    </label>
                    <input
                      value={mcqV}
                      onChange={handleRowChange(row.id, 'mcqMarks')}
                      type="number"
                      min="0"
                      max={mcqMax}
                      placeholder={`0–${mcqMax}`}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: `1.5px solid ${rowMcqFail ? '#fca5a5' : '#e2e8f0'}`,
                        background: rowMcqFail ? '#fff5f5' : '#f8fafc',
                        color: '#0f172a',
                        fontWeight: '700',
                      }}
                    />
                  </div>
                )}

                {/* Live total display */}
                {rowHasCqMcq && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '2px' }}>
                    <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Total</span>
                    <span style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: (rowCqFail || rowMcqFail) ? '#b91c1c' : liveTotal != null ? '#1a2e4a' : '#94a3b8',
                    }}>
                      {liveTotal != null ? liveTotal : '—'}
                    </span>
                    {(rowCqFail || rowMcqFail) && (
                      <span style={{ fontSize: 9, color: '#b91c1c', fontWeight: 800 }}>
                        {rowCqFail && rowMcqFail ? 'BOTH FAIL' : rowCqFail ? 'CQ FAIL' : 'MCQ FAIL'}
                      </span>
                    )}
                  </div>
                )}

                {/* Clone / Remove buttons */}
                <div style={{ display: 'flex', gap: '8px', paddingBottom: '2px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => cloneEntryRow(row.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #bfdbfe',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '12px',
                    }}
                  >
                    Clone
                  </button>
                  {entryRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEntryRow(row.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #fecaca',
                        background: '#fff5f5',
                        color: '#b91c1c',
                        cursor: 'pointer',
                        fontWeight: '700',
                        fontSize: '12px',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}

        </div>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={() => {
            setShowEntryForm(false);
            resetEntryForm();
          }} style={{ padding: '11px 20px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer', fontWeight: '600' }}>{t('common.cancel')}</button>
          <button type="submit" style={{ padding: '11px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', color: '#fff', cursor: 'pointer', fontWeight: '800', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>{editingResultKey ? t('results.saveChange') : t('results.saveResult')}</button>
        </div>
      </form>
    </div>
  );

  /* ─────────────────────────────────────────────────────────────
     Render: Search Panel
     ───────────────────────────────────────────────────────────── */
  const renderSearchPanel = () => (
    <div className="results-search-panel" style={{
      background: '#fff',
      padding: '0',
      borderRadius: '16px',
      marginBottom: '20px',
      border: '1.5px solid #e2e8f0',
      overflow: 'hidden',
      boxShadow: '0 4px 14px rgba(15,23,42,0.06)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '18px 22px',
        background: 'linear-gradient(135deg, #1e3a8a, #1d4ed8)',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>🔍</span>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '800',
            color: '#fff',
            letterSpacing: '-.01em',
          }}>
            {t('results.searchResults')}
          </h3>
        </div>
        <button
          onClick={handleReset}
          style={{
            padding: '7px 16px',
            fontSize: '12px',
            fontWeight: '700',
            background: 'rgba(255,255,255,0.18)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.3)'}
          onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.18)'}
        >
          ↺ Reset
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        padding: '20px 22px',
      }}>
        {/* Class Search */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: '700',
            color: '#1a2e4a',
            marginBottom: '7px',
            textTransform: 'uppercase',
            letterSpacing: '.06em',
          }}>
            {t('results.className')}
          </label>
          <select
            value={searchClass}
            onChange={e => {
              setSearchClass(e.target.value);
              setSearchGroup('');
            }}
            style={{
              width: '100%',
              padding: '11px 14px',
              fontSize: '14px',
              borderRadius: '10px',
              border: '1.5px solid #bfdbfe',
              background: selectedExamSession ? '#f1f5f9' : '#f0f7ff',
              color: '#1a2e4a',
              fontWeight: '600',
              cursor: selectedExamSession ? 'not-allowed' : 'pointer',
              outline: 'none',
            }}
            disabled={!!selectedExamSession}
            onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
            onBlur={e => { e.target.style.borderColor = '#bfdbfe'; e.target.style.boxShadow = 'none'; }}
          >
            <option value="">{t('common.allClasses')}</option>
            {classOptions.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>

        {/* Roll Number Search */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: '700',
            color: '#1a2e4a',
            marginBottom: '7px',
            textTransform: 'uppercase',
            letterSpacing: '.06em',
          }}>
            {t('results.rollNumber')}
          </label>
          <input
            type="text"
            placeholder="e.g., 01, 02"
            value={searchRoll}
            onChange={e => setSearchRoll(e.target.value)}
            style={{
              width: '100%',
              padding: '11px 14px',
              fontSize: '14px',
              borderRadius: '10px',
              border: '1.5px solid #e2e8f0',
              background: '#f8fafc',
              color: '#1a2e4a',
              fontWeight: '600',
              outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
            onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
          />
        </div>

        {/* Group Search */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: '700',
            color: '#1a2e4a',
            marginBottom: '7px',
            textTransform: 'uppercase',
            letterSpacing: '.06em',
          }}>
            {t('results.groupSection')}
          </label>
          <select
            value={searchGroup}
            onChange={e => setSearchGroup(e.target.value)}
            style={{
              width: '100%',
              padding: '11px 14px',
              fontSize: '14px',
              borderRadius: '10px',
              border: '1.5px solid #bfdbfe',
              background: !searchClass ? '#f1f5f9' : '#f0f7ff',
              color: '#1a2e4a',
              fontWeight: '600',
              cursor: !searchClass ? 'not-allowed' : 'pointer',
              outline: 'none',
              opacity: !searchClass ? 0.6 : 1,
            }}
            onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
            onBlur={e => { e.target.style.borderColor = '#bfdbfe'; e.target.style.boxShadow = 'none'; }}
            disabled={!searchClass}
          >
            <option value="">{t('common.allGroups')}</option>
            {searchClassGroups.map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>

      </div>

      <div style={{
        padding: '12px 22px 16px',
        fontSize: '13px',
        color: '#475569',
        fontWeight: '600',
        borderTop: '1px solid #f1f5f9',
        background: '#f8fafc',
        borderRadius: '0 0 14px 14px',
      }}>
        <span style={{ color: '#1d4ed8', fontWeight: '800' }}>{overviewRows.length}</span>
        {' '}{overviewRows.length === 1 ? 'student' : 'students'}
        {searchClass || searchGroup || searchSubject || searchRoll
          ? ` found${searchClass ? ` in ${searchClass}` : ''}${searchGroup ? ` • ${searchGroup}` : ''}`
          : ' total'}
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────────────────────
     Render: Student List
     ───────────────────────────────────────────────────────────── */
  const renderStudentList = () => {
    const totalColumnCount = (!readOnly && selectionMode ? 1 : 0) + 9 + visibleSubjectColumns.length;
    const activeExamTitle = selectedExamSession?.name || selectedExamSession?.title || selectedExamSession?.examName || 'Academic Result List & Tabulation Sheet';
    const mainSchoolName = schoolProfile?.schoolName || (typeof window !== 'undefined' ? window.localStorage.getItem('schoolName') : '') || 'ScholasticBase';
    const resolvedBranchObj = getBranchByClass(searchClass || '', schoolProfile);
    const resolvedBranchTitle = resolvedBranchObj?.name || selectedExamSession?.branch || (searchClass ? getSchoolNameByClass(searchClass, schoolProfile) : null);
    const schoolLocation = schoolProfile?.location || (typeof window !== 'undefined' ? window.localStorage.getItem('schoolLocation') : '');
    const schoolEiin = schoolProfile?.eiinNumber || (typeof window !== 'undefined' ? window.localStorage.getItem('schoolEiinNumber') : '');
    const schoolLogoUrl = schoolProfile?.logoUrl || schoolProfile?.logo || (typeof window !== 'undefined' ? window.localStorage.getItem('schoolLogo') : null);

    return (
      <div className="results-tabulation-sheet">
        <div className="tp-table-container tp-table-responsive" style={{ borderRadius: '14px', border: '1.5px solid #e2e8f0', overflowX: 'auto', WebkitOverflowScrolling: 'touch', boxShadow: '0 4px 20px rgba(15,23,42,0.07)' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            background: '#fff',
          }}>
            <thead>
              {/* ── Centered Institution, Branch & Exam Header (Repeated on Page 1, Page 2, Page 3...) ── */}
              <tr className="print-header-repeat-row">
                <th colSpan={totalColumnCount} style={{ padding: '12px 14px 14px 14px', border: 'none', background: '#ffffff', fontWeight: 'normal', textAlign: 'center' }}>
                  <div className="print-header-centered" style={{ textAlign: 'center', width: '100%', marginBottom: '6px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
                    {/* School Logo + School Name (Centered at top) */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      {schoolLogoUrl && (
                        <img src={schoolLogoUrl} alt="Logo" style={{ width: '42px', height: '42px', objectFit: 'contain' }} />
                      )}
                      <h1 className="print-institution-name" style={{ margin: 0, fontSize: '20pt', fontWeight: 900, color: '#000', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>
                        {mainSchoolName}
                      </h1>
                    </div>

                    {/* Branch Name, Location & EIIN (Centered under School Name) */}
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginTop: '4px', fontSize: '11pt', color: '#1e293b', fontWeight: 700, textAlign: 'center' }}>
                      {resolvedBranchTitle && (
                        <span className="print-branch-badge" style={{ background: '#f1f5f9', padding: '2px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', color: '#0f172a' }}>
                          Branch: {resolvedBranchTitle}
                        </span>
                      )}
                      {schoolLocation && <span>📍 {schoolLocation}</span>}
                      {schoolEiin && <span>EIIN: {schoolEiin}</span>}
                    </div>

                    {/* Exam Name (Centered) */}
                    <h2 className="print-title" style={{ margin: '8px 0 2px', fontSize: '15pt', fontWeight: 800, color: '#0f172a', textAlign: 'center' }}>
                      {activeExamTitle === 'Academic Result List & Tabulation Sheet' ? activeExamTitle : `Tabulation Sheet — ${activeExamTitle}`}
                    </h2>

                    {/* Subtitle / Filter Details (Centered) */}
                    <p className="print-subtitle" style={{ margin: '2px 0 0', fontSize: '10.5pt', fontWeight: 600, color: '#334155', textAlign: 'center' }}>
                      {searchClass ? `Class: ${searchClass}` : 'All Classes'} {searchGroup ? `· Group: ${searchGroup}` : ''} {searchSubject ? `· Subject: ${searchSubject}` : ''}
                    </p>
                  </div>
                </th>
              </tr>

              <tr style={{ background: 'linear-gradient(135deg, #1a2e4a, #1e3a8a)', borderBottom: 'none' }}>
                {!readOnly && selectionMode && <th style={{ padding: '15px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{t('results.select')}</th>}
                <th style={{ padding: '15px 18px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{t('results.studentName')}</th>
                <th style={{ padding: '15px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{t('results.class')}</th>
                <th style={{ padding: '15px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{t('results.roll')}</th>
                <th style={{ padding: '15px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{t('results.group')}</th>
                {visibleSubjectColumns.map((subject) => (
                  <th key={subject} style={{ padding: '15px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#fde68a', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{subject}</th>
                ))}
                <th style={{ padding: '15px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{t('results.total')}</th>
                <th style={{ padding: '15px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{t('results.avg')}</th>
                <th style={{ padding: '15px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{t('results.gpa')}</th>
                <th style={{ padding: '15px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#fde68a', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{t('results.rank')}</th>
                <th className="mark-sheet-no-print" style={{ padding: '15px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{t('results.action')}</th>
              </tr>
            </thead>
            <tbody>
              {overviewRows.length === 0 ? (
                <tr>
                  <td colSpan={(!readOnly && selectionMode ? 1 : 0) + 9 + visibleSubjectColumns.length} style={{ padding: '56px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', fontWeight: '600' }}>
                    {t('results.noResultFound')}
                  </td>
                </tr>
              ) : (
                overviewRows.map((row, rowIdx) => (
                  <tr
                    key={row.key}
                    onClick={() => !readOnly && selectionMode ? handleToggleStudentSelection(row.selectableSubjects) : setSelectedStudentKey(row.key)}
                    style={{ borderBottom: '1px solid #f1f5f9', background: rowIdx % 2 === 0 ? '#fff' : '#f8fafc', cursor: 'pointer', transition: 'background-color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#eff6ff'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = rowIdx % 2 === 0 ? '#fff' : '#f8fafc'}
                  >
                    {!readOnly && selectionMode && (
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isStudentSelected(row.selectableSubjects)}
                          onChange={(event) => {
                            event.stopPropagation();
                            handleToggleStudentSelection(row.selectableSubjects);
                          }}
                          onClick={(event) => event.stopPropagation()}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563eb' }}
                        />
                      </td>
                    )}
                    <td className="tp-cell-nowrap" style={{ padding: '14px 18px', color: '#1a2e4a', fontSize: '14px', fontWeight: '700' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <span className="tp-avatar-text">{row.name.charAt(0)}</span>
                        {row.name}
                      </span>
                    </td>
                    <td className="tp-cell-nowrap" style={{ padding: '14px 16px', color: '#1a2e4a', fontSize: '13px', fontWeight: '600' }}>
                      <span className="tp-badge-light">{row.class}</span>
                    </td>
                    <td className="tp-cell-nowrap tp-cell-center" style={{ padding: '14px 16px', color: '#1a2e4a', fontSize: '14px', fontWeight: '700' }}>{row.roll}</td>
                    <td className="tp-cell-nowrap" style={{ padding: '14px 16px', color: '#475569', fontSize: '13px', fontWeight: '600' }}>{row.group}</td>
                    {visibleSubjectColumns.map((subjectName) => {
                      const subject = row.subjectMap[subjectName];
                      if (!subject) {
                        return (
                          <td key={subjectName} style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <span style={{ color: '#d97706', fontSize: '11px', fontWeight: '700', background: '#fef3c7', padding: '3px 8px', borderRadius: '6px', border: '1px solid #fcd34d' }}>Pending</span>
                          </td>
                        );
                      }

                      const rule = selectedExamSession?.subjectRules?.[subjectName] || { totalMarks: 100, passMarks: 33 };
                      const resolved = resolveRuleTotals(rule);
                      const hasCqMcqData = subject.cqMarks != null && Number.isFinite(Number(subject.cqMarks));
                      const hasMcq = resolved.hasMcq && subject.mcqMarks != null;
                      const cqFail = subject.componentStatus?.cqStatus === 'Fail' || (hasCqMcqData && Number(subject.cqMarks) < Number(rule.cqPass));
                      const mcqFail = hasMcq && (subject.componentStatus?.mcqStatus === 'Fail' || Number(subject.mcqMarks) < Number(rule.mcqPass));

                      return (
                        <td key={subjectName} style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                            <span style={{ fontSize: '15px', fontWeight: '800', color: (cqFail || mcqFail) ? '#b91c1c' : '#1a2e4a' }}>
                              {subject.marks}
                            </span>
                            {hasCqMcqData && (
                              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', lineHeight: 1.2 }}>
                                <span style={{ color: cqFail ? '#b91c1c' : '#475569', fontWeight: cqFail ? 700 : 500 }}>
                                  CQ:{subject.cqMarks}
                                </span>
                                {hasMcq && (
                                  <span style={{ color: mcqFail ? '#b91c1c' : '#475569', marginLeft: 4, fontWeight: mcqFail ? 700 : 500 }}>
                                    MCQ:{subject.mcqMarks}
                                  </span>
                                )}
                              </div>
                            )}
                            {(cqFail || mcqFail) && (
                              <span style={{ fontSize: '9px', background: '#fee2e2', color: '#b91c1c', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>
                                {cqFail && mcqFail ? 'CQ+MCQ Fail' : cqFail ? 'CQ Fail' : 'MCQ Fail'}
                              </span>
                            )}
                            <GradeBadge grade={subject.grade} />
                          </div>
                        </td>
                      );
                    })}
                    <td className="tp-cell-nowrap tp-cell-center" style={{ padding: '14px 16px' }}>
                      {row.isComplete ? (
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#1a2e4a' }}>
                          {calculateResultSummary(row.subjects, true).totalMarks}
                        </span>
                      ) : (
                        <span className="tp-badge-pending" style={{ background: '#fef3c7', color: '#d97706', border: '1px solid #fcd34d' }}>{t('results.pending')}</span>
                      )}
                    </td>
                    <td className="tp-cell-nowrap tp-cell-center" style={{ padding: '14px 16px' }}>
                      {row.isComplete ? (
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#2563eb' }}>
                          {row.averageMarks.toFixed(1)}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontWeight: '700' }}>—</span>
                      )}
                    </td>
                    <td className="tp-cell-nowrap tp-cell-center" style={{ padding: '14px 16px' }}>
                      {row.isComplete ? (
                        row.status === 'Fail' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '14px', fontWeight: '800', color: '#b91c1c' }}>0.00</span>
                            <span className="tp-badge-pending" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' }}>{t('results.fail')}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '14px', fontWeight: '800', color: '#15803d' }}>{row.averageGpa.toFixed(2)}</span>
                        )
                      ) : (
                        <span className="tp-badge-pending" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>{t('results.fail')}</span>
                      )}
                    </td>
                    <td className="tp-cell-nowrap tp-cell-center" style={{ padding: '14px 16px' }}>
                      {row.position ? (
                        <span className="tp-badge-rank">#{row.position}</span>
                      ) : (
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          background: '#f1f5f9',
                          color: '#64748b',
                          fontSize: '11px',
                          fontWeight: '700',
                          border: '1px solid #cbd5e1'
                        }}>
                          {t('common.notRanked')}
                        </span>
                      )}
                    </td>
                    <td className="mark-sheet-no-print tp-cell-center" style={{ padding: '14px 16px' }}>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedStudentKey(row.key);
                        }}
                        className="tp-btn-primary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          borderRadius: '8px',
                          fontSize: '12.5px',
                          fontWeight: '700',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        📥 Download PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="results-list-actions mark-sheet-no-print" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', padding: '14px 18px', background: '#f8fafc', borderTop: '1.5px solid #e2e8f0', flexWrap: 'wrap', borderRadius: '0 0 14px 14px', marginTop: '-2px' }}>
          {selectionMode && <span style={{ marginRight: 'auto', color: '#1a2e4a', fontSize: '13px', fontWeight: '700' }}>{selectedResultKeys.length} selected</span>}
          <button
            type="button"
            onClick={() => {
              document.body.classList.remove('print-mode-transcript');
              document.body.classList.add('print-mode-tabulation');
              const cleanup = () => {
                document.body.classList.remove('print-mode-tabulation');
                window.removeEventListener('afterprint', cleanup);
              };
              window.addEventListener('afterprint', cleanup);
              window.print();
            }}
            style={{ padding: '9px 18px', borderRadius: '9px', border: 'none', background: '#0284c7', color: '#fff', cursor: 'pointer', fontWeight: '700', fontSize: '13px', boxShadow: '0 2px 8px rgba(2,132,199,0.25)' }}
          >
            🖨️ Print Result List
          </button>
          {!readOnly && selectionMode && (
            <button
              type="button"
              onClick={handleDeleteSelectedResults}
              disabled={selectedResultKeys.length === 0}
              style={{ padding: '9px 18px', borderRadius: '9px', border: 'none', background: selectedResultKeys.length === 0 ? '#fecaca' : '#dc2626', color: '#fff', cursor: selectedResultKeys.length === 0 ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '13px' }}
            >
              {t('results.deleteSelected')}
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                setSelectionMode(prev => !prev);
                setSelectedResultKeys([]);
              }}
              style={{ padding: '9px 18px', borderRadius: '9px', border: 'none', background: selectionMode ? '#f1f5f9' : 'linear-gradient(135deg,#1d4ed8,#2563eb)', color: selectionMode ? '#334155' : '#fff', cursor: 'pointer', fontWeight: '700', fontSize: '13px', boxShadow: selectionMode ? 'none' : '0 2px 8px rgba(37,99,235,0.25)' }}
            >
              {selectionMode ? 'Cancel' : '☑ Select Results'}
            </button>
          )}
        </div>
      </div>
    );
  };

  /* ─────────────────────────────────────────────────────────────
     Render: Student Result Details
     ───────────────────────────────────────────────────────────── */
  const renderStudentDetails = () => {
    if (!selectedStudent) return null;

    const resultSummary = calculateResultSummary(selectedStudent.subjects, selectedStudent.isComplete, selectedStudent);
    const activeExamName =
      selectedExamSession?.name ||
      selectedExamSession?.title ||
      selectedExamSession?.examName ||
      selectedExamSession?.term ||
      (selectedStudent?.subjects?.[0]?.examId && selectedStudent?.subjects?.[0]?.examId !== 'current'
        ? selectedStudent?.subjects?.[0]?.examId
        : null) ||
      'Annual Examination';

    // Construct complete report card subject list including expected subjects and any extra entered subjects
    const expectedSubjectNames = getExpectedSubjects(selectedStudent);
    const enteredSubjectMap = new Map();
    (selectedStudent.subjects || []).forEach((sub) => {
      if (sub?.subject) {
        enteredSubjectMap.set(String(sub.subject).trim().toLowerCase(), sub);
      }
    });

    const reportCardSubjectList = [];
    const processedSubjectKeys = new Set();

    if (expectedSubjectNames.length > 0) {
      expectedSubjectNames.forEach((expectedSubName) => {
        const key = String(expectedSubName).trim().toLowerCase();
        processedSubjectKeys.add(key);
        const entered = enteredSubjectMap.get(key);
        if (entered) {
          reportCardSubjectList.push({
            ...entered,
            isPending: false,
          });
        } else {
          const rule = selectedExamSession?.subjectRules?.[expectedSubName] || { totalMarks: 100, passMarks: 33 };
          const resolved = resolveRuleTotals(rule);
          reportCardSubjectList.push({
            subject: expectedSubName,
            marks: null,
            cqMarks: null,
            mcqMarks: null,
            status: 'Pending',
            grade: 'Pending',
            gradePoint: 0,
            isPending: true,
            totalMarks: resolved.totalMarks,
          });
        }
      });
    }

    (selectedStudent.subjects || []).forEach((sub) => {
      if (sub?.subject) {
        const key = String(sub.subject).trim().toLowerCase();
        if (!processedSubjectKeys.has(key)) {
          processedSubjectKeys.add(key);
          reportCardSubjectList.push({
            ...sub,
            isPending: false,
          });
        }
      }
    });

    const subjectCount = reportCardSubjectList.length;

    // Pure helper function for dynamic scale calculation (prevents React Rules of Hooks error)
    const getDynamicConfig = (count) => {
      if (count <= 5) {
        return {
          cardPadding: '20px 24px',
          schoolNameFont: '24px',
          headerMargin: '14px',
          dividerMargin: '16px',
          studentSectionMargin: '16px',
          infoPadding: '4px 0',
          infoLabelFont: '11.5px',
          infoValueFont: '13px',
          photoWidth: '110px',
          photoHeight: '130px',
          gradingFont: '10px',
          gradingPadding: '3px 4px',
          tableMargin: '16px',
          tableHeaderPadding: '9px 14px',
          tableHeaderFont: '11.5px',
          tableCellPadding: '9px 14px',
          subjectFont: '13.5px',
          marksFont: '15px',
          highestMarkFont: '13.5px',
          badgePadding: '4px 12px',
          badgeFont: '12.5px',
          grandTotalPadding: '10px 14px',
          grandTotalFont: '13.5px',
          summaryMargin: '24px',
          summaryPadding: '10px',
          summaryValueFont: '15px',
          footerMarginTop: '28px',
          signatureSpacerHeight: '44px',
          signatureLineMargin: '5px',
          signatureLabelFont: '11.5px',
        };
      } else if (count <= 8) {
        return {
          cardPadding: '14px 18px',
          schoolNameFont: '21px',
          headerMargin: '8px',
          dividerMargin: '12px',
          studentSectionMargin: '12px',
          infoPadding: '3px 0',
          infoLabelFont: '10.5px',
          infoValueFont: '11.5px',
          photoWidth: '100px',
          photoHeight: '115px',
          gradingFont: '9.5px',
          gradingPadding: '2px 3px',
          tableMargin: '12px',
          tableHeaderPadding: '7px 12px',
          tableHeaderFont: '10.5px',
          tableCellPadding: '6.5px 12px',
          subjectFont: '12px',
          marksFont: '13.5px',
          highestMarkFont: '12.5px',
          badgePadding: '3px 10px',
          badgeFont: '11.5px',
          grandTotalPadding: '8px 12px',
          grandTotalFont: '12.5px',
          summaryMargin: '18px',
          summaryPadding: '8px',
          summaryValueFont: '14px',
          footerMarginTop: '22px',
          signatureSpacerHeight: '38px',
          signatureLineMargin: '4px',
          signatureLabelFont: '11px',
        };
      } else if (count <= 11) {
        return {
          cardPadding: '10px 14px',
          schoolNameFont: '18px',
          headerMargin: '6px',
          dividerMargin: '8px',
          studentSectionMargin: '8px',
          infoPadding: '2px 0',
          infoLabelFont: '9.5px',
          infoValueFont: '10.5px',
          photoWidth: '85px',
          photoHeight: '98px',
          gradingFont: '8.5px',
          gradingPadding: '1.5px 2px',
          tableMargin: '8px',
          tableHeaderPadding: '5px 10px',
          tableHeaderFont: '9.5px',
          tableCellPadding: '4.5px 10px',
          subjectFont: '11px',
          marksFont: '12px',
          highestMarkFont: '11.5px',
          badgePadding: '2px 8px',
          badgeFont: '10.5px',
          grandTotalPadding: '6px 10px',
          grandTotalFont: '11.5px',
          summaryMargin: '14px',
          summaryPadding: '5px',
          summaryValueFont: '12.5px',
          footerMarginTop: '16px',
          signatureSpacerHeight: '34px',
          signatureLineMargin: '3px',
          signatureLabelFont: '10px',
        };
      } else {
        return {
          cardPadding: '6px 10px',
          schoolNameFont: '16px',
          headerMargin: '4px',
          dividerMargin: '5px',
          studentSectionMargin: '5px',
          infoPadding: '1px 0',
          infoLabelFont: '8.5px',
          infoValueFont: '9.5px',
          photoWidth: '75px',
          photoHeight: '85px',
          gradingFont: '7.5px',
          gradingPadding: '1px 2px',
          tableMargin: '6px',
          tableHeaderPadding: '3.5px 8px',
          tableHeaderFont: '9px',
          tableCellPadding: '3px 8px',
          subjectFont: '10px',
          marksFont: '11px',
          highestMarkFont: '10.5px',
          badgePadding: '1px 6px',
          badgeFont: '9.5px',
          grandTotalPadding: '4px 8px',
          grandTotalFont: '10.5px',
          summaryMargin: '10px',
          summaryPadding: '4px',
          summaryValueFont: '11.5px',
          footerMarginTop: '12px',
          signatureSpacerHeight: '28px',
          signatureLineMargin: '2px',
          signatureLabelFont: '9.5px',
        };
      }
    };

    const dynamicConfig = getDynamicConfig(subjectCount);

    const studentInfoRows = [
      { label: 'Student Name', value: selectedStudent.name },
      { label: 'Student ID', value: selectedStudent.studentId || 'N/A' },
      { label: 'Exam Name', value: activeExamName },
      { label: 'Class', value: selectedStudent.class },
      { label: 'Roll Number', value: selectedStudent.roll },
      { label: 'Group / Section', value: selectedStudent.group || 'N/A' },
      { label: 'Academic Year', value: '2026-2027' },
      { label: "Father's Name", value: selectedStudent.fatherName || 'N/A' },
      { label: "Mother's Name", value: selectedStudent.motherName || 'N/A' },
    ];

    const activeSchoolLogo =
      schoolProfile?.logoUrl ||
      schoolProfile?.logo ||
      (typeof window !== 'undefined' ? window.localStorage.getItem('schoolLogo') : null) ||
      null;

    const activeBrandColor =
      schoolProfile?.themeColor ||
      schoolProfile?.primaryColor ||
      schoolProfile?.brandColor ||
      (typeof window !== 'undefined' ? window.localStorage.getItem('schoolThemeColor') : null) ||
      '#0284c7';

    /* ─────────────────────────────────────────────────────────────
       Professional Marksheet Print & PDF Download Functions
       ───────────────────────────────────────────────────────────── */
    const triggerProfessionalMarksheetPrint = () => {
      if (typeof window !== 'undefined') _triggerMarksheetPrint();
    };

    const handleDownloadPdfFile = async () => {
      try {
        if (typeof window === 'undefined') return;

        if (!window.html2pdf) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        const element = document.querySelector('.transcript-container');
        if (!element) {
          triggerProfessionalMarksheetPrint();
          return;
        }

        const studentName = (selectedStudent?.name || 'Student').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
        const className = (selectedStudent?.class || 'Class').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
        const rollNo = (selectedStudent?.roll || '0').toString().trim();
        const filename = `${studentName}_Official_Marksheet_Class${className}_Roll${rollNo}.pdf`;

        // Store original inline style properties
        const prevWidth = element.style.width;
        const prevMargin = element.style.margin;
        const prevBoxSizing = element.style.boxSizing;

        // Force fixed width & 0 margin during capture to eliminate blank first page and overflow
        element.style.width = '790px';
        element.style.margin = '0 auto';
        element.style.boxSizing = 'border-box';

        const opt = {
          margin: 0, // 0 margin eliminates jsPDF canvas offset and 1st blank page
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            scrollY: 0,
            scrollX: 0,
            windowWidth: 794,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        };

        await window.html2pdf().set(opt).from(element).save();

        // Restore original inline styles
        element.style.width = prevWidth;
        element.style.margin = prevMargin;
        element.style.boxSizing = prevBoxSizing;
      } catch (err) {
        console.warn('html2pdf direct save failed, falling back to window.print():', err);
        triggerProfessionalMarksheetPrint();
      }
    };

    return (
      <div className="mark-sheet-print-area-wrapper">
        {/* Official Certificate Marksheet Layout (Visible On Screen & Formatted For Print) */}
        <div>
          <PrintContainer
            title={`${activeExamName} — Report Card`}
            subtitle={`Class: ${selectedStudent.class} · Roll No: ${selectedStudent.roll}`}
            schoolName={getSchoolNameByClass(selectedStudent.class, schoolProfile) || schoolProfile?.schoolName}
            eiinNumber={schoolProfile?.eiinNumber || window.localStorage.getItem('schoolEiinNumber')}
            location={schoolProfile?.location || window.localStorage.getItem('schoolLocation')}
            singlePageFit={true}
            showWatermark={false}
            hideDefaultHeader={true}
            showFooter={false}
            showTriggerButton={false}
          >
            <div
              className="transcript-container marksheet-card"
              style={{
                position: 'relative',
                overflow: 'visible',
                padding: dynamicConfig.cardPadding,
                backgroundColor: '#FFF2F2',
                background: '#FFF2F2',
                border: '4px double #1e3a8a',
                outline: '2px solid #b91c1c',
                outlineOffset: '-7px',
                borderRadius: '14px',
                boxShadow: '0 12px 45px rgba(30, 58, 138, 0.12), inset 0 0 0 1px rgba(255, 255, 255, 0.6)',
                zoom: screenScale,
                WebkitZoom: screenScale,
              }}
            >
              {/* Top Navy/Crimson Accent Bar */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #1e3a8a, #b91c1c, #1e3a8a)' }} />

              {/* Inner Decorative Accent Frame */}
              <div
                className="transcript-inner-border"
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  right: '12px',
                  bottom: '12px',
                  border: '1px dashed #1e3a8a',
                  borderRadius: '10px',
                  pointerEvents: 'none',
                  zIndex: 0,
                  opacity: 0.4,
                }}
              />

              {/* Ornate Corner Flourishes */}
              <svg
                style={{ position: 'absolute', top: 14, left: 14, width: 32, height: 32, color: '#1e3a8a', opacity: 0.85, pointerEvents: 'none', zIndex: 1 }}
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
              >
                <path d="M2 30V10C2 5.58172 5.58172 2 10 2H30" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M7 25V12C7 9.23858 9.23858 7 12 7H25" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 2" />
                <circle cx="12" cy="12" r="3" fill="#b91c1c" stroke="none" />
              </svg>
              <svg
                style={{ position: 'absolute', top: 14, right: 14, width: 32, height: 32, color: '#1e3a8a', opacity: 0.85, pointerEvents: 'none', zIndex: 1 }}
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
              >
                <path d="M30 30V10C30 5.58172 26.4183 2 22 2H2" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M25 25V12C25 9.23858 22.7614 7 20 7H7" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 2" />
                <circle cx="20" cy="12" r="3" fill="#b91c1c" stroke="none" />
              </svg>
              <svg
                style={{ position: 'absolute', bottom: 14, left: 14, width: 32, height: 32, color: '#1e3a8a', opacity: 0.85, pointerEvents: 'none', zIndex: 1 }}
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
              >
                <path d="M2 2V22C2 26.4183 5.58172 30 10 30H30" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M7 7V20C7 22.7614 9.23858 25 12 25H25" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 2" />
                <circle cx="12" cy="20" r="3" fill="#b91c1c" stroke="none" />
              </svg>
              <svg
                style={{ position: 'absolute', bottom: 14, right: 14, width: 32, height: 32, color: '#1e3a8a', opacity: 0.85, pointerEvents: 'none', zIndex: 1 }}
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
              >
                <path d="M30 2V22C30 26.4183 26.4183 30 22 30H2" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M25 7V20C25 22.7614 22.7614 25 20 25H7" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 2" />
                <circle cx="20" cy="20" r="3" fill="#b91c1c" stroke="none" />
              </svg>

              {/* Background School Logo Watermark Layer */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  zIndex: 0,
                }}
              >
                {activeSchoolLogo ? (
                  <img
                    src={activeSchoolLogo}
                    alt="School Watermark"
                    style={{
                      width: '320px',
                      height: '320px',
                      objectFit: 'contain',
                      opacity: 0.07,
                    }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div
                    style={{
                      transform: 'rotate(-25deg)',
                      opacity: 0.04,
                      fontSize: '32px',
                      fontWeight: '900',
                      color: '#1e3a8a',
                      textAlign: 'center',
                      lineHeight: '1.8',
                    }}
                  >
                    {(getSchoolNameByClass(selectedStudent.class, schoolProfile) || schoolProfile?.schoolName || '').toUpperCase()}
                  </div>
                )}
              </div>

              <div className="transcript-content-body" style={{ position: 'relative', zIndex: 1 }}>
                {/* Header Section — Centered */}
                <div className="transcript-header-section" style={{ textAlign: 'center', marginBottom: dynamicConfig.headerMargin }}>
                  <h1 className="transcript-school-name" style={{ margin: 0, fontSize: dynamicConfig.schoolNameFont, fontWeight: '800', color: '#1e3a8a', fontFamily: "'Times New Roman', serif", textTransform: 'uppercase', letterSpacing: '-0.3px', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    {getSchoolNameByClass(selectedStudent.class, schoolProfile) || schoolProfile?.schoolName}
                  </h1>
                  {(schoolProfile?.location || window.localStorage.getItem('schoolLocation')) && (
                    <p className="transcript-school-location" style={{ margin: '4px 0 2px', fontSize: '12px', color: '#475569', fontWeight: '600', wordBreak: 'break-word' }}>
                      📍 {schoolProfile?.location || window.localStorage.getItem('schoolLocation')}
                    </p>
                  )}
                  {(schoolProfile?.eiinNumber || window.localStorage.getItem('schoolEiinNumber')) && (
                    <p className="transcript-school-eiin" style={{ margin: '2px 0 4px', fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>
                      EIIN: {schoolProfile?.eiinNumber || window.localStorage.getItem('schoolEiinNumber')}
                    </p>
                  )}
                  <div className="transcript-exam-title" style={{ fontSize: '13px', fontWeight: '800', color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    {activeExamName}
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                    Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>

                {/* Horizontal Navy Line */}
                <div style={{ borderBottom: '2px solid #1e3a8a', marginBottom: dynamicConfig.dividerMargin }} />

                {/* Student Details Grid, Grading System & Photo */}
                <div className="transcript-student-section" style={{ marginBottom: dynamicConfig.studentSectionMargin }}>
                  {/* Left Student Info Fields with dotted borders */}
                  <div className="transcript-student-grid">
                    {studentInfoRows.map((info, idx) => (
                      <div key={idx} className="transcript-info-field" style={{ padding: dynamicConfig.infoPadding }}>
                        <span className="transcript-info-label" style={{ fontSize: dynamicConfig.infoLabelFont }}>
                          {info.label}
                        </span>
                        <span className="transcript-info-value" style={{ fontSize: dynamicConfig.infoValueFont }}>
                          {info.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Middle: Grading System Reference Table */}
                  <div className="transcript-grading-box">
                    <div className="transcript-grading-header">
                      Grading System
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: dynamicConfig.gradingFont }}>
                      <thead>
                        <tr style={{ background: '#e0ecfb', borderBottom: '1.5px solid #1e3a8a' }}>
                          <th style={{ padding: dynamicConfig.gradingPadding, color: '#1e3a8a', fontWeight: '800', fontSize: dynamicConfig.gradingFont, borderRight: '1px solid #1e3a8a' }}>Class Interval</th>
                          <th style={{ padding: dynamicConfig.gradingPadding, color: '#1e3a8a', fontWeight: '800', fontSize: dynamicConfig.gradingFont, borderRight: '1px solid #1e3a8a' }}>Grade</th>
                          <th style={{ padding: dynamicConfig.gradingPadding, color: '#1e3a8a', fontWeight: '800', fontSize: dynamicConfig.gradingFont }}>G.P.</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '700', color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>80-100</td>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '800', color: '#6d28d9', borderRight: '1px solid #cbd5e1' }}>A+</td>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '700', color: '#0f172a' }}>5.00</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '700', color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>70-79</td>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '800', color: '#1d4ed8', borderRight: '1px solid #cbd5e1' }}>A</td>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '700', color: '#0f172a' }}>4.00</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '700', color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>60-69</td>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '800', color: '#0369a1', borderRight: '1px solid #cbd5e1' }}>A-</td>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '700', color: '#0f172a' }}>3.5</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '700', color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>50-59</td>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '800', color: '#15803d', borderRight: '1px solid #cbd5e1' }}>B</td>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '700', color: '#0f172a' }}>3.00</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '700', color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>40-49</td>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '800', color: '#b45309', borderRight: '1px solid #cbd5e1' }}>C</td>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '700', color: '#0f172a' }}>2.00</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '700', color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>33-40</td>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '800', color: '#c2410c', borderRight: '1px solid #cbd5e1' }}>D</td>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '700', color: '#0f172a' }}>1.00</td>
                        </tr>
                        <tr>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '700', color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>0-32</td>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '800', color: '#b91c1c', borderRight: '1px solid #cbd5e1' }}>F</td>
                          <td style={{ padding: dynamicConfig.gradingPadding, fontWeight: '700', color: '#0f172a' }}>0.00</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Right Photo Card */}
                  <div className="transcript-photo-box" style={{ width: dynamicConfig.photoWidth, height: dynamicConfig.photoHeight }}>
                    {selectedStudent.profilePic ? (
                      <img src={selectedStudent.profilePic} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div className="transcript-photo-placeholder" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                        <svg width="36" height="36" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                        <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', marginTop: '2px', letterSpacing: '0.5px' }}>PHOTO</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Subject Performance Table */}
                <div className="transcript-table-container" style={{ width: '100%', marginBottom: dynamicConfig.tableMargin, border: '1.5px solid #1e3a8a', borderRadius: '8px', overflow: 'hidden', background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                  <table className="transcript-performance-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: '#ffffff' }}>
                    <thead>
                      <tr style={{ background: '#1e3a8a' }}>
                        <th style={{ padding: dynamicConfig.tableHeaderPadding, color: '#ffffff', fontWeight: '800', fontSize: dynamicConfig.tableHeaderFont, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1.5px solid #1e3a8a' }}>SUBJECT</th>
                        <th style={{ padding: dynamicConfig.tableHeaderPadding, color: '#ffffff', fontWeight: '800', fontSize: dynamicConfig.tableHeaderFont, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center', borderBottom: '1.5px solid #1e3a8a' }}>MARKS</th>
                        <th style={{ padding: dynamicConfig.tableHeaderPadding, color: '#ffffff', fontWeight: '800', fontSize: dynamicConfig.tableHeaderFont, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center', borderBottom: '1.5px solid #1e3a8a' }}>HIGHEST</th>
                        <th style={{ padding: dynamicConfig.tableHeaderPadding, color: '#ffffff', fontWeight: '800', fontSize: dynamicConfig.tableHeaderFont, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center', borderBottom: '1.5px solid #1e3a8a' }}>GRADE</th>
                        <th style={{ padding: dynamicConfig.tableHeaderPadding, color: '#ffffff', fontWeight: '800', fontSize: dynamicConfig.tableHeaderFont, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center', borderBottom: '1.5px solid #1e3a8a' }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportCardSubjectList.map((subject, idx) => {
                        const rule = selectedExamSession?.subjectRules?.[subject.subject] || { totalMarks: 100, passMarks: 33 };
                        const resolved = resolveRuleTotals(rule);
                        const hasCqMcqData = !subject.isPending && subject.cqMarks != null && Number.isFinite(Number(subject.cqMarks));
                        const hasMcq = resolved.hasMcq && subject.mcqMarks != null;
                        const highestMark = subject.highestMark ?? subject.highestMarks ?? highestMarksMap[subject.subject] ?? (!subject.isPending ? (subject.marks ?? '—') : '—');

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: dynamicConfig.tableCellPadding, fontSize: dynamicConfig.subjectFont, fontWeight: '700', color: '#1e293b' }}>
                              {subject.subject}
                            </td>
                            <td style={{ padding: dynamicConfig.tableCellPadding, textAlign: 'center' }}>
                              {subject.isPending ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>
                                  — <span style={{ fontSize: '9px', background: '#fef3c7', color: '#d97706', padding: '1px 5px', borderRadius: '4px', border: '1px solid #fcd34d', fontWeight: '800' }}>Pending</span>
                                </span>
                              ) : (
                                <>
                                  <div>
                                    <span style={{ fontSize: dynamicConfig.marksFont, fontWeight: '800', color: '#1d4ed8' }}>{subject.marks}</span>
                                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', marginLeft: '2px' }}>/{resolved.totalMarks}</span>
                                  </div>
                                  {hasCqMcqData && (
                                    <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '600', marginTop: '1px' }}>
                                      CQ:{subject.cqMarks}/{rule.cqTotal ?? 70}
                                      {hasMcq && ` MCQ:${subject.mcqMarks}/${rule.mcqTotal ?? 30}`}
                                    </div>
                                  )}
                                </>
                              )}
                            </td>
                            <td style={{ padding: dynamicConfig.tableCellPadding, textAlign: 'center' }}>
                              <span style={{ fontSize: dynamicConfig.highestMarkFont, fontWeight: '800', color: '#0f172a' }}>
                                {highestMark}
                              </span>
                            </td>
                            <td style={{ padding: dynamicConfig.tableCellPadding, textAlign: 'center' }}>
                              {subject.isPending ? (
                                <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '6px', background: '#f1f5f9', color: '#94a3b8', fontSize: '11px', fontWeight: '700' }}>
                                  —
                                </span>
                              ) : (
                                <span style={{
                                  display: 'inline-block',
                                  padding: dynamicConfig.badgePadding,
                                  borderRadius: '6px',
                                  background: {
                                    'A+': '#6d28d9',
                                    'A': '#1d4ed8',
                                    'A-': '#0369a1',
                                    'B': '#15803d',
                                    'C': '#b45309',
                                    'D': '#c2410c',
                                    'F': '#b91c1c',
                                  }[subject.grade] || '#6d28d9',
                                  color: '#fff',
                                  fontSize: dynamicConfig.badgeFont,
                                  fontWeight: '800',
                                  minWidth: '28px',
                                  textAlign: 'center',
                                }}>
                                  {subject.grade}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: dynamicConfig.tableCellPadding, textAlign: 'center' }}>
                              {subject.isPending ? (
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 10px',
                                  borderRadius: '20px',
                                  background: '#fef3c7',
                                  color: '#d97706',
                                  border: '1px solid #fcd34d',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                }}>
                                  Pending
                                </span>
                              ) : (
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 10px',
                                  borderRadius: '20px',
                                  background: subject.status === 'Fail' ? '#fee2e2' : '#dcfce7',
                                  color: subject.status === 'Fail' ? '#b91c1c' : '#15803d',
                                  border: subject.status === 'Fail' ? '1px solid #fca5a5' : '1px solid #86efac',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                }}>
                                  {subject.status}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Grand Total Footer Row */}
                      <tr className="transcript-grand-total-row" style={{ background: '#ffffff', borderTop: '2px solid #0f172a' }}>
                        <td style={{ padding: dynamicConfig.grandTotalPadding, fontWeight: '800', fontSize: dynamicConfig.grandTotalFont, color: '#0f172a' }}>
                          Grand Total
                        </td>
                        <td style={{ padding: dynamicConfig.grandTotalPadding, textAlign: 'center', fontWeight: '800', fontSize: dynamicConfig.grandTotalFont, color: '#0f172a' }}>
                          {resultSummary.totalMarks} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>/{resultSummary.maxMarks}</span>
                        </td>
                        <td style={{ padding: dynamicConfig.grandTotalPadding, textAlign: 'center', fontWeight: '800', fontSize: dynamicConfig.grandTotalFont, color: '#0f172a' }}>
                          {classHighestTotalMarks ?? '—'}
                        </td>
                        <td style={{ padding: dynamicConfig.grandTotalPadding }} />
                        <td style={{ padding: dynamicConfig.grandTotalPadding }} />
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 5 Summary Metric Cards */}
                <div className="transcript-summary-grid" style={{ marginBottom: dynamicConfig.summaryMargin }}>
                  <div className="transcript-summary-cell" style={{ padding: dynamicConfig.summaryPadding }}>
                    <div className="transcript-summary-label">
                      PERCENTAGE
                    </div>
                    <div className="transcript-summary-value" style={{ fontSize: dynamicConfig.summaryValueFont }}>
                      {resultSummary.percentage.toFixed(1)}%
                    </div>
                  </div>

                  <div className="transcript-summary-cell" style={{ padding: dynamicConfig.summaryPadding }}>
                    <div className="transcript-summary-label">
                      PROFICIENCY
                    </div>
                    <div className="transcript-summary-value" style={{ fontSize: dynamicConfig.summaryValueFont }}>
                      {!selectedStudent.isComplete ? 'Result Pending' : (resultSummary.status === 'Fail' ? 'Needs Improvement' : (resultSummary.proficiency || 'Outstanding'))}
                    </div>
                  </div>

                  <div className="transcript-summary-cell" style={{ padding: dynamicConfig.summaryPadding }}>
                    <div className="transcript-summary-label">
                      GRADE (GPA)
                    </div>
                    <div className="transcript-summary-value" style={{ fontSize: dynamicConfig.summaryValueFont }}>
                      {!selectedStudent.isComplete ? 'Pending' : (resultSummary.status === 'Fail' ? 'F (0.00)' : `${resultSummary.averageGrade} (${resultSummary.gradePoint.toFixed(2)})`)}
                    </div>
                  </div>

                  <div className="transcript-summary-cell" style={{ padding: dynamicConfig.summaryPadding }}>
                    <div className="transcript-summary-label">
                      CLASS RANK
                    </div>
                    <div className="transcript-summary-value" style={{ fontSize: dynamicConfig.summaryValueFont }}>
                      {!selectedStudent.isComplete ? 'N/A' : (selectedStudent.position ? `#${selectedStudent.position}` : 'N/A')}
                    </div>
                  </div>

                  <div className="transcript-summary-cell" style={{ padding: dynamicConfig.summaryPadding }}>
                    <div className="transcript-summary-label">
                      TOTAL STUDENTS
                    </div>
                    <div className="transcript-summary-value" style={{ fontSize: dynamicConfig.summaryValueFont }}>
                      {rankedFilteredResults.length || '—'}
                    </div>
                  </div>
                </div>

                {/* Bottom Signatures Section */}
                <div
                  className="transcript-footer"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 'clamp(6px, 2vw, 24px)',
                    alignItems: 'end',
                    marginTop: dynamicConfig.footerMarginTop,
                    paddingTop: '8px',
                    marginBottom: '4px',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Column 1: Class Teacher */}
                  <div className="transcript-signature-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
                    <div className="transcript-signature-spacer" style={{ height: dynamicConfig.signatureSpacerHeight, minHeight: dynamicConfig.signatureSpacerHeight, width: '100%' }} />
                    <div className="transcript-signature-line" style={{ width: '100%', maxWidth: '180px', borderTop: '1.5px solid #1e3a8a', marginBottom: dynamicConfig.signatureLineMargin }} />
                    <span className="transcript-signature-label" style={{ fontSize: dynamicConfig.signatureLabelFont, fontWeight: '700', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.3px', textAlign: 'center', wordBreak: 'break-word' }}>
                      Class Teacher
                    </span>
                  </div>

                  {/* Column 2: Guardian */}
                  <div className="transcript-signature-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
                    <div className="transcript-signature-spacer" style={{ height: dynamicConfig.signatureSpacerHeight, minHeight: dynamicConfig.signatureSpacerHeight, width: '100%' }} />
                    <div className="transcript-signature-line" style={{ width: '100%', maxWidth: '180px', borderTop: '1.5px solid #1e3a8a', marginBottom: dynamicConfig.signatureLineMargin }} />
                    <span className="transcript-signature-label" style={{ fontSize: dynamicConfig.signatureLabelFont, fontWeight: '700', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.3px', textAlign: 'center', wordBreak: 'break-word' }}>
                      Guardian
                    </span>
                  </div>

                  {/* Column 3: Head Teacher */}
                  <div className="transcript-signature-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
                    <div className="transcript-signature-spacer" style={{ height: dynamicConfig.signatureSpacerHeight, minHeight: dynamicConfig.signatureSpacerHeight, width: '100%' }} />
                    <div className="transcript-signature-line" style={{ width: '100%', maxWidth: '180px', borderTop: '1.5px solid #1e3a8a', marginBottom: dynamicConfig.signatureLineMargin }} />
                    <span className="transcript-signature-label" style={{ fontSize: dynamicConfig.signatureLabelFont, fontWeight: '700', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.3px', textAlign: 'center', wordBreak: 'break-word' }}>
                      Head Teacher
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </PrintContainer>
        </div>
      </div>
    );
  };

  const renderConfigureExamModal = () => {
    if (!showConfigModal) return null;
    return (
      <ConfigureExamModal
        classes={classes}
        onClose={() => setShowConfigModal(false)}
        onSave={async (newExam) => {
          const createdExam = { ...newExam, key: newExam.examId };
          try {
            await ensureFirebaseAuth();
            await saveExamSession(newExam, activeSchoolId);
          } catch (err) {
            console.warn('Firestore write warning (exam configured locally):', err?.message || err);
          }

          setExamSessions((prev) => {
            const next = [...prev.filter((e) => (e.examId || e.id || e.key) !== newExam.examId), createdExam];
            saveStoredExamSessions(next, activeSchoolId);
            saveTeacherPanelData({ examSessions: next }, activeSchoolId).catch(() => { });
            return next;
          });

          setDeletedExamKeys((prev) => {
            const next = prev.filter((k) =>
              k !== newExam.examId &&
              k !== `${newExam.examId}::${newExam.targetClass}` &&
              k !== `${newExam.name}::${newExam.targetClass}`
            );
            if (typeof window !== 'undefined' && window.localStorage) {
              const storageKey = activeSchoolId ? `progga_deleted_exams_${activeSchoolId}` : 'progga_deleted_exams';
              window.localStorage.setItem(storageKey, JSON.stringify(next));
            }
            return next;
          });

          setSelectedExamSession(createdExam);
          showAlert('Exam Session configured successfully!', 'Success', 'success');
          setShowConfigModal(false);
        }}
      />
    );
  };

  const renderExamDirectory = () => {
    return (
      <div style={{ padding: '10px 0' }}>
        {/* Active Results Directory */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#1a2e4a' }}>📊 Registered Results Directory</h3>
            {!readOnly && (
              <button
                onClick={() => setShowConfigModal(true)}
                style={{
                  padding: '9px 18px',
                  fontSize: '13px',
                  fontWeight: '700',
                  background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
                }}
              >
                + Configure New Exam
              </button>
            )}
          </div>

          {examsWithResults.length === 0 ? (
            <div style={{ background: '#fff', padding: '40px', borderRadius: '16px', border: '1.5px solid #e2e8f0', textAlign: 'center' }}>
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>📭</span>
              <h4 style={{ margin: '0 0 6px', fontSize: '16px', color: '#475569', fontWeight: '700' }}>No Exam Results Registered Yet</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Go to the <strong>Result Entry</strong> tab in the sidebar to enter marks for a configured exam.
              </p>
            </div>
          ) : (
            /* ── Branch-grouped directory ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {['primary', 'secondary', 'college'].map((branchKey) => {
                const branch = SCHOOL_BRANCHES[branchKey];
                // Exams belonging to this branch
                const branchExams = examsWithResults.filter(
                  (exam) => (exam.branchKey || getBranchKeyByClass(exam.targetClass || exam)) === branchKey
                );
                // Per-branch aggregate: unique enrolled students with results
                const branchStudentSet = new Set();
                branchExams.forEach((exam) => {
                  const enrolledRes = getEnrolledResultsForExamCard(exam.examId, exam.targetClass);
                  enrolledRes.forEach((r) => branchStudentSet.add(`${r.class}-${r.roll}-${r.name || r.studentName}`));
                });

                return (
                  <div key={branchKey}>
                    {/* Branch Section Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 14,
                      padding: '12px 18px',
                      background: `linear-gradient(135deg, ${branch.gradientFrom}, ${branch.gradientTo})`,
                      borderRadius: 12,
                    }}>
                      <span style={{ fontSize: 20 }}>{branch.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{branch.name}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontWeight: 500 }}>
                          {branchExams.length} exam{branchExams.length !== 1 ? 's' : ''}
                          {' · '}{branchStudentSet.size} student result{branchStudentSet.size !== 1 ? 's' : ''}
                        </div>
                      </div>
                      {branchExams.length === 0 && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 700 }}>No results yet</span>
                      )}
                    </div>

                    {/* Exam cards for this branch */}
                    {branchExams.length === 0 ? (
                      <div style={{ background: '#f8fafc', padding: '20px 24px', borderRadius: 12, border: '1.5px dashed #cbd5e1', textAlign: 'center', fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>
                        No exam results have been entered for this institution yet.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        {branchExams.map((exam) => {
                          const resultsForExam = getEnrolledResultsForExamCard(exam.examId, exam.targetClass);
                          const uniqueStudents = new Set(resultsForExam.map((r) => `${r.class}-${r.roll}-${r.name || r.studentName}`));
                          return (
                            <div
                              key={`${exam.examId}-${exam.targetClass}`}
                              onClick={() => setSelectedExamSession(exam)}
                              style={{
                                background: '#fff',
                                borderRadius: '16px',
                                border: `1.5px solid ${branch.color}33`,
                                padding: '20px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(37,99,235,0.05)',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                              }}
                              className="exam-card-hover"
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <span style={{
                                  background: `${branch.color}18`,
                                  color: branch.color,
                                  padding: '6px 12px',
                                  borderRadius: '20px',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  textTransform: 'uppercase'
                                }}>
                                  {exam.targetClass}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {exam.isLegacy && (
                                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>Legacy</span>
                                  )}
                                  {!readOnly && (
                                    <button
                                      type="button"
                                      title="Delete Exam"
                                      onClick={(e) => handleDeleteExamSessionCard(e, exam)}
                                      style={{
                                        background: '#fee2e2',
                                        color: '#dc2626',
                                        border: '1px solid #fca5a5',
                                        borderRadius: '8px',
                                        padding: '4px 10px',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        transition: 'all 0.2s ease',
                                      }}
                                    >
                                      🗑️ Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                              <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>
                                📝 {exam.name}
                              </h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#64748b' }}>
                                <span>Status: <strong style={{ color: '#16a34a' }}>Registered</strong></span>
                                <span>Students with Results: <strong>{uniqueStudents.size}</strong></span>
                                <span>Subjects Evaluated: <strong>{[...new Set(resultsForExam.map((r) => r.subject))].length}</strong></span>
                              </div>
                              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', fontSize: '13px', fontWeight: '700', color: branch.color }}>
                                View Performance Breakdown →
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Configurations Manager */}
        {!readOnly && (
          <div style={{ marginTop: '40px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '17px', fontWeight: '800', color: '#1a2e4a' }}>
              ⚙️ Active Exam Configurations
            </h3>

            {examSessions.length === 0 ? (
              <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1.5px dashed #cbd5e1', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
                  No exam configurations active. Click "+ Configure New Exam" to define one.
                </p>
              </div>
            ) : (
              <div className="tp-table-container tp-table-responsive" style={{ borderRadius: '14px', border: '1.5px solid #e2e8f0', overflowX: 'auto', WebkitOverflowScrolling: 'touch', boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '.05em' }}>Exam Name</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '.05em' }}>Target Class</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '.05em' }}>Configured Subject Rules</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '.05em' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examSessions.map((exam) => (
                      <tr key={exam.examId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>{exam.name}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>{exam.targetClass}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>
                          {Object.keys(exam.subjectRules || {}).length > 0 ? (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {Object.entries(exam.subjectRules).map(([sub, rule]) => {
                                // Detect CQ/MCQ rule vs legacy
                                const isCqMcq = rule.cqTotal != null;
                                const hasMcq = isCqMcq && rule.hasMcq !== false && rule.mcqTotal > 0;
                                const isPrimaryExam = exam.branchKey === 'primary' || getBranchKeyByClass(exam.targetClass) === 'primary';
                                return (
                                  <span key={sub} style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                                    {sub}{' '}
                                    {isCqMcq ? (
                                      <span style={{ color: '#475569' }}>
                                        CQ:{rule.cqTotal}/p{rule.cqPass}
                                        {hasMcq ? ` ${isPrimaryExam ? 'Tut' : 'MCQ'}:${rule.mcqTotal}/p${rule.mcqPass}` : ' (CQ only)'}
                                      </span>
                                    ) : (
                                      <span style={{ color: '#475569' }}>({rule.totalMarks}/{rule.passMarks})</span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span style={{ fontStyle: 'italic' }}>None configured (uses default 100/33 rules)</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteExamSessionCard(e, exam)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              fontWeight: '700',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (selectedStudent) {
    const activeExamName =
      selectedExamSession?.name ||
      selectedExamSession?.title ||
      selectedExamSession?.examName ||
      selectedExamSession?.term ||
      (selectedStudent?.subjects?.[0]?.examId && selectedStudent?.subjects?.[0]?.examId !== 'current'
        ? selectedStudent?.subjects?.[0]?.examId
        : null) ||
      'Annual Examination';

    return (
      <div
        className="single-marksheet-page-view"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 999999,
          backgroundColor: '#f8fafc',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top Header Bar for Single Page View (Hidden during printing) */}
        <div
          className="mark-sheet-no-print transcript-top-header"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: 'linear-gradient(135deg, #0f172a, #1e3a8a)',
            padding: '14px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
            color: '#ffffff',
          }}
        >
          <div className="transcript-top-header-left" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={() => setSelectedStudentKey(null)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '10px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '14px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)')}
            >
              ← Back
            </button>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.01em', wordBreak: 'break-word' }}>
                📄 {selectedStudent.name} — Download Marksheet PDF
              </h3>
              <span style={{ fontSize: '12px', color: '#93c5fd', fontWeight: '600', wordBreak: 'break-word', display: 'block' }}>
                Class: {selectedStudent.class} | Roll: {selectedStudent.roll} | Exam: {activeExamName}
              </span>
            </div>
          </div>
          <div className="transcript-top-header-right" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleDownloadPdf}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '9px 18px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '13.5px',
                boxShadow: '0 4px 12px rgba(37,99,235,0.4)',
              }}
            >
              📥 Download PDF
            </button>
            <button
              type="button"
              className="mark-sheet-desktop-only-btn"
              onClick={handlePrintMarkSheet}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '10px',
                padding: '9px 16px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '13.5px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)')}
            >
              🖨️ Print Marksheet
            </button>
          </div>
        </div>

        {/* Standalone Marksheet Content Container */}
        <div
          className="single-marksheet-content-container"
          style={{
            flex: 1,
            padding: '24px 16px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ width: '100%', maxWidth: '900px' }}>
            {renderStudentDetails()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={selectedStudent ? 'mark-sheet-mode' : 'results-list-mode'} style={{ padding: '20px 0' }}>
      <div className="results-header mark-sheet-no-print" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        padding: '20px 22px',
        background: 'linear-gradient(135deg, #1e3a8a, #1d4ed8)',
        borderRadius: '16px',
        boxShadow: '0 8px 24px rgba(29,78,216,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>📋</span>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '800',
              color: '#fff',
              letterSpacing: '-.01em',
            }}>
              Exam Results
            </h2>
            <p style={{ margin: '2px 0 0', color: '#bfdbfe', fontSize: '12px', fontWeight: '500' }}>View &amp; manage student academic results</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {!readOnly && !showEntryForm && (
            <button
              type="button"
              className="add-result-btn mark-sheet-no-print"
              onClick={() => setShowEntryForm(true)}
              style={{
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: '700',
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: '10px',
                cursor: 'pointer',
              }}
            >
              + Add Result
            </button>
          )}
          <button
            type="button"
            className="pdf-download-btn mark-sheet-no-print"
            onClick={handleDownloadPdf}
            style={{
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: '700',
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '10px',
              cursor: 'pointer',
            }}
          >
            📄 PDF
          </button>
          {selectedStudent && (
            <button
              className="back-button mark-sheet-no-print"
              onClick={() => setSelectedStudentKey(null)}
              style={{
                padding: '9px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)',
                cursor: 'pointer',
              }}
            >
              ← Back
            </button>
          )}
        </div>
      </div>

      {renderConfigureExamModal()}
      {!selectedExamSession ? (
        renderExamDirectory()
      ) : (
        <>
          <div style={{
            background: '#eff6ff',
            border: '1.5px solid #bfdbfe',
            borderRadius: '12px',
            padding: '12px 18px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => {
                  setSelectedExamSession(null);
                  setSelectedStudentKey(null);
                }}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '12px'
                }}
              >
                ← Back to Directory
              </button>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e3a8a' }}>
                Viewing Results for: <strong style={{ color: '#1e293b' }}>{selectedExamSession.name} ({selectedExamSession.targetClass})</strong>
              </span>
            </div>
            {selectedExamSession.isLegacy && (
              <span style={{ background: '#e2e8f0', color: '#475569', fontSize: '11px', fontWeight: '800', padding: '4px 8px', borderRadius: '4px' }}>Legacy Result Set</span>
            )}
          </div>
          {!readOnly && showEntryForm && renderEntrySection()}
          {renderSearchPanel()}
          <div style={{
            background: 'transparent',
            borderRadius: '14px',
            overflow: 'visible',
          }}>
            {selectedStudent ? renderStudentDetails() : renderStudentList()}
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ConfigureExamModal Component
   ───────────────────────────────────────────────────────────── */
function ConfigureExamModal({ classes = [], onClose, onSave }) {
  const { showAlert } = useAlert();
  const [selectedBranch, setSelectedBranch] = useState('primary');
  const [name, setName] = useState('');
  const [targetGroup, setTargetGroup] = useState('All');
  const [customSubjects, setCustomSubjects] = useState([]);
  const [newSubjectInput, setNewSubjectInput] = useState('');

  // Filter classOptions dynamically based on selectedBranch
  const filteredClassOptions = useMemo(() => {
    return classes
      .map(c => c.className)
      .filter(Boolean)
      .filter(className => getBranchKeyByClass(className) === selectedBranch);
  }, [classes, selectedBranch]);

  const [targetClass, setTargetClass] = useState('');

  // Automatically select the first available class when filteredClassOptions changes
  useEffect(() => {
    if (filteredClassOptions.length > 0) {
      setTargetClass(filteredClassOptions[0]);
    } else {
      setTargetClass('');
    }
  }, [filteredClassOptions]);

  const classObj = useMemo(() => {
    return (classes || []).find(c => c.className === targetClass) || null;
  }, [classes, targetClass]);

  const availableGroups = useMemo(() => {
    if (!classObj) return [];
    const grpSet = new Set();
    if (Array.isArray(classObj.groups) && classObj.groups.length > 0) {
      classObj.groups.forEach(g => g && grpSet.add(String(g).trim()));
    }
    if (classObj.groupSubjects) {
      Object.keys(classObj.groupSubjects).forEach(g => g && grpSet.add(String(g).trim()));
    }
    return Array.from(grpSet);
  }, [classObj]);

  useEffect(() => {
    if (availableGroups.length > 0) {
      if (!targetGroup || (targetGroup !== 'All' && !availableGroups.includes(targetGroup))) {
        setTargetGroup(availableGroups[0]);
      }
    } else {
      setTargetGroup('General');
    }
    setCustomSubjects([]);
  }, [targetClass, availableGroups]);

  // Extract actual assigned subjects for targetClass & targetGroup
  const assignedSubjects = useMemo(() => {
    if (!targetClass || !classObj) return [];

    let subList = [];
    if (classObj.groupSubjects) {
      if (targetGroup && targetGroup !== 'All' && Array.isArray(classObj.groupSubjects[targetGroup])) {
        subList = classObj.groupSubjects[targetGroup];
      } else {
        const merged = new Set();
        Object.values(classObj.groupSubjects).forEach(list => {
          if (Array.isArray(list)) list.forEach(s => s && merged.add(String(s).trim()));
        });
        subList = Array.from(merged);
      }
    }

    // Fallback to LocalStorage teacherPanelGroupSubjects if classObj.groupSubjects was empty
    if ((!subList || subList.length === 0) && typeof window !== 'undefined' && window.localStorage) {
      try {
        const rawStorage = window.localStorage.getItem('teacherPanelGroupSubjects');
        if (rawStorage) {
          const parsed = JSON.parse(rawStorage);
          const classIdx = (classes || []).findIndex(c => c.className === targetClass);
          const groupMap = parsed[classIdx] || parsed[targetClass] || parsed[String(classIdx)];
          if (groupMap) {
            if (targetGroup && targetGroup !== 'All' && Array.isArray(groupMap[targetGroup])) {
              subList = groupMap[targetGroup];
            } else {
              const merged = new Set();
              Object.values(groupMap).forEach(list => {
                if (Array.isArray(list)) list.forEach(s => s && merged.add(String(s).trim()));
              });
              subList = Array.from(merged);
            }
          }
        }
      } catch (err) {
        console.warn('Error reading stored group subjects:', err);
      }
    }

    if ((!subList || subList.length === 0) && Array.isArray(classObj.subjects)) {
      subList = classObj.subjects;
    }

    return Array.from(new Set((subList || []).map(s => String(s || '').trim()).filter(Boolean)));
  }, [targetClass, targetGroup, classObj, classes]);

  const modalSubjects = useMemo(() => {
    return Array.from(new Set([...assignedSubjects, ...customSubjects]));
  }, [assignedSubjects, customSubjects]);

  const [rules, setRules] = useState({});

  useEffect(() => {
    setRules(prev => {
      const updated = {};
      (modalSubjects || []).forEach(sub => {
        if (sub) {
          updated[sub] = prev[sub] || {
            included: true,
            cqTotal: 70,
            cqPass: 23,
            mcqTotal: 30,
            mcqPass: 10,
            hasMcq: true,
          };
        }
      });
      return updated;
    });
  }, [modalSubjects]);

  const handleRuleChange = (subject, field, value) => {
    const coerced = field === 'hasMcq' || field === 'included'
      ? value === '1' || value === true
      : (parseInt(value, 10) || 0);

    setRules(prev => ({
      ...prev,
      [subject]: {
        ...(prev[subject] || { included: true, cqTotal: 70, cqPass: 23, mcqTotal: 30, mcqPass: 10, hasMcq: true }),
        [field]: coerced,
      },
    }));
  };

  const handleAddCustomSubject = (e) => {
    e.preventDefault();
    const trimmed = newSubjectInput.trim();
    if (!trimmed) return;
    if (modalSubjects.map(s => s.toLowerCase()).includes(trimmed.toLowerCase())) {
      showAlert(`Subject "${trimmed}" is already in the list.`, 'Duplicate Subject', 'warning');
      return;
    }
    setCustomSubjects(prev => [...prev, trimmed]);
    setRules(prev => ({
      ...prev,
      [trimmed]: { included: true, cqTotal: 70, cqPass: 23, mcqTotal: 30, mcqPass: 10, hasMcq: true },
    }));
    setNewSubjectInput('');
  };

  const handleRemoveCustomSubject = (sub) => {
    setCustomSubjects(prev => prev.filter(s => s !== sub));
    setRules(prev => {
      const next = { ...prev };
      delete next[sub];
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showAlert('Please enter an exam name.', 'Validation Error', 'warning');
      return;
    }
    if (!targetClass) {
      showAlert('Please select a target class.', 'Validation Error', 'warning');
      return;
    }

    const isPrimaryBranch = selectedBranch === 'primary';
    const activeRules = {};

    for (const [sub, rule] of Object.entries(rules)) {
      if (rule && rule.included !== false) {
        if (Number(rule.cqPass) > Number(rule.cqTotal)) {
          showAlert(`"${sub}": CQ Pass marks (${rule.cqPass}) cannot exceed CQ Total (${rule.cqTotal}).`, 'Validation Error', 'warning');
          return;
        }
        if (rule.hasMcq && Number(rule.mcqPass) > Number(rule.mcqTotal)) {
          showAlert(`"${sub}": ${isPrimaryBranch ? 'Tutorial' : 'MCQ'} Pass marks (${rule.mcqPass}) cannot exceed ${isPrimaryBranch ? 'Tutorial' : 'MCQ'} Total (${rule.mcqTotal}).`, 'Validation Error', 'warning');
          return;
        }
        activeRules[sub] = {
          cqTotal: Number(rule.cqTotal) || 0,
          cqPass: Number(rule.cqPass) || 0,
          mcqTotal: rule.hasMcq ? (Number(rule.mcqTotal) || 0) : 0,
          mcqPass: rule.hasMcq ? (Number(rule.mcqPass) || 0) : 0,
          hasMcq: rule.hasMcq !== false,
        };
      }
    }

    if (Object.keys(activeRules).length === 0) {
      showAlert('Please select or add at least one active subject for this exam.', 'Validation Error', 'warning');
      return;
    }

    const sanitizeForId = (str) => {
      return String(str || '')
        .toLowerCase()
        .replace(/[^\w\s\u0980-\u09FF-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
    };

    const examId = `${sanitizeForId(name)}-${selectedBranch}-${sanitizeForId(targetClass)}${targetGroup ? `-${sanitizeForId(targetGroup)}` : ''}`;

    onSave({
      examId,
      branchKey: selectedBranch,
      name: name.trim(),
      targetClass,
      targetGroup: targetGroup || 'General',
      subjectRules: activeRules,
    });
  };

  return (
    <div className="tp-modal-overlay" onClick={onClose}>
      <div className="tp-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '780px' }}>
        <div className="tp-modal-header" style={{ borderBottomColor: '#8b5cf6' }}>
          <h3 className="tp-modal-title">⚙️ Configure New Exam Session</h3>
          <button className="tp-modal-close" onClick={onClose}>✕</button>
        </div>
        <form className="tp-modal-body" onSubmit={handleSubmit}>
          <div className="tp-form-group" style={{ marginBottom: '16px' }}>
            <label className="tp-form-label">Institution Branch / Track *</label>
            <select
              className="tp-form-input"
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              style={{ width: '100%' }}
            >
              {Object.keys(SCHOOL_BRANCHES || {}).map(key => (
                <option key={key} value={key}>
                  {SCHOOL_BRANCHES[key]?.emoji || '🏫'} {SCHOOL_BRANCHES[key]?.name || key}
                </option>
              ))}
            </select>
          </div>

          <div className="tp-form-grid" style={{ gap: '16px' }}>
            <div className="tp-form-group">
              <label className="tp-form-label">Exam Name *</label>
              <input
                className="tp-form-input"
                type="text"
                placeholder="e.g., 1st Term Exam"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
            <div className="tp-form-group">
              <label className="tp-form-label">Target Class *</label>
              <select
                className="tp-form-input"
                value={targetClass}
                onChange={e => setTargetClass(e.target.value)}
                required
              >
                {filteredClassOptions.length > 0 ? (
                  filteredClassOptions.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))
                ) : (
                  <option value="" disabled>No classes configured in this branch</option>
                )}
              </select>
            </div>
          </div>

          {/* Group / Track Selection */}
          <div className="tp-form-group" style={{ marginTop: '16px' }}>
            <label className="tp-form-label">Target Group / Section *</label>
            <select
              className="tp-form-input"
              value={targetGroup}
              onChange={e => setTargetGroup(e.target.value)}
              style={{ width: '100%' }}
            >
              {availableGroups.length > 0 ? (
                <>
                  <option value="All">All Groups (Combined)</option>
                  {availableGroups.map(grp => (
                    <option key={grp} value={grp}>{grp}</option>
                  ))}
                </>
              ) : (
                <option value="General">General</option>
              )}
            </select>
          </div>

          {/* ── Assigned Class Subjects Grid ───────────────────────────── */}
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: '14px', color: '#1a2e4a', fontWeight: '800' }}>
                  📚 Class Assigned Subjects ({assignedSubjects.length} Found)
                </h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  Showing assigned subjects for <strong>{targetClass || 'Selected Class'}</strong> {targetGroup && targetGroup !== 'All' ? `(${targetGroup})` : ''}.
                </p>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', textAlign: 'right', lineHeight: 1.6 }}>
                <div><span style={{ color: '#2563eb', fontWeight: 700 }}>CQ</span> = Creative Questions</div>
                <div><span style={{ color: '#7c3aed', fontWeight: 700 }}>{selectedBranch === 'primary' ? 'Tutorial' : 'MCQ'}</span> = {selectedBranch === 'primary' ? 'Tutorial Marks' : 'Multiple Choice Qs'}</div>
              </div>
            </div>

            {/* If no assigned subjects found for this class/group */}
            {assignedSubjects.length === 0 && (
              <div style={{
                background: '#fffbebf0',
                border: '1.5px dashed #fcd34d',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '14px',
                fontSize: '13px',
                color: '#92400e',
              }}>
                <strong>⚠️ No subjects assigned to {targetClass || 'this class'} ({targetGroup || 'General'}) yet.</strong>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#b45309' }}>
                  Please assign subjects for this class/group in <strong>Class / Subject Management</strong>, or add subjects manually using the input below.
                </p>
              </div>
            )}

            {/* Quick Add Custom Subject input */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                className="tp-form-input"
                placeholder="+ Add extra subject name (e.g. Higher Math)"
                value={newSubjectInput}
                onChange={e => setNewSubjectInput(e.target.value)}
                style={{ flex: 1, fontSize: '13px' }}
              />
              <button
                type="button"
                onClick={handleAddCustomSubject}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Add Subject
              </button>
            </div>

            {/* Subject Grid Table */}
            <div style={{ maxHeight: '300px', overflowY: 'auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#f8fafc' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#eff6ff', borderBottom: '1.5px solid #bfdbfe' }}>
                    <th style={{ padding: '10px 10px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#1d4ed8', width: 45 }}>Use</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#1d4ed8', textTransform: 'uppercase', minWidth: 120 }}>Subject Name</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#2563eb', textTransform: 'uppercase', width: 90 }}>CQ Total</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#2563eb', textTransform: 'uppercase', width: 90 }}>CQ Pass</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', width: 80 }}>{selectedBranch === 'primary' ? 'Tutorial?' : 'MCQ?'}</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', width: 90 }}>{selectedBranch === 'primary' ? 'Tutorial Total' : 'MCQ Total'}</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', width: 90 }}>{selectedBranch === 'primary' ? 'Tutorial Pass' : 'MCQ Pass'}</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: 75 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {modalSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '30px 14px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', fontWeight: '600' }}>
                        No subjects available for this class. Add a subject above to proceed.
                      </td>
                    </tr>
                  ) : (
                    modalSubjects.map(sub => {
                      const rule = rules[sub] || { included: true, cqTotal: 70, cqPass: 23, mcqTotal: 30, mcqPass: 10, hasMcq: true };
                      const isIncluded = rule.included !== false;
                      const hasMcq = rule.hasMcq !== false;
                      const combined = Number(rule.cqTotal || 0) + (hasMcq ? Number(rule.mcqTotal || 0) : 0);
                      const isCustom = customSubjects.includes(sub);
                      const inputStyle = { width: '70px', padding: '5px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '700', fontSize: 13 };

                      return (
                        <tr key={sub} style={{ borderBottom: '1px solid #e2e8f0', opacity: isIncluded ? 1 : 0.45, background: isIncluded ? '#fff' : '#f1f5f9' }}>
                          {/* Include Checkbox */}
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isIncluded}
                              onChange={e => handleRuleChange(sub, 'included', e.target.checked)}
                              style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#1d4ed8' }}
                            />
                          </td>

                          {/* Subject Name */}
                          <td style={{ padding: '10px 14px', fontWeight: '600', color: '#1e293b' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              {sub}
                              {isCustom && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCustomSubject(sub)}
                                  style={{ border: 'none', background: '#fee2e2', color: '#dc2626', borderRadius: '50%', width: 18, height: 18, fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}
                                  title="Remove Subject"
                                >
                                  ✕
                                </button>
                              )}
                            </span>
                          </td>

                          {/* CQ Total */}
                          <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                            <input
                              type="number" min="1" max="500"
                              disabled={!isIncluded}
                              style={inputStyle}
                              value={rule.cqTotal ?? 70}
                              onChange={e => handleRuleChange(sub, 'cqTotal', e.target.value)}
                              required={isIncluded}
                            />
                          </td>

                          {/* CQ Pass */}
                          <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                            <input
                              type="number" min="0" max={rule.cqTotal ?? 70}
                              disabled={!isIncluded}
                              style={{ ...inputStyle, borderColor: isIncluded && Number(rule.cqPass) > Number(rule.cqTotal) ? '#fca5a5' : '#cbd5e1' }}
                              value={rule.cqPass ?? 23}
                              onChange={e => handleRuleChange(sub, 'cqPass', e.target.value)}
                              required={isIncluded}
                            />
                          </td>

                          {/* MCQ toggle */}
                          <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: isIncluded ? 'pointer' : 'not-allowed' }}>
                              <input
                                type="checkbox"
                                disabled={!isIncluded}
                                checked={hasMcq}
                                onChange={e => handleRuleChange(sub, 'hasMcq', e.target.checked ? '1' : '0')}
                                style={{ width: 16, height: 16, accentColor: '#7c3aed', cursor: isIncluded ? 'pointer' : 'not-allowed' }}
                              />
                              <span style={{ fontSize: 11, color: hasMcq && isIncluded ? '#7c3aed' : '#94a3b8', fontWeight: 700 }}>{hasMcq ? 'ON' : 'OFF'}</span>
                            </label>
                          </td>

                          {/* MCQ Total */}
                          <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                            <input
                              type="number" min="0" max="500"
                              disabled={!isIncluded || !hasMcq}
                              style={{ ...inputStyle, opacity: isIncluded && hasMcq ? 1 : 0.35, cursor: isIncluded && hasMcq ? 'auto' : 'not-allowed' }}
                              value={rule.mcqTotal ?? 30}
                              onChange={e => handleRuleChange(sub, 'mcqTotal', e.target.value)}
                            />
                          </td>

                          {/* MCQ Pass */}
                          <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                            <input
                              type="number" min="0" max={rule.mcqTotal ?? 30}
                              disabled={!isIncluded || !hasMcq}
                              style={{ ...inputStyle, opacity: isIncluded && hasMcq ? 1 : 0.35, cursor: isIncluded && hasMcq ? 'auto' : 'not-allowed', borderColor: isIncluded && hasMcq && Number(rule.mcqPass) > Number(rule.mcqTotal) ? '#fca5a5' : '#cbd5e1' }}
                              value={rule.mcqPass ?? 10}
                              onChange={e => handleRuleChange(sub, 'mcqPass', e.target.value)}
                            />
                          </td>

                          {/* Combined (read-only) */}
                          <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                            <span style={{ fontWeight: 800, color: '#1a2e4a', fontSize: 14 }}>{combined}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="tp-modal-footer" style={{ marginTop: '24px' }}>
            <button type="button" className="tp-modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="tp-modal-submit-btn" style={{ background: '#8b5cf6' }}>
              Create Exam Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
