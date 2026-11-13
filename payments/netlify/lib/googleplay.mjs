// Checks Google Play purchases with the Google Play Developer API.
//
// Setting needed in Netlify (Site configuration → Environment variables):
//   GOOGLE_PLAY_SERVICE_ACCOUNT = the whole JSON key file of a Google Cloud service account
//   that has been invited in Play Console (Users and permissions) with "View financial data"
//   and "Manage orders and subscriptions".
import { createSign } from 'node:crypto'

export const PACKAGE_NAME = 'com.servicedictionary.app'

// Play Console product IDs → app plans
export const PLAY = {
  subscription: 'premium', // base plans: "monthly" and "yearly"
  lifetime: 'lifetime', // one-time product
}

let cached = { token: '', exp: 0 }

function account() {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT
  if (!raw) return null
  try {
    const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
    const a = JSON.parse(text)
    if (a.client_email && a.private_key) return a
  } catch {}
  return null
}

export const playConfigured = () => !!account()

const b64url = s => Buffer.from(s).toString('base64url')

async function accessToken() {
  if (cached.token && cached.exp > Date.now() + 60_000) return cached.token
  const a = account()
  const now = Math.floor(Date.now() / 1000)
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({
    iss: a.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const sig = createSign('RSA-SHA256').update(`${head}.${claim}`).sign(a.private_key, 'base64url')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Google sign-in failed: ${body.error_description || body.error || res.status}`)
  cached = { token: body.access_token, exp: Date.now() + body.expires_in * 1000 }
  return cached.token
}

async function api(path) {
  const res = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}${path}`, {
    headers: { Authorization: `Bearer ${await accessToken()}` },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(body.error?.message || `Google Play error ${res.status}`)
    err.status = res.status
    throw err
  }
  return body
}

const ACTIVE_SUB = new Set(['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED'])

/**
 * Returns what a Play purchase unlocks, or null if it isn't paid / has ended.
 * A cancelled subscription stays active until the end of the period already paid for.
 */
export async function playEntitlement(productId, token) {
  const tail = token.slice(-10)
  if (productId === PLAY.lifetime) {
    const p = await api(`/purchases/products/${PLAY.lifetime}/tokens/${encodeURIComponent(token)}`)
    if (p.purchaseState !== 0) return null // 1 = cancelled/refunded, 2 = pending
    return {
      plan: 'lifetime', email: '', source: 'play', reference: p.orderId || `play-${tail}`,
      paidAt: new Date(Number(p.purchaseTimeMillis) || Date.now()).toISOString(), expiresAt: null,
    }
  }
  if (productId === PLAY.subscription) {
    const s = await api(`/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`)
    const item = (s.lineItems || []).find(l => l.productId === PLAY.subscription)
    if (!item || !ACTIVE_SUB.has(s.subscriptionState)) return null
    const expiresAt = new Date(item.expiryTime)
    if (!(expiresAt.getTime() > Date.now())) return null
    const base = item.offerDetails?.basePlanId
    if (base !== 'monthly' && base !== 'yearly') return null
    return {
      plan: base, email: '', source: 'play',
      reference: s.latestOrderId || `play-${tail}`,
      paidAt: new Date(s.startTime || Date.now()).toISOString(), expiresAt: expiresAt.toISOString(),
    }
  }
  return null
}
