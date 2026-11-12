import { App as CapApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import type { PlanId } from '~/utils/plans'
import type { Entitlement } from './useAccess'

/**
 * Paying with Paystack.
 *
 * 1. The app asks the payment service (payments/ folder, on Netlify) to start a payment.
 *    The service holds the Paystack secret key and sets the price, so neither is in the app.
 * 2. Paystack's secure checkout opens in an in-app browser (card, bank transfer, USSD).
 * 3. When the person finishes, Paystack sends them to the service's "paid" page, which
 *    returns to the app (servicedictionary://paid). The app then asks the service to
 *    confirm the payment with Paystack and unlocks the plan.
 */
const K_PENDING = 'sd-pending-payment'
const busy = ref(false)
const message = ref('')
/** Reference of a payment started but not yet confirmed; paying is locked while set. */
const pending = ref<string | null>(null)
let listening = false
let loaded = false

const setPending = (ref: string | null) => {
  pending.value = ref
  try { ref ? localStorage.setItem(K_PENDING, ref) : localStorage.removeItem(K_PENDING) } catch {}
}
// Paystack statuses that mean the payment did not go through, so the person may try again
const FINISHED_UNPAID = new Set(['abandoned', 'failed', 'reversed', 'invalid'])

type Result = { ok: true; entitlement: Entitlement } | { ok: false; error: string }

export function usePayments() {
  const api = (useRuntimeConfig().public.paymentsApi as string || '').replace(/\/$/, '')
  const configured = !!api
  const access = useAccess()
  if (!loaded && import.meta.client) {
    loaded = true
    try { pending.value = localStorage.getItem(K_PENDING) } catch {}
  }

  async function call(path: string, init?: RequestInit): Promise<any> {
    const res = await fetch(`${api}${path}`, { ...init, headers: { 'Content-Type': 'application/json' } })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body?.error || 'The payment service is not responding. Please try again.')
    return body
  }

  async function verify(reference: string): Promise<Result> {
    try {
      const r = await call(`/api/verify?reference=${encodeURIComponent(reference)}`)
      if (r.status === 'success' && r.entitlement) {
        access.setEntitlement(r.entitlement)
        if (pending.value === reference) setPending(null)
        return { ok: true, entitlement: r.entitlement }
      }
      // Not paid (closed checkout, failed card…): unlock paying again
      if (FINISHED_UNPAID.has(r.status) && pending.value === reference) setPending(null)
      return { ok: false, error: r.message || 'Payment not completed.' }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }

  /** Checks a payment that was started earlier (e.g. the app was closed during checkout). */
  async function checkPending(): Promise<Result | null> {
    const ref = pending.value
    if (!ref || !configured) return null
    busy.value = true
    const r = await verify(ref)
    busy.value = false
    return r
  }

  function listen(onDone: (r: Result) => void) {
    if (listening || !Capacitor.isNativePlatform()) return
    listening = true
    // Back from the "paid" page via servicedictionary://paid?reference=…
    CapApp.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith('servicedictionary://paid')) return
      try { await Browser.close() } catch {}
      const ref = new URL(url.replace('servicedictionary://', 'https://x/')).searchParams.get('reference')
      if (ref) { busy.value = true; onDone(await verify(ref)); busy.value = false }
    })
    // The person closed the checkout themselves
    Browser.addListener('browserFinished', async () => {
      const r = await checkPending()
      if (r) onDone(r)
    })
  }

  async function pay(plan: PlanId, email: string): Promise<{ error?: string }> {
    if (!configured) return { error: 'Payments are not switched on yet.' }
    // Never start a second payment while one is being confirmed or a plan is active
    if (pending.value) return { error: 'A payment is still being confirmed. Check its status first.' }
    if (access.hasPlan.value) return { error: 'You already have an active plan.' }
    busy.value = true
    message.value = ''
    try {
      const r = await call('/api/pay', { method: 'POST', body: JSON.stringify({ plan, email }) })
      setPending(r.reference)
      if (Capacitor.isNativePlatform()) await Browser.open({ url: r.url, presentationStyle: 'popover', toolbarColor: '#16332a' })
      else window.open(r.url, '_blank')
      return {}
    } catch (e: any) {
      return { error: e.message }
    } finally {
      busy.value = false
    }
  }

  async function restore(email: string): Promise<Result> {
    if (!configured) return { ok: false, error: 'Payments are not switched on yet.' }
    busy.value = true
    try {
      const r = await call('/api/restore', { method: 'POST', body: JSON.stringify({ email }) })
      if (r.entitlement) {
        access.setEntitlement(r.entitlement)
        return { ok: true, entitlement: r.entitlement }
      }
      return { ok: false, error: r.message || 'No active purchase found for this email.' }
    } catch (e: any) {
      return { ok: false, error: e.message }
    } finally {
      busy.value = false
    }
  }

  return { configured, busy, message, pending, pay, verify, restore, checkPending, listen }
}
