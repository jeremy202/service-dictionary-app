<script setup lang="ts">
defineProps<{ icon: string; title: string; text: string }>()
</script>

<template>
  <div class="flex flex-col items-center px-10 pt-24 pb-10 text-center">
    <div class="mb-4 grid size-14 place-items-center rounded-full border border-line text-muted">
      <AppIcon :name="icon" :size="28" />
    </div>
    <h3 class="m-0 font-serif text-[21px] font-semibold">{{ title }}</h3>
    <p class="mt-1.5 max-w-xs text-[14.5px] leading-relaxed text-muted">{{ text }}</p>
    <slot />
  </div>
</template>
