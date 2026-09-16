/**
 * Desktop (Electron) bridge. All functions degrade to no-ops on the web.
 */
type MenuCommand =
  | 'new'
  | 'open-project'
  | 'open-file'
  | 'save-project'
  | 'save-markdown'
  | 'export'
  | 'print'
  | 'find';

function bridge() {
  return typeof window !== 'undefined' ? window.werketDesktop : undefined;
}

export function isDesktop(): boolean {
  return Boolean(bridge());
}

export function onDesktopMenu(
  callback: (command: MenuCommand, payload?: unknown) => void,
): () => void {
  const api = bridge();
  if (!api) return () => {};
  return api.onMenu((command, payload) => callback(command as MenuCommand, payload));
}

export async function openProjectFile(): Promise<string | null> {
  const api = bridge();
  return api ? api.openProject() : null;
}

export async function saveProjectFile(json: string): Promise<boolean> {
  const api = bridge();
  return api ? api.saveProject(json) : false;
}

export async function openTextFile(): Promise<{ name: string; text: string } | null> {
  const api = bridge();
  return api ? api.openTextFile() : null;
}

export async function saveTextFile(name: string, text: string): Promise<boolean> {
  const api = bridge();
  return api ? api.saveTextFile(name, text) : false;
}
