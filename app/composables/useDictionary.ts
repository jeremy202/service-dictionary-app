import { ENTRIES, SYMBOL_CATEGORIES, type AbbrSort, type Entry, type Tab } from '~/utils/dictionary'

/** Ranking groups for search results (lower = better). */
export const Rank = {
  Exact: 0, // headword or abbreviation is exactly what was typed
  Prefix: 1, // headword or abbreviation starts with what was typed
  WordStart: 2, // every typed word starts a word in the headword / abbreviation
  InHeadword: 3, // every typed word appears somewhere in the headword / abbreviation
  MeaningWordStart: 4, // every typed word starts a word in the meaning
  InMeaning: 5, // every typed word appears somewhere in the meaning
} as const
type Rank = (typeof Rank)[keyof typeof Rank]

/**
 * Search text is normalised so that capitals, accents, spaces, hyphens, dots, slashes
 * and other symbols don't matter: "2ic" finds "2iC", "a&b" finds "A & B",
 * "co ordinate" finds "co-ordinate".
 */
export const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' and ') // "A & B" = "a and b"
    .replace(/[^a-z0-9]+/g, ' ').trim()
const compact = (s: string) => norm(s).replace(/ /g, '')

interface Index { nh: string; na: string; nm: string; ch: string; ca: string; head: string }
const INDEX = new Map<number, Index>()
function indexOf(e: Entry): Index {
  let ix = INDEX.get(e.id)
  if (!ix) {
    const nh = norm(e.headword)
    const na = norm(e.abbr ?? '')
    ix = { nh, na, nm: ` ${norm(e.meaning)}`, ch: compact(e.headword), ca: compact(e.abbr ?? ''), head: ` ${nh} ${na}` }
    INDEX.set(e.id, ix)
  }
  return ix
}

/** Linking words that appear in almost every meaning; skipped for the looser matches. */
const STOP_WORDS = new Set(['and', 'of', 'the', 'in', 'to', 'for', 'an', 'or', 'on', 'by', 'with', 'at', 'is', 'as', 'be'])

function rank(e: Entry, nq: string, cq: string, w: string[]): Rank | -1 {
  const x = indexOf(e)
  if (x.nh === nq || x.na === nq || (cq && (x.ca === cq || x.ch === cq))) return Rank.Exact
  if (x.na.startsWith(nq) || x.nh.startsWith(nq) || (cq && (x.ca.startsWith(cq) || x.ch.startsWith(cq)))) return Rank.Prefix
  // A single letter only matches the start of a headword or abbreviation, and single-letter
  // words ("a", "b") are ignored for the looser matches below so they don't match everything
  if (cq.length < 2) return -1
  w = w.filter(t => t.length > 1 && !STOP_WORDS.has(t))
  if (!w.length) return -1
  if (w.every(t => x.head.includes(` ${t}`))) return Rank.WordStart
  if (w.every(t => x.head.includes(t)) || x.ch.includes(cq) || x.ca.includes(cq)) return Rank.InHeadword
  if (w.every(t => x.nm.includes(` ${t}`))) return Rank.MeaningWordStart
  if (w.every(t => x.nm.includes(t))) return Rank.InMeaning
  return -1
}

/* ---------- "Did you mean" for misspellings ---------- */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (cur[j]! < best) best = cur[j]!
    }
    if (best > max) return max + 1
    prev = cur
  }
  return prev[b.length]!
}

/** Names close to what was typed: compares with each whole name and each word in it. */
function suggest(nq: string): string[] {
  if (nq.length < 3) return []
  const max = nq.length <= 4 ? 1 : nq.length <= 8 ? 2 : 3
  const found = new Map<string, number>()
  for (const e of ENTRIES) {
    const x = indexOf(e)
    const whole = editDistance(nq, x.nh, max)
    if (whole <= max) {
      const label = e.headword.replace(/\.$/, '')
      const k = label.toLowerCase()
      if (!found.has(k) || found.get(k)! > whole) found.set(k, whole)
      continue
    }
    for (const part of x.nh.split(' ')) {
      if (part.length < 3) continue
      const d = editDistance(nq, part, max)
      if (d <= max && (!found.has(part) || found.get(part)! > d)) found.set(part, d)
    }
  }
  return [...found.entries()]
    .sort((a, b) => a[1] - b[1]
      || (b[0][0] === nq[0] ? 1 : 0) - (a[0][0] === nq[0] ? 1 : 0) // same first letter first
      || a[0].length - b[0].length)
    .slice(0, 4)
    .map(([k]) => k)
}

export function useDictionary() {
  const tab = ref<Tab>('all')
  const query = ref('')
  const letter = ref('')
  const abbrSort = ref<AbbrSort>('full')

  /** Typed words, used for highlighting matches on screen. */
  const words = computed(() => query.value.trim().toLowerCase().split(/\s+/).filter(Boolean))
  const nq = computed(() => norm(query.value))

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
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

  /** Every entry in the app that matches the search, best first (all three files). */
  const matches = computed<{ ranks: Map<number, Rank>; list: Entry[] }>(() => {
    const q = nq.value
    const ranks = new Map<number, Rank>()
    if (!q) return { ranks, list: [] }
    const cq = q.replace(/ /g, '')
    const w = q.split(' ')
    const scored: [Rank, Entry][] = []
    for (const e of ENTRIES) {
      const r = rank(e, q, cq, w)
      if (r !== -1) { scored.push([r, e]); ranks.set(e.id, r) }
    }
    const KIND_ORDER = { t: 0, p: 1, a: 2 }
    scored.sort((a, b) =>
      a[0] - b[0]
      || (a[0] === Rank.Exact ? KIND_ORDER[a[1].kind] - KIND_ORDER[b[1].kind] : 0) // full entry before its abbreviation
      || (a[0] <= Rank.Prefix ? sortKey(a[1]).length - sortKey(b[1]).length : 0) // shorter, closer matches first
      || collator.compare(sortKey(a[1]), sortKey(b[1])))
    return { ranks, list: scored.map(([, e]) => e) }
  })

  /** Number of matches for each filter button. */
  const matchCounts = computed(() => {
    const c = { all: 0, t: 0, a: 0, p: 0, s: 0 }
    for (const e of matches.value.list) { c.all++; c[e.kind]++ }
    return c
  })

  const results = computed<Entry[]>(() => {
    if (nq.value) return tab.value === 'all' ? matches.value.list : matches.value.list.filter(e => e.kind === tab.value)
    // Symbols tab: the document's order (Army, Naval, Air Force, MOOTW; by serial number)
    if (tab.value === 's') {
      const sec = (e: Entry) => SYMBOL_CATEGORIES.indexOf(e.symbol!.category)
      return [...pool.value].sort((a, b) => sec(a) - sec(b) || a.symbol!.serial - b.symbol!.serial)
    }
    // Entries starting with a number or symbol ("1st Lt", "2iC") go after Z
    const numeric = (e: Entry) => (letterOf(e) === '#' ? 1 : 0)
    let list = [...pool.value].sort((a, b) => numeric(a) - numeric(b) || collator.compare(sortKey(a), sortKey(b)))
    if (letter.value) list = list.filter(e => letterOf(e) === letter.value)
    return list
  })

  /** Does this entry match the current search? (used to filter Saved and Recent) */
  const matchesSearch = (e: Entry) => !nq.value || matches.value.ranks.has(e.id)
  /** True when the entry was found in its name/abbreviation (not only in its meaning). */
  const isNameMatch = (e: Entry) => (matches.value.ranks.get(e.id) ?? 0) <= Rank.InHeadword

  /** Close spellings, shown when nothing matches. */
  const suggestions = computed(() => (nq.value && !matches.value.list.length ? suggest(nq.value) : []))

  return {
    tab, query, letter, abbrSort, words, results, letterOf, lettersAvailable,
    isNameMatch, matchCounts, matchesSearch, suggestions,
  }
}
