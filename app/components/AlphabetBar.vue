<script setup lang="ts">
import { ALPHABET } from '~/utils/dictionary'

const props = defineProps<{ available: Set<string>; disabled: boolean }>()
const model = defineModel<string>({ required: true })

const letters = computed(() => ALPHABET.filter(l => l !== '#' || props.available.has('#')))

function pick(l: string) {
  model.value = model.value === l ? '' : l
  window.scrollTo({ top: 0 })
}
</script>

<template>
  <nav
    class="-mx-5 mt-3 flex gap-0.5 overflow-x-auto px-5 transition-opacity duration-300 [scrollbar-width:none] sm:mx-0 sm:justify-between sm:px-0 [&::-webkit-scrollbar]:hidden"
    :class="disabled ? 'pointer-events-none opacity-35' : ''"
    aria-label="Browse by letter"
  >
    <button
      v-for="l in letters"
      :key="l"
      type="button"
      :disabled="disabled || !available.has(l)"
      class="grid h-8 min-w-8 flex-none cursor-pointer sm:h-7 sm:min-w-6.5 place-items-center rounded-lg text-[12.5px] font-semibold transition-all disabled:cursor-default disabled:bg-transparent disabled:text-faint"
      :class="model === l ? 'bg-accent text-paper shadow-sm' : 'text-ink/80 hover:bg-accent-soft hover:text-accent'"
      :aria-pressed="model === l"
      @click="pick(l)"
    >
      {{ l }}
    </button>
  </nav>
</template>
