import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

// The status bar matches the green header band (light icons on green)
export default defineNuxtPlugin(() => {
  if (!Capacitor.isNativePlatform()) return
  const dark = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = async () => {
    try {
      await StatusBar.setStyle({ style: Style.Dark })
      if (Capacitor.getPlatform() === 'android') {
        await StatusBar.setOverlaysWebView({ overlay: false })
        await StatusBar.setBackgroundColor({ color: dark.matches ? '#183a29' : '#1f4d36' })
      }
    } catch {}
  }
  apply()
  dark.addEventListener('change', apply)
})
