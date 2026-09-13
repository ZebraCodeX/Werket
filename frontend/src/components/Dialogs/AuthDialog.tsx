import React, { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { closeAuthDialog, setAuthMode } from '../../store/uiSlice';
import { loginUser, registerUser } from '../../store/authSlice';

export const AuthDialog: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user, loading, error, mode } = useSelector((state: RootState) => state.auth);
  const { authDialogOpen, authMode } = useSelector((state: RootState) => state.ui);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

  if (!authDialogOpen) return null;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'signup') {
      await dispatch(registerUser(formData)).unwrap();
    } else {
      await dispatch(loginUser({ email: formData.email, password: formData.password })).unwrap();
    }
    dispatch(closeAuthDialog());
    setFormData({ name: '', email: '', password: '' });
  }, [authMode, dispatch, formData]);

  const handleSwitch = useCallback(() => {
    dispatch(setAuthMode(authMode === 'login' ? 'signup' : 'login'));
    setFormData({ name: '', email: '', password: '' });
  }, [authMode, dispatch]);

  return (
    <dialog id="authDialog" className="auth-dialog" open={authDialogOpen} onClose={() => dispatch(closeAuthDialog())}>
      <form className="auth-panel" onSubmit={handleSubmit}>
        <div className="auth-header">
          <svg className="brand-mark" viewBox="0 0 512 512" width="40" height="40" aria-hidden="true">
            <defs>
              <linearGradient id="lionGradSmall" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#f5d06e', stopOpacity: 1 }} />
                <stop offset="50%" style={{ stopColor: '#e8b84d', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#d4a03a', stopOpacity: 1 }} />
              </linearGradient>
              <linearGradient id="maneGradSmall" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#c4741e', stopOpacity: 1 }} />
                <stop offset="50%" style={{ stopColor: '#a85d18', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#8b4513', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <path fill="url(#maneGradSmall)" d="M140 120 Q100 100 80 140 Q60 180 100 220 Q140 260 180 260 Q220 260 260 220 Q300 180 280 140 Q260 100 220 120 Q180 140 140 120 Z"/>
            <ellipse cx="256" cy="200" rx="110" ry="100" fill="url(#lionGradSmall)"/>
            <path fill="url(#maneGradSmall)" d="M160 140 Q120 120 100 160 Q80 200 120 240 Q160 280 200 280 Q240 280 280 240 Q320 200 300 160 Q280 120 240 140 Q200 160 160 140 Z"/>
            <ellipse cx="150" cy="110" rx="25" ry="35" fill="url(#lionGradSmall)" transform="rotate(-20 150 110)"/>
            <ellipse cx="362" cy="110" rx="25" ry="35" fill="url(#lionGradSmall)" transform="rotate(20 362 110)"/>
            <ellipse cx="200" cy="180" rx="18" ry="22" fill="#fff"/>
            <ellipse cx="200" cy="180" rx="8" ry="10" fill="#1a1a2e"/>
            <ellipse cx="312" cy="180" rx="18" ry="22" fill="#fff"/>
            <ellipse cx="312" cy="180" rx="8" ry="10" fill="#1a1a2e"/>
            <ellipse cx="256" cy="210" rx="20" ry="16" fill="#2d1810"/>
            <path fill="#1a0f08" d="M256 225 Q240 240 230 265 Q240 290 256 310 Q272 290 282 265 Q272 240 256 225 Z"/>
            <ellipse cx="256" cy="275" rx="15" ry="12" fill="#c0392b"/>
            <path fill="none" stroke="#f5d06e" strokeWidth="2" strokeDasharray="8,4" d="M256 70 Q200 80 180 130 Q160 180 200 220 Q240 260 256 280"/>
            <circle cx="256" cy="70" r="6" fill="#f5d06e"/>
          </svg>
          <div>
            <b id="authTitle">{authMode === 'signup' ? 'Create your account' : 'Sign in to Werket'}</b>
            <span className="auth-sub">Save your work across devices</span>
          </div>
          <button id="closeAuth" className="auth-close" onClick={() => dispatch(closeAuthDialog())}>×</button>
        </div>
        <div className="auth-form">
          {authMode === 'signup' && (
            <div id="authNameField" className="auth-field">
              <label htmlFor="authName">Name</label>
              <input
                id="authName"
                type="text"
                placeholder="Your name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                autoComplete="name"
              />
            </div>
          )}
          <div className="auth-field">
            <label htmlFor="authEmail">Email</label>
            <input
              id="authEmail"
              type="email"
              placeholder="you@example.com"
              required
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              autoComplete="email"
            />
          </div>
          <div className="auth-field">
            <label htmlFor="authPassword">Password</label>
            <input
              id="authPassword"
              type="password"
              placeholder="4+ characters"
              required
              minLength={4}
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          {error && (
            <div id="authError" className="auth-error">
              {error}
            </div>
          )}
          <button type="submit" className="auth-submit" id="authSubmitBtn" disabled={loading}>
            {authMode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </div>
        <div className="auth-switch">
          <span id="authSwitchText">
            {authMode === 'signup' ? 'Already have an account?' : "Don't have an account?"}
          </span>
          <button id="authSwitchBtn" type="button" onClick={handleSwitch}>
            {authMode === 'signup' ? 'Sign in' : 'Create one'}
          </button>
        </div>
        <div className="auth-local">
          <button id="authStayLocal" type="button" onClick={() => dispatch(closeAuthDialog())}>
            Continue without account
          </button>
        </div>
      </form>
    </dialog>
  );
};

export default AuthDialog;