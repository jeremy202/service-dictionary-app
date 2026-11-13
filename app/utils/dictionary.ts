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
  /** Military symbols only */
  symbol?: { id: string; category: string; serial: number; image: string; remarkImage: string | null }
  // lower-cased copies for searching
  lh: string
  la: string
  lm: string
}

const data = raw as { t: [string, string][]; a: [string, string][]; p: [string, string][] }

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
  ...data.a.map(([m, a]) => make('a', m, m, a)),
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

export const TABS: { id: Tab; label: string; slug: string }[] = [
  { id: 'all', label: 'All entries', slug: 'all' },
  { id: 't', label: 'Terms', slug: 'terms' },
  { id: 'a', label: 'Abbreviations', slug: 'abbreviations' },
  { id: 'p', label: 'Prowords', slug: 'prowords' },
  { id: 's', label: 'Symbols', slug: 'symbols' },
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
