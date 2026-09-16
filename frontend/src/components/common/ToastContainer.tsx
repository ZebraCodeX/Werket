import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { removeToast } from '../../store/uiSlice';

export const ToastContainer: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { toasts } = useSelector((state: RootState) => state.ui);

  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        dispatch(removeToast(toasts[0].id));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toasts, dispatch]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast ${toast.type}`}
          onClick={() => dispatch(removeToast(toast.id))}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;