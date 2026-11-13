import { Capacitor } from '@capacitor/core'
import { Device } from '@capacitor/device'
import { FREE_DAILY_ENTRIES, TRIAL_DAYS, type PlanId } from '~/utils/plans'

/**
 * Who can open what:
 *  - 7-day free trial: everything unlocked.
 *  - With a paid plan (monthly / yearly until it expires, lifetime forever): everything unlocked.
 *  - Otherwise: browsing and search stay open; 10 entry pages a day are free.
 *
 * Strict trial: the trial start comes from the payment service (/api/trial), recorded once
 * per phone by its device ID and using the server's clock. So reinstalling the app, clearing
 * its data or changing the phone's date does not give a new trial. The app's clock also never
 * goes backwards, so winding the phone's date back doesn't extend a trial or plan.
 * Without internet on the very first launch, a local trial starts and the server's date
 * replaces it as soon as the phone is online.
 */
export interface Entitlement {
  plan: PlanId
  email: string
  reference: string
  paidAt: string // ISO
  expiresAt: string | null // ISO; null = lifetime
  source?: 'paystack' | 'play'
}

const DAY = 86_400_000
const K_FIRST = 'sd-first-open'
const K_TRIAL = 'sd-trial' // { startedAt, offset } from the server
const K_SEEN = 'sd-last-seen'
const K_DEVICE = 'sd-device'
const K_PLAN = 'sd-plan'
const K_VIEWS = 'sd-views'

const firstOpen = ref<number>(0)
const entitlement = ref<Entitlement | null>(null)
const views = ref<{ day: string; count: number }>({ day: '', count: 0 })
const now = ref(Date.now())
const trialSynced = ref(false)
let offset = 0 // server time − phone time
let lastSeen = 0
let started = false
let syncing: Promise<void> | null = null

function read<T>(k: string): T | null {
  try { return JSON.parse(localStorage.getItem(k) || 'null') as T } catch { return null }
}
function write(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)) } catch {}
}

/** Current time that never goes backwards and follows the server's clock when known. */
function tick() {
  const t = Math.max(Date.now() + offset, lastSeen)
  if (t - lastSeen > 30_000) { lastSeen = t; write(K_SEEN, t) }
  now.value = t
}
const today = () => new Date(now.value).toISOString().slice(0, 10)

async function deviceId(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { identifier } = await Device.getId()
      if (identifier && identifier.length >= 8) return `and-${identifier}`
    } catch {}
  }
  let id = read<string>(K_DEVICE)
  if (!id) { id = `web-${crypto.randomUUID()}`; write(K_DEVICE, id) }
  return id
}

/** Gets (or registers) this phone's trial start from the payment service. */
function syncTrial(api: string) {
  if (!api || syncing) return syncing
  syncing = (async () => {
    try {
      const res = await fetch(`${api}/api/trial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: await deviceId() }),
      })
      if (!res.ok) return
      const r = await res.json()
      if (typeof r.startedAt !== 'number' || typeof r.now !== 'number') return
      offset = r.now - Date.now()
      // The earliest known start wins (server record, or an older local one from before)
      firstOpen.value = Math.min(r.startedAt, firstOpen.value || r.startedAt)
      write(K_FIRST, firstOpen.value)
      write(K_TRIAL, { startedAt: firstOpen.value, offset })
      trialSynced.value = true
      tick()
    } catch {
      // offline: keep the saved trial dates
    } finally {
      syncing = null
    }
  })()
  return syncing
}

function start(api: string) {
  if (started || !import.meta.client) return
  started = true
  lastSeen = read<number>(K_SEEN) ?? 0
  const saved = read<{ startedAt: number; offset: number }>(K_TRIAL)
  if (saved) { offset = saved.offset || 0; trialSynced.value = true }
  tick()
  let f = read<number>(K_FIRST)
  if (saved?.startedAt) f = Math.min(f || saved.startedAt, saved.startedAt)
  if (!f || typeof f !== 'number') { f = now.value; write(K_FIRST, f) }
  firstOpen.value = f
  entitlement.value = read<Entitlement>(K_PLAN)
  views.value = read<{ day: string; count: number }>(K_VIEWS) ?? { day: today(), count: 0 }
  syncTrial(api)
  // keep "now" fresh so the trial / plan end on time while the app is open
  setInterval(tick, 60_000)
}

export function useAccess() {
  const api = (useRuntimeConfig().public.paymentsApi as string || '').replace(/\/$/, '')
  start(api)

  const trialEnds = computed(() => firstOpen.value + TRIAL_DAYS * DAY)
  const inTrial = computed(() => now.value < trialEnds.value)
  const trialDaysLeft = computed(() => Math.max(0, Math.ceil((trialEnds.value - now.value) / DAY)))

  const hasPlan = computed(() => {
    const e = entitlement.value
    if (!e) return false
    return e.expiresAt === null || new Date(e.expiresAt).getTime() > now.value
  })
  const planExpired = computed(() => !!entitlement.value && !hasPlan.value)
  const planDaysLeft = computed(() => {
    const e = entitlement.value
    if (!e?.expiresAt) return null
    return Math.max(0, Math.ceil((new Date(e.expiresAt).getTime() - now.value) / DAY))
  })

  const unlimited = computed(() => hasPlan.value || inTrial.value)
  const usedToday = computed(() => (views.value.day === today() ? views.value.count : 0))
  const freeLeftToday = computed(() => Math.max(0, FREE_DAILY_ENTRIES - usedToday.value))

  /** Call when an entry page is about to open. Returns false when today's free entries are used up. */
  function useEntry(): boolean {
    tick()
    if (unlimited.value) return true
    const d = today()
    const count = views.value.day === d ? views.value.count : 0
    if (count >= FREE_DAILY_ENTRIES) return false
    views.value = { day: d, count: count + 1 }
    write(K_VIEWS, views.value)
    return true
  }

  function setEntitlement(e: Entitlement) {
    // never replace a longer plan with a shorter one (e.g. restoring an old monthly over lifetime)
    const cur = entitlement.value
    const end = (x: Entitlement | null) => (x ? (x.expiresAt === null ? Infinity : new Date(x.expiresAt).getTime()) : 0)
    if (cur && end(cur) >= end(e) && hasPlan.value) return
    entitlement.value = e
    write(K_PLAN, e)
  }

  /** Google Play is the source of truth for Play purchases: renewals, cancellations and refunds
   *  replace what was saved, even if that shortens it. Leaves a Paystack plan untouched. */
  function syncPlayEntitlement(e: Entitlement | null) {
    const cur = entitlement.value
    if (cur && cur.source !== 'play' && (cur.expiresAt === null || new Date(cur.expiresAt).getTime() > now.value)) {
      if (e) setEntitlement(e)
      return
    }
    entitlement.value = e
    try { e ? write(K_PLAN, e) : localStorage.removeItem(K_PLAN) } catch {}
  }

  return {
    inTrial, trialDaysLeft, hasPlan, planExpired, planDaysLeft, entitlement, trialSynced,
    unlimited, freeLeftToday, usedToday, useEntry, setEntitlement, syncPlayEntitlement,
    /** Resolves once the server's trial date has been fetched (or failed). */
    syncTrial: () => syncTrial(api) ?? Promise.resolve(),
  }
}
