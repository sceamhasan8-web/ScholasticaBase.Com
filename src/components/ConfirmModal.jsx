import React, { useEffect, useRef } from 'react';

export default function ConfirmModal({
  isOpen,
  title = 'Delete Confirmation?',
  message = 'Are you sure you want to delete this item? This action cannot be undone.',
  confirmText = 'OK, Delete',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}) {
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Focus confirm button when opened
      setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 50);

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          onCancel?.();
        } else if (e.key === 'Enter') {
          onConfirm?.();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div className="confirm-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <div className="confirm-modal-icon-badge" aria-hidden="true">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h3 className="confirm-modal-title">{title}</h3>
        </div>

        <p className="confirm-modal-message">{message}</p>

        <div className="confirm-modal-actions">
          <button
            type="button"
            className="confirm-modal-btn-cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            ref={confirmBtnRef}
            className="confirm-modal-btn-confirm"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
