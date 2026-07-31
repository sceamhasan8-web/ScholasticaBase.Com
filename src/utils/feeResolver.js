/**
 * feeResolver.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure Utilities, Automated Dues Generation Engine & Fee Master Templates
 * 
 * Features:
 *   - Class-Wise Monthly Tuition Fee Configuration (e.g. Class One = ৳1000)
 *   - Student-Specific Ledger System:
 *       a) unpaidMonths: Number of previous unpaid months due
 *       b) otherFees: Custom miscellaneous fee items (Exam Fee, Lab Fee, etc.)
 *   - Dynamic Grand Total Outstanding Calculation:
 *       Total Monthly Due = unpaidMonths * classMonthlyFee
 *       Total Other Due = sum(otherFees amounts)
 *       Grand Total Outstanding = Total Monthly Due + Total Other Due
 *   - Global Fee Structure / Fee Master & Cross-Tab Real-time Synchronizations
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { SCHOOL_BRANCHES, getBranchKeyByClass } from './schoolResolver.js';

export const FEE_STORAGE_KEYS = {
  FEE_DATA: 'schoolAppFeeData',
  TRANSACTIONS: 'schoolAppFeeTransactions',
  FEE_TEMPLATES: 'schoolAppFeeTemplates',
  CLASS_FEES: 'schoolAppClassFees',
};

export const CUSTOM_EVENT_NAME = 'schoolDataUpdate';

export const FEE_STATUS_TYPES = {
  PAID: 'Paid',
  DUE: 'Due',
  OVERDUE: 'Overdue',
  OTHERS_DUE: 'Others Due',
};

// Default monthly tuition rates by school branch (in BDT ৳)
export const BRANCH_DEFAULT_RATES = {
  primary: 1000,
  secondary: 1200,
  college: 1500,
};

// Default monthly tuition rates by class name (in BDT ৳)
export const DEFAULT_CLASS_TUITION_RATES = {
  'Nursery': 800,
  'KG': 800,
  'Class One': 1000,
  'Class Two': 1000,
  'Class Three': 1000,
  'Class Four': 1000,
  'Class Five': 1000,
  'Class Six': 1200,
  'Class Seven': 1200,
  'Class Eight': 1300,
  'Class Nine': 1400,
  'Class Ten': 1500,
  'Class Eleven': 1800,
  'Class Twelve': 2000,
  'HSC 1st Year': 1800,
  'HSC 2nd Year': 2000,
};

// Default Fee Master Templates mapped across 3 branches
export const DEFAULT_FEE_TEMPLATES = {
  primary: {
    monthlyRate: 1000,
    feeHeads: [
      { id: 'head_pri_tuit', label: 'Monthly Tuition Fee', amount: 1000, isRecurring: true },
      { id: 'head_pri_exam', label: 'Exam Fee', amount: 300, isRecurring: false },
      { id: 'head_pri_lib', label: 'Library Fee', amount: 150, isRecurring: false },
      { id: 'head_pri_sports', label: 'Sports & Cultural Fee', amount: 150, isRecurring: false },
    ],
  },
  secondary: {
    monthlyRate: 1200,
    feeHeads: [
      { id: 'head_sec_tuit', label: 'Monthly Tuition Fee', amount: 1200, isRecurring: true },
      { id: 'head_sec_lab', label: 'Science Lab Fee', amount: 300, isRecurring: false },
      { id: 'head_sec_lib', label: 'Library & Journal Fee', amount: 200, isRecurring: false },
      { id: 'head_sec_exam', label: 'Term Exam Fee', amount: 400, isRecurring: false },
      { id: 'head_sec_ict', label: 'ICT & Computer Lab Fee', amount: 250, isRecurring: false },
    ],
  },
  college: {
    monthlyRate: 1500,
    feeHeads: [
      { id: 'head_col_tuit', label: 'Monthly Tuition Fee', amount: 1500, isRecurring: true },
      { id: 'head_col_lab', label: 'Advanced Science Lab Fee', amount: 500, isRecurring: false },
      { id: 'head_col_lib', label: 'Central Library Fee', amount: 300, isRecurring: false },
      { id: 'head_col_exam', label: 'Board / Semester Exam Fee', amount: 600, isRecurring: false },
      { id: 'head_col_dev', label: 'Campus Development Fee', amount: 400, isRecurring: false },
    ],
  },
};

function getActiveSchoolId() {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem('schoolAppProfile');
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.schoolId || parsed?.schoolCode || parsed?.eiinNumber || window.localStorage.getItem('schoolId') || window.localStorage.getItem('schoolCode') || window.localStorage.getItem('schoolEiinNumber') || '';
  } catch {
    return window.localStorage.getItem('schoolId') || window.localStorage.getItem('schoolCode') || window.localStorage.getItem('schoolEiinNumber') || '';
  }
}

function getScopedKey(key) {
  const schoolId = getActiveSchoolId();
  if (!schoolId || schoolId === 'SCHOLASTICBASE_DEFAULT' || schoolId === 'PROGGA_DEFAULT') return key;
  const cleanId = String(schoolId).trim().replace(/[^\w-]/g, '_');
  return `${key}_${cleanId}`;
}

/**
 * Safely parse JSON from localStorage
 */
function readStorage(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const scopedKey = getScopedKey(key);
    const rawScoped = window.localStorage.getItem(scopedKey);
    if (rawScoped) return JSON.parse(rawScoped);

    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.warn(`[feeResolver] Error reading key "${key}":`, err);
    return fallback;
  }
}

/**
 * Safely write JSON to localStorage
 */
function writeStorage(key, value) {
  if (typeof window === 'undefined') return;
  try {
    const scopedKey = getScopedKey(key);
    const jsonVal = JSON.stringify(value);
    window.localStorage.setItem(scopedKey, jsonVal);
    window.localStorage.setItem(key, jsonVal);
  } catch (err) {
    console.warn(`[feeResolver] Error writing key "${key}":`, err);
  }
}

/**
 * Trigger global real-time change event across active UI components and tabs.
 */
export function notifyFeeDataChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENT_NAME));
  }
}

/**
 * Get configured class monthly tuition fee rate or return fallback default.
 */
export function getClassMonthlyFee(className = '') {
  const normClass = String(className || '').trim();
  const savedClassFees = readStorage(FEE_STORAGE_KEYS.CLASS_FEES, {});
  if (normClass && savedClassFees[normClass] !== undefined && savedClassFees[normClass] !== null) {
    return Math.max(0, Number(savedClassFees[normClass]) || 0);
  }
  if (normClass && DEFAULT_CLASS_TUITION_RATES[normClass] !== undefined) {
    return DEFAULT_CLASS_TUITION_RATES[normClass];
  }
  const branchKey = className ? getBranchKeyByClass(className) : 'secondary';
  const template = getClassFeeTemplate(branchKey, className);
  return template.monthlyRate || BRANCH_DEFAULT_RATES[branchKey] || 1000;
}

/**
 * Save standard monthly tuition fee for a specific class.
 */
export function saveClassMonthlyFee(className, amount) {
  if (!className) return;
  const normClass = String(className).trim();
  const currentMap = readStorage(FEE_STORAGE_KEYS.CLASS_FEES, {});
  currentMap[normClass] = Math.max(0, Number(amount) || 0);
  writeStorage(FEE_STORAGE_KEYS.CLASS_FEES, currentMap);
  notifyFeeDataChanged();
  return currentMap;
}

/**
 * Retrieve all configured class-wise monthly fees object.
 */
export function getAllClassMonthlyFees() {
  return readStorage(FEE_STORAGE_KEYS.CLASS_FEES, {});
}

/**
 * Retrieve all Fee Master Templates from localStorage or return defaults.
 */
export function getFeeTemplates() {
  const saved = readStorage(FEE_STORAGE_KEYS.FEE_TEMPLATES, null);
  if (!saved) return DEFAULT_FEE_TEMPLATES;
  return {
    primary: { ...DEFAULT_FEE_TEMPLATES.primary, ...(saved.primary || {}) },
    secondary: { ...DEFAULT_FEE_TEMPLATES.secondary, ...(saved.secondary || {}) },
    college: { ...DEFAULT_FEE_TEMPLATES.college, ...(saved.college || {}) },
  };
}

/**
 * Save updated Fee Master Templates to localStorage and sync.
 */
export function saveFeeTemplates(updatedTemplates) {
  const current = getFeeTemplates();
  const merged = {
    ...current,
    ...updatedTemplates,
  };
  writeStorage(FEE_STORAGE_KEYS.FEE_TEMPLATES, merged);
  notifyFeeDataChanged();
  return merged;
}

/**
 * Retrieve template for specific class or branch.
 */
export function getClassFeeTemplate(branchKey, className = '') {
  const templates = getFeeTemplates();
  const key = branchKey || (className ? getBranchKeyByClass(className) : 'secondary') || 'secondary';
  return templates[key] || DEFAULT_FEE_TEMPLATES.secondary;
}

/**
 * Retrieve all raw fee records from localStorage.
 */
export function getAllFeeRecords() {
  return readStorage(FEE_STORAGE_KEYS.FEE_DATA, {});
}

/**
 * Get or initialize a student's fee record based on class Fee Master templates and class monthly rate.
 */
export function getStudentFeeRecord(studentId, classNumOrName = '', branchKeyOverride = null) {
  if (!studentId) return null;
  const normalizedId = String(studentId).trim();
  const feeDataMap = getAllFeeRecords();
  const defaultClassRate = getClassMonthlyFee(classNumOrName);
  
  if (feeDataMap[normalizedId]) {
    const rec = feeDataMap[normalizedId];
    const unpaidMonths = rec.unpaidMonths !== undefined ? Number(rec.unpaidMonths) : (rec.monthlyDuesCount !== undefined ? Number(rec.monthlyDuesCount) : 0);
    const classMonthlyFee = rec.classMonthlyFee !== undefined ? Number(rec.classMonthlyFee) : (rec.monthlyRate !== undefined ? Number(rec.monthlyRate) : defaultClassRate);
    const otherFees = Array.isArray(rec.otherFees) ? rec.otherFees : (Array.isArray(rec.othersDues) ? rec.othersDues : []);

    return {
      ...rec,
      studentId: normalizedId,
      unpaidMonths: Math.max(0, unpaidMonths),
      monthlyDuesCount: Math.max(0, unpaidMonths),
      classMonthlyFee: Math.max(0, classMonthlyFee),
      monthlyRate: Math.max(0, classMonthlyFee),
      otherFees,
      othersDues: otherFees,
    };
  }

  return {
    studentId: normalizedId,
    unpaidMonths: 0,
    monthlyDuesCount: 0,
    classMonthlyFee: defaultClassRate,
    monthlyRate: defaultClassRate,
    otherFees: [],
    othersDues: [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Evaluates dynamic fee status and calculates ledger breakdown:
 *   - Total Monthly Due = unpaidMonths * classMonthlyFee
 *   - Total Other Due = sum of custom otherFees amounts
 *   - Grand Total Outstanding = Total Monthly Due + Total Other Due
 */
export function evaluateFeeStatus(feeRecord, className = '') {
  if (!feeRecord) {
    const fallbackRate = getClassMonthlyFee(className);
    return {
      status: FEE_STATUS_TYPES.PAID,
      unpaidMonths: 0,
      monthlyDuesCount: 0,
      classMonthlyFee: fallbackRate,
      monthlyRate: fallbackRate,
      totalMonthlyDue: 0,
      monthlyDuesAmount: 0,
      otherFees: [],
      othersDues: [],
      totalOtherDue: 0,
      othersDuesAmount: 0,
      grandTotalOutstanding: 0,
      totalPayable: 0,
    };
  }

  const unpaidMonths = Math.max(0, Number(feeRecord.unpaidMonths ?? feeRecord.monthlyDuesCount ?? 0));
  const classMonthlyFee = Math.max(0, Number(feeRecord.classMonthlyFee ?? feeRecord.monthlyRate ?? getClassMonthlyFee(className) ?? 1000));
  const totalMonthlyDue = unpaidMonths * classMonthlyFee;

  const rawOtherFees = Array.isArray(feeRecord.otherFees) ? feeRecord.otherFees : (Array.isArray(feeRecord.othersDues) ? feeRecord.othersDues : []);
  const otherFees = rawOtherFees.map(item => ({
    id: item.id || `due_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: String(item.name || item.label || 'Custom Fee').trim(),
    label: String(item.label || item.name || 'Custom Fee').trim(),
    amount: Math.max(0, Number(item.amount) || 0),
    reason: String(item.reason || '').trim(),
    dateAdded: item.dateAdded || new Date().toISOString(),
  }));

  const totalOtherDue = otherFees.reduce((sum, item) => sum + (Math.max(0, Number(item.amount)) || 0), 0);
  const grandTotalOutstanding = totalMonthlyDue + totalOtherDue;

  let status = FEE_STATUS_TYPES.PAID;
  if (grandTotalOutstanding <= 0) {
    status = FEE_STATUS_TYPES.PAID;
  } else if (unpaidMonths > 1) {
    status = FEE_STATUS_TYPES.OVERDUE;
  } else if (unpaidMonths === 1) {
    status = FEE_STATUS_TYPES.DUE;
  } else if (unpaidMonths === 0 && totalOtherDue > 0) {
    status = FEE_STATUS_TYPES.OTHERS_DUE;
  }

  return {
    status,
    unpaidMonths,
    monthlyDuesCount: unpaidMonths,
    classMonthlyFee,
    monthlyRate: classMonthlyFee,
    totalMonthlyDue,
    monthlyDuesAmount: totalMonthlyDue,
    otherFees,
    othersDues: otherFees,
    totalOtherDue,
    othersDuesAmount: totalOtherDue,
    grandTotalOutstanding,
    totalPayable: grandTotalOutstanding,
  };
}

/**
 * Save or merge an updated student fee record into localStorage and sync.
 */
export function saveFeeRecord(studentId, updatedRecord) {
  if (!studentId) return;
  const normalizedId = String(studentId).trim();
  const currentMap = getAllFeeRecords();

  const existing = currentMap[normalizedId] || {
    studentId: normalizedId,
    unpaidMonths: 0,
    monthlyDuesCount: 0,
    classMonthlyFee: 1000,
    monthlyRate: 1000,
    otherFees: [],
    othersDues: [],
  };

  const unpaidMonths = updatedRecord.unpaidMonths !== undefined ? updatedRecord.unpaidMonths : (updatedRecord.monthlyDuesCount !== undefined ? updatedRecord.monthlyDuesCount : existing.unpaidMonths);
  const classMonthlyFee = updatedRecord.classMonthlyFee !== undefined ? updatedRecord.classMonthlyFee : (updatedRecord.monthlyRate !== undefined ? updatedRecord.monthlyRate : existing.classMonthlyFee);
  const otherFees = updatedRecord.otherFees !== undefined ? updatedRecord.otherFees : (updatedRecord.othersDues !== undefined ? updatedRecord.othersDues : existing.otherFees);

  const newRecord = {
    ...existing,
    ...updatedRecord,
    studentId: normalizedId,
    unpaidMonths: Math.max(0, Number(unpaidMonths) || 0),
    monthlyDuesCount: Math.max(0, Number(unpaidMonths) || 0),
    classMonthlyFee: Math.max(0, Number(classMonthlyFee) || 0),
    monthlyRate: Math.max(0, Number(classMonthlyFee) || 0),
    otherFees: Array.isArray(otherFees) ? otherFees : [],
    othersDues: Array.isArray(otherFees) ? otherFees : [],
    updatedAt: new Date().toISOString(),
  };

  currentMap[normalizedId] = newRecord;
  writeStorage(FEE_STORAGE_KEYS.FEE_DATA, currentMap);
  notifyFeeDataChanged();
  return newRecord;
}

/**
 * Helper to update unpaid months count for a student.
 */
export function updateStudentUnpaidMonths(studentId, unpaidMonths, classMonthlyFee = null) {
  const payload = {
    unpaidMonths: Math.max(0, Number(unpaidMonths) || 0),
    monthlyDuesCount: Math.max(0, Number(unpaidMonths) || 0),
  };
  if (classMonthlyFee !== null && !isNaN(classMonthlyFee)) {
    payload.classMonthlyFee = Math.max(0, Number(classMonthlyFee) || 0);
    payload.monthlyRate = Math.max(0, Number(classMonthlyFee) || 0);
  }
  return saveFeeRecord(studentId, payload);
}

/**
 * Backward-compatible helper to update monthly dues count.
 */
export function updateMonthlyDues(studentId, monthlyDuesCount, monthlyRate = null) {
  return updateStudentUnpaidMonths(studentId, monthlyDuesCount, monthlyRate);
}

/**
 * Helper to add a custom other fee item for a student.
 */
export function addStudentOtherFee(studentId, { name, label, amount, reason = '' }) {
  const current = getStudentFeeRecord(studentId);
  const title = String(name || label || 'Custom Fee').trim();
  const newItem = {
    id: `due_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: title,
    label: title,
    amount: Math.max(0, Number(amount) || 0),
    reason: String(reason || '').trim(),
    dateAdded: new Date().toISOString(),
  };

  const updatedOtherFees = [...(current.otherFees || []), newItem];
  return saveFeeRecord(studentId, { otherFees: updatedOtherFees, othersDues: updatedOtherFees });
}

/**
 * Backward-compatible helper to add "Others Due" item.
 */
export function addOthersDueItem(studentId, payload) {
  return addStudentOtherFee(studentId, payload);
}

/**
 * Helper to delete a custom other fee item.
 */
export function removeStudentOtherFee(studentId, feeId) {
  const current = getStudentFeeRecord(studentId);
  const updatedOtherFees = (current.otherFees || []).filter(item => item.id !== feeId);
  return saveFeeRecord(studentId, { otherFees: updatedOtherFees, othersDues: updatedOtherFees });
}

/**
 * Backward-compatible helper to remove "Others Due" item.
 */
export function removeOthersDueItem(studentId, dueItemId) {
  return removeStudentOtherFee(studentId, dueItemId);
}

/**
 * Automated Dues Generation Engine
 */
export function runAutomatedDuesGeneration({
  branchKey = null,
  className = null,
  incrementMonths = 1,
  applyFeeHeadIds = [],
  studentsList = [],
}) {
  if (!Array.isArray(studentsList) || studentsList.length === 0) {
    return { success: false, message: 'No students provided for dues generation.', updatedCount: 0 };
  }

  const templates = getFeeTemplates();
  let targetStudents = studentsList;

  if (branchKey) {
    targetStudents = targetStudents.filter(st => getBranchKeyByClass(st.className) === branchKey);
  }
  if (className) {
    targetStudents = targetStudents.filter(st => st.className === className);
  }

  if (targetStudents.length === 0) {
    return { success: false, message: 'No matching students found for selected target.', updatedCount: 0 };
  }

  let updatedCount = 0;

  targetStudents.forEach(st => {
    const stId = st.id || st.userId;
    if (!stId) return;

    const stBranch = getBranchKeyByClass(st.className) || 'secondary';
    const template = templates[stBranch] || DEFAULT_FEE_TEMPLATES.secondary;
    const currentRecord = getStudentFeeRecord(stId, st.className, stBranch);

    const newUnpaidMonths = (Number(currentRecord.unpaidMonths) || 0) + Number(incrementMonths);
    const classRate = currentRecord.classMonthlyFee || getClassMonthlyFee(st.className);

    let newOtherFees = [...(currentRecord.otherFees || [])];

    if (Array.isArray(applyFeeHeadIds) && applyFeeHeadIds.length > 0 && Array.isArray(template.feeHeads)) {
      template.feeHeads.forEach(head => {
        if (applyFeeHeadIds.includes(head.id) && !head.isRecurring) {
          const alreadyAdded = newOtherFees.some(item => (item.name || item.label) === head.label);
          if (!alreadyAdded) {
            newOtherFees.push({
              id: `due_auto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: head.label,
              label: head.label,
              amount: head.amount,
              reason: `Automated Billing Template (${new Date().toLocaleDateString('en-GB')})`,
              dateAdded: new Date().toISOString(),
            });
          }
        }
      });
    }

    saveFeeRecord(stId, {
      unpaidMonths: Math.max(0, newUnpaidMonths),
      monthlyDuesCount: Math.max(0, newUnpaidMonths),
      classMonthlyFee: classRate,
      monthlyRate: classRate,
      otherFees: newOtherFees,
      othersDues: newOtherFees,
    });
    updatedCount++;
  });

  notifyFeeDataChanged();

  return {
    success: true,
    message: `Successfully generated dues for ${updatedCount} student(s).`,
    updatedCount,
  };
}

export const TRANSACTION_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

/**
 * Retrieve all logged transaction history.
 */
export function getAllTransactions() {
  return readStorage(FEE_STORAGE_KEYS.TRANSACTIONS, []);
}

/**
 * Retrieve pending transactions awaiting approval.
 */
export function getPendingTransactions() {
  const allTx = getAllTransactions();
  return allTx.filter(tx => tx.status === TRANSACTION_STATUS.PENDING);
}

/**
 * Retrieve transaction history for a specific student.
 */
export function getStudentTransactions(studentId) {
  if (!studentId) return [];
  const normalizedId = String(studentId).trim();
  const allTx = getAllTransactions();
  return allTx.filter(tx => String(tx.studentId).trim() === normalizedId)
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Submit a payment with Transaction ID for manual Principal verification (saved as Pending).
 */
export function submitPendingPayment(studentId, {
  amountPaid,
  paymentMethod = 'bKash',
  reference = '',
  mobileNumber = '',
  studentName = '',
  className = '',
  collectedBy = 'Student Portal (Online Gateway)',
  customNote = '',
}) {
  if (!studentId) return { success: false, message: 'Invalid Student ID' };
  const paid = Math.max(0, Number(amountPaid) || 0);
  if (paid <= 0) return { success: false, message: 'Payment amount must be greater than ৳0.' };
  if (!reference || !reference.trim()) {
    return { success: false, message: 'Please enter a valid Transaction ID.' };
  }

  const currentRecord = getStudentFeeRecord(studentId);
  const currentEvaluation = evaluateFeeStatus(currentRecord, className);

  const txnId = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const timestamp = new Date().toISOString();

  const transactionRecord = {
    txnId,
    studentId: String(studentId).trim(),
    studentName: studentName || `Student (${studentId})`,
    className: className || '',
    amountPaid: paid,
    paymentMethod,
    reference: reference.trim(),
    mobileNumber: mobileNumber.trim(),
    collectedBy,
    customNote,
    timestamp,
    status: TRANSACTION_STATUS.PENDING,
    rejectionReason: '',
    previousStatus: currentEvaluation.status,
    previousTotalPayable: currentEvaluation.grandTotalOutstanding,
  };

  const allTx = getAllTransactions();
  allTx.unshift(transactionRecord);
  writeStorage(FEE_STORAGE_KEYS.TRANSACTIONS, allTx);

  notifyFeeDataChanged();

  return {
    success: true,
    transaction: transactionRecord,
    message: 'Transaction ID submitted successfully! Waiting for Principal approval.',
  };
}

/**
 * Approve a pending transaction (Principal action). Clears student dues.
 */
export function approveTransaction(txnId, approverName = 'Principal') {
  const allTx = getAllTransactions();
  const txIndex = allTx.findIndex(t => t.txnId === txnId);
  if (txIndex === -1) return { success: false, message: 'Transaction not found.' };

  const tx = allTx[txIndex];

  // Process fee deduction
  const studentId = tx.studentId;
  const currentRecord = getStudentFeeRecord(studentId);
  const currentEvaluation = evaluateFeeStatus(currentRecord, tx.className);
  let remainingToDeduct = tx.amountPaid;
  let updatedUnpaidMonths = currentEvaluation.unpaidMonths;
  let updatedOtherFees = [...currentEvaluation.otherFees];

  if (remainingToDeduct > 0 && updatedOtherFees.length > 0) {
    const nextOthers = [];
    for (const item of updatedOtherFees) {
      if (remainingToDeduct >= item.amount) {
        remainingToDeduct -= item.amount;
      } else {
        nextOthers.push({
          ...item,
          amount: item.amount - remainingToDeduct,
        });
        remainingToDeduct = 0;
      }
    }
    updatedOtherFees = nextOthers;
  }

  if (remainingToDeduct > 0 && currentEvaluation.classMonthlyFee > 0) {
    const monthsCleared = Math.floor(remainingToDeduct / currentEvaluation.classMonthlyFee);
    if (monthsCleared > 0) {
      updatedUnpaidMonths = Math.max(0, updatedUnpaidMonths - monthsCleared);
      remainingToDeduct -= (monthsCleared * currentEvaluation.classMonthlyFee);
    }
  }

  saveFeeRecord(studentId, {
    unpaidMonths: updatedUnpaidMonths,
    monthlyDuesCount: updatedUnpaidMonths,
    otherFees: updatedOtherFees,
    othersDues: updatedOtherFees,
  });

  allTx[txIndex] = {
    ...tx,
    status: TRANSACTION_STATUS.APPROVED,
    approvedAt: new Date().toISOString(),
    approvedBy: approverName,
  };

  writeStorage(FEE_STORAGE_KEYS.TRANSACTIONS, allTx);
  notifyFeeDataChanged();

  return {
    success: true,
    message: `Transaction ${tx.reference || tx.txnId} approved successfully!`,
    transaction: allTx[txIndex],
  };
}

/**
 * Reject a pending transaction (Principal action). Keeps student dues intact.
 */
export function rejectTransaction(txnId, reason = 'Invalid Transaction ID', rejectorName = 'Principal') {
  const allTx = getAllTransactions();
  const txIndex = allTx.findIndex(t => t.txnId === txnId);
  if (txIndex === -1) return { success: false, message: 'Transaction not found.' };

  const tx = allTx[txIndex];
  allTx[txIndex] = {
    ...tx,
    status: TRANSACTION_STATUS.REJECTED,
    rejectionReason: reason || 'Transaction ID not verified / Invalid',
    rejectedAt: new Date().toISOString(),
    rejectedBy: rejectorName,
  };

  writeStorage(FEE_STORAGE_KEYS.TRANSACTIONS, allTx);
  notifyFeeDataChanged();

  return {
    success: true,
    message: `Transaction ${tx.reference || tx.txnId} rejected.`,
    transaction: allTx[txIndex],
  };
}

/**
 * Process an immediate payment action (Admin direct override/cash) and record transaction history.
 */
export function processStudentPayment(studentId, {
  amountPaid,
  paymentMethod = 'Cash',
  reference = '',
  collectedBy = 'System / Admin Direct',
  customNote = '',
  clearMonthlyCount = null,
  clearOthersIds = [],
}) {
  if (!studentId) return { success: false, message: 'Invalid Student ID' };
  
  const currentRecord = getStudentFeeRecord(studentId);
  const currentEvaluation = evaluateFeeStatus(currentRecord);
  const paid = Math.max(0, Number(amountPaid) || 0);

  if (paid <= 0) {
    return { success: false, message: 'Payment amount must be greater than ৳0.' };
  }

  let remainingToDeduct = paid;
  let updatedUnpaidMonths = currentEvaluation.unpaidMonths;
  let updatedOtherFees = [...currentEvaluation.otherFees];

  if (Array.isArray(clearOthersIds) && clearOthersIds.length > 0) {
    updatedOtherFees = updatedOtherFees.filter(item => !clearOthersIds.includes(item.id));
  }

  if (remainingToDeduct > 0 && updatedOtherFees.length > 0 && (!clearOthersIds || clearOthersIds.length === 0)) {
    const nextOthers = [];
    for (const item of updatedOtherFees) {
      if (remainingToDeduct >= item.amount) {
        remainingToDeduct -= item.amount;
      } else {
        nextOthers.push({
          ...item,
          amount: item.amount - remainingToDeduct,
        });
        remainingToDeduct = 0;
      }
    }
    updatedOtherFees = nextOthers;
  }

  if (clearMonthlyCount !== null && !isNaN(clearMonthlyCount)) {
    updatedUnpaidMonths = Math.max(0, updatedUnpaidMonths - Number(clearMonthlyCount));
  } else if (remainingToDeduct > 0 && currentEvaluation.classMonthlyFee > 0) {
    const monthsCleared = Math.floor(remainingToDeduct / currentEvaluation.classMonthlyFee);
    if (monthsCleared > 0) {
      updatedUnpaidMonths = Math.max(0, updatedUnpaidMonths - monthsCleared);
      remainingToDeduct -= (monthsCleared * currentEvaluation.classMonthlyFee);
    }
  }

  const txnId = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const timestamp = new Date().toISOString();

  const transactionRecord = {
    txnId,
    studentId: String(studentId).trim(),
    amountPaid: paid,
    paymentMethod,
    reference,
    collectedBy,
    customNote,
    timestamp,
    status: TRANSACTION_STATUS.APPROVED,
    previousStatus: currentEvaluation.status,
    previousTotalPayable: currentEvaluation.grandTotalOutstanding,
  };

  const savedRecord = saveFeeRecord(studentId, {
    unpaidMonths: updatedUnpaidMonths,
    monthlyDuesCount: updatedUnpaidMonths,
    otherFees: updatedOtherFees,
    othersDues: updatedOtherFees,
  });

  const allTx = getAllTransactions();
  allTx.unshift(transactionRecord);
  writeStorage(FEE_STORAGE_KEYS.TRANSACTIONS, allTx);

  notifyFeeDataChanged();

  const newEvaluation = evaluateFeeStatus(savedRecord);

  return {
    success: true,
    transaction: transactionRecord,
    newStatus: newEvaluation.status,
    newTotalPayable: newEvaluation.grandTotalOutstanding,
  };
}

/**
 * Format currency in Bangladeshi Taka (৳).
 */
export function formatBDT(amount) {
  const num = Number(amount);
  if (isNaN(num)) return '৳0';
  return `৳${num.toLocaleString('en-IN')}`;
}

/**
 * Helper hook subscription callback register for cross-tab & in-app live sync.
 */
export function subscribeToFeeUpdates(callback) {
  if (typeof window === 'undefined') return () => {};

  const handler = () => {
    callback({
      feeData: getAllFeeRecords(),
      transactions: getAllTransactions(),
      templates: getFeeTemplates(),
      classFees: getAllClassMonthlyFees(),
    });
  };

  window.addEventListener('storage', handler);
  window.addEventListener(CUSTOM_EVENT_NAME, handler);

  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(CUSTOM_EVENT_NAME, handler);
  };
}
