// POST /api/trial  { device }
// Strict 7-day free trial: the trial start is recorded here, once per phone, using the
// server's clock. Reinstalling the app, clearing its data or changing the phone's date
// does not start a new trial. Returns { startedAt, now } (milliseconds).
import { getStore } from '@netlify/blobs'
import { json, preflight } from '../lib/shared.mjs'

export default async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  let body = {}
  try { body = await req.json() } catch {}
  const device = typeof body.device === 'string' ? body.device.trim() : ''
  if (!/^[\w.:-]{8,128}$/.test(device)) return json({ error: 'Missing device id.' }, 400)

  const trials = getStore({ name: 'trials', consistency: 'strong' })
  const now = Date.now()
  try {
    // Written once; never overwritten
    await trials.setJSON(device, { startedAt: now }, { onlyIfNew: true })
    const rec = await trials.get(device, { type: 'json' })
    return json({ startedAt: rec?.startedAt ?? now, now })
  } catch (e) {
    console.error('trial', e)
    return json({ error: 'Could not check the trial.' }, 502)
  }
}

export const config = { path: '/api/trial' }
