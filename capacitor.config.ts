import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.servicedictionary.app',
  appName: 'Service Dictionary',
  // Output of `npm run generate`
  webDir: '.output/public',
  backgroundColor: '#ffffff',
  android: {
    backgroundColor: '#ffffff',
  },
  ios: {
    backgroundColor: '#ffffff',
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
  },
}

export default config
