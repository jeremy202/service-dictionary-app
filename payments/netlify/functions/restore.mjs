// POST /api/restore  { email }
// Finds the best active purchase made with this email (e.g. on a new phone).
import { activeEntitlementFor, json, preflight, validEmail } from '../lib/shared.mjs'

export default async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  let body = {}
  try { body = await req.json() } catch {}
  if (!validEmail(body.email)) return json({ error: 'Enter a valid email address.' }, 400)
  const email = body.email.trim().toLowerCase()

  try {
    const entitlement = await activeEntitlementFor(email)
    return entitlement ? json({ entitlement }) : json({ message: 'No active purchase found for this email.' })
  } catch (e) {
    console.error('restore', e)
    return json({ error: 'Could not check purchases. Please try again.' }, 502)
  }
}

export const config = { path: '/api/restore' }
