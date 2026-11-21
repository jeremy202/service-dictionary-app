/**
 * The locked "Manual" tab (Writing Manual).
 *
 * The manual ships inside the app only in encrypted form (public/manual/*.bin, made by
 * scripts/build-manual.mjs). The access code is the key: it is never stored in the app,
 * a wrong code simply fails to decrypt, and the readable manual exists only in memory
 * while the tab is unlocked. Closing the app (or tapping Lock) locks it again.
 */

export interface ManualTocItem {
  type: 'chapter' | 'annex'
  n?: number // chapter number
  chapter?: number // annex: its chapter
  annex?: string // annex letter
  title: string
  page: number
}
interface ManualIndex { title: string; pages: number; toc: ManualTocItem[]; text: string[] }

const ITERATIONS = 400_000 // must match scripts/build-manual.mjs
const MAX_TRIES = 5
const WAIT_MS = 30_000

const state = ref<'locked' | 'checking' | 'open'>('locked')
const error = ref('')
const index = shallowRef<ManualIndex | null>(null)
let key: CryptoKey | null = null
let pdfBytes: Promise<Uint8Array> | null = null
let tries = 0
let waitUntil = 0
const LAST_PAGE = 'sd-manual-page'

const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '')

async function fetchBin(name: string): Promise<Uint8Array> {
  const res = await fetch(`/manual/${name}`)
  if (!res.ok) throw new Error('The manual is missing from this version of the app.')
  return new Uint8Array(await res.arrayBuffer())
}

async function deriveKey(code: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
  )
}

function parts(bin: Uint8Array) {
  if (String.fromCharCode(...bin.slice(0, 4)) !== 'SDM1') throw new Error('Unrecognised manual file.')
  return { salt: bin.slice(4, 20), iv: bin.slice(20, 32), body: bin.slice(32) }
}

async function open(bin: Uint8Array, k: CryptoKey) {
  const { iv, body } = parts(bin)
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k, body))
}

async function gunzip(data: Uint8Array): Promise<string> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

export function useManual() {
  const waitSeconds = ref(0)
  let tick: ReturnType<typeof setInterval> | undefined

  function startWait() {
    clearInterval(tick)
    const update = () => {
      waitSeconds.value = Math.max(0, Math.ceil((waitUntil - Date.now()) / 1000))
      if (!waitSeconds.value) clearInterval(tick)
    }
    update()
    tick = setInterval(update, 500)
  }

  async function unlock(code: string): Promise<boolean> {
    error.value = ''
    if (Date.now() < waitUntil) { startWait(); return false }
    const c = normalizeCode(code)
    if (c.length < 4) { error.value = 'Enter the access code.'; return false }
    state.value = 'checking'
    try {
      const bin = await fetchBin('m2.bin')
      const k = await deriveKey(c, parts(bin).salt)
      let plain: Uint8Array
      try {
        plain = await open(bin, k)
      } catch {
        tries++
        if (tries >= MAX_TRIES) { tries = 0; waitUntil = Date.now() + WAIT_MS; startWait() }
        error.value = tries === 0 ? 'Too many wrong attempts. Try again in 30 seconds.' : 'That access code is not correct.'
        state.value = 'locked'
        return false
      }
      index.value = JSON.parse(await gunzip(plain)) as ManualIndex
      key = k
      tries = 0
      state.value = 'open'
      return true
    } catch (e: any) {
      error.value = e?.message || 'Could not open the manual.'
      state.value = 'locked'
      return false
    }
  }

  function lock() {
    key = null
    pdfBytes = null
    index.value = null
    state.value = 'locked'
  }

  /** The decrypted PDF (loaded once per unlock). */
  function pdf(): Promise<Uint8Array> {
    if (!key) return Promise.reject(new Error('The manual is locked.'))
    const k = key
    pdfBytes ??= fetchBin('m1.bin').then(bin => open(bin, k))
    return pdfBytes
  }

  /** Pages containing every typed word, with a short snippet around the first one. */
  function search(query: string, limit = 60) {
    const ix = index.value
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 1)
    if (!ix || !words.length) return []
    const out: { page: number; snippet: string; hits: number; phrase: number }[] = []
    ix.text.forEach((raw, i) => {
      const text = raw.replace(/\s+/g, ' ')
      const lower = text.toLowerCase()
      if (!words.every(w => lower.includes(w))) return
      const at = lower.indexOf(words[0]!)
      const start = Math.max(0, lower.lastIndexOf(' ', Math.max(0, at - 50)))
      const snippet = `${start > 0 ? '…' : ''}${text.slice(start, start + 170).trim()}…`
      const hits = words.reduce((n, w) => n + lower.split(w).length - 1, 0)
      const phrase = words.length > 1 && lower.includes(words.join(' ')) ? 1 : 0
      out.push({ page: i + 1, snippet, hits, phrase })
    })
    // Pages with the exact phrase first, then the most mentions, then page order
    out.sort((a, b) => b.phrase - a.phrase || b.hits - a.hits || a.page - b.page)
    return out.slice(0, limit)
  }

  /** The chapter / annex a page belongs to. */
  function sectionOf(page: number): ManualTocItem | null {
    const toc = index.value?.toc ?? []
    let found: ManualTocItem | null = null
    for (const t of toc) if (t.page <= page) found = t
    return found
  }

  const lastPage = () => Number(localStorage.getItem(LAST_PAGE)) || 0
  const rememberPage = (p: number) => { try { localStorage.setItem(LAST_PAGE, String(p)) } catch {} }

  onBeforeUnmount(() => clearInterval(tick))

  return { state, error, index, waitSeconds, unlock, lock, pdf, search, sectionOf, lastPage, rememberPage }
}
