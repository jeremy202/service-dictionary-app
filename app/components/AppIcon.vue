<script setup lang="ts">
// Small line-icon set used across the app (24×24, stroke-based)
defineProps<{ name: string; size?: number; filled?: boolean }>()
</script>

<template>
  <svg
    :width="size ?? 22" :height="size ?? 22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
  >
    <template v-if="name === 'book'">
      <path d="M12 7c-1.6-1.4-4-2-7-2v12.5c3 0 5.4.6 7 2 1.6-1.4 4-2 7-2V5c-3 0-5.4.6-7 2Z" :fill="filled ? 'currentColor' : 'none'" :fill-opacity="filled ? .14 : 0" />
      <path d="M12 7v12.5" />
    </template>
    <path v-else-if="name === 'bookmark'" d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z" :fill="filled ? 'currentColor' : 'none'" />
    <template v-else-if="name === 'clock'"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></template>
    <template v-else-if="name === 'search'"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></template>
    <path v-else-if="name === 'chevron-right'" d="m9.5 6 6 6-6 6" />
    <path v-else-if="name === 'chevron-left'" d="m14.5 6-6 6 6 6" />
    <path v-else-if="name === 'x'" d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    <template v-else-if="name === 'share'"><path d="M12 15V4M8 8l4-4 4 4" /><path d="M6 12v6.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V12" /></template>
    <template v-else-if="name === 'copy'"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></template>
    <path v-else-if="name === 'check'" d="m5 12.5 4.5 4.5L19 7.5" />
    <path v-else-if="name === 'arrow-right'" d="M5 12h14M13 6l6 6-6 6" />
    <template v-else-if="name === 'sort'"><path d="M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3" /></template>
  </svg>
</template>
