<script setup lang="ts">
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { ALPHABET, COUNTS, TABS, type Entry, type Tab } from '~/utils/dictionary'

const { tab, query, words, results, letterOf, lettersAvailable, isNameMatch, matchCounts, matchesSearch, suggestions } = useDictionary()
const library = useLibrary()
const access = useAccess()
const payments = usePayments()

/* ---------- Premium / payment page ---------- */
const paywall = ref<null | 'launch' | 'limit' | 'menu'>(null)
const premiumPill = computed(() => {
  if (access.hasPlan.value) return { text: 'Premium', cls: 'bg-white/15 text-on-header' }
  if (access.inTrial.value) return { text: `Trial · ${access.trialDaysLeft.value} days`, cls: 'bg-white/15 text-on-header' }
  return { text: 'Premium', cls: 'bg-sand text-on-sand' }
})
function onPaymentResult(r: { ok: boolean; error?: string }) {
  if (r.ok) { paywall.value = null; tap('medium'); notify('Payment successful. Premium unlocked') }
  else if (r.error) notify(r.error)
}

type View = 'browse' | 'saved' | 'recent' | 'manual'
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
// Searching stays in the section you are in (Abbreviations searches abbreviations).
// Matches in other sections are offered at the top of the results ("Show all").
const otherMatches = computed(() => (tab.value === 'all' ? 0 : matchCounts.value.all - matchCounts.value[tab.value]))
function useSuggestion(s: string) {
  input.value = s
  query.value = s
}
const searchPlaceholder = computed(() => ({
  browse: tab.value === 'all' ? 'Search everything…' : tab.value === 'a' ? 'Search abbreviations by word…' : tab.value === 'h' ? 'Search honours and awards…' : `Search ${TABS.find(t => t.id === tab.value)!.label.toLowerCase()}…`,
  saved: 'Search saved entries…',
  recent: 'Search recent entries…',
  manual: 'Search the manual…',
})[view.value])
const manualQuery = ref('')
const savedList = computed(() => library.saved.value.filter(matchesSearch))
const recentList = computed(() => library.recent.value.filter(matchesSearch))

function cancelSearch() {
  input.value = ''
  query.value = ''
  searchEl.value?.blur()
}

/* ---------- filters ---------- */
const FILTERS = TABS.map(t => ({ ...t, short: t.label }))

/* Section chips: always Dictionary and Abbreviations, then "More" with the other sections
   (client's request: the same two chips every time, everything else inside More). */
const filterMenu = ref(false)
const CHIPS = 2
const chipTabs = computed(() => FILTERS.slice(0, CHIPS))
const menuTabs = computed(() => FILTERS.slice(CHIPS))
const menuActive = computed(() => menuTabs.value.find(f => f.id === tab.value) ?? null)
// The list opens under "More", kept on screen
const moreBtn = ref<HTMLElement>()
const menuLeft = ref(16)
function placeMenu() {
  const b = moreBtn.value
  if (!b) return
  const w = 224
  menuLeft.value = Math.max(16, Math.min(b.offsetLeft, (b.offsetParent as HTMLElement).clientWidth - 16 - w))
}

function setFilter(id: Tab) {
  tab.value = id
  scrollTop()
}

const filterBar = ref<HTMLElement>()


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
      // Honours/Awards follow the file's categories (rows without one are listed under "Other")
      const l = tab.value === 's' ? `${e.symbol!.category} symbols` : tab.value === 'h' ? (e.honour!.category || 'Other') : letterOf(e)
      if (l !== last) { out.push({ type: 'letter', key: `L${l}`, letter: l }); last = l }
    }
    out.push({ type: 'entry', key: `E${e.id}`, entry: e })
  })
  return out
})

const hasScrubber = computed(() => view.value === 'browse' && tab.value !== 's' && tab.value !== 'h' && !query.value.trim() && results.value.length > 30)
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
// Auto-abbreviate tool (opened from the Abbreviations section)
const abbrTool = ref(false)
const abbrToolRef = ref<{ back: () => void } | null>(null)
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
  nextTick(() => {
    scrollTop()
  })
}
// Footer tabs: close any open entry page or manual page first; tapping Home again
// (with nothing open) clears the search and returns to the top of the list.
function navTo(v: View) {
  const hadOverlay = stack.value.length > 0 || !!manualView.value?.reading || abbrTool.value
  stack.value = []
  abbrTool.value = false
  filterMenu.value = false
  if (manualView.value?.reading) manualView.value.reading = 0
  if (v === view.value && !hadOverlay && v === 'browse' && (input.value || query.value)) cancelSearch()
  setView(v)
}
const title = computed(() => ({ browse: 'Service Guide', saved: 'Saved', recent: 'Recent', manual: 'Manual' })[view.value])
const manual = useManual()
const subtitle = computed(() => ({ browse: '', saved: 'Your bookmarked entries', recent: 'Entries you opened recently', manual: manual.state.value === 'open' ? 'Writing Manual' : 'Restricted · access code required' })[view.value])
const manualView = ref<{ reading: number } | null>(null)

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
      else if (filterMenu.value) filterMenu.value = false
      else if (stack.value.length) closeEntry()
      else if (abbrTool.value) abbrToolRef.value?.back()
      else if (view.value === 'manual' && manualView.value?.reading) manualView.value.reading = 0
      else if (view.value === 'manual' && manualQuery.value) manualQuery.value = ''
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
    <!-- ===== Green header band ===== -->
    <header class="z-20 flex-none rounded-b-[26px] bg-header pt-[env(safe-area-inset-top)] text-on-header shadow-lift">
      <div class="px-4 pt-3" :class="view === 'manual' && manual.state.value !== 'open' ? 'pb-5' : 'pb-4'">
        <!-- Dictionary: logo, name, premium -->
        <div v-if="view === 'browse'" class="flex h-11 items-center gap-2.5">
          <img src="/logo.svg" alt="" width="36" height="36" class="size-9 flex-none rounded-[9px] ring-1 ring-white/25">
          <h1 class="m-0 min-w-0 truncate text-[clamp(17px,5.6vw,22px)] leading-tight font-bold tracking-[-.01em]">{{ title }}</h1>
          <span class="flex-1" />
          <button
            type="button"
            class="flex h-8 flex-none cursor-pointer items-center rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap transition active:scale-95"
            :class="premiumPill.cls"
            @click="paywall = 'menu'"
          >{{ premiumPill.text }}</button>
        </div>

        <!-- Which section the search is in -->
        <button
          v-if="view === 'browse'" type="button"
          class="mt-2 flex cursor-pointer items-center gap-2 text-[13px] text-on-header/80"
          @click="filterMenu = !filterMenu"
        >
          Searching in
          <span class="rounded-full bg-sand px-2.5 py-0.5 text-[12.5px] font-bold text-on-sand">{{ tab === 'all' ? 'All sections' : FILTERS.find(f => f.id === tab)!.label }}</span>
        </button>

        <!-- Saved, Recent, Manual: large title with a line under it -->
        <div v-else class="flex items-end gap-2 pt-1">
          <div class="min-w-0 flex-1">
            <h1 class="m-0 text-[29px] leading-tight font-bold tracking-[-.01em]">{{ title }}</h1>
            <p class="mt-0.5 mb-0 text-[13.5px] text-on-header/75">{{ subtitle }}</p>
          </div>
          <button
            v-if="view === 'recent' && library.recent.value.length"
            type="button" class="mb-1 flex h-8 flex-none cursor-pointer items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-[13px] font-semibold active:bg-white/25"
            @click="library.clearRecent(); notify('History cleared')"
          ><AppIcon name="trash" :size="15" /> Clear</button>
          <span v-if="view === 'saved' && library.saved.value.length" class="mb-1 flex h-8 items-center rounded-full bg-white/15 px-3 text-[13px] font-semibold tabular-nums">{{ library.saved.value.length }}</span>
          <button
            v-if="view === 'manual' && manual.state.value === 'open'"
            type="button" class="mb-1 flex h-8 flex-none cursor-pointer items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-[13px] font-semibold active:bg-white/25"
            @click="manual.lock(); manualQuery = ''; notify('Manual locked')"
          ><AppIcon name="lock" :size="15" /> Lock</button>
        </div>

        <!-- Search: a white pill inside the band -->
        <div v-if="view !== 'manual' || manual.state.value === 'open'" class="flex items-center gap-2" :class="view === 'browse' ? 'mt-2.5' : 'mt-3.5'">
          <label class="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-paper px-4 text-muted shadow-card transition focus-within:ring-3 focus-within:ring-sand/70">
            <AppIcon name="search" :size="19" />
            <input
              v-if="view === 'manual'"
              v-model="manualQuery"
              type="search" enterkeyhint="search" :placeholder="searchPlaceholder"
              autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
              aria-label="Search the manual"
              class="h-full min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-muted"
              @focus="searchFocused = true"
              @blur="searchFocused = false"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
            >
            <input
              v-else
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
            <button
              v-if="view === 'manual' ? manualQuery : input" type="button"
              class="grid size-6 flex-none cursor-pointer place-items-center rounded-full bg-muted/35 text-paper" aria-label="Clear"
              @click="view === 'manual' ? (manualQuery = '') : (input = '', searchEl?.focus())"
            >
              <AppIcon name="x" :size="13" />
            </button>
          </label>
          <button
            v-if="view !== 'manual' && (searchFocused || input)"
            type="button"
            class="flex-none cursor-pointer px-1 text-[15.5px] font-semibold text-on-header"
            @mousedown.prevent
            @click="cancelSearch"
          >Cancel</button>
        </div>
      </div>
    </header>

    <!-- Section chips under the band: the first sections as chips, the rest in a drop-down
         (like WhatsApp's chat filters). The drop-down chip shows the section picked from it. -->
    <div v-if="view === 'browse'" class="relative z-20 flex-none pt-3 pb-1.5">
      <div ref="filterBar" role="tablist" aria-label="Sections" class="flex items-center gap-1.5 px-4">
        <button
          v-for="f in chipTabs" :key="f.id" type="button" role="tab"
          :aria-pressed="tab === f.id"
          class="flex h-9 flex-none cursor-pointer items-center rounded-full border px-[clamp(10px,3.4vw,14px)] text-[clamp(13px,3.9vw,14.5px)] whitespace-nowrap transition-colors"
          :class="tab === f.id ? 'border-accent bg-accent font-semibold text-paper shadow-card' : 'border-line bg-paper/70 font-medium text-ink/75 active:bg-line/60'"
          @click="setFilter(f.id); filterMenu = false"
        >
          {{ f.short }}
        </button>
        <button
          v-if="menuTabs.length" type="button"
          ref="moreBtn" aria-haspopup="menu" :aria-expanded="filterMenu"
          :aria-label="menuActive ? `More sections, ${menuActive.label} selected` : 'More sections'"
          class="flex h-9 flex-none cursor-pointer items-center gap-0.5 rounded-full border pr-[clamp(7px,2.4vw,10px)] pl-[clamp(10px,3.4vw,14px)] text-[clamp(13px,3.9vw,14.5px)] whitespace-nowrap transition-colors"
          :class="menuActive ? 'border-accent bg-accent font-semibold text-paper shadow-card' : filterMenu ? 'border-accent/50 bg-accent-soft font-medium text-accent' : 'border-line bg-paper/70 font-medium text-ink/75 active:bg-line/60'"
          @click="filterMenu = !filterMenu"
          @click.capture="placeMenu"
        >
          More
          <AppIcon name="chevron-right" :size="16" class="transition-transform" :class="filterMenu ? '-rotate-90' : 'rotate-90'" />
        </button>
      </div>

      <!-- Drop-down list of the other sections -->
      <template v-if="filterMenu">
        <div class="fixed inset-0 z-0" aria-hidden="true" @click="filterMenu = false" />
        <div
          role="menu" aria-label="More sections"
          class="absolute top-[calc(100%-2px)] z-10 min-w-56 overflow-hidden rounded-2xl border border-line/70 bg-paper py-1.5 shadow-lift"
          :style="{ left: `${menuLeft}px` }"
        >
          <button
            v-for="f in menuTabs" :key="f.id" type="button" role="menuitemradio" :aria-checked="tab === f.id"
            class="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-[15px] active:bg-accent-soft"
            :class="tab === f.id ? 'font-bold text-accent' : 'font-medium text-ink'"
            @click="setFilter(f.id); filterMenu = false"
          >
            <span class="min-w-0 flex-1">{{ f.label }}</span>
            <svg v-if="tab === f.id" viewBox="0 0 24 24" class="size-4.5 flex-none" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            <span class="text-[13px] font-medium text-muted tabular-nums">{{ fmt(query.trim() ? matchCounts[f.id] : COUNTS[f.id]) }}</span>
          </button>
        </div>
      </template>
    </div>

    <!-- ===== Manual (locked tab) ===== -->
    <ManualView v-if="view === 'manual'" ref="manualView" :query="manualQuery" />

    <!-- ===== Content ===== -->
    <div v-show="view !== 'manual'" class="relative min-h-0 flex-1">
      <main ref="scroller" class="absolute inset-0 overflow-y-auto overscroll-contain pt-2" :class="hasScrubber ? 'pr-6' : ''">
        <!-- Dictionary -->
        <template v-if="view === 'browse'">
          <button
            v-if="!access.unlimited.value"
            type="button"
            class="mx-4 mb-3 flex w-[calc(100%-2rem)] cursor-pointer items-center gap-3 rounded-2xl bg-sand px-4 py-3 text-left text-on-sand"
            @click="paywall = 'menu'"
          >
            <span class="min-w-0 flex-1 text-[13px] leading-snug">
              <b class="font-bold">{{ access.freeLeftToday.value }} free {{ access.freeLeftToday.value === 1 ? 'entry' : 'entries' }} left today.</b>
              Unlimited for {{ play.priceLabel('monthly') ?? '₦500' }} a month.
            </span>
            <span class="flex h-8 flex-none items-center rounded-full bg-accent px-3.5 text-[13px] font-semibold text-paper">Upgrade</span>
          </button>
          <button
            v-if="tab === 'a' && !query.trim()"
            type="button"
            class="mx-4 mb-3 flex w-[calc(100%-2rem)] cursor-pointer items-center gap-3 rounded-2xl bg-accent px-4 py-3.5 text-left text-paper shadow-lift active:opacity-90"
            @click="searchEl?.blur(); abbrTool = true"
          >
            <span class="grid size-11 flex-none place-items-center rounded-xl bg-white/15"><AppIcon name="wand" :size="22" /></span>
            <span class="min-w-0 flex-1">
              <span class="block text-[15.5px] font-bold">Auto-abbreviate a document</span>
              <span class="block text-[12.5px] leading-snug opacity-85">Paste text or upload a Word (.docx) or .txt file</span>
            </span>
            <AppIcon name="chevron-right" :size="18" class="opacity-80" />
          </button>
          <EmptyState
            v-if="!results.length"
            icon="search" title="No matches"
            :text="tab !== 'all' && matchCounts.all ? `No ${FILTERS.find(f => f.id === tab)!.label.toLowerCase()} entries match, but ${fmt(matchCounts.all)} ${matchCounts.all === 1 ? 'entry' : 'entries'} in other sections ${matchCounts.all === 1 ? 'does' : 'do'}.` : suggestions.length ? 'Did you mean:' : 'Try a shorter word or check the spelling.'"
          >
            <button v-if="tab !== 'all' && matchCounts.all" type="button" class="mt-4 cursor-pointer rounded-full bg-accent px-5 py-2.5 text-[14.5px] font-semibold text-paper" @click="setFilter('all')">Show all {{ fmt(matchCounts.all) }} results</button>
            <div v-else-if="suggestions.length" class="mt-3 flex flex-wrap justify-center gap-2">
              <button
                v-for="sg in suggestions" :key="sg" type="button"
                class="cursor-pointer rounded-full bg-sand px-4 py-1.5 text-[15px] font-semibold text-on-sand active:opacity-80"
                @click="useSuggestion(sg)"
              >{{ sg }}</button>
            </div>
          </EmptyState>
          <button
            v-if="query.trim() && results.length && otherMatches > 0"
            type="button"
            class="mx-4 mb-2 flex w-[calc(100%-2rem)] cursor-pointer items-center gap-2 rounded-2xl bg-accent-soft px-4 py-2.5 text-left text-[13.5px] text-ink/80 active:opacity-80"
            @click="setFilter('all')"
          >
            <span class="min-w-0 flex-1">{{ fmt(otherMatches) }} more {{ otherMatches === 1 ? 'match' : 'matches' }} in other sections</span>
            <span class="flex flex-none items-center gap-0.5 font-semibold text-accent">Show all <AppIcon name="chevron-right" :size="15" /></span>
          </button>
          <template v-for="row in rows" :key="row.key">
            <template v-if="row.type === 'letter'">
              <div :id="`sec-${row.letter}`" />
              <div class="sticky top-0 z-[1] bg-canvas/95 px-5 pt-2.5 pb-1.5 text-[15px] font-bold text-accent backdrop-blur">
                {{ row.letter }}
              </div>
            </template>
            <div
              v-else-if="row.type === 'label'"
              class="sticky top-0 z-[1] flex items-baseline gap-1.5 bg-canvas/95 px-5 pt-2.5 pb-1.5 backdrop-blur"
            >
              <span class="text-[15px] font-bold">{{ row.label }}</span>
              <span class="text-[13px] text-muted tabular-nums">({{ fmt(row.count) }})</span>
            </div>
            <EntryRow
              v-else :entry="row.entry" :words="highlightWords" :show-kind="tab === 'all'"
              :saved="library.isSaved(row.entry)" @open="openEntry"
            />
          </template>
        </template>

        <!-- Saved -->
        <template v-else-if="view === 'saved'">
          <EmptyState v-if="!library.saved.value.length" icon="bookmark" title="No saved entries" text="Tap the bookmark on any entry to keep it here for quick reference." />
          <EmptyState v-else-if="!savedList.length" icon="search" title="No matches" text="None of your saved entries match. Clear the search to see them all." />
          <div v-else class="flex items-baseline gap-1.5 px-5 pt-2 pb-2">
            <span class="text-[15px] font-bold">Saved entries</span>
            <span class="text-[13px] text-muted tabular-nums">({{ savedList.length }})</span>
          </div>
          <EntryRow v-for="e in savedList" :key="e.id" :entry="e" :words="highlightWords" show-kind saved @open="openEntry" />
        </template>

        <!-- Recent -->
        <template v-else>
          <EmptyState v-if="!library.recent.value.length" icon="clock" title="Nothing yet" text="Entries you open will appear here so you can find them again." />
          <EmptyState v-else-if="!recentList.length" icon="search" title="No matches" text="None of your recent entries match. Clear the search to see them all." />
          <EntryRow v-for="e in recentList" :key="e.id" :entry="e" :words="highlightWords" show-kind recent :saved="library.isSaved(e)" @open="openEntry" />
        </template>

        <div ref="sentinel" class="h-6" />
      </main>

      <!-- A–Z index -->
      <IndexScrubber
        v-if="hasScrubber"
        class="absolute top-0 right-0 bottom-0 z-[2]"
        :letters="scrubLetters" :available="lettersAvailable" @jump="jumpTo"
      />
    </div>

    <!-- ===== Bottom tab bar ===== -->
    <!-- Always on screen, above entry pages and the manual reader, so Home is one tap away -->
    <nav
      class="relative z-[35] flex h-[var(--nav-h)] flex-none border-t border-line/70 bg-canvas pb-[env(safe-area-inset-bottom)]"
      aria-label="Sections"
    >
      <button
        v-for="t in ([['browse', 'Home', 'home'], ['saved', 'Saved', 'bookmark'], ['recent', 'Recent', 'clock'], ['manual', 'Manual', manual.state.value === 'open' ? 'manual' : 'lock']] as const)"
        :key="t[0]" type="button"
        class="flex h-15 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 transition-colors"
        :class="view === t[0] ? 'text-accent' : 'text-muted'"
        :aria-current="view === t[0] ? 'page' : undefined"
        @click="navTo(t[0])"
      >
        <AppIcon :name="t[2]" :size="23" :filled="view === t[0]" />
        <span class="text-[11.5px]" :class="view === t[0] ? 'font-bold' : 'font-medium'">{{ t[1] }}</span>
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

    <!-- ===== Auto-abbreviate ===== -->
    <Transition
      enter-from-class="translate-y-full" leave-to-class="translate-y-full"
      enter-active-class="transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
      leave-active-class="transition-transform duration-250 ease-in"
    >
      <AbbreviateTool v-if="abbrTool" ref="abbrToolRef" @close="abbrTool = false" @notify="notify" />
    </Transition>

    <!-- ===== Payment page ===== -->
    <Transition leave-to-class="opacity-0 translate-y-6" leave-active-class="transition duration-200 ease-in">
      <Paywall v-if="paywall" :reason="paywall" @close="paywall = null" @notify="notify" />
    </Transition>

    <!-- ===== Toast ===== -->
    <Transition enter-from-class="opacity-0 translate-y-2" leave-to-class="opacity-0 translate-y-2" enter-active-class="transition duration-200" leave-active-class="transition duration-200">
      <div
        v-if="toast"
        class="fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-accent px-4 py-2 text-[14px] font-semibold text-paper shadow-lift"
      >
        <AppIcon name="check" :size="15" />{{ toast }}
      </div>
    </Transition>
  </div>
</template>
