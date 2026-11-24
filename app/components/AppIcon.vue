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
    <template v-else-if="name === 'home'"><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1Z" :fill="filled ? 'currentColor' : 'none'" :fill-opacity="filled ? .14 : 0" /></template>
    <template v-else-if="name === 'wand'"><path d="M4 20 15 9M13 7l4 4" /><path d="M18 3v3M16.5 4.5h3M20 9v2M19 10h2M10 3v2M9 4h2" /></template>
    <template v-else-if="name === 'upload'"><path d="M12 15V4M8 8l4-4 4 4" /><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15" /></template>
    <template v-else-if="name === 'download'"><path d="M12 4v11M8 11l4 4 4-4" /><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15" /></template>
    <template v-else-if="name === 'file'"><path d="M14 3.5H7.5a1.5 1.5 0 0 0-1.5 1.5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V7.5Z" /><path d="M14 3.5v4h4M9 12.5h6M9 16h6" /></template>
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
