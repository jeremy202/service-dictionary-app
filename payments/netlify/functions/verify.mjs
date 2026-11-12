// GET /api/verify?reference=…
// Confirms a payment with Paystack and returns what it unlocks.
import { entitlementFrom, json, paystack, preflight } from '../lib/shared.mjs'

export default async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  const reference = new URL(req.url).searchParams.get('reference') || ''
  if (!/^[\w.=-]{4,100}$/.test(reference)) return json({ error: 'Missing payment reference.' }, 400)

  try {
    const tx = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`)
    const entitlement = entitlementFrom(tx)
    if (entitlement) return json({ status: 'success', entitlement })
    const messages = {
      abandoned: 'The payment was not completed.',
      failed: 'The payment failed. No money was taken.',
      ongoing: 'The payment is still being processed.',
      pending: 'The payment is still being processed.',
      reversed: 'The payment was reversed.',
    }
    // A successful payment that isn't for this app / plan amount unlocks nothing
    const status = tx.status === 'success' ? 'invalid' : tx.status
    return json({ status, message: messages[status] || 'The payment could not be confirmed. Please contact support with your receipt.' })
  } catch (e) {
    console.error('verify', e)
    return json({ error: e.status === 400 || e.status === 404 ? 'Payment not found.' : 'Could not check the payment. Please try again.' }, e.status === 404 ? 404 : 502)
  }
}

export const config = { path: '/api/verify' }
