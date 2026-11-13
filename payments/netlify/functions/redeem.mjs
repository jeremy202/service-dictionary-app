// POST /api/redeem  { code }
// Access codes give full access for 30 days without paying, e.g. for Google Play's app
// reviewers (Play requires a way for them to see paid content). Only the SHA-256 of each
// code is kept here. To add or replace a code, add its hash below (or in the
// ACCESS_CODE_HASHES setting, comma-separated) and redeploy.
import { createHash } from 'node:crypto'
import { json, preflight } from '../lib/shared.mjs'

const HASHES = [
  '2f986af0da24edbae1dc26db1181bdb86be581592b7eaabc3a09a7523114aa27', // Google Play review
  ...(process.env.ACCESS_CODE_HASHES || '').split(',').map(s => s.trim()).filter(Boolean),
]
const DAYS = 30

export default async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)
  let body = {}
  try { body = await req.json() } catch {}
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  if (!code || code.length > 64) return json({ error: 'Enter an access code.' }, 400)
  const hash = createHash('sha256').update(code).digest('hex')
  if (!HASHES.includes(hash)) return json({ error: 'That access code is not valid.' }, 404)
  const now = Date.now()
  return json({
    status: 'success',
    entitlement: {
      plan: 'yearly', email: '', source: 'code', reference: `Access code ${code.slice(0, 3)}…`,
      paidAt: new Date(now).toISOString(), expiresAt: new Date(now + DAYS * 86_400_000).toISOString(),
    },
  })
}

export const config = { path: '/api/redeem' }
