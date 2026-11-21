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
    <template v-else-if="name === 'trash'"><path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2a1 1 0 0 0 1 .8h7.2a1 1 0 0 0 1-.8L17.5 7M10 11v5.5M14 11v5.5" /></template>
    <template v-else-if="name === 'arrow-up-right'"><path d="M8 16 16.5 7.5M9.5 7.5h7v7" /></template>
    <template v-else-if="name === 'lock'"><rect x="5" y="10.5" width="14" height="10" rx="2" :fill="filled ? 'currentColor' : 'none'" :fill-opacity="filled ? .14 : 0" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></template>
    <template v-else-if="name === 'unlock'"><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 7.6-1.7" /></template>
    <template v-else-if="name === 'manual'"><path d="M6.5 4h8l3 3v13h-11Z" :fill="filled ? 'currentColor' : 'none'" :fill-opacity="filled ? .14 : 0" /><path d="M14.5 4v3h3M9 11h6M9 14.5h6M9 18h4" /></template>
    <template v-else-if="name === 'list'"><path d="M9 6.5h11M9 12h11M9 17.5h11" /><circle cx="4.75" cy="6.5" r="1" fill="currentColor" /><circle cx="4.75" cy="12" r="1" fill="currentColor" /><circle cx="4.75" cy="17.5" r="1" fill="currentColor" /></template>
    <template v-else-if="name === 'zoom-in'"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2M11 8.5v5M8.5 11h5" /></template>
    <template v-else-if="name === 'zoom-out'"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2M8.5 11h5" /></template>
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
