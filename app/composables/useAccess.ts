import { FREE_DAILY_ENTRIES, TRIAL_DAYS, type PlanId } from '~/utils/plans'

/**
 * Who can open what:
 *  - First 7 days after the app is first opened: free trial, everything unlocked.
 *  - With a paid plan (monthly / yearly until it expires, lifetime forever): everything unlocked.
 *  - Otherwise: browsing and search stay open; 10 entry pages a day are free.
 * State is kept on the phone.
 */
export interface Entitlement {
  plan: PlanId
  email: string
  reference: string
  paidAt: string // ISO
  expiresAt: string | null // ISO; null = lifetime
}

const DAY = 86_400_000
const K_FIRST = 'sd-first-open'
const K_PLAN = 'sd-plan'
const K_VIEWS = 'sd-views'

const firstOpen = ref<number>(0)
const entitlement = ref<Entitlement | null>(null)
const views = ref<{ day: string; count: number }>({ day: '', count: 0 })
const now = ref(Date.now())
let started = false

const today = () => new Date().toISOString().slice(0, 10)
function read<T>(k: string): T | null {
  try { return JSON.parse(localStorage.getItem(k) || 'null') as T } catch { return null }
}
function write(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)) } catch {}
}

function start() {
  if (started || !import.meta.client) return
  started = true
  let f = read<number>(K_FIRST)
  if (!f || typeof f !== 'number') { f = Date.now(); write(K_FIRST, f) }
  firstOpen.value = f
  now.value = Date.now()
  entitlement.value = read<Entitlement>(K_PLAN)
  views.value = read<{ day: string; count: number }>(K_VIEWS) ?? { day: today(), count: 0 }
  // keep "now" fresh so the trial / plan end on time while the app is open
  setInterval(() => { now.value = Date.now() }, 60_000)
}

export function useAccess() {
  start()

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

  return {
    inTrial, trialDaysLeft, hasPlan, planExpired, planDaysLeft, entitlement,
    unlimited, freeLeftToday, usedToday, useEntry, setEntitlement,
  }
}
