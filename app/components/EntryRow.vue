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
const subtitle = computed(() => spaceOut(props.entry.meaning.replace(/\s+/g, ' ')))

const TAG = {
  t: { label: 'Term', cls: 'text-term bg-term-soft' },
  a: { label: 'Abbr', cls: 'text-abbr bg-abbr-soft' },
  p: { label: 'Proword', cls: 'text-pro bg-pro-soft' },
}
const titleCls = {
  t: 'font-serif text-[17.5px] font-semibold tracking-tight',
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
      <span class="min-w-0 flex-1 text-[15.5px] leading-snug" v-html="highlight(entry.meaning, words)" />
    </template>

    <!-- Standard row -->
    <span v-else class="min-w-0 flex-1">
      <span class="flex min-w-0 items-center gap-2">
        <span class="min-w-0 truncate leading-snug" :class="titleCls[entry.kind]" v-html="highlight(title, words)" />
        <span
          v-if="showKind"
          class="flex-none rounded-[5px] px-1.5 py-px text-[9.5px] font-bold tracking-wider uppercase"
          :class="TAG[entry.kind].cls"
        >{{ TAG[entry.kind].label }}</span>
      </span>
      <span
        class="mt-0.5 block text-[13.5px] leading-snug text-muted"
        :class="entry.kind === 'a' ? 'truncate text-ink/75' : 'line-clamp-2'"
        v-html="highlight(subtitle, words)"
      />
    </span>

    <span v-if="saved" class="flex-none text-brass"><AppIcon name="bookmark" :size="15" filled /></span>
    <span class="flex-none text-faint"><AppIcon name="chevron-right" :size="16" /></span>
  </button>
</template>
