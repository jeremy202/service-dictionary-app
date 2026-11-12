// POST /api/pay  { plan: 'monthly' | 'yearly' | 'lifetime', email }
// Starts a Paystack payment and returns the secure checkout page to open.
import { activeEntitlementFor, APP_ID, json, paystack, PLANS, preflight, validEmail } from '../lib/shared.mjs'

export default async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  let body = {}
  try { body = await req.json() } catch {}
  const plan = PLANS[body.plan]
  if (!plan) return json({ error: 'Choose a plan.' }, 400)
  if (!validEmail(body.email)) return json({ error: 'Enter a valid email address.' }, 400)

  const site = process.env.URL || new URL(req.url).origin
  try {
    // One plan at a time: no new payment while this email has an active plan
    const active = await activeEntitlementFor(body.email.trim().toLowerCase())
    if (active) {
      const until = active.expiresAt === null ? 'for life' : `until ${new Date(active.expiresAt).toDateString().slice(4)}`
      return json({ error: `This email already has an active ${active.plan} plan ${until}. Tap "Restore purchase" to use it on this phone.`, entitlement: active }, 409)
    }
    const data = await paystack('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: body.email.trim().toLowerCase(),
        amount: plan.amount,
        currency: 'NGN',
        callback_url: `${site}/paid`,
        metadata: {
          app: APP_ID,
          plan: body.plan,
          custom_fields: [{ display_name: 'Plan', variable_name: 'plan', value: `Service Dictionary ${plan.name}` }],
        },
      }),
    })
    return json({ url: data.authorization_url, reference: data.reference })
  } catch (e) {
    console.error('pay', e)
    return json({ error: 'Could not start the payment. Please try again.' }, 502)
  }
}

export const config = { path: '/api/pay' }
