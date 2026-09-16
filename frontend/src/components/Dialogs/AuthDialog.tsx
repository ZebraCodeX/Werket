import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { closeAuthDialog, setAuthMode } from '../../store/uiSlice';
import { loginUser, registerUser, clearError } from '../../store/authSlice';

/**
 * In-app sign in / sign up. Required by the packaged apps which use token
 * auth and can't rely on the server-rendered Django login pages.
 */
export function AuthDialog() {
  const dispatch = useDispatch<AppDispatch>();
  const { authDialogOpen, authMode } = useSelector((state: RootState) => state.ui);
  const { user, loading, error } = useSelector((state: RootState) => state.auth);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (user) dispatch(closeAuthDialog());
  }, [user, dispatch]);

  useEffect(() => {
    if (!authDialogOpen) {
      setPassword('');
      dispatch(clearError());
    }
  }, [authDialogOpen, dispatch]);

  if (!authDialogOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'signup') {
      await dispatch(registerUser({ name, email, password }) as unknown as never);
    } else {
      await dispatch(loginUser({ email, password }) as unknown as never);
    }
  };

  return (
    <div className="auth-overlay" onClick={() => dispatch(closeAuthDialog())}>
      <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Account" onClick={e => e.stopPropagation()}>
        <div className="auth-modal-header">
          <div className="auth-modal-tabs">
            <button
              className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => dispatch(setAuthMode('login'))}
            >Sign In</button>
            <button
              className={`auth-tab ${authMode === 'signup' ? 'active' : ''}`}
              onClick={() => dispatch(setAuthMode('signup'))}
            >Sign Up</button>
          </div>
          <button className="auth-close" onClick={() => dispatch(closeAuthDialog())} aria-label="Close">×</button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {authMode === 'signup' && (
            <label className="auth-field">
              <span>Name</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
            </label>
          )}
          <label className="auth-field">
            <span>Email</span>
            <input
              type="email" required value={email} autoComplete="email"
              onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
            />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input
              type="password" required minLength={4} value={password}
              autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••"
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
          <p className="auth-note">
            Signing in is optional — documents are saved on this device and sync when you're signed in and online.
          </p>
        </form>
      </div>
    </div>
  );
}

export default AuthDialog;
