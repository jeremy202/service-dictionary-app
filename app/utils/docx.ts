/**
 * Word (.docx) and text file support for Auto-abbreviate.
 *
 * A .docx is a zip of XML files. The text sits in <w:t> elements inside paragraphs (<w:p>),
 * split into runs that carry the formatting. We change only the text of those elements and
 * leave everything else in the package untouched, so styles, tables, headers, footers,
 * pictures and layout stay as they were. A phrase that spans several runs is replaced in
 * the first run, so the abbreviation takes the formatting of the phrase's first word.
 */
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate'
import { findMatches, tally, type Hit, type Match, type Options } from './abbreviate'

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const XML_NS = 'http://www.w3.org/XML/1998/namespace'

// The parts of the document that hold readable text
const TEXT_PART = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/

export interface Docx { files: Record<string, Uint8Array> }

export function readDocx(bytes: Uint8Array): Docx {
  const files = unzipSync(bytes)
  if (!files['word/document.xml']) throw new Error('not-docx')
  return { files }
}

interface Seg { el: Element | null; text: string; s: number; e: number; brk?: 'tab' | 'line' }

/** The text pieces of one paragraph, in order. Tabs and line breaks are kept as separators. */
function segments(p: Element): Seg[] {
  const out: Seg[] = []
  let at = 0
  const walk = (node: Element) => {
    for (const c of Array.from(node.children)) {
      if (c.namespaceURI !== W) { walk(c); continue }
      const n = c.localName
      if (n === 'p' || n === 'txbxContent' || n === 'del' || n === 'instrText' || n === 'delText') continue // nested / deleted / field code
      if (n === 't') { const t = c.textContent ?? ''; out.push({ el: c, text: t, s: at, e: at + t.length }); at += t.length; continue }
      if (n === 'tab' || n === 'br' || n === 'cr') { out.push({ el: null, text: '\n', s: at, e: at + 1, brk: n === 'tab' ? 'tab' : 'line' }); at += 1; continue }
      walk(c)
    }
  }
  walk(p)
  return out
}

function paragraphs(doc: Document) {
  return Array.from(doc.getElementsByTagNameNS(W, 'p'))
}

function parse(xml: Uint8Array) {
  return new DOMParser().parseFromString(strFromU8(xml), 'application/xml')
}

/** Plain text of the main document, one line per paragraph (for the preview and .txt). */
export function docxText(d: Docx): string {
  const doc = parse(d.files['word/document.xml']!)
  return paragraphs(doc).map(p => segments(p).map(s => (s.el ? s.text : s.brk === 'tab' ? '\t' : '\n')).join('')).join('\n')
}

/** Abbreviates every text part of the document. Returns the new .docx and what was replaced. */
export function abbreviateDocx(d: Docx, opts: Options) {
  const hits = new Map<string, Hit>()
  const files: Record<string, Uint8Array> = { ...d.files }
  for (const name of Object.keys(d.files)) {
    if (!TEXT_PART.test(name)) continue
    const doc = parse(d.files[name]!)
    if (doc.getElementsByTagName('parsererror').length) continue
    let changed = false
    for (const p of paragraphs(doc)) {
      const segs = segments(p)
      if (!segs.length) continue
      const full = segs.map(s => s.text).join('')
      const ms = findMatches(full, opts)
      if (!ms.length) continue
      tally(ms, hits)
      apply(segs, ms)
      changed = true
    }
    if (changed) files[name] = strToU8(new XMLSerializer().serializeToString(doc))
  }
  return { bytes: zipSync(files), hits }
}

function apply(segs: Seg[], ms: Match[]) {
  const text = segs.map(s => s.text)
  // right to left, so earlier offsets stay valid
  for (let k = ms.length - 1; k >= 0; k--) {
    const m = ms[k]!
    segs.forEach((s, i) => {
      if (!s.el || s.e <= m.start || s.s >= m.end) return
      const a = Math.max(m.start, s.s) - s.s
      const b = Math.min(m.end, s.e) - s.s
      text[i] = text[i]!.slice(0, a) + (m.start >= s.s && m.start < s.e ? m.abbr : '') + text[i]!.slice(b)
    })
  }
  segs.forEach((s, i) => {
    if (!s.el || text[i] === s.text) return
    s.el.textContent = text[i]!
    s.el.setAttributeNS(XML_NS, 'xml:space', 'preserve')
  })
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** A plain Word document from text: one paragraph per line. */
export function textToDocx(text: string): Uint8Array {
  const body = text.split(/\r?\n/).map(line => {
    const parts = line.split('\t').map(t => `<w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`)
    return `<w:p>${parts.join('<w:r><w:tab/></w:r>')}</w:p>`
  }).join('')
  const files = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`),
  }
  return zipSync(files)
}

/** Reads a .txt file: UTF-8, or Windows-1252 for older files. */
export function decodeText(bytes: Uint8Array): string {
  let s: string
  try { s = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { s = new TextDecoder('windows-1252').decode(bytes) }
  return s.replace(/^﻿/, '')
}
