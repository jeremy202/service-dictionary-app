<script setup lang="ts">
import { applyMatches, findMatches, tally, type Hit, type Match } from '~/utils/abbreviate'
import { abbreviateDocx, decodeText, docxText, readDocx, textToDocx, type Docx } from '~/utils/docx'
import { copyText, saveFile, tap } from '~/composables/useNative'

/**
 * Auto-abbreviate (inside Abbreviations): paste text or upload a .docx / .txt file, and every
 * phrase that has an abbreviation in the app is replaced with it. Shows a summary and the
 * list of replacements (each can be switched off, or another listed abbreviation chosen),
 * and lets the user copy the result or save it as .docx / .txt.
 */
const emit = defineEmits<{ close: []; notify: [msg: string] }>()

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const MAX_BYTES = 15 * 1024 * 1024
const PREVIEW_MAX = 60_000

const mode = ref<'paste' | 'file'>('paste')
const pasted = ref('')
const file = ref<{ name: string; kind: 'docx' | 'txt'; text: string; size: number; docx?: Docx } | null>(null)
const error = ref('')
const stage = ref<'input' | 'result'>('input')
const off = ref(new Set<string>())
const pick = ref(new Map<string, string>())
const picker = ref<HTMLInputElement>()
const body = ref<HTMLElement>()

const source = computed(() => (mode.value === 'file' ? file.value?.text ?? '' : pasted.value))
const canRun = computed(() => source.value.trim().length > 0)
const words = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length

/* ---------- input ---------- */
async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  error.value = ''
  const ext = f.name.toLowerCase().split('.').pop()
  if (f.size > MAX_BYTES) { error.value = 'That file is larger than 15 MB.'; return }
  try {
    const bytes = new Uint8Array(await f.arrayBuffer())
    if (ext === 'docx') {
      const docx = readDocx(bytes)
      file.value = { name: f.name, kind: 'docx', text: docxText(docx), size: f.size, docx }
    } else if (ext === 'txt' || f.type === 'text/plain') {
      file.value = { name: f.name, kind: 'txt', text: decodeText(bytes), size: f.size }
    } else if (ext === 'doc') {
      error.value = 'Older Word files (.doc) can\'t be read. In Word, use Save As → Word Document (.docx), then upload that.'
      return
    } else {
      error.value = 'Choose a Word document (.docx) or a text file (.txt).'
      return
    }
    if (!file.value.text.trim()) error.value = 'This file has no text to abbreviate.'
  } catch {
    file.value = null
    error.value = 'This file could not be opened. Check that it is a Word (.docx) or text (.txt) file.'
  }
}

function run() {
  if (!canRun.value) return
  off.value = new Set()
  pick.value = new Map()
  stage.value = 'result'
  tap()
  nextTick(() => body.value?.scrollTo({ top: 0 }))
}

/* ---------- result ---------- */
const opts = computed(() => ({ off: off.value, pick: pick.value }))
const matches = computed<Match[]>(() => (stage.value === 'result' ? findMatches(source.value, opts.value) : []))
const output = computed(() => applyMatches(source.value, matches.value))

// For an uploaded Word file the whole package is processed (body, headers, footers, notes)
const docxOut = computed(() => {
  if (stage.value !== 'result' || file.value?.kind !== 'docx' || mode.value !== 'file') return null
  try { return abbreviateDocx(file.value.docx!, opts.value) } catch { return 'failed' as const }
})

const hits = computed<Hit[]>(() => {
  const d = docxOut.value
  const map = d && d !== 'failed' ? d.hits : tally(matches.value)
  return [...map.values()]
})
// Phrases the user switched off stay in the list so they can be switched back on
const offHits = computed<Hit[]>(() => {
  if (!off.value.size) return []
  return [...tally(findMatches(source.value, { pick: pick.value }).filter(m => off.value.has(m.key))).values()]
})
const rows = computed(() =>
  [...hits.value.map(h => ({ ...h, on: true })), ...offHits.value.map(h => ({ ...h, on: false }))]
    .sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase)),
)
const total = computed(() => hits.value.reduce((n, h) => n + h.count, 0))

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const preview = computed(() => {
  const src = source.value
  let html = ''
  let at = 0
  for (const m of matches.value) {
    if (m.start >= PREVIEW_MAX) break
    html += esc(src.slice(at, m.start)) + `<mark class="ab" title="${esc(src.slice(m.start, m.end))}">${esc(m.abbr)}</mark>`
    at = m.end
  }
  html += esc(src.slice(at, Math.max(at, PREVIEW_MAX)))
  return html
})
const cut = computed(() => source.value.length > PREVIEW_MAX)

function toggle(key: string) {
  const s = new Set(off.value)
  s.has(key) ? s.delete(key) : s.add(key)
  off.value = s
  tap()
}
function choose(key: string, abbr: string) {
  const m = new Map(pick.value)
  m.set(key, abbr)
  pick.value = m
  tap()
}

/* ---------- export ---------- */
const baseName = computed(() => (mode.value === 'file' && file.value ? file.value.name.replace(/\.[^.]+$/, '') : 'Abbreviated text') + (mode.value === 'file' ? ' (abbreviated)' : ''))
const docxNote = computed(() => {
  if (mode.value === 'file' && file.value?.kind === 'docx') {
    return docxOut.value === 'failed'
      ? 'The formatting of this document could not be kept. The Word file you save will be plain text.'
      : 'Your document\'s formatting is kept. Where one phrase had mixed formatting, the abbreviation takes the formatting of its first word.'
  }
  return mode.value === 'file' ? 'Text files have no formatting, so the Word file is plain text.' : 'Pasted text has no formatting, so the Word file is plain text.'
})

async function copyOut() {
  emit('notify', (await copyText(output.value)) ? 'Abbreviated text copied' : 'Copy is not available')
}
async function saveDocx() {
  const d = docxOut.value
  const bytes = d && d !== 'failed' ? d.bytes : textToDocx(output.value)
  if (!(await saveFile(`${baseName.value}.docx`, bytes, DOCX_MIME))) emit('notify', 'Could not save the file')
}
async function saveTxt() {
  const bytes = new TextEncoder().encode(output.value.replace(/\r?\n/g, '\r\n'))
  if (!(await saveFile(`${baseName.value}.txt`, bytes, 'text/plain'))) emit('notify', 'Could not save the file')
}

function back() {
  if (stage.value === 'result') { stage.value = 'input'; return }
  emit('close')
}
defineExpose({ back })
</script>

<template>
  <div class="fixed inset-x-0 top-0 bottom-[var(--nav-h)] z-30 flex flex-col bg-header">
    <header class="flex-none pt-[env(safe-area-inset-top)] text-on-header">
      <div class="flex h-14 items-center gap-1 px-1.5 pb-1">
        <button type="button" class="flex h-11 cursor-pointer items-center gap-0.5 rounded-xl pr-3 pl-1 text-[16px] font-semibold active:bg-white/10" @click="back">
          <AppIcon name="chevron-left" :size="24" />
          {{ stage === 'result' ? 'Edit' : 'Abbreviations' }}
        </button>
      </div>
      <div class="px-5 pb-5">
        <h1 class="m-0 text-[27px] leading-tight font-bold">Auto-abbreviate</h1>
        <p class="mt-1 mb-0 text-[13.5px] leading-snug text-on-header/80">Replaces phrases with their abbreviations, using only the abbreviations in this app.</p>
      </div>
    </header>

    <div ref="body" class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain rounded-t-[26px] bg-canvas">
      <!-- ===== Input ===== -->
      <template v-if="stage === 'input'">
        <div class="flex-1 px-4 pt-5 pb-4">
          <div class="mb-4 grid grid-cols-2 gap-1 rounded-full bg-term-soft p-1" role="tablist">
            <button
              v-for="m in ([['paste', 'Paste text'], ['file', 'Upload file']] as const)" :key="m[0]"
              type="button" role="tab" :aria-selected="mode === m[0]"
              class="h-10 cursor-pointer rounded-full text-[14.5px] font-semibold transition"
              :class="mode === m[0] ? 'bg-accent text-paper shadow-card' : 'text-ink/70'"
              @click="mode = m[0]; error = ''"
            >{{ m[1] }}</button>
          </div>

          <template v-if="mode === 'paste'">
            <label class="sr-only" for="abbr-text">Text to abbreviate</label>
            <textarea
              id="abbr-text" v-model="pasted"
              placeholder="Paste or type your text here…"
              class="block min-h-[42vh] w-full resize-y rounded-2xl border border-line bg-paper px-4 py-3.5 text-[15.5px] leading-relaxed text-ink shadow-card outline-none placeholder:text-muted focus:border-accent/50 focus:ring-3 focus:ring-accent-soft"
            />
            <div class="mt-2 flex items-center justify-between px-1 text-[12.5px] text-muted">
              <span>{{ words(pasted).toLocaleString() }} words</span>
              <button v-if="pasted" type="button" class="cursor-pointer font-semibold text-accent" @click="pasted = ''">Clear</button>
            </div>
          </template>

          <template v-else>
            <input ref="picker" type="file" class="hidden" :accept="`.docx,.txt,text/plain,${DOCX_MIME}`" @change="onFile">
            <div v-if="file" class="flex items-center gap-3 rounded-2xl bg-paper px-4 py-3.5 shadow-card">
              <span class="grid size-11 flex-none place-items-center rounded-xl bg-accent-soft text-accent"><AppIcon name="file" :size="22" /></span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[15px] font-semibold">{{ file.name }}</span>
                <span class="block text-[12.5px] text-muted">{{ file.kind === 'docx' ? 'Word document' : 'Text file' }} · {{ words(file.text).toLocaleString() }} words</span>
              </span>
              <button type="button" class="cursor-pointer px-1 text-[13.5px] font-semibold text-accent" @click="picker?.click()">Change</button>
            </div>
            <button
              v-else type="button"
              class="flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line bg-paper/60 px-6 py-10 text-center active:bg-accent-soft/50"
              @click="picker?.click()"
            >
              <span class="grid size-14 place-items-center rounded-2xl bg-sand text-on-sand"><AppIcon name="upload" :size="26" /></span>
              <span class="mt-1 text-[16px] font-bold">Choose a file</span>
              <span class="text-[13.5px] text-muted">Word document (.docx) or text file (.txt)</span>
            </button>
          </template>

          <p v-if="error" class="mt-3 mb-0 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13.5px] leading-snug text-danger">{{ error }}</p>
        </div>

        <div class="sticky bottom-0 bg-gradient-to-t from-canvas from-70% to-transparent px-4 pt-3 pb-4">
          <button
            type="button" :disabled="!canRun"
            class="flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-accent text-[16px] font-semibold text-paper shadow-lift transition active:scale-[.99] disabled:opacity-45 disabled:shadow-none"
            @click="run"
          >
            <AppIcon name="wand" :size="20" /> Abbreviate
          </button>
        </div>
      </template>

      <!-- ===== Result ===== -->
      <div v-else class="px-4 pt-5 pb-8">
        <!-- Summary -->
        <div class="grid grid-cols-2 gap-2.5">
          <div class="rounded-2xl bg-paper px-4 py-3.5 shadow-card">
            <div class="text-[30px] leading-none font-bold text-mint tabular-nums">{{ hits.length }}</div>
            <div class="mt-1.5 text-[13px] text-muted">{{ hits.length === 1 ? 'term' : 'terms' }} abbreviated</div>
          </div>
          <div class="rounded-2xl bg-paper px-4 py-3.5 shadow-card">
            <div class="text-[30px] leading-none font-bold text-mint tabular-nums">{{ total }}</div>
            <div class="mt-1.5 text-[13px] text-muted">{{ total === 1 ? 'replacement' : 'replacements' }}</div>
          </div>
        </div>
        <p v-if="!hits.length && !offHits.length" class="mt-3 mb-0 rounded-xl bg-sand px-3.5 py-2.5 text-[13.5px] leading-snug text-on-sand">
          No phrase in this text has an abbreviation in the app.
        </p>

        <!-- Export -->
        <div class="mt-4 grid grid-cols-3 gap-2">
          <button type="button" class="flex h-12 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-accent text-[14px] font-semibold text-paper active:opacity-85" @click="copyOut">
            <AppIcon name="copy" :size="17" /> Copy
          </button>
          <button type="button" class="flex h-12 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-paper text-[14px] font-semibold text-ink shadow-card active:bg-accent-soft" @click="saveDocx">
            <AppIcon name="download" :size="17" /> .docx
          </button>
          <button type="button" class="flex h-12 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-paper text-[14px] font-semibold text-ink shadow-card active:bg-accent-soft" @click="saveTxt">
            <AppIcon name="download" :size="17" /> .txt
          </button>
        </div>
        <p class="mt-2.5 mb-0 px-1 text-[12.5px] leading-snug" :class="docxOut === 'failed' ? 'font-semibold text-danger' : 'text-muted'">{{ docxNote }}</p>

        <!-- Replacements -->
        <section v-if="rows.length" class="mt-6">
          <h2 class="mt-0 mb-2 flex items-baseline gap-1.5 px-1 text-[15px] font-bold">
            Replacements <span class="text-[13px] font-normal text-muted">({{ rows.length }})</span>
          </h2>
          <p class="mt-0 mb-2.5 px-1 text-[12.5px] text-muted">Tap a row to keep that phrase as written.</p>
          <div class="overflow-hidden rounded-2xl bg-paper shadow-card">
            <div v-for="r in rows" :key="r.key" class="border-b border-line/70 last:border-b-0">
              <button
                type="button" role="switch" :aria-checked="r.on"
                class="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left active:bg-accent-soft/60"
                @click="toggle(r.key)"
              >
                <span class="grid size-5.5 flex-none place-items-center rounded-md border-2 transition" :class="r.on ? 'border-accent bg-accent text-paper' : 'border-faint'">
                  <svg v-if="r.on" viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </span>
                <span class="min-w-0 flex-1 text-[15px] leading-snug" :class="r.on ? '' : 'text-muted'">
                  <span class="[overflow-wrap:anywhere]" :class="r.on ? '' : 'line-through decoration-1'">{{ r.phrase }}</span>
                  <span class="mx-1.5 text-muted">→</span>
                  <b class="font-bold" :class="r.on ? 'text-mint' : ''">{{ pick.get(r.key) ?? r.alts[0] }}</b>
                </span>
                <span class="flex-none rounded-full bg-term-soft px-2 py-0.5 text-[12.5px] font-semibold text-muted tabular-nums">×{{ r.count }}</span>
              </button>
              <div v-if="r.alts.length > 1 && r.on" class="-mt-1 flex flex-wrap items-center gap-1.5 pr-4 pb-3 pl-12">
                <span class="text-[12px] text-muted">Use:</span>
                <button
                  v-for="a in r.alts" :key="a" type="button"
                  class="cursor-pointer rounded-full px-2.5 py-0.5 text-[13px] font-bold transition"
                  :class="(pick.get(r.key) ?? r.alts[0]) === a ? 'bg-accent text-paper' : 'bg-abbr-soft text-mint'"
                  @click="choose(r.key, a)"
                >{{ a }}</button>
              </div>
            </div>
          </div>
        </section>

        <!-- Abbreviated text -->
        <section class="mt-6">
          <h2 class="mt-0 mb-2 px-1 text-[15px] font-bold">Abbreviated text</h2>
          <div class="abbr-out rounded-2xl bg-paper px-4 py-3.5 text-[15.5px] leading-relaxed whitespace-pre-wrap text-ink shadow-card select-text [overflow-wrap:anywhere]" v-html="preview" />
          <p v-if="cut" class="mt-2 mb-0 px-1 text-[12.5px] text-muted">The preview shows the start of the text. Copy and the saved files include all of it.</p>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.abbr-out :deep(mark.ab) {
  background: var(--abbr-soft);
  color: var(--mint);
  font-weight: 700;
  border-radius: 4px;
  padding: 0 2px;
}
</style>
