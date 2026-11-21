import raw from '~/data/dictionary.json'
import symbolsRaw from '~/data/symbols.json'

export type Kind = 't' | 'a' | 'p' | 's'
export type Tab = 'all' | Kind
export type AbbrSort = 'full' | 'abbr'

export interface Entry {
  id: number
  kind: Kind
  /** Headword: term, full form (for abbreviations) or proword */
  headword: string
  /** Abbreviation (abbreviations only) */
  abbr?: string
  /** Meaning / definition text, exactly as in the source file (remarks, for symbols) */
  meaning: string
  /** Abbreviations only: the remarks column of the abbreviations file (one per heading it is listed under) */
  remarks?: string[]
  /** Military symbols only */
  symbol?: { id: string; category: string; serial: number; image: string; remarkImage: string | null }
  // lower-cased copies for searching
  lh: string
  la: string
  lm: string
}

const data = raw as { t: [string, string][]; a: [string, string, string[]][]; p: [string, string][] }

// Terms in the source end with a full stop ("Leadership."); it is hidden in the headword only.
const trimStop = (s: string) => s.replace(/\.\s*$/, '')

let id = 0
const make = (kind: Kind, headword: string, meaning: string, abbr?: string): Entry => ({
  id: id++,
  kind,
  headword,
  abbr,
  meaning,
  lh: headword.toLowerCase(),
  la: (abbr ?? '').toLowerCase(),
  lm: meaning.toLowerCase(),
})

interface SymbolRow { id: string; category: string; serial: number; description: string; remarks: string; image: string; remarkImage: string | null }

/** Order of the symbol sections, as in the source document */
export const SYMBOL_CATEGORIES = ['Army', 'Naval', 'Air Force', 'Operations Other Than War']

export const ENTRIES: Entry[] = [
  ...data.t.map(([w, m]) => make('t', trimStop(w), m)),
  ...data.a.map(([m, a, r]) => {
    const e = make('a', m, m, a)
    if (r?.length) e.remarks = r
    return e
  }),
  ...data.p.map(([w, m]) => make('p', w, m)),
  ...(symbolsRaw as SymbolRow[]).map((r) => {
    const e = make('s', r.description, r.remarks)
    e.symbol = { id: r.id, category: r.category, serial: r.serial, image: `/symbols/${r.image}`, remarkImage: r.remarkImage ? `/symbols/${r.remarkImage}` : null }
    return e
  }),
]

export const COUNTS: Record<Tab, number> = {
  all: ENTRIES.length,
  t: data.t.length,
  a: data.a.length,
  p: data.p.length,
  s: (symbolsRaw as unknown[]).length,
}

// The app opens on Dictionary; "All" sits at the far right
export const TABS: { id: Tab; label: string; slug: string }[] = [
  { id: 't', label: 'Dictionary', slug: 'dictionary' },
  { id: 'a', label: 'Abbreviations', slug: 'abbreviations' },
  { id: 's', label: 'Symbols', slug: 'symbols' },
  { id: 'p', label: 'Prowords', slug: 'prowords' },
  { id: 'all', label: 'All', slug: 'all' },
].filter(t => t.id !== 's' || (symbolsRaw as unknown[]).length > 0) // tab shows only when symbols are included

export const KIND_LABEL: Record<Kind, string> = { t: 'Term', a: 'Abbreviation', p: 'Proword', s: 'Symbol' }

export const ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#']

const escMap: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => escMap[c]!)
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Escapes text and wraps every occurrence of the search words in <mark>. */
export function highlight(text: string, words: string[]): string {
  const safe = escapeHtml(text)
  if (!words.length) return safe
  const re = new RegExp(`(${words.map(w => escapeRe(escapeHtml(w))).join('|')})`, 'gi')
  return safe.replace(re, '<mark>$1</mark>')
}

/** For "See 'Echelon'" style entries, returns the referenced term. */
export function crossReference(e: Entry): string | null {
  if (e.kind !== 't' || !/^\s*see\b/i.test(e.meaning)) return null
  const m = e.meaning.match(/['‘’"“”]+([^'‘’"“”]+?)['‘’"“”\u009d]+/)
  return m ? m[1]!.trim() : null
}

/* ---------- Cross-references inside definitions ---------- */

const nameKey = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim()

/** Terms by name, also without a trailing abbreviation: "Fire Support Coordination Line (FSCL)" and "Fire Support Coordination Line" */
let TERM_INDEX: Map<string, Entry> | null = null
function termIndex() {
  if (TERM_INDEX) return TERM_INDEX
  TERM_INDEX = new Map()
  for (const e of ENTRIES) {
    if (e.kind !== 't') continue
    const full = nameKey(e.headword)
    if (!TERM_INDEX.has(full)) TERM_INDEX.set(full, e)
    const short = nameKey(e.headword.replace(/\s*\([^)]*\)\s*$/, ''))
    if (short && !TERM_INDEX.has(short)) TERM_INDEX.set(short, e)
  }
  return TERM_INDEX
}

/** Finds the entry a reference points to: a term first, then a proword, abbreviation full form or symbol. */
export function findEntry(name: string): Entry | null {
  const k = nameKey(name.replace(/^["“'‘]+|["”'’]+$/g, ''))
  if (!k) return null
  return termIndex().get(k) ?? ENTRIES.find(e => e.kind !== 't' && nameKey(e.headword) === k) ?? null
}

/** Multi-word term names, longest first, matched as whole words */
let MULTI_RE: RegExp | null = null
function multiWordRe() {
  if (MULTI_RE) return MULTI_RE
  const names = [...termIndex().keys()].filter(k => k.includes(' ') && k.length >= 6)
  names.sort((a, b) => b.length - a.length)
  MULTI_RE = new RegExp(`(?<![\\w-])(${names.map(escapeRe).join('|')})(?![\\w-])`, 'gi')
  return MULTI_RE
}

// "See 'Echelon'", see "Dispersion", (see also "Tactical Bound")
const SEE_RE = /\b(see(?:\s+also)?)\s+(["“'‘]+)([^"“”'‘’\n]{2,80}?)(["”'’\u009d]+)/gi

export interface Segment { text: string; to?: Entry }

/**
 * Splits definition text into plain parts and links to other entries.
 * Links: explicit references (See "...") first, then whole-word matches of multi-word
 * terms in the dictionary. Each entry is linked once per definition (tracked in `used`),
 * never to itself, and only when it exists, so a missing term stays plain text.
 */
export function linkify(text: string, self: Entry | null, used: Set<number>): Segment[] {
  type Hit = { start: number; end: number; to: Entry }
  const hits: Hit[] = []
  const free = (a: number, b: number) => hits.every(h => b <= h.start || a >= h.end)
  const add = (start: number, end: number, to: Entry | null) => {
    if (!to || to.id === self?.id || used.has(to.id) || !free(start, end)) return
    hits.push({ start, end, to })
    used.add(to.id)
  }
  for (const m of text.matchAll(SEE_RE)) {
    const start = m.index! + m[1]!.length + m[0]!.slice(m[1]!.length).indexOf(m[3]!)
    add(start, start + m[3]!.length, findEntry(m[3]!))
  }
  for (const m of text.matchAll(multiWordRe())) add(m.index!, m.index! + m[0]!.length, termIndex().get(nameKey(m[0]!)) ?? null)
  if (!hits.length) return [{ text }]
  hits.sort((a, b) => a.start - b.start)
  const out: Segment[] = []
  let at = 0
  for (const h of hits) {
    if (h.start > at) out.push({ text: text.slice(at, h.start) })
    out.push({ text: text.slice(h.start, h.end), to: h.to })
    at = h.end
  }
  if (at < text.length) out.push({ text: text.slice(at) })
  return out
}

/** Definition text as HTML: search words highlighted, references as links (data-entry holds the entry id). */
export function richText(text: string, words: string[], self: Entry | null, used: Set<number>): string {
  return linkify(text, self, used)
    .map(s => (s.to ? `<a class="xref" role="link" data-entry="${s.to.id}">${highlight(s.text, words)}</a>` : highlight(s.text, words)))
    .join('')
}

export const entryById = (id: number): Entry | null => ENTRIES[id]?.id === id ? ENTRIES[id]! : ENTRIES.find(e => e.id === id) ?? null
