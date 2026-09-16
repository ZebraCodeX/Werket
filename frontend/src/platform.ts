/**
 * Build/runtime platform flags.
 *
 * The web build uses Django session cookies; the packaged desktop/mobile
 * builds are built with `VITE_AUTH_MODE=token` and an absolute `VITE_API_BASE`
 * so they can authenticate cross-origin without relying on cookies.
 */
export const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export const AUTH_MODE: 'session' | 'token' =
  (import.meta.env.VITE_AUTH_MODE as 'session' | 'token') || 'session';

export const isTokenAuth = AUTH_MODE === 'token';

export const AUTH_TOKEN_KEY = 'werket-token';
