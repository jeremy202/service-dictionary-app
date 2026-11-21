<script setup lang="ts">
import { entryById, richText, type Entry } from '~/utils/dictionary'
import { formatMeaning } from '~/utils/formatMeaning'

/**
 * A definition laid out in paragraphs and numbered points.
 * Other dictionary entries named in the text are links (explicit "See ..." references
 * and multi-word terms found in the dictionary); tapping one opens that entry.
 */
const props = defineProps<{ meaning: string; words?: string[]; entry?: Entry | null }>()
const emit = defineEmits<{ open: [entry: Entry] }>()

const blocks = computed(() => {
  const w = props.words ?? []
  const used = new Set<number>() // each entry is linked once per definition
  return formatMeaning(props.meaning).map(b => ({
    ...b,
    titleHtml: b.title ? richText(b.title, w, props.entry ?? null, used) : '',
    html: richText(b.text, w, props.entry ?? null, used),
  }))
})

function onClick(ev: MouseEvent) {
  const a = (ev.target as HTMLElement | null)?.closest?.('a.xref') as HTMLElement | null
  if (!a) return
  ev.preventDefault()
  const id = Number(a.dataset.entry)
  const target = Number.isFinite(id) ? entryById(id) : null
  if (target) emit('open', target) // a reference that can't be found does nothing
}
</script>

<template>
  <div class="meaning" lang="en" @click="onClick">
    <template v-for="(b, i) in blocks" :key="i">
      <p v-if="b.level === 0" class="m-0 mt-4 first:mt-0">
        <strong v-if="b.title" class="mb-1 block text-left font-semibold text-ink" v-html="b.titleHtml" />
        <span v-html="b.html" />
      </p>
      <div v-else class="flex gap-3" :class="b.level === 2 ? 'mt-2 ml-9' : 'mt-4 first:mt-0'">
        <span
          v-if="b.level === 1"
          class="w-6 flex-none pt-px text-right text-[15px] font-semibold text-ink/55 tabular-nums"
        >{{ b.marker }}</span>
        <span v-else class="w-7 flex-none pt-px text-right text-[14px] text-muted tabular-nums">{{ b.marker }}</span>
        <div class="min-w-0 flex-1">
          <strong v-if="b.title" class="block text-left font-semibold text-ink" v-html="b.titleHtml" />
          <span v-html="b.html" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Justified body text; hyphenation keeps the word spacing even on narrow screens */
.meaning p,
.meaning div > div {
  text-align: justify;
  text-justify: inter-word;
  hyphens: auto;
  -webkit-hyphens: auto;
  hyphenate-limit-chars: 6 3 2; /* hyphenate a little more readily: fewer wide gaps */
  overflow-wrap: break-word;
}
.meaning :deep(a.xref) {
  color: var(--color-accent);
  font-weight: 500;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--color-accent) 40%, transparent);
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  border-radius: 2px;
}
.meaning :deep(a.xref:active) {
  background: var(--color-accent-soft);
}
</style>
