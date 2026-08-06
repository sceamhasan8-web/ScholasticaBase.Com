import React, { useEffect, useMemo, useState } from 'react';
import { buildResultDocId, saveResultEntry, subscribeToExams } from '../firebase/firestoreSchema.js';
import { getDynamicGradeInfoWithComponents, resolveRuleTotals } from '../utils/bangladeshGrading.js';
import { getSchoolNameByClass, getBranchKeyByClass, SCHOOL_BRANCHES, filterClassesByBranch, sortClasses, getClassSortIndex } from '../utils/schoolResolver.js';
import useTranslation from '../hooks/useTranslation.js';
import useConfirm from '../hooks/useConfirm.js';
import { useSchoolProfile } from '../context/SchoolProfileContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useViewMode } from '../context/ViewModeContext.jsx';

const BRANCH_ORDER = ['primary', 'secondary', 'college'];

const fallbackSubjects = ['Mathematics', 'Physics', 'English', 'Science', 'History', 'Geography', 'Computer Science'];

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

const ResultEntry = ({ classes = [], currentTeacherProfile = null, currentTeacherAssignments = [], readOnly = false }) => {
  const safeClasses = Array.isArray(classes) ? classes : [];
  const classOptions = useMemo(() => sortClasses(safeClasses.filter((cls) => cls?.className)), [safeClasses]);
  const confirm = useConfirm();
  const { t } = useTranslation();

  const schoolProfileCtx = useSchoolProfile() || {};
  const schoolProfile = schoolProfileCtx.schoolProfile || schoolProfileCtx.defaultSchoolProfile || {};
  const authCtx = useAuth() || {};
  const user = authCtx.user || null;
  const viewModeCtx = useViewMode() || {};
  const effectiveUser = viewModeCtx.effectiveUser || user;

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

  // Determine initial branch: pick the first branch that has at least one class in classOptions
  const defaultBranch = useMemo(() => {
    for (const key of BRANCH_ORDER) {
      if (filterClassesByBranch(classOptions, key).length > 0) return key;
    }
    return BRANCH_ORDER[0];
  }, [classOptions]);

  const [selectedBranch, setSelectedBranch] = useState(defaultBranch);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(fallbackSubjects[0]);
  const [students, setStudents] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [examSessions, setExamSessions] = useState(() => getStoredExamSessions(activeSchoolId));
  const [selectedExamId, setSelectedExamId] = useState('');

  // Subscribe to Exam Sessions with activeSchoolId
  useEffect(() => {
    const unsubscribe = subscribeToExams(
      (snapshot) => {
        if (!snapshot || !snapshot.docs) return;
        const firestoreDocs = snapshot.docs.map((item) => ({ key: item.id, examId: item.data().examId || item.id, ...item.data() }));
        const localDocs = getStoredExamSessions(activeSchoolId);
        const map = new Map();
        [...localDocs, ...firestoreDocs].forEach((item) => {
          const id = item?.examId || item?.id || item?.key;
          if (id) map.set(id, { ...map.get(id), ...item });
        });
        const merged = Array.from(map.values());
        setExamSessions(merged);
        saveStoredExamSessions(merged, activeSchoolId);
      },
      (err) => {
        console.warn('Could not subscribe to exam sessions in ResultEntry:', err);
      },
      activeSchoolId
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [activeSchoolId]);

  const filteredExamSessions = useMemo(() => {
    if (!selectedClass) return examSessions;
    const targetNorm = String(selectedClass || '').trim().toLowerCase();
    const targetSortIdx = getClassSortIndex(selectedClass);
    return examSessions.filter((exam) => {
      if (!exam.targetClass) return true;
      const examNorm = String(exam.targetClass || '').trim().toLowerCase();
      if (examNorm === targetNorm) return true;
      const examSortIdx = getClassSortIndex(exam.targetClass);
      if (examSortIdx !== 99999 && targetSortIdx !== 99999 && examSortIdx === targetSortIdx) return true;
      return false;
    });
  }, [examSessions, selectedClass]);

  useEffect(() => {
    if (filteredExamSessions.length > 0) {
      if (!filteredExamSessions.some((exam) => (exam.examId || exam.key || exam.id) === selectedExamId)) {
        setSelectedExamId(filteredExamSessions[0].examId || filteredExamSessions[0].key || filteredExamSessions[0].id);
      }
    } else {
      setSelectedExamId('');
    }
  }, [filteredExamSessions, selectedExamId]);

  const selectedExam = useMemo(() => {
    return filteredExamSessions.find((exam) => (exam.examId || exam.key || exam.id) === selectedExamId) || null;
  }, [filteredExamSessions, selectedExamId]);

  const currentSubjectRule = useMemo(() => {
    if (!selectedExam || !selectedExam.subjectRules) return { totalMarks: 100, passMarks: 33 };
    return selectedExam.subjectRules[selectedSubject] || { totalMarks: 100, passMarks: 33 };
  }, [selectedExam, selectedSubject]);

  // Resolved combined totals for display / validation (works for both legacy and CQ/MCQ rules)
  const resolvedRule = useMemo(() => resolveRuleTotals(currentSubjectRule), [currentSubjectRule]);
  const hasCqMcqRule = resolvedRule.hasCqMcq;
  const hasMcqComponent = resolvedRule.hasMcq;

  const getGradeForTable = (cqMarks, mcqMarks) => {
    const cqVal = String(cqMarks ?? '');
    const mcqVal = String(mcqMarks ?? '');
    if (cqVal === '' && mcqVal === '') return '-';
    if (!hasCqMcqRule) {
      // Legacy: single marks field stored in cqMarks
      const total = (cqVal !== '' ? Number(cqVal) : 0) + (mcqVal !== '' ? Number(mcqVal) : 0);
      return getDynamicGradeInfoWithComponents(total, 0, { totalMarks: resolvedRule.totalMarks, passMarks: resolvedRule.passMarks }).grade;
    }
    if (cqVal === '') return '-';
    return getDynamicGradeInfoWithComponents(cqVal, mcqVal, currentSubjectRule).grade;
  };

  // Helper so we can still import getBangladeshGradeInfo-free but keep eslint happy
  const getDynamicGradeInfo = (marks, total, pass) =>
    getDynamicGradeInfoWithComponents(marks, 0, { totalMarks: total, passMarks: pass });

  const normalizeValue = (value) => String(value || '').trim();
  const normalizeKey = (value) => normalizeValue(value).toLowerCase();

  const teacherAccess = useMemo(() => {
    const normalized = Array.isArray(currentTeacherAssignments) ? currentTeacherAssignments : [];
    const classNames = new Set();
    const groupMap = {};
    const subjectMap = {};
    let hasClassTeacherScope = false;

    normalized.forEach((assignment) => {
      if (!assignment) return;
      const scope = normalizeValue(assignment.scope);
      let className = normalizeValue(assignment.className);
      const classIdx = Number.isFinite(Number(assignment.classIdx)) ? Number(assignment.classIdx) : null;
      const groupName = normalizeValue(assignment.groupName);
      const subject = normalizeValue(assignment.subject);

      if (!className && classIdx !== null && classes[classIdx]) {
        className = normalizeValue(classes[classIdx].className);
      }

      if (!className) return;
      const classKey = normalizeKey(className);
      const groupKey = normalizeKey(groupName);
      const subjectKey = normalizeKey(subject);

      if (scope === 'classTeacher') {
        hasClassTeacherScope = true;
        classNames.add(classKey);
        return;
      }

      classNames.add(classKey);

      if (groupKey) {
        groupMap[classKey] = groupMap[classKey] || new Set();
        groupMap[classKey].add(groupName);
      }
      if (subjectKey) {
        subjectMap[classKey] = subjectMap[classKey] || new Set();
        subjectMap[classKey].add(subject);
      }
      if (groupKey && subjectKey) {
        const groupSubjectKey = `${classKey}||${groupKey}`;
        subjectMap[groupSubjectKey] = subjectMap[groupSubjectKey] || new Set();
        subjectMap[groupSubjectKey].add(subject);
      }
    });

    return {
      classNames,
      groupMap,
      subjectMap,
      hasClassTeacherScope,
    };
  }, [classes, currentTeacherAssignments]);

  const hasTeacherRestrictions = useMemo(() => {
    return Array.isArray(currentTeacherAssignments)
      && currentTeacherAssignments.length > 0;
  }, [currentTeacherAssignments]);

  // effectiveReadOnly is declared AFTER selectedClassData (see below) to avoid TDZ error

  const allowedClassOptions = useMemo(() => {
    if (!hasTeacherRestrictions || teacherAccess.classNames.size === 0) {
      return classOptions;
    }
    const allowed = classOptions.filter((cls) => teacherAccess.classNames.has(normalizeKey(cls.className)));
    return allowed.length > 0 ? allowed : classOptions;
  }, [classOptions, hasTeacherRestrictions, teacherAccess.classNames]);

  // Filter class options further by selected branch
  const branchFilteredClassOptions = useMemo(() => {
    const branchClasses = filterClassesByBranch(allowedClassOptions, selectedBranch);
    return branchClasses.length > 0 ? branchClasses : allowedClassOptions;
  }, [allowedClassOptions, selectedBranch]);

  const selectedClassData = useMemo(
    () => branchFilteredClassOptions.find((cls) => cls.className === selectedClass) || branchFilteredClassOptions[0] || null,
    [branchFilteredClassOptions, selectedClass]
  );

  const isPrimaryBranch = selectedBranch === 'primary' || getBranchKeyByClass(selectedClass) === 'primary';

  // Declared here (after selectedClassData) to avoid Temporal Dead Zone crash
  const effectiveReadOnly = useMemo(() => {
    // If not read-only mode, always allow editing
    if (!readOnly) return false;

    // If the teacher has group+subject assignments, check if the current
    // class/group/subject selection matches one of their assignments.
    // If it does, lift the read-only restriction for that combination.
    const assignments = Array.isArray(currentTeacherAssignments) ? currentTeacherAssignments : [];
    if (assignments.length === 0) return true;

    const hasMatchingAssignment = assignments.some((assignment) => {
      if (!assignment) return false;
      // classTeacher scope: allow editing for their assigned class
      if (normalizeValue(assignment.scope) === 'classTeacher') {
        let assignedClassName = normalizeValue(assignment.className);
        const classIdx = Number.isFinite(Number(assignment.classIdx)) ? Number(assignment.classIdx) : null;
        if (!assignedClassName && classIdx !== null && classes[classIdx]) {
          assignedClassName = normalizeValue(classes[classIdx].className);
        }
        return normalizeKey(assignedClassName) === normalizeKey(selectedClassData?.className);
      }

      const assignedGroupName = normalizeValue(assignment.groupName);
      const assignedSubject = normalizeValue(assignment.subject);

      // Must have both group and subject to qualify for group-teacher entry
      if (!assignedGroupName || !assignedSubject) return false;

      // Resolve className from assignment
      let assignedClassName = normalizeValue(assignment.className);
      const classIdx = Number.isFinite(Number(assignment.classIdx)) ? Number(assignment.classIdx) : null;
      if (!assignedClassName && classIdx !== null && classes[classIdx]) {
        assignedClassName = normalizeValue(classes[classIdx].className);
      }
      if (!assignedClassName) return false;

      // Check if current selections match this assignment
      const classMatch = normalizeKey(assignedClassName) === normalizeKey(selectedClassData?.className);
      const groupMatch = normalizeKey(assignedGroupName) === normalizeKey(selectedSection);
      const subjectMatch = normalizeKey(assignedSubject) === normalizeKey(selectedSubject);

      return classMatch && groupMatch && subjectMatch;
    });

    return !hasMatchingAssignment;
  }, [readOnly, currentTeacherAssignments, classes, selectedClassData, selectedSection, selectedSubject]);

  const groupOptions = selectedClassData?.groups || [];
  const configuredSubjects = selectedClassData?.groupSubjects?.[selectedSection] || [];
  const subjectOptions = configuredSubjects.length > 0 ? configuredSubjects : fallbackSubjects;

  const isClassAllowed = useMemo(() => {
    if (!hasTeacherRestrictions || teacherAccess.classNames.size === 0) return true;
    return teacherAccess.classNames.has(normalizeKey(selectedClassData?.className));
  }, [hasTeacherRestrictions, teacherAccess.classNames, selectedClassData]);

  const allowedGroupOptions = useMemo(() => {
    const selectedClassKey = normalizeKey(selectedClassData?.className);
    if (!hasTeacherRestrictions || teacherAccess.groupMap[selectedClassKey]?.size === 0) {
      return groupOptions;
    }
    const allowed = groupOptions.filter((groupName) => {
      const allowedGroups = Array.from(teacherAccess.groupMap[selectedClassKey] || new Set());
      return allowedGroups.some((assignedGroup) => normalizeKey(assignedGroup) === normalizeKey(groupName));
    });
    return allowed.length > 0 ? allowed : groupOptions;
  }, [hasTeacherRestrictions, groupOptions, selectedClassData, teacherAccess.groupMap]);

  const allowedSubjectOptions = useMemo(() => {
    const selectedClassKey = normalizeKey(selectedClassData?.className);
    if (!hasTeacherRestrictions || teacherAccess.subjectMap[selectedClassKey]?.size === 0) {
      return subjectOptions;
    }
    const values = Array.from(teacherAccess.subjectMap[selectedClassKey] || new Set());
    if (allowedGroupOptions.length > 0 && selectedSection) {
      const groupKey = `${selectedClassKey}||${normalizeKey(selectedSection)}`;
      const groupSubjects = Array.from(teacherAccess.subjectMap[groupKey] || new Set());
      if (groupSubjects.length > 0) return groupSubjects;
      if (values.length > 0) return values;
      return subjectOptions;
    }
    return values.length > 0 ? values : subjectOptions;
  }, [allowedGroupOptions, hasTeacherRestrictions, selectedClassData, selectedSection, subjectOptions, teacherAccess.subjectMap]);

  // When selectedBranch changes, reset selectedClass to first available in that branch
  useEffect(() => {
    const firstInBranch = branchFilteredClassOptions[0];
    if (firstInBranch && selectedClass !== firstInBranch.className) {
      setSelectedClass(firstInBranch.className);
    }
  }, [selectedBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!branchFilteredClassOptions.length) {
      setSelectedClass('');
      return;
    }
    if (!selectedClass || !branchFilteredClassOptions.some((cls) => cls.className === selectedClass)) {
      setSelectedClass(branchFilteredClassOptions[0].className);
    }
  }, [branchFilteredClassOptions, selectedClass]);

  useEffect(() => {
    if (!allowedSubjectOptions.length) {
      setSelectedSubject(fallbackSubjects[0]);
      return;
    }
    if (!selectedSubject || !allowedSubjectOptions.includes(selectedSubject)) {
      setSelectedSubject(allowedSubjectOptions[0]);
    }
  }, [allowedSubjectOptions, selectedSubject]);

  useEffect(() => {
    const firstGroup = allowedGroupOptions[0] || '';
    if (!selectedSection || !allowedGroupOptions.includes(selectedSection)) {
      setSelectedSection(firstGroup);
    }
  }, [allowedGroupOptions, selectedSection]);

  useEffect(() => {
    const rosterForSelection = (selectedClassData?.students || [])
      .filter((student) => !selectedSection || student.group === selectedSection)
      .map((student) => ({ ...student, marks: '', cqMarks: '', mcqMarks: '' }));
    setStudents(rosterForSelection);
    setFeedback('');
  }, [selectedClassData, selectedSection]);

  useEffect(() => {
    if (!allowedSubjectOptions.includes(selectedSubject)) {
      setSelectedSubject(allowedSubjectOptions[0] || fallbackSubjects[0]);
    }
  }, [selectedSubject, allowedSubjectOptions]);

  if (classOptions.length === 0) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.headerRow}>
            <div>
              <p style={styles.meta}>Result Entry</p>
              <h2 style={styles.title}>No class data available</h2>
            </div>
          </div>
          <p style={styles.feedback}>Please add class data first or refresh the page.</p>
        </div>
      </div>
    );
  }

  if (!selectedClassData) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.headerRow}>
            <div>
              <p style={styles.meta}>Result Entry</p>
              <h2 style={styles.title}>No class selected</h2>
            </div>
          </div>
          <p style={styles.feedback}>The selected class is not available for result entry.</p>
        </div>
      </div>
    );
  }

  const handleCqChange = (roll, value) => {
    const maxCq = hasCqMcqRule ? Number(currentSubjectRule.cqTotal) : resolvedRule.totalMarks;
    if (value !== '' && (Number(value) < 0 || Number(value) > maxCq)) return;
    setStudents((prev) =>
      prev.map((s) => s.roll === roll ? { ...s, cqMarks: value, marks: '' } : s)
    );
    setFeedback('');
  };

  const handleMcqChange = (roll, value) => {
    const maxMcq = hasCqMcqRule && hasMcqComponent ? Number(currentSubjectRule.mcqTotal) : 0;
    if (value !== '' && (Number(value) < 0 || Number(value) > maxMcq)) return;
    setStudents((prev) =>
      prev.map((s) => s.roll === roll ? { ...s, mcqMarks: value, marks: '' } : s)
    );
    setFeedback('');
  };

  // Legacy single-marks change (used when no CQ/MCQ rule configured)
  const handleMarksChange = (roll, value) => {
    if (value !== '' && (Number(value) < 0 || Number(value) > resolvedRule.totalMarks)) return;
    setStudents((prev) =>
      prev.map((s) => s.roll === roll ? { ...s, cqMarks: value, mcqMarks: '', marks: value } : s)
    );
    setFeedback('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (effectiveReadOnly) {
      setFeedback('Read-only teacher login cannot save result changes.');
      return;
    }
    if (!selectedExamId) {
      setFeedback('Error: Please select a configured Exam Session first.');
      return;
    }
    if (!isClassAllowed) {
      setFeedback('You are not assigned to this class. Please choose your assigned class.');
      return;
    }
    if (!allowedGroupOptions.includes(selectedSection)) {
      setFeedback('You are not assigned to this group. Please choose your assigned group.');
      return;
    }
    if (!allowedSubjectOptions.includes(selectedSubject)) {
      setFeedback('You are not assigned to this subject. Please choose your assigned subject.');
      return;
    }
    // A student counts as filled when either cqMarks or (legacy) marks is entered
    const filledStudents = students.filter((student) => {
      if (hasCqMcqRule) return String(student.cqMarks ?? '') !== '';
      return String(student.cqMarks ?? student.marks ?? '') !== '';
    });

    if (filledStudents.length === 0) {
      setFeedback('Please enter at least one mark before submit.');
      return;
    }

    const count = filledStudents.length;
    const shouldSave = await confirm({
      title: 'Save Results Confirmation',
      message: `Are you sure you want to save results for ${count} student${count > 1 ? 's' : ''}?`,
      confirmText: 'OK, Save',
      cancelText: 'Cancel'
    });
    if (!shouldSave) {
      setFeedback('Save cancelled.');
      return;
    }

    setFeedback('Saving results to database...');

    try {
      await Promise.all(filledStudents.map((student) => {
        let cqMarks, mcqMarks, marks;
        if (hasCqMcqRule) {
          cqMarks  = String(student.cqMarks ?? '') !== '' ? Number(student.cqMarks) : 0;
          mcqMarks = hasMcqComponent ? (String(student.mcqMarks ?? '') !== '' ? Number(student.mcqMarks) : 0) : 0;
          marks    = cqMarks + mcqMarks;
        } else {
          // Legacy path: treat cqMarks as the single combined mark
          marks    = Number(student.cqMarks ?? student.marks ?? 0);
          cqMarks  = marks;
          mcqMarks = 0;
        }

        const gradeInfo = getDynamicGradeInfoWithComponents(cqMarks, mcqMarks, currentSubjectRule);
        const studentId = student.id || `${selectedClass}-${selectedSection}-${student.roll}`.replace(/\s+/g, '-');
        const resultId  = buildResultDocId({ studentId, subject: selectedSubject, examId: selectedExamId });

        return saveResultEntry({
          studentId,
          studentName: student.name,
          name: student.name,
          fatherName: student.fatherName || 'N/A',
          motherName: student.motherName || 'N/A',
          profilePic: student.profilePic || '',
          roll: student.roll,
          class: selectedClass,
          section: selectedSection,
          group: selectedSection,
          subject: selectedSubject,
          marks,
          cqMarks,
          mcqMarks,
          grade: gradeInfo.grade,
          gradePoint: gradeInfo.gradePoint,
          status: gradeInfo.status,
          remarks: gradeInfo.remarks,
          examId: selectedExamId,
          schoolId: activeSchoolId,
          key: resultId,
        }, activeSchoolId);
      }));

      setFeedback(`Marks saved and verified in Firebase for ${filledStudents.length} student${filledStudents.length > 1 ? 's' : ''}.`);
    } catch (err) {
      console.warn('Could not save results to Firestore:', err);
      setFeedback('Could not verify database save. Please check your public URL, internet, and Firebase rules.');
    }
  };

  // Enter-key navigation: CQ → MCQ (within same row) → next row CQ
  const handleMarksKeyDown = (event, index, field) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();

    if (hasCqMcqRule && hasMcqComponent && field === 'cq') {
      // Move to the MCQ input in the same row
      const mcqInput = document.querySelector(`[data-mcq-input="${index}"]`);
      if (mcqInput) { mcqInput.focus(); mcqInput.select(); return; }
    }

    // Move to the CQ input of the next row
    const nextCq = document.querySelector(`[data-cq-input="${index + 1}"]`);
    if (nextCq) { nextCq.focus(); nextCq.select(); return; }

    // Fall back: submit the form
    event.currentTarget.form?.requestSubmit();
  };

  const handleReset = () => {
    const rosterForSelection = (selectedClassData?.students || [])
      .filter((student) => !selectedSection || student.group === selectedSection)
      .map((student) => ({ ...student, marks: '', cqMarks: '', mcqMarks: '' }));
    setStudents(rosterForSelection);
    setFeedback('Form cleared.');
  };

  const enteredCount = students.filter((s) =>
    hasCqMcqRule ? String(s.cqMarks ?? '') !== '' : String(s.cqMarks ?? s.marks ?? '') !== ''
  ).length;
  const averageMarks = students
    .filter((s) => hasCqMcqRule ? String(s.cqMarks ?? '') !== '' : String(s.cqMarks ?? s.marks ?? '') !== '')
    .reduce((sum, s) => {
      const cq  = Number(s.cqMarks  ?? 0);
      const mcq = Number(s.mcqMarks ?? 0);
      return sum + cq + (hasMcqComponent ? mcq : 0);
    }, 0);

  return (
    <div style={styles.page} className="result-entry-page">
      <div style={styles.card} className="result-entry-card">
        <div style={styles.headerRow} className="result-entry-header-row">
          <div style={styles.headerTitleBox} className="result-entry-title-box">
            <p style={styles.meta}>{effectiveReadOnly ? t('results.teacherResultView') : t('results.teacherResultEntry')}</p>
            <h2 style={styles.title}>{effectiveReadOnly ? t('results.resultView') : t('results.resultEntry')}</h2>
          </div>
          <div style={styles.headerBadgeBox} className="result-entry-badge-box">
            <div style={styles.badge}>{effectiveReadOnly ? t('common.readOnly') : t('common.live')}</div>
            {/* Resolved institution name badge */}
            {selectedClassData && getSchoolNameByClass(selectedClassData.className) && (
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: SCHOOL_BRANCHES[getBranchKeyByClass(selectedClassData.className)]?.color || '#475569',
                background: `${SCHOOL_BRANCHES[getBranchKeyByClass(selectedClassData.className)]?.color || '#475569'}14`,
                padding: '4px 12px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <span>{SCHOOL_BRANCHES[getBranchKeyByClass(selectedClassData.className)]?.emoji}</span>
                <span>{getSchoolNameByClass(selectedClassData.className)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Branch Filter Pills */}
        <div className="result-entry-branch-pills" style={styles.branchPillsRow}>
          {BRANCH_ORDER.map((branchKey) => {
            const branch = SCHOOL_BRANCHES[branchKey];
            const hasClasses = filterClassesByBranch(allowedClassOptions, branchKey).length > 0;
            if (!hasClasses) return null;
            const isActive = selectedBranch === branchKey;
            return (
              <button
                key={branchKey}
                type="button"
                onClick={() => setSelectedBranch(branchKey)}
                style={{
                  ...styles.branchPillBtn,
                  border: `2px solid ${isActive ? branch.color : '#e2e8f0'}`,
                  background: isActive ? `linear-gradient(135deg, ${branch.color}, ${branch.gradientTo || branch.color})` : '#f8fafc',
                  color: isActive ? '#fff' : '#475569',
                  boxShadow: isActive ? `0 4px 14px ${branch.color}40` : 'none',
                }}
              >
                <span style={{ fontSize: 15 }}>{branch.emoji}</span>
                <span>{branch.shortName}</span>
              </button>
            );
          })}
        </div>

        <div style={styles.controls} className="result-entry-controls">
          <label style={styles.field}>
            <span style={styles.label}>{t('results.class')}</span>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} style={styles.select}>
              {branchFilteredClassOptions.map((cls) => (
                <option key={cls.className} value={cls.className}>{cls.className}</option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>{t('results.examSession')} *</span>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              style={{
                ...styles.select,
                borderColor: !selectedExamId ? '#fca5a5' : '#cbd5e1',
                background: !selectedExamId ? '#fff5f5' : '#f8fafc'
              }}
              required
            >
              {filteredExamSessions.length === 0 ? (
                <option value="">{t('results.noExamConfigured')}</option>
              ) : (
                filteredExamSessions.map((exam) => {
                  const idVal = exam.examId || exam.key || exam.id;
                  return (
                    <option key={idVal} value={idVal}>
                      {exam.name}
                    </option>
                  );
                })
              )}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>{t('results.group')}</span>
            <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} style={styles.select}>
              {allowedGroupOptions.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>{t('results.subject')}</span>
            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} style={styles.select}>
              {allowedSubjectOptions.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </label>
        </div>
        {filteredExamSessions.length === 0 && (
          <div style={{ color: '#dc2626', fontSize: '13px', fontWeight: '600', marginTop: '-4px', marginBottom: '16px', background: '#fee2e2', padding: '10px 14px', borderRadius: '12px', border: '1px solid #fca5a5', lineHeight: 1.4 }}>
            ⚠️ There are no Exam Sessions configured for <strong>{selectedClass}</strong>. You must configure an Exam Session in the "Results" tab before entering marks.
          </div>
        )}

        <div style={styles.summaryGrid} className="result-entry-summary-grid">
          <div style={styles.summaryChip}>
            <span style={styles.summaryLabel}>{t('results.classSummary')}:</span>
            <span style={styles.summaryVal}>{selectedClass} ({selectedSection || 'All'})</span>
          </div>
          <div style={styles.summaryChip}>
            <span style={styles.summaryLabel}>{t('results.examSummary')}:</span>
            <span style={styles.summaryVal}>{selectedExam ? selectedExam.name : <span style={{ color: '#dc2626' }}>{t('common.noneSelected')}</span>}</span>
          </div>
          <div style={styles.summaryChip}>
            <span style={styles.summaryLabel}>{t('results.subjectSummary')}:</span>
            <span style={styles.summaryVal}>{selectedSubject}</span>
          </div>
          <div style={styles.summaryChip}>
            <span style={styles.summaryLabel}>Rules:</span>
            <span style={styles.summaryVal}>
              {hasCqMcqRule ? (
                <>CQ: {currentSubjectRule.cqTotal}{hasMcqComponent ? `, ${isPrimaryBranch ? 'Tut' : 'MCQ'}:${currentSubjectRule.mcqTotal}` : ''} (Pass: CQ {currentSubjectRule.cqPass}{hasMcqComponent ? `/MCQ ${currentSubjectRule.mcqPass}` : ''})</>
              ) : (
                <>Total: {resolvedRule.totalMarks} (Pass: {resolvedRule.passMarks})</>
              )}
            </span>
          </div>
          <div style={styles.summaryChip}>
            <span style={styles.summaryLabel}>Stats:</span>
            <span style={styles.summaryVal}>{enteredCount}/{students.length} entered (Avg: {enteredCount ? (averageMarks / enteredCount).toFixed(1) : '0.0'})</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="tp-table-container tp-table-responsive" style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>{t('results.roll')}</th>
                  <th style={styles.th}>{t('results.studentName')}</th>
                  {hasCqMcqRule ? (
                    <>
                      <th style={{ ...styles.th, textAlign: 'center' }}>CQ<br/><span style={{ fontWeight: 500, fontSize: 11 }}>(Max: {currentSubjectRule.cqTotal})</span></th>
                      {hasMcqComponent && <th style={{ ...styles.th, textAlign: 'center' }}>{isPrimaryBranch ? 'Tutorial' : 'MCQ'}<br/><span style={{ fontWeight: 500, fontSize: 11 }}>(Max: {currentSubjectRule.mcqTotal})</span></th>}
                      <th style={{ ...styles.th, textAlign: 'center' }}>Total<br/><span style={{ fontWeight: 500, fontSize: 11 }}>(Max: {resolvedRule.totalMarks})</span></th>
                    </>
                  ) : (
                    <th style={{ ...styles.th, textAlign: 'center' }}>{t('results.marks')} (Max: {resolvedRule.totalMarks})</th>
                  )}
                  <th style={{ ...styles.th, textAlign: 'center' }}>{t('results.grade')}</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={hasCqMcqRule ? (hasMcqComponent ? 5 : 4) : 4} style={{ ...styles.td, textAlign: 'center', color: '#94a3b8', padding: '24px 12px' }}>
                      {t('results.noStudentsFound')}
                    </td>
                  </tr>
                ) : students.map((student, index) => {
                  const cqVal  = student.cqMarks  ?? '';
                  const mcqVal = student.mcqMarks ?? '';
                  const totalDisplay = hasCqMcqRule
                    ? (cqVal !== '' || mcqVal !== '' ? (Number(cqVal || 0) + Number(mcqVal || 0)) : '')
                    : '';
                  const gradeDisplay = getGradeForTable(cqVal, mcqVal);
                  const cqFail  = hasCqMcqRule && cqVal !== '' && Number(cqVal) < Number(currentSubjectRule.cqPass);
                  const mcqFail = hasCqMcqRule && hasMcqComponent && mcqVal !== '' && Number(mcqVal) < Number(currentSubjectRule.mcqPass);

                  return (
                    <tr key={student.id || student.roll}>
                      <td style={styles.td}>#{String(student.roll).padStart(2, '0')}</td>
                      <td style={{ ...styles.td, fontWeight: 700 }}>{student.name}</td>
                      {hasCqMcqRule ? (
                        <>
                          {/* CQ input */}
                          <td style={{ ...styles.td, textAlign: 'center' }}>
                            <input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={cqVal}
                              onChange={(e) => handleCqChange(student.roll, e.target.value)}
                              onKeyDown={(e) => handleMarksKeyDown(e, index, 'cq')}
                              disabled={effectiveReadOnly || !selectedExamId}
                              data-cq-input={index}
                              placeholder={selectedExamId ? String(currentSubjectRule.cqTotal) : t('results.selectExamFirst')}
                              style={{
                                ...styles.markInput,
                                borderColor: cqFail ? '#fca5a5' : '#cbd5e1',
                                background:  cqFail ? '#fff5f5' : '#fff',
                              }}
                              min="0"
                              max={currentSubjectRule.cqTotal}
                            />
                          </td>
                          {/* MCQ / Tutorial input */}
                          {hasMcqComponent && (
                            <td style={{ ...styles.td, textAlign: 'center' }}>
                              <input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={mcqVal}
                                onChange={(e) => handleMcqChange(student.roll, e.target.value)}
                                onKeyDown={(e) => handleMarksKeyDown(e, index, 'mcq')}
                                disabled={effectiveReadOnly || !selectedExamId}
                                data-mcq-input={index}
                                placeholder={String(currentSubjectRule.mcqTotal)}
                                style={{
                                  ...styles.markInput,
                                  borderColor: mcqFail ? '#fca5a5' : '#cbd5e1',
                                  background:  mcqFail ? '#fff5f5' : '#fff',
                                }}
                                min="0"
                                max={currentSubjectRule.mcqTotal}
                              />
                            </td>
                          )}
                          {/* Live total */}
                          <td style={{ ...styles.td, textAlign: 'center' }}>
                            <span style={{
                              fontWeight: 800,
                              fontSize: 15,
                              color: (cqFail || mcqFail) ? '#b91c1c' : totalDisplay !== '' ? '#1a2e4a' : '#94a3b8',
                            }}>
                              {totalDisplay !== '' ? totalDisplay : '—'}
                            </span>
                            {(cqFail || mcqFail) && (
                              <div style={{ fontSize: 10, color: '#b91c1c', fontWeight: 700, marginTop: 2 }}>
                                {cqFail && mcqFail ? (isPrimaryBranch ? 'CQ+Tutorial Fail' : 'CQ+MCQ Fail') : cqFail ? 'CQ Fail' : (isPrimaryBranch ? 'Tutorial Fail' : 'MCQ Fail')}
                              </div>
                            )}
                          </td>
                        </>
                      ) : (
                        /* Legacy single marks input */
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <input
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={cqVal}
                            onChange={(e) => handleMarksChange(student.roll, e.target.value)}
                            onKeyDown={(e) => handleMarksKeyDown(e, index, 'cq')}
                            disabled={effectiveReadOnly || !selectedExamId}
                            data-cq-input={index}
                            placeholder={selectedExamId ? `Max: ${resolvedRule.totalMarks}` : t('results.selectExamFirst')}
                            style={styles.markInput}
                            min="0"
                            max={resolvedRule.totalMarks}
                          />
                        </td>
                      )}
                      <td style={{ ...styles.td, textAlign: 'center', fontWeight: 800, color: gradeDisplay === 'F' ? '#dc2626' : '#2563eb' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          background: gradeDisplay === 'F' ? '#fee2e2' : gradeDisplay === '-' ? 'transparent' : '#dbeafe',
                          fontSize: '13px',
                        }}>
                          {gradeDisplay}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {feedback ? <p style={styles.feedback}>{feedback}</p> : null}

          {!effectiveReadOnly && (
            <div style={styles.actions} className="result-entry-actions">
              <button type="button" onClick={handleReset} style={styles.secondaryBtn}>{t('common.reset')}</button>
              <button type="submit" style={styles.primaryBtn}>{t('results.saveResult')}</button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

const styles = {
  page: {
    fontFamily: "'Segoe UI', Roboto, system-ui, -apple-system, sans-serif",
    background: 'linear-gradient(135deg, #f8fbff 0%, #eef4ff 100%)',
    padding: 'clamp(10px, 3vw, 24px)',
    minHeight: '100vh',
    boxSizing: 'border-box',
    width: '100%',
  },
  card: {
    background: '#fff',
    borderRadius: '20px',
    boxShadow: '0 12px 35px rgba(15, 23, 42, 0.08)',
    padding: 'clamp(14px, 4vw, 28px)',
    maxWidth: '960px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  },
  headerRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '18px',
    width: '100%',
  },
  headerTitleBox: {
    flex: '1 1 200px',
    minWidth: 0,
  },
  headerBadgeBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '6px',
    flexShrink: 0,
  },
  meta: {
    margin: 0,
    fontSize: '12px',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    fontWeight: 800,
    wordBreak: 'normal',
    overflowWrap: 'break-word',
  },
  title: {
    margin: '4px 0 0',
    fontSize: 'clamp(20px, 4vw, 28px)',
    fontWeight: 800,
    color: '#0f172a',
    lineHeight: 1.2,
    wordBreak: 'normal',
    overflowWrap: 'break-word',
  },
  badge: {
    background: '#dcfce7',
    color: '#166534',
    padding: '5px 12px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 800,
    display: 'inline-block',
  },
  branchPillsRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    paddingBottom: '4px',
    scrollbarWidth: 'none',
  },
  branchPillBtn: {
    padding: '8px 16px',
    borderRadius: '999px',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  controls: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
    gap: '12px',
    marginBottom: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '11.5px',
    color: '#475569',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1.5px solid #cbd5e1',
    background: '#f8fafc',
    fontSize: '14px',
    fontWeight: 600,
    color: '#0f172a',
    outline: 'none',
    boxSizing: 'border-box',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
    gap: '8px',
    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '12px 14px',
    marginBottom: '18px',
  },
  summaryChip: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    fontSize: '12px',
  },
  summaryLabel: {
    fontWeight: 700,
    color: '#64748b',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  summaryVal: {
    fontWeight: 700,
    color: '#0f172a',
    wordBreak: 'break-word',
  },
  tableWrapper: {
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    marginBottom: '16px',
  },
  table: {
    width: '100%',
    minWidth: '520px',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '12px 12px',
    textAlign: 'left',
    borderBottom: '2px solid #e2e8f0',
    background: '#f8fafc',
    color: '#475569',
    fontWeight: 800,
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  td: {
    padding: '12px 12px',
    borderBottom: '1px solid #f1f5f9',
    color: '#334155',
    fontSize: '13.5px',
  },
  markInput: {
    width: '78px',
    minHeight: '40px',
    padding: '6px 8px',
    border: '1.5px solid #cbd5e1',
    borderRadius: '10px',
    textAlign: 'center',
    fontSize: '15px',
    fontWeight: '700',
    outline: 'none',
    boxSizing: 'border-box',
  },
  feedback: {
    margin: '0 0 16px',
    padding: '12px 14px',
    borderRadius: '12px',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '13.5px',
    fontWeight: '600',
    border: '1px solid #bfdbfe',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  secondaryBtn: {
    border: '1.5px solid #cbd5e1',
    background: '#fff',
    color: '#334155',
    padding: '12px 20px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px',
  },
  primaryBtn: {
    border: 'none',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '14px',
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
  },
};

export default ResultEntry;