import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSchoolProfile } from '../context/SchoolProfileContext.jsx';
import { SCHOOL_BRANCHES, filterClassesByBranch, sortClasses } from '../utils/schoolResolver.js';
import ResultEntry from './ResultEntry.jsx';
import ExamResultView from './ExamResultView.jsx';
import PrincipalFeeApprovals from './PrincipalFeeApprovals.jsx';
import { getPendingTransactions, subscribeToFeeUpdates as subscribeToFeeUpdatesUtils } from '../utils/feeResolver.js';
import { subscribeToTeacherPanelData } from '../firebase/firestoreSchema.js';
import { readStorage, writeStorage } from '../utils/schoolData.js';
import SectionErrorBoundary from './SectionErrorBoundary.jsx';
import SafeImage from './SafeImage.jsx';

/* ─────────────────────────────────────────────────────────────
   Branch display order
   ───────────────────────────────────────────────────────────── */
const BRANCH_ORDER = ['primary', 'secondary', 'college'];

const CLASS_COLORS = [
  '#4a90e2', '#38b26e', '#8b5cf6', '#f97316', '#0ea5a4',
  '#e11d48', '#d97706', '#0284c7', '#7c3aed', '#059669',
  '#2563eb', '#16a34a', '#dc2626',
];

/* ─────────────────────────────────────────────────────────────
   SVG Icons
   ───────────────────────────────────────────────────────────── */
const HamburgerIcon = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" viewBox="0 0 24 24">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const LogoutIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const ChevronRight = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const ChevronLeft = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const DirectoryIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const ResultEntryIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="5" y="2" width="14" height="20" rx="2" /><line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="13" y2="15" />
  </svg>
);
const TranscriptIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" />
  </svg>
);
const KeyIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);
const FeeIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
  </svg>
);

/* ─────────────────────────────────────────────────────────────
   BranchCard — Level 1 overview card for a branch
   ───────────────────────────────────────────────────────────── */
function BranchCard({ branch, classCount, studentCount, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: 'none',
        borderRadius: 16,
        padding: '28px 24px',
        background: hovered
          ? `linear-gradient(135deg, ${branch.gradientFrom} 0%, ${branch.gradientTo} 100%)`
          : '#fff',
        boxShadow: hovered
          ? `0 8px 32px ${branch.color}40`
          : '0 2px 12px rgba(0,0,0,0.07)',
        cursor: 'pointer',
        transition: 'all 0.22s cubic-bezier(.4,0,.2,1)',
        transform: hovered ? 'translateY(-4px) scale(1.02)' : 'none',
        textAlign: 'left',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        outline: `2px solid ${hovered ? branch.color : 'transparent'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: hovered ? 'rgba(255,255,255,0.18)' : `${branch.color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, flexShrink: 0,
        }}>
          {branch.emoji}
        </div>
        <div style={{
          background: hovered ? 'rgba(255,255,255,0.22)' : `${branch.color}12`,
          borderRadius: 8, padding: '4px 10px', fontSize: 12,
          fontWeight: 700, color: hovered ? '#fff' : branch.color, alignSelf: 'flex-start',
        }}>
          {classCount} Classes
        </div>
      </div>

      <div>
        <p style={{
          margin: '0 0 4px', fontSize: 13, fontWeight: 800, letterSpacing: '.04em',
          textTransform: 'uppercase', color: hovered ? 'rgba(255,255,255,0.7)' : '#94a3b8',
        }}>{branch.shortName}</p>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.3, color: hovered ? '#fff' : '#1a2e4a' }}>
          {branch.name}
        </h3>
      </div>

      <div style={{ display: 'flex', gap: 20, borderTop: `1px solid ${hovered ? 'rgba(255,255,255,0.2)' : '#f1f5f9'}`, paddingTop: 14 }}>
        <div>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: hovered ? '#fff' : branch.color }}>{studentCount}</p>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: hovered ? 'rgba(255,255,255,0.65)' : '#94a3b8' }}>STUDENTS</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: hovered ? '#fff' : branch.color }}>{classCount}</p>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: hovered ? 'rgba(255,255,255,0.65)' : '#94a3b8' }}>CLASSES</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: hovered ? '#fff' : branch.color, marginTop: -4 }}>
        View Classes <ChevronRight />
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   ClassCard — Level 2 card for a single class within a branch
   ───────────────────────────────────────────────────────────── */
function ClassCard({ cls, color, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: 'none', borderRadius: 14, padding: '20px 18px',
        background: hovered ? color : '#fff',
        boxShadow: hovered ? `0 6px 24px ${color}40` : '0 2px 10px rgba(0,0,0,0.06)',
        cursor: 'pointer', transition: 'all 0.2s cubic-bezier(.4,0,.2,1)',
        transform: hovered ? 'translateY(-3px)' : 'none',
        textAlign: 'left', width: '100%',
        outline: `2px solid ${hovered ? color : 'transparent'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: hovered ? 'rgba(255,255,255,0.22)' : `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>
          🏫
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: hovered ? 'rgba(255,255,255,0.7)' : '#94a3b8',
          background: hovered ? 'rgba(255,255,255,0.15)' : '#f1f5f9',
          padding: '3px 8px', borderRadius: 6,
        }}>
          {cls.students?.length || 0} students
        </span>
      </div>
      <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: hovered ? '#fff' : '#1a2e4a' }}>{cls.className}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: hovered ? 'rgba(255,255,255,0.8)' : color, marginTop: 10 }}>
        View Roster <ChevronRight />
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   StudentRosterTable — Level 3 full roster
   ───────────────────────────────────────────────────────────── */
function StudentRosterTable({ cls, color }) {
  if (!cls.students || cls.students.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', color: '#94a3b8' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
        <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>No students enrolled</p>
        <p style={{ fontSize: 13, marginTop: 6 }}>Add students via the Admin panel.</p>
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <span style={{
          background: `${color}15`, color, borderRadius: 8, padding: '5px 14px',
          fontSize: 13, fontWeight: 700, border: `1px solid ${color}30`,
        }}>
          🎓 {(cls.students || []).length} Student{(cls.students || []).length !== 1 ? 's' : ''} Enrolled
        </span>
      </div>
      <div className="tp-table-container" style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', minWidth: 540, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: `${color}12` }}>
              {['Roll', 'Student Name', 'ID', 'Age', 'Guardian', 'Status'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Status' ? 'center' : 'left', fontWeight: 700, color, borderBottom: `2px solid ${color}30`, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(cls.students || []).map((student, idx) => (
              <tr key={student.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#64748b', fontSize: 13 }}>
                  #{String(student.roll || (idx + 1)).padStart(2, '0')}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {student.profilePic ? (
                      <img src={student.profilePic} alt={student.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {(student.name || 'S').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span style={{ fontWeight: 700, color: '#1a2e4a', fontSize: 14 }}>{student.name}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>{student.id || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>{student.age || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#475569' }}>{student.fatherName || student.motherName || '—'}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>Active ✓</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Breadcrumb
   ───────────────────────────────────────────────────────────── */
function Breadcrumb({ items }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      marginBottom: 20, padding: '10px 16px', background: '#f8fafc',
      borderRadius: 10, border: '1px solid #e2e8f0',
    }}>
      {items.map((item, idx) => (
        <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {idx > 0 && <ChevronRight />}
          {item.onClick ? (
            <button onClick={item.onClick} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563eb', fontWeight: 700, fontSize: 13, padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
              {item.label}
            </button>
          ) : (
            <span style={{ fontWeight: 700, color: '#1a2e4a', fontSize: 13 }}>{item.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   Main PrincipalDashboard Component
   ═════════════════════════════════════════════════════════════ */
export default function PrincipalDashboard() {
  const { user, signOut, createUser, deleteUser } = useAuth();
  const { schoolProfile: rawSchoolProfile } = useSchoolProfile();
  const schoolProfile = rawSchoolProfile || { schoolName: 'ScholasticBase', logo: '', adminEmail: 'admin@scholasticbase.edu' };

  const [activeSection, setActiveSection] = useState('directories');
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedBranchKey, setSelectedBranchKey] = useState(null);
  const [selectedClassIdx, setSelectedClassIdx] = useState(null);

  // Real-time observers
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);

  // User Management
  const [accountForm, setAccountForm] = useState({ userId: '', name: '', password: '', role: 'student', classTeacherKey: '', classTeacherClassIdxList: [] });
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [accountStatus, setAccountStatus] = useState('');
  const [accountError, setAccountError] = useState('');
  const [registeredAccounts, setRegisteredAccounts] = useState({});
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const activeSchoolId = schoolProfile?.schoolId || schoolProfile?.schoolCode || schoolProfile?.eiinNumber || 'PROGGA_DEFAULT';

  // Dynamic Class Synchronization
  useEffect(() => {
    let active = true;

    const cachedClasses = readStorage('teacherPanelClasses', null, activeSchoolId);
    const cachedTeachers = readStorage('teacherPanelTeachers', null, activeSchoolId);
    if (cachedClasses) setClasses(cachedClasses);
    if (cachedTeachers) setTeachers(cachedTeachers);

    const unsubscribe = subscribeToTeacherPanelData((docSnap) => {
      if (!active) return;
      if (docSnap && docSnap.exists()) {
        const remoteData = docSnap.data();
        if (Array.isArray(remoteData.classes)) {
          setClasses(remoteData.classes);
          writeStorage('teacherPanelClasses', remoteData.classes, activeSchoolId);
        }
        if (Array.isArray(remoteData.teachers)) {
          setTeachers(remoteData.teachers);
          writeStorage('teacherPanelTeachers', remoteData.teachers, activeSchoolId);
        }
      }
    }, (err) => {
      console.warn('PrincipalDashboard Firestore listener failed:', err);
      try {
        const raw = readStorage('teacherPanelClasses', null, activeSchoolId);
        const rawTeachers = readStorage('teacherPanelTeachers', null, activeSchoolId);
        if (raw) setClasses(raw);
        if (rawTeachers) setTeachers(rawTeachers);
      } catch { }
    }, activeSchoolId);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [activeSchoolId]);

  const loadAccounts = () => {
    try {
      const superAdminSeed = {
        '@@Siam##': { userId: '@@Siam##', name: 'Super Admin', password: '@SupaX', role: 'admin', isSuperAdmin: true },
        // NOTE: No default 'admin' account — passwords are set exclusively by SuperAdmin.
      };
      const raw = readStorage('schoolAppLocalUsers', null);
      if (!raw) {
        setRegisteredAccounts(superAdminSeed);
        return;
      }
      delete raw['super'];
      delete raw['siam'];
      const result = { ...raw };
      result['@@Siam##'] = superAdminSeed['@@Siam##'];
      // Ensure no regular user holds the superAdmin flag
      Object.keys(result).forEach((k) => {
        if (k !== '@@Siam##' && result[k]?.isSuperAdmin) {
          result[k] = { ...result[k], isSuperAdmin: false };
        }
      });
      setRegisteredAccounts(result);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // Profile lookup options
  const safeTeachers = Array.isArray(teachers) ? teachers : [];
  const safeClasses = Array.isArray(classes) ? classes : [];

  const teacherProfiles = Array.from(
    safeTeachers.reduce((map, teacher, idx) => {
      if (!teacher) return map;

      const isObj = typeof teacher === 'object' && teacher !== null;
      const rawName = isObj ? (teacher.name ?? '') : String(teacher);
      const safeName = String(rawName || '').trim();
      const safeEmail = isObj ? String(teacher.email || '').trim() : '';

      const normalizedKey = `${safeName.toLowerCase()}|${safeEmail.toLowerCase()}`;
      if (map.has(normalizedKey)) return map;

      const nameSlug = safeName
        ? safeName.replace(/\s+/g, '_').toLowerCase()
        : `teacher_${idx + 1}`;
      const fallbackUserId = `${nameSlug}-${idx}`;

      const displayName = safeName || `Teacher ${idx + 1}`;
      const displayLabel = safeEmail ? `${displayName} (${safeEmail})` : displayName;

      map.set(normalizedKey, {
        key: `${safeEmail || safeName || `teacher-${idx}`}-${idx}`,
        name: displayName,
        label: displayLabel,
        userId: safeEmail || fallbackUserId,
        role: 'teacher',
      });
      return map;
    }, new Map()).values()
  );

  const studentProfiles = safeClasses.flatMap((cls, classIdx) => {
    const safeStudents = Array.isArray(cls?.students) ? cls.students : [];
    const className = String(cls?.className || `Class ${classIdx + 1}`).trim();

    return safeStudents.map((s, studentIdx) => {
      if (!s) {
        return {
          key: `stu-${className}-${studentIdx}`,
          name: `Student ${studentIdx + 1}`,
          label: `Student ${studentIdx + 1} — ${className}`,
          userId: `student_${studentIdx + 1}`,
          role: 'student',
        };
      }

      const isObj = typeof s === 'object' && s !== null;
      const rawName = isObj ? (s.name ?? '') : String(s);
      const safeStudentName = String(rawName || '').trim() || `Student ${studentIdx + 1}`;
      const safeStudentId = isObj ? String(s.id || s.roll || '').trim() : '';

      const nameSlug = safeStudentName.replace(/\s+/g, '_').toLowerCase();
      const studentUserId = safeStudentId || nameSlug;

      return {
        key: `${safeStudentId || safeStudentName || 'stu'}-${className}-${studentIdx}`,
        name: safeStudentName,
        label: `${safeStudentName} — ${className}`,
        userId: studentUserId,
        role: 'student',
      };
    });
  });

  const profileOptions = accountForm.role === 'teacher' ? teacherProfiles : accountForm.role === 'student' ? studentProfiles : [];

  const handleProfileSelect = (profileId) => {
    setSelectedProfileId(profileId);
    const profile = profileOptions.find((p) => p.key === profileId);
    if (profile) {
      setAccountForm((prev) => ({
        ...prev,
        name: profile.name,
        userId: profile.userId,
      }));
    }
  };

  const handleCreateAccountSubmit = async (e) => {
    e.preventDefault();
    setAccountStatus('');
    setAccountError('');
    if (!accountForm.userId.trim() || !accountForm.name.trim() || !accountForm.password.trim()) {
      setAccountError('Please fill in all fields.');
      return;
    }
    if (accountForm.role === 'teacher' && accountForm.classTeacherKey.trim() && accountForm.classTeacherClassIdxList.length === 0) {
      setAccountError('Please select at least one assigned class for this class teacher key.');
      return;
    }
    try {
      const assignedClassNames = accountForm.classTeacherClassIdxList.map(idx => classes[Number(idx)]?.className || '').filter(Boolean);
      await createUser({
        userId: accountForm.userId.trim(),
        name: accountForm.name.trim(),
        password: accountForm.password.trim(),
        role: accountForm.role,
        classTeacherKey: accountForm.classTeacherKey,
        classTeacherClassIdxList: accountForm.classTeacherClassIdxList,
        classTeacherClassNames: assignedClassNames,
        classTeacherClassIdx: accountForm.classTeacherClassIdxList[0] ?? '',
        classTeacherClassName: assignedClassNames[0] || '',
      });
      setAccountStatus(`Successfully registered ${accountForm.role} account "${accountForm.userId}".`);
      setAccountForm({ userId: '', name: '', password: '', role: 'student', classTeacherKey: '', classTeacherClassIdxList: [] });
      setSelectedProfileId('');
      loadAccounts();
    } catch (err) {
      setAccountError(err.message || 'Error creating user.');
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const executeDelete = async () => {
    const idsToDelete = Array.from(selectedIds).filter(id => {
      const trimmed = String(id).trim().toLowerCase();
      if (trimmed === '@@siam##') return false;
      if (user?.userId && String(user.userId).trim().toLowerCase() === trimmed) return false;
      const acc = registeredAccounts[id];
      if (acc && acc.isSuperAdmin) return false;
      return true;
    });
    if (idsToDelete.length === 0) {
      setAccountStatus('Super Admin and active session accounts cannot be deleted.');
      setAccountError('');
      setSelectedIds(new Set());
      setDeleteMode(false);
      return;
    }

    for (const id of idsToDelete) {
      try {
        await deleteUser(id);
      } catch (err) {
        console.warn('Unable to remove login account', err);
      }
    }
    loadAccounts();
    setAccountStatus(`Removed ${idsToDelete.length} login account${idsToDelete.length > 1 ? 's' : ''}.`);
    setAccountError('');
    setSelectedIds(new Set());
    setDeleteMode(false);
  };

  const branchMetrics = BRANCH_ORDER.reduce((acc, key) => {
    const branchClasses = filterClassesByBranch(classes, key);
    const studentCount = branchClasses.reduce((sum, cls) => sum + (cls.students?.length || 0), 0);
    acc[key] = { classCount: branchClasses.length, studentCount, classes: branchClasses };
    return acc;
  }, {});

  const handleSectionChange = (section) => {
    setActiveSection(section);
    setSelectedBranchKey(null);
    setSelectedClassIdx(null);
    setMenuOpen(false);
  };

  const branchClasses = selectedBranchKey ? branchMetrics[selectedBranchKey]?.classes || [] : [];
  const selectedClass = selectedClassIdx !== null ? branchClasses[selectedClassIdx] : null;
  const totalStudents = classes.reduce((sum, cls) => sum + (cls.students?.length || 0), 0);

  const breadcrumbItems = (() => {
    const items = [{ label: 'All Branches', onClick: () => { setSelectedBranchKey(null); setSelectedClassIdx(null); } }];
    if (selectedBranchKey) {
      const branch = SCHOOL_BRANCHES[selectedBranchKey];
      items.push({ label: branch.shortName, onClick: selectedClassIdx !== null ? () => setSelectedClassIdx(null) : null });
    }
    if (selectedClass) items.push({ label: selectedClass.className, onClick: null });
    return items;
  })();

  const [pendingTxCount, setPendingTxCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      setPendingTxCount(getPendingTransactions().length);
    };
    updateCount();
    const unsub = subscribeToFeeUpdatesUtils(updateCount);
    return () => unsub();
  }, []);

  const navItems = [
    { id: 'directories', label: 'Student Directories', Icon: DirectoryIcon },
    { id: 'result_entry', label: 'Branch Result Entry', Icon: ResultEntryIcon },
    { id: 'transcripts', label: 'View Branch Transcripts', Icon: TranscriptIcon },
    { id: 'fee_approvals', label: `Transaction ID Approvals ${pendingTxCount > 0 ? `(${pendingTxCount})` : ''}`, Icon: FeeIcon },
    { id: 'user_management', label: 'User Account Management', Icon: KeyIcon },
  ];

  return (
    <div className="tp-shell">
      {/* Mobile drawer overlay */}
      <div className={`tp-drawer-overlay ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)}>
        <div className="tp-drawer" onClick={e => e.stopPropagation()}>
          <div className="tp-drawer-brand">
            <SafeImage
              src={schoolProfile.logo}
              alt={`${schoolProfile.schoolName} logo`}
              className="tp-drawer-logo"
              style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }}
              fallbackVariant="school"
              fallbackText={schoolProfile.schoolName || 'ScholasticBase'}
            />
            <div style={{ flex: '1 1 0%', minWidth: 0 }}>
              <p className="tp-drawer-title">Menu</p>
              <p className="tp-drawer-school">{schoolProfile.schoolName || 'ScholasticBase'}</p>
              {(schoolProfile?.location || window.localStorage.getItem('schoolLocation')) && (
                <p className="tp-drawer-location" style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                  📍 {schoolProfile?.location || window.localStorage.getItem('schoolLocation')}
                </p>
              )}
            </div>
          </div>
          <div className="tp-drawer-nav">
            {navItems.map(item => (
              <button key={item.id} className={`tp-sidebar-nav-item${activeSection === item.id ? ' active' : ''}`} onClick={() => handleSectionChange(item.id)}>
                <item.Icon /> {item.label}
              </button>
            ))}
          </div>
          <div className="tp-drawer-bottom" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p className="tp-drawer-label" style={{ margin: 0 }}>Signed in as</p>
            <p className="tp-drawer-name" style={{ margin: 0 }}>{user?.name || 'Principal'}</p>
            <p className="tp-drawer-role" style={{ margin: 0 }}>Role: Principal (HOI)</p>
            <button className="tp-drawer-signout" onClick={signOut} style={{ margin: '8px 0 0' }}>Sign Out</button>
            <div className="tp-sidebar-footer" style={{ fontSize: 10.5, color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: 10, lineHeight: 1.4 }}>
              <div style={{ fontWeight: 600 }}>© 2026 {schoolProfile.schoolName || 'Progga'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="tp-sidebar">
        <div className="tp-sidebar-brand">
          <SafeImage
            src={schoolProfile.logo}
            alt={`${schoolProfile.schoolName} logo`}
            className="tp-sidebar-crest"
            style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }}
            fallbackVariant="school"
            fallbackText={schoolProfile.schoolName || 'ScholasticBase'}
          />
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>
            <span className="tp-sidebar-school">{schoolProfile.schoolName || 'ScholasticBase'}</span>
            {(schoolProfile?.location || window.localStorage.getItem('schoolLocation')) && (
              <span className="tp-sidebar-location" style={{ display: 'block', fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
                📍 {schoolProfile?.location || window.localStorage.getItem('schoolLocation')}
              </span>
            )}
          </div>
        </div>

        {/* Principal badge */}
        <div style={{
          margin: '4px 4px 12px', padding: '8px 12px',
          background: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 100%)',
          borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>🏛️</span>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Principal</p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#fff' }}>Full Access</p>
          </div>
        </div>

        <nav className="tp-sidebar-nav">
          {navItems.map(item => (
            <button key={item.id} className={`tp-sidebar-nav-item${activeSection === item.id ? ' active' : ''}`} onClick={() => handleSectionChange(item.id)} title={item.label}>
              <item.Icon /> <span className="tp-sidebar-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="tp-sidebar-bottom" style={{ marginTop: 'auto' }}>
          <div className="tp-sidebar-divider" />

          <div className="tp-sidebar-user-info" style={{ padding: '0 4px', marginBottom: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1a2e4a', margin: '0 0 2px' }}>{user?.name || 'Principal'}</p>
            <p style={{ fontSize: 11.5, color: '#7c3aed', margin: 0, fontWeight: 700 }}>Principal (HOI)</p>
          </div>
          <button className="tp-sidebar-signout" onClick={signOut}>
            <LogoutIcon /> <span className="tp-sidebar-label">Sign Out</span>
          </button>

          <div className="tp-sidebar-footer" style={{ padding: '12px 4px 0', fontSize: 10.5, color: '#94a3b8', borderTop: '1px solid #e2e8f0', marginTop: 12, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 600 }}>© 2026 {schoolProfile.schoolName || 'Progga'}</div>
            <div>Admin: <a href={`mailto:${schoolProfile.adminEmail}`} style={{ color: '#7c3aed', fontWeight: 600, textDecoration: 'none' }}>{schoolProfile.adminEmail}</a></div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="tp-main">
        {/* Topbar */}
        <div className="tp-topbar">
          <button className="tp-icon-btn tp-hamburger" onClick={() => setMenuOpen(true)} aria-label="Menu"><HamburgerIcon /></button>
          <div className="tp-topbar-greeting">
            <h2>Principal Control Panel 🏛️</h2>
            <p>Head of Institution · Full Institutional Access</p>
          </div>
          <button
            className="tp-icon-btn"
            onClick={signOut}
            aria-label="Logout"
            style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', background: '#f5f3ff', padding: '6px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#7c3aed' }}
          >
            <LogoutIcon /> <span>Logout</span>
          </button>
        </div>

        {/* ══ Student Directories ══ */}
        {activeSection === 'directories' && (
          <div style={{ padding: '24px 20px' }}>

            {/* Level 1: Branch overview cards */}
            {!selectedBranchKey && (
              <>
                <div className="tp-hero" style={{ marginBottom: 24 }}>
                  <div className="tp-greeting">
                    <h1>Student Directories</h1>
                    <p>Browse all students across the three institutional branches.</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <p style={{ fontSize: 28, fontWeight: 800, color: '#7c3aed', margin: 0 }}>{totalStudents}</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '.05em' }}>Total Students</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 20 }}>
                  {BRANCH_ORDER.map(key => {
                    const branch = SCHOOL_BRANCHES[key];
                    const metrics = branchMetrics[key];
                    return (
                      <BranchCard
                        key={key}
                        branch={branch}
                        classCount={metrics.classCount}
                        studentCount={metrics.studentCount}
                        onClick={() => { setSelectedBranchKey(key); setSelectedClassIdx(null); }}
                      />
                    );
                  })}
                </div>
              </>
            )}

            {/* Level 2: Classes within a branch */}
            {selectedBranchKey && selectedClassIdx === null && (
              <>
                <Breadcrumb items={breadcrumbItems} />
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22,
                  padding: '18px 20px', borderRadius: 14,
                  background: `linear-gradient(135deg, ${SCHOOL_BRANCHES[selectedBranchKey].gradientFrom} 0%, ${SCHOOL_BRANCHES[selectedBranchKey].gradientTo} 100%)`,
                  boxShadow: `0 4px 20px ${SCHOOL_BRANCHES[selectedBranchKey].color}40`,
                }}>
                  <span style={{ fontSize: 32 }}>{SCHOOL_BRANCHES[selectedBranchKey].emoji}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      {SCHOOL_BRANCHES[selectedBranchKey].shortName}
                    </p>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>{SCHOOL_BRANCHES[selectedBranchKey].name}</h2>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                      {branchMetrics[selectedBranchKey].classCount} Classes · {branchMetrics[selectedBranchKey].studentCount} Students
                    </p>
                  </div>
                </div>

                {branchClasses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 24px', color: '#94a3b8' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🏫</div>
                    <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>No classes in this branch yet</p>
                    <p style={{ fontSize: 13, marginTop: 6 }}>Classes are managed in the Admin panel.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 16 }}>
                    {branchClasses.map((cls, idx) => (
                      <ClassCard
                        key={cls.className}
                        cls={cls}
                        color={CLASS_COLORS[idx % CLASS_COLORS.length]}
                        onClick={() => setSelectedClassIdx(idx)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Level 3: Student roster */}
            {selectedBranchKey && selectedClassIdx !== null && selectedClass && (
              <>
                <Breadcrumb items={breadcrumbItems} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 50, height: 50, borderRadius: 14, background: SCHOOL_BRANCHES[selectedBranchKey].color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏫</div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1a2e4a' }}>{selectedClass.className}</h2>
                      <p style={{ margin: 0, fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                        {SCHOOL_BRANCHES[selectedBranchKey].shortName} · {selectedClass.students?.length || 0} Students Enrolled
                      </p>
                    </div>
                  </div>
                  <button
                    className="tp-back-btn"
                    onClick={() => setSelectedClassIdx(null)}
                    title="Back to Classes"
                    aria-label="Back to Classes"
                  >
                    <ChevronLeft />
                  </button>
                </div>
                <StudentRosterTable cls={selectedClass} color={SCHOOL_BRANCHES[selectedBranchKey].color} />
              </>
            )}
          </div>
        )}

        {/* ══ Branch Result Entry ══ */}
        {activeSection === 'result_entry' && (
          <div style={{ padding: '24px 20px' }}>
            <div className="tp-hero" style={{ marginBottom: 24 }}>
              <div className="tp-greeting">
                <h1>Branch Result Entry</h1>
                <p>Enter and manage academic results across all branches. Full read/write access enabled.</p>
              </div>
            </div>
            <ResultEntry
              classes={classes}
              currentTeacherProfile={null}
              currentTeacherAssignments={[]}
              readOnly={false}
            />
          </div>
        )}

        {/* ══ View Branch Transcripts ══ */}
        {activeSection === 'transcripts' && (
          <div style={{ padding: '24px 20px' }}>
            <div className="tp-hero" style={{ marginBottom: 24 }}>
              <div className="tp-greeting">
                <h1>View Branch Transcripts</h1>
                <p>Browse and manage exam result archives across all three institutional branches.</p>
              </div>
            </div>
            <ExamResultView
              classes={classes}
              defaultToEntry={false}
              readOnly={false}
            />
          </div>
        )}

        {/* ══ Transaction ID Approvals ══ */}
        {activeSection === 'fee_approvals' && (
          <div style={{ padding: '24px 20px' }}>
            <SectionErrorBoundary sectionName="Principal Fee Approvals">
              <PrincipalFeeApprovals currentUser={user} />
            </SectionErrorBoundary>
          </div>
        )}

        {/* ══ User Account Management ══ */}
        {activeSection === 'user_management' && (
          <div style={{ padding: '24px 20px' }}>
            <div className="tp-hero" style={{ marginBottom: 24 }}>
              <div className="tp-greeting">
                <h1>User Account Management</h1>
                <p>Manage and provision credentials for Students, Teachers, and staff accounts. Provisioned logins sync to Firestore.</p>
              </div>
            </div>

            {/* Create Account Form */}
            <div className="tp-student-roster-card" style={{ display: 'block', padding: '20px 24px', marginBottom: 28 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#1a2e4a' }}>Create Credentials</h3>
              <form onSubmit={handleCreateAccountSubmit}>
                <div className="tp-form-grid">
                  <div className="tp-form-group">
                    <label className="tp-form-label">Account Role</label>
                    <select
                      className="tp-form-input"
                      value={accountForm.role}
                      onChange={e => {
                        const role = e.target.value;
                        setAccountForm((prev) => ({ ...prev, role, userId: '', name: '', classTeacherKey: '', classTeacherClassIdxList: [] }));
                        setSelectedProfileId('');
                      }}
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">System Admin</option>
                      <option value="principal">Principal (Full Access)</option>
                    </select>
                  </div>
                  {(accountForm.role === 'teacher' || accountForm.role === 'student') && (
                    <div className="tp-form-group tp-form-full">
                      <label className="tp-form-label">Pick existing {accountForm.role}</label>
                      <select
                        className="tp-form-input"
                        value={selectedProfileId}
                        onChange={e => handleProfileSelect(e.target.value)}
                      >
                        <option value="">Select profile to auto-fill</option>
                        {profileOptions.map((profile) => (
                          <option key={profile.key} value={profile.key}>
                            {profile.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="tp-form-group">
                    <label className="tp-form-label">Full Name</label>
                    <input
                      className="tp-form-input"
                      type="text"
                      placeholder="e.g. Samuel Green"
                      value={accountForm.name}
                      onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="tp-form-group">
                    <label className="tp-form-label">Username / User ID</label>
                    <input
                      className="tp-form-input"
                      type="text"
                      placeholder={accountForm.role === 'teacher' ? 'Use teacher email or alias' : 'Use student ID or alias'}
                      value={accountForm.userId}
                      onChange={e => setAccountForm({ ...accountForm, userId: e.target.value })}
                      required
                    />
                    {selectedProfileId && (
                      <p style={{ margin: '8px 0 0', fontSize: 12, color: '#475569' }}>
                        Profile selected from directory. You can still edit the username to create a custom login.
                      </p>
                    )}
                  </div>
                  <div className="tp-form-group">
                    <label className="tp-form-label">Password</label>
                    <input className="tp-form-input" type="password" placeholder="Enter secure password" value={accountForm.password} onChange={e => setAccountForm({ ...accountForm, password: e.target.value })} required />
                  </div>
                  {accountForm.role === 'teacher' && (
                    <>
                      <div className="tp-form-group">
                        <label className="tp-form-label">Class Teacher Login Key</label>
                        <input
                          className="tp-form-input"
                          type="text"
                          placeholder="Optional key for class teacher login"
                          value={accountForm.classTeacherKey}
                          onChange={e => setAccountForm({ ...accountForm, classTeacherKey: e.target.value })}
                        />
                      </div>
                      <div className="tp-form-group tp-form-full">
                        <label className="tp-form-label">Assigned Class(es)</label>
                        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b' }}>Click to select one or multiple classes. Selected classes are highlighted.</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {sortClasses(classes).map((cls, idx) => {
                            const isSelected = accountForm.classTeacherClassIdxList.includes(idx);
                            const classColor = CLASS_COLORS[idx % CLASS_COLORS.length] || '#2563eb';
                            return (
                              <button
                                key={cls.className}
                                type="button"
                                onClick={() => {
                                  setAccountForm(prev => {
                                    const list = prev.classTeacherClassIdxList;
                                    const next = isSelected
                                      ? list.filter(i => i !== idx)
                                      : [...list, idx];
                                    return { ...prev, classTeacherClassIdxList: next };
                                  });
                                }}
                                style={{
                                  padding: '7px 14px',
                                  borderRadius: 999,
                                  border: `2px solid ${isSelected ? classColor : '#e2e8f0'}`,
                                  background: isSelected ? classColor : '#f8fafc',
                                  color: isSelected ? '#fff' : '#475569',
                                  fontWeight: 700,
                                  fontSize: 13,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                {isSelected && <span style={{ fontSize: 11 }}>✓</span>}
                                {cls.className}
                              </button>
                            );
                          })}
                        </div>
                        {accountForm.classTeacherClassIdxList.length > 0 && (
                          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>
                              ✓ {accountForm.classTeacherClassIdxList.length} class{accountForm.classTeacherClassIdxList.length > 1 ? 'es' : ''} selected:
                            </span>
                            <span style={{ fontSize: 12, color: '#475569' }}>
                              {accountForm.classTeacherClassIdxList.map(i => classes[i]?.className).filter(Boolean).join(', ')}
                            </span>
                            <button
                              type="button"
                              onClick={() => setAccountForm(prev => ({ ...prev, classTeacherClassIdxList: [] }))}
                              style={{ border: 0, background: 'transparent', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: 0 }}
                            >
                              Clear All
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button className="tp-add-student-btn" type="submit" style={{ background: '#7c3aed', padding: '10px 24px' }}>
                    Create Account
                  </button>
                  {accountStatus && <span style={{ color: '#0ea5e9', fontSize: 13, fontWeight: 600 }}>{accountStatus}</span>}
                  {accountError && <span style={{ color: '#ef4444', fontSize: 13, fontWeight: 600 }}>{accountError}</span>}
                </div>
              </form>
            </div>

            {/* List of Registered Accounts */}
            <h3 style={{ margin: '20px 0 12px', fontSize: 16, fontWeight: 700, color: '#1a2e4a' }}>Registered Logins</h3>
            <div className="tp-student-roster-grid" style={{ padding: 0 }}>
              {(() => {
                const viewerUid = String(user?.userId || '').trim().toLowerCase();
                const isViewerSuperAdmin = !!(user?.isSuperAdmin || viewerUid === '@@siam##');

                return Object.values(registeredAccounts)
                  .filter(acc => {
                    if (!acc || !acc.userId) return false;
                    const uLower = String(acc.userId || '').trim().toLowerCase();
                    const isTargetSuperAdmin = !!(acc.isSuperAdmin || uLower === '@@siam##');
                    if (isTargetSuperAdmin && !isViewerSuperAdmin) {
                      return false; // Hide Super Admin accounts completely from non-superadmin
                    }
                    return true;
                  })
                  .map(acc => {
                    const uLower = String(acc.userId || '').trim().toLowerCase();
                    const isTargetSuperAdmin = !!(acc.isSuperAdmin || uLower === '@@siam##');
                    const isSelf = !!(user?.userId && String(user.userId).trim().toLowerCase() === uLower);
                    const isProtectedAcc = isTargetSuperAdmin || isSelf;

                    const badgeColor = isTargetSuperAdmin
                      ? '#8b5cf6'
                      : acc.role === 'admin'
                      ? '#f59e0b'
                      : acc.role === 'teacher'
                      ? '#38b26e'
                      : '#7c3aed';
                    const badgeLabel = isTargetSuperAdmin ? 'superadmin' : acc.role || 'user';

                    return (
                      <div
                        key={acc.userId}
                        className={`tp-student-roster-card ${deleteMode && selectedIds.has(acc.userId) ? 'tp-card-selected' : ''}`}
                        onClick={deleteMode && !isProtectedAcc ? () => toggleSelect(acc.userId) : undefined}
                        style={{
                          cursor: deleteMode && !isProtectedAcc ? 'pointer' : 'default',
                          display: 'flex',
                          justify: 'space-between',
                          alignItems: 'center',
                          opacity: deleteMode && isProtectedAcc ? 0.7 : 1,
                          borderLeft: isTargetSuperAdmin ? '4px solid #8b5cf6' : undefined
                        }}
                      >
                        {deleteMode && !isProtectedAcc && (
                          <div className={`tp-roster-checkbox ${selectedIds.has(acc.userId) ? 'tp-cb-checked' : ''}`}>
                            {selectedIds.has(acc.userId) ? '✓' : ''}
                          </div>
                        )}
                        <div className="tp-roster-info">
                          <p className="tp-roster-name">{acc.name}</p>
                          <p className="tp-roster-id">Username: {acc.userId}</p>
                          <p className="tp-roster-roll" style={{ fontFamily: 'Courier New', fontWeight: 700, color: '#047857' }}>
                            Password: {acc.password || 'admin'}
                          </p>
                          {acc.classTeacherKey && <p className="tp-roster-meta">Class Teacher: {acc.classTeacherClassName || `Class #${Number(acc.classTeacherClassIdx) + 1}`} · Key: {acc.classTeacherKey}</p>}
                        </div>
                        <span className="tp-badge" style={{ background: badgeColor, textTransform: 'uppercase' }}>
                          {badgeLabel}
                        </span>
                      </div>
                    );
                  });
              })()}
            </div>

            <div className="tp-delete-section">
              {!deleteMode ? (
                <button className="tp-delete-toggle-btn" onClick={() => setDeleteMode(true)} disabled={Object.values(registeredAccounts).filter(acc => {
                  if (!acc || !acc.userId) return false;
                  const uLower = String(acc.userId).trim().toLowerCase();
                  if (acc.isSuperAdmin || uLower === '@@siam##') return false;
                  if (user?.userId && String(user.userId).trim().toLowerCase() === uLower) return false;
                  return true;
                }).length === 0}>🗑️ Select to Remove Login</button>
              ) : (
                <div className="tp-delete-bar">
                  <span className="tp-delete-count">{selectedIds.size} selected</span>
                  <div className="tp-delete-bar-right">
                    <button className="tp-delete-cancel-btn" onClick={() => { setDeleteMode(false); setSelectedIds(new Set()); }}>Cancel</button>
                    <button className="tp-delete-exec-btn" disabled={selectedIds.size === 0} onClick={executeDelete}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
