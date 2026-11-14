import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cartasdominicanas.app',
  appName: 'Cartas Dominicanas',
  webDir: 'dist',
  backgroundColor: '#2a160a',
  android: {
    allowMixedContent: false,
  },
};

export default config;
