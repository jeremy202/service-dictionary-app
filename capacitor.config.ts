import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.servicedictionary.app',
  appName: 'Service Guide',
  // Output of `npm run generate`
  webDir: '.output/public',
  backgroundColor: '#f6f2ea',
  android: {
    backgroundColor: '#f6f2ea',
  },
  ios: {
    backgroundColor: '#f6f2ea',
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#f6f2ea',
      showSpinner: false,
    },
  },
}

export default config
