import { Capacitor } from '@capacitor/core'
import { NativePurchases, PURCHASE_TYPE, type Transaction } from '@capgo/native-purchases'
import { PLANS, type PlanId } from '~/utils/plans'
import type { Entitlement } from './useAccess'

/**
 * Paying with Google Play Billing (Play Store version only).
 *
 * Products to create in Play Console (Monetize → Products):
 *   Subscription  "premium"  with two auto-renewing base plans: "monthly" (1 month) and "yearly" (1 year)
 *   One-time product "lifetime"
 *
 * After Google Play takes the payment, the payment service (/api/play-verify) checks the
 * purchase with Google before Premium unlocks. Until the service has its Google key, the app
 * trusts the purchase Google Play reported to it, so testing can start straight away.
 * Every launch re-reads the person's purchases from Google Play, so renewals, cancellations
 * and refunds are picked up automatically.
 */
export const PLAY_PRODUCTS = { subscription: 'premium', lifetime: 'lifetime' } as const
const DAY = 86_400_000

const prices = ref<Partial<Record<PlanId, string>>>({})
const busy = ref(false)
let pricesLoaded = false
let refreshed = false

type Result = { ok: true; entitlement: Entitlement } | { ok: false; error: string; cancelled?: boolean }

const isPurchased = (t: Transaction) => t.purchaseState === undefined || t.purchaseState === '1' || t.purchaseState === 'PURCHASED'
const isPending = (t: Transaction) => t.purchaseState === '2' || t.purchaseState === 'PENDING'

export function usePlayBilling() {
  const config = useRuntimeConfig().public
  const enabled = config.store === 'play' && Capacitor.getPlatform() === 'android'
  const api = (config.paymentsApi as string || '').replace(/\/$/, '')
  const access = useAccess()

  /** Prices in the person's own currency, as Google Play shows them. */
  async function loadPrices() {
    if (!enabled || pricesLoaded) return
    pricesLoaded = true
    try {
      const subs = await NativePurchases.getProducts({ productIdentifiers: [PLAY_PRODUCTS.subscription], productType: PURCHASE_TYPE.SUBS })
      for (const p of subs.products) {
        // For subscriptions, `identifier` is the base plan id
        if (p.identifier === 'monthly' || p.identifier === 'yearly') prices.value[p.identifier] = p.priceString
      }
      const once = await NativePurchases.getProducts({ productIdentifiers: [PLAY_PRODUCTS.lifetime], productType: PURCHASE_TYPE.INAPP })
      if (once.products[0]) prices.value.lifetime = once.products[0].priceString
    } catch (e) {
      pricesLoaded = false
      console.warn('Play prices', e)
    }
  }

  /** What a Play purchase unlocks: checked by the payment service, or read from the purchase itself. */
  async function entitlementFor(t: Transaction, planHint?: PlanId): Promise<Entitlement | null> {
    const token = t.purchaseToken || t.transactionId
    const productId = t.productIdentifier
    if (api && token) {
      try {
        const res = await fetch(`${api}/api/play-verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, token }),
        })
        if (res.ok) {
          const r = await res.json()
          return r.status === 'success' ? r.entitlement as Entitlement : null
        }
        // 501 = Google checking not set up yet; anything else = service trouble: fall back below
      } catch {}
    }
    if (!isPurchased(t)) return null
    const paidAt = t.purchaseDate || new Date().toISOString()
    if (productId === PLAY_PRODUCTS.lifetime) {
      return { plan: 'lifetime', email: '', source: 'play', reference: t.orderId || 'Google Play', paidAt, expiresAt: null }
    }
    if (productId === PLAY_PRODUCTS.subscription) {
      // Google Play only lists subscriptions that are still active, and this is re-checked
      // on every launch, so a short window is enough.
      const plan: PlanId = planHint ?? (access.entitlement.value?.source === 'play' && access.entitlement.value.plan !== 'lifetime' ? access.entitlement.value.plan : 'monthly')
      const end = t.expirationDate ? new Date(t.expirationDate).getTime() : Date.now() + 7 * DAY
      return { plan, email: '', source: 'play', reference: t.orderId || 'Google Play', paidAt, expiresAt: new Date(end).toISOString() }
    }
    return null
  }

  async function acknowledge(t: Transaction) {
    const token = t.purchaseToken || t.transactionId
    if (!token || t.isAcknowledged) return
    try { await NativePurchases.acknowledgePurchase({ purchaseToken: token }) } catch (e) { console.warn('acknowledge', e) }
  }

  async function buy(plan: PlanId): Promise<Result> {
    if (!enabled) return { ok: false, error: 'Google Play is not available on this device.' }
    if (access.hasPlan.value) return { ok: false, error: 'You already have an active plan.' }
    busy.value = true
    try {
      const sub = plan !== 'lifetime'
      const t = await NativePurchases.purchaseProduct(sub
        ? { productIdentifier: PLAY_PRODUCTS.subscription, planIdentifier: plan, productType: PURCHASE_TYPE.SUBS, autoAcknowledgePurchases: false }
        : { productIdentifier: PLAY_PRODUCTS.lifetime, productType: PURCHASE_TYPE.INAPP, autoAcknowledgePurchases: false })
      if (isPending(t)) return { ok: false, error: 'Your payment is pending with Google Play. Premium unlocks as soon as it completes.' }
      const e = await entitlementFor(t, plan)
      if (!e) return { ok: false, error: 'Google Play could not confirm this purchase. If you were charged, tap Restore purchase.' }
      // Acknowledge only after Premium is granted; unacknowledged purchases are refunded by Google after 3 days
      await acknowledge(t)
      access.syncPlayEntitlement(e)
      return { ok: true, entitlement: e }
    } catch (e: any) {
      const msg = String(e?.message || e || '')
      if (/cancel/i.test(msg)) return { ok: false, error: '', cancelled: true }
      if (/already own/i.test(msg)) return restore()
      return { ok: false, error: msg || 'The purchase did not go through.' }
    } finally {
      busy.value = false
    }
  }

  /** Re-reads every purchase this Google account has made in the app. */
  async function restore(): Promise<Result> {
    if (!enabled) return { ok: false, error: 'Google Play is not available on this device.' }
    busy.value = true
    try {
      const { purchases } = await NativePurchases.getPurchases()
      const found: Entitlement[] = []
      for (const t of purchases.filter(isPurchased)) {
        const e = await entitlementFor(t)
        if (e) { found.push(e); await acknowledge(t) }
      }
      const end = (x: Entitlement) => (x.expiresAt === null ? Infinity : new Date(x.expiresAt).getTime())
      const best = found.sort((a, b) => end(b) - end(a))[0] ?? null
      access.syncPlayEntitlement(best)
      return best ? { ok: true, entitlement: best } : { ok: false, error: 'No purchase found for the Google account on this phone.' }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Could not reach Google Play. Please try again.' }
    } finally {
      busy.value = false
    }
  }

  /** Once per launch: pick up renewals, cancellations and refunds. */
  async function refresh() {
    if (!enabled || refreshed) return
    refreshed = true
    await restore()
  }

  function manage() {
    if (enabled) NativePurchases.manageSubscriptions().catch(() => {})
  }

  const priceLabel = (plan: PlanId) => prices.value[plan] ?? null
  const planName = (id: PlanId) => PLANS.find(p => p.id === id)?.name ?? id

  return { enabled, busy, prices, priceLabel, planName, loadPrices, buy, restore, refresh, manage }
}
