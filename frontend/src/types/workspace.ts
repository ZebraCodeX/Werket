export interface File {
  id: string;
  name: string;
  text: string;
  folder: string;
  lang: 'am' | 'en';
  updated: number;
  font?: string;
  size?: number;
  align?: 'left' | 'center' | 'right' | 'justify';
  originalFolder?: string;
}

export interface DeletedFile extends File {
  deletedAt: number;
}

export interface WorkspaceState {
  projectName: string;
  files: File[];
  deletedFiles: DeletedFile[];
  openIds: string[];
  activeId: string | null;
  font: string;
  size: number;
  align: 'left' | 'center' | 'right' | 'justify';
  lang: 'am' | 'en';
  // UI state
  loading: boolean;
  saving: boolean;
  lastSynced: number | null;
  syncError: string | null;
}

export interface WorkspaceData {
  projectName: string;
  files: File[];
  deletedFiles: DeletedFile[];
  openIds: string[];
  activeId: string | null;
  font: string;
  size: number;
  align: 'left' | 'center' | 'right' | 'justify';
  lang: 'am' | 'en';
}