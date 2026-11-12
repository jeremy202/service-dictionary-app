import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

// Match the phone's status bar to the app's light / dark theme
export default defineNuxtPlugin(() => {
  if (!Capacitor.isNativePlatform()) return
  const dark = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = async () => {
    try {
      await StatusBar.setStyle({ style: dark.matches ? Style.Dark : Style.Light })
      if (Capacitor.getPlatform() === 'android') {
        await StatusBar.setOverlaysWebView({ overlay: false })
        await StatusBar.setBackgroundColor({ color: dark.matches ? '#161616' : '#ffffff' })
      }
    } catch {}
  }
  apply()
  dark.addEventListener('change', apply)
})
