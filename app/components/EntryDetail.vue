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
  if (e.kind === 's') return `${e.headword} (${e.symbol?.category} symbol)${e.meaning ? `\n\n${e.meaning}` : ''}`
  return e.kind === 'a' ? `${e.abbr} — ${e.headword}` : `${e.headword}\n\n${e.meaning}`
})

async function copy() {
  emit('notify', (await copyText(plain.value)) ? 'Copied' : 'Copy is not available')
  tap()
}
async function share() {
  const ok = await shareText(props.entry.kind === 'a' ? props.entry.abbr ?? '' : props.entry.headword, `${plain.value}\n\n— Service Guide`)
  if (!ok) copy()
}

const body = ref<HTMLElement>()
watch(() => props.entry, () => body.value?.scrollTo({ top: 0 }))
</script>

<template>
  <div class="fixed inset-x-0 top-0 bottom-[var(--nav-h)] z-30 flex flex-col bg-header">
    <!-- Green top bar -->
    <header class="flex-none pt-[env(safe-area-inset-top)] text-on-header">
      <div class="flex h-14 items-center gap-1 px-1.5 pb-1">
        <button type="button" class="flex h-11 cursor-pointer items-center gap-0.5 rounded-xl pr-3 pl-1 text-[16px] font-semibold active:bg-white/10" @click="emit('close')">
          <AppIcon name="chevron-left" :size="24" />
          {{ canGoBack ? 'Back' : 'Close' }}
        </button>
        <div class="flex-1" />
        <button
          type="button"
          class="grid size-11 cursor-pointer place-items-center rounded-xl active:bg-white/10"
          :aria-label="saved ? 'Remove from saved' : 'Save'"
          @click="emit('toggle-save')"
        >
          <AppIcon name="bookmark" :filled="saved" />
        </button>
        <button type="button" class="grid size-11 cursor-pointer place-items-center rounded-xl active:bg-white/10" aria-label="Share" @click="share">
          <AppIcon name="share" />
        </button>
        <button type="button" class="grid size-11 cursor-pointer place-items-center rounded-xl active:bg-white/10" aria-label="Copy" @click="copy">
          <AppIcon name="copy" />
        </button>
      </div>
    </header>

    <!-- Content sheet -->
    <div ref="body" class="flex-1 overflow-y-auto overscroll-contain rounded-t-[26px] bg-canvas">
      <article class="mx-auto max-w-2xl px-5 pt-6 pb-10">
        <template v-if="entry.kind === 'a'">
          <!-- The word (what was searched for) on top, the abbreviation (the result) below -->
          <p class="m-0 text-[21px] leading-snug font-semibold text-ink wrap-title">{{ entry.headword }}</p>
          <h1 class="mt-1 mb-0 text-[40px] leading-[1.1] font-bold tracking-[.01em] text-mint wrap-title">{{ entry.abbr }}</h1>
        </template>
        <h1 v-else-if="entry.kind === 'p'" class="m-0 text-[28px] leading-snug font-bold tracking-[.03em] wrap-title">{{ entry.headword }}</h1>
        <template v-else-if="entry.kind === 's' && entry.symbol">
          <div class="grid min-h-44 place-items-center rounded-2xl bg-white px-6 py-8 shadow-card">
            <img :src="entry.symbol.image" :alt="entry.headword" class="max-h-40 max-w-full object-contain">
          </div>
          <h1 class="mt-5 mb-0 text-[28px] leading-tight font-bold wrap-title">{{ entry.headword }}</h1>
          <p class="mt-1 mb-0 text-[14px] text-muted">{{ entry.symbol.category }} symbols · No. {{ entry.symbol.serial }}</p>
        </template>
        <h1 v-else class="m-0 text-[clamp(26px,8vw,34px)] leading-tight font-bold tracking-[-.01em] wrap-title">{{ entry.headword }}</h1>

        <span class="mt-3 inline-flex rounded-full bg-sand px-3 py-1 text-[12.5px] font-semibold text-on-sand">
          {{ entry.kind === 't' ? 'Dictionary' : KIND_LABEL[entry.kind] }}
        </span>

        <div class="h-5" />

        <!-- Cross reference ("See 'Echelon'") -->
        <button
          v-if="xref"
          type="button"
          class="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-paper px-4 py-3.5 text-left shadow-card active:bg-accent-soft"
          @click="xrefEntry ? emit('open', xrefEntry) : emit('lookup', xref!)"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-[12px] font-semibold tracking-wider text-muted uppercase">{{ entry.meaning.trim().split(/\s/)[0] }}</span>
            <span class="block text-[21px] font-bold wrap-title">{{ xref }}</span>
          </span>
          <span class="text-accent"><AppIcon name="arrow-right" /></span>
        </button>

        <!-- Symbol remarks: a drawing (Air Force variants) or text, exactly as in the document -->
        <section v-else-if="entry.kind === 's' && entry.symbol">
          <h2 class="mt-0 mb-2 text-[15px] font-bold">Remarks</h2>
          <div v-if="entry.symbol.remarkImage" class="grid place-items-center rounded-2xl bg-white px-6 py-6 shadow-card">
            <img :src="entry.symbol.remarkImage" :alt="entry.meaning" class="max-h-36 max-w-full object-contain">
          </div>
          <p v-else-if="entry.meaning" lang="en" class="m-0 rounded-2xl bg-paper px-4 py-3.5 text-justify text-[16px] leading-[1.7] text-ink/90 shadow-card select-text [hyphens:auto]">{{ entry.meaning }}</p>
          <p v-else class="m-0 text-[15px] text-muted">None</p>
        </section>

        <MeaningBlocks
          v-else-if="entry.kind !== 'a'" :meaning="entry.meaning" :entry="entry"
          class="rounded-2xl bg-paper px-4 py-4 text-[16.5px] leading-[1.75] text-ink/90 shadow-card select-text"
          @open="emit('open', $event)"
        />

        <!-- Abbreviations: category (remarks column of the abbreviations file) -->
        <section v-if="entry.kind === 'a' && entry.remarks?.length" class="mb-6">
          <h2 class="mt-0 mb-2 text-[15px] font-bold">Category</h2>
          <ul class="m-0 list-none space-y-2 p-0">
            <li
              v-for="r in entry.remarks" :key="r"
              class="rounded-2xl bg-paper px-4 py-3 text-[15px] leading-snug text-ink/85 shadow-card [overflow-wrap:break-word]"
            >{{ r }}</li>
          </ul>
        </section>

        <!-- Abbreviation extras -->
        <section v-if="otherMeanings.length" class="mt-2">
          <h2 class="mt-0 mb-2 text-[15px] font-bold">Also stands for</h2>
          <div class="overflow-hidden rounded-2xl bg-paper shadow-card">
            <button
              v-for="o in otherMeanings" :key="o.id" type="button"
              class="flex w-full cursor-pointer items-center gap-3 border-b border-line/70 px-4 py-3 text-left last:border-b-0 active:bg-accent-soft"
              @click="emit('open', o)"
            >
              <span class="min-w-0 flex-1 text-[15.5px] wrap-title">{{ o.headword }}</span>
              <span class="text-faint"><AppIcon name="chevron-right" :size="16" /></span>
            </button>
          </div>
        </section>
        <section v-if="otherAbbrs.length" class="mt-6">
          <h2 class="mt-0 mb-2 text-[15px] font-bold">Also written as</h2>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="o in otherAbbrs" :key="o.id" type="button"
              class="cursor-pointer rounded-full bg-abbr-soft px-4 py-1.5 text-[15px] font-bold text-mint active:opacity-70"
              @click="emit('open', o)"
            >{{ o.abbr }}</button>
          </div>
        </section>
      </article>
    </div>
  </div>
</template>
