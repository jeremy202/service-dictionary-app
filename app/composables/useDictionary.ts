import { ENTRIES, type AbbrSort, type Entry, type Tab } from '~/utils/dictionary'

/** Ranking groups for search results (lower = better). */
export const Rank = {
  Exact: 0, // headword or abbreviation is exactly what was typed
  Prefix: 1, // headword or abbreviation starts with what was typed
  WordStart: 2, // every typed word starts a word in the headword
  InHeadword: 3, // every typed word appears somewhere in the headword
  MeaningWordStart: 4, // every typed word starts a word in the meaning
  InMeaning: 5, // every typed word appears somewhere in the meaning
} as const
type Rank = (typeof Rank)[keyof typeof Rank]

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function useDictionary() {
  const tab = ref<Tab>('all')
  const query = ref('')
  const letter = ref('')
  const abbrSort = ref<AbbrSort>('full')

  const words = computed(() => query.value.trim().toLowerCase().split(/\s+/).filter(Boolean))

  // Abbreviations are filed under their abbreviation in "All" (matching the row title),
  // and under the full form on the Abbreviations tab unless sorted by abbreviation.
  const sortKey = (e: Entry) =>
    e.kind === 'a' && (tab.value === 'all' || (tab.value === 'a' && abbrSort.value === 'abbr')) ? e.la : e.lh

  const letterOf = (e: Entry) => {
    const c = sortKey(e).replace(/^[^a-z0-9]+/, '')[0] ?? '#'
    return /[a-z]/.test(c) ? c.toUpperCase() : '#'
  }

  const pool = computed(() => (tab.value === 'all' ? ENTRIES : ENTRIES.filter(e => e.kind === tab.value)))
  const lettersAvailable = computed(() => new Set(pool.value.map(letterOf)))

  /** Rank of each matching entry, for the current search. */
  const ranks = new Map<number, Rank>()

  function rank(e: Entry, q: string, w: string[], starts: RegExp[]): Rank | -1 {
    if (e.lh === q || e.la === q) return Rank.Exact
    if (e.la.startsWith(q) || e.lh.startsWith(q)) return Rank.Prefix
    // A single letter only matches the start of a headword or abbreviation
    if (q.length < 2) return -1
    const head = `${e.lh} ${e.la}`
    if (starts.every(r => r.test(head))) return Rank.WordStart
    if (w.every(t => head.includes(t))) return Rank.InHeadword
    if (starts.every(r => r.test(e.lm))) return Rank.MeaningWordStart
    if (w.every(t => e.lm.includes(t))) return Rank.InMeaning
    return -1
  }

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

  const results = computed<Entry[]>(() => {
    const q = query.value.trim().toLowerCase().replace(/\s+/g, ' ')
    ranks.clear()
    if (q) {
      const w = words.value
      const starts = w.map(t => new RegExp(`(^|[^a-z0-9])${escapeRe(t)}`))
      const scored: [Rank, Entry][] = []
      for (const e of pool.value) {
        const r = rank(e, q, w, starts)
        if (r !== -1) scored.push([r, e])
      }
      scored.sort((a, b) =>
        a[0] - b[0]
        || (a[0] <= Rank.Prefix ? sortKey(a[1]).length - sortKey(b[1]).length : 0) // shorter, closer matches first
        || collator.compare(sortKey(a[1]), sortKey(b[1])))
      for (const [r, e] of scored) ranks.set(e.id, r)
      return scored.map(([, e]) => e)
    }
    // Entries starting with a number or symbol ("1st Lt", "2iC") go after Z
    const numeric = (e: Entry) => (letterOf(e) === '#' ? 1 : 0)
    let list = [...pool.value].sort((a, b) => numeric(a) - numeric(b) || collator.compare(sortKey(a), sortKey(b)))
    if (letter.value) list = list.filter(e => letterOf(e) === letter.value)
    return list
  })

  /** True when the entry was found in its headword/abbreviation (not only in its meaning). */
  const isNameMatch = (e: Entry) => (ranks.get(e.id) ?? 0) <= Rank.InHeadword

  return { tab, query, letter, abbrSort, words, results, letterOf, lettersAvailable, isNameMatch }
}
