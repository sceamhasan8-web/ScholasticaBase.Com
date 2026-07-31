import React, { useEffect, useRef } from 'react';

export default function AlertModal({
  isOpen,
  title,
  message,
  type = 'warning', // 'warning' | 'error' | 'success' | 'info'
  buttonText = 'OK',
  onClose,
}) {
  const okBtnRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Focus the dismiss button when opened
      const timer = setTimeout(() => {
        okBtnRef.current?.focus();
      }, 50);

      const handleKeyDown = (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
          e.preventDefault();
          onClose?.();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Determine badge SVG icon based on type
  const renderIcon = () => {
    switch (type) {
      case 'error':
        return (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
      case 'success':
        return (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        );
      case 'info':
        return (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
      case 'warning':
      default:
        return (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
    }
  };

  const defaultTitles = {
    warning: 'Warning',
    error: 'Error',
    success: 'Success',
    info: 'Information',
  };

  const displayTitle = title || defaultTitles[type] || 'Notice';

  return (
    <div className="alert-modal-overlay" onClick={onClose}>
      <div className="alert-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="alert-modal-header">
          <div className={`alert-modal-icon-badge type-${type}`} aria-hidden="true">
            {renderIcon()}
          </div>
          <h3 className="alert-modal-title">{displayTitle}</h3>
        </div>

        <p className="alert-modal-message">{message}</p>

        <div className="alert-modal-actions">
          <button
            type="button"
            ref={okBtnRef}
            className={`alert-modal-btn-ok btn-${type}`}
            onClick={onClose}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
