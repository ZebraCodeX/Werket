import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native shell config for the downloadable mobile app (Android).
 * `webDir` points at the Vite build output (repo-root staticfiles/).
 */
const config: CapacitorConfig = {
  appId: 'com.zebracodex.werket',
  appName: 'Werket',
  webDir: '../staticfiles',
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#233b7a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#111327',
    },
  },
};

export default config;
