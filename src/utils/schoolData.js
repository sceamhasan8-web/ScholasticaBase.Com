// ─────────────────────────────────────────────────────────────
// schoolData.js — Centralized Data Utility & Real-Time Sync Engine
// ─────────────────────────────────────────────────────────────
// Aggregates and normalizes live student and teacher records from:
//   • schoolAppLocalUsers
//   • schoolAppStudentProfiles
//   • schoolAppTeachers
//   • teacherPanelTeachers
//   • teacherPanelClasses
//
// Provides synchronous getters, subscription helpers, and a live React hook.
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import defaultLogo from '../greenfield_logo.png';

export const LOCAL_STORAGE_KEYS = {
  USERS: 'schoolAppLocalUsers',
  STUDENT_PROFILES: 'schoolAppStudentProfiles',
  TEACHERS: 'schoolAppTeachers',
  TEACHER_PANEL_TEACHERS: 'teacherPanelTeachers',
  TEACHER_PANEL_CLASSES: 'teacherPanelClasses',
  REGISTERED_SCHOOLS: 'schoolAppRegisteredSchools',
};

export const CUSTOM_EVENT_NAME = 'schoolDataUpdate';

// ── In-Memory Caches ─────────────────────────────────────────
let registeredSchoolsCache = null;
const studentsCacheMap = new Map();
const teachersCacheMap = new Map();
const aggregateCountsCacheMap = new Map();

export function invalidateSchoolDataCache() {
  registeredSchoolsCache = null;
  studentsCacheMap.clear();
  teachersCacheMap.clear();
  aggregateCountsCacheMap.clear();
}

export const DEFAULT_SCHOOL_PROFILE = {
  schoolId: 'SCHOLASTICBASE_DEFAULT',
  schoolCode: 'SCHOLASTICBASE',
  schoolName: 'PROGGA The School',
  eiinNumber: '130743',
  adminName: 'Progga Admin',
  adminEmail: 'sceamhasan8@gmail.com',
  adminTitle: 'Administrator',
  adminPhone: '+880 1000-000000',
  logo: defaultLogo,
  schoolType: 'combined',
  isDefault: true,
};

/**
 * Fetch and normalize all registered schools across global localStorage and active profiles.
 */
export function getAllRegisteredSchools() {
  if (typeof window === 'undefined') return [DEFAULT_SCHOOL_PROFILE];
  if (registeredSchoolsCache !== null) return registeredSchoolsCache;
  const map = new Map();

  let deletedList = [];
  try {
    const rawDeleted = window.localStorage.getItem('progga_deleted_schools_registry');
    if (rawDeleted) deletedList = JSON.parse(rawDeleted).map((s) => String(s).toLowerCase());
  } catch {}

  const isDeleted = (raw) => {
    if (!raw || typeof raw !== 'object') return false;
    const id = String(raw.schoolId || raw.id || raw.schoolCode || '').trim().toLowerCase();
    const eiin = String(raw.eiinNumber || raw.eiin || '').trim().toLowerCase();
    const code = String(raw.schoolCode || raw.code || '').trim().toLowerCase();
    return (id && deletedList.includes(id)) || (eiin && deletedList.includes(eiin)) || (code && deletedList.includes(code));
  };

  const isGenericName = (n, idStr, eiinStr) => {
    if (!n || typeof n !== 'string') return true;
    const clean = n.trim().toLowerCase();
    if (!clean) return true;
    if (idStr && (clean === String(idStr).trim().toLowerCase() || clean === `${String(idStr).trim().toLowerCase()} school`)) return true;
    if (eiinStr && (clean === String(eiinStr).trim().toLowerCase() || clean === `${String(eiinStr).trim().toLowerCase()} school`)) return true;
    if (clean === 'unnamed school' || clean === 'registered school portal' || clean === 'new school portal' || clean === 'school portal') return true;
    return false;
  };

  const addSchool = (raw) => {
    if (!raw || typeof raw !== 'object') return;
    if (isDeleted(raw)) return;
    const name = String(raw.schoolName || raw.name || '').trim();
    const eiin = String(raw.eiinNumber || raw.eiin || '').trim();
    const id = String(raw.schoolId || raw.id || raw.schoolCode || eiin || '').trim();
    if (!name && !id && !eiin) return;

    let existingKey = null;
    for (const [k, item] of map.entries()) {
      if (
        (id && item.schoolId && item.schoolId.toLowerCase() === id.toLowerCase()) ||
        (eiin && item.eiinNumber && item.eiinNumber.toLowerCase() === eiin.toLowerCase()) ||
        (raw.schoolCode && item.schoolCode && item.schoolCode.toLowerCase() === String(raw.schoolCode).toLowerCase())
      ) {
        existingKey = k;
        break;
      }
    }

    const key = existingKey || (id || eiin || name).toLowerCase();
    const existing = map.get(key) || {};

    const resolvedName =
      (!isGenericName(name, id, eiin) ? name : null) ||
      (!isGenericName(existing.schoolName, id || existing.schoolId, eiin || existing.eiinNumber) ? existing.schoolName : null) ||
      name ||
      existing.schoolName ||
      'Unnamed School';

    map.set(key, {
      ...existing,
      ...raw,
      schoolId: id || existing.schoolId || 'SCHOLASTICBASE_DEFAULT',
      schoolCode: raw.schoolCode || id || existing.schoolCode || 'SCHOLASTICBASE',
      schoolName: resolvedName,
      eiinNumber: eiin || existing.eiinNumber || 'N/A',
      adminName: raw.adminName || existing.adminName || 'School Admin',
      adminEmail: raw.adminEmail || existing.adminEmail || '',
      adminPhone: raw.adminPhone || existing.adminPhone || '',
      adminTitle: raw.adminTitle || existing.adminTitle || 'Administrator',
      logo: raw.logo || existing.logo || defaultLogo,
      schoolType: raw.schoolType || existing.schoolType || 'combined',
      // FIX #1: isDefault is determined by schoolId
      isDefault: !!(raw.isDefault || existing.isDefault || id === 'SCHOLASTICBASE_DEFAULT' || id === 'PROGGA_DEFAULT'),
    });
  };

  // 1. Primary Default School
  addSchool(DEFAULT_SCHOOL_PROFILE);

  // 2. Read directly from global un-scoped keys in localStorage (registeredSchoolsList, schoolAppRegisteredSchools, registered_schools)
  ['registeredSchoolsList', 'schoolAppRegisteredSchools', 'registered_schools'].forEach((key) => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach(addSchool);
        } else if (typeof parsed === 'object' && parsed !== null) {
          Object.values(parsed).forEach(addSchool);
        }
      }
    } catch {}
  });

  // 3. Read active schoolAppProfile from root localStorage
  try {
    const activeRaw = window.localStorage.getItem('schoolAppProfile');
    if (activeRaw) {
      const activeParsed = JSON.parse(activeRaw);
      if (activeParsed) addSchool(activeParsed);
    }
  } catch {}

  // 4. Scan all localStorage keys (including scoped profiles & legacy scoped school registries)
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (
        k &&
        (k.startsWith('schoolAppProfile') ||
          k.startsWith('registeredSchoolsList') ||
          k.startsWith('schoolAppRegisteredSchools') ||
          k.startsWith('registered_schools'))
      ) {
        try {
          const parsed = JSON.parse(window.localStorage.getItem(k));
          if (Array.isArray(parsed)) {
            parsed.forEach(addSchool);
          } else if (parsed && typeof parsed === 'object') {
            addSchool(parsed);
          }
        } catch {}
      }
    }
  } catch {}

  // 5. Scan local user accounts for school profiles
  try {
    const rawUsers = window.localStorage.getItem(LOCAL_STORAGE_KEYS.USERS);
    if (rawUsers) {
      const userList = Object.values(JSON.parse(rawUsers) || {});
      userList.forEach((u) => {
        if (u && (u.schoolCode || u.eiinNumber)) {
          addSchool({
            schoolId: u.schoolCode || u.eiinNumber,
            schoolCode: u.schoolCode || u.eiinNumber,
            schoolName: u.schoolName || '',
            eiinNumber: u.eiinNumber || '',
            adminName: u.role === 'admin' ? u.name : '',
            adminEmail: u.email || '',
          });
        }
      });
    }
  } catch {}

  const sorted = Array.from(map.values()).sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    return a.schoolName.localeCompare(b.schoolName);
  });
  registeredSchoolsCache = sorted;
  return sorted;
}

/**
 * Register or update a school entry in the global registered schools list.
 */
export function registerSchoolInRegistry(schoolProfile) {
  if (!schoolProfile || typeof schoolProfile !== 'object') return;

  // FIX #1 (continued): Guard against accidentally registering the master default
  // as a new school entry, which would corrupt the global school registry.
  const incomingId = String(schoolProfile.schoolId || schoolProfile.schoolCode || schoolProfile.eiinNumber || '').trim();
  if (incomingId === 'PROGGA_DEFAULT' || incomingId.toUpperCase() === 'PROGGA') {
    console.warn('[Registry] Blocked attempt to register PROGGA_DEFAULT as a new school entry.');
    return;
  }
  const currentSchools = getAllRegisteredSchools();
  const id = String(schoolProfile.schoolId || schoolProfile.schoolCode || schoolProfile.eiinNumber || 'PROGGA_DEFAULT').trim();
  const eiin = String(schoolProfile.eiinNumber || '').trim();
  const code = String(schoolProfile.schoolCode || '').trim();

  const existingIdx = currentSchools.findIndex((s) => {
    const sId = String(s.schoolId || '').toLowerCase();
    const sEiin = String(s.eiinNumber || '').toLowerCase();
    const sCode = String(s.schoolCode || '').toLowerCase();
    return (
      (id && sId === id.toLowerCase()) ||
      (eiin && sEiin === eiin.toLowerCase()) ||
      (code && sCode === code.toLowerCase())
    );
  });

  const merged = existingIdx >= 0
    ? { ...currentSchools[existingIdx], ...schoolProfile }
    : { ...schoolProfile, schoolId: id, schoolCode: code || id };

  let nextList;
  if (existingIdx >= 0) {
    nextList = [...currentSchools];
    nextList[existingIdx] = merged;
  } else {
    nextList = [...currentSchools, merged];
  }

  const jsonStr = JSON.stringify(nextList);

  // Directly set global un-scoped localStorage keys across all naming conventions
  try {
    window.localStorage.setItem('registeredSchoolsList', jsonStr);
    window.localStorage.setItem('schoolAppRegisteredSchools', jsonStr);
    window.localStorage.setItem('registered_schools', jsonStr);
  } catch (err) {
    console.warn('Could not write global registered schools list:', err);
  }

  invalidateSchoolDataCache();
  notifySchoolDataChanged();
  return nextList;
}

/**
 * Remove/Unregister a school entry from the global registered schools list and localStorage.
 * Master default school is protected from deletion.
 */
export function removeSchoolFromRegistry(targetSchool) {
  if (!targetSchool || typeof window === 'undefined') return [];

  const isObj = typeof targetSchool === 'object' && targetSchool !== null;
  const rawId = isObj ? (targetSchool.schoolId || targetSchool.id || targetSchool.schoolCode) : targetSchool;
  const rawCode = isObj ? targetSchool.schoolCode : '';
  const rawEiin = isObj ? targetSchool.eiinNumber : '';
  const rawName = isObj ? (targetSchool.schoolName || targetSchool.name) : '';

  const cleanId = String(rawId || '').trim().toLowerCase();
  const cleanCode = String(rawCode || '').trim().toLowerCase();
  const cleanEiin = String(rawEiin || '').trim().toLowerCase();
  const cleanName = String(rawName || '').trim().toLowerCase();

  // Protect default master school from accidental deletion
  if (
    cleanId === 'scholasticbase_default' || cleanId === 'progga_default' ||
    cleanCode === 'scholasticbase' || cleanCode === 'progga'
  ) {
    console.warn('[Registry] Master default school cannot be deleted.');
    return getAllRegisteredSchools();
  }

  const keysToBlacklist = [cleanId, cleanCode, cleanEiin, cleanName].filter(Boolean);

  // 1. Maintain a deleted schools blacklist in localStorage so stale items don't resurrect
  try {
    const rawDeleted = window.localStorage.getItem('progga_deleted_schools_registry');
    const deletedList = rawDeleted ? JSON.parse(rawDeleted) : [];
    let updated = false;
    keysToBlacklist.forEach((k) => {
      if (!deletedList.includes(k)) {
        deletedList.push(k);
        updated = true;
      }
    });
    if (updated) {
      window.localStorage.setItem('progga_deleted_schools_registry', JSON.stringify(deletedList));
    }
  } catch {}

  // 2. Filter out school from registered list keys
  const currentSchools = getAllRegisteredSchools();
  const filtered = currentSchools.filter((s) => {
    const sId = String(s.schoolId || s.id || '').trim().toLowerCase();
    const sCode = String(s.schoolCode || '').trim().toLowerCase();
    const sEiin = String(s.eiinNumber || s.eiin || '').trim().toLowerCase();
    const sName = String(s.schoolName || s.name || '').trim().toLowerCase();

    const matches = keysToBlacklist.some((k) => k && (sId === k || sCode === k || sEiin === k || sName === k));
    return !matches;
  });

  const jsonStr = JSON.stringify(filtered);

  try {
    window.localStorage.setItem('registeredSchoolsList', jsonStr);
    window.localStorage.setItem('schoolAppRegisteredSchools', jsonStr);
    window.localStorage.setItem('registered_schools', jsonStr);
  } catch (err) {
    console.warn('Could not update global registered schools list after deletion:', err);
  }

  // 3. Remove user accounts bound to this school from schoolAppLocalUsers
  try {
    const rawUsers = window.localStorage.getItem(LOCAL_STORAGE_KEYS.USERS);
    if (rawUsers) {
      const users = JSON.parse(rawUsers) || {};
      const updatedUsers = {};
      Object.entries(users).forEach(([k, u]) => {
        const uId = String(u.schoolId || u.id || '').trim().toLowerCase();
        const uCode = String(u.schoolCode || '').trim().toLowerCase();
        const uEiin = String(u.eiinNumber || u.eiin || '').trim().toLowerCase();
        const uName = String(u.schoolName || u.name || '').trim().toLowerCase();

        const matches = keysToBlacklist.some((b) => b && (uId === b || uCode === b || uEiin === b || uName === b));
        if (!matches) {
          updatedUsers[k] = u;
        }
      });
      window.localStorage.setItem(LOCAL_STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
    }
  } catch {}

  // 4. Reset active schoolAppProfile if active school was deleted
  try {
    const activeProfileRaw = window.localStorage.getItem('schoolAppProfile');
    if (activeProfileRaw) {
      const parsed = JSON.parse(activeProfileRaw);
      const activeId = String(parsed?.schoolId || parsed?.schoolCode || '').trim().toLowerCase();
      const activeEiin = String(parsed?.eiinNumber || '').trim().toLowerCase();
      const activeName = String(parsed?.schoolName || '').trim().toLowerCase();

      const matches = keysToBlacklist.some((b) => b && (activeId === b || activeEiin === b || activeName === b));
      if (matches) {
        window.localStorage.removeItem('schoolAppProfile');
        window.localStorage.removeItem('schoolName');
        window.localStorage.removeItem('schoolCode');
        window.localStorage.removeItem('schoolId');
        window.localStorage.removeItem('schoolEiinNumber');
      }
    }
  } catch {}

  // 5. Clean up all scoped keys belonging specifically to this school
  try {
    const keysToRemove = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k) {
        const lowerK = k.toLowerCase();
        if (keysToBlacklist.some((b) => b && lowerK.includes(b))) {
          if (
            k !== 'registeredSchoolsList' &&
            k !== 'schoolAppRegisteredSchools' &&
            k !== 'registered_schools' &&
            k !== 'schoolAppLocalUsers' &&
            k !== 'progga_deleted_schools_registry'
          ) {
            keysToRemove.push(k);
          }
        }
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {}

  invalidateSchoolDataCache();
  notifySchoolDataChanged();
  return filtered;
}


/**
 * Synchronously find a registered school profile matching EIIN or School ID/Code.
 * Returns null if not found.
 */
export function findRegisteredSchoolByEiin(eiinOrId) {
  if (!eiinOrId || typeof window === 'undefined') return null;
  const target = String(eiinOrId).trim().toLowerCase();
  if (!target) return null;

  const schools = getAllRegisteredSchools();
  return schools.find((s) => {
    const eiin = String(s.eiinNumber || s.eiin || '').trim().toLowerCase();
    const id = String(s.schoolId || s.id || '').trim().toLowerCase();
    const code = String(s.schoolCode || s.code || '').trim().toLowerCase();
    return (eiin && eiin === target) || (id && id === target) || (code && code === target);
  }) || null;
}

export function getActiveSchoolId() {
  if (typeof window === 'undefined') return 'PROGGA_DEFAULT';
  try {
    // FIX #2: Priority 1 — schoolAppProfile JSON blob (most authoritative after login)
    const raw = window.localStorage.getItem('schoolAppProfile');
    if (raw) {
      const parsed = JSON.parse(raw);
      const id = parsed?.schoolId || parsed?.schoolCode || parsed?.eiinNumber;
      if (id && id !== 'PROGGA_DEFAULT') return id;
    }
  } catch {}

  // FIX #2: Priority 2 — flat keys written by signIn()
  // Never return '' — an empty string causes readStorage/writeStorage to skip
  // school isolation and fall through to global unscoped keys.
  const flatId = window.localStorage.getItem('schoolId')
    || window.localStorage.getItem('schoolCode')
    || window.localStorage.getItem('schoolEiinNumber');

  return flatId || 'PROGGA_DEFAULT';
}

export function getScopedKey(key) {
  return key;
}

/**
 * Safely parse JSON from localStorage with fallback.
 */
export function readStorage(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[schoolData] Error reading localStorage key "${key}":`, err);
    return fallback;
  }
}

/**
 * Safely write JSON to localStorage.
 */
export function writeStorage(key, value) {
  if (typeof window === 'undefined') return;
  try {
    const jsonVal = JSON.stringify(value);
    window.localStorage.setItem(key, jsonVal);
    invalidateSchoolDataCache();
    notifySchoolDataChanged();
  } catch (err) {
    console.warn(`[schoolData] Error writing localStorage key "${key}":`, err);
  }
}

/**
 * Notify all subscribers in the current tab that school data has mutated.
 */
export function notifySchoolDataChanged() {
  invalidateSchoolDataCache();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENT_NAME));
  }
}

/**
 * Fetch, aggregate, and normalize all student records across all storage sources.
 */
export function getAllStudents(schoolId = getActiveSchoolId()) {
  const cacheKey = schoolId || 'PROGGA_DEFAULT';
  if (studentsCacheMap.has(cacheKey)) {
    return studentsCacheMap.get(cacheKey);
  }
  const map = new Map();

  // Helper to register or merge student object
  const registerStudent = (raw) => {
    if (!raw) return;
    const rawSchoolId = String(raw.schoolId || raw.schoolCode || raw.eiinNumber || '').trim();
    if (schoolId && schoolId !== 'PROGGA_DEFAULT' && rawSchoolId && rawSchoolId.toLowerCase() !== String(schoolId).trim().toLowerCase()) {
      return;
    }

    const id = String(raw.id || raw.userId || raw.studentId || '').trim();
    const name = String(raw.name || raw.fullName || '').trim();
    const roll = String(raw.roll || raw.rollNum || '').trim();
    const classNum = raw.classNum || raw.grade || '';
    const className = String(raw.className || (classNum ? `Class ${classNum}` : '')).trim();

    // Key strategies: primary ID > class+roll > normalized name
    let key = id.toLowerCase();
    if (!key && classNum && roll) {
      key = `class_${classNum}_roll_${roll}`.toLowerCase();
    }
    if (!key && name) {
      key = `name_${name.replace(/\s+/g, '_')}`.toLowerCase();
    }
    if (!key) return;

    const existing = map.get(key) || {};

    map.set(key, {
      id: id || existing.id || key,
      userId: id || existing.userId || key,
      name: name || existing.name || 'Student',
      classNum: classNum || existing.classNum || '',
      className: className || existing.className || '',
      roll: roll || existing.roll || '',
      profilePic: raw.profilePic || raw.photo || existing.profilePic || null,
      phone: raw.phone || raw.contact || existing.phone || '',
      address: raw.address || existing.address || '',
      fatherName: raw.fatherName || existing.fatherName || '',
      motherName: raw.motherName || existing.motherName || '',
      birthday: raw.birthday || raw.dob || existing.birthday || '',
      age: raw.age || existing.age || '',
      email: raw.email || existing.email || '',
      role: 'student',
      status: raw.status || existing.status || 'Active',
      admissionDate: raw.admissionDate || raw.dateAdded || raw.createdAt || existing.admissionDate || new Date().toISOString().split('T')[0],
      schoolId: rawSchoolId || schoolId || '',
    });
  };

  // 1. Read schoolAppStudentProfiles
  const studentProfilesRaw = readStorage(LOCAL_STORAGE_KEYS.STUDENT_PROFILES, [], schoolId);
  if (Array.isArray(studentProfilesRaw)) {
    studentProfilesRaw.forEach(registerStudent);
  } else if (typeof studentProfilesRaw === 'object' && studentProfilesRaw !== null) {
    Object.values(studentProfilesRaw).forEach(registerStudent);
  }

  // 2. Read student user accounts from schoolAppLocalUsers
  const localUsersRaw = readStorage(LOCAL_STORAGE_KEYS.USERS, {}, schoolId);
  const userList = Array.isArray(localUsersRaw) ? localUsersRaw : Object.values(localUsersRaw || {});
  userList.filter(u => u && String(u.role).toLowerCase() === 'student').forEach(registerStudent);

  // 3. Read students nested in teacherPanelClasses
  const classesRaw = readStorage(LOCAL_STORAGE_KEYS.TEACHER_PANEL_CLASSES, [], schoolId);
  if (Array.isArray(classesRaw)) {
    classesRaw.forEach(cls => {
      if (Array.isArray(cls.students)) {
        cls.students.forEach(st => {
          registerStudent({
            ...st,
            classNum: st.classNum || cls.classNum,
            className: st.className || cls.className,
          });
        });
      }
    });
  }

  const result = Array.from(map.values()).sort((a, b) => {
    if (a.classNum !== b.classNum) return (Number(a.classNum) || 0) - (Number(b.classNum) || 0);
    if (a.roll !== b.roll) return (Number(a.roll) || 0) - (Number(b.roll) || 0);
    return a.name.localeCompare(b.name);
  });
  studentsCacheMap.set(cacheKey, result);
  return result;
}

/**
 * Fetch, aggregate, and normalize all teacher records across all storage sources.
 */
export function getAllTeachers(schoolId = getActiveSchoolId()) {
  const cacheKey = schoolId || 'PROGGA_DEFAULT';
  if (teachersCacheMap.has(cacheKey)) {
    return teachersCacheMap.get(cacheKey);
  }
  const map = new Map();

  const registerTeacher = (raw) => {
    if (!raw) return;
    const rawSchoolId = String(raw.schoolId || raw.schoolCode || raw.eiinNumber || '').trim();
    if (schoolId && schoolId !== 'PROGGA_DEFAULT' && rawSchoolId && rawSchoolId.toLowerCase() !== String(schoolId).trim().toLowerCase()) {
      return;
    }

    const email = String(raw.email || '').trim().toLowerCase();
    const id = String(raw.id || raw.userId || raw.teacherId || email || '').trim();
    const name = String(raw.name || raw.fullName || '').trim();

    let key = email || id.toLowerCase();
    if (!key && name) {
      key = `teacher_${name.replace(/\s+/g, '_')}`.toLowerCase();
    }
    if (!key) return;

    const existing = map.get(key) || {};

    map.set(key, {
      id: id || existing.id || key,
      userId: id || existing.userId || key,
      email: email || existing.email || '',
      name: name || existing.name || 'Teacher',
      subject: raw.subject || raw.designation || existing.subject || 'General Teacher',
      phone: raw.phone || raw.contact || existing.phone || '',
      room: raw.room || raw.roomNo || existing.room || 'Room 101',
      profilePic: raw.profilePic || raw.photo || existing.profilePic || null,
      assignments: Array.isArray(raw.assignments) ? raw.assignments : (existing.assignments || []),
      status: raw.status || existing.status || 'Active',
      role: 'teacher',
      schoolId: rawSchoolId || schoolId || '',
    });
  };

  // 1. Read teacherPanelTeachers
  const tpTeachersRaw = readStorage(LOCAL_STORAGE_KEYS.TEACHER_PANEL_TEACHERS, [], schoolId);
  if (Array.isArray(tpTeachersRaw)) {
    tpTeachersRaw.forEach(registerTeacher);
  }

  // 2. Read schoolAppTeachers
  const appTeachersRaw = readStorage(LOCAL_STORAGE_KEYS.TEACHERS, [], schoolId);
  if (Array.isArray(appTeachersRaw)) {
    appTeachersRaw.forEach(registerTeacher);
  } else if (typeof appTeachersRaw === 'object' && appTeachersRaw !== null) {
    Object.values(appTeachersRaw).forEach(registerTeacher);
  }

  // 3. Read teacher user accounts from schoolAppLocalUsers
  const localUsersRaw = readStorage(LOCAL_STORAGE_KEYS.USERS, {}, schoolId);
  const userList = Array.isArray(localUsersRaw) ? localUsersRaw : Object.values(localUsersRaw || {});
  userList.filter(u => u && String(u.role).toLowerCase() === 'teacher').forEach(registerTeacher);

  const result = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  teachersCacheMap.set(cacheKey, result);
  return result;
}

/**
 * Get aggregate statistics directly from localStorage.
 */
export function getAggregateCounts(schoolId = getActiveSchoolId()) {
  const cacheKey = schoolId || 'PROGGA_DEFAULT';
  if (aggregateCountsCacheMap.has(cacheKey)) {
    return aggregateCountsCacheMap.get(cacheKey);
  }
  const students = getAllStudents(schoolId);
  const teachers = getAllTeachers(schoolId);
  const localUsersRaw = readStorage(LOCAL_STORAGE_KEYS.USERS, {}, schoolId);
  const userList = Array.isArray(localUsersRaw) ? localUsersRaw : Object.values(localUsersRaw || {});

  const counts = {
    totalStudents: students.length,
    totalTeachers: teachers.length,
    totalUsers: userList.length,
  };
  aggregateCountsCacheMap.set(cacheKey, counts);
  return counts;
}

/**
 * Subscribe to real-time school data changes (cross-tab and same-tab).
 * @param {Function} callback 
 * @returns {Function} Unsubscribe function
 */
export function subscribeToSchoolData(callback) {
  if (typeof window === 'undefined') return () => {};

  const handler = () => {
    invalidateSchoolDataCache();
    callback({
      students: getAllStudents(),
      teachers: getAllTeachers(),
      counts: getAggregateCounts(),
    });
  };

  window.addEventListener('storage', handler);
  window.addEventListener(CUSTOM_EVENT_NAME, handler);

  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(CUSTOM_EVENT_NAME, handler);
  };
}

/**
 * Custom React Hook for live synchronized school data.
 */
export function useLiveSchoolData() {
  const [data, setData] = useState(() => ({
    students: getAllStudents(),
    teachers: getAllTeachers(),
    counts: getAggregateCounts(),
  }));

  const refresh = useCallback(() => {
    setData({
      students: getAllStudents(),
      teachers: getAllTeachers(),
      counts: getAggregateCounts(),
    });
  }, []);

  useEffect(() => {
    // Initial fetch on mount
    refresh();

    // Subscribe to storage and custom events
    const unsubscribe = subscribeToSchoolData(setData);
    return () => unsubscribe();
  }, [refresh]);

  return {
    students: data.students,
    teachers: data.teachers,
    counts: data.counts,
    refresh,
    notifyDataChanged: notifySchoolDataChanged,
  };
}
