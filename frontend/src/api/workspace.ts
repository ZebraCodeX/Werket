import { apiClient } from './client';
import type { WorkspaceData } from '../types/workspace';

export const workspaceApi = {
  async get(): Promise<{ data: WorkspaceData }> {
    const response = await apiClient.get<WorkspaceData>('/workspace/');
    return response;
  },

  async save(data: WorkspaceData): Promise<void> {
    await apiClient.put('/workspace/', data);
  },
};