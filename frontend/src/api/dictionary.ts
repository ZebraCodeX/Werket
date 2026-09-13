import { apiClient } from './client';
import type { SuggestionResponse, CheckResponse } from '../types/api';

export const dictionaryApi = {
  async suggest(text: string): Promise<{ data: SuggestionResponse }> {
    const response = await apiClient.get<SuggestionResponse>(`/dictionary/suggest/?text=${encodeURIComponent(text)}`);
    return response;
  },

  async check(text: string): Promise<{ data: CheckResponse }> {
    const response = await apiClient.get<CheckResponse>(`/dictionary/check/?text=${encodeURIComponent(text)}`);
    return response;
  },
};