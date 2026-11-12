// Rebuilds app/data/dictionary.json from the CSV files in data/source.
// Run with: node scripts/build-data.mjs
// Content is copied exactly as it appears in the CSVs; only the byte-order mark is removed.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function parseCsv(text) {
  text = text.replace(/^﻿/, '')
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.slice(1).filter(r => r.length >= 2 && (r[0] || r[1]))
}

const read = f => parseCsv(readFileSync(join(root, 'data/source', f), 'utf8'))

const data = {
  t: read('Words_and_meaning.csv').map(([w, m]) => [w, m]), // [term, meaning]
  a: read('ABBREVIATION.csv').map(([m, a]) => [m, a]), // [meaning, abbreviation]
  p: read('prowords.csv').map(([w, m]) => [w, m]), // [proword, meaning]
}

writeFileSync(join(root, 'app/data/dictionary.json'), JSON.stringify(data))
console.log(`Terms: ${data.t.length}  Abbreviations: ${data.a.length}  Prowords: ${data.p.length}`)
