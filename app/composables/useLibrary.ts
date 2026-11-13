import { ENTRIES, type Entry } from '~/utils/dictionary'

/**
 * Saved entries and recently viewed entries, kept on the phone.
 * Entries are stored by a content key (not by position) so they survive data updates.
 */
export const entryKey = (e: Entry) => `${e.kind}|${e.headword}|${e.abbr ?? ''}${e.symbol ? `|${e.symbol.id}` : ''}`

const BY_KEY = new Map<string, Entry>()
for (const e of ENTRIES) if (!BY_KEY.has(entryKey(e))) BY_KEY.set(entryKey(e), e)

const SAVED_KEY = 'sd-saved'
const RECENT_KEY = 'sd-recent'
const MAX_RECENT = 50

function load(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(v) ? v.filter(k => typeof k === 'string') : []
  } catch {
    return []
  }
}
function store(key: string, value: string[]) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

const savedKeys = ref<string[]>([])
const recentKeys = ref<string[]>([])
let loaded = false

export function useLibrary() {
  if (!loaded && import.meta.client) {
    savedKeys.value = load(SAVED_KEY)
    recentKeys.value = load(RECENT_KEY)
    loaded = true
  }

  const toEntries = (keys: string[]) => keys.map(k => BY_KEY.get(k)).filter((e): e is Entry => !!e)
  const saved = computed(() => toEntries(savedKeys.value))
  const recent = computed(() => toEntries(recentKeys.value))
  const savedSet = computed(() => new Set(savedKeys.value))

  const isSaved = (e: Entry) => savedSet.value.has(entryKey(e))

  function toggleSaved(e: Entry): boolean {
    const k = entryKey(e)
    const now = !savedSet.value.has(k)
    savedKeys.value = now ? [k, ...savedKeys.value] : savedKeys.value.filter(x => x !== k)
    store(SAVED_KEY, savedKeys.value)
    return now
  }

  function addRecent(e: Entry) {
    const k = entryKey(e)
    recentKeys.value = [k, ...recentKeys.value.filter(x => x !== k)].slice(0, MAX_RECENT)
    store(RECENT_KEY, recentKeys.value)
  }

  function clearRecent() {
    recentKeys.value = []
    store(RECENT_KEY, [])
  }

  return { saved, recent, isSaved, toggleSaved, addRecent, clearRecent }
}
