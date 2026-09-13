export interface EditorSelection {
  start: number;
  end: number;
}

export interface UndoEntry {
  html: string;
  selection: EditorSelection;
  timestamp: number;
}

export interface EditorState {
  content: string;
  html: string;
  selection: EditorSelection;
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
  applyingHistory: boolean;
}

export interface ParagraphStyle {
  value: 'body' | 'heading1' | 'heading2' | 'heading3' | 'title' | 'subtitle' | 'caption' | 'code' | 'blockquote';
  label: string;
}

export interface FontOption {
  value: string;
  label: string;
}