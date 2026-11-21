<script setup lang="ts">
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

/**
 * Shows the manual's original pages (pdf.js). Pages are drawn only when they come near the
 * screen and are cleared again when far away, so all 430 pages scroll smoothly on a phone.
 */
const props = defineProps<{ startPage: number }>()
const emit = defineEmits<{ close: [] }>()
const manual = useManual()

type PDFDoc = { numPages: number; getPage: (n: number) => Promise<any>; destroy: () => Promise<void> }
let doc: PDFDoc | null = null
const total = ref(0)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const errorText = ref('')
const ratio = ref(842 / 595) // page height / width (A4 until the first page is read)

const scroller = ref<HTMLElement>()
const width = ref(360)
const zoom = ref(1)
const ZOOMS = [1, 1.5, 2, 2.5, 3]
const pageW = computed(() => Math.round((width.value - 16) * zoom.value))
const pageH = computed(() => Math.round(pageW.value * ratio.value))
const GAP = 10
const current = ref(props.startPage || 1)

const section = computed(() => manual.sectionOf(current.value))
const sectionLabel = computed(() => {
  const s = section.value
  if (!s) return manual.index.value?.title ?? 'Manual'
  return s.type === 'chapter' ? `Chapter ${s.n}` : `Chapter ${s.chapter} · Annex ${s.annex}`
})

/* ---------- drawing ---------- */
const canvases = new Map<number, HTMLCanvasElement>()
const drawn = new Map<number, number>() // page -> width drawn at
const tasks = new Map<number, any>()
let observer: IntersectionObserver | null = null
const visible = new Set<number>()

function setCanvas(n: number, el: Element | null) {
  if (el) {
    canvases.set(n, el as HTMLCanvasElement)
    observer?.observe(el)
  } else {
    canvases.delete(n)
  }
}

async function draw(n: number) {
  const canvas = canvases.get(n)
  if (!doc || !canvas || drawn.get(n) === pageW.value) return
  tasks.get(n)?.cancel?.()
  const page = await doc.getPage(n)
  const base = page.getViewport({ scale: 1 })
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const viewport = page.getViewport({ scale: (pageW.value / base.width) * dpr })
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const task = page.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas })
  tasks.set(n, task)
  try {
    await task.promise
    drawn.set(n, pageW.value)
  } catch { /* cancelled: a newer drawing took over */ }
}

function clear(n: number) {
  const c = canvases.get(n)
  tasks.get(n)?.cancel?.()
  if (c && drawn.has(n)) { c.width = 0; c.height = 0; drawn.delete(n) }
}

function redrawVisible() {
  for (const n of [...drawn.keys()]) if (!visible.has(n)) clear(n)
  for (const n of visible) draw(n)
}

/* ---------- scrolling ---------- */
function onScroll() {
  const el = scroller.value
  if (!el || !total.value) return
  const p = Math.floor((el.scrollTop + el.clientHeight * 0.35) / (pageH.value + GAP)) + 1
  current.value = Math.min(total.value, Math.max(1, p))
}
watch(current, p => manual.rememberPage(p))

function goTo(n: number, smooth = false) {
  const el = scroller.value
  if (!el) return
  const p = Math.min(Math.max(1, Math.round(n)), total.value || 1)
  el.scrollTo({ top: (p - 1) * (pageH.value + GAP), behavior: smooth ? 'smooth' : 'auto' })
  current.value = p
}

async function setZoom(z: number) {
  const el = scroller.value
  if (!el) return
  const keep = current.value
  const frac = (el.scrollTop % (pageH.value + GAP)) / (pageH.value + GAP)
  zoom.value = z
  await nextTick()
  el.scrollTop = (keep - 1 + frac) * (pageH.value + GAP)
  redrawVisible()
}
const zoomIn = () => setZoom(ZOOMS.find(z => z > zoom.value) ?? zoom.value)
const zoomOut = () => setZoom([...ZOOMS].reverse().find(z => z < zoom.value) ?? 1)

const jumping = ref(false)
const jumpValue = ref('')
function openJump() { jumpValue.value = String(current.value); jumping.value = true }
function doJump() {
  const n = Number(jumpValue.value)
  if (Number.isFinite(n) && n >= 1) goTo(n)
  jumping.value = false
}

/* ---------- loading ---------- */
onMounted(async () => {
  width.value = scroller.value?.clientWidth || window.innerWidth
  window.addEventListener('resize', onResize)
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    const bytes = await manual.pdf()
    // pdf.js takes ownership of the buffer it is given, so hand it a copy
    doc = (await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableAutoFetch: true }).promise) as unknown as PDFDoc
    const first = await doc.getPage(1)
    const v = first.getViewport({ scale: 1 })
    ratio.value = v.height / v.width
    total.value = doc.numPages
    status.value = 'ready'
    await nextTick()
    observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const n = Number((e.target as HTMLElement).dataset.page)
        if (e.isIntersecting) { visible.add(n); draw(n) } else { visible.delete(n); clear(n) }
      }
    }, { root: scroller.value, rootMargin: '150% 0px' })
    for (const c of canvases.values()) observer.observe(c)
    goTo(props.startPage || 1)
  } catch (e: any) {
    status.value = 'error'
    errorText.value = e?.message || 'Could not open the manual.'
  }
})

let resizeTimer: ReturnType<typeof setTimeout> | undefined
function onResize() {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    const keep = current.value
    width.value = scroller.value?.clientWidth || window.innerWidth
    nextTick(() => { goTo(keep); redrawVisible() })
  }, 150)
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  observer?.disconnect()
  for (const n of [...drawn.keys()]) clear(n)
  doc?.destroy()
  doc = null
})
</script>

<template>
  <div class="fixed inset-0 z-30 flex flex-col bg-[#e7e1d5] dark:bg-[#0c100e]">
    <!-- Top bar -->
    <header class="flex-none rounded-b-3xl bg-header pt-[env(safe-area-inset-top)] text-on-header shadow-lift">
      <div class="flex h-14 items-center gap-1 px-1.5 pb-1">
        <button type="button" class="flex h-11 cursor-pointer items-center gap-0.5 rounded-xl pr-3 pl-1 text-[16px] font-medium text-on-header active:bg-white/10" @click="emit('close')">
          <AppIcon name="chevron-left" :size="24" />
          Contents
        </button>
        <div class="min-w-0 flex-1 text-center">
          <div class="truncate text-[13px] font-semibold text-on-header/85">{{ sectionLabel }}</div>
        </div>
        <button
          type="button"
          class="h-9 cursor-pointer rounded-full bg-white/15 px-3 text-[13.5px] font-semibold text-on-header tabular-nums active:bg-white/25"
          aria-label="Go to page"
          @click="openJump"
        >{{ current }} / {{ total || '…' }}</button>
      </div>
    </header>

    <!-- Pages -->
    <div ref="scroller" class="relative min-h-0 flex-1 overflow-auto overscroll-contain" @scroll.passive="onScroll">
      <div v-if="status === 'loading'" class="absolute inset-0 grid place-items-center">
        <div class="flex flex-col items-center gap-3 text-[14px] text-muted">
          <span class="size-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          Opening the manual…
        </div>
      </div>
      <div v-else-if="status === 'error'" class="absolute inset-0 grid place-items-center px-8 text-center text-[15px] text-ink/80">{{ errorText }}</div>
      <div v-else class="py-2" :style="{ width: `${pageW + 16}px` }">
        <div
          v-for="n in total" :key="n"
          class="mx-2 overflow-hidden rounded-md bg-white shadow-card"
          :style="{ width: `${pageW}px`, height: `${pageH}px`, marginBottom: `${GAP}px` }"
        >
          <canvas :ref="el => setCanvas(n, el as Element | null)" :data-page="n" class="block size-full" />
        </div>
      </div>
    </div>

    <!-- Bottom bar -->
    <footer class="flex flex-none items-center justify-between border-t border-line/70 bg-canvas/95 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+.5rem)] backdrop-blur-xl">
      <div class="flex items-center gap-1">
        <button type="button" class="grid size-11 cursor-pointer place-items-center rounded-xl text-ink/80 active:bg-line/50 disabled:opacity-30" :disabled="current <= 1" aria-label="Previous page" @click="goTo(current - 1, true)">
          <AppIcon name="chevron-left" />
        </button>
        <button type="button" class="grid size-11 cursor-pointer place-items-center rounded-xl text-ink/80 active:bg-line/50 disabled:opacity-30" :disabled="current >= total" aria-label="Next page" @click="goTo(current + 1, true)">
          <AppIcon name="chevron-right" />
        </button>
      </div>
      <div class="flex items-center gap-1">
        <button type="button" class="grid size-11 cursor-pointer place-items-center rounded-xl text-ink/80 active:bg-line/50 disabled:opacity-30" :disabled="zoom <= 1" aria-label="Zoom out" @click="zoomOut">
          <AppIcon name="zoom-out" />
        </button>
        <span class="w-12 text-center text-[13px] font-medium text-muted tabular-nums">{{ Math.round(zoom * 100) }}%</span>
        <button type="button" class="grid size-11 cursor-pointer place-items-center rounded-xl text-ink/80 active:bg-line/50 disabled:opacity-30" :disabled="zoom >= 3" aria-label="Zoom in" @click="zoomIn">
          <AppIcon name="zoom-in" />
        </button>
      </div>
    </footer>

    <!-- Go to page -->
    <div v-if="jumping" class="fixed inset-0 z-40 grid place-items-center bg-black/40 px-8" @click.self="jumping = false">
      <form class="w-full max-w-xs rounded-lg bg-paper p-5 shadow-lift" @submit.prevent="doJump">
        <label class="block text-[15px] font-semibold" for="jump">Go to page</label>
        <p class="mt-1 mb-3 text-[13px] text-muted">1 to {{ total }}</p>
        <input
          id="jump" v-model="jumpValue" type="number" inputmode="numeric" min="1" :max="total" autofocus
          class="h-11 w-full rounded-md border border-line bg-canvas px-3 text-[17px] tabular-nums outline-none focus:border-accent"
        >
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="h-10 cursor-pointer rounded-md px-4 text-[15px] font-medium text-ink/70" @click="jumping = false">Cancel</button>
          <button type="submit" class="h-10 cursor-pointer rounded-md bg-accent px-5 text-[15px] font-semibold text-paper">Go</button>
        </div>
      </form>
    </div>
  </div>
</template>
