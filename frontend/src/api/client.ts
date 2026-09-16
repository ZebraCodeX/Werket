import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE, AUTH_TOKEN_KEY, isTokenAuth } from '../platform';

const createClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE,
    // Token auth doesn't need cross-origin cookies (and avoiding them keeps
    // CORS simple in native WebViews).
    withCredentials: !isTokenAuth,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      if (isTokenAuth) {
        const token = tokenStore.get();
        if (token) config.headers['Authorization'] = `Token ${token}`;
      } else {
        const csrfToken = getCsrfToken();
        if (csrfToken && config.method !== 'get') {
          config.headers['X-CSRFToken'] = csrfToken;
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
      return Promise.reject(error);
    }
  );

  return client;
};

function getCsrfToken(): string | null {
  const name = 'csrftoken';
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === name) return value;
  }
  return null;
}

/** Token storage for the packaged apps. */
export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

const client = createClient();

export const apiClient = {
  get: client.get.bind(client),
  post: client.post.bind(client),
  put: client.put.bind(client),
  patch: client.patch.bind(client),
  delete: client.delete.bind(client),
  async getCsrfTokenFromServer(): Promise<string> {
    if (isTokenAuth) return '';
    const response = await client.get('/csrf/');
    return response.data.csrfToken;
  },
};
