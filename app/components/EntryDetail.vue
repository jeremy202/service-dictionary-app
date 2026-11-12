<script setup lang="ts">
import { crossReference, ENTRIES, KIND_LABEL, type Entry } from '~/utils/dictionary'

const props = defineProps<{ entry: Entry; saved: boolean; canGoBack: boolean }>()
const emit = defineEmits<{
  close: []
  'toggle-save': []
  open: [entry: Entry]
  lookup: [term: string]
  notify: [message: string]
}>()

const xref = computed(() => crossReference(props.entry))
const xrefEntry = computed(() => {
  if (!xref.value) return null
  const t = xref.value.toLowerCase().replace(/\.$/, '')
  return ENTRIES.find(e => e.kind === 't' && e.lh === t) ?? null
})

// Other full forms of the same abbreviation (taken from the abbreviations file)
const otherMeanings = computed(() => {
  const e = props.entry
  if (e.kind !== 'a') return []
  const seen = new Set([e.headword])
  return ENTRIES.filter((x) => {
    if (x.kind !== 'a' || x.abbr !== e.abbr || seen.has(x.headword)) return false
    seen.add(x.headword)
    return true
  })
})
// The same full form written with other abbreviations
const otherAbbrs = computed(() => {
  const e = props.entry
  if (e.kind !== 'a') return []
  const seen = new Set([e.abbr])
  return ENTRIES.filter((x) => {
    if (x.kind !== 'a' || x.lh !== e.lh || seen.has(x.abbr)) return false
    seen.add(x.abbr)
    return true
  })
})

const plain = computed(() => {
  const e = props.entry
  return e.kind === 'a' ? `${e.abbr} — ${e.headword}` : `${e.headword}\n\n${e.meaning}`
})

async function copy() {
  emit('notify', (await copyText(plain.value)) ? 'Copied' : 'Copy is not available')
  tap()
}
async function share() {
  const ok = await shareText(props.entry.kind === 'a' ? props.entry.abbr ?? '' : props.entry.headword, `${plain.value}\n\n— Service Dictionary`)
  if (!ok) copy()
}

const kindChip = { t: 'text-term bg-term-soft', a: 'text-abbr bg-abbr-soft', p: 'text-pro bg-pro-soft' }
const body = ref<HTMLElement>()
watch(() => props.entry, () => body.value?.scrollTo({ top: 0 }))
</script>

<template>
  <div class="fixed inset-0 z-30 flex flex-col bg-canvas">
    <!-- Top bar -->
    <header class="flex-none border-b border-line/60 bg-canvas/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div class="flex h-13 items-center gap-1 px-1.5">
        <button type="button" class="flex h-11 cursor-pointer items-center gap-0.5 rounded-xl pr-3 pl-1 text-[16px] font-medium text-accent active:bg-line/50" @click="emit('close')">
          <AppIcon name="chevron-left" :size="24" />
          {{ canGoBack ? 'Back' : 'Close' }}
        </button>
        <div class="flex-1" />
        <button
          type="button"
          class="grid size-11 cursor-pointer place-items-center rounded-xl active:bg-line/50"
          :class="saved ? 'text-brass' : 'text-ink/80'"
          :aria-label="saved ? 'Remove from saved' : 'Save'"
          @click="emit('toggle-save')"
        >
          <AppIcon name="bookmark" :filled="saved" />
        </button>
        <button type="button" class="grid size-11 cursor-pointer place-items-center rounded-xl text-ink/80 active:bg-line/50" aria-label="Share" @click="share">
          <AppIcon name="share" />
        </button>
        <button type="button" class="grid size-11 cursor-pointer place-items-center rounded-xl text-ink/80 active:bg-line/50" aria-label="Copy" @click="copy">
          <AppIcon name="copy" />
        </button>
      </div>
    </header>

    <!-- Content -->
    <div ref="body" class="flex-1 overflow-y-auto overscroll-contain">
      <article class="mx-auto max-w-2xl px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+3rem)]">
        <span class="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase" :class="kindChip[entry.kind]">
          {{ KIND_LABEL[entry.kind] }}
        </span>

        <template v-if="entry.kind === 'a'">
          <h1 class="mt-3 mb-0 font-mono text-[34px] leading-tight font-semibold tracking-tight text-abbr [overflow-wrap:anywhere]">{{ entry.abbr }}</h1>
          <p class="mt-2 mb-0 font-serif text-[25px] leading-snug font-medium">{{ entry.headword }}</p>
        </template>
        <h1 v-else-if="entry.kind === 'p'" class="mt-3 mb-0 font-mono text-[25px] leading-snug font-semibold tracking-wide text-pro">{{ entry.headword }}</h1>
        <h1 v-else class="mt-3 mb-0 font-serif text-[31px] leading-[1.15] font-semibold tracking-tight">{{ entry.headword }}</h1>

        <div class="my-5 h-[3px] w-10 rounded-full bg-brass" />

        <!-- Cross reference ("See 'Echelon'") -->
        <button
          v-if="xref"
          type="button"
          class="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3.5 text-left shadow-card active:bg-line/40"
          @click="xrefEntry ? emit('open', xrefEntry) : emit('lookup', xref!)"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-[12px] font-semibold tracking-wider text-muted uppercase">{{ entry.meaning.trim().split(/\s/)[0] }}</span>
            <span class="block font-serif text-[19px] font-semibold">{{ xref }}</span>
          </span>
          <span class="text-accent"><AppIcon name="arrow-right" /></span>
        </button>

        <MeaningBlocks v-else-if="entry.kind !== 'a'" :meaning="entry.meaning" class="text-[16.5px] leading-[1.75] text-ink/90 select-text" />

        <!-- Abbreviation extras -->
        <section v-if="otherMeanings.length" class="mt-2">
          <h2 class="mb-2 text-[12px] font-semibold tracking-wider text-muted uppercase">Also stands for</h2>
          <div class="overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
            <button
              v-for="o in otherMeanings" :key="o.id" type="button"
              class="flex w-full cursor-pointer items-center gap-3 border-b border-line/70 px-4 py-3 text-left last:border-b-0 active:bg-line/40"
              @click="emit('open', o)"
            >
              <span class="min-w-0 flex-1 text-[15.5px]">{{ o.headword }}</span>
              <span class="text-faint"><AppIcon name="chevron-right" :size="16" /></span>
            </button>
          </div>
        </section>
        <section v-if="otherAbbrs.length" class="mt-6">
          <h2 class="mb-2 text-[12px] font-semibold tracking-wider text-muted uppercase">Also written as</h2>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="o in otherAbbrs" :key="o.id" type="button"
              class="cursor-pointer rounded-lg bg-abbr-soft px-3 py-1.5 font-mono text-[14.5px] font-semibold text-abbr active:opacity-70"
              @click="emit('open', o)"
            >{{ o.abbr }}</button>
          </div>
        </section>
      </article>
    </div>
  </div>
</template>
