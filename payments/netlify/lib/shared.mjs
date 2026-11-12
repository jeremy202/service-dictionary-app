// Shared code for the Service Dictionary payment service.
// Prices live here (in kobo), so the app cannot change what is charged.

export const APP_ID = 'service-dictionary'

export const PLANS = {
  monthly: { name: 'Monthly', amount: 500_00, days: 30 },
  yearly: { name: 'Yearly', amount: 3_000_00, days: 365 },
  lifetime: { name: 'Lifetime', amount: 12_500_00, days: null },
}

const DAY = 86_400_000

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } })
}

export function preflight(req) {
  return req.method === 'OPTIONS' ? new Response(null, { status: 204, headers: cors }) : null
}

/** Calls the Paystack API with the secret key from the PAYSTACK_SECRET_KEY setting. */
export async function paystack(path, init = {}) {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set on the payment service.')
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.status === false) {
    const err = new Error(body.message || `Paystack error ${res.status}`)
    err.status = res.status
    throw err
  }
  return body.data
}

export const validEmail = e => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim()) && e.length < 200

const meta = tx => {
  if (!tx || !tx.metadata) return {}
  if (typeof tx.metadata === 'string') { try { return JSON.parse(tx.metadata) } catch { return {} } }
  return tx.metadata
}

/**
 * Turns a successful Paystack transaction into what the app unlocks, after checking that it
 * was for this app, in naira, and paid in full for the plan it claims.
 */
export function entitlementFrom(tx) {
  if (!tx || tx.status !== 'success') return null
  const m = meta(tx)
  if (m.app !== APP_ID) return null
  const plan = PLANS[m.plan]
  if (!plan || tx.currency !== 'NGN' || Number(tx.amount) < plan.amount) return null
  const paidAt = new Date(tx.paid_at || tx.paidAt || tx.created_at || Date.now())
  return {
    plan: m.plan,
    email: tx.customer?.email || '',
    reference: tx.reference,
    paidAt: paidAt.toISOString(),
    expiresAt: plan.days === null ? null : new Date(paidAt.getTime() + plan.days * DAY).toISOString(),
  }
}

/** The best of several entitlements: lifetime first, otherwise the one that lasts longest. */
export function best(list) {
  const end = e => (e.expiresAt === null ? Infinity : new Date(e.expiresAt).getTime())
  return list.filter(Boolean).sort((a, b) => end(b) - end(a))[0] || null
}

/** The active plan paid for with this email, or null. Asks Paystack, so it can't be faked. */
export async function activeEntitlementFor(email) {
  let customer
  try {
    customer = await paystack(`/customer/${encodeURIComponent(email)}`)
  } catch (e) {
    if (e.status === 404 || e.status === 400) return null // never paid
    throw e
  }
  const txs = await paystack(`/transaction?customer=${customer.id}&status=success&perPage=100`)
  const now = Date.now()
  const active = (txs || [])
    .map(tx => entitlementFrom({ ...tx, customer: tx.customer || { email } }))
    .filter(e => e && (e.expiresAt === null || new Date(e.expiresAt).getTime() > now))
  return best(active)
}
