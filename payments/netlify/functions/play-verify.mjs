// POST /api/play-verify  { productId, token }
// Confirms a Google Play purchase with Google and returns what it unlocks.
//  200 { status: 'success', entitlement }   paid and active
//  200 { status: 'inactive' }               not paid, refunded, or ended
//  501 { error }                            Google Play checking isn't set up yet
import { json, preflight } from '../lib/shared.mjs'
import { PLAY, playConfigured, playEntitlement } from '../lib/googleplay.mjs'

export default async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)
  if (!playConfigured()) return json({ error: 'Google Play checking is not set up on the payment service.' }, 501)

  let body = {}
  try { body = await req.json() } catch {}
  const { productId, token } = body
  if (![PLAY.subscription, PLAY.lifetime].includes(productId)) return json({ error: 'Unknown product.' }, 400)
  if (typeof token !== 'string' || token.length < 20 || token.length > 1000) return json({ error: 'Missing purchase token.' }, 400)

  try {
    const entitlement = await playEntitlement(productId, token)
    return json(entitlement ? { status: 'success', entitlement } : { status: 'inactive' })
  } catch (e) {
    console.error('play-verify', e)
    // Google answers 400/404/410 for tokens that don't belong to this app or have expired
    if ([400, 404, 410].includes(e.status)) return json({ status: 'inactive' })
    return json({ error: 'Could not check the purchase with Google Play. Please try again.' }, 502)
  }
}

export const config = { path: '/api/play-verify' }
