/**
 * Offline workspace persistence.
 *
 * The workspace is the single source of truth for documents and lives in
 * IndexedDB (with a localStorage mirror for instant first paint and as a
 * fallback). Saves are debounced so typing doesn't hammer the database.
 */
import { idbAvailable, idbGet, idbSet } from './idb';
import type { WorkspaceData } from '../types/workspace';

export const WORKSPACE_KEY = 'werket-workspace-v2';
const IDB_KEY = 'workspace';
const DEBOUNCE_MS = 300;

export function snapshotWorkspace(workspace: WorkspaceData): WorkspaceData {
  return {
    projectName: workspace.projectName,
    files: workspace.files,
    deletedFiles: workspace.deletedFiles,
    openIds: workspace.openIds,
    activeId: workspace.activeId,
    font: workspace.font,
    size: workspace.size,
    align: workspace.align,
    lang: workspace.lang,
  };
}

export function readLocalMirror(): WorkspaceData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.files)) return parsed as WorkspaceData;
  } catch {
    /* ignore corrupt mirror */
  }
  return null;
}

function writeLocalMirror(data: WorkspaceData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(data));
  } catch {
    /* quota exceeded - IndexedDB is the real store */
  }
}

/** Load the persisted workspace, preferring IndexedDB and migrating the mirror. */
export async function loadWorkspace(): Promise<WorkspaceData | null> {
  try {
    const stored = await idbGet<WorkspaceData>(IDB_KEY);
    if (stored && Array.isArray(stored.files)) return stored;
  } catch {
    /* fall through to the mirror */
  }
  const mirror = readLocalMirror();
  if (mirror) {
    // First run after the IndexedDB migration.
    try {
      await idbSet(IDB_KEY, mirror);
    } catch {
      /* ignore */
    }
  }
  return mirror;
}

let pending: WorkspaceData | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> | null = null;

async function flush(): Promise<void> {
  const data = pending;
  pending = null;
  if (!data) return;
  try {
    await idbSet(IDB_KEY, data);
  } catch {
    /* IndexedDB write failed; the localStorage mirror still has it */
  }
}

/** Queue a debounced save of the workspace snapshot. */
export function saveWorkspace(data: WorkspaceData): void {
  writeLocalMirror(data);
  if (!idbAvailable()) return;
  pending = data;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    flushing = flush();
  }, DEBOUNCE_MS);
}

/** Flush any pending write immediately (used before unload). */
export async function flushWorkspace(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (flushing) await flushing;
  await flush();
}
