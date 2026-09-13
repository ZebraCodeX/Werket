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
}

export interface WorkspaceState {
  projectName: string;
  files: File[];
  openIds: string[];
  activeId: string | null;
  font: string;
  size: number;
  align: 'left' | 'center' | 'right' | 'justify';
  lang: 'am' | 'en';
}

export interface WorkspaceData {
  projectName: string;
  files: File[];
  openIds: string[];
  activeId: string | null;
  font: string;
  size: number;
  align: 'left' | 'center' | 'right' | 'justify';
  lang: 'am' | 'en';
}