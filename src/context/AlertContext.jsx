import React, { createContext, useState, useRef, useCallback, useEffect } from 'react';
import AlertModal from '../components/AlertModal.jsx';

export const AlertContext = createContext({
  showAlert: () => Promise.resolve(),
});

export function AlertProvider({ children }) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    buttonText: 'OK',
  });

  const resolverRef = useRef(null);

  const showAlert = useCallback((messageOrOptions, titleArg, typeArg) => {
    return new Promise((resolve) => {
      // If there was a pending alert, resolve it first
      if (resolverRef.current) {
        resolverRef.current();
      }
      resolverRef.current = resolve;

      if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
        setModalState({
          isOpen: true,
          title: messageOrOptions.title || '',
          message: messageOrOptions.message || '',
          type: messageOrOptions.type || 'warning',
          buttonText: messageOrOptions.buttonText || 'OK',
        });
      } else {
        const msgStr = String(messageOrOptions || '');
        // Infer type if message starts with ❌ or ✅ or ⚠️
        let inferredType = typeArg || 'warning';
        if (!typeArg) {
          if (msgStr.includes('❌') || msgStr.toLowerCase().includes('failed') || msgStr.toLowerCase().includes('error')) {
            inferredType = 'error';
          } else if (msgStr.includes('✅') || msgStr.toLowerCase().includes('success')) {
            inferredType = 'success';
          }
        }

        setModalState({
          isOpen: true,
          title: titleArg || '',
          message: msgStr,
          type: inferredType,
          buttonText: 'OK',
        });
      }
    });
  }, []);

  const handleClose = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current();
      resolverRef.current = null;
    }
  }, []);

  // Safely override global window.alert so native browser alert popups never appear
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const originalNativeAlert = window.alert;
      window.alert = (msg) => {
        showAlert(msg);
      };

      return () => {
        window.alert = originalNativeAlert;
      };
    }
  }, [showAlert]);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <AlertModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        buttonText={modalState.buttonText}
        onClose={handleClose}
      />
    </AlertContext.Provider>
  );
}

export default AlertProvider;
