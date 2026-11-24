import { Capacitor } from '@capacitor/core'
import { Clipboard } from '@capacitor/clipboard'
import { Directory, Filesystem } from '@capacitor/filesystem'
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

/**
 * Saves a file the app made. On the phone it opens the share sheet so the user can save it
 * to Files / Drive or send it (WhatsApp, email…). In a browser it downloads the file.
 */
export async function saveFile(name: string, bytes: Uint8Array, mime: string): Promise<boolean> {
  try {
    if (native()) {
      let bin = ''
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      const { uri } = await Filesystem.writeFile({ path: name, data: btoa(bin), directory: Directory.Cache })
      await Share.share({ title: name, files: [uri], dialogTitle: 'Save or send ' + name })
      return true
    }
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }))
    const a = document.createElement('a')
    a.href = url; a.download = name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    return true
  } catch (e) {
    // the user closing the share sheet is not an error
    return /cancel/i.test(String((e as Error)?.message ?? e))
  }
}
