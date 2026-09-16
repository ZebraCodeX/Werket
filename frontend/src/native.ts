/**
 * Native (Capacitor) integration.
 *
 * Everything here is a no-op on the web build; on Android it wires the
 * status bar, splash screen, hardware back button, and native share/save.
 */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

let initialized = false;

export async function initNative(): Promise<void> {
  if (initialized || !isNativePlatform()) return;
  initialized = true;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
  } catch { /* plugin unavailable */ }

  try {
    await SplashScreen.hide();
  } catch { /* plugin unavailable */ }

  try {
    await App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack && window.history.length > 1) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  } catch { /* plugin unavailable */ }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Save a file on a native device via the OS share/save sheet. */
export async function saveBlobNative(filename: string, blob: Blob): Promise<void> {
  try {
    const base64 = await blobToBase64(blob);
    const written = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({
      title: filename,
      url: written.uri,
      dialogTitle: `Save ${filename}`,
    });
  } catch {
    // Fall back to a browser-style download.
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
