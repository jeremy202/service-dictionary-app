<script setup lang="ts">
import { crossReference, highlight, KIND_LABEL, type Entry } from '~/utils/dictionary'
import { formatMeaning } from '~/utils/formatMeaning'

const props = defineProps<{ entry: Entry; words: string[]; showBadge: boolean }>()
const emit = defineEmits<{ lookup: [term: string]; copied: [ok: boolean] }>()

const LONG = 480
const isLong = computed(() => props.entry.meaning.length > LONG)
const expanded = ref(false)
const xref = computed(() => crossReference(props.entry))
// Abbreviations are one-line meanings; terms and prowords get structured formatting
const blocks = computed(() => (props.entry.kind === 'a' ? [] : formatMeaning(props.entry.meaning)))

const badgeClass = {
  t: 'text-term bg-term-soft',
  a: 'text-abbr bg-abbr-soft',
  p: 'text-pro bg-pro-soft',
}

async function copy() {
  const e = props.entry
  const text = e.kind === 'a' ? `${e.abbr} — ${e.headword}` : `${e.headword} — ${e.meaning}`
  try {
    await navigator.clipboard.writeText(text)
    emit('copied', true)
  } catch {
    emit('copied', false)
  }
}
</script>

<template>
  <article
    class="group relative my-3 rounded-2xl border border-line/80 bg-paper shadow-card transition duration-200 hover:-translate-y-px hover:border-line hover:shadow-lift"
    :class="entry.kind === 'a' ? 'px-5 py-4' : 'px-6 pt-5 pb-6'"
  >
    <!-- Abbreviation: chip + full form on one line -->
    <div v-if="entry.kind === 'a'" class="flex items-center gap-4 pr-8">
      <span
        class="min-w-16 flex-none rounded-lg bg-abbr-soft px-2.5 py-1 text-center font-mono text-[14.5px] font-semibold text-abbr"
        v-html="highlight(entry.abbr ?? '', words)"
      />
      <span class="min-w-0 flex-1 text-[16px] [overflow-wrap:anywhere]" v-html="highlight(entry.meaning, words)" />
      <span
        v-if="showBadge"
        class="hidden rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold tracking-wider uppercase sm:inline"
        :class="badgeClass.a"
      >{{ KIND_LABEL.a }}</span>
    </div>

    <!-- Term / proword -->
    <template v-else>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 pr-8">
        <h2
          class="m-0"
          :class="entry.kind === 'p'
            ? 'font-mono text-[15.5px] font-semibold tracking-wide text-pro'
            : 'font-serif text-[22px] leading-snug font-semibold tracking-tight'"
          v-html="highlight(entry.headword, words)"
        />
        <span
          v-if="showBadge"
          class="rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold tracking-wider uppercase"
          :class="badgeClass[entry.kind]"
        >{{ KIND_LABEL[entry.kind] }}</span>
      </div>

      <button
        v-if="xref"
        type="button"
        class="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[14px] font-medium text-accent transition hover:bg-accent hover:text-paper"
        :title="`Look up ${xref}`"
        @click="emit('lookup', xref)"
      >
        <span v-html="highlight(entry.meaning, words)" />
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </button>

      <div
        v-else
        class="mt-2.5 text-ink/85 [overflow-wrap:anywhere]"
        :class="isLong && !expanded ? 'max-h-48 overflow-hidden [mask-image:linear-gradient(to_bottom,black_50%,transparent)]' : ''"
      >
        <template v-for="(b, i) in blocks" :key="i">
          <p v-if="b.level === 0" class="m-0 mt-3.5 first:mt-0">
            <strong v-if="b.title" class="mb-0.5 block font-semibold text-ink" v-html="highlight(b.title, words)" />
            <span v-html="highlight(b.text, words)" />
          </p>
          <div v-else class="flex gap-3" :class="b.level === 2 ? 'mt-1.5 ml-9' : 'mt-3.5 first:mt-0'">
            <span
              v-if="b.level === 1"
              class="mt-0.5 grid h-6 min-w-6 flex-none place-items-center rounded-md bg-accent-soft px-1 font-mono text-[12px] font-semibold text-accent"
            >{{ b.marker }}</span>
            <span v-else class="w-7 flex-none pt-px text-right font-mono text-[12.5px] font-medium text-muted">{{ b.marker }}</span>
            <div class="min-w-0 flex-1">
              <strong v-if="b.title" class="block font-semibold text-ink" v-html="highlight(b.title, words)" />
              <span v-html="highlight(b.text, words)" />
            </div>
          </div>
        </template>
      </div>

      <button
        v-if="isLong"
        type="button"
        class="mt-3 inline-flex cursor-pointer items-center gap-1 text-[13.5px] font-semibold text-accent hover:text-accent-deep"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Show less' : 'Read full entry' }}
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"
          class="transition-transform" :class="expanded ? 'rotate-180' : ''"
        ><path d="m6 9 6 6 6-6" /></svg>
      </button>
    </template>

    <button
      type="button"
      class="absolute right-3.5 grid size-8 cursor-pointer place-items-center rounded-lg text-muted opacity-50 transition group-hover:opacity-100 hover:bg-canvas hover:text-ink"
      :class="entry.kind === 'a' ? 'top-1/2 -translate-y-1/2' : 'top-4'"
      title="Copy entry"
      aria-label="Copy entry"
      @click="copy"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
    </button>
  </article>
</template>
