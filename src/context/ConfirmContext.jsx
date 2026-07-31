import React, { createContext, useState, useRef, useCallback } from 'react';
import ConfirmModal from '../components/ConfirmModal.jsx';

export const ConfirmContext = createContext({
  confirm: () => Promise.resolve(false),
});

export function ConfirmProvider({ children }) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: 'Delete Confirmation?',
    message: 'Are you sure you want to delete this item?',
    confirmText: 'OK, Delete',
    cancelText: 'Cancel',
  });

  const resolverRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;

      if (typeof options === 'string') {
        setModalState({
          isOpen: true,
          title: 'Delete Confirmation?',
          message: options,
          confirmText: 'OK, Delete',
          cancelText: 'Cancel',
        });
      } else if (options && typeof options === 'object') {
        setModalState({
          isOpen: true,
          title: options.title || 'Delete Confirmation?',
          message: options.message || 'Are you sure you want to proceed?',
          confirmText: options.confirmText || 'OK, Delete',
          cancelText: options.cancelText || 'Cancel',
        });
      } else {
        setModalState({
          isOpen: true,
          title: 'Delete Confirmation?',
          message: 'Are you sure you want to delete this item?',
          confirmText: 'OK, Delete',
          cancelText: 'Cancel',
        });
      }
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}
