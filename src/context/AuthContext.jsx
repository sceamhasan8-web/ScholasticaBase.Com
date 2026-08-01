import { createContext, useContext, useState } from 'react';
import { deleteUserAccount, getUserAccount, saveUserAccount, fetchSchoolProfileByEiin } from '../firebase/firestoreSchema.js';
import { findRegisteredSchoolByEiin, registerSchoolInRegistry, getAllStudents } from '../utils/schoolData.js';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase/firebase.js';

const AuthContext = createContext(null);
const LOCAL_USERS_KEY = 'schoolAppLocalUsers';
const CURRENT_USER_KEY = 'schoolAppCurrentUser';

const defaultLocalUsers = {
  '@@Siam##': { userId: '@@Siam##', name: 'Super Admin', password: '@SupaX', role: 'admin', isSuperAdmin: true },
  'admin': { userId: 'admin', name: 'Admin Administrator', password: 'admin', role: 'admin', isSuperAdmin: false },
};

const loadLocalUsers = () => {
  try {
    const raw = window.localStorage.getItem(LOCAL_USERS_KEY);
    if (!raw) {
      window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(defaultLocalUsers));
      return { ...defaultLocalUsers };
    }
    const parsed = JSON.parse(raw);
    delete parsed['super'];
    delete parsed['siam'];
    const result = { ...parsed };
    result['@@Siam##'] = defaultLocalUsers['@@Siam##'];
    if (result['admin']) result['admin'].isSuperAdmin = false;
    return result;
  } catch {
    return {
      ...defaultLocalUsers,
      '@@Siam##': defaultLocalUsers['@@Siam##'],
      admin: { ...defaultLocalUsers.admin, isSuperAdmin: false }
    };
  }
};

const saveLocalUsers = (users) => {
  try {
    window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore
  }
};
const persistLocalUsers = saveLocalUsers;

const loadCurrentUser = () => {
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.userId) {
      if (String(parsed.userId).toLowerCase() === 'admin') {
        parsed.isSuperAdmin = false;
        parsed.role = 'admin';
      }
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

const saveCurrentUser = (user) => {
  try {
    if (user) {
      window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(CURRENT_USER_KEY);
    }
  } catch {
    // ignore
  }
};

const getLocalUser = (userId) => {
  const users = loadLocalUsers();
  const normalized = String(userId || '').trim().toLowerCase();
  if (normalized === '@@siam##') return defaultLocalUsers['@@Siam##'];
  const matchedKey = Object.keys(users).find((k) => k.toLowerCase() === normalized);
  return matchedKey ? users[matchedKey] : null;
};

const isFirestoreUnavailableError = (err) => {
  const message = String(err?.message || '').toLowerCase();
  const code = String(err?.code || '').toLowerCase();
  return (
    message.includes('client is offline') ||
    message.includes('failed to get document') ||
    message.includes('offline') ||
    code.includes('unavailable') ||
    code.includes('failed-precondition') ||
    code.includes('permission-denied') ||
    message.includes('permission') ||
    message.includes('insufficient')
  );
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadCurrentUser());
  const [loading] = useState(false);  // localStorage is sync — no delay needed
  const [localUsers, setLocalUsers] = useState(loadLocalUsers());
  const navigate = useNavigate();

  const persistLocalUsers = (nextUsers) => {
    setLocalUsers(nextUsers);
    saveLocalUsers(nextUsers);
  };

  const signIn = async ({ userId, password, eiinNumber = '', role = 'teacher', accessMode = '', loginKey = '' }) => {
    const trimmedUserId = String(userId || '').trim();
    const trimmedPassword = String(password || '').trim();
    const trimmedEiin = String(eiinNumber || '').trim();
    const normalizedRole = String(role || '').trim();
    const normalizedAccessMode = String(accessMode || '').trim();
    const normalizedLoginKey = String(loginKey || '').trim();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    let account = getLocalUser(trimmedUserId);

    if (isOnline) {
      try {
        const remoteAccount = await getUserAccount(trimmedUserId);
        if (remoteAccount) {
          account = { ...account, ...remoteAccount };
          const latestUsers = loadLocalUsers();
          persistLocalUsers({ ...latestUsers, [trimmedUserId]: account });
        }
      } catch (err) {
        if (!account && !isFirestoreUnavailableError(err)) {
          throw err;
        }
      }
    }

    const lowerId = trimmedUserId.toLowerCase();
    if (lowerId === '@@siam##') {
      account = {
        ...defaultLocalUsers['@@Siam##'],
        ...account,
        isSuperAdmin: true,
        role: 'admin',
      };
    }

    const isSuperAdmin = !!(account && account.isSuperAdmin);

    if (!account) {
      // Dynamic Student Account Lookup from student records
      const studentProfiles = getAllStudents();
      
      const matchedStudent = studentProfiles.find(
        (s) => String(s.id || s.userId || '').trim().toLowerCase() === trimmedUserId.toLowerCase()
      );

      if (matchedStudent) {
        // Verify if entered password matches matchedStudent.roll or matchedStudent.password
        const studentRollStr = String(matchedStudent.roll || '').trim();
        const studentPassStr = String(matchedStudent.password || '').trim();
        if (trimmedPassword !== studentRollStr && (studentPassStr ? trimmedPassword !== studentPassStr : true)) {
          throw new Error('Incorrect password. Please enter your Roll Number or Account Password.');
        }

        const studentSession = {
          userId: matchedStudent.id || matchedStudent.userId || trimmedUserId,
          id: matchedStudent.id || matchedStudent.userId || trimmedUserId,
          name: matchedStudent.name || 'Student',
          role: 'student',
          accessMode: 'full',
          classNum: matchedStudent.classNum || '',
          className: matchedStudent.className || '',
          roll: matchedStudent.roll || '',
          profilePic: matchedStudent.profilePic || null,
          age: matchedStudent.age || '',
          birthday: matchedStudent.birthday || '',
          fatherName: matchedStudent.fatherName || '',
          motherName: matchedStudent.motherName || '',
          phone: matchedStudent.phone || '',
          address: matchedStudent.address || '',
        };

        setUser(studentSession);
        saveCurrentUser(studentSession);

        return studentSession;
      }

      throw new Error('Incorrect username or password. Student ID not found.');
    }

    if (String(account.password || '') !== trimmedPassword) {
      throw new Error('Incorrect username or password.');
    }

    if (!account.isSuperAdmin && normalizedRole && normalizedRole !== String(account.role || '').trim()) {
      throw new Error('Selected login role does not match the account role.');
    }

    if (normalizedAccessMode === 'classTeacher') {
      if (!account.classTeacherKey || String(account.classTeacherKey).trim() !== normalizedLoginKey) {
        throw new Error('Incorrect class teacher login key.');
      }
      // Support both new array form and legacy single-value
      const hasMulti = Array.isArray(account.classTeacherClassIdxList) && account.classTeacherClassIdxList.length > 0;
      const hasSingle = account.classTeacherClassIdx !== undefined && account.classTeacherClassIdx !== null && account.classTeacherClassIdx !== '';
      if (!hasMulti && !hasSingle) {
        throw new Error('No class is assigned to this class teacher account.');
      }
    }

    // FIX #5: Stamp the active school context onto every session so that
    // SchoolProfileContext can resolve the correct Firestore school profile.
    // Previously, super-admin and non-scoped sessions had no school fields,
    // causing the profile sync to always fall back to the global default.
    const activeSessionSchoolId = window.localStorage.getItem('schoolId') || 'PROGGA_DEFAULT';
    const activeSessionSchoolCode = window.localStorage.getItem('schoolCode') || 'PROGGA';
    const activeSessionEiin = window.localStorage.getItem('schoolEiinNumber') || '';

    const nextUser = {
      userId: account.userId || trimmedUserId,
      name: account.name,
      role: account.role,
      // Super Admin flag — propagated from the account record
      isSuperAdmin: !!account.isSuperAdmin,
      accessMode: normalizedRole === 'teacher' ? (normalizedAccessMode || 'readOnly') : 'full',
      // School context — needed by SchoolProfileContext to load the right school profile
      schoolId: activeSessionSchoolId,
      schoolCode: activeSessionSchoolCode,
      eiinNumber: activeSessionEiin,
      // Multi-class support: prefer new array field, fall back to legacy single-value
      classTeacherClassIdxList: normalizedAccessMode === 'classTeacher'
        ? (Array.isArray(account.classTeacherClassIdxList) && account.classTeacherClassIdxList.length > 0
            ? account.classTeacherClassIdxList
            : account.classTeacherClassIdx !== '' && account.classTeacherClassIdx !== undefined
              ? [Number(account.classTeacherClassIdx)]
              : [])
        : [],
      classTeacherClassIdx: normalizedAccessMode === 'classTeacher' ? Number(account.classTeacherClassIdx) : null,
      classTeacherClassName: normalizedAccessMode === 'classTeacher' ? account.classTeacherClassName || '' : '',
      classTeacherClassNames: normalizedAccessMode === 'classTeacher'
        ? (Array.isArray(account.classTeacherClassNames) ? account.classTeacherClassNames : [])
        : [],
    };

    setUser(nextUser);
    saveCurrentUser(nextUser);

    return nextUser;
  };

  const signInDemo = async () => {
    throw new Error('Demo login has been removed. Please use a registered account.');
  };

  const signOut = () => {
    setUser(null);
    saveCurrentUser(null);
    navigate('/login', { replace: true });
  };

  const createUser = async ({ userId, name, password, role, isSuperAdmin = false, classTeacherKey = '', classTeacherClassIdxList = [], classTeacherClassNames = [], classTeacherClassIdx = '', classTeacherClassName = '' }) => {
    const normalizedUserId = String(userId || '').trim();
    const normalizedName = String(name || '').trim();
    const normalizedPassword = String(password || '').trim();
    const normalizedRole = String(role || 'student').trim();
    const normalizedClassTeacherKey = String(classTeacherKey || '').trim();
    const normalizedClassIdxList = Array.isArray(classTeacherClassIdxList) ? classTeacherClassIdxList.map(Number) : [];

    if (!normalizedUserId || !normalizedName || !normalizedPassword) {
      throw new Error('Please fill in all required fields.');
    }
    if (normalizedRole === 'teacher' && normalizedClassTeacherKey && normalizedClassIdxList.length === 0 && classTeacherClassIdx === '') {
      throw new Error('Please select at least one assigned class for this class teacher key.');
    }

    const latestUsers = loadLocalUsers();
    const existingUserKey = Object.keys(latestUsers).find(key => key.toLowerCase() === normalizedUserId.toLowerCase());
    if (existingUserKey) {
      throw new Error(`User ID "${normalizedUserId}" already exists.`);
    }

    // Use new array if provided, otherwise fall back to legacy single value
    const finalIdxList = normalizedClassIdxList.length > 0 ? normalizedClassIdxList
      : classTeacherClassIdx !== '' ? [Number(classTeacherClassIdx)] : [];
    const finalClassNames = Array.isArray(classTeacherClassNames) && classTeacherClassNames.length > 0
      ? classTeacherClassNames
      : classTeacherClassName ? [classTeacherClassName] : [];

    // Fetch active school scope from localStorage for account multi-tenancy
    const activeSchoolId = window.localStorage.getItem('schoolId') || 'PROGGA_DEFAULT';
    const activeSchoolCode = window.localStorage.getItem('schoolCode') || activeSchoolId;
    const activeEiinNumber = window.localStorage.getItem('schoolEiinNumber') || '130743';
    const activeSchoolName = window.localStorage.getItem('schoolName') || 'ScholasticBase';

    const newUser = {
      userId: normalizedUserId,
      name: normalizedName,
      password: normalizedPassword,
      role: normalizedRole,
      schoolId: activeSchoolId,
      schoolCode: activeSchoolCode,
      eiinNumber: activeEiinNumber,
      schoolName: activeSchoolName,
      // Super Admin flag — only set when explicitly requested
      ...(isSuperAdmin ? { isSuperAdmin: true } : {}),
      ...(normalizedRole === 'teacher' && normalizedClassTeacherKey ? {
        classTeacherKey: normalizedClassTeacherKey,
        // New multi-class fields
        classTeacherClassIdxList: finalIdxList,
        classTeacherClassNames: finalClassNames,
        // Legacy single-class fields (backward compat)
        classTeacherClassIdx: finalIdxList[0] ?? '',
        classTeacherClassName: finalClassNames[0] || '',
      } : {}),
    };

    const nextUsers = {
      ...latestUsers,
      [normalizedUserId]: newUser,
    };
    persistLocalUsers(nextUsers);

    try {
      await saveUserAccount(newUser);
    } catch (err) {
      // Firestore may reject writes (e.g. security rules). Accounts still work
      // via local storage, so this is a non-fatal warning, not an error.
      console.warn('Could not sync account to Firestore — saved locally only:', err?.message || err);
    }

    return { userId: normalizedUserId, name: normalizedName, role: normalizedRole };
  };

  const deleteUser = async (userId) => {
    const trimmedUserId = String(userId || '').trim();
    if (!trimmedUserId) return false;
    if (trimmedUserId.toLowerCase() === '@@siam##') return false;

    const currentUsers = loadLocalUsers();
    const matchedKey = Object.keys(currentUsers).find(k => k.toLowerCase() === trimmedUserId.toLowerCase());
    if (!matchedKey) return false;

    const nextUsers = { ...currentUsers };
    delete nextUsers[matchedKey];
    persistLocalUsers(nextUsers);

    if (user?.userId && String(user.userId).toLowerCase() === matchedKey.toLowerCase()) {
      setUser(null);
      saveCurrentUser(null);
    }

    try {
      await deleteUserAccount(matchedKey);
    } catch (err) {
      if (!isFirestoreUnavailableError(err)) {
        console.warn('Could not remove Firestore account:', err);
      }
    }

    return true;
  };

  const signInWithGoogle = async () => {
    if (!auth || !googleProvider) {
      const initErr = new Error('Firebase Auth is not properly initialized. Check your firebase.js configuration.');
      initErr.code = 'auth/not-initialized';
      throw initErr;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err) {
      console.error('[Firebase Auth] Google Sign-In Error:', err);
      let customMessage = err?.message || 'Google Sign-In failed.';
      const code = String(err?.code || '');

      if (code === 'auth/configuration-not-found') {
        customMessage = 'Firebase Error (auth/configuration-not-found): Google Sign-In is not enabled in your Firebase Console. Please open Firebase Console -> Authentication -> Sign-in method and enable the Google provider.';
      } else if (code === 'auth/operation-not-allowed') {
        customMessage = 'Google Sign-In is disabled for this Firebase project. Enable it under Authentication -> Sign-in method in Firebase Console.';
      } else if (code === 'auth/unauthorized-domain') {
        customMessage = 'This domain is not authorized for OAuth operations. Add localhost / domain in Firebase Console -> Authentication -> Settings -> Authorized domains.';
      } else if (code === 'auth/popup-blocked') {
        customMessage = 'Google Sign-In popup was blocked by your browser. Please allow popups for this site and try again.';
      } else if (code === 'auth/popup-closed-by-user') {
        customMessage = 'Sign-in popup was closed before completing authentication.';
      } else if (code === 'auth/network-request-failed') {
        customMessage = 'Network error during Google Authentication. Check your Internet connection.';
      }

      const formattedErr = new Error(customMessage);
      formattedErr.code = code;
      formattedErr.originalError = err;
      throw formattedErr;
    }
  };

  const provisionSchoolAdminSession = (adminAccount) => {
    const nextUsers = {
      ...loadLocalUsers(),
      [adminAccount.userId]: adminAccount,
    };
    persistLocalUsers(nextUsers);

    const nextUserSession = {
      userId: adminAccount.userId,
      name: adminAccount.name,
      role: 'admin',
      isSuperAdmin: false,
      accessMode: 'full',
      email: adminAccount.email || '',
      eiinNumber: adminAccount.eiinNumber || '',
      schoolCode: adminAccount.schoolCode || '',
    };

    setUser(nextUserSession);
    saveCurrentUser(nextUserSession);
    return nextUserSession;
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signInWithGoogle,
      provisionSchoolAdminSession,
      signInDemo,
      signOut,
      createUser,
      deleteUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    console.warn('[AuthContext] useAuth was called outside of AuthProvider. Returning safe fallback context.');
    return {
      user: null,
      loading: false,
      signIn: async () => {},
      signInWithGoogle: async () => {},
      provisionSchoolAdminSession: () => {},
      signInDemo: async () => {},
      signOut: () => {},
      createUser: async () => {},
      deleteUser: async () => {}
    };
  }
  return context;
}
