/**
 * `.wkt` project files: a single JSON document that carries the whole
 * workspace (files, folders, trash, preferences) for desktop open/save.
 */
import type { WorkspaceData } from '../types/workspace';

export const WKT_VERSION = 1;

export function exportWkt(workspace: WorkspaceData): string {
  return JSON.stringify(
    {
      app: 'werket',
      version: WKT_VERSION,
      savedAt: new Date().toISOString(),
      workspace,
    },
    null,
    2,
  );
}

export function parseWkt(text: string): WorkspaceData | null {
  try {
    const parsed = JSON.parse(text);
    const workspace = parsed && parsed.workspace ? parsed.workspace : parsed;
    if (workspace && Array.isArray(workspace.files)) {
      return workspace as WorkspaceData;
    }
  } catch {
    /* not a project file */
  }
  return null;
}
