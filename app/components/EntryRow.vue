<script setup lang="ts">
import { highlight, KIND_LABEL, type Entry } from '~/utils/dictionary'
import { spaceOut } from '~/utils/formatMeaning'

const props = defineProps<{ entry: Entry; words: string[]; showKind?: boolean; saved?: boolean }>()
defineEmits<{ open: [entry: Entry] }>()

// One-line preview of the meaning (the full text is on the entry page)
const preview = computed(() => spaceOut(props.entry.meaning.replace(/\s+/g, ' ')))
const kindColor = { t: 'text-term', a: 'text-abbr', p: 'text-pro' }
</script>

<template>
  <button
    type="button"
    class="flex w-full cursor-pointer items-center gap-3 border-b border-line/70 py-3 pr-9 pl-4 text-left transition-colors active:bg-line/50"
    @click="$emit('open', entry)"
  >
    <!-- Abbreviation: abbreviation | full form -->
    <template v-if="entry.kind === 'a'">
      <span class="w-[5.75rem] flex-none truncate font-mono text-[14.5px] font-semibold text-abbr" v-html="highlight(entry.abbr ?? '', words)" />
      <span class="min-w-0 flex-1 text-[15.5px] leading-snug" v-html="highlight(entry.meaning, words)" />
    </template>

    <!-- Term / proword: headword + preview -->
    <span v-else class="min-w-0 flex-1">
      <span
        class="block truncate"
        :class="entry.kind === 'p'
          ? 'font-mono text-[14.5px] font-semibold tracking-wide text-pro'
          : 'font-serif text-[17.5px] leading-snug font-semibold tracking-tight'"
        v-html="highlight(entry.headword, words)"
      />
      <span class="mt-0.5 line-clamp-2 text-[13.5px] leading-snug text-muted" v-html="highlight(preview, words)" />
    </span>

    <span v-if="saved" class="flex-none text-brass"><AppIcon name="bookmark" :size="15" filled /></span>
    <span
      v-if="showKind"
      class="flex-none text-[10px] font-semibold tracking-wider uppercase"
      :class="kindColor[entry.kind]"
    >{{ KIND_LABEL[entry.kind] === 'Abbreviation' ? 'Abbr' : KIND_LABEL[entry.kind] }}</span>
    <span class="flex-none text-faint"><AppIcon name="chevron-right" :size="16" /></span>
  </button>
</template>
