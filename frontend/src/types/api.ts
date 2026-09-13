import type { WorkspaceData } from './workspace';

export interface User {
  name: string;
  email: string;
}

export interface AuthResponse {
  user: User | null;
  error?: string;
}

export interface WorkspaceResponse {
  id: number;
  user: User;
  data: WorkspaceData;
  updated_at: string;
}

export interface SuggestionResponse {
  words: string[];
  next: string[];
  dictionary_size: number;
}

export interface CheckWordResponse {
  word: string;
  start: number;
  end: number;
  known: boolean;
  suggestions: SuggestionItem[];
}

export interface CheckResponse {
  text: string;
  words: CheckWordResponse[];
}

export interface SuggestionItem {
  word: string;
  distance: number;
  frequency: number;
}