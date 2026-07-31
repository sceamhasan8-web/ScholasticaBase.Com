import React, { useState, useEffect, useMemo } from 'react';
import {
  getAllTransactions,
  approveTransaction,
  rejectTransaction,
  formatBDT,
  subscribeToFeeUpdates,
  TRANSACTION_STATUS,
} from '../utils/feeResolver.js';

export default function PrincipalFeeApprovals({ currentUser }) {
  const [transactions, setTransactions] = useState([]);
  const [filterStatus, setFilterStatus] = useState('Pending');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Rejection modal state
  const [rejectingTxn, setRejectingTxn] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('Invalid Transaction ID / Verification Failed');
  const [actionFeedback, setActionFeedback] = useState(null);

  const refreshData = () => {
    setTransactions(getAllTransactions());
  };

  useEffect(() => {
    refreshData();
    const unsub = subscribeToFeeUpdates(() => {
      refreshData();
    });
    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    const pending = transactions.filter(t => t.status === TRANSACTION_STATUS.PENDING);
    const approved = transactions.filter(t => t.status === TRANSACTION_STATUS.APPROVED);
    const rejected = transactions.filter(t => t.status === TRANSACTION_STATUS.REJECTED);

    const pendingAmount = pending.reduce((sum, t) => sum + (t.amountPaid || 0), 0);
    const approvedAmount = approved.reduce((sum, t) => sum + (t.amountPaid || 0), 0);

    return {
      pendingCount: pending.length,
      pendingAmount,
      approvedCount: approved.length,
      approvedAmount,
      rejectedCount: rejected.length,
      totalSubmissions: transactions.length,
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    let list = transactions;

    if (filterStatus !== 'All') {
      list = list.filter(t => (t.status || TRANSACTION_STATUS.APPROVED) === filterStatus);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t =>
        (t.studentName || '').toLowerCase().includes(q) ||
        (t.studentId || '').toLowerCase().includes(q) ||
        (t.reference || t.txnId || '').toLowerCase().includes(q) ||
        (t.paymentMethod || '').toLowerCase().includes(q) ||
        (t.mobileNumber || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [transactions, filterStatus, searchQuery]);

  const handleApprove = (txnId) => {
    const res = approveTransaction(txnId, currentUser?.name || 'Principal');
    if (res.success) {
      setActionFeedback({ type: 'success', text: res.message });
      setTimeout(() => setActionFeedback(null), 3500);
      refreshData();
    } else {
      setActionFeedback({ type: 'error', text: res.message });
    }
  };

  const handleConfirmReject = (e) => {
    e.preventDefault();
    if (!rejectingTxn) return;

    const res = rejectTransaction(rejectingTxn.txnId, rejectionReason, currentUser?.name || 'Principal');
    setRejectingTxn(null);
    if (res.success) {
      setActionFeedback({ type: 'success', text: res.message });
      setTimeout(() => setActionFeedback(null), 3500);
      refreshData();
    } else {
      setActionFeedback({ type: 'error', text: res.message });
    }
  };

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif', color: '#1e293b' }}>
      
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
        borderRadius: 20,
        padding: '24px 28px',
        color: '#ffffff',
        marginBottom: 24,
        boxShadow: '0 10px 25px rgba(49, 46, 129, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 26 }}>💳</span>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Transaction ID Approval Center</h2>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#c7d2fe' }}>
            Review, verify, and approve student offline/online transaction ID submissions.
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)' }}>
            <div style={{ fontSize: 11, color: '#fef08a', fontWeight: 700, textTransform: 'uppercase' }}>Pending Approvals</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fef08a' }}>{stats.pendingCount} ({formatBDT(stats.pendingAmount)})</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)' }}>
            <div style={{ fontSize: 11, color: '#86efac', fontWeight: 700, textTransform: 'uppercase' }}>Approved Total</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#86efac' }}>{stats.approvedCount} ({formatBDT(stats.approvedAmount)})</div>
          </div>
        </div>
      </div>

      {/* Action feedback alert */}
      {actionFeedback && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 12,
          marginBottom: 20,
          background: actionFeedback.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: actionFeedback.type === 'success' ? '#15803d' : '#991b1b',
          border: `1px solid ${actionFeedback.type === 'success' ? '#86efac' : '#fca5a5'}`,
          fontSize: 14,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span>{actionFeedback.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{actionFeedback.text}</span>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', gap: 8, background: '#f1f5f9', padding: 4, borderRadius: 12 }}>
          {['Pending', 'Approved', 'Rejected', 'All'].map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: filterStatus === st ? '#ffffff' : 'transparent',
                color: filterStatus === st ? '#0f172a' : '#64748b',
                fontWeight: filterStatus === st ? 800 : 600,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: filterStatus === st ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {st === 'Pending' && stats.pendingCount > 0 && (
                <span style={{ background: '#eab308', color: '#fff', fontSize: 11, padding: '2px 7px', borderRadius: 10 }}>{stats.pendingCount}</span>
              )}
              {st}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search by Student Name, ID, Txn ID, Phone..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            padding: '10px 16px',
            borderRadius: 12,
            border: '1px solid #cbd5e1',
            width: 320,
            fontSize: 13,
            outline: 'none',
          }}
        />
      </div>

      {/* Transactions Table / List */}
      <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        {filteredTransactions.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#475569' }}>No transaction ID submissions found</div>
            <div style={{ fontSize: 13 }}>{filterStatus === 'Pending' ? 'All student payment submissions have been reviewed!' : 'Try adjusting your search query or filters.'}</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.03em' }}>
                  <th style={{ padding: '14px 18px' }}>Submitted Date</th>
                  <th style={{ padding: '14px 18px' }}>Student Details</th>
                  <th style={{ padding: '14px 18px' }}>Transaction ID (Submitted)</th>
                  <th style={{ padding: '14px 18px' }}>Gateway & Sender</th>
                  <th style={{ padding: '14px 18px' }}>Amount (BDT)</th>
                  <th style={{ padding: '14px 18px' }}>Status</th>
                  <th style={{ padding: '14px 18px', textAlign: 'center' }}>Approval Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map(tx => {
                  const txStatus = tx.status || TRANSACTION_STATUS.APPROVED;
                  const isPending = txStatus === TRANSACTION_STATUS.PENDING;

                  return (
                    <tr key={tx.txnId} style={{ borderBottom: '1px solid #f1f5f9', background: isPending ? '#fefce8' : '#ffffff' }}>
                      <td style={{ padding: '14px 18px', fontSize: 12, color: '#475569' }}>
                        {new Date(tx.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>{tx.studentName || 'Student'}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          ID: <span style={{ fontWeight: 700 }}>{tx.studentId}</span> {tx.className ? `· ${tx.className}` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: 8, display: 'inline-block' }}>
                          {tx.reference || tx.txnId}
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px', fontSize: 13 }}>
                        <div style={{ fontWeight: 700, color: '#334155' }}>{tx.paymentMethod}</div>
                        {tx.mobileNumber && <div style={{ fontSize: 12, color: '#64748b' }}>📱 {tx.mobileNumber}</div>}
                      </td>
                      <td style={{ padding: '14px 18px', fontSize: 15, fontWeight: 800, color: '#16a34a' }}>
                        {formatBDT(tx.amountPaid)}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {isPending && (
                          <span style={{ padding: '4px 10px', borderRadius: 20, background: '#fef9c3', color: '#a16207', border: '1px solid #fde047', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            ⏳ Pending
                          </span>
                        )}
                        {txStatus === TRANSACTION_STATUS.APPROVED && (
                          <span style={{ padding: '4px 10px', borderRadius: 20, background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            ✓ Approved
                          </span>
                        )}
                        {txStatus === TRANSACTION_STATUS.REJECTED && (
                          <div>
                            <span style={{ padding: '4px 10px', borderRadius: 20, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              ❌ Rejected
                            </span>
                            {tx.rejectionReason && (
                              <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{tx.rejectionReason}</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        {isPending ? (
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                            <button
                              onClick={() => handleApprove(tx.txnId)}
                              style={{
                                padding: '8px 14px',
                                borderRadius: 8,
                                background: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                fontWeight: 800,
                                fontSize: 12,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)',
                              }}
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={() => {
                                setRejectingTxn(tx);
                                setRejectionReason('Invalid Transaction ID / Verification Failed');
                              }}
                              style={{
                                padding: '8px 14px',
                                borderRadius: 8,
                                background: '#dc2626',
                                color: '#ffffff',
                                border: 'none',
                                fontWeight: 800,
                                fontSize: 12,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                              }}
                            >
                              ❌ Reject
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            {txStatus === TRANSACTION_STATUS.APPROVED ? (
                              <span>Approved by <strong>{tx.approvedBy || 'Principal'}</strong></span>
                            ) : (
                              <span>Rejected by <strong>{tx.rejectedBy || 'Principal'}</strong></span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {rejectingTxn && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, maxWidth: 440, width: '100%', padding: 24, boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 18, fontWeight: 800, color: '#991b1b' }}>
              Reject Submitted Transaction ID
            </h3>
            <p style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
              Rejecting transaction <strong>{rejectingTxn.reference}</strong> for student <strong>{rejectingTxn.studentName}</strong> ({formatBDT(rejectingTxn.amountPaid)}). The student will be notified to resubmit.
            </p>

            <form onSubmit={handleConfirmReject}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                Reason for Rejection:
              </label>
              <select
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 12 }}
              >
                <option value="Invalid Transaction ID / Verification Failed">Invalid Transaction ID / Verification Failed</option>
                <option value="Transaction ID not found in bank statement">Transaction ID not found in bank statement</option>
                <option value="Payment amount does not match submitted amount">Payment amount does not match submitted amount</option>
                <option value="Duplicate Transaction ID submission">Duplicate Transaction ID submission</option>
                <option value="Other">Custom Reason (Type below)</option>
              </select>

              {rejectionReason === 'Other' && (
                <input
                  type="text"
                  required
                  placeholder="Enter rejection reason..."
                  onChange={e => setRejectionReason(e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 14 }}
                />
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setRejectingTxn(null)}
                  style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
