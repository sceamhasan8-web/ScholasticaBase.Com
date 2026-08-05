import { useContext } from 'react';
import { ConfirmContext } from '../context/ConfirmContext.jsx';

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context || !context.confirm) {
    return (options) => {
      const msg = typeof options === 'string' ? options : (options?.message || options?.title || 'Are you sure you want to proceed?');
      return Promise.resolve(typeof window !== 'undefined' ? window.confirm(msg) : true);
    };
  }
  return context.confirm;
}

export default useConfirm;

