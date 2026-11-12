<script setup lang="ts">
const model = defineModel<string>({ required: true })
const input = ref<HTMLInputElement>()

function onKey(e: KeyboardEvent) {
  if (e.key === '/' && document.activeElement !== input.value) {
    e.preventDefault()
    input.value?.focus()
  }
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

function clear() {
  model.value = ''
  input.value?.focus()
}
</script>

<template>
  <div class="group relative">
    <svg
      class="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-muted transition-colors group-focus-within:text-accent"
      width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
    >
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
    <input
      ref="input"
      v-model="model"
      type="search"
      placeholder="Search the dictionary…"
      autocomplete="off"
      spellcheck="false"
      aria-label="Search the dictionary"
      class="w-full rounded-2xl border border-line bg-paper py-4 pr-24 pl-13 text-[16px] text-ink shadow-card transition outline-none placeholder:text-muted/80 focus:border-accent/60 focus:shadow-lift focus:ring-4 focus:ring-accent-soft"
      @keydown.esc="clear"
    >
    <div class="absolute top-1/2 right-4 flex -translate-y-1/2 items-center gap-2">
      <button
        v-if="model"
        type="button"
        class="grid size-7 cursor-pointer place-items-center rounded-full bg-canvas text-muted transition hover:bg-line hover:text-ink"
        aria-label="Clear search"
        @click="clear"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      <kbd class="hidden rounded-md border border-line bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-muted sm:inline">/</kbd>
    </div>
  </div>
</template>
