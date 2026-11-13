<script setup lang="ts">
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { ALPHABET, TABS, type Entry, type Tab } from '~/utils/dictionary'

const { tab, query, words, results, letterOf, lettersAvailable, isNameMatch, matchCounts, matchesSearch, suggestions } = useDictionary()
const library = useLibrary()
const access = useAccess()
const payments = usePayments()

/* ---------- Premium / payment page ---------- */
const paywall = ref<null | 'launch' | 'limit' | 'menu'>(null)
const premiumPill = computed(() => {
  if (access.hasPlan.value) return { text: 'Premium', cls: 'border border-line text-ink/80' }
  if (access.inTrial.value) return { text: `Trial · ${access.trialDaysLeft.value} days`, cls: 'border border-line text-muted' }
  return { text: 'Premium', cls: 'bg-ink text-paper' }
})
function onPaymentResult(r: { ok: boolean; error?: string }) {
  if (r.ok) { paywall.value = null; tap('medium'); notify('Payment successful. Premium unlocked') }
  else if (r.error) notify(r.error)
}

type View = 'browse' | 'saved' | 'recent'
const view = ref<View>('browse')
const fmt = (n: number) => n.toLocaleString('en-US')

// Highlight only meaningful words (skip "of", "a", "in"…) unless that is all the user typed
const highlightWords = computed(() => {
  const long = words.value.filter(w => w.length >= 3)
  return long.length ? long : words.value
})

/* ---------- search ---------- */
const input = ref('')
const searchEl = ref<HTMLInputElement>()
const searchFocused = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
watch(input, (v) => {
  clearTimeout(timer)
  // Search as you type: update almost immediately (clearing is instant)
  if (!v.trim()) { query.value = v; return }
  timer = setTimeout(() => { query.value = v; scrollTop() }, 60)
})
// Android keyboards hold the current word "in progress" until a space is typed, and v-model
// waits for it. Reading the input event directly updates results on every letter.
function onSearchInput(ev: Event) {
  input.value = (ev.target as HTMLInputElement).value
}
// A new search covers every entry (All); the previous filter comes back when the search is cleared
let filterBeforeSearch: Tab | null = null
watch(query, (q, old) => {
  const has = !!q.trim(); const had = !!(old ?? '').trim()
  if (has && !had && view.value === 'browse' && tab.value !== 'all') { filterBeforeSearch = tab.value; tab.value = 'all' }
  if (!has && had && filterBeforeSearch) { tab.value = filterBeforeSearch; filterBeforeSearch = null }
})
function useSuggestion(s: string) {
  input.value = s
  query.value = s
}
const searchPlaceholder = computed(() => ({
  browse: 'Search everything…',
  saved: 'Search saved entries…',
  recent: 'Search recent entries…',
})[view.value])
const savedList = computed(() => library.saved.value.filter(matchesSearch))
const recentList = computed(() => library.recent.value.filter(matchesSearch))

function cancelSearch() {
  input.value = ''
  query.value = ''
  searchEl.value?.blur()
}

/* ---------- filters ---------- */
const FILTERS = TABS.map(t => ({ ...t, short: t.id === 'all' ? 'All' : t.label }))
function setFilter(id: Tab) {
  filterBeforeSearch = null
  tab.value = id
  scrollTop()
}

/* ---------- list (renders progressively for speed) ---------- */
const scroller = ref<HTMLElement>()
const sentinel = ref<HTMLElement>()
const PAGE = 80
const shown = ref(PAGE)
watch(results, () => { shown.value = PAGE })
const scrollTop = () => scroller.value?.scrollTo({ top: 0 })

type Row =
  | { type: 'letter'; key: string; letter: string }
  | { type: 'label'; key: string; label: string; count: number }
  | { type: 'entry'; key: string; entry: Entry }
const nameMatches = computed(() => (query.value.trim() ? results.value.filter(isNameMatch).length : 0))
const rows = computed<Row[]>(() => {
  const out: Row[] = []
  const searching = !!query.value.trim()
  let last = ''
  results.value.slice(0, shown.value).forEach((e, i) => {
    if (searching) {
      // "Matching names" first, then "Found in meanings"
      if (i === 0 && nameMatches.value) out.push({ type: 'label', key: 'lbl-names', label: 'Matching names', count: nameMatches.value })
      if (i === nameMatches.value) out.push({ type: 'label', key: 'lbl-meanings', label: 'Found in meanings', count: results.value.length - nameMatches.value })
    } else {
      // Symbols are grouped by the document's sections; everything else by letter
      const l = tab.value === 's' ? `${e.symbol!.category} symbols` : letterOf(e)
      if (l !== last) { out.push({ type: 'letter', key: `L${l}`, letter: l }); last = l }
    }
    out.push({ type: 'entry', key: `E${e.id}`, entry: e })
  })
  return out
})

const scrubLetters = computed(() => ALPHABET.filter(l => l !== '#' || lettersAvailable.value.has('#')))
async function jumpTo(letter: string) {
  tap()
  const idx = results.value.findIndex(e => letterOf(e) === letter)
  if (idx < 0) return
  if (shown.value < idx + PAGE) shown.value = idx + PAGE
  await nextTick()
  const anchor = document.getElementById(`sec-${letter}`)
  if (anchor && scroller.value) scroller.value.scrollTop = anchor.offsetTop
}

/* ---------- entry pages (a small stack, so "Back" works between linked entries) ---------- */
const stack = ref<Entry[]>([])
const current = computed(() => stack.value[stack.value.length - 1])
function openEntry(e: Entry) {
  searchEl.value?.blur()
  // After the free trial, without a plan: 10 entries a day
  if (!access.useEntry()) { paywall.value = 'limit'; return }
  stack.value = [...stack.value, e]
  library.addRecent(e)
}
function closeEntry() { stack.value = stack.value.slice(0, -1) }
function lookup(term: string) {
  stack.value = []
  view.value = 'browse'
  tab.value = 't'
  input.value = term
  query.value = term
}
function toggleSave() {
  if (!current.value) return
  const now = library.toggleSaved(current.value)
  tap(now ? 'medium' : 'light')
  notify(now ? 'Saved' : 'Removed from saved')
}

/* ---------- views ---------- */
function setView(v: View) {
  if (view.value === v) { scrollTop(); return }
  view.value = v
  nextTick(scrollTop)
}
const title = computed(() => ({ browse: 'Service Dictionary', saved: 'Saved', recent: 'Recent' })[view.value])

/* ---------- toast ---------- */
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
function notify(m: string) {
  toast.value = m
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 1500)
}

/* ---------- lifecycle ---------- */
let observer: IntersectionObserver | undefined
onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting && view.value === 'browse' && shown.value < results.value.length) shown.value += PAGE
  }, { root: scroller.value, rootMargin: '800px' })
  if (sentinel.value) observer.observe(sentinel.value)

  // Android back button: close page → clear search → go to Dictionary → leave app
  if (Capacitor.isNativePlatform()) {
    CapApp.addListener('backButton', () => {
      if (paywall.value) paywall.value = null
      else if (stack.value.length) closeEntry()
      else if (input.value || searchFocused.value) cancelSearch()
      else if (view.value !== 'browse') setView('browse')
      else CapApp.minimizeApp()
    })
  }
})
const play = usePlayBilling()
onMounted(async () => {
  if (play.enabled) {
    // Play Store version: re-read Google Play purchases (renewals, cancellations, refunds)
    await Promise.race([play.refresh(), new Promise(res => setTimeout(res, 2500))])
  } else {
    payments.listen(onPaymentResult)
    const r = await payments.checkPending() // a payment finished while the app was closed
    if (r?.ok) { onPaymentResult(r); return }
  }
  // Trial users see the plans each time they open the app (after the trial date is confirmed)
  await Promise.race([access.syncTrial(), new Promise(res => setTimeout(res, 2500))])
  await new Promise(res => setTimeout(res, 600)) // let the splash screen finish
  if (access.inTrial.value && !access.hasPlan.value && !paywall.value && !stack.value.length) paywall.value = 'launch'
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden bg-canvas text-ink">
    <!-- ===== Top bar ===== -->
    <header class="z-20 flex-none border-b border-line/70 bg-canvas pt-[env(safe-area-inset-top)]">
      <div class="px-4 pt-2.5 pb-3">
        <div class="flex h-10 items-center gap-2.5">
          <img v-if="view === 'browse'" src="/logo.svg" alt="" width="30" height="30" class="size-7.5 flex-none rounded-[6px]">
          <h1 class="m-0 truncate font-serif font-semibold" :class="view === 'browse' ? 'text-[21px]' : 'text-[23px]'">{{ title }}</h1>
          <span class="flex-1" />
          <button
            v-if="view === 'recent' && library.recent.value.length"
            type="button" class="cursor-pointer rounded-lg px-2 py-1 text-[15px] font-medium text-accent active:bg-line/50"
            @click="library.clearRecent(); notify('History cleared')"
          >Clear</button>
          <span v-if="view === 'saved' && library.saved.value.length" class="text-[13px] text-muted tabular-nums">{{ library.saved.value.length }}</span>
          <button
            v-if="view === 'browse'"
            type="button"
            class="flex h-7.5 flex-none cursor-pointer items-center gap-1 rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap transition active:scale-95"
            :class="premiumPill.cls"
            @click="paywall = 'menu'"
          >
            {{ premiumPill.text }}
          </button>
        </div>

        <!-- Search (every tab) -->
          <div class="mt-2.5 flex items-center gap-2">
            <label class="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-line/55 px-3 text-muted transition-colors focus-within:bg-paper focus-within:ring-2 focus-within:ring-accent/35">
              <AppIcon name="search" :size="18" />
              <input
                ref="searchEl"
                :value="input"
                type="search"
                enterkeyhint="search"
                :placeholder="searchPlaceholder"
                autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                aria-label="Search"
                class="h-full min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-muted"
                @input="onSearchInput"
                @focus="searchFocused = true"
                @blur="searchFocused = false"
                @keydown.enter="searchEl?.blur()"
              >
              <button v-if="input" type="button" class="grid size-6 flex-none cursor-pointer place-items-center rounded-full bg-muted/40 text-paper" aria-label="Clear" @click="input = ''; searchEl?.focus()">
                <AppIcon name="x" :size="13" />
              </button>
            </label>
            <button
              v-if="searchFocused || input"
              type="button"
              class="flex-none cursor-pointer px-1 text-[16px] font-medium text-accent"
              @mousedown.prevent
              @click="cancelSearch"
            >Cancel</button>
          </div>

          <!-- Filters (Dictionary tab); while searching they show how many matches each has -->
          <div v-if="view === 'browse'" class="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            <button
              v-for="f in FILTERS" :key="f.id" type="button"
              class="flex h-8 flex-none cursor-pointer items-center rounded-md border px-3.5 text-[14.5px] font-medium whitespace-nowrap transition-colors"
              :class="tab === f.id ? 'border-accent bg-accent text-paper' : 'border-line bg-paper text-ink/75 active:bg-line/50'"
              @click="setFilter(f.id)"
            >
              {{ f.short }}
            </button>

          </div>
      </div>
    </header>

    <!-- ===== Content ===== -->
    <div class="relative min-h-0 flex-1">
      <main ref="scroller" class="absolute inset-0 overflow-y-auto overscroll-contain">
        <!-- Dictionary -->
        <template v-if="view === 'browse'">
          <button
            v-if="!access.unlimited.value"
            type="button"
            class="flex w-full cursor-pointer items-center gap-3 border-b border-line bg-paper px-4 py-2.5 text-left"
            @click="paywall = 'menu'"
          >
            <span class="min-w-0 flex-1 text-[13px] leading-snug text-ink/80">
              <b class="font-semibold">{{ access.freeLeftToday.value }} free {{ access.freeLeftToday.value === 1 ? 'entry' : 'entries' }} left today.</b>
              Unlimited for {{ play.priceLabel('monthly') ?? '₦500' }} a month.
            </span>
            <span class="flex-none text-[13.5px] font-semibold text-accent">Upgrade</span>
          </button>
          <EmptyState
            v-if="!results.length"
            icon="search" title="No matches"
            :text="tab !== 'all' && matchCounts.all ? `No ${FILTERS.find(f => f.id === tab)!.label.toLowerCase()} match, but ${fmt(matchCounts.all)} other entries do.` : suggestions.length ? 'Did you mean:' : 'Try a shorter word or check the spelling.'"
          >
            <button v-if="tab !== 'all' && matchCounts.all" type="button" class="mt-4 cursor-pointer rounded-sm bg-accent px-5 py-2 text-[14.5px] font-medium text-paper" @click="setFilter('all')">Show all {{ fmt(matchCounts.all) }} results</button>
            <div v-else-if="suggestions.length" class="mt-3 flex flex-wrap justify-center gap-2">
              <button
                v-for="sg in suggestions" :key="sg" type="button"
                class="cursor-pointer rounded-sm border border-accent/40 bg-paper px-4 py-1.5 text-[15px] font-medium text-accent active:bg-accent-soft"
                @click="useSuggestion(sg)"
              >{{ sg }}</button>
            </div>
          </EmptyState>
          <template v-for="row in rows" :key="row.key">
            <template v-if="row.type === 'letter'">
              <div :id="`sec-${row.letter}`" />
              <div class="sticky top-0 z-[1] border-b border-line/60 bg-canvas/95 px-4 py-1 font-serif text-[15px] font-semibold text-ink/60 backdrop-blur">
                {{ row.letter }}
              </div>
            </template>
            <div
              v-else-if="row.type === 'label'"
              class="sticky top-0 z-[1] flex items-baseline justify-between border-b border-line/60 bg-canvas/95 px-4 pt-3 pb-1.5 backdrop-blur"
            >
              <span class="text-[12px] font-semibold tracking-wider text-muted uppercase">{{ row.label }}</span>
              <span class="pr-1 text-[12px] text-muted tabular-nums">{{ fmt(row.count) }}</span>
            </div>
            <EntryRow
              v-else :entry="row.entry" :words="highlightWords" :show-kind="tab === 'all'" :compact="tab === 'a'"
              :saved="library.isSaved(row.entry)" @open="openEntry"
            />
          </template>
        </template>

        <!-- Saved -->
        <template v-else-if="view === 'saved'">
          <EmptyState v-if="!library.saved.value.length" icon="bookmark" title="No saved entries" text="Tap the bookmark on any entry to keep it here for quick reference." />
          <EmptyState v-else-if="!savedList.length" icon="search" title="No matches" text="None of your saved entries match. Clear the search to see them all." />
          <EntryRow v-for="e in savedList" :key="e.id" :entry="e" :words="highlightWords" show-kind @open="openEntry" />
        </template>

        <!-- Recent -->
        <template v-else>
          <EmptyState v-if="!library.recent.value.length" icon="clock" title="Nothing yet" text="Entries you open will appear here so you can find them again." />
          <EmptyState v-else-if="!recentList.length" icon="search" title="No matches" text="None of your recent entries match. Clear the search to see them all." />
          <EntryRow v-for="e in recentList" :key="e.id" :entry="e" :words="highlightWords" show-kind :saved="library.isSaved(e)" @open="openEntry" />
        </template>

        <div ref="sentinel" class="h-6" />
      </main>

      <!-- A–Z index -->
      <IndexScrubber
        v-if="view === 'browse' && tab !== 's' && !query.trim() && results.length > 30"
        class="absolute top-0 right-0 bottom-0 z-[2]"
        :letters="scrubLetters" :available="lettersAvailable" @jump="jumpTo"
      />
    </div>

    <!-- ===== Bottom tab bar ===== -->
    <nav
      v-show="!searchFocused"
      class="z-20 flex flex-none border-t border-line/80 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
      aria-label="Sections"
    >
      <button
        v-for="t in ([['browse', 'Dictionary', 'book'], ['saved', 'Saved', 'bookmark'], ['recent', 'Recent', 'clock']] as const)"
        :key="t[0]" type="button"
        class="flex h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 transition-colors"
        :class="view === t[0] ? 'text-accent' : 'text-muted'"
        :aria-current="view === t[0] ? 'page' : undefined"
        @click="setView(t[0])"
      >
        <AppIcon :name="t[2]" :size="23" :filled="view === t[0]" />
        <span class="text-[11.5px] font-medium">{{ t[1] }}</span>
      </button>
    </nav>

    <!-- ===== Entry page ===== -->
    <Transition
      enter-from-class="translate-x-full" leave-to-class="translate-x-full"
      enter-active-class="transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
      leave-active-class="transition-transform duration-250 ease-in"
    >
      <EntryDetail
        v-if="current" :key="current.id"
        :entry="current" :saved="library.isSaved(current)" :can-go-back="stack.length > 1"
        @close="closeEntry" @toggle-save="toggleSave" @open="openEntry" @lookup="lookup" @notify="notify"
      />
    </Transition>

    <!-- ===== Payment page ===== -->
    <Transition leave-to-class="opacity-0 translate-y-6" leave-active-class="transition duration-200 ease-in">
      <Paywall v-if="paywall" :reason="paywall" @close="paywall = null" @notify="notify" />
    </Transition>

    <!-- ===== Toast ===== -->
    <Transition enter-from-class="opacity-0 translate-y-2" leave-to-class="opacity-0 translate-y-2" enter-active-class="transition duration-200" leave-active-class="transition duration-200">
      <div
        v-if="toast"
        class="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-md bg-ink px-4 py-2 text-[14px] font-medium text-canvas shadow-lift"
      >
        <AppIcon name="check" :size="15" />{{ toast }}
      </div>
    </Transition>
  </div>
</template>
