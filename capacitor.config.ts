import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ro.com.prezenta',
  appName: 'Prezenta',
  webDir: '.next',
  server: {
    url: 'https://www.prezenta.com.ro',
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['alert'],
    },
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: true,
        twitter: false,
      },
    },
  },
};

export default config;
