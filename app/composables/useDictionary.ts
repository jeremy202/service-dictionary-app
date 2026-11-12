import { ENTRIES, type AbbrSort, type Entry, type Tab } from '~/utils/dictionary'

export function useDictionary() {
  const tab = ref<Tab>('all')
  const query = ref('')
  const letter = ref('')
  const abbrSort = ref<AbbrSort>('full')

  const words = computed(() => query.value.trim().toLowerCase().split(/\s+/).filter(Boolean))

  const sortKey = (e: Entry) =>
    e.kind === 'a' && tab.value === 'a' && abbrSort.value === 'abbr' ? e.la : e.lh

  const letterOf = (e: Entry) => {
    const c = sortKey(e).replace(/^[^a-z0-9]+/, '')[0] ?? '#'
    return /[a-z]/.test(c) ? c.toUpperCase() : '#'
  }

  const pool = computed(() => (tab.value === 'all' ? ENTRIES : ENTRIES.filter(e => e.kind === tab.value)))

  const lettersAvailable = computed(() => new Set(pool.value.map(letterOf)))

  // Ranking: exact match → starts with → headword contains → meaning contains
  function score(e: Entry, q: string, w: string[]) {
    if (e.lh === q || e.la === q) return 0
    if (e.la.startsWith(q) || e.lh.startsWith(q)) return 1
    if (w.every(t => e.lh.includes(t) || e.la.includes(t))) return 2
    if (w.every(t => e.lh.includes(t) || e.la.includes(t) || e.lm.includes(t))) return 3
    return -1
  }

  const results = computed<Entry[]>(() => {
    const q = query.value.trim().toLowerCase()
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
    if (q) {
      return pool.value
        .map(e => [score(e, q, words.value), e] as const)
        .filter(([s]) => s >= 0)
        .sort((a, b) => a[0] - b[0] || collator.compare(sortKey(a[1]), sortKey(b[1])))
        .map(([, e]) => e)
    }
    let list = [...pool.value].sort((a, b) => collator.compare(sortKey(a), sortKey(b)))
    if (letter.value) list = list.filter(e => letterOf(e) === letter.value)
    return list
  })

  return { tab, query, letter, abbrSort, words, results, letterOf, lettersAvailable }
}
