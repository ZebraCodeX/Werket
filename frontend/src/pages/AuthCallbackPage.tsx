import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';
import { checkSession } from '../store/authSlice';

export function AuthCallbackPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') || '/';

  useEffect(() => {
    // Check session after OAuth callback
    dispatch(checkSession()).then(() => {
      navigate(next, { replace: true });
    });
  }, [dispatch, navigate, next]);

  return (
    <div className="auth-callback">
      <div className="auth-callback-spinner" aria-label="Completing sign in..." />
      <p>{'Completing sign in...'}</p>
    </div>
  );
}