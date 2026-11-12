<script setup lang="ts">
import { COUNTS } from '~/utils/dictionary'
import { FREE_DAILY_ENTRIES, naira, PLANS, TRIAL_DAYS, type PlanId } from '~/utils/plans'

/**
 * Plans pop-up (slides up over the app).
 *  launch = shown when a trial user opens the app
 *  limit  = today's free entries are used up
 *  menu   = opened from the Premium button
 *
 * Paying is blocked while a plan is active (until it ends) and while a payment is still
 * being confirmed, so nobody pays twice.
 */
const props = defineProps<{ reason: 'launch' | 'limit' | 'menu' }>()
const emit = defineEmits<{ close: []; notify: [message: string] }>()

const access = useAccess()
const payments = usePayments()

const selected = ref<PlanId>('yearly')
const plan = computed(() => PLANS.find(p => p.id === selected.value)!)
const email = ref('')
const error = ref('')
const mode = ref<'buy' | 'restore'>('buy')

try { email.value = localStorage.getItem('sd-email') || '' } catch {}
const validEmail = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim()))
const fmt = (n: number) => n.toLocaleString('en-US')
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const dateFmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

const premium = computed(() => access.hasPlan.value)
const pending = computed(() => !!payments.pending.value)
const showPlans = computed(() => mode.value === 'buy' && !premium.value)

const headline = computed(() => {
  if (mode.value === 'restore') return 'Restore your purchase'
  if (premium.value) return 'You\'re on Premium'
  if (pending.value) return 'Confirming your payment'
  if (props.reason === 'limit') return 'Daily limit reached'
  if (access.inTrial.value) return props.reason === 'launch' ? 'Enjoy your free trial' : 'Go Premium'
  return 'Go Premium'
})
const subline = computed(() => {
  if (mode.value === 'restore') return 'Enter the email you paid with. Premium comes back on this phone.'
  if (premium.value) {
    const e = access.entitlement.value!
    return e.expiresAt === null
      ? 'Lifetime access. Thank you for your support!'
      : `Your ${PLANS.find(p => p.id === e.plan)?.name.toLowerCase()} plan is active until ${dateFmt(e.expiresAt)}. You can renew once it ends.`
  }
  if (pending.value) return 'We\'re waiting for Paystack to confirm your payment. Paying is paused until it\'s confirmed, so you\'re never charged twice.'
  if (props.reason === 'limit') return `You've used today's ${FREE_DAILY_ENTRIES} free entries. Choose a plan for unlimited access, or come back tomorrow.`
  if (access.inTrial.value) return `${plural(access.trialDaysLeft.value, 'day')} left. Choose a plan now to keep unlimited access when your trial ends.`
  return `Your ${TRIAL_DAYS}-day free trial has ended. You get ${FREE_DAILY_ENTRIES} free entries a day (${access.freeLeftToday.value} left today).`
})
const laterLabel = computed(() => {
  if (props.reason === 'limit') return 'Come back tomorrow'
  if (props.reason === 'launch') return 'Continue with free trial'
  return 'Not now'
})

const planRows = computed<[string, string][]>(() => {
  const e = access.entitlement.value
  if (!e) return []
  return [
    ['Plan', PLANS.find(p => p.id === e.plan)?.name ?? e.plan],
    ['Paid on', dateFmt(e.paidAt)],
    ['Access until', e.expiresAt ? dateFmt(e.expiresAt) : 'Forever'],
    ...(e.email ? [['Email', e.email] as [string, string]] : []),
    ['Reference', e.reference],
  ]
})

const BENEFITS = [
  'Unlimited entries every day',
  `${fmt(COUNTS.t)} terms, ${fmt(COUNTS.a)} abbreviations, ${fmt(COUNTS.p)} prowords`,
  'Save, share and copy',
  'Works offline',
]

async function continueToPay() {
  if (pending.value || premium.value || payments.busy.value) return
  error.value = ''
  if (!validEmail.value) { error.value = 'Enter your email address: Paystack sends your receipt there.'; return }
  try { localStorage.setItem('sd-email', email.value.trim()) } catch {}
  const r = await payments.pay(selected.value, email.value.trim())
  if (r.error) error.value = r.error
}

async function checkStatus() {
  error.value = ''
  const r = await payments.checkPending()
  if (r?.ok) { emit('notify', 'Payment successful. Premium unlocked'); emit('close') }
  else if (r && !r.ok && payments.pending.value) error.value = r.error
}

async function restore() {
  error.value = ''
  if (!validEmail.value) { error.value = 'Enter the email you paid with.'; return }
  const r = await payments.restore(email.value.trim())
  if (r.ok) { emit('notify', 'Purchase restored'); emit('close') }
  else error.value = r.error
}
</script>

<template>
  <div class="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" :aria-label="headline">
    <!-- Backdrop -->
    <div class="sheet-backdrop absolute inset-0 bg-black/45 backdrop-blur-[2px]" @click="emit('close')" />

    <!-- Sheet -->
    <div class="sheet relative flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-canvas shadow-2xl sm:rounded-[28px]">
      <!-- Handle + close -->
      <div class="relative flex-none pt-2.5">
        <div class="mx-auto h-1.5 w-10 rounded-full bg-line" />
        <button type="button" class="absolute top-2 right-2 grid size-10 cursor-pointer place-items-center rounded-full text-muted active:bg-line/50" aria-label="Close" @click="emit('close')">
          <AppIcon name="x" :size="20" />
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
        <!-- Header -->
        <div class="flex items-center gap-3.5 pt-3 pr-8">
          <img src="/logo.svg" alt="" width="52" height="52" class="size-13 flex-none drop-shadow-[0_8px_16px_rgba(22,51,42,.28)]">
          <div class="min-w-0">
            <span class="text-[10.5px] font-bold tracking-[.16em] text-brass uppercase">Service Dictionary Premium</span>
            <h2 class="m-0 font-serif text-[23px] leading-tight font-semibold tracking-tight">{{ headline }}</h2>
          </div>
        </div>
        <p class="mt-2.5 mb-0 text-[14px] leading-relaxed text-muted">{{ subline }}</p>

        <!-- Trial progress -->
        <div v-if="access.inTrial.value && !premium && !pending && mode === 'buy'" class="mt-3">
          <div class="h-1.5 overflow-hidden rounded-full bg-line">
            <div class="h-full rounded-full bg-accent" :style="{ width: `${Math.max(4, Math.round(((TRIAL_DAYS - access.trialDaysLeft.value) / TRIAL_DAYS) * 100))}%` }" />
          </div>
          <div class="mt-1 flex justify-between text-[11.5px] text-muted">
            <span>Free trial</span><span>{{ plural(access.trialDaysLeft.value, 'day') }} left</span>
          </div>
        </div>

        <!-- Current plan details (paying is blocked until the plan ends) -->
        <div v-if="premium && planRows.length && mode === 'buy'" class="mt-4 overflow-hidden rounded-2xl border border-line bg-paper">
          <div v-for="row in planRows" :key="row[0]" class="flex items-baseline justify-between gap-4 border-b border-line/70 px-4 py-2.5 text-[14px] last:border-b-0">
            <span class="text-muted">{{ row[0] }}</span>
            <span class="min-w-0 truncate text-right font-medium" :class="row[0] === 'Reference' ? 'font-mono text-[12px]' : ''">{{ row[1] }}</span>
          </div>
        </div>

        <!-- Benefits -->
        <ul v-if="showPlans" class="mt-4 mb-0 grid list-none grid-cols-2 gap-x-3 gap-y-2 p-0">
          <li v-for="b in BENEFITS" :key="b" class="flex gap-2 text-[13px] leading-snug">
            <span class="mt-px grid size-4.5 flex-none place-items-center rounded-full bg-accent text-paper"><AppIcon name="check" :size="11" /></span>
            <span>{{ b }}</span>
          </li>
        </ul>

        <!-- Plans -->
        <div v-if="showPlans" class="mt-5 space-y-2.5" :class="pending ? 'pointer-events-none opacity-50' : ''" role="radiogroup" aria-label="Plans">
          <button
            v-for="p in PLANS" :key="p.id" type="button" role="radio" :aria-checked="selected === p.id" :disabled="pending"
            class="relative flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 bg-paper px-4 py-3 text-left transition"
            :class="selected === p.id ? 'border-accent shadow-lift' : 'border-line'"
            @click="selected = p.id"
          >
            <span
              class="grid size-5.5 flex-none place-items-center rounded-full border-2 transition"
              :class="selected === p.id ? 'border-accent bg-accent text-paper' : 'border-faint'"
            ><AppIcon v-if="selected === p.id" name="check" :size="12" /></span>
            <span class="min-w-0 flex-1">
              <span class="block text-[15.5px] font-semibold">{{ p.name }}</span>
              <span class="block text-[12.5px] text-muted">{{ p.note }}</span>
            </span>
            <span class="text-right">
              <span class="block font-serif text-[21px] leading-none font-semibold">{{ naira(p.price) }}</span>
              <span class="mt-1 block text-[11.5px] text-muted">{{ p.period }}</span>
            </span>
            <span v-if="p.badge" class="absolute -top-2.5 right-4 rounded-full bg-brass px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[#1b211e] uppercase">{{ p.badge }}</span>
          </button>
        </div>

        <!-- Email -->
        <div v-if="(showPlans && !pending) || mode === 'restore'" class="mt-4">
          <label class="mb-1.5 block text-[12.5px] font-semibold text-ink/80" for="pay-email">
            {{ mode === 'buy' ? 'Email for your receipt' : 'Email you paid with' }}
          </label>
          <input
            id="pay-email" v-model="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false"
            placeholder="you@example.com"
            class="h-12 w-full rounded-xl border border-line bg-paper px-4 text-[16px] outline-none focus:border-accent/60 focus:ring-3 focus:ring-accent-soft"
            @keydown.enter="mode === 'buy' ? continueToPay() : restore()"
          >
        </div>

        <p v-if="error" class="mt-3 mb-0 rounded-xl bg-[#fbe9e7] px-3.5 py-2.5 text-[13.5px] text-[#9a3412] dark:bg-[#3a1f19] dark:text-[#f5b39a]">{{ error }}</p>
      </div>

      <!-- Actions -->
      <div class="flex-none border-t border-line/70 bg-canvas px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <!-- Restore -->
        <button
          v-if="mode === 'restore'"
          type="button" :disabled="payments.busy.value"
          class="flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-accent text-[16px] font-semibold text-paper shadow-lift transition active:scale-[.99] disabled:opacity-60"
          @click="restore"
        >
          <span v-if="payments.busy.value" class="size-4.5 animate-spin rounded-full border-2 border-paper/40 border-t-paper" />
          Restore purchase
        </button>
        <!-- Already paid: no payment button until the plan ends -->
        <button
          v-else-if="premium"
          type="button" class="h-13 w-full cursor-pointer rounded-2xl bg-accent text-[16px] font-semibold text-paper active:scale-[.99]"
          @click="emit('close')"
        >Done</button>
        <!-- Payment waiting for confirmation: paying is locked -->
        <button
          v-else-if="pending"
          type="button" :disabled="payments.busy.value"
          class="flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-accent bg-paper text-[16px] font-semibold text-accent transition active:scale-[.99] disabled:opacity-60"
          @click="checkStatus"
        >
          <span v-if="payments.busy.value" class="size-4.5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          Check payment status
        </button>
        <button
          v-else
          type="button" :disabled="payments.busy.value"
          class="flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-accent text-[16px] font-semibold text-paper shadow-lift transition active:scale-[.99] disabled:opacity-60"
          @click="continueToPay"
        >
          <span v-if="payments.busy.value" class="size-4.5 animate-spin rounded-full border-2 border-paper/40 border-t-paper" />
          Continue · {{ naira(plan.price) }}
        </button>

        <div v-if="!premium" class="mt-1.5 flex items-center justify-between">
          <button
            type="button" class="cursor-pointer rounded-lg px-1 py-2 text-[13.5px] font-medium text-accent"
            @click="mode = mode === 'buy' ? 'restore' : 'buy'; error = ''"
          >{{ mode === 'buy' ? 'Restore purchase' : 'See plans' }}</button>
          <button type="button" class="cursor-pointer rounded-lg px-1 py-2 text-[13.5px] font-medium text-muted" @click="emit('close')">{{ laterLabel }}</button>
        </div>
        <p class="m-0 mt-1 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-muted">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          Secure payment by Paystack · No automatic renewals
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sheet { animation: sheet-up .32s cubic-bezier(.2, .8, .2, 1); }
.sheet-backdrop { animation: fade-in .25s ease-out; }
@keyframes sheet-up { from { transform: translateY(100%); } }
@keyframes fade-in { from { opacity: 0; } }
</style>
