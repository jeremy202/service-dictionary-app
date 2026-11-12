<script setup lang="ts">
// A–Z index down the right edge (tap or drag), like the phone's contacts app.
const props = defineProps<{ letters: string[]; available: Set<string> }>()
const emit = defineEmits<{ jump: [letter: string] }>()

const active = ref('')
let last = ''

function pick(ev: PointerEvent) {
  const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
  const l = el?.dataset?.letter
  if (!l || !props.available.has(l) || l === last) return
  last = l
  active.value = l
  emit('jump', l)
}
function start(ev: PointerEvent) {
  ;(ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId)
  last = ''
  pick(ev)
}
function end() {
  setTimeout(() => { active.value = '' }, 350)
}
</script>

<template>
  <div
    class="flex touch-none flex-col items-center justify-center py-2 select-none"
    @pointerdown.prevent="start"
    @pointermove="(e) => e.buttons && pick(e)"
    @pointerup="end"
    @pointercancel="end"
  >
    <span
      v-for="l in letters"
      :key="l"
      :data-letter="l"
      class="grid h-[min(3.6vh,17px)] w-6 place-items-center text-[10.5px] font-semibold"
      :class="available.has(l) ? 'text-accent' : 'text-faint'"
    >{{ l }}</span>

    <!-- Bubble showing the letter while scrubbing -->
    <Transition enter-from-class="opacity-0 scale-75" leave-to-class="opacity-0 scale-75" enter-active-class="transition duration-150" leave-active-class="transition duration-200">
      <div
        v-if="active"
        class="pointer-events-none fixed top-1/2 left-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-ink/80 font-serif text-[40px] font-semibold text-canvas backdrop-blur"
      >
        {{ active }}
      </div>
    </Transition>
  </div>
</template>
