// ─────────────────────────────────────────────────────────────
// SuperAdminSwitcher.jsx — Floating Role & View Mode Switcher
// ─────────────────────────────────────────────────────────────
// Allows Admin and Super Admin users to seamlessly switch between:
//   1. Admin Panel (🛡️)
//   2. Teacher Panel (👨‍🏫)
//   3. Student Panel (🎓)
//   4. Principal Panel (🏛️)
//   5. User Account Impersonation (visit any specific student/teacher account)
// ─────────────────────────────────────────────────────────────

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useViewMode, VIEW_MODES } from '../context/ViewModeContext.jsx';
import { getAllStudents, getAllTeachers, readStorage, LOCAL_STORAGE_KEYS } from '../utils/schoolData.js';
import '../super-admin.css';

const ACCENT_COLORS = ['#8b5cf6', '#2563eb', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

function getInitials(name) {
  if (!name) return 'U';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

export default function SuperAdminSwitcher() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    viewMode,
    setViewMode,
    impersonate,
    stopImpersonating,
    isImpersonating,
    impersonatedUser,
    canSwitch,
    isSuperAdmin,
  } = useViewMode();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Don't render floating window if user is not logged in or cannot switch view modes
  const currentUser = user || (typeof window !== 'undefined' ? JSON.parse(window.localStorage.getItem('schoolAppCurrentUser') || 'null') : null);
  const isAuthorized = canSwitch || isSuperAdmin || (currentUser && (currentUser.role === 'admin' || currentUser.isSuperAdmin || currentUser._realUser?.role === 'admin'));

  if (!currentUser || !isAuthorized) {
    return null;
  }

  // Active mode details
  const activeModeObj = VIEW_MODES.find((m) => m.key === viewMode) || VIEW_MODES[0];

  // Aggregate users for impersonation search (students, teachers, principals)
  const allAccounts = useMemo(() => {
    if (!isOpen) return [];
    try {
      const studentList = getAllStudents() || [];
      const teacherList = getAllTeachers() || [];
      const localUsersRaw = readStorage(LOCAL_STORAGE_KEYS.USERS, {}) || {};
      const localUserList = Array.isArray(localUsersRaw) ? localUsersRaw : Object.values(localUsersRaw);

      const combinedMap = new Map();

      // Add local user accounts (excluding admin/superadmin)
      localUserList.forEach((u) => {
        if (!u) return;
        const uid = String(u.userId || u.id || '').trim().toLowerCase();
        if (uid === 'super' || uid === 'siam' || uid === 'admin' || u.isSuperAdmin) return;
        combinedMap.set(uid || u.name, {
          userId: u.userId || u.id,
          name: u.name || 'User',
          role: u.role || 'student',
          classNum: u.classNum || u.className || '',
          roll: u.roll || '',
          subject: u.subject || u.designation || '',
        });
      });

      // Add students
      studentList.forEach((s) => {
        if (!s) return;
        const uid = String(s.id || s.userId || '').trim().toLowerCase();
        if (!uid) return;
        const existing = combinedMap.get(uid) || {};
        combinedMap.set(uid, {
          ...existing,
          userId: s.id || s.userId,
          name: s.name || existing.name || 'Student',
          role: 'student',
          classNum: s.classNum || s.className || existing.classNum || '',
          roll: s.roll || existing.roll || '',
        });
      });

      // Add teachers
      teacherList.forEach((t) => {
        if (!t) return;
        const uid = String(t.id || t.userId || t.email || '').trim().toLowerCase();
        if (!uid) return;
        const existing = combinedMap.get(uid) || {};
        combinedMap.set(uid, {
          ...existing,
          userId: t.id || t.userId,
          name: t.name || existing.name || 'Teacher',
          role: 'teacher',
          subject: t.subject || existing.subject || '',
        });
      });

      return Array.from(combinedMap.values());
    } catch {
      return [];
    }
  }, [isOpen]);

  // Filter accounts based on search query
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return allAccounts.slice(0, 10);
    const q = searchQuery.toLowerCase().trim();
    return allAccounts
      .filter((u) =>
        String(u.name || '').toLowerCase().includes(q) ||
        String(u.userId || '').toLowerCase().includes(q) ||
        String(u.role || '').toLowerCase().includes(q) ||
        String(u.classNum || '').toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [allAccounts, searchQuery]);

  const handlePanelSwitch = (modeKey) => {
    setViewMode(modeKey);
    setIsOpen(false);
    navigate(`/${modeKey}`);
  };

  const handleImpersonateUser = (userProfile) => {
    impersonate(userProfile);
    setIsOpen(false);
    const targetRole = String(userProfile.role || 'student').toLowerCase();
    navigate(`/${targetRole}`);
  };

  const handleStopImpersonating = () => {
    stopImpersonating();
    setViewMode('admin');
    setIsOpen(false);
    navigate('/admin');
  };

  return (
    <div className="sa-switcher" ref={dropdownRef}>
      {/* Impersonation Banner if active */}
      {isImpersonating && (
        <div className="sa-impersonating-banner" style={{ display: 'none' }}>
          <span>👀 Impersonating: <strong>{impersonatedUser?.name}</strong> ({impersonatedUser?.role})</span>
          <button type="button" onClick={handleStopImpersonating} className="sa-banner-btn">
            Exit
          </button>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        type="button"
        className="sa-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Admin View & Account Switcher Window"
      >
        <span
          className="sa-indicator-dot"
          style={{ backgroundColor: activeModeObj.color, color: activeModeObj.color }}
        />
        <span className="sa-toggle-icon">{isImpersonating ? '🕵️' : activeModeObj.icon}</span>
        <span className="sa-toggle-label">
          {isImpersonating ? impersonatedUser?.name : activeModeObj.label}
        </span>
        <span className={`sa-toggle-chevron ${isOpen ? 'sa-open' : ''}`}>▼</span>
      </button>

      {/* Dropdown Window */}
      <div className={`sa-dropdown ${isOpen ? 'sa-visible' : ''}`}>
        <div className="sa-dropdown-header">
          <p className="sa-dropdown-title">⚡ Admin Floating Switcher</p>
          <p className="sa-dropdown-subtitle">Visit any panel role or user account</p>
        </div>

        {/* Panel Switcher Buttons */}
        <div className="sa-panel-list">
          {VIEW_MODES.map((mode) => {
            const isActive = !isImpersonating && viewMode === mode.key;
            return (
              <button
                key={mode.key}
                type="button"
                className={`sa-panel-btn ${isActive ? 'sa-active' : ''}`}
                onClick={() => handlePanelSwitch(mode.key)}
              >
                <span className="sa-panel-icon">{mode.icon}</span>
                <span className="sa-panel-label">{mode.label}</span>
              </button>
            );
          })}
        </div>

        <div className="sa-divider" />

        {/* Impersonation & User Visit Section */}
        <div className="sa-impersonate-section">
          <p className="sa-impersonate-title">Visit Specific User Account</p>
          <input
            type="text"
            className="sa-impersonate-search"
            placeholder="Search student, teacher, principal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="sa-user-list">
            {isImpersonating && (
              <button
                type="button"
                className="sa-user-item"
                onClick={handleStopImpersonating}
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 600 }}
              >
                <span className="sa-user-avatar" style={{ backgroundColor: '#ef4444' }}>✕</span>
                <span className="sa-user-info">
                  <span className="sa-user-name">Stop Impersonating</span>
                  <span className="sa-user-role" style={{ color: '#fca5a5' }}>Return to Admin Panel</span>
                </span>
              </button>
            )}

            {filteredAccounts.length > 0 ? (
              filteredAccounts.map((acc, idx) => {
                const color = ACCENT_COLORS[idx % ACCENT_COLORS.length];
                const isCurrent = impersonatedUser?.userId === acc.userId;
                return (
                  <button
                    key={acc.userId || idx}
                    type="button"
                    className={`sa-user-item ${isCurrent ? 'sa-active' : ''}`}
                    onClick={() => handleImpersonateUser(acc)}
                  >
                    <span className="sa-user-avatar" style={{ backgroundColor: color }}>
                      {getInitials(acc.name)}
                    </span>
                    <span className="sa-user-info">
                      <span className="sa-user-name">{acc.name}</span>
                      <span className="sa-user-role">
                        {acc.role.toUpperCase()} {acc.classNum ? `• Class ${acc.classNum}` : ''} {acc.subject ? `• ${acc.subject}` : ''}
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div style={{ padding: '10px 8px', fontSize: 11.5, color: '#94a3b8', textAlign: 'center' }}>
                No matching accounts found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
