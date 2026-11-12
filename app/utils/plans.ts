/** Pricing. The payment service (payments/) has the same table and is the one that charges. */
export type PlanId = 'monthly' | 'yearly' | 'lifetime'

export interface Plan {
  id: PlanId
  name: string
  price: number // naira
  period: string // shown after the price
  days: number | null // length of access; null = lifetime
  note: string
  badge?: string
}

export const PLANS: Plan[] = [
  { id: 'monthly', name: 'Monthly', price: 500, period: '/ month', days: 30, note: '30 days of full access' },
  { id: 'yearly', name: 'Yearly', price: 3000, period: '/ year', days: 365, note: '₦250 a month · save 50%', badge: 'Best value' },
  { id: 'lifetime', name: 'Lifetime', price: 12500, period: 'once', days: null, note: 'Pay once, yours forever' },
]

export const TRIAL_DAYS = 7
export const FREE_DAILY_ENTRIES = 10

export const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`
