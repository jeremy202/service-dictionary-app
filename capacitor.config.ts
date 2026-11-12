import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.servicedictionary.app',
  appName: 'Service Dictionary',
  // Output of `npm run generate`
  webDir: '.output/public',
  backgroundColor: '#f5f2ea',
  android: {
    backgroundColor: '#f5f2ea',
  },
  ios: {
    backgroundColor: '#f5f2ea',
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#f5f2ea',
      showSpinner: false,
    },
  },
}

export default config
