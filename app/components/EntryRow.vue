<script setup lang="ts">
import { highlight, type Entry } from '~/utils/dictionary'
import { spaceOut } from '~/utils/formatMeaning'

/**
 * compact: the two-column table used on the Abbreviations tab (abbreviation | full form).
 * Otherwise every kind of entry uses the same two-line row: name + type tag, then the
 * meaning (or full form) underneath. Used for All, Terms, Prowords, Saved and Recent.
 */
const props = defineProps<{ entry: Entry; words: string[]; showKind?: boolean; saved?: boolean; compact?: boolean }>()
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

const TAG = {
  t: { label: 'Term', cls: 'text-term border-term/45' },
  a: { label: 'Abbr', cls: 'text-abbr border-abbr/45' },
  p: { label: 'Proword', cls: 'text-pro border-pro/45' },
}
const titleCls = {
  t: 'font-serif text-[19.5px] font-semibold',
  a: 'font-mono text-[15.5px] font-semibold text-abbr',
  p: 'font-mono text-[14.5px] font-semibold tracking-wide text-pro',
}
</script>

<template>
  <button
    type="button"
    class="flex w-full cursor-pointer items-center gap-3 border-b border-line/70 pr-9 pl-4 text-left transition-colors active:bg-line/50"
    :class="compact ? 'py-3' : 'py-3'"
    @click="$emit('open', entry)"
  >
    <!-- Abbreviations tab: abbreviation | full form -->
    <template v-if="compact && entry.kind === 'a'">
      <span class="w-[5.75rem] flex-none truncate font-mono text-[14.5px] font-semibold text-abbr" v-html="highlight(entry.abbr ?? '', words)" />
      <span class="line-clamp-2 min-w-0 flex-1 text-[15.5px] leading-snug" v-html="highlight(entry.meaning, words)" />
    </template>

    <!-- Standard row -->
    <span v-else class="min-w-0 flex-1">
      <span class="flex min-w-0 items-center gap-2">
        <span class="min-w-0 truncate leading-snug" :class="titleCls[entry.kind]" v-html="highlight(title, words)" />
        <span
          v-if="showKind"
          class="flex-none rounded-[2px] border px-1 py-px font-mono text-[9px] leading-none font-semibold tracking-[.08em] uppercase"
          :class="TAG[entry.kind].cls"
        >{{ TAG[entry.kind].label }}</span>
      </span>
      <span
        class="mt-0.5 text-[13.5px] leading-snug text-muted"
        :class="entry.kind === 'a' ? 'line-clamp-1 text-ink/75' : 'line-clamp-2'"
        v-html="highlight(subtitle, words)"
      />
    </span>

    <span v-if="saved" class="flex-none text-brass"><AppIcon name="bookmark" :size="15" filled /></span>
    <span class="flex-none text-faint"><AppIcon name="chevron-right" :size="16" /></span>
  </button>
</template>
