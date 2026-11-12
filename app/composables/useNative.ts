import { Capacitor } from '@capacitor/core'
import { Clipboard } from '@capacitor/clipboard'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Share } from '@capacitor/share'

const native = () => Capacitor.isNativePlatform()

/** Light vibration, used to confirm a tap (save, A–Z scrubbing). No-op on the web. */
export async function tap(strength: 'light' | 'medium' = 'light') {
  if (!native()) return
  try {
    await Haptics.impact({ style: strength === 'light' ? ImpactStyle.Light : ImpactStyle.Medium })
  } catch {}
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (native()) await Clipboard.write({ string: text })
    else await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Opens the phone's share sheet. Returns false when sharing is not available. */
export async function shareText(title: string, text: string): Promise<boolean> {
  try {
    if (native() || (await Share.canShare()).value) {
      await Share.share({ title, text, dialogTitle: 'Share entry' })
      return true
    }
  } catch {}
  return false
}
