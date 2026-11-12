<script setup lang="ts">
import { highlight } from '~/utils/dictionary'
import { formatMeaning } from '~/utils/formatMeaning'

const props = defineProps<{ meaning: string; words?: string[] }>()
const blocks = computed(() => formatMeaning(props.meaning))
const w = computed(() => props.words ?? [])
</script>

<template>
  <div class="[overflow-wrap:anywhere]">
    <template v-for="(b, i) in blocks" :key="i">
      <p v-if="b.level === 0" class="m-0 mt-4 first:mt-0">
        <strong v-if="b.title" class="mb-1 block font-semibold text-ink" v-html="highlight(b.title, w)" />
        <span v-html="highlight(b.text, w)" />
      </p>
      <div v-else class="flex gap-3" :class="b.level === 2 ? 'mt-2 ml-9' : 'mt-4 first:mt-0'">
        <span
          v-if="b.level === 1"
          class="w-6 flex-none pt-px text-right text-[15px] font-semibold text-ink/55 tabular-nums"
        >{{ b.marker }}</span>
        <span v-else class="w-7 flex-none pt-px text-right text-[14px] text-muted tabular-nums">{{ b.marker }}</span>
        <div class="min-w-0 flex-1">
          <strong v-if="b.title" class="block font-semibold text-ink" v-html="highlight(b.title, w)" />
          <span v-html="highlight(b.text, w)" />
        </div>
      </div>
    </template>
  </div>
</template>
