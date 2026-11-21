<script setup lang="ts">
import type { ManualTocItem } from '~/composables/useManual'

/** The "Manual" tab: locked until the access code is entered, then contents, search and reader. */
const manual = useManual()
const code = ref('')
const show = ref(false)
const props = defineProps<{ query: string }>() // typed in the green header
const reading = ref(0) // page open in the reader (0 = contents)
const shake = ref(false)

async function submit() {
  if (manual.state.value === 'checking' || manual.waitSeconds.value) return
  const ok = await manual.unlock(code.value)
  if (ok) { code.value = ''; tap() }
  else { shake.value = true; setTimeout(() => (shake.value = false), 450) }
}

const results = computed(() => (props.query.trim().length > 1 ? manual.search(props.query) : []))
const words = computed(() => props.query.toLowerCase().split(/\s+/).filter(w => w.length > 1))

// Contents: chapters with their annexes underneath
const chapters = computed(() => {
  const toc = manual.index.value?.toc ?? []
  const out: { chapter: ManualTocItem; annexes: ManualTocItem[] }[] = []
  for (const t of toc) {
    if (t.type === 'chapter') out.push({ chapter: t, annexes: [] })
    else out.find(c => c.chapter.n === t.chapter)?.annexes.push(t)
  }
  return out
})
const expanded = ref<number | null>(null)
const last = computed(() => (manual.state.value === 'open' ? manual.lastPage() : 0))

function sectionName(page: number) {
  const s = manual.sectionOf(page)
  if (!s) return ''
  return s.type === 'chapter' ? `Chapter ${s.n}` : `Ch ${s.chapter} · Annex ${s.annex}`
}
function read(page: number) { reading.value = page; tap() }

const escMap: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (s: string) => s.replace(/[&<>"']/g, c => escMap[c]!)
function mark(text: string) {
  let html = esc(text)
  for (const w of words.value) html = html.replace(new RegExp(`(${esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>')
  return html
}
defineExpose({ reading })
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- ===== Locked ===== -->
    <div v-if="manual.state.value !== 'open'" class="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 pt-[max(2rem,6vh)] pb-10">
      <div class="flex w-full max-w-sm flex-col items-center rounded-3xl bg-paper px-6 pt-8 pb-7 shadow-card">
        <span class="grid size-16 place-items-center rounded-2xl bg-sand text-on-sand"><AppIcon name="lock" :size="30" /></span>
        <h2 class="mt-5 mb-0 text-center text-[24px] leading-tight font-bold">Writing Manual</h2>
        <p class="mt-2 mb-0 max-w-xs text-center text-[14.5px] leading-relaxed text-muted">
          Restricted. Enter the access code to open the manual.
        </p>
        <form class="mt-6 w-full" :class="shake ? 'animate-[shake_.4s]' : ''" @submit.prevent="submit">
          <label class="sr-only" for="manual-code">Access code</label>
          <div class="flex h-13 items-center rounded-full border bg-canvas px-4 focus-within:border-accent/60 focus-within:ring-3 focus-within:ring-accent-soft" :class="manual.error.value ? 'border-danger/60' : 'border-line'">
            <input
              id="manual-code" v-model="code" :type="show ? 'text' : 'password'"
              autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Access code"
              class="h-full min-w-0 flex-1 bg-transparent text-center font-mono text-[18px] tracking-[.18em] uppercase outline-none placeholder:font-sans placeholder:tracking-normal placeholder:normal-case placeholder:text-muted"
            >
            <button type="button" class="flex-none cursor-pointer px-1 text-[13px] font-semibold text-accent" @click="show = !show">{{ show ? 'Hide' : 'Show' }}</button>
          </div>
          <p v-if="manual.waitSeconds.value" class="mt-2 mb-0 text-center text-[13.5px] text-danger">Too many wrong attempts. Try again in {{ manual.waitSeconds.value }} s.</p>
          <p v-else-if="manual.error.value" class="mt-2 mb-0 text-center text-[13.5px] text-danger">{{ manual.error.value }}</p>
          <button
            type="submit" :disabled="manual.state.value === 'checking' || !!manual.waitSeconds.value"
            class="mt-4 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-accent text-[16px] font-semibold text-paper active:scale-[.99] disabled:opacity-60"
          >
            <span v-if="manual.state.value === 'checking'" class="size-4.5 animate-spin rounded-full border-2 border-paper/40 border-t-paper" />
            {{ manual.state.value === 'checking' ? 'Checking…' : 'Unlock' }}
          </button>
        </form>
      </div>
    </div>

    <!-- ===== Open ===== -->
    <main v-else class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-6">
      <!-- Search results -->
      <template v-if="query.trim().length > 1">
        <div class="flex items-baseline justify-between px-1 pb-2">
          <span class="text-[15px] font-bold">Pages</span>
          <span class="text-[13px] text-muted tabular-nums">{{ results.length }}{{ results.length === 60 ? '+' : '' }} found</span>
        </div>
        <p v-if="!results.length" class="px-6 py-10 text-center text-[15px] text-muted">No pages contain all of these words.</p>
        <button
          v-for="r in results" :key="r.page" type="button"
          class="mb-2 flex w-full cursor-pointer items-start gap-3 rounded-2xl bg-paper px-4 py-3 text-left shadow-card active:bg-accent-soft"
          @click="read(r.page)"
        >
          <span class="flex-none rounded-full bg-sand px-2 py-0.5 text-[12px] font-bold text-on-sand tabular-nums">p. {{ r.page }}</span>
          <span class="min-w-0 flex-1">
            <span class="block text-[12px] font-medium text-muted">{{ sectionName(r.page) }}</span>
            <span class="mt-0.5 line-clamp-3 text-[14px] leading-snug text-ink/85" v-html="mark(r.snippet)" />
          </span>
        </button>
      </template>

      <!-- Contents -->
      <template v-else>
        <button
          v-if="last > 1" type="button"
          class="mb-5 flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-accent-soft px-4 py-3.5 text-left active:opacity-80"
          @click="read(last)"
        >
          <span class="grid size-10 flex-none place-items-center rounded-xl bg-accent text-paper"><AppIcon name="manual" :size="20" /></span>
          <span class="min-w-0 flex-1">
            <span class="block text-[15px] font-bold text-ink">Continue reading</span>
            <span class="block text-[13px] text-ink/70">Page {{ last }} · {{ sectionName(last) }}</span>
          </span>
          <AppIcon name="chevron-right" :size="18" class="text-accent" />
        </button>
        <div class="px-1 pb-2 text-[17px] font-bold">Contents</div>
        <div v-for="c in chapters" :key="c.chapter.page" class="mb-2 overflow-hidden rounded-2xl bg-paper shadow-card">
          <div class="flex items-stretch">
            <button type="button" class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-3 pl-3.5 text-left active:bg-accent-soft/60" @click="read(c.chapter.page)">
              <span class="grid size-9 flex-none place-items-center rounded-xl bg-accent-soft text-[15px] font-bold text-accent tabular-nums">{{ c.chapter.n }}</span>
              <span class="min-w-0 flex-1">
                <span class="block text-[14px] leading-snug font-semibold tracking-[.01em] wrap-title">{{ c.chapter.title }}</span>
                <span class="block text-[12px] text-muted">Page {{ c.chapter.page }}</span>
              </span>
            </button>
            <button
              v-if="c.annexes.length" type="button"
              class="flex flex-none cursor-pointer items-center gap-1 px-3.5 text-[12.5px] font-medium text-muted active:bg-accent-soft/60"
              :aria-expanded="expanded === c.chapter.n"
              @click="expanded = expanded === c.chapter.n ? null : c.chapter.n!"
            >
              {{ c.annexes.length }} annex{{ c.annexes.length === 1 ? '' : 'es' }}
              <AppIcon name="chevron-right" :size="15" class="transition-transform" :class="expanded === c.chapter.n ? 'rotate-90' : ''" />
            </button>
          </div>
          <div v-if="expanded === c.chapter.n" class="border-t border-line/70 py-1.5">
            <button
              v-for="a in c.annexes" :key="a.page + a.title" type="button"
              class="flex w-full cursor-pointer items-start gap-3 py-2 pr-4 pl-4 text-left active:bg-accent-soft/60"
              @click="read(a.page)"
            >
              <span class="w-9 flex-none text-center text-[13px] font-bold text-accent">{{ a.annex }}</span>
              <span class="min-w-0 flex-1 text-[13.5px] leading-snug text-ink/85 wrap-title">{{ a.title }}</span>
              <span class="flex-none text-[12px] text-muted tabular-nums">{{ a.page }}</span>
            </button>
          </div>
        </div>
      </template>
    </main>

    <ManualReader v-if="reading" :start-page="reading" @close="reading = 0" />
  </div>
</template>
