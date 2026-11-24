/**
 * Auto-abbreviate: replaces phrases in a text with their abbreviations, using only the
 * abbreviations in the app's Abbreviations list.
 *
 * Phrases come from the "word" column of the abbreviations file. Where that column lists
 * forms of a word ("Advance(d), Advancing", "Aircraftman/Aircraftmen") each listed form is
 * matched too. Matching is whole-word and ignores letter case; the longest phrase wins
 * ("Main Supply Route" before "Supply").
 */
import raw from '~/data/dictionary.json'

export interface Rule {
  key: string // normalised phrase
  phrase: string // phrase as written in the list
  abbrs: string[] // abbreviations for it, in list order (first is used by default)
}

export interface Hit { key: string; phrase: string; abbr: string; count: number; alts: string[] }

export interface Options {
  off?: Set<string> // phrases the user switched off
  pick?: Map<string, string> // phrase -> abbreviation chosen by the user
}

// Words (runs of letters/digits) and the gaps between them. An apostrophe is a gap,
// so "adversary's" matches "adversary" and becomes "Advy's".
const TOK = /[\p{L}\p{N}]+/gu
interface Tok { w: string; s: number; e: number }
function tokens(text: string): Tok[] {
  return [...text.matchAll(TOK)].map(m => ({ w: m[0].toLowerCase(), s: m.index!, e: m.index! + m[0].length }))
}
// spaces collapse; tabs and line breaks stay, so a phrase never runs across lines or cells
const gap = (g: string) => g.replace(/[’‘]/g, "'").replace(/[ \u00a0]+/g, ' ').replace(/ ?- ?/g, '-')
/** Canonical form of a phrase: lower-case words joined by their normalised gaps. */
function canon(text: string) {
  const t = tokens(text)
  return t.map((x, i) => (i ? gap(text.slice(t[i - 1]!.e, x.s)) : '') + x.w).join('')
}

/** The forms of a phrase that the word column spells out. */
export function phraseForms(meaning: string): string[] {
  const out = new Set<string>()
  const add = (s: string) => {
    const t = s.replace(/\s+/g, ' ').trim()
    if (t.length >= 2 && /[A-Za-z]/.test(t)) out.add(t)
  }
  add(meaning)
  for (const part0 of meaning.split(';')) {
    const part = part0.trim()
    if (!part) continue
    add(part)
    // Lists of forms separated by "/" or ","
    const pieces = part.split(/\s*[/,]\s*/).map(p => p.trim()).filter(Boolean)
    const words = (p: string) => p.replace(/\([^)]*\)/g, '').trim().split(/\s+/).filter(Boolean).length
    let forms = [part]
    if (pieces.length > 1) {
      const sizes = pieces.map(words)
      // only when every piece is a single word, or every piece is a full phrase
      if (sizes.every(n => n === 1) || sizes.every(n => n >= 2)) forms = pieces
    }
    for (const f of forms) {
      add(f)
      // Word endings in brackets right after a word: Advance(d), Account(s)(ing)
      if (/\w\([a-z]{1,5}\)/i.test(f)) {
        const base = f.replace(/\(([a-z]{1,5})\)/gi, '')
        add(base)
        add(f.replace(/\(([a-z]{1,5})\)/gi, '$1'))
        // each ending on its own: Acknowledge(d)(ment) -> Acknowledged, Acknowledgement
        for (const m of f.matchAll(/\(([a-z]{1,5})\)/gi)) {
          add(f.replace(m[0], m[1]!).replace(/\(([a-z]{1,5})\)/gi, ''))
        }
      } else if (/\s\([^)]*\)/.test(f)) {
        // A note in brackets after the phrase: "Air Intercept (radar)" -> also "Air Intercept"
        add(f.replace(/\s*\([^)]*\)/g, ''))
      }
    }
  }
  // Never match pieces that still contain brackets or slashes
  return [...out].filter(f => !/[()/;]/.test(f))
}

interface Node { next: Map<string, Node>; key?: string }
let cache: { rules: Map<string, Rule>; root: Node } | null = null

export function rules() {
  if (cache) return cache
  const map = new Map<string, Rule>()
  const exact = new Set<string>()
  const list = (raw as { a: [string, string, string[]][] }).a
  // Exact phrases first, so a phrase written out in full in the list
  // always beats the same words found as a form of another entry.
  for (const pass of [0, 1] as const) {
    for (const [meaning, abbr] of list) {
      const forms = pass === 0 ? [meaning.replace(/\s+/g, ' ').trim()].filter(f => !/[()/;]/.test(f)) : phraseForms(meaning)
      for (const f of forms) {
        const key = canon(f)
        if (!key || key === canon(abbr)) continue
        if (pass === 1 && exact.has(key) && !map.get(key)!.abbrs.includes(abbr)) continue
        const r = map.get(key)
        if (r) { if (!r.abbrs.includes(abbr)) r.abbrs.push(abbr) }
        else map.set(key, { key, phrase: f, abbrs: [abbr] })
        if (pass === 0) exact.add(key)
      }
    }
  }
  // Word-by-word tree of all phrases, for a fast longest-match scan
  const root: Node = { next: new Map() }
  for (const key of map.keys()) {
    const t = tokens(key)
    let n = root
    t.forEach((x, i) => {
      if (i) { const g = 'g' + gap(key.slice(t[i - 1]!.e, x.s)); n = n.next.get(g) ?? (n.next.set(g, { next: new Map() }), n.next.get(g)!) }
      const w = 'w' + x.w
      n = n.next.get(w) ?? (n.next.set(w, { next: new Map() }), n.next.get(w)!)
    })
    n.key = key
  }
  cache = { rules: map, root }
  return cache
}

export interface Match { start: number; end: number; key: string; abbr: string }

/** Every phrase to replace in a piece of text, left to right, longest first, never overlapping. */
export function findMatches(text: string, opts: Options = {}): Match[] {
  const { rules: map, root } = rules()
  const t = tokens(text)
  const out: Match[] = []
  for (let i = 0; i < t.length; i++) {
    let n = root.next.get('w' + t[i]!.w)
    let best: { j: number; key: string } | null = null
    let j = i
    while (n) {
      if (n.key && !opts.off?.has(n.key)) best = { j, key: n.key }
      if (j + 1 >= t.length) break
      const g = n.next.get('g' + gap(text.slice(t[j]!.e, t[j + 1]!.s)))
      n = g?.next.get('w' + t[j + 1]!.w)
      j++
    }
    if (best) {
      out.push({ start: t[i]!.s, end: t[best.j]!.e, key: best.key, abbr: opts.pick?.get(best.key) ?? map.get(best.key)!.abbrs[0]! })
      i = best.j
    }
  }
  return out
}

export function tally(matches: Match[], hits = new Map<string, Hit>()) {
  const { rules: map } = rules()
  for (const m of matches) {
    const h = hits.get(m.key)
    if (h) h.count++
    else { const r = map.get(m.key)!; hits.set(m.key, { key: m.key, phrase: r.phrase, abbr: m.abbr, count: 1, alts: r.abbrs }) }
  }
  return hits
}

export function applyMatches(text: string, matches: Match[]) {
  let out = ''
  let at = 0
  for (const m of matches) { out += text.slice(at, m.start) + m.abbr; at = m.end }
  return out + text.slice(at)
}

/** All the phrases that could be matched but were switched off, found in the text. */
export function switchedOff(text: string, off: Set<string>) {
  if (!off.size) return new Map<string, Hit>()
  return tally(findMatches(text).filter(m => off.has(m.key)))
}
