<script setup lang="ts">
import { highlight, type Entry } from '~/utils/dictionary'
import { spaceOut } from '~/utils/formatMeaning'

/**
 * One entry as a card. Abbreviations show the word the user searched for on top (smaller,
 * primary) and the abbreviation under it (bigger, mint green). Other entries show the name
 * with a short preview of the meaning.
 */
const props = defineProps<{ entry: Entry; words: string[]; showKind?: boolean; saved?: boolean; recent?: boolean }>()
defineEmits<{ open: [entry: Entry] }>()

const title = computed(() => (props.entry.kind === 'a' ? props.entry.abbr ?? '' : props.entry.headword))
// Short preview of the meaning; the full text is on the entry page.
// When the search word is found further into a long meaning, the preview starts
// just before it ("…at any stage of operations…") so you can see why it matched.
const subtitle = computed(() => {
  const text = spaceOut(props.entry.meaning.replace(/\s+/g, ' '))
  if (!props.words.length) return text
  const lower = text.toLowerCase()
  let at = -1
  for (const w of props.words) {
    const i = lower.indexOf(w)
    if (i !== -1 && (at === -1 || i < at)) at = i
  }
  if (at < 70) return text
  const start = text.lastIndexOf(' ', at - 28)
  return `…${text.slice(start + 1)}`
})

// Abbreviations: the category (remarks column of the abbreviations file)
const remarks = computed(() => props.entry.remarks?.join(' · ') ?? '')

const TAG = { t: 'Dictionary', a: 'Abbreviation', p: 'Proword', s: 'Symbol' }
const titleCls = {
  t: 'text-[16.5px] font-bold',
  a: '',
  p: 'text-[15.5px] font-bold tracking-[.03em]',
  s: 'text-[16px] font-bold',
}
</script>

<template>
  <button
    type="button"
    class="mx-4 mb-2 flex w-[calc(100%-2rem)] cursor-pointer items-center gap-3 rounded-2xl bg-paper py-3 pr-3 pl-4 text-left shadow-card transition-colors active:bg-accent-soft"
    @click="$emit('open', entry)"
  >
    <!-- Military symbol: the symbol from the document on a white tile -->
    <span
      v-if="entry.kind === 's' && entry.symbol"
      class="grid h-12 w-16 flex-none place-items-center rounded-xl border border-line bg-white p-1"
    >
      <img :src="entry.symbol.image" alt="" loading="lazy" class="block h-auto max-h-[38px] w-auto max-w-[54px] object-contain">
    </span>

    <!-- Abbreviation: word on top (smaller, primary), abbreviation below (bigger, mint green) -->
    <span v-if="entry.kind === 'a'" class="min-w-0 flex-1">
      <span class="flex min-w-0 items-start gap-2">
        <span class="min-w-0 flex-1 text-[14.5px] leading-snug font-medium text-ink wrap-title" v-html="highlight(entry.headword, words)" />
        <span v-if="showKind" class="mt-px flex-none rounded-full bg-term-soft px-2 py-px text-[11px] font-medium text-muted">{{ TAG.a }}</span>
      </span>
      <span class="mt-0.5 block text-[21px] leading-tight font-bold tracking-[.01em] text-mint wrap-title" v-html="highlight(entry.abbr ?? '', words)" />
      <span v-if="remarks" class="mt-1 block text-[12px] leading-snug text-muted wrap-title">{{ remarks }}</span>
    </span>

    <!-- Other entries: name, then a preview of the meaning -->
    <span v-else class="min-w-0 flex-1">
      <span class="flex min-w-0 items-start gap-2">
        <span class="min-w-0 flex-1 leading-snug wrap-title" :class="titleCls[entry.kind]" v-html="highlight(title, words)" />
        <span v-if="showKind" class="mt-0.5 flex-none rounded-full bg-term-soft px-2 py-px text-[11px] font-medium text-muted">{{ TAG[entry.kind] }}</span>
      </span>
      <span
        class="mt-0.5 line-clamp-2 text-[13.5px] leading-snug text-muted"
        v-html="entry.kind === 's' && !entry.meaning ? highlight(entry.symbol!.category + ' symbols', words) : highlight(subtitle, words)"
      />
    </span>

    <span v-if="saved" class="flex-none text-accent"><AppIcon name="bookmark" :size="18" filled /></span>
    <span class="flex-none text-faint"><AppIcon :name="recent ? 'arrow-up-right' : 'chevron-right'" :size="17" /></span>
  </button>
</template>
