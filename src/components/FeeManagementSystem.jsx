import React, { useState, useEffect, useMemo } from 'react';
import { SCHOOL_BRANCHES, getBranchKeyByClass, sortClasses, isSameClass } from '../utils/schoolResolver.js';
import { useLiveSchoolData } from '../utils/schoolData.js';
import {
  getStudentFeeRecord,
  evaluateFeeStatus,
  saveFeeRecord,
  updateMonthlyDues,
  addOthersDueItem,
  removeOthersDueItem,
  processStudentPayment,
  getStudentTransactions,
  formatBDT,
  subscribeToFeeUpdates,
  FEE_STATUS_TYPES,
  getFeeTemplates,
  saveFeeTemplates,
  runAutomatedDuesGeneration,
  getClassMonthlyFee,
  saveClassMonthlyFee,
  getClassFeeTemplate,
  DEFAULT_FEE_TEMPLATES,
  getPendingTransactions,
} from '../utils/feeResolver.js';
import StudentFeeConfigModal from './StudentFeeConfigModal.jsx';
import PrincipalFeeApprovals from './PrincipalFeeApprovals.jsx';
import SectionErrorBoundary from './SectionErrorBoundary.jsx';

// SVG Icons
const ChevronLeft = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const SearchIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrashIcon = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const ReceiptIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const CreditCardIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const ZapIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const UsersIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export default function FeeManagementSystem({ userRole = 'admin', userAssignedBranch = null }) {
  const { students } = useLiveSchoolData();
  const [feeDataState, setFeeDataState] = useState({});
  const [transactionsState, setTransactionsState] = useState([]);
  const [feeTemplates, setFeeTemplatesState] = useState(getFeeTemplates());

  // Navigation Tabs: 'roster' | 'master' | 'automated'
  const [activeTab, setActiveTab] = useState('roster');

  // Navigation levels inside 'roster': 1 = Branch Select, 2 = Class Select, 3 = Student Roster
  const [navigationLevel, setNavigationLevel] = useState(1);
  const [selectedBranchKey, setSelectedBranchKey] = useState(userAssignedBranch || null);
  const [selectedClassName, setSelectedClassName] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals / Drawers state
  const [manageDuesStudent, setManageDuesStudent] = useState(null);
  const [paymentModalStudent, setPaymentModalStudent] = useState(null);
  const [ledgerModalStudent, setLedgerModalStudent] = useState(null);
  const [feeConfigModalStudent, setFeeConfigModalStudent] = useState(null);

  // Quick Override Form state
  const [monthlyCountInput, setMonthlyCountInput] = useState(0);
  const [monthlyRateInput, setMonthlyRateInput] = useState(500);
  const [newOtherLabel, setNewOtherLabel] = useState('');
  const [newOtherAmount, setNewOtherAmount] = useState('');
  const [newOtherReason, setNewOtherReason] = useState('');

  // Payment Form State
  const [payAmountInput, setPayAmountInput] = useState('');
  const [payMethodInput, setPayMethodInput] = useState('Cash');
  const [payRefInput, setPayRefInput] = useState('');
  const [payNoteInput, setPayNoteInput] = useState('');
  const [paymentBanner, setPaymentBanner] = useState(null);

  // Fee Master Template Editor State
  const [selectedTemplateBranch, setSelectedTemplateBranch] = useState('primary');
  const [selectedTemplateClass, setSelectedTemplateClass] = useState('ALL');
  const [editingTemplate, setEditingTemplate] = useState(feeTemplates.primary);
  const [newHeadLabel, setNewHeadLabel] = useState('');
  const [newHeadAmount, setNewHeadAmount] = useState('');
  const [newHeadRecurring, setNewHeadRecurring] = useState(false);
  const [masterSavedMsg, setMasterSavedMsg] = useState(null);

  // Automated Dues Engine Form State
  const [autoTargetBranch, setAutoTargetBranch] = useState('ALL');
  const [autoTargetClass, setAutoTargetClass] = useState('ALL');
  const [autoIncrementMonths, setAutoIncrementMonths] = useState(1);
  const [selectedAutoHeads, setSelectedAutoHeads] = useState([]);
  const [autoRunResult, setAutoRunResult] = useState(null);
  const [isProcessingAuto, setIsProcessingAuto] = useState(false);

  // Subscribe to live fee updates
  useEffect(() => {
    const unsub = subscribeToFeeUpdates(({ feeData, transactions, templates }) => {
      setFeeDataState(feeData);
      setTransactionsState(transactions);
      if (templates) setFeeTemplatesState(templates);
    });
    return () => unsub();
  }, []);

  // Sync editingTemplate when selectedTemplateBranch or selectedTemplateClass changes
  useEffect(() => {
    if (selectedTemplateClass === 'ALL') {
      setEditingTemplate(feeTemplates[selectedTemplateBranch] || DEFAULT_FEE_TEMPLATES[selectedTemplateBranch] || feeTemplates.primary);
    } else {
      const classTpl = getClassFeeTemplate(selectedTemplateBranch, selectedTemplateClass);
      const classRate = getClassMonthlyFee(selectedTemplateClass);
      setEditingTemplate({
        ...classTpl,
        monthlyRate: classRate,
      });
    }
  }, [selectedTemplateBranch, selectedTemplateClass, feeTemplates]);

  // Compute enriched student fee records directly from live student info
  const enrichedStudents = useMemo(() => {
    const safeStudents = Array.isArray(students) ? students : [];
    return safeStudents.map(student => {
      if (!student) return null;
      const sId = String(student.id || student.userId || student.studentId || '').trim();
      if (!sId) return null;
      const className = String(student.className || (student.classNum ? `Class ${student.classNum}` : '') || 'Class One').trim();
      const branchKey = getBranchKeyByClass(className) || 'secondary';
      const record = getStudentFeeRecord(sId, className, branchKey, student);
      const evalResult = evaluateFeeStatus(record, className, student);
      return {
        ...student,
        id: sId,
        userId: sId,
        className,
        branchKey,
        feeRecord: record,
        feeEval: evalResult,
      };
    }).filter(Boolean);
  }, [students, feeDataState]);

  // Aggregated Stats
  const globalStats = useMemo(() => {
    let totalCollected = 0;
    let totalPending = 0;
    let overdueCount = 0;
    let dueCount = 0;
    let paidCount = 0;
    let othersDueCount = 0;

    (Array.isArray(transactionsState) ? transactionsState : []).forEach(tx => {
      if (tx) totalCollected += (Number(tx.amountPaid) || 0);
    });

    (Array.isArray(enrichedStudents) ? enrichedStudents : []).forEach(st => {
      if (!st || !st.feeEval) return;
      totalPending += (Number(st.feeEval.totalPayable) || 0);
      if (st.feeEval.status === FEE_STATUS_TYPES.OVERDUE) overdueCount++;
      if (st.feeEval.status === FEE_STATUS_TYPES.DUE) dueCount++;
      if (st.feeEval.status === FEE_STATUS_TYPES.PAID) paidCount++;
      if (st.feeEval.status === FEE_STATUS_TYPES.OTHERS_DUE) othersDueCount++;
    });

    return {
      totalCollected,
      totalPending,
      overdueCount,
      dueCount,
      paidCount,
      othersDueCount,
      totalStudents: (enrichedStudents || []).length,
    };
  }, [enrichedStudents, transactionsState]);

  // Branch statistics
  const getBranchStats = (branchKey) => {
    const branchStudents = (enrichedStudents || []).filter(st => st && st.branchKey === branchKey);
    let pending = 0;
    let overdue = 0;
    let paid = 0;

    branchStudents.forEach(st => {
      if (!st || !st.feeEval) return;
      pending += (Number(st.feeEval.totalPayable) || 0);
      if (st.feeEval.status === FEE_STATUS_TYPES.OVERDUE) overdue++;
      if (st.feeEval.status === FEE_STATUS_TYPES.PAID) paid++;
    });

    return {
      total: branchStudents.length,
      pending,
      overdue,
      paid,
    };
  };

  // Classes for selected branch dynamically merging base branch classes + student enrolled classes
  const availableClassesInBranch = useMemo(() => {
    if (!selectedBranchKey || !SCHOOL_BRANCHES[selectedBranchKey]) return [];
    const defaultClasses = SCHOOL_BRANCHES[selectedBranchKey].classes || [];
    const dynamicClasses = new Set(defaultClasses);

    (enrichedStudents || []).forEach(st => {
      if (st && st.branchKey === selectedBranchKey && st.className) {
        const matchedDefault = defaultClasses.find(dc => isSameClass(dc, st.className));
        if (!matchedDefault) {
          dynamicClasses.add(st.className);
        }
      }
    });

    return sortClasses(Array.from(dynamicClasses));
  }, [selectedBranchKey, enrichedStudents]);

  // Classes for Fee Master Template branch selection
  const classesInSelectedTemplateBranch = useMemo(() => {
    if (!selectedTemplateBranch || !SCHOOL_BRANCHES[selectedTemplateBranch]) return [];
    const defaultClasses = SCHOOL_BRANCHES[selectedTemplateBranch].classes || [];
    const dynamicClasses = new Set(defaultClasses);

    (enrichedStudents || []).forEach(st => {
      if (st && st.branchKey === selectedTemplateBranch && st.className) {
        const matchedDefault = defaultClasses.find(dc => isSameClass(dc, st.className));
        if (!matchedDefault) {
          dynamicClasses.add(st.className);
        }
      }
    });

    return sortClasses(Array.from(dynamicClasses));
  }, [selectedTemplateBranch, enrichedStudents]);

  // Filtered Students for Level 3 Roster
  const level3Students = useMemo(() => {
    if (!selectedClassName) return [];
    let list = (enrichedStudents || []).filter(st => st && isSameClass(st.className, selectedClassName));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(st =>
        (st.name || '').toLowerCase().includes(q) ||
        (st.roll || '').toString().includes(q) ||
        (st.id || '').toString().toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'All') {
      list = list.filter(st => st.feeEval.status === statusFilter);
    }

    return list;
  }, [enrichedStudents, selectedClassName, searchQuery, statusFilter]);

  // Select Branch (Level 1 -> 2)
  const handleSelectBranch = (branchKey) => {
    setSelectedBranchKey(branchKey);
    setSelectedClassName(null);
    setNavigationLevel(2);
  };

  // Select Class (Level 2 -> 3)
  const handleSelectClass = (clsName) => {
    setSelectedClassName(clsName);
    setNavigationLevel(3);
  };

  // Open Quick Dues Override Modal/Drawer
  const openManageDuesModal = (student) => {
    setManageDuesStudent(student);
    setMonthlyCountInput(student.feeEval.monthlyDuesCount);
    setMonthlyRateInput(student.feeEval.monthlyRate);
    setNewOtherLabel('');
    setNewOtherAmount('');
    setNewOtherReason('');
  };

  // Save Monthly Dues Count & Rate
  const handleSaveMonthlyDues = () => {
    if (!manageDuesStudent) return;
    const studentId = manageDuesStudent.id || manageDuesStudent.userId;
    updateMonthlyDues(studentId, monthlyCountInput, monthlyRateInput);

    const updatedRecord = getStudentFeeRecord(studentId, manageDuesStudent.className);
    const updatedEval = evaluateFeeStatus(updatedRecord);
    setManageDuesStudent(prev => ({
      ...prev,
      feeRecord: updatedRecord,
      feeEval: updatedEval,
    }));
  };

  // Add Custom Other Due Item
  const handleAddOtherDue = (e) => {
    e.preventDefault();
    if (!manageDuesStudent || !newOtherLabel.trim() || !newOtherAmount) return;
    const studentId = manageDuesStudent.id || manageDuesStudent.userId;

    addOthersDueItem(studentId, {
      label: newOtherLabel.trim(),
      amount: Number(newOtherAmount),
      reason: newOtherReason.trim(),
    });

    setNewOtherLabel('');
    setNewOtherAmount('');
    setNewOtherReason('');

    const updatedRecord = getStudentFeeRecord(studentId, manageDuesStudent.className);
    const updatedEval = evaluateFeeStatus(updatedRecord);
    setManageDuesStudent(prev => ({
      ...prev,
      feeRecord: updatedRecord,
      feeEval: updatedEval,
    }));
  };

  // Remove Other Due Item
  const handleRemoveOtherDue = (dueItemId) => {
    if (!manageDuesStudent) return;
    const studentId = manageDuesStudent.id || manageDuesStudent.userId;
    removeOthersDueItem(studentId, dueItemId);

    const updatedRecord = getStudentFeeRecord(studentId, manageDuesStudent.className);
    const updatedEval = evaluateFeeStatus(updatedRecord);
    setManageDuesStudent(prev => ({
      ...prev,
      feeRecord: updatedRecord,
      feeEval: updatedEval,
    }));
  };

  // Open Payment Collector Modal
  const openPaymentModal = (student) => {
    setPaymentModalStudent(student);
    setPayAmountInput(student.feeEval.totalPayable || '');
    setPayMethodInput('Cash');
    setPayRefInput('');
    setPayNoteInput('');
    setPaymentBanner(null);
  };

  // Submit Payment
  const handleCollectPaymentSubmit = (e) => {
    e.preventDefault();
    if (!paymentModalStudent) return;
    const studentId = paymentModalStudent.id || paymentModalStudent.userId;

    const res = processStudentPayment(studentId, {
      amountPaid: Number(payAmountInput),
      paymentMethod: payMethodInput,
      reference: payRefInput,
      collectedBy: userRole === 'teacher' ? 'Class Teacher' : 'Admin Staff',
      customNote: payNoteInput,
    });

    if (res.success) {
      setPaymentBanner({ type: 'success', text: `Payment of ${formatBDT(payAmountInput)} recorded successfully! TXN: ${res.transaction.txnId}` });
      setTimeout(() => {
        setPaymentModalStudent(null);
        setPaymentBanner(null);
      }, 1500);
    } else {
      setPaymentBanner({ type: 'error', text: res.message || 'Failed to record payment' });
    }
  };

  // Fee Master Template Changes
  const handleMonthlyRateChange = (rate) => {
    setEditingTemplate(prev => ({
      ...prev,
      monthlyRate: Math.max(0, Number(rate) || 0),
    }));
  };

  const handleAddFeeHead = (e) => {
    e.preventDefault();
    if (!newHeadLabel.trim() || !newHeadAmount) return;

    const newHead = {
      id: `head_${selectedTemplateBranch}_${Date.now()}`,
      label: newHeadLabel.trim(),
      amount: Math.max(0, Number(newHeadAmount) || 0),
      isRecurring: newHeadRecurring,
    };

    setEditingTemplate(prev => ({
      ...prev,
      feeHeads: [...(prev.feeHeads || []), newHead],
    }));

    setNewHeadLabel('');
    setNewHeadAmount('');
    setNewHeadRecurring(false);
  };

  const handleRemoveFeeHead = (headId) => {
    setEditingTemplate(prev => ({
      ...prev,
      feeHeads: (prev.feeHeads || []).filter(h => h.id !== headId),
    }));
  };

  const handleTemplateBranchSelect = (bKey) => {
    setSelectedTemplateBranch(bKey);
    setSelectedTemplateClass('ALL');
  };

  const handleSaveMasterTemplate = () => {
    if (selectedTemplateClass === 'ALL') {
      const updated = {
        ...feeTemplates,
        [selectedTemplateBranch]: editingTemplate,
      };
      saveFeeTemplates(updated);

      classesInSelectedTemplateBranch.forEach(clsName => {
        saveClassMonthlyFee(clsName, editingTemplate.monthlyRate);
      });

      setMasterSavedMsg(`✓ Fee Master Template for All Classes (${SCHOOL_BRANCHES[selectedTemplateBranch]?.shortName}) saved successfully!`);
    } else {
      saveClassMonthlyFee(selectedTemplateClass, editingTemplate.monthlyRate);

      const updated = {
        ...feeTemplates,
        [`class_${selectedTemplateClass}`]: editingTemplate,
      };
      saveFeeTemplates(updated);

      setMasterSavedMsg(`✓ Fee Master Template & Monthly Rate for ${selectedTemplateClass} saved successfully!`);
    }
    setTimeout(() => setMasterSavedMsg(null), 3000);
  };

  // Automated Dues Generation Submit
  const handleRunAutomatedDues = (e) => {
    e.preventDefault();
    setIsProcessingAuto(true);
    setAutoRunResult(null);

    setTimeout(() => {
      const res = runAutomatedDuesGeneration({
        branchKey: autoTargetBranch === 'ALL' ? null : autoTargetBranch,
        className: autoTargetClass === 'ALL' ? null : autoTargetClass,
        incrementMonths: Number(autoIncrementMonths),
        applyFeeHeadIds: selectedAutoHeads,
        studentsList: students,
      });

      setIsProcessingAuto(false);
      setAutoRunResult(res);
    }, 600);
  };

  // Toggle Fee Head Selection for Auto Dues
  const toggleAutoFeeHead = (headId) => {
    setSelectedAutoHeads(prev =>
      prev.includes(headId) ? prev.filter(id => id !== headId) : [...prev, headId]
    );
  };

  // Status Badge Helper Component
  const renderStatusBadge = (status) => {
    let bg = '#f3f4f6';
    let color = '#374151';
    let border = '#d1d5db';

    if (status === FEE_STATUS_TYPES.PAID) {
      bg = '#dcfce7'; color = '#15803d'; border = '#86efac';
    } else if (status === FEE_STATUS_TYPES.DUE) {
      bg = '#fef9c3'; color = '#a16207'; border = '#fde047';
    } else if (status === FEE_STATUS_TYPES.OVERDUE) {
      bg = '#fee2e2'; color = '#b91c1c'; border = '#fca5a5';
    } else if (status === FEE_STATUS_TYPES.OTHERS_DUE) {
      bg = '#f3e8ff'; color = '#6b21a8'; border = '#d8b4fe';
    }

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color: color,
        border: `1px solid ${border}`,
        whiteSpace: 'nowrap',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
        {status}
      </span>
    );
  };

  return (
    <div className="fm-main-wrapper">
      
      {/* ── TOP HEADER & MAIN NAVIGATION TABS ── */}
      {/* Top Header & Dues Summary */}
      <div className="fm-top-header">
        <div className="fm-title-box">
          <div className="fm-title-row">
            {activeTab === 'roster' && navigationLevel > 1 && (
              <button
                onClick={() => setNavigationLevel(prev => prev - 1)}
                className="fm-back-btn"
              >
                <ChevronLeft /> Back
              </button>
            )}
            <h1 className="fm-title-heading">
              💳 Institutional Fee Management & Billing Engine
            </h1>
          </div>
          <p className="fm-title-desc">
            Template-based fee structures, automated dues calculation, and real-time student ledger tracking across branches.
          </p>
        </div>

        {/* Global Dues Chips */}
        <div className="fm-summary-chips">
          <div className="fm-summary-chip collected">
            <span>Collected:</span> <strong>{formatBDT(globalStats.totalCollected)}</strong>
          </div>
          <div className="fm-summary-chip pending">
            <span>Outstanding Dues:</span> <strong>{formatBDT(globalStats.totalPending)}</strong>
          </div>
        </div>
      </div>

      {/* ── TOP SECTION TAB NAVIGATION BAR ── */}
      {/* Mobile Selector Dropdown (< 640px) */}
      <select
        className="fm-mobile-tab-select"
        value={activeTab}
        onChange={(e) => setActiveTab(e.target.value)}
        aria-label="Select Fee Management Tab"
      >
        <option value="roster">👥 Branch & Class Dues Roster</option>
        {userRole === 'admin' && <option value="master">⚙️ Fee Master & Templates</option>}
        <option value="approvals">
          💳 Transaction ID Approvals ({transactionsState.filter(t => t.status === 'Pending').length} Pending)
        </option>
        {userRole === 'admin' && <option value="automated">⚡ Automated Billing Cycle</option>}
      </select>

      {/* Touch-scrollable Horizontal Tab Bar */}
      <div className="fm-tabs-wrapper">
        <div className="fm-tabs-container">
          <button
            onClick={() => setActiveTab('roster')}
            className={`fm-tab-btn ${activeTab === 'roster' ? 'active-blue' : 'inactive'}`}
          >
            <UsersIcon /> Branch & Class Dues Roster
          </button>

          {userRole === 'admin' && (
            <button
              onClick={() => setActiveTab('master')}
              className={`fm-tab-btn ${activeTab === 'master' ? 'active-blue' : 'inactive'}`}
            >
              <SettingsIcon /> Fee Master & Templates
            </button>
          )}

          <button
            onClick={() => setActiveTab('approvals')}
            className={`fm-tab-btn ${activeTab === 'approvals' ? 'active-green' : 'inactive'}`}
          >
            💳 Transaction ID Approvals
            {transactionsState.filter(t => t.status === 'Pending').length > 0 && (
              <span className="fm-badge-count">
                {transactionsState.filter(t => t.status === 'Pending').length}
              </span>
            )}
          </button>

          {userRole === 'admin' && (
            <button
              onClick={() => setActiveTab('automated')}
              className={`fm-tab-btn ${activeTab === 'automated' ? 'active-purple' : 'inactive'}`}
            >
              <ZapIcon /> Automated Billing Cycle
            </button>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB: TRANSACTION APPROVALS                                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'approvals' && (
        <SectionErrorBoundary sectionName="Transaction Approvals">
          <PrincipalFeeApprovals />
        </SectionErrorBoundary>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: BRANCH & CLASS DUES ROSTER                             */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'roster' && (
        <>
          {/* LEVEL 1: BRANCH SELECTION GRID */}
          {navigationLevel === 1 && (
            <div>
              <div className="fm-branch-grid">
                {Object.keys(SCHOOL_BRANCHES).map(branchKey => {
                  const branch = SCHOOL_BRANCHES[branchKey];
                  const stats = getBranchStats(branchKey);

                  return (
                    <div
                      key={branchKey}
                      onClick={() => handleSelectBranch(branchKey)}
                      className="fm-branch-card"
                      style={{
                        border: `2px solid ${branch.color}30`,
                      }}
                    >
                      <div className="fm-card-accent-bar" style={{ background: branch.color }} />
                      
                      <div className="fm-card-top">
                        <div
                          className="fm-card-icon"
                          style={{
                            background: `linear-gradient(135deg, ${branch.gradientFrom}, ${branch.gradientTo})`,
                          }}
                        >
                          {branch.emoji}
                        </div>
                        <span
                          className="fm-card-tag"
                          style={{
                            background: `${branch.color}15`,
                            color: branch.color
                          }}
                        >
                          {branch.shortName}
                        </span>
                      </div>

                      <h3 className="fm-card-title">
                        {branch.name}
                      </h3>
                      <p className="fm-card-subtitle">
                        {branch.classes.length} Classes ({branch.classes[0]} – {branch.classes[branch.classes.length - 1]})
                      </p>

                      <div className="fm-card-stats">
                        <div style={{ minWidth: 0 }}>
                          <div className="fm-stat-label">Total Enrolled</div>
                          <div className="fm-stat-val font-dark">{stats.total} Students</div>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="fm-stat-label">Pending Dues</div>
                          <div className="fm-stat-val" style={{ color: branch.color }}>{formatBDT(stats.pending)}</div>
                        </div>
                      </div>

                      <div className="fm-card-badges">
                        <span className="fm-badge-paid">
                          ✓ {stats.paid} Paid
                        </span>
                        <span className="fm-badge-overdue">
                          ⚠ {stats.overdue} Overdue
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LEVEL 2: CLASS SELECTION GRID */}
          {navigationLevel === 2 && selectedBranchKey && (
            <div>
              <div
                className="fm-class-header-banner"
                style={{
                  background: `linear-gradient(135deg, ${SCHOOL_BRANCHES[selectedBranchKey].gradientFrom}, ${SCHOOL_BRANCHES[selectedBranchKey].gradientTo})`,
                  borderRadius: 12,
                  padding: '14px 18px',
                  color: '#ffffff',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div>
                  <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.85, fontWeight: 700 }}>
                    {SCHOOL_BRANCHES[selectedBranchKey].shortName}
                  </span>
                  <h2 style={{ margin: '2px 0 0 0', fontSize: 19, fontWeight: 800 }}>
                    {SCHOOL_BRANCHES[selectedBranchKey].emoji} {SCHOOL_BRANCHES[selectedBranchKey].name}
                  </h2>
                </div>
                <div style={{ fontSize: 13, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)' }}>
                  Select a class below to manage student fee rosters
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 210px), 1fr))', gap: 10 }}>
                {availableClassesInBranch.map(clsName => {
                  const clsStudents = enrichedStudents.filter(st => isSameClass(st.className, clsName));
                  const totalDues = clsStudents.reduce((sum, st) => sum + (st.feeEval?.totalPayable || 0), 0);
                  const overdueCount = clsStudents.filter(st => st.feeEval?.status === FEE_STATUS_TYPES.OVERDUE).length;

                  return (
                    <div
                      key={clsName}
                      onClick={() => handleSelectClass(clsName)}
                      style={{
                        borderRadius: 10,
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                        padding: '12px 14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = SCHOOL_BRANCHES[selectedBranchKey].color;
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
                      }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                        {clsName}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                        {clsStudents.length} Students Enrolled
                      </div>

                      <div style={{ paddingTop: 8, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 9.5, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Class Outstanding Dues</div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: SCHOOL_BRANCHES[selectedBranchKey].color }}>{formatBDT(totalDues)}</div>
                        </div>
                        {overdueCount > 0 && (
                          <span style={{ fontSize: 10.5, background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                            {overdueCount} Overdue
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LEVEL 3: STUDENT ROSTER & FEE STATUS TABLE */}
          {navigationLevel === 3 && selectedClassName && (
            <div>
              {/* Search & Status Filters */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, background: '#ffffff', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 10, padding: '8px 14px', width: '100%', maxWidth: 280 }}>
                  <SearchIcon />
                  <input
                    type="text"
                    placeholder="Search student name or roll..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 14 }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['All', FEE_STATUS_TYPES.PAID, FEE_STATUS_TYPES.DUE, FEE_STATUS_TYPES.OVERDUE, FEE_STATUS_TYPES.OTHERS_DUE].map(st => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 20,
                        fontSize: 13,
                        fontWeight: 600,
                        border: statusFilter === st ? 'none' : '1px solid #e2e8f0',
                        background: statusFilter === st ? SCHOOL_BRANCHES[selectedBranchKey]?.color || '#2563eb' : '#ffffff',
                        color: statusFilter === st ? '#ffffff' : '#64748b',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Student Roster Table */}
              <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', overflowX: 'auto', WebkitOverflowScrolling: 'touch', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th style={{ padding: '14px 18px' }}>Roll & Student Name</th>
                      <th style={{ padding: '14px 18px' }}>Monthly Dues</th>
                      <th style={{ padding: '14px 18px' }}>Others Dues</th>
                      <th style={{ padding: '14px 18px' }}>Total Dues</th>
                      <th style={{ padding: '14px 18px' }}>Fee Status</th>
                      <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {level3Students.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                          No students found matching your criteria in {selectedClassName}.
                        </td>
                      </tr>
                    ) : (
                      level3Students.map(student => {
                        const evalRes = student.feeEval;
                        const studentId = student.id || student.userId;

                        return (
                          <tr key={studentId} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.background = '#fafafa'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            
                            {/* Student Name */}
                            <td style={{ padding: '14px 18px' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{student.name || 'Unnamed Student'}</div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>Roll: #{student.roll || 'N/A'} · Class: {student.className}</div>
                              {student.admissionDate && (
                                <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span>📅 Admitted:</span> {evalRes.prorationInfo?.formattedDateStr || student.admissionDate}
                                </div>
                              )}
                            </td>

                            {/* Monthly Dues */}
                            <td style={{ padding: '14px 18px' }}>
                              {evalRes.prorationInfo?.isProrated ? (
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1d4ed8' }}>
                                    {formatBDT(evalRes.monthlyDuesAmount)}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 600 }}>
                                    Prorated ({evalRes.prorationInfo.remainingDays} days from {evalRes.prorationInfo.joiningDay}th)
                                  </div>
                                  <div style={{ fontSize: 10, color: '#64748b' }}>
                                    Full Rate: {formatBDT(evalRes.monthlyRate)}/mo
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>{evalRes.monthlyDuesCount} Months</div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>@ {formatBDT(evalRes.monthlyRate)}/mo ({formatBDT(evalRes.monthlyDuesAmount)})</div>
                                </div>
                              )}
                            </td>

                            {/* Others Dues */}
                            <td style={{ padding: '14px 18px' }}>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{evalRes.othersDues.length} Items</div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>Total: {formatBDT(evalRes.othersDuesAmount)}</div>
                            </td>

                            {/* Total Dues */}
                            <td style={{ padding: '14px 18px' }}>
                              <div style={{ fontSize: 15, fontWeight: 800, color: evalRes.totalPayable > 0 ? '#dc2626' : '#16a34a' }}>
                                {formatBDT(evalRes.totalPayable)}
                              </div>
                            </td>

                            {/* Status Badge */}
                            <td style={{ padding: '14px 18px' }}>
                              {renderStatusBadge(evalRes.status)}
                            </td>

                            {/* Action Buttons */}
                            <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                
                                {/* Config Dues Modal Launcher */}
                                <button
                                  onClick={() => setFeeConfigModalStudent(student)}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: 8,
                                    border: '1px solid #7c3aed',
                                    background: '#f3e8ff',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: '#6b21a8',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                  title="Configure Class Fee, Unpaid Months & Miscellaneous Fees"
                                >
                                  ⚙ Config Dues
                                </button>

                                {/* Quick Override Drawer Button */}
                                <button
                                  onClick={() => openManageDuesModal(student)}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: 8,
                                    border: '1px solid #cbd5e1',
                                    background: '#ffffff',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: '#334155',
                                    cursor: 'pointer',
                                  }}
                                  title="Quick Override Dues"
                                >
                                  ✏️ Override
                                </button>

                                {/* Collect Payment */}
                                <button
                                  onClick={() => openPaymentModal(student)}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: '#16a34a',
                                    color: '#ffffff',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <CreditCardIcon /> Pay
                                </button>

                                {/* Ledger & Receipt */}
                                <button
                                  onClick={() => setLedgerModalStudent(student)}
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    border: '1px solid #cbd5e1',
                                    background: '#f8fafc',
                                    color: '#475569',
                                    cursor: 'pointer',
                                  }}
                                  title="View Student Ledger & History"
                                >
                                  <ReceiptIcon />
                                </button>

                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: GLOBAL FEE STRUCTURE / FEE MASTER                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'master' && (
        <div style={{ background: '#ffffff', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px 0', color: '#0f172a' }}>
              ⚙️ Global Fee Master & Class Structure Templates
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
              Define standard monthly tuition rates and default fee heads (Tuition, Lab, Library, Exam, Sports) mapped across Primary, Secondary, and College branches.
            </p>
          </div>

          {masterSavedMsg && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 14, marginBottom: 20, border: '1px solid #86efac' }}>
              {masterSavedMsg}
            </div>
          )}

          {/* Branch Switcher Tabs for Master Template */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            {Object.keys(SCHOOL_BRANCHES).map(bKey => {
              const b = SCHOOL_BRANCHES[bKey];
              const isSel = selectedTemplateBranch === bKey;
              return (
                <button
                  key={bKey}
                  onClick={() => handleTemplateBranchSelect(bKey)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 10,
                    border: `2px solid ${b.color}`,
                    background: isSel ? b.color : '#ffffff',
                    color: isSel ? '#ffffff' : b.color,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{b.emoji}</span> {b.shortName}
                </button>
              );
            })}
          </div>

          {/* Class Switcher Selector for Master Template */}
          <div style={{ background: '#f1f5f9', padding: '14px 16px', borderRadius: 12, marginBottom: 20, border: '1px solid #cbd5e1' }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              📚 Select Class for Fee Setup ({SCHOOL_BRANCHES[selectedTemplateBranch]?.shortName}):
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setSelectedTemplateClass('ALL')}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: selectedTemplateClass === 'ALL' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: selectedTemplateClass === 'ALL' ? '#2563eb' : '#ffffff',
                  color: selectedTemplateClass === 'ALL' ? '#ffffff' : '#475569',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  boxShadow: selectedTemplateClass === 'ALL' ? '0 2px 6px rgba(37,99,235,0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                🌐 All Classes (Branch Default)
              </button>
              {classesInSelectedTemplateBranch.map(clsName => {
                const isSelected = selectedTemplateClass === clsName;
                return (
                  <button
                    key={clsName}
                    type="button"
                    onClick={() => setSelectedTemplateClass(clsName)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: isSelected ? '#2563eb' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#334155',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 2px 6px rgba(37,99,235,0.25)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    📖 {clsName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Master Form Card */}
          <div style={{ background: '#f8fafc', borderRadius: 14, padding: 20, border: '1px solid #cbd5e1', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 14px 0', color: '#0f172a' }}>
              {selectedTemplateClass === 'ALL'
                ? `Monthly Tuition Rate & Fee Template (All Classes — ${SCHOOL_BRANCHES[selectedTemplateBranch]?.name})`
                : `Monthly Tuition Rate & Fee Template (${selectedTemplateClass} — ${SCHOOL_BRANCHES[selectedTemplateBranch]?.name})`}
            </h3>
            <div style={{ maxWidth: 360, marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                {selectedTemplateClass === 'ALL'
                  ? `Branch Standard Monthly Rate (BDT ৳)`
                  : `Monthly Tuition Rate for ${selectedTemplateClass} (BDT ৳)`}
              </label>
              <input
                type="number"
                min="0"
                value={editingTemplate.monthlyRate || 500}
                onChange={e => handleMonthlyRateChange(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 16, fontWeight: 800 }}
              />
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px 0', color: '#0f172a' }}>
              Standard Fee Heads & Default Items
            </h3>
            
            {/* List of configured fee heads */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {(editingTemplate.feeHeads || []).map(head => (
                <div key={head.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{head.label}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {head.isRecurring ? '🔄 Recurring Monthly Head' : '📌 One-time / Term Assessment Head'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#2563eb' }}>{formatBDT(head.amount)}</span>
                    <button
                      onClick={() => handleRemoveFeeHead(head.id)}
                      style={{ border: 'none', background: '#fee2e2', color: '#dc2626', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                      title="Remove Fee Head"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Fee Head Form */}
            <form onSubmit={handleAddFeeHead} style={{ background: '#eff6ff', padding: 16, borderRadius: 10, border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', marginBottom: 10 }}>➕ Add Default Fee Head Template</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 10, alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Fee Head Label (e.g. Lab Fee, Exam Fee)"
                  value={newHeadLabel}
                  onChange={e => setNewHeadLabel(e.target.value)}
                  required
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
                <input
                  type="number"
                  placeholder="Amount (৳)"
                  value={newHeadAmount}
                  onChange={e => setNewHeadAmount(e.target.value)}
                  required
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newHeadRecurring}
                    onChange={e => setNewHeadRecurring(e.target.checked)}
                  />
                  Monthly Recurring
                </label>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <PlusIcon /> Add Head
                </button>
              </div>
            </form>
          </div>

          <div style={{ textAlign: 'right' }}>
            <button
              onClick={handleSaveMasterTemplate}
              style={{ padding: '12px 24px', borderRadius: 10, background: '#16a34a', color: '#ffffff', border: 'none', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
            >
              Save Fee Master Template
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 3: AUTOMATED DUES GENERATION ENGINE                        */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'automated' && (
        <div style={{ background: '#ffffff', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px 0', color: '#0f172a' }}>
              ⚡ Automated Monthly Dues Billing & Calculation Engine
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
              Batch calculate monthly dues and apply standard fee master heads automatically based on branch & class templates.
            </p>
          </div>

          {autoRunResult && (
            <div style={{
              padding: '14px 18px',
              borderRadius: 10,
              marginBottom: 20,
              fontSize: 14,
              fontWeight: 700,
              background: autoRunResult.success ? '#dcfce7' : '#fee2e2',
              color: autoRunResult.success ? '#15803d' : '#991b1b',
              border: `1px solid ${autoRunResult.success ? '#86efac' : '#fca5a5'}`,
            }}>
              {autoRunResult.message}
            </div>
          )}

          <form onSubmit={handleRunAutomatedDues} style={{ background: '#f8fafc', borderRadius: 14, padding: 22, border: '1px solid #cbd5e1' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
              
              {/* Target Branch */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>Target School Branch</label>
                <select
                  value={autoTargetBranch}
                  onChange={e => {
                    setAutoTargetBranch(e.target.value);
                    setAutoTargetClass('ALL');
                  }}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                >
                  <option value="ALL">All 3 Branches (Entire Institution)</option>
                  <option value="primary">{SCHOOL_BRANCHES.primary?.name || 'Primary School'}</option>
                  <option value="secondary">{SCHOOL_BRANCHES.secondary?.name || 'High School'}</option>
                  <option value="college">{SCHOOL_BRANCHES.college?.name || 'College'}</option>
                </select>
              </div>

              {/* Target Class */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>Target Class</label>
                <select
                  value={autoTargetClass}
                  onChange={e => setAutoTargetClass(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                >
                  <option value="ALL">All Classes in Selected Branch</option>
                  {sortClasses(autoTargetBranch !== 'ALL' && SCHOOL_BRANCHES[autoTargetBranch] ? SCHOOL_BRANCHES[autoTargetBranch].classes : []).map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>

              {/* Increment Months */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>Monthly Tuition Increment</label>
                <select
                  value={autoIncrementMonths}
                  onChange={e => setAutoIncrementMonths(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                >
                  <option value="0">Do Not Increment Monthly Tuition (0 Mos)</option>
                  <option value="1">+1 Month Tuition Dues (New Billing Month)</option>
                  <option value="2">+2 Months Tuition Dues</option>
                </select>
              </div>

            </div>

            {/* Select Fee Master Heads to Apply */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 8 }}>Select Standard Fee Heads to Apply to Students</label>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {Object.keys(feeTemplates).map(bKey => {
                  const bTemplate = feeTemplates[bKey];
                  if (autoTargetBranch !== 'ALL' && autoTargetBranch !== bKey) return null;

                  return (bTemplate.feeHeads || []).map(head => {
                    const isChecked = selectedAutoHeads.includes(head.id);
                    return (
                      <div
                        key={head.id}
                        onClick={() => toggleAutoFeeHead(head.id)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 8,
                          border: isChecked ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                          background: isChecked ? '#f5f3ff' : '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: isChecked ? '#5b21b6' : '#1e293b' }}>{head.label}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{SCHOOL_BRANCHES[bKey]?.shortName}</div>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#7c3aed' }}>{formatBDT(head.amount)}</span>
                      </div>
                    );
                  });
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={isProcessingAuto}
              style={{
                padding: '12px 24px',
                borderRadius: 10,
                background: isProcessingAuto ? '#94a3b8' : '#7c3aed',
                color: '#ffffff',
                border: 'none',
                fontSize: 15,
                fontWeight: 800,
                cursor: isProcessingAuto ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <ZapIcon /> {isProcessingAuto ? 'Executing Billing Cycle...' : 'Run Automated Dues Generation Cycle'}
            </button>
          </form>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 1: TEACHER / ADMIN QUICK OVERRIDE DRAWER                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {manageDuesStudent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #f1f5f9', pb: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Quick Dues Adjustment & Override</h3>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  {manageDuesStudent.name} (Roll: #{manageDuesStudent.roll || 'N/A'} · {manageDuesStudent.className})
                </div>
              </div>
              <button onClick={() => setManageDuesStudent(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <CloseIcon />
              </button>
            </div>

            {/* Section A: Monthly Dues Controls */}
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: '#0f172a' }}>
                📅 Monthly Tuition Dues Count & Rate Override
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>Pending Months Count</label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    value={monthlyCountInput}
                    onChange={e => setMonthlyCountInput(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>Monthly Rate (BDT ৳)</label>
                  <input
                    type="number"
                    min="0"
                    value={monthlyRateInput}
                    onChange={e => setMonthlyRateInput(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#475569' }}>
                  Total Monthly Dues: <strong>{formatBDT(monthlyCountInput * monthlyRateInput)}</strong>
                </div>
                <button
                  onClick={handleSaveMonthlyDues}
                  style={{ padding: '6px 14px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Update Monthly Dues
                </button>
              </div>
            </div>

            {/* Section B: Custom "Others Due" Line Items */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: '#0f172a' }}>
                📌 Custom "Others Due" Items (Lab, Exam, Fines, Sports)
              </div>

              {manageDuesStudent.feeEval.othersDues.length === 0 ? (
                <div style={{ fontSize: 13, color: '#94a3b8', padding: 12, textAlign: 'center', background: '#fafafa', borderRadius: 8, border: '1px border #eee' }}>
                  No custom fee line items added yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {manageDuesStudent.feeEval.othersDues.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{item.label}</div>
                        {item.reason && <div style={{ fontSize: 11, color: '#64748b' }}>{item.reason}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#7c3aed' }}>{formatBDT(item.amount)}</span>
                        <button
                          onClick={() => handleRemoveOtherDue(item.id)}
                          style={{ border: 'none', background: '#fee2e2', color: '#dc2626', padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Custom Item Form */}
              <form onSubmit={handleAddOtherDue} style={{ background: '#f5f3ff', padding: 14, borderRadius: 10, border: '1px solid #ddd6fe' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9', marginBottom: 8 }}>Add Custom Fee Item</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    placeholder="Fee Label (e.g. Fine, Sports Fee)"
                    value={newOtherLabel}
                    onChange={e => setNewOtherLabel(e.target.value)}
                    required
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                  <input
                    type="number"
                    placeholder="Amount (৳)"
                    value={newOtherAmount}
                    onChange={e => setNewOtherAmount(e.target.value)}
                    required
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Reason / Note (Optional)"
                    value={newOtherReason}
                    onChange={e => setNewOtherReason(e.target.value)}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                  <button
                    type="submit"
                    style={{ padding: '7px 14px', borderRadius: 6, background: '#7c3aed', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <PlusIcon /> Add Fee
                  </button>
                </div>
              </form>
            </div>

            <div style={{ textAlign: 'right' }}>
              <button
                onClick={() => setManageDuesStudent(null)}
                style={{ padding: '8px 18px', borderRadius: 8, background: '#e2e8f0', color: '#334155', border: 'none', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 2: COLLECT PAYMENT                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {paymentModalStudent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 480, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Record Payment</h3>
              <button onClick={() => setPaymentModalStudent(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <CloseIcon />
              </button>
            </div>

            {paymentBanner && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 8,
                marginBottom: 14,
                fontSize: 13,
                fontWeight: 600,
                background: paymentBanner.type === 'success' ? '#dcfce7' : '#fee2e2',
                color: paymentBanner.type === 'success' ? '#15803d' : '#991b1b',
              }}>
                {paymentBanner.text}
              </div>
            )}

            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, marginBottom: 16, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{paymentModalStudent.name}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Current Pending Dues: <strong>{formatBDT(paymentModalStudent.feeEval.totalPayable)}</strong></div>
            </div>

            <form onSubmit={handleCollectPaymentSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Amount Paid (BDT ৳)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={payAmountInput}
                  onChange={e => setPayAmountInput(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15, fontWeight: 700 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Payment Method</label>
                  <select
                    value={payMethodInput}
                    onChange={e => setPayMethodInput(e.target.value)}
                    style={{ width: '100%', padding: '9px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                  >
                    <option value="Cash">Cash</option>
                    <option value="bKash">bKash</option>
                    <option value="Nagad">Nagad</option>
                    <option value="Rocket">Rocket</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Ref / TXN ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. BKASH-8912"
                    value={payRefInput}
                    onChange={e => setPayRefInput(e.target.value)}
                    style={{ width: '100%', padding: '9px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="Optional notes"
                  value={payNoteInput}
                  onChange={e => setPayNoteInput(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setPaymentModalStudent(null)}
                  style={{ padding: '9px 16px', borderRadius: 8, background: '#e2e8f0', color: '#334155', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 20px', borderRadius: 8, background: '#16a34a', color: '#ffffff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                >
                  Confirm & Process Payment
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 3: STUDENT LEDGER & TRANSACTION HISTORY                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {ledgerModalStudent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #f1f5f9', pb: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Student Financial Ledger & Receipts</h3>
                <div style={{ fontSize: 13, color: '#64748b' }}>{ledgerModalStudent.name} ({ledgerModalStudent.className} · Roll: #{ledgerModalStudent.roll || 'N/A'})</div>
              </div>
              <button onClick={() => setLedgerModalStudent(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <CloseIcon />
              </button>
            </div>

            {/* Dues Breakdown Summary Card */}
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Active Dues Breakdown</span>
                {renderStatusBadge(ledgerModalStudent.feeEval.status)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Monthly Tuition</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#2563eb' }}>{formatBDT(ledgerModalStudent.feeEval.monthlyDuesAmount)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Others Dues</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#7c3aed' }}>{formatBDT(ledgerModalStudent.feeEval.othersDuesAmount)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Total Payable</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: ledgerModalStudent.feeEval.totalPayable > 0 ? '#dc2626' : '#16a34a' }}>{formatBDT(ledgerModalStudent.feeEval.totalPayable)}</div>
                </div>
              </div>
            </div>

            {/* Transaction History */}
            <h4 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px 0', color: '#0f172a' }}>Payment History & Transactions</h4>
            {getStudentTransactions(ledgerModalStudent.id || ledgerModalStudent.userId).length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13, background: '#fafafa', borderRadius: 8 }}>
                No past transactions recorded for this student.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
                {getStudentTransactions(ledgerModalStudent.id || ledgerModalStudent.userId).map(tx => (
                  <div key={tx.txnId} style={{ background: '#ffffff', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{tx.txnId}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#16a34a' }}>{formatBDT(tx.amountPaid)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Method: {tx.paymentMethod} {tx.reference ? `(${tx.reference})` : ''}</span>
                      <span>{new Date(tx.timestamp).toLocaleDateString()}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                      Collected by: {tx.collectedBy}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 20, textAlign: 'right', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => window.print()}
                style={{ padding: '8px 16px', borderRadius: 8, background: '#2563eb', color: '#ffffff', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <ReceiptIcon /> Print Receipt
              </button>
              <button
                onClick={() => setLedgerModalStudent(null)}
                style={{ padding: '8px 16px', borderRadius: 8, background: '#e2e8f0', color: '#334155', border: 'none', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Interactive Fee & Ledger Config Modal */}
      <StudentFeeConfigModal
        isOpen={!!feeConfigModalStudent}
        onClose={() => setFeeConfigModalStudent(null)}
        student={feeConfigModalStudent}
        className={feeConfigModalStudent?.className || selectedClassName}
      />

    </div>
  );
}
