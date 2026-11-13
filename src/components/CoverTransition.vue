<template>
  <div class="cover-transition-wrapper">
    <img v-show="!imgError" class="cover-image" :src="displaySrc" :alt="alt" @error="onImgError" />
    <div v-show="imgError" class="cover-fallback">
      <svg viewBox="0 0 24 24" fill="currentColor" class="fallback-icon">
        <path
          d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
        />
      </svg>
    </div>
    <canvas ref="canvasRef" class="cover-canvas" :class="{ active: canvasActive }"></canvas>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  src: string
  alt?: string
  duration?: number
  animationType?: string
}>()

const displaySrc = ref(props.src)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const imgError = ref(false)
const canvasActive = ref(false)

let animId: number | null = null
let transitionId = 0

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (/^https?:\/\//i.test(url)) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

function onImgError() {
  imgError.value = true
}

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2
}

function cancelAnimation() {
  if (animId) {
    cancelAnimationFrame(animId)
    animId = null
  }
}

function syncDisplay(src: string, hasError = false) {
  cancelAnimation()
  displaySrc.value = src
  imgError.value = hasError
  canvasActive.value = false

  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (canvas && ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
}

function canAnimate(canvas: HTMLCanvasElement | null) {
  const rect = canvas?.parentElement?.getBoundingClientRect()
  return !!rect && rect.width >= 1 && rect.height >= 1
}

function prepareCanvas(canvas: HTMLCanvasElement) {
  const parent = canvas.parentElement
  if (!parent) return null

  const rect = parent.getBoundingClientRect()
  const width = rect.width
  const height = rect.height
  const dpr = window.devicePixelRatio || 1
  const ctx = canvas.getContext('2d')

  if (!ctx || width < 1 || height < 1) return null

  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  return { ctx, width, height }
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number
) {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  const sourceRatio = sourceWidth / sourceHeight
  const targetRatio = width / height
  let sx = 0
  let sy = 0
  let sw = sourceWidth
  let sh = sourceHeight

  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio
    sx = (sourceWidth - sw) / 2
  } else {
    sh = sourceWidth / targetRatio
    sy = (sourceHeight - sh) / 2
  }

  ctx.save()
  ctx.translate(width / 2, height / 2)
  ctx.drawImage(image, sx, sy, sw, sh, -width / 2, -height / 2, width, height)
  ctx.restore()
}

function getCoverSourceRect(image: HTMLImageElement, width: number, height: number) {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  const sourceRatio = sourceWidth / sourceHeight
  const targetRatio = width / height
  let sx = 0
  let sy = 0
  let sw = sourceWidth
  let sh = sourceHeight

  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio
    sx = (sourceWidth - sw) / 2
  } else {
    sh = sourceWidth / targetRatio
    sy = (sourceHeight - sh) / 2
  }

  return { sx, sy, sw, sh }
}

function drawCoverImageSection(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  alpha = 1
) {
  const source = getCoverSourceRect(image, width, height)
  const sourceX = source.sx + (dx / width) * source.sw
  const sourceY = source.sy + (dy / height) * source.sh
  const sourceW = (dw / width) * source.sw
  const sourceH = (dh / height) * source.sh

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, dx, dy, dw, dh)
  ctx.restore()
}

function drawBlockBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const inset = 0.5
  const borderWidth = Math.max(0, width - 1)
  const borderHeight = Math.max(0, height - 1)

  if (borderWidth <= 0 || borderHeight <= 0) return

  ctx.save()
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.24)'
  ctx.strokeRect(x + inset, y + inset, borderWidth, borderHeight)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.strokeRect(x + inset, y + inset, borderWidth, borderHeight)
  ctx.restore()
}

function createBlockDistances(width: number, height: number) {
  const blockSize = Math.max(7, Math.floor(Math.min(width, height) / 18))
  const cols = Math.ceil(width / blockSize)
  const rows = Math.ceil(height / blockSize)
  const centerX = cols / 2
  const centerY = rows / 2
  const blocks: number[] = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dx = (c - centerX) / centerX
      const dy = (r - centerY) / centerY
      blocks.push(Math.sqrt(dx * dx + dy * dy))
    }
  }

  return {
    blocks,
    blockSize,
    cols,
    maxDist: Math.max(...blocks)
  }
}

function drawDissolveFrame(
  ctx: CanvasRenderingContext2D,
  oldImage: HTMLImageElement,
  newImage: HTMLImageElement,
  width: number,
  height: number,
  progress: number,
  grid: ReturnType<typeof createBlockDistances>
) {
  const eased = easeInOutCubic(progress)
  const waveFront = eased * 1.45

  ctx.clearRect(0, 0, width, height)
  drawCoverImage(ctx, newImage, width, height)

  for (let i = 0; i < grid.blocks.length; i++) {
    const dist = grid.blocks[i] / grid.maxDist
    if (dist <= waveFront) continue

    const r = Math.floor(i / grid.cols)
    const c = i % grid.cols
    const sx = c * grid.blockSize
    const sy = r * grid.blockSize
    const sw = Math.min(grid.blockSize, width - sx)
    const sh = Math.min(grid.blockSize, height - sy)

    drawCoverImageSection(ctx, oldImage, width, height, sx, sy, sw, sh, 1)
    drawBlockBorder(ctx, sx, sy, sw, sh)
  }
}

function waitForDisplayedImage(src: string): Promise<void> {
  return nextTick().then(() => {
    const imgEl = canvasRef.value?.parentElement?.querySelector('.cover-image') as
      | HTMLImageElement
      | undefined

    if (!imgEl || ((imgEl.currentSrc === src || imgEl.src === src) && imgEl.complete)) {
      return
    }

    return new Promise<void>((resolve) => {
      const done = () => resolve()

      imgEl.addEventListener('load', done, { once: true })
      imgEl.addEventListener('error', done, { once: true })
    })
  })
}

async function finishTransition(canvas: HTMLCanvasElement, id: number, nextSrc: string) {
  await waitForDisplayedImage(nextSrc)
  if (id !== transitionId) return

  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  )
  if (id !== transitionId) return

  canvasActive.value = false
  const ctx = canvas.getContext('2d')
  ctx?.clearRect(0, 0, canvas.width, canvas.height)
  animId = null
}

function runTransition(
  canvas: HTMLCanvasElement,
  oldImage: HTMLImageElement,
  newImage: HTMLImageElement,
  nextSrc: string,
  id: number
) {
  const prepared = prepareCanvas(canvas)
  if (!prepared) {
    syncDisplay(nextSrc)
    return
  }

  const { ctx, width, height } = prepared
  const duration = props.duration || 500
  const dissolveGrid = createBlockDistances(width, height)
  const startTime = performance.now()

  canvasActive.value = true
  drawCoverImage(ctx, oldImage, width, height)
  displaySrc.value = nextSrc
  imgError.value = false

  function animate(now: number) {
    if (id !== transitionId) return

    const progress = Math.min((now - startTime) / duration, 1)
    drawDissolveFrame(ctx, oldImage, newImage, width, height, progress, dissolveGrid)

    if (progress < 1) {
      animId = requestAnimationFrame(animate)
    } else {
      void finishTransition(canvas, id, nextSrc)
    }
  }

  animId = requestAnimationFrame(animate)
}

function startTransition(prevSrc: string, nextSrc: string) {
  const id = ++transitionId
  cancelAnimation()

  const canvas = canvasRef.value
  if (!canAnimate(canvas)) {
    syncDisplay(nextSrc)
    return
  }

  const oldImagePromise = loadImage(prevSrc).catch(() => null)

  loadImage(nextSrc)
    .then(async (newImg) => {
      if (id !== transitionId) return

      const oldImg = await oldImagePromise
      if (id !== transitionId) return

      if (!canvas || !oldImg) {
        syncDisplay(nextSrc)
        return
      }

      runTransition(canvas, oldImg, newImg, nextSrc, id)
    })
    .catch(() => {
      if (id !== transitionId) return

      syncDisplay(nextSrc, true)
    })
}

watch(
  () => props.src,
  (newSrc) => {
    if (newSrc === displaySrc.value) return

    const prevSrc = displaySrc.value

    if (prevSrc && canvasRef.value) {
      nextTick(() => {
        startTransition(prevSrc, newSrc)
      })
    } else {
      syncDisplay(newSrc)
    }
  }
)

onUnmounted(() => {
  transitionId++
  cancelAnimation()
})
</script>

<style scoped>
.cover-transition-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transform: translateZ(0);
}

.cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
}

.fallback-icon {
  width: 40%;
  height: 40%;
  color: rgba(255, 255, 255, 0.35);
}

.cover-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  opacity: 0;
  pointer-events: none;
  transform: translateZ(0);
}

.cover-canvas.active {
  opacity: 1;
}
</style>
