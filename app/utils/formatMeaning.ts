/**
 * Turns a meaning from the source files into structured blocks for display.
 *
 * The words are never changed. The formatter only:
 *  - splits lettered items (a. b. c.) and numbered items ((1) (2) (3)) into list rows,
 *  - shows a short lead-in phrase of an item ("The strategic level.") as its heading,
 *  - starts a new paragraph at run-in sub-headings ("…frontage.A2 Echelon.Although…"),
 *  - adds a visual space where sentences were run together ("level.This" → "level. This").
 */

export interface Block {
  /** 0 = paragraph, 1 = list item, 2 = nested list item */
  level: 0 | 1 | 2
  /** "a." or "(1)" for list items */
  marker?: string
  /** Short heading shown in bold */
  title?: string
  /** Body text */
  text: string
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'
const SMALL_WORDS = new Set(['of', 'and', 'the', 'in', 'for', 'to', 'on', 'a', 'an', 'or', 'by', 'with', 'at', '&'])

/** Adds a display space where a sentence or clause was run into the next one. */
export function spaceOut(s: string): string {
  return s
    .replace(/([a-z0-9)\]'’”])([.;:])([A-Z(])/g, '$1$2 $3')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

const isTitleCase = (phrase: string) => {
  const words = phrase.trim().split(/\s+/)
  if (!words.length || words.length > 7 || phrase.length > 60) return false
  return words.every((w, i) =>
    /^[A-Z0-9(]/.test(w) || (i > 0 && SMALL_WORDS.has(w.toLowerCase())))
}

interface Marker { index: number; length: number; kind: 'alpha' | 'num'; label: string }

/** Finds sequential list markers: a. b. c. … and (1) (2) (3) … */
function findMarkers(s: string): Marker[] {
  const out: Marker[] = []
  let nextLetter = 0
  let nextNum = 1
  // letter marker: at start or after punctuation/space, followed by space/uppercase/"("
  const re = /(^|[\s.:;!?)'’”])([a-z])\.(?=\s*[A-Z(0-9'‘])|\((\d{1,2})\)(?=\s*[A-Za-z'‘])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    if (m[2]) {
      const ch = m[2]
      const idx = LETTERS.indexOf(ch)
      if (idx !== nextLetter) continue
      // "e.g." / "i.e." guard: the next char after the dot must not be another letter+dot
      if (/^[a-z]\./.test(s.slice(m.index + m[1].length + 2).trimStart())) continue
      const start = m.index + m[1].length
      out.push({ index: start, length: 2, kind: 'alpha', label: `${ch}.` })
      nextLetter++
      nextNum = 1
    } else if (m[3]) {
      const n = Number(m[3])
      if (n !== nextNum) {
        if (n === 1) nextNum = 1 // a new numbered run
        else continue
      }
      out.push({ index: m.index, length: m[0].length, kind: 'num', label: `(${n})` })
      nextNum = n + 1
    }
  }
  // A list needs at least two items to be treated as a list
  const alpha = out.filter(x => x.kind === 'alpha').length
  const num = out.filter(x => x.kind === 'num').length
  return out.filter(x => (x.kind === 'alpha' ? alpha >= 2 : num >= 2))
}

/** Splits an item's text into a short heading and the rest, when it starts with one. */
function splitTitle(text: string): { title?: string; text: string } {
  const m = text.match(/^([^.:;]{2,60}?)\.(\s*)(?=[A-Z(‘'])/)
  if (!m || text.length <= m[0].length + 2) return { text }
  const phrase = m[1]!
  // "The strategic level.This includes…": a short phrase run straight into the next
  // sentence is a heading even when it is not in Title Case.
  const runIn = m[2] === '' && /^[A-Z]/.test(phrase) && phrase.trim().split(/\s+/).length <= 6
  if (isTitleCase(phrase) || runIn) {
    return { title: m[1]!.trim(), text: text.slice(m[0].length) }
  }
  return { text }
}

/** Starts a new paragraph at run-in sub-headings such as ".A2 Echelon.Although". */
function splitRunInHeadings(text: string, minCuts = 2): Block[] {
  const blocks: Block[] = []
  const re = /(^|[.:;])([A-Z0-9][A-Za-z0-9&'’() -]{0,58}?)\.(?=[A-Z])/g
  let last = 0
  let pending: string | undefined
  let m: RegExpExecArray | null
  const cuts: { at: number; end: number; title: string }[] = []
  while ((m = re.exec(text))) {
    const phrase = m[2]!
    if (!isTitleCase(phrase)) continue
    const at = m.index + m[1]!.length
    cuts.push({ at, end: at + phrase.length + 1, title: phrase.trim() })
  }
  if (cuts.length < minCuts) return [{ level: 0, text: spaceOut(text) }]
  for (const c of cuts) {
    const before = text.slice(last, c.at)
    if (before.trim()) blocks.push({ level: 0, title: pending, text: spaceOut(before) })
    pending = c.title
    last = c.end
  }
  blocks.push({ level: 0, title: pending, text: spaceOut(text.slice(last)) })
  return blocks
}

export function formatMeaning(meaning: string): Block[] {
  const blocks: Block[] = []
  const paragraphs = meaning.split(/\n+/).map(p => p.trim()).filter(Boolean)

  let sawAlpha = false
  for (const para of paragraphs) {
    const markers = findMarkers(para)
    if (!markers.length) {
      // a paragraph that is itself one list item, e.g. "a.Vanguard. That part…"
      const single = para.match(/^([a-z])\.\s*(?=[A-Z])|^\((\d{1,2})\)\s*/)
      if (single && blocks.length) {
        const isAlpha = !!single[1]
        if (isAlpha) sawAlpha = true
        const { title, text } = splitTitle(para.slice(single[0].length))
        blocks.push({
          level: isAlpha || !sawAlpha ? 1 : 2,
          marker: isAlpha ? `${single[1]}.` : `(${single[2]})`,
          title,
          text: spaceOut(text),
        })
      } else {
        blocks.push(...splitRunInHeadings(para))
      }
      continue
    }

    const intro = para.slice(0, markers[0]!.index)
    if (intro.trim()) blocks.push(...splitRunInHeadings(intro))

    markers.forEach((mk, i) => {
      const end = i + 1 < markers.length ? markers[i + 1]!.index : para.length
      const body = para.slice(mk.index + mk.length, end).trim()
      if (mk.kind === 'alpha') sawAlpha = true
      const { title, text } = splitTitle(body)
      // A run-in sub-heading after the last item ("…sections.B Echelon.B Echelon consists…")
      // starts a new paragraph instead of staying inside the list item.
      const tail = i === markers.length - 1 ? splitRunInHeadings(text, 1) : null
      const itemText = tail && tail.length > 1 ? tail[0]!.text : spaceOut(text)
      blocks.push({
        level: mk.kind === 'alpha' || !sawAlpha ? 1 : 2,
        marker: mk.label,
        title,
        text: itemText,
      })
      if (tail && tail.length > 1) blocks.push(...tail.slice(1))
    })
  }
  return blocks
}

/** Plain-text version of the formatted blocks, used for checking nothing was lost. */
export function blocksToText(blocks: Block[]): string {
  return blocks
    .map(b => [b.marker, b.title ? `${b.title}.` : '', b.text].filter(Boolean).join(' '))
    .join(' ')
}
