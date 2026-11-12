<script setup lang="ts">
import { COUNTS } from '~/utils/dictionary'
import { FREE_DAILY_ENTRIES, naira, PLANS, TRIAL_DAYS, type PlanId } from '~/utils/plans'

/** limit = today's free entries used up; otherwise opened from the Premium button */
const props = defineProps<{ reason: 'limit' | 'menu' }>()
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

const headline = computed(() => {
  if (access.hasPlan.value) return 'You\'re on Premium'
  if (props.reason === 'limit') return 'You\'ve used today\'s free entries'
  return 'Go Premium'
})
const subline = computed(() => {
  if (access.hasPlan.value) {
    const e = access.entitlement.value!
    return e.expiresAt === null
      ? 'Lifetime access. Thank you for your support!'
      : `${PLANS.find(p => p.id === e.plan)?.name} plan · ${access.planDaysLeft.value} day${access.planDaysLeft.value === 1 ? '' : 's'} left`
  }
  if (access.inTrial.value) return `Free trial · ${access.trialDaysLeft.value} day${access.trialDaysLeft.value === 1 ? '' : 's'} left. Choose a plan to keep unlimited access afterwards.`
  if (props.reason === 'limit') return `Free use is ${FREE_DAILY_ENTRIES} entries a day. Upgrade for unlimited access, or come back tomorrow.`
  return `Your ${TRIAL_DAYS}-day free trial has ended. You get ${FREE_DAILY_ENTRIES} free entries a day (${access.freeLeftToday.value} left today).`
})

const dateFmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
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
  'Unlimited entries, every day',
  `Full meanings for ${fmt(COUNTS.t)} terms, ${fmt(COUNTS.a)} abbreviations and ${fmt(COUNTS.p)} prowords`,
  'Save, share and copy any entry',
  'Works offline, wherever you are',
]

async function continueToPay() {
  error.value = ''
  if (!validEmail.value) { error.value = 'Enter your email address: Paystack sends your receipt there.'; return }
  try { localStorage.setItem('sd-email', email.value.trim()) } catch {}
  const r = await payments.pay(selected.value, email.value.trim())
  if (r.error) error.value = r.error
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
  <div class="fixed inset-0 z-40 flex flex-col bg-canvas">
    <!-- Top bar -->
    <header class="flex-none pt-[env(safe-area-inset-top)]">
      <div class="flex h-13 items-center justify-between px-2">
        <button type="button" class="grid size-11 cursor-pointer place-items-center rounded-xl text-ink/70 active:bg-line/50" aria-label="Close" @click="emit('close')">
          <AppIcon name="x" :size="22" />
        </button>
        <button
          v-if="!access.hasPlan.value"
          type="button" class="cursor-pointer rounded-xl px-3 py-2 text-[15px] font-medium text-accent active:bg-line/50"
          @click="mode = mode === 'buy' ? 'restore' : 'buy'; error = ''"
        >{{ mode === 'buy' ? 'Restore purchase' : 'See plans' }}</button>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto overscroll-contain">
      <div class="mx-auto max-w-md px-5 pb-6">
        <!-- Hero -->
        <div class="flex flex-col items-center pt-1 text-center">
          <img src="/logo.svg" alt="" width="68" height="68" class="size-17 drop-shadow-[0_10px_22px_rgba(22,51,42,.3)]">
          <span class="mt-4 rounded-full bg-brass/15 px-3 py-0.5 text-[11px] font-bold tracking-[.14em] text-brass uppercase">Premium</span>
          <h1 class="mt-2 mb-0 font-serif text-[27px] leading-tight font-semibold tracking-tight">{{ headline }}</h1>
          <p class="mt-2 mb-0 max-w-sm text-[14.5px] leading-relaxed text-muted">{{ subline }}</p>
        </div>

        <!-- Current plan -->
        <div v-if="access.hasPlan.value && access.entitlement.value" class="mt-6 overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
          <div v-for="row in planRows" :key="row[0]" class="flex items-baseline justify-between gap-4 border-b border-line/70 px-4 py-3 text-[14.5px] last:border-b-0">
            <span class="text-muted">{{ row[0] }}</span>
            <span class="min-w-0 truncate text-right font-medium" :class="row[0] === 'Reference' ? 'font-mono text-[12.5px]' : ''">{{ row[1] }}</span>
          </div>
        </div>
        <button
          v-if="access.hasPlan.value && !access.entitlement.value?.expiresAt"
          type="button"
          class="mt-6 h-12 w-full cursor-pointer rounded-2xl bg-accent text-[16px] font-semibold text-paper active:scale-[.99]"
          @click="emit('close')"
        >Done</button>
        <p v-if="access.hasPlan.value && access.entitlement.value?.expiresAt" class="mt-6 mb-0 text-center text-[13px] text-muted">
          Want to extend or go Lifetime? Choose a plan below.
        </p>

        <!-- Benefits -->
        <ul v-if="!access.hasPlan.value || access.entitlement.value?.expiresAt" class="mx-auto mt-6 mb-0 max-w-sm list-none space-y-2.5 p-0">
          <li v-for="b in BENEFITS" :key="b" class="flex gap-3 text-[14.5px] leading-snug">
            <span class="mt-px grid size-5 flex-none place-items-center rounded-full bg-accent text-paper"><AppIcon name="check" :size="13" /></span>
            <span>{{ b }}</span>
          </li>
        </ul>

        <!-- Plans -->
        <template v-if="mode === 'buy' && (!access.hasPlan.value || access.entitlement.value?.expiresAt)">
          <div class="mt-7 space-y-3" role="radiogroup" aria-label="Plans">
            <button
              v-for="p in PLANS" :key="p.id" type="button" role="radio" :aria-checked="selected === p.id"
              class="relative flex w-full cursor-pointer items-center gap-3.5 rounded-2xl border-2 bg-paper px-4 py-3.5 text-left transition"
              :class="selected === p.id ? 'border-accent shadow-lift' : 'border-line shadow-card'"
              @click="selected = p.id"
            >
              <span
                class="grid size-5.5 flex-none place-items-center rounded-full border-2 transition"
                :class="selected === p.id ? 'border-accent bg-accent text-paper' : 'border-faint'"
              ><AppIcon v-if="selected === p.id" name="check" :size="12" /></span>
              <span class="min-w-0 flex-1">
                <span class="block text-[16px] font-semibold">{{ p.name }}</span>
                <span class="block text-[13px] text-muted">{{ p.note }}</span>
              </span>
              <span class="text-right">
                <span class="block font-serif text-[22px] leading-none font-semibold">{{ naira(p.price) }}</span>
                <span class="mt-1 block text-[12px] text-muted">{{ p.period }}</span>
              </span>
              <span v-if="p.badge" class="absolute -top-2.5 right-4 rounded-full bg-brass px-2.5 py-0.5 text-[10.5px] font-bold tracking-wider text-[#1b211e] uppercase">{{ p.badge }}</span>
            </button>
          </div>
        </template>

        <!-- Email (receipt / restore) -->
        <div v-if="!access.hasPlan.value || (mode === 'buy' && access.entitlement.value?.expiresAt)" class="mt-6">
          <label class="mb-1.5 block text-[13px] font-semibold text-ink/80" for="pay-email">
            {{ mode === 'buy' ? 'Email for your receipt' : 'Email you paid with' }}
          </label>
          <input
            id="pay-email" v-model="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false"
            placeholder="you@example.com"
            class="h-12 w-full rounded-xl border border-line bg-paper px-4 text-[16px] outline-none focus:border-accent/60 focus:ring-3 focus:ring-accent-soft"
          >
        </div>

        <p v-if="error" class="mt-3 mb-0 rounded-xl bg-[#fbe9e7] px-3.5 py-2.5 text-[13.5px] text-[#9a3412] dark:bg-[#3a1f19] dark:text-[#f5b39a]">{{ error }}</p>
        <p v-if="!payments.configured" class="mt-3 mb-0 rounded-xl bg-accent-soft px-3.5 py-2.5 text-[13px] text-accent">
          Test build: payments will work once the Paystack payment service is connected.
        </p>
      </div>
    </div>

    <!-- Action -->
    <footer v-if="!access.hasPlan.value || (mode === 'buy' && access.entitlement.value?.expiresAt)" class="flex-none border-t border-line/70 bg-canvas px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <div class="mx-auto max-w-md">
        <button
          type="button"
          :disabled="payments.busy.value"
          class="flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-accent text-[16.5px] font-semibold text-paper shadow-lift transition active:scale-[.99] disabled:opacity-60"
          @click="mode === 'buy' ? continueToPay() : restore()"
        >
          <span v-if="payments.busy.value" class="size-4.5 animate-spin rounded-full border-2 border-paper/40 border-t-paper" />
          <template v-if="mode === 'buy'">Continue · {{ naira(plan.price) }}</template>
          <template v-else>Restore purchase</template>
        </button>
        <p class="mt-2.5 mb-0 flex items-center justify-center gap-1.5 text-center text-[12px] text-muted">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          Secure payment by Paystack · Card, bank transfer or USSD
        </p>
        <p v-if="mode === 'buy'" class="mt-1 mb-0 text-center text-[11.5px] text-muted">Plans don't renew automatically. No hidden charges.</p>
      </div>
    </footer>
  </div>
</template>
