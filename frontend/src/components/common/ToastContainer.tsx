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
    <div className="toast-container" style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      pointerEvents: 'none',
    }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          style={{
            padding: '12px 20px',
            borderRadius: '8px',
            background: toast.type === 'error' ? 'var(--danger)' :
              toast.type === 'success' ? 'var(--success)' :
              toast.type === 'warning' ? 'var(--warning)' : 'var(--accent)',
            color: 'white',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: 'var(--shadow-lg)',
            animation: 'slideIn 0.3s ease',
            pointerEvents: 'auto',
            cursor: 'pointer',
            maxWidth: '300px',
          }}
          onClick={() => dispatch(removeToast(toast.id))}
        >
          {toast.message}
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ToastContainer;