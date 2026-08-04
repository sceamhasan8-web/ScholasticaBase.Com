import React, { useState, useEffect, useMemo } from 'react';
import {
  getClassMonthlyFee,
  saveClassMonthlyFee,
  getStudentFeeRecord,
  saveFeeRecord,
  evaluateFeeStatus,
  calculateProratedMonthlyFee,
  addStudentOtherFee,
  removeStudentOtherFee,
  formatBDT,
  notifyFeeDataChanged,
} from '../utils/feeResolver.js';

// SVG Icons
const CloseIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const TrashIcon = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export default function StudentFeeConfigModal({
  isOpen,
  onClose,
  student,
  className = '',
  onSave = null,
}) {
  const targetClass = student?.className || className || 'Class One';
  const studentId = student?.id || student?.userId || 'STU-DEFAULT';
  const studentName = student?.name || 'Student';

  // State Management
  const [classMonthlyFee, setClassMonthlyFee] = useState(1000);
  const [unpaidMonths, setUnpaidMonths] = useState(0);
  const [otherFees, setOtherFees] = useState([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);

  // New Custom Fee Input State
  const [newFeeName, setNewFeeName] = useState('');
  const [newFeeAmount, setNewFeeAmount] = useState('');
  const [newFeeReason, setNewFeeReason] = useState('');

  // Load existing student fee ledger and class fee rate on mount or student change
  useEffect(() => {
    if (studentId) {
      const defaultRate = getClassMonthlyFee(targetClass);
      setClassMonthlyFee(defaultRate);

      const record = getStudentFeeRecord(studentId, targetClass);
      if (record) {
        setUnpaidMonths(record.unpaidMonths ?? record.monthlyDuesCount ?? 0);
        setClassMonthlyFee(record.classMonthlyFee ?? record.monthlyRate ?? defaultRate);
        setOtherFees(Array.isArray(record.otherFees) ? record.otherFees : (Array.isArray(record.othersDues) ? record.othersDues : []));
      }
    }
  }, [studentId, targetClass, isOpen]);

  const admissionDate = student?.admissionDate || student?.dateAdded || student?.createdAt || new Date().toISOString().split('T')[0];

  // Real-time calculated live summary
  const liveCalculation = useMemo(() => {
    const monthlyRate = Math.max(0, Number(classMonthlyFee) || 0);
    const months = Math.max(0, Number(unpaidMonths) || 0);
    
    const proration = calculateProratedMonthlyFee(admissionDate, monthlyRate);

    let totalMonthlyDue = months * monthlyRate;
    if (months === 1 && proration.isProrated) {
      totalMonthlyDue = proration.proratedFee;
    } else if (months > 1 && proration.isProrated) {
      totalMonthlyDue = proration.proratedFee + (months - 1) * monthlyRate;
    }

    const totalOtherDue = otherFees.reduce(
      (sum, item) => sum + (Math.max(0, Number(item.amount)) || 0),
      0
    );

    const grandTotalOutstanding = totalMonthlyDue + totalOtherDue;

    return {
      monthlyRate,
      unpaidMonths: months,
      totalMonthlyDue,
      totalOtherDue,
      grandTotalOutstanding,
      proration,
    };
  }, [classMonthlyFee, unpaidMonths, otherFees, admissionDate]);

  if (!isOpen) return null;

  // Handle Class Monthly Fee Save
  const handleSaveClassRate = () => {
    saveClassMonthlyFee(targetClass, classMonthlyFee);
    setSaveSuccessMsg(`✓ Standard monthly fee for ${targetClass} saved as ${formatBDT(classMonthlyFee)}`);
    setTimeout(() => setSaveSuccessMsg(null), 2500);
  };

  // Add Custom Miscellaneous Fee Item
  const handleAddOtherFee = (e) => {
    e.preventDefault();
    if (!newFeeName.trim() || !newFeeAmount) return;

    const title = newFeeName.trim();
    const newItem = {
      id: `due_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: title,
      label: title,
      amount: Math.max(0, Number(newFeeAmount) || 0),
      reason: newFeeReason.trim(),
      dateAdded: new Date().toISOString(),
    };

    setOtherFees(prev => [...prev, newItem]);
    setNewFeeName('');
    setNewFeeAmount('');
    setNewFeeReason('');
  };

  // Delete Custom Miscellaneous Fee Item
  const handleRemoveOtherFee = (id) => {
    setOtherFees(prev => prev.filter(item => item.id !== id));
  };

  // Save All Ledger Changes & Sync
  const handleSaveAll = () => {
    // 1. Save standard class monthly rate
    saveClassMonthlyFee(targetClass, classMonthlyFee);

    // 2. Save student fee record
    const updatedRecord = {
      studentId,
      unpaidMonths: liveCalculation.unpaidMonths,
      monthlyDuesCount: liveCalculation.unpaidMonths,
      classMonthlyFee: liveCalculation.monthlyRate,
      monthlyRate: liveCalculation.monthlyRate,
      otherFees: otherFees,
      othersDues: otherFees,
    };

    saveFeeRecord(studentId, updatedRecord);
    notifyFeeDataChanged();

    if (onSave) {
      onSave(updatedRecord);
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          width: '100%',
          maxWidth: 620,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            color: '#ffffff',
            borderRadius: '20px 20px 0 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SettingsIcon />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                Fee Ledger & Dues Setup
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: 13, opacity: 0.85 }}>
                {studentName} · Roll #{student?.roll || 'N/A'} · ({targetClass})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '50%',
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
            aria-label="Close Modal"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Success Alert Banner */}
        {saveSuccessMsg && (
          <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', color: '#166534', padding: '10px 24px', fontSize: 13, fontWeight: 700 }}>
            {saveSuccessMsg}
          </div>
        )}

        {/* Body Content */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* SECTION 1: CLASS-WISE MONTHLY TUITION FEE */}
          <div
            style={{
              background: '#f8fafc',
              borderRadius: 14,
              padding: 18,
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#334155', letterSpacing: '0.04em' }}>
                1. Class Standard Monthly Tuition Fee ({targetClass})
              </label>
              <button
                type="button"
                onClick={handleSaveClassRate}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#2563eb',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: 6,
                  padding: '4px 10px',
                  cursor: 'pointer',
                }}
              >
                Save Class Rate
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#475569' }}>৳</span>
              <input
                type="number"
                min="0"
                value={classMonthlyFee}
                onChange={e => setClassMonthlyFee(Math.max(0, Number(e.target.value) || 0))}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  fontSize: 15,
                  fontWeight: 700,
                  outline: 'none',
                }}
                placeholder="e.g. 1000"
              />
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>/ Month</span>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#64748b' }}>
              Setting this rate updates the default monthly tuition fee baseline for <strong>{targetClass}</strong>.
            </p>
          </div>

          {/* SECTION 2: STUDENT UNPAID PREVIOUS MONTHS */}
          <div
            style={{
              background: '#f8fafc',
              borderRadius: 14,
              padding: 18,
              border: '1px solid #e2e8f0',
            }}
          >
            <label style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#334155', letterSpacing: '0.04em', display: 'block', marginBottom: 10 }}>
              2. Student Unpaid Previous Months Setup
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', padding: '6px 10px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
                <button
                  type="button"
                  onClick={() => setUnpaidMonths(prev => Math.max(0, prev - 1))}
                  style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid #e2e8f0', background: '#f1f5f9', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={unpaidMonths}
                  onChange={e => setUnpaidMonths(Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: 60, textAlign: 'center', border: 'none', outline: 'none', fontSize: 18, fontWeight: 800, color: '#0f172a' }}
                />
                <button
                  type="button"
                  onClick={() => setUnpaidMonths(prev => prev + 1)}
                  style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid #e2e8f0', background: '#f1f5f9', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}
                >
                  +
                </button>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#475569', paddingRight: 4 }}>Unpaid Months</span>
              </div>

              {/* Quick preset buttons */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setUnpaidMonths(0)}
                  style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: unpaidMonths === 0 ? '#dcfce7' : '#ffffff', color: unpaidMonths === 0 ? '#15803d' : '#64748b', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                >
                  0 (Fully Paid)
                </button>
                <button
                  type="button"
                  onClick={() => setUnpaidMonths(1)}
                  style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: unpaidMonths === 1 ? '#fef9c3' : '#ffffff', color: unpaidMonths === 1 ? '#a16207' : '#64748b', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                >
                  1 Month Due
                </button>
                <button
                  type="button"
                  onClick={() => setUnpaidMonths(3)}
                  style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: unpaidMonths === 3 ? '#fee2e2' : '#ffffff', color: unpaidMonths === 3 ? '#b91c1c' : '#64748b', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                >
                  3 Months (e.g. Bonna)
                </button>
              </div>
            </div>

            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#ffffff', border: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Total Monthly Dues ({liveCalculation.unpaidMonths} mos × {formatBDT(liveCalculation.monthlyRate)}):</span>
              <strong style={{ color: '#1e293b', fontSize: 15 }}>{formatBDT(liveCalculation.totalMonthlyDue)}</strong>
            </div>
          </div>

          {/* SECTION 3: CUSTOM MISCELLANEOUS FEES */}
          <div
            style={{
              background: '#f8fafc',
              borderRadius: 14,
              padding: 18,
              border: '1px solid #e2e8f0',
            }}
          >
            <label style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#334155', letterSpacing: '0.04em', display: 'block', marginBottom: 10 }}>
              3. Custom Miscellaneous Fees (Exam Fee, Lab Fee, etc.)
            </label>

            {/* List of active custom fee items */}
            {otherFees.length === 0 ? (
              <div style={{ padding: 14, textAlign: 'center', color: '#94a3b8', fontSize: 13, background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 14 }}>
                No custom fee heads added for this student.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {otherFees.map(item => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                        {item.name || item.label}
                      </div>
                      {item.reason && (
                        <div style={{ fontSize: 12, color: '#64748b' }}>{item.reason}</div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#7c3aed' }}>
                        {formatBDT(item.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveOtherFee(item.id)}
                        style={{
                          background: '#fef2f2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: 6,
                          width: 28,
                          height: 28,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        title="Delete fee item"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Form to add custom fee */}
            <form onSubmit={handleAddOtherFee} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Fee Name (e.g. Exam Fee, Lab Fee)"
                value={newFeeName}
                onChange={e => setNewFeeName(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
              />
              <input
                type="number"
                min="0"
                placeholder="Amount ৳"
                value={newFeeAmount}
                onChange={e => setNewFeeAmount(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
              />
              <button
                type="submit"
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  background: '#7c3aed',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <PlusIcon /> Add Fee
              </button>
            </form>
          </div>

          {/* DYNAMIC GRAND TOTAL OUTSTANDING SUMMARY CARD */}
          <div
            style={{
              borderRadius: 16,
              background: liveCalculation.grandTotalOutstanding > 0 ? 'linear-gradient(135deg, #fef2f2, #fff1f2)' : 'linear-gradient(135deg, #f0fdf4, #f6fef9)',
              border: `2px solid ${liveCalculation.grandTotalOutstanding > 0 ? '#fecaca' : '#bbf7d0'}`,
              padding: 20,
            }}
          >
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 800 }}>
              Dynamic Dues Ledger Summary
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Grand Total Outstanding:</span>
              <span style={{ fontSize: 28, fontWeight: 900, color: liveCalculation.grandTotalOutstanding > 0 ? '#dc2626' : '#16a34a' }}>
                {formatBDT(liveCalculation.grandTotalOutstanding)}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 10, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.06)', fontSize: 13 }}>
              <div>
                <span style={{ color: '#64748b' }}>Total Monthly Due: </span>
                <strong style={{ color: '#1e293b' }}>{formatBDT(liveCalculation.totalMonthlyDue)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Total Other Due: </span>
                <strong style={{ color: '#1e293b' }}>{formatBDT(liveCalculation.totalOtherDue)}</strong>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            borderRadius: '0 0 20px 20px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            style={{
              padding: '10px 24px',
              borderRadius: 10,
              background: '#16a34a',
              color: '#ffffff',
              border: 'none',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)',
            }}
          >
            <CheckIcon /> Save & Apply Changes
          </button>
        </div>

      </div>
    </div>
  );
}
