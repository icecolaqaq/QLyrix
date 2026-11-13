<template>
  <div
    ref="el"
    class="pixi-subs"
    :style="{ transform: `translate(calc(-50% + ${px}px), ${py}px)` }"
    @mousedown="ds"
    @wheel.passive="handleWheel"
  >
    <canvas ref="cv"></canvas>
    <div v-if="showEffectBadge && effectLabel" class="effect-badge">{{ effectLabel }}</div>
    <Transition name="fade">
      <div v-if="showTip" class="font-size-tip">字幕大小: {{ baseFontSize }}px</div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import type { LyricLine } from '@/services/qmusiclrcparser'
import { subtitleFontSize as baseFontSize } from '@/services/store'

const props = defineProps<{
  lyricLines: LyricLine[]
  currentTime: number
  playing: boolean
  playedColor?: string
  defaultColor?: string
  transColor?: string
  effect?: string
  effectLabel?: string
}>()

const el = ref<HTMLDivElement>()
const cv = ref<HTMLCanvasElement>()
const CW = 1200
const CH = 500

const px = ref(Number(localStorage.getItem('pixi_subs_px') || 0))
const py = ref(Number(localStorage.getItem('pixi_subs_py') || 0))
let dg = false
let dx0 = 0
let dy0 = 0
let ox = 0
let oy = 0

const showTip = ref(false)
const showEffectBadge = ref(false)
let badgeTimer: ReturnType<typeof setTimeout> | null = null
let tipTimer: ReturnType<typeof setTimeout> | null = null

let worker: Worker | null = null

function initWorker() {
  if (!cv.value) return
  try {
    const offscreen = cv.value.transferControlToOffscreen()
    worker = new Worker(new URL('./subtitles.worker.ts', import.meta.url), {
      type: 'module'
    })
    worker.postMessage(
      {
        type: 'init',
        canvas: offscreen,
        CW,
        CH,
        baseFontSize: baseFontSize.value,
        playedColor: props.playedColor,
        defaultColor: props.defaultColor,
        transColor: props.transColor,
        effect: props.effect,
        lyricLines: JSON.parse(JSON.stringify(props.lyricLines || [])),
        currentTime: props.currentTime,
        playing: props.playing
      },
      [offscreen]
    )
  } catch (err) {
    console.error('[PixiSubtitles] Failed to initialize worker with offscreen canvas:', err)
  }
}

function handleWheel(e: WheelEvent) {
  if (!e.ctrlKey) return
  try {
    if (e.cancelable) e.preventDefault()
  } catch {}

  const step = 2
  const minFs = 1
  const maxFs = 999

  const nextFs = baseFontSize.value + (e.deltaY < 0 ? step : -step)
  const clampedFs = Math.min(maxFs, Math.max(minFs, nextFs))

  if (clampedFs !== baseFontSize.value) {
    baseFontSize.value = clampedFs
    localStorage.setItem('pixi_subs_font_size', String(clampedFs))

    worker?.postMessage({
      type: 'updateFontSize',
      fontSize: clampedFs
    })

    showTip.value = true
    if (tipTimer) clearTimeout(tipTimer)
    tipTimer = setTimeout(() => {
      showTip.value = false
      tipTimer = null
    }, 1200)
  }
}

function ds(e: MouseEvent) {
  dg = true
  dx0 = e.clientX
  dy0 = e.clientY
  ox = px.value
  oy = py.value
  document.addEventListener('mousemove', dm)
  document.addEventListener('mouseup', du)
}

function dm(e: MouseEvent) {
  if (!dg) return
  px.value = ox + (e.clientX - dx0)
  py.value = oy + (e.clientY - dy0)
}

function du() {
  dg = false
  document.removeEventListener('mousemove', dm)
  document.removeEventListener('mouseup', du)
  localStorage.setItem('pixi_subs_px', String(px.value))
  localStorage.setItem('pixi_subs_py', String(py.value))
}

watch(
  () => props.currentTime,
  (t) => {
    worker?.postMessage({
      type: 'updateTime',
      currentTime: t,
      playing: props.playing
    })
  }
)

watch(
  () => props.playing,
  (playing) => {
    worker?.postMessage({
      type: 'updatePlaying',
      playing,
      currentTime: props.currentTime
    })
  }
)

watch(
  () => props.lyricLines,
  (lines) => {
    worker?.postMessage({
      type: 'updateLyricLines',
      lyricLines: JSON.parse(JSON.stringify(lines || [])),
      currentTime: props.currentTime
    })
  },
  { deep: true }
)

watch(
  () => props.effect,
  (effect) => {
    worker?.postMessage({ type: 'updateEffect', effect })
  }
)

watch(baseFontSize, (fontSize) => {
  worker?.postMessage({ type: 'updateFontSize', fontSize })
})

watch(
  () => [props.playedColor, props.defaultColor, props.transColor] as const,
  ([pc, dc, tc]) => {
    worker?.postMessage({
      type: 'updateColors',
      playedColor: pc,
      defaultColor: dc,
      transColor: tc
    })
  }
)

watch(
  () => [props.effect, props.effectLabel] as const,
  () => {
    if (!props.effectLabel) {
      showEffectBadge.value = false
      return
    }
    showEffectBadge.value = true
    if (badgeTimer) clearTimeout(badgeTimer)
    badgeTimer = setTimeout(() => {
      showEffectBadge.value = false
      badgeTimer = null
    }, 3000)
  },
  { immediate: true }
)

onMounted(initWorker)

onBeforeUnmount(() => {
  if (badgeTimer) clearTimeout(badgeTimer)
  if (tipTimer) {
    clearTimeout(tipTimer)
    tipTimer = null
  }
  document.removeEventListener('mousemove', dm)
  document.removeEventListener('mouseup', du)
  if (worker) {
    try {
      worker.postMessage({ type: 'destroy' })
      worker.terminate()
    } catch {}
    worker = null
  }
})
</script>

<style scoped>
.pixi-subs {
  position: absolute;
  cursor: grab;
  user-select: none;
  z-index: 5004;
  left: 50%;
  bottom: max(60px, 8%);
  width: min(1200px, calc(100vw - 24px));
  pointer-events: auto;
  overflow: visible;
}

.pixi-subs:active {
  cursor: grabbing;
}

.pixi-subs canvas {
  display: block;
  width: 100%;
  height: auto;
}

.effect-badge {
  position: absolute;
  top: -34px;
  right: 8px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  padding: 3px 12px;
  border-radius: 14px;
  font-size: 12px;
  letter-spacing: 1px;
  pointer-events: none;
  white-space: nowrap;
  z-index: 10;
}

.font-size-tip {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  pointer-events: none;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 10;
  white-space: nowrap;
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 5px);
}
</style>
