// Encrypts the manual for the app's locked "Manual" tab.
//
//   MANUAL_CODE=XXXX-XXXX-XXXX node scripts/build-manual.mjs <folder with manual.pdf and index.json>
//
// Output: public/manual/m1.bin (the PDF) and public/manual/m2.bin (contents + search text).
// Both are AES-256-GCM encrypted with a key derived from the access code (PBKDF2-SHA256), so
// the manual cannot be read from the app package without the code. The plain files are
// never added to the repository.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pbkdf2Sync, randomBytes, createCipheriv } from 'node:crypto'
import { gzipSync } from 'node:zlib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = process.argv[2]
const code = (process.env.MANUAL_CODE || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
if (!src || code.length < 8) {
  console.error('Usage: MANUAL_CODE=... node scripts/build-manual.mjs <source folder>')
  process.exit(1)
}

export const ITERATIONS = 400_000
const salt = randomBytes(16)
const key = pbkdf2Sync(code, salt, ITERATIONS, 32, 'sha256')

function seal(plain) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([c.update(plain), c.final(), c.getAuthTag()])
  // Header: "SDM1" | salt (16) | iv (12) | ciphertext + tag
  return Buffer.concat([Buffer.from('SDM1'), salt, iv, body])
}

const out = join(root, 'public/manual')
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'm1.bin'), seal(readFileSync(join(src, 'manual.pdf'))))
writeFileSync(join(out, 'm2.bin'), seal(gzipSync(readFileSync(join(src, 'index.json')))))
console.log('Encrypted manual written to public/manual (m1.bin, m2.bin)')
