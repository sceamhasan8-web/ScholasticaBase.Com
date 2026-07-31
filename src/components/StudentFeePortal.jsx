import React, { useState, useEffect, useMemo } from 'react';
import { getBranchKeyByClass, SCHOOL_BRANCHES } from '../utils/schoolResolver.js';
import {
  getStudentFeeRecord,
  evaluateFeeStatus,
  submitPendingPayment,
  getStudentTransactions,
  formatBDT,
  subscribeToFeeUpdates,
  FEE_STATUS_TYPES,
  TRANSACTION_STATUS,
  getClassFeeTemplate,
} from '../utils/feeResolver.js';

// SVG Icons
const CreditCardIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const ReceiptIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="24" height="24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const DEFAULT_EVAL_RESULT = {
  status: 'Paid',
  unpaidMonths: 0,
  monthlyDuesCount: 0,
  classMonthlyFee: 1000,
  monthlyRate: 1000,
  totalMonthlyDue: 0,
  monthlyDuesAmount: 0,
  otherFees: [],
  othersDues: [],
  totalOtherDue: 0,
  othersDuesAmount: 0,
  grandTotalOutstanding: 0,
  totalPayable: 0,
};

export default function StudentFeePortal({ currentStudent }) {
  const [feeRecordState, setFeeRecordState] = useState(null);
  const [transactions, setTransactions] = useState([]);
  
  // Payment Modal States
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState('bKash');
  const [mobileNumber, setMobileNumber] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentSuccessData, setPaymentSuccessData] = useState(null);
  const [paymentError, setPaymentError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Digital Receipt Modal
  const [receiptTxn, setReceiptTxn] = useState(null);

  // Safe extraction of student properties
  const studentId = String(currentStudent?.id || currentStudent?.userId || currentStudent?.studentId || 'STU-1001').trim();
  const className = String(currentStudent?.className || currentStudent?.grade || currentStudent?.class || 'Class Ten').trim();
  const studentName = String(currentStudent?.name || currentStudent?.studentName || `Student (${studentId})`).trim();

  // Safe BDT formatting helper
  const safeFormatBDT = (val) => {
    try {
      if (typeof formatBDT === 'function') {
        return formatBDT(val);
      }
    } catch { }
    const num = Number(val) || 0;
    return `৳${num.toLocaleString('en-BD')}`;
  };

  // Safe Branch Resolution
  const branchKey = useMemo(() => {
    try {
      if (typeof getBranchKeyByClass === 'function') {
        return getBranchKeyByClass(className) || 'secondary';
      }
    } catch (err) {
      console.warn('getBranchKeyByClass failed:', err);
    }
    return 'secondary';
  }, [className]);

  const branchInfo = useMemo(() => {
    try {
      if (SCHOOL_BRANCHES && SCHOOL_BRANCHES[branchKey]) {
        return SCHOOL_BRANCHES[branchKey];
      }
      if (SCHOOL_BRANCHES && SCHOOL_BRANCHES.secondary) {
        return SCHOOL_BRANCHES.secondary;
      }
    } catch (err) {
      console.warn('SCHOOL_BRANCHES resolution failed:', err);
    }
    return {
      name: 'Secondary Branch',
      emoji: '🏫',
      color: '#2563eb',
      gradientFrom: '#1e3a8a',
      gradientTo: '#3b82f6',
    };
  }, [branchKey]);

  const classTemplate = useMemo(() => {
    try {
      if (typeof getClassFeeTemplate === 'function') {
        return getClassFeeTemplate(branchKey, className);
      }
    } catch (err) {
      console.warn('getClassFeeTemplate failed:', err);
    }
    return null;
  }, [branchKey, className]);

  // Sync fee data and transactions live safely
  const refreshFeeData = () => {
    try {
      if (typeof getStudentFeeRecord === 'function') {
        const record = getStudentFeeRecord(studentId, className, branchKey);
        setFeeRecordState(record || null);
      }
    } catch (err) {
      console.warn('getStudentFeeRecord failed:', err);
    }

    try {
      if (typeof getStudentTransactions === 'function') {
        const txs = getStudentTransactions(studentId);
        setTransactions(Array.isArray(txs) ? txs : []);
      }
    } catch (err) {
      console.warn('getStudentTransactions failed:', err);
      setTransactions([]);
    }
  };

  useEffect(() => {
    refreshFeeData();
    try {
      if (typeof subscribeToFeeUpdates === 'function') {
        const unsub = subscribeToFeeUpdates(() => {
          refreshFeeData();
        });
        return () => {
          if (typeof unsub === 'function') unsub();
        };
      }
    } catch (err) {
      console.warn('subscribeToFeeUpdates failed:', err);
    }
  }, [studentId, className, branchKey]);

  // Safe Fee Evaluation Calculation
  const evalResult = useMemo(() => {
    try {
      if (typeof evaluateFeeStatus === 'function') {
        const res = evaluateFeeStatus(feeRecordState, className);
        if (res && typeof res === 'object') {
          return {
            status: res.status || FEE_STATUS_TYPES?.PAID || 'Paid',
            unpaidMonths: Number(res.unpaidMonths) || 0,
            monthlyDuesCount: Number(res.monthlyDuesCount ?? res.unpaidMonths) || 0,
            classMonthlyFee: Number(res.classMonthlyFee ?? res.monthlyRate) || 0,
            monthlyRate: Number(res.monthlyRate ?? res.classMonthlyFee) || 0,
            totalMonthlyDue: Number(res.totalMonthlyDue ?? res.monthlyDuesAmount) || 0,
            monthlyDuesAmount: Number(res.monthlyDuesAmount ?? res.totalMonthlyDue) || 0,
            otherFees: Array.isArray(res.otherFees) ? res.otherFees : (Array.isArray(res.othersDues) ? res.othersDues : []),
            othersDues: Array.isArray(res.othersDues) ? res.othersDues : (Array.isArray(res.otherFees) ? res.otherFees : []),
            totalOtherDue: Number(res.totalOtherDue ?? res.othersDuesAmount) || 0,
            othersDuesAmount: Number(res.othersDuesAmount ?? res.totalOtherDue) || 0,
            grandTotalOutstanding: Number(res.grandTotalOutstanding ?? res.totalPayable) || 0,
            totalPayable: Number(res.totalPayable ?? res.grandTotalOutstanding) || 0,
          };
        }
      }
    } catch (err) {
      console.warn('evaluateFeeStatus failed:', err);
    }
    return DEFAULT_EVAL_RESULT;
  }, [feeRecordState, className]);

  // Derived transaction states
  const pendingTx = useMemo(() => {
    if (!Array.isArray(transactions)) return null;
    const pendingStatus = TRANSACTION_STATUS?.PENDING || 'Pending';
    return transactions.find(tx => tx && (tx.status === pendingStatus || tx.status === 'Pending')) || null;
  }, [transactions]);

  const latestRejectedTx = useMemo(() => {
    if (!Array.isArray(transactions)) return null;
    const rejectedStatus = TRANSACTION_STATUS?.REJECTED || 'Rejected';
    return transactions.find(tx => tx && (tx.status === rejectedStatus || tx.status === 'Rejected')) || null;
  }, [transactions]);

  // Open Online Payment Modal
  const handleOpenPayModal = () => {
    setPaymentAmount(evalResult.totalPayable);
    setMobileNumber(currentStudent?.phone || '01700000000');
    setTransactionRef('');
    setPaymentError(null);
    setPaymentSuccessData(null);
    setShowPayModal(true);
  };

  // Submit Online Payment with Transaction ID
  const handleProcessOnlinePayment = (e) => {
    e.preventDefault();
    setPaymentError(null);
    if (!transactionRef.trim()) {
      setPaymentError('Transaction ID is required for verification.');
      return;
    }
    setIsProcessing(true);

    setTimeout(() => {
      try {
        if (typeof submitPendingPayment === 'function') {
          const res = submitPendingPayment(studentId, {
            amountPaid: Number(paymentAmount) || 0,
            paymentMethod: selectedGateway,
            reference: transactionRef.trim(),
            mobileNumber: mobileNumber.trim(),
            studentName: studentName,
            className: className,
            collectedBy: 'Student Portal (Online Gateway)',
            customNote: `Online submission via ${selectedGateway} (${mobileNumber})`,
          });

          setIsProcessing(false);

          if (res && res.success) {
            setPaymentSuccessData(res.transaction);
            refreshFeeData();
          } else {
            setPaymentError((res && res.message) || 'Payment submission failed. Please try again.');
          }
        } else {
          setIsProcessing(false);
          setPaymentError('Payment engine service unavailable.');
        }
      } catch (err) {
        setIsProcessing(false);
        setPaymentError(err.message || 'Error processing transaction.');
      }
    }, 800);
  };

  const renderStatusBadge = (status) => {
    const statusDue = FEE_STATUS_TYPES?.DUE || 'Due';
    const statusOverdue = FEE_STATUS_TYPES?.OVERDUE || 'Overdue';
    const statusOthers = FEE_STATUS_TYPES?.OTHERS_DUE || 'Others Due';

    let bg = '#dcfce7';
    let color = '#15803d';
    let border = '#86efac';

    if (status === statusDue) {
      bg = '#fef9c3'; color = '#a16207'; border = '#fde047';
    } else if (status === statusOverdue) {
      bg = '#fee2e2'; color = '#b91c1c'; border = '#fca5a5';
    } else if (status === statusOthers) {
      bg = '#f3e8ff'; color = '#6b21a8'; border = '#d8b4fe';
    }

    return (
      <span style={{
        padding: '6px 14px',
        borderRadius: 20,
        fontSize: 13,
        fontWeight: 800,
        background: bg,
        color: color,
        border: `1px solid ${border}`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        Status: {status || 'Paid'}
      </span>
    );
  };

  const renderTxnStatusBadge = (txStatus) => {
    const pendingStatus = TRANSACTION_STATUS?.PENDING || 'Pending';
    const rejectedStatus = TRANSACTION_STATUS?.REJECTED || 'Rejected';

    let bg = '#dcfce7';
    let color = '#15803d';
    let label = '✓ Approved';

    if (txStatus === pendingStatus) {
      bg = '#fef9c3'; color = '#a16207'; label = '⏳ Pending Verification';
    } else if (txStatus === rejectedStatus) {
      bg = '#fee2e2'; color = '#b91c1c'; label = '❌ Rejected';
    }

    return (
      <span style={{
        padding: '3px 9px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 800,
        background: bg,
        color: color,
        display: 'inline-flex',
        alignItems: 'center',
      }}>
        {label}
      </span>
    );
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif', color: '#1e293b' }}>
      
      {/* Student Profile Financial Banner */}
      <div style={{
        background: `linear-gradient(135deg, ${branchInfo.gradientFrom || '#1e3a8a'}, ${branchInfo.gradientTo || '#3b82f6'})`,
        borderRadius: 16,
        padding: '24px 28px',
        color: '#ffffff',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        boxShadow: `0 8px 25px ${(branchInfo.color || '#2563eb')}35`,
      }}>
        <div>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.85, fontWeight: 700 }}>
            {branchInfo.emoji || '🏫'} {branchInfo.name || 'School Branch'}
          </div>
          <h2 style={{ margin: '4px 0 0 0', fontSize: 24, fontWeight: 800 }}>
            {studentName}
          </h2>
          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
            Student ID: #{studentId} · Roll: #{currentStudent?.roll || 'N/A'} · Class: {className}
          </div>
        </div>

        <div>
          {renderStatusBadge(evalResult.status)}
        </div>
      </div>

      {/* Dynamic Alerts for Pending / Rejected Payments */}
      {pendingTx && (
        <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: 14, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 28 }}>⏳</div>
          <div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 800, color: '#854d0e' }}>
              Transaction ID Verification Pending
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: '#a16207' }}>
              Your submitted Transaction ID <strong>{pendingTx.reference}</strong> for <strong>{safeFormatBDT(pendingTx.amountPaid)}</strong> via {pendingTx.paymentMethod} is currently under review by the Principal. Dues will update upon Principal approval.
            </p>
          </div>
        </div>
      )}

      {!pendingTx && latestRejectedTx && evalResult.grandTotalOutstanding > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 28 }}>❌</div>
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 800, color: '#991b1b' }}>
                Previous Transaction Rejected
              </h4>
              <p style={{ margin: 0, fontSize: 13, color: '#b91c1c' }}>
                Transaction ID <strong>{latestRejectedTx.reference}</strong> was rejected by the Principal. Reason: <em>"{latestRejectedTx.rejectionReason || 'Verification Failed'}"</em>. Please submit a valid Transaction ID.
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenPayModal}
            style={{ padding: '8px 16px', borderRadius: 8, background: '#dc2626', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Resubmit Transaction ID
          </button>
        </div>
      )}

      {/* Main Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 20, marginBottom: 30 }}>
        
        {/* Card 1: Dues Ledger Summary */}
        <div style={{ background: '#ffffff', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: 13, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>
            Current Outstanding Payable Balance
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: evalResult.totalPayable > 0 ? '#dc2626' : '#16a34a', margin: '8px 0 16px 0' }}>
            {safeFormatBDT(evalResult.totalPayable)}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#64748b' }}>Monthly Tuition ({evalResult.monthlyDuesCount} Mos @ {safeFormatBDT(evalResult.monthlyRate)}):</span>
              <span style={{ fontWeight: 700, color: '#1e293b' }}>{safeFormatBDT(evalResult.monthlyDuesAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#64748b' }}>Custom Others Dues ({(evalResult.othersDues || []).length} items):</span>
              <span style={{ fontWeight: 700, color: '#1e293b' }}>{safeFormatBDT(evalResult.othersDuesAmount)}</span>
            </div>
          </div>

          {evalResult.totalPayable > 0 ? (
            <button
              onClick={handleOpenPayModal}
              style={{
                width: '100%',
                marginTop: 20,
                padding: '12px',
                borderRadius: 10,
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)',
                transition: 'all 0.2s ease',
              }}
            >
              <CreditCardIcon /> Pay Outstanding Dues Online
            </button>
          ) : (
            <div style={{ marginTop: 20, padding: 12, borderRadius: 10, background: '#f0fdf4', color: '#166534', fontSize: 13, fontWeight: 700, textAlign: 'center', border: '1px solid #bbf7d0' }}>
              ✓ All fees and dues are fully paid!
            </div>
          )}
        </div>

        {/* Card 2: Itemized Active Dues Breakdown */}
        <div style={{ background: '#ffffff', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
            Itemized Dues Ledger
          </h3>

          {(evalResult.othersDues || []).length === 0 && evalResult.monthlyDuesCount === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              No active fee items recorded on your account ledger.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {evalResult.monthlyDuesCount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Monthly Tuition Fee</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{evalResult.monthlyDuesCount} Months pending (@ {safeFormatBDT(evalResult.monthlyRate)}/mo)</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#2563eb' }}>
                    {safeFormatBDT(evalResult.monthlyDuesAmount)}
                  </div>
                </div>
              )}

              {(evalResult.othersDues || []).map(item => (
                <div key={item.id || item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#4c1d95' }}>{item.label || item.name || 'Custom Fee'}</div>
                    {item.reason && <div style={{ fontSize: 11, color: '#6d28d9' }}>{item.reason}</div>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#7c3aed' }}>
                    {safeFormatBDT(item.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Transaction & Payment History Section */}
      <div style={{ background: '#ffffff', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
          📜 Payment History & Digital Receipts
        </h3>

        {!Array.isArray(transactions) || transactions.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
            No past transactions found. Payments made online or at school office will appear here.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Date</th>
                  <th style={{ padding: '12px 16px' }}>Transaction ID</th>
                  <th style={{ padding: '12px 16px' }}>Gateway</th>
                  <th style={{ padding: '12px 16px' }}>Amount Paid</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.txnId || tx.reference || Math.random()} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#334155' }}>
                      {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                      {tx.reference || tx.txnId || 'N/A'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 6, background: '#f1f5f9', fontWeight: 600 }}>{tx.paymentMethod || 'Online'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 800, color: '#16a34a' }}>
                      {safeFormatBDT(tx.amountPaid)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {renderTxnStatusBadge(tx.status || (TRANSACTION_STATUS?.APPROVED || 'Approved'))}
                      {tx.status === (TRANSACTION_STATUS?.REJECTED || 'Rejected') && tx.rejectionReason && (
                        <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>{tx.rejectionReason}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => setReceiptTxn(tx)}
                        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#ffffff', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <ReceiptIcon /> Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ONLINE PAYMENT MODAL */}
      {showPayModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 460, padding: 26, boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                💳 Student Online Payment Gateway
              </h3>
              <button onClick={() => setShowPayModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <CloseIcon />
              </button>
            </div>

            {paymentSuccessData ? (
              <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                <div style={{ display: 'inline-flex', padding: 12, borderRadius: '50%', background: '#fef9c3', color: '#a16207', marginBottom: 12, fontSize: 32 }}>
                  ⏳
                </div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 18, fontWeight: 800, color: '#854d0e' }}>
                  Transaction ID Submitted!
                </h4>
                <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                  Your payment submission of <strong>{safeFormatBDT(paymentSuccessData.amountPaid)}</strong> with Transaction ID <strong>{paymentSuccessData.reference}</strong> has been received and sent to the Principal for verification.
                </p>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10, fontSize: 12, color: '#334155', marginBottom: 20, textAlign: 'left', border: '1px solid #e2e8f0' }}>
                  <div><strong>Transaction ID:</strong> {paymentSuccessData.reference}</div>
                  <div><strong>Gateway:</strong> {paymentSuccessData.paymentMethod} ({paymentSuccessData.mobileNumber || 'N/A'})</div>
                  <div><strong>Status:</strong> <span style={{ color: '#a16207', fontWeight: 700 }}>Pending Approval</span></div>
                  <div><strong>Date:</strong> {paymentSuccessData.timestamp ? new Date(paymentSuccessData.timestamp).toLocaleString() : 'N/A'}</div>
                </div>
                <button
                  onClick={() => setShowPayModal(false)}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                >
                  Close & View Status
                </button>
              </div>
            ) : (
              <form onSubmit={handleProcessOnlinePayment}>
                {paymentError && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#991b1b', fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
                    {paymentError}
                  </div>
                )}

                {/* Gateway Selection */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6, color: '#475569' }}>Select Payment Gateway</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 8 }}>
                    {['bKash', 'Nagad', 'Rocket', 'Card'].map(gw => (
                      <button
                        key={gw}
                        type="button"
                        onClick={() => setSelectedGateway(gw)}
                        style={{
                          padding: '10px 4px',
                          borderRadius: 10,
                          border: selectedGateway === gw ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          background: selectedGateway === gw ? '#eff6ff' : '#ffffff',
                          color: selectedGateway === gw ? '#1d4ed8' : '#475569',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        {gw}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount Field */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4, color: '#475569' }}>Amount to Pay (BDT ৳)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 16, fontWeight: 800 }}
                  />
                </div>

                {/* Mobile / Account Number */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4, color: '#475569' }}>{selectedGateway} Sender Account Number</label>
                  <input
                    type="text"
                    required
                    placeholder="017XXXXXXXX"
                    value={mobileNumber}
                    onChange={e => setMobileNumber(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>

                {/* Transaction ID Input */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4, color: '#475569' }}>
                    Transaction ID (Txn Hash / TrxID) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9B7XA21109"
                    value={transactionRef}
                    onChange={e => setTransactionRef(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontFamily: 'monospace', textTransform: 'uppercase' }}
                  />
                  <span style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 4 }}>
                    Enter the transaction ID received from your mobile banking app or SMS.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 10,
                    background: isProcessing ? '#94a3b8' : '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: isProcessing ? 'wait' : 'pointer',
                  }}
                >
                  {isProcessing ? 'Submitting Transaction...' : `Submit Transaction ID (${safeFormatBDT(paymentAmount)})`}
                </button>
              </form>
            )}

          </div>
        </div>
      )}

      {/* DIGITAL RECEIPT VIEW MODAL */}
      {receiptTxn && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 480, padding: 24, boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', pb: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Digital Fee Money Receipt</h3>
                <div style={{ fontSize: 12, color: '#64748b' }}>{branchInfo.name || 'School Branch'}</div>
              </div>
              <button onClick={() => setReceiptTxn(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <CloseIcon />
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px dashed #cbd5e1', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Transaction ID:</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{receiptTxn.reference || receiptTxn.txnId || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Student Name:</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{studentName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Class & Roll:</span>
                <span style={{ fontSize: 13, color: '#334155' }}>{className} · Roll #{currentStudent?.roll || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Payment Method:</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#2563eb' }}>{receiptTxn.paymentMethod} {receiptTxn.reference ? `(${receiptTxn.reference})` : ''}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Date & Time:</span>
                <span style={{ fontSize: 12, color: '#334155' }}>{receiptTxn.timestamp ? new Date(receiptTxn.timestamp).toLocaleString() : 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Amount Paid:</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: '#16a34a' }}>{safeFormatBDT(receiptTxn.amountPaid)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => window.print()}
                style={{ padding: '8px 16px', borderRadius: 8, background: '#2563eb', color: '#ffffff', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <ReceiptIcon /> Print Receipt
              </button>
              <button
                onClick={() => setReceiptTxn(null)}
                style={{ padding: '8px 16px', borderRadius: 8, background: '#e2e8f0', color: '#334155', border: 'none', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
