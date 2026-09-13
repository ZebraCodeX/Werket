import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const createClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const csrfToken = getCsrfToken();
      if (csrfToken && config.method !== 'get') {
        config.headers['X-CSRFToken'] = csrfToken;
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

const client = createClient();

export const apiClient = {
  get: client.get.bind(client),
  post: client.post.bind(client),
  put: client.put.bind(client),
  patch: client.patch.bind(client),
  delete: client.delete.bind(client),
  async getCsrfTokenFromServer(): Promise<string> {
    const response = await client.get('/csrf/');
    return response.data.csrfToken;
  },
};