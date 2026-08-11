import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ro.com.prezenta',
  appName: 'Prezenta',
  webDir: '.next',
  server: {
    url: 'https://www.prezenta.com.ro',
    cleartext: false,
  },
};

export default config;
