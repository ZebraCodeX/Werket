export {};

declare global {
  interface Window {
    werketDesktop?: {
      platform: 'desktop';
      version: string;
      openProject(): Promise<string | null>;
      saveProject(json: string): Promise<boolean>;
      openTextFile(): Promise<{ name: string; text: string } | null>;
      saveTextFile(defaultName: string, text: string): Promise<boolean>;
      onMenu(callback: (command: string, payload?: unknown) => void): () => void;
    };
  }
}
