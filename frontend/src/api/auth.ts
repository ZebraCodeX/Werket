import { apiClient } from './client';
import type { User, AuthResponse } from '../types/api';

export const authApi = {
  async me(): Promise<{ data: AuthResponse }> {
    const response = await apiClient.get<AuthResponse>('/auth/me/');
    return response;
  },

  async login(credentials: { email: string; password: string }): Promise<{ data: AuthResponse }> {
    const response = await apiClient.post<AuthResponse>('/auth/login/', credentials);
    return response;
  },

  async register(data: { name: string; email: string; password: string }): Promise<{ data: AuthResponse }> {
    const response = await apiClient.post<AuthResponse>('/auth/register/', data);
    return response;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout/');
  },
};