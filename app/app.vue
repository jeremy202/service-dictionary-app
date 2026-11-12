<script setup lang="ts">
import { COUNTS, TABS, type Entry, type Tab } from '~/utils/dictionary'

const { tab, query, letter, abbrSort, words, results, letterOf, lettersAvailable } = useDictionary()

const fmt = (n: number) => n.toLocaleString('en-US')

// Highlight only meaningful words (skip "of", "a", "in"…) unless that is all the user typed
const highlightWords = computed(() => {
  const long = words.value.filter(w => w.length >= 3)
  return long.length ? long : words.value
})

/* ---------- search input (debounced) ---------- */
const input = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(input, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    query.value = v
    letter.value = ''
    if (import.meta.client) window.scrollTo({ top: 0 })
  }, 120)
})

/* ---------- tabs ↔ URL hash (#terms, #abbreviations, #prowords) ---------- */
function readHash() {
  const slug = window.location.hash.slice(1)
  tab.value = TABS.find(t => t.slug === slug)?.id ?? 'all'
  letter.value = ''
}
function selectTab(id: Tab) {
  const slug = TABS.find(t => t.id === id)!.slug
  if (window.location.hash.slice(1) === slug) readHash()
  else window.location.hash = slug
}

/* ---------- abbreviation sort preference (remembered in this browser) ---------- */
watch(abbrSort, (v) => {
  letter.value = ''
  try { localStorage.setItem('sd-abbr-sort', v) } catch {}
})

/* ---------- progressive rendering ---------- */
const PAGE = 120
const shown = ref(PAGE)
watch(results, () => { shown.value = PAGE })

type Row = { type: 'letter'; key: string; letter: string } | { type: 'entry'; key: string; entry: Entry }
const rows = computed<Row[]>(() => {
  const out: Row[] = []
  let last = ''
  for (const e of results.value.slice(0, shown.value)) {
    if (!query.value.trim()) {
      const l = letterOf(e)
      if (l !== last) { out.push({ type: 'letter', key: `L${l}`, letter: l }); last = l }
    }
    out.push({ type: 'entry', key: `E${e.id}`, entry: e })
  }
  return out
})

const sentinel = ref<HTMLElement>()
const showTop = ref(false)
let observer: IntersectionObserver | undefined
const toTop = () => window.scrollTo({ top: 0 })
const onScroll = () => { showTop.value = window.scrollY > 800 }

onMounted(() => {
  try {
    const s = localStorage.getItem('sd-abbr-sort')
    if (s === 'abbr' || s === 'full') abbrSort.value = s
  } catch {}
  readHash()
  window.addEventListener('hashchange', readHash)
  window.addEventListener('scroll', onScroll, { passive: true })
  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting && shown.value < results.value.length) shown.value += PAGE
  }, { rootMargin: '600px' })
  if (sentinel.value) observer.observe(sentinel.value)
})
onBeforeUnmount(() => {
  window.removeEventListener('hashchange', readHash)
  window.removeEventListener('scroll', onScroll)
  observer?.disconnect()
})

/* ---------- cross references & toast ---------- */
function lookup(term: string) {
  selectTab('t')
  input.value = term
  query.value = term
  window.scrollTo({ top: 0 })
}

const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
function onCopied(ok: boolean) {
  toast.value = ok ? 'Copied to clipboard' : 'Copy is not available here'
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 1500)
}

const scopeLabel = computed(() => TABS.find(t => t.id === tab.value)!.label.toLowerCase())
</script>

<template>
  <div class="min-h-screen">
    <!-- Header -->
    <header class="mx-auto max-w-3xl px-5 pt-[calc(env(safe-area-inset-top)+2.5rem)] pb-7 sm:pt-16">
      <div class="flex items-center gap-4">
        <div class="relative grid size-14 flex-none place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-deep font-serif text-[24px] font-semibold text-[#fffdf8] shadow-lift ring-1 ring-black/5">
          SD
          <span class="absolute inset-x-2 top-1 h-px rounded-full bg-white/30" />
        </div>
        <div class="min-w-0">
          <h1 class="m-0 font-serif text-[clamp(30px,5.5vw,44px)] leading-[1.05] font-semibold tracking-tight">
            Service Dictionary
          </h1>
          <p class="mt-1.5 text-[14px] text-muted">
            <span class="font-medium text-ink/80">{{ fmt(COUNTS.t) }}</span> terms
            <span class="mx-1.5 text-faint">•</span>
            <span class="font-medium text-ink/80">{{ fmt(COUNTS.a) }}</span> abbreviations
            <span class="mx-1.5 text-faint">•</span>
            <span class="font-medium text-ink/80">{{ fmt(COUNTS.p) }}</span> prowords
          </p>
        </div>
      </div>
    </header>

    <!-- Sticky controls -->
    <div class="sticky top-0 z-10 border-b border-line/70 bg-canvas/85 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 backdrop-blur-xl">
      <div class="mx-auto max-w-3xl px-5">
        <SearchBar v-model="input" />

        <div class="mt-3 flex flex-wrap items-center justify-between gap-2.5">
          <div class="flex gap-1 overflow-x-auto rounded-xl border border-line/80 bg-paper p-1 shadow-card" role="tablist">
            <button
              v-for="t in TABS"
              :key="t.id"
              type="button"
              role="tab"
              :aria-selected="tab === t.id"
              class="cursor-pointer rounded-lg px-3.5 py-1.5 text-[13.5px] font-medium whitespace-nowrap transition-all"
              :class="tab === t.id ? 'bg-accent text-paper shadow-sm' : 'text-muted hover:bg-canvas hover:text-ink'"
              @click="selectTab(t.id)"
            >
              {{ t.label }}<span class="ml-1.5 text-[11.5px] tabular-nums" :class="tab === t.id ? 'opacity-80' : 'opacity-60'">{{ fmt(COUNTS[t.id]) }}</span>
            </button>
          </div>

          <label v-if="tab === 'a'" class="flex items-center gap-2 text-[13px] text-muted">
            Sort by
            <select v-model="abbrSort" class="cursor-pointer rounded-lg border border-line/80 bg-paper px-2.5 py-1.5 text-ink shadow-card outline-none focus:border-accent/60">
              <option value="full">Full form</option>
              <option value="abbr">Abbreviation</option>
            </select>
          </label>
        </div>

        <AlphabetBar v-model="letter" :available="lettersAvailable" :disabled="!!query.trim()" />
      </div>
    </div>

    <!-- Results -->
    <main class="mx-auto max-w-3xl px-5">
      <div class="mt-5 mb-1 flex flex-wrap items-center justify-between gap-2.5 text-[13px] text-muted">
        <template v-if="query.trim()">
          <span><b class="font-semibold text-ink">{{ fmt(results.length) }}</b> result{{ results.length === 1 ? '' : 's' }} for “{{ query.trim() }}” in {{ scopeLabel }}</span>
          <button v-if="tab !== 'all'" type="button" class="cursor-pointer font-medium text-accent hover:text-accent-deep" @click="selectTab('all')">
            Search all entries →
          </button>
        </template>
        <template v-else-if="letter">
          <span><b class="font-semibold text-ink">{{ fmt(results.length) }}</b> {{ scopeLabel }} under “{{ letter }}”</span>
          <button type="button" class="cursor-pointer font-medium text-accent hover:text-accent-deep" @click="letter = ''">
            Show all letters
          </button>
        </template>
        <template v-else>
          <span>Browsing <b class="font-semibold text-ink">{{ fmt(results.length) }}</b> {{ scopeLabel }}, A–Z</span>
          <span class="hidden sm:inline">Press <kbd class="rounded border border-line bg-paper px-1 font-mono text-[11px]">/</kbd> to search</span>
        </template>
      </div>

      <div v-if="!results.length" class="my-8 rounded-2xl border border-dashed border-line bg-paper/60 px-6 py-16 text-center">
        <div class="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </div>
        <h3 class="m-0 font-serif text-xl font-semibold">No matches found</h3>
        <p class="mt-1 text-[14px] text-muted">Try a shorter word, check the spelling, or search across all entries.</p>
      </div>

      <template v-for="row in rows" :key="row.key">
        <div v-if="row.type === 'letter'" class="mt-9 mb-3 flex items-center gap-4 first:mt-5">
          <span class="font-serif text-[34px] leading-none font-semibold text-accent">{{ row.letter }}</span>
          <span class="h-px flex-1 bg-gradient-to-r from-line to-transparent" />
        </div>
        <EntryCard
          v-else
          :entry="row.entry"
          :words="highlightWords"
          :show-badge="tab === 'all'"
          @lookup="lookup"
          @copied="onCopied"
        />
      </template>
      <div ref="sentinel" class="h-10" />
    </main>

    <footer class="mx-auto max-w-3xl px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+3.5rem)] text-center text-[12.5px] text-muted">
      <span class="font-serif text-[14px] text-ink/70">Service Dictionary</span>
      <span class="mx-2 text-faint">•</span>{{ fmt(COUNTS.all) }} entries
    </footer>

    <!-- Back to top -->
    <Transition enter-from-class="opacity-0 translate-y-2" leave-to-class="opacity-0 translate-y-2" enter-active-class="transition" leave-active-class="transition">
      <button
        v-if="showTop"
        type="button"
        aria-label="Back to top"
        class="fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] grid size-11 cursor-pointer place-items-center rounded-full bg-accent text-paper shadow-lift transition hover:bg-accent-deep"
        @click="toTop"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      </button>
    </Transition>

    <!-- Toast -->
    <Transition
      enter-from-class="opacity-0 translate-y-3" leave-to-class="opacity-0 translate-y-3"
      enter-active-class="transition duration-200" leave-active-class="transition duration-200"
    >
      <div
        v-if="toast"
        class="fixed bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] text-canvas shadow-lift"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="m5 12 5 5L20 7" /></svg>
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>
