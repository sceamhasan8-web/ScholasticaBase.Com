import { useContext } from 'react';
import { AlertContext } from '../context/AlertContext.jsx';

export function useAlert() {
  const context = useContext(AlertContext);

  if (!context || !context.showAlert) {
    console.warn('[AlertContext] useAlert was called outside of AlertProvider. Falling back to default.');
    const fallback = (msg) => {
      if (typeof window !== 'undefined') {
        window.alert(msg);
      }
      return Promise.resolve();
    };
    return {
      showAlert: fallback,
      alert: fallback,
    };
  }

  return {
    showAlert: context.showAlert,
    alert: context.showAlert,
  };
}

export default useAlert;
