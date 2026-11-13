<template>
  <div class="music-player-container">
    <div
      class="dynamic-island"
      :class="{ expanded: isExpanded, mini: !isExpanded, 'collapse-bounce': isCollapseBouncing }"
      @mousedown="handleMouseDown"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
      @transitionend="onIslandTransitionEnd"
      @animationend="onIslandAnimationEnd"
      @contextmenu.prevent="handleContextMenu"
    >
      <!-- 动态流光背景 -->
      <canvas v-if="bgMode === 'flowing'" ref="flowingLightCanvas" class="flowing-light"></canvas>
      <BackgroundRender
        v-else
        ref="bgRef"
        :album="state.albumUrl"
        :album-is-video="false"
        :playing="state.isPlay"
        :has-lyric="state.lyricLines.length > 0"
        :fps="60"
        :flow-speed="3"
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: block"
      />

      <!-- 双击复位热区 -->
      <button
        class="position-reset-hotspot"
        title="双击切换主歌词窗口"
        tabindex="-1"
        aria-hidden="true"
        @dblclick.stop="toggleMainWindow"
      ></button>

      <!-- 迷你状态 (胶囊形态) -->
      <transition name="mini-fade">
        <div v-if="!isExpanded && isMiniComponentsVisible" class="mini-state">
          <div class="album-cover-mini" title="点击切换背景样式" @click.stop="toggleBgMode">
            <CoverTransition :src="state.albumUrl" :alt="'专辑封面'" :duration="500" />
          </div>
          <div class="song-title-artist-mini" :title="state.title">{{ state.title }}</div>
          <div class="sound-wave">
            <div
              v-for="i in 4"
              :key="i"
              class="wave-bar"
              :class="{ 'wave-paused': !state.isPlay }"
              :style="{ animationDelay: `${i * 0.1}s` }"
            ></div>
          </div>
        </div>
      </transition>

      <!-- 展开状态 (卡片形态) -->
      <div v-show="isExpanded" class="full-state">
        <div class="player-content">
          <!-- 歌曲信息与歌词 -->
          <div class="song-info">
            <div class="song-info-container">
              <div class="song-cover" title="点击切换背景样式" @click.stop="toggleBgMode">
                <CoverTransition :src="state.albumUrl" :alt="'专辑封面'" :duration="500" />
              </div>
              <div class="song-details">
                <div class="song-title-artist" :title="`${state.title} - ${state.artist}`">
                  {{ state.title }} - {{ state.artist }}
                </div>

                <!-- 当前双行歌词显示区域 -->
                <div
                  v-if="currentLyricIndex >= 0 && state.lyricLines[currentLyricIndex]"
                  class="current-lyrics"
                >
                  <div class="current-lyric-text">
                    {{ currentLyricLineText }}
                  </div>
                  <div class="current-lyric-translation">
                    {{ currentLyricSubText }}
                  </div>
                </div>
                <div v-else class="current-lyrics">
                  <div class="current-lyric-text">{{ currentLyricFallbackText }}</div>
                  <div class="current-lyric-translation"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 播放控制按钮 -->
          <div class="controls">
            <!-- 收藏 -->
            <button
              class="control-btn favorite"
              :class="{ active: state.isFavorite }"
              title="收藏"
              @click.stop="toggleFavorite"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                />
              </svg>
            </button>

            <!-- 上一首 -->
            <button class="control-btn" title="上一首" @click.stop="previousSong">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            <!-- 播放/暂停 -->
            <button class="control-btn play-pause" title="播放/暂停" @click.stop="togglePlay">
              <svg v-if="!state.isPlay" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            </button>

            <!-- 下一首 -->
            <button class="control-btn" title="下一首" @click.stop="nextSong">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>

            <!-- 打开/关闭主歌词窗口 -->
            <button class="control-btn lyrics" title="切换主歌词窗口" @click.stop="toggleMainWindow">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
                />
              </svg>
            </button>
          </div>

          <!-- 进度条 -->
          <div class="progress-section">
            <span class="time current-time">{{ formatTime(displayCurrentTime) }}</span>
            <div
              ref="progressContainerRef"
              class="progress-bar"
              @mousedown.stop="startProgressDrag"
            >
              <div class="progress-track"></div>
              <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
              <div class="progress-thumb" :style="{ left: progressPercentage + '%' }"></div>
            </div>
            <span class="time total-time">{{ formatTime(state.endTime) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { extractMainColors } from '@/services/octree'
import { BackgroundRender } from '@/components/BackgroundRender'
import CoverTransition from '@/components/CoverTransition.vue'
import { state } from '@/services/store'
import { qmusicService } from '@/services/qmusicService'
import {
  toggleWindow,
  hideWindow,
  setIslandExpanded,
  getIslandPosition,
  setIslandPosition
} from '@/services/tauriBridge'

const fallbackCover = new URL('../assets/icon.png', import.meta.url).href

// 状态
const isExpanded = ref(false)
const isMiniComponentsVisible = ref(true)
const isCollapseBouncing = ref(false)
const bgMode = ref<'flowing' | 'blur'>('blur')
const isProgressDragging = ref(false)
const dragPercentage = ref(0)
const progressContainerRef = ref<HTMLElement | null>(null)
const isDraggingWindow = ref(false)

let expandTimeout: ReturnType<typeof setTimeout> | null = null
let collapseTimeout: ReturnType<typeof setTimeout> | null = null
let miniVisibleTimeout: ReturnType<typeof setTimeout> | null = null
let collapseBounceTimeout: ReturnType<typeof setTimeout> | null = null

// Canvas 动态流光背景
const flowingLightCanvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let animationFrameId: number | null = null
let gradientColors: { color: string; position: number }[] = []
let time = 0
let flowLayers: Array<{
  offset: number
  speed: number
  opacity: number
  angle: number
  scale: number
}> = []

// 格式化时间 (传入毫秒)
function formatTime(ms: number): string {
  if (!ms || isNaN(ms) || ms < 0) return '0:00'
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = Math.floor(totalSec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

const displayCurrentTime = computed(() => {
  if (isProgressDragging.value) {
    return (dragPercentage.value / 100) * (state.endTime || 0)
  }
  return state.currentTime
})

const progressPercentage = computed(() => {
  if (isProgressDragging.value) {
    return Math.min(100, Math.max(0, dragPercentage.value))
  }
  if (!state.endTime || state.endTime <= 0) return 0
  return Math.min(100, Math.max(0, (state.currentTime / state.endTime) * 100))
})

// 歌词解析与双行实时显示
const currentLyricIndex = computed(() => {
  if (!state.lyricLines || state.lyricLines.length === 0) return -1
  const curTimeMs = state.currentTime
  for (let i = state.lyricLines.length - 1; i >= 0; i--) {
    const line = state.lyricLines[i]
    if (line.startTime <= curTimeMs) {
      return i
    }
  }
  return -1
})

const currentLyricLineText = computed(() => {
  const idx = currentLyricIndex.value
  if (idx >= 0 && state.lyricLines[idx]) {
    const line = state.lyricLines[idx]
    if (line.words && line.words.length > 0) {
      return line.words.map((w) => w.word).join('')
    }
    return line.lyric || ''
  }
  return ''
})

const currentLyricSubText = computed(() => {
  const idx = currentLyricIndex.value
  if (idx >= 0 && state.lyricLines[idx]) {
    const line = state.lyricLines[idx]
    return line.translatedLyric || line.romanLyric || ''
  }
  return ''
})

const currentLyricFallbackText = computed(() => {
  if (state.isPureMusic) {
    return '纯音乐，请欣赏'
  }
  if (state.lyricLines.length === 0) {
    return state.title && state.title !== '未知歌曲' ? `${state.title} - ${state.artist}` : 'QLyrix 灵动岛'
  }
  return '♪ 准备播放 ♪'
})

// 控制操作
function togglePlay() {
  qmusicService.togglePlay()
}

function previousSong() {
  qmusicService.prev()
}

function nextSong() {
  qmusicService.next()
}

function toggleFavorite() {
  qmusicService.favorite()
}

function toggleMainWindow() {
  toggleWindow('main')
}

function toggleBgMode() {
  bgMode.value = bgMode.value === 'flowing' ? 'blur' : 'flowing'
  if (bgMode.value === 'flowing') {
    nextTick(() => {
      initCanvas()
    })
  }
}

async function handleMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  const target = e.target as HTMLElement | null
  if (
    target?.closest(
      '.control-btn, .progress-bar, .progress-section, .position-reset-hotspot, button'
    )
  ) {
    return
  }

  const startScreenX = e.screenX
  const startScreenY = e.screenY
  const dpr = window.devicePixelRatio || 1
  isDraggingWindow.value = true

  const [initX, initY] = await getIslandPosition()
  let rafPending = false
  let latestX = initX
  let latestY = initY

  const onMouseMove = (moveEvent: MouseEvent) => {
    const dx = Math.round((moveEvent.screenX - startScreenX) * dpr)
    const dy = Math.round((moveEvent.screenY - startScreenY) * dpr)
    latestX = initX + dx
    latestY = initY + dy
    if (!rafPending) {
      rafPending = true
      requestAnimationFrame(() => {
        rafPending = false
        void setIslandPosition(latestX, latestY)
      })
    }
  }

  const stopDrag = () => {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', stopDrag)
    window.removeEventListener('blur', stopDrag)
    setTimeout(() => {
      isDraggingWindow.value = false
    }, 80)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', stopDrag)
  window.addEventListener('blur', stopDrag)
}

function handleContextMenu() {
  hideWindow('island')
}

function clearAllIslandTimers() {
  if (expandTimeout) {
    clearTimeout(expandTimeout)
    expandTimeout = null
  }
  if (collapseTimeout) {
    clearTimeout(collapseTimeout)
    collapseTimeout = null
  }
  if (miniVisibleTimeout) {
    clearTimeout(miniVisibleTimeout)
    miniVisibleTimeout = null
  }
  if (collapseBounceTimeout) {
    clearTimeout(collapseBounceTimeout)
    collapseBounceTimeout = null
  }
}

// 展开 / 收起交互
function onMouseEnter() {
  clearAllIslandTimers()
  isCollapseBouncing.value = false
  expandTimeout = setTimeout(() => {
    void setIslandExpanded(true)
    isExpanded.value = true
    isMiniComponentsVisible.value = false
  }, 80)
}

function onMouseLeave() {
  if (isDraggingWindow.value || isProgressDragging.value) return
  if (expandTimeout) {
    clearTimeout(expandTimeout)
    expandTimeout = null
  }
  collapseTimeout = setTimeout(() => {
    if (isDraggingWindow.value || isProgressDragging.value) return
    isCollapseBouncing.value = false
    isExpanded.value = false
    void setIslandExpanded(false)
    miniVisibleTimeout = setTimeout(() => {
      if (!isExpanded.value) {
        isMiniComponentsVisible.value = true
      }
    }, 220)
  }, 260)
}

function onIslandTransitionEnd(e: TransitionEvent) {
  if (e.target !== e.currentTarget || e.propertyName !== 'width') return
  if (!isExpanded.value) {
    isCollapseBouncing.value = true
    if (collapseBounceTimeout) clearTimeout(collapseBounceTimeout)
    collapseBounceTimeout = setTimeout(() => {
      isCollapseBouncing.value = false
      collapseBounceTimeout = null
    }, 420)
  }
}

function onIslandAnimationEnd(e: AnimationEvent) {
  if (e.target !== e.currentTarget) return
  if (e.animationName.includes('collapseBounce')) {
    isCollapseBouncing.value = false
    if (collapseBounceTimeout) {
      clearTimeout(collapseBounceTimeout)
      collapseBounceTimeout = null
    }
  }
}

// 进度条拖拽与跳转
function startProgressDrag(e: MouseEvent) {
  if (e.button !== 0 || !progressContainerRef.value || !state.endTime) return
  isProgressDragging.value = true
  updateDragProgress(e)

  const onMouseMove = (moveEvent: MouseEvent) => {
    updateDragProgress(moveEvent)
  }

  const onMouseUp = () => {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    if (isProgressDragging.value) {
      const targetTime = (dragPercentage.value / 100) * state.endTime
      qmusicService.seek(targetTime)
      setTimeout(() => {
        isProgressDragging.value = false
      }, 50)
    }
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function updateDragProgress(e: MouseEvent) {
  if (!progressContainerRef.value) return
  const rect = progressContainerRef.value.getBoundingClientRect()
  const offset = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
  dragPercentage.value = (offset / rect.width) * 100
}

// 动态流光背景 Canvas 渲染
async function loadCoverImage(url: string): Promise<HTMLImageElement> {
  const img = new Image()
  if (/^https?:\/\//i.test(url)) {
    img.crossOrigin = 'anonymous'
  }
  img.decoding = 'async'
  img.src = url || fallbackCover
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
  })
  return img
}

async function extractColorsFromCover(coverUrl: string) {
  const defaultGradient = [
    { color: 'rgba(99, 102, 241, 0.9)', position: 0 },
    { color: 'rgba(168, 85, 247, 0.9)', position: 50 },
    { color: 'rgba(236, 72, 153, 0.9)', position: 100 }
  ]

  try {
    const img = await loadCoverImage(coverUrl)
    const offCanvas = document.createElement('canvas')
    const offCtx = offCanvas.getContext('2d')
    if (!offCtx) return defaultGradient

    offCanvas.width = 64
    offCanvas.height = 64
    offCtx.drawImage(img, 0, 0, 64, 64)
    const imgData = offCtx.getImageData(0, 0, 64, 64)
    const pixels: [number, number, number][] = []
    for (let i = 0; i < imgData.data.length; i += 16) {
      pixels.push([imgData.data[i], imgData.data[i + 1], imgData.data[i + 2]])
    }

    const hexColors = extractMainColors(pixels, 5)
    if (hexColors.length < 2) return defaultGradient

    const sorted = hexColors
      .map((hex) => {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        return { r, g, b, brightness: (r * 299 + g * 587 + b * 114) / 1000 }
      })
      .sort((a, b) => b.brightness - a.brightness)

    return sorted.map((c, idx) => ({
      color: `rgba(${c.r}, ${c.g}, ${c.b}, 0.85)`,
      position: (idx / (sorted.length - 1)) * 100
    }))
  } catch {
    return defaultGradient
  }
}

function initFlowLayers() {
  flowLayers = [
    { offset: 0, speed: 0.05, opacity: 0.9, angle: 45, scale: 2.0 },
    { offset: 100, speed: 0.08, opacity: 0.9, angle: 135, scale: 1.8 },
    { offset: 300, speed: 0.05, opacity: 0.9, angle: 225, scale: 2.2 }
  ]
}

function resizeCanvas() {
  if (!flowingLightCanvas.value) return
  if (flowingLightCanvas.value.width !== 420 || flowingLightCanvas.value.height !== 220) {
    flowingLightCanvas.value.width = 420
    flowingLightCanvas.value.height = 220
  }
}

function drawFlowingLight() {
  if (!ctx || !flowingLightCanvas.value) return
  const width = flowingLightCanvas.value.width
  const height = flowingLightCanvas.value.height
  ctx.clearRect(0, 0, width, height)

  const colors = gradientColors.length > 0 ? gradientColors : [
    { color: 'rgba(99, 102, 241, 0.9)', position: 0 },
    { color: 'rgba(168, 85, 247, 0.9)', position: 100 }
  ]

  flowLayers.forEach((layer, idx) => {
    if (!ctx) return
    ctx.save()
    ctx.filter = `blur(${10 - idx * 2}px)`
    ctx.globalCompositeOperation = idx === 0 ? 'source-over' : 'screen'
    ctx.globalAlpha = layer.opacity

    ctx.translate(width / 2, height / 2)
    ctx.rotate((layer.angle * Math.PI) / 180)
    ctx.scale(layer.scale, layer.scale)
    ctx.translate(-width / 2, -height / 2)

    const gradWidth = width * 4
    const curOffset = (layer.offset + time * layer.speed) % gradWidth
    const grad = ctx.createLinearGradient(
      -curOffset,
      -height * 0.5,
      gradWidth - curOffset,
      height * 1.5
    )

    colors.forEach((c) => {
      const pos = Math.min(1, Math.max(0, c.position / 100))
      grad.addColorStop(pos, c.color)
    })

    ctx.fillStyle = grad
    ctx.fillRect(-width * 1.5, -height * 1.5, width * 6, height * 6)
    ctx.restore()
  })
}

function animateFlowingLight() {
  if (!ctx || !flowingLightCanvas.value) return
  time += 1
  drawFlowingLight()
  animationFrameId = requestAnimationFrame(animateFlowingLight)
}

async function initCanvas() {
  if (!flowingLightCanvas.value) return
  ctx = flowingLightCanvas.value.getContext('2d')
  if (!ctx) return

  resizeCanvas()
  gradientColors = await extractColorsFromCover(state.albumUrl)
  initFlowLayers()

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  animateFlowingLight()
}

// 监听封面变化更新流光颜色
watch(
  () => state.albumUrl,
  async (newUrl) => {
    if (bgMode.value === 'flowing' && newUrl) {
      gradientColors = await extractColorsFromCover(newUrl)
    }
  }
)

onMounted(() => {
  nextTick(() => {
    const island = document.querySelector('.dynamic-island')
    if (island) {
      island.classList.add('initial-load')
      setTimeout(() => {
        island.classList.remove('initial-load')
      }, 600)
    }
    initCanvas()
  })
})

onUnmounted(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  clearAllIslandTimers()
})
</script>

<style scoped>
.music-player-container {
  position: fixed;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-user-select: none;
  user-select: none;
}

.dynamic-island {
  position: relative;
  background: rgba(18, 18, 24, 0.92);
  border-radius: 25px;
  overflow: hidden;
  transition:
    width 0.48s cubic-bezier(0.34, 1.35, 0.64, 1),
    height 0.48s cubic-bezier(0.34, 1.35, 0.64, 1),
    border-radius 0.48s cubic-bezier(0.34, 1.35, 0.64, 1),
    box-shadow 0.4s ease;
  cursor: grab;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.dynamic-island:active {
  cursor: grabbing;
}

.dynamic-island.mini {
  width: 180px;
  height: 45px;
  border-radius: 22.5px;
  transition:
    width 0.44s cubic-bezier(0.34, 1.28, 0.64, 1),
    height 0.44s cubic-bezier(0.34, 1.28, 0.64, 1),
    border-radius 0.44s cubic-bezier(0.34, 1.28, 0.64, 1),
    box-shadow 0.35s ease;
}

.dynamic-island.expanded {
  width: 400px;
  height: 200px;
  border-radius: 25px;
  transition:
    width 0.52s cubic-bezier(0.34, 1.42, 0.64, 1),
    height 0.52s cubic-bezier(0.34, 1.42, 0.64, 1),
    border-radius 0.52s cubic-bezier(0.34, 1.42, 0.64, 1),
    box-shadow 0.4s ease;
}

.dynamic-island.collapse-bounce {
  animation: collapseBounce 0.38s forwards;
}

@keyframes collapseBounce {
  0% {
    width: 180px;
    animation-timing-function: ease-in;
  }
  40% {
    width: 146px;
    animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  100% {
    width: 180px;
  }
}

.dynamic-island.initial-load {
  animation: bounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes bounceIn {
  0% {
    opacity: 0;
    transform: scale(0.85);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.flowing-light {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 420px;
  height: 220px;
  transform: translate(-50%, -50%);
  opacity: 0.82;
  pointer-events: none;
  z-index: 1;
}

.position-reset-hotspot {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  opacity: 0;
  background: transparent;
  pointer-events: auto;
  z-index: 3000;
  cursor: pointer;
}

/* 迷你胶囊状态 */
.mini-state {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 12px;
  z-index: 2000;
  box-sizing: border-box;
}

.mini-fade-enter-active,
.mini-fade-leave-active {
  transition: opacity 0.2s ease;
}

.mini-fade-enter-from,
.mini-fade-leave-to {
  opacity: 0;
}

.album-cover-mini {
  position: relative;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}

.album-cover-mini :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.song-title-artist-mini {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.92);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  text-align: center;
  letter-spacing: 0.2px;
}

/* 声波跳动条 */
.sound-wave {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.wave-bar {
  width: 2.5px;
  height: 10px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 1px;
  animation: waveAnimation 0.9s ease-in-out infinite;
}

.wave-bar.wave-paused {
  animation: none;
  height: 4px;
  opacity: 0.5;
}

@keyframes waveAnimation {
  0%, 100% {
    height: 4px;
  }
  50% {
    height: 14px;
  }
}

/* 展开状态卡片 */
.full-state {
  position: relative;
  width: 100%;
  height: 100%;
  z-index: 2000;
  padding: 20px 24px;
  box-sizing: border-box;
  animation: cardExpand 0.36s cubic-bezier(0.34, 1.45, 0.64, 1) forwards;
}

@keyframes cardExpand {
  0% {
    opacity: 0;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.player-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: space-between;
}

.song-info-container {
  display: flex;
  align-items: center;
  gap: 14px;
}

.song-cover {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  cursor: pointer;
}

.song-cover :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.song-details {
  flex: 1;
  overflow: hidden;
  text-align: center;
}

.song-title-artist {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.3px;
}

.current-lyrics {
  margin-top: 4px;
  text-align: left;
}

.current-lyric-text {
  height: 20px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.current-lyric-translation {
  height: 18px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.65);
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 按钮组 */
.controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 30px;
}

.control-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  transform: scale(1.1);
}

.control-btn svg {
  width: 21px;
  height: 21px;
}

.play-pause {
  width: 42px;
  height: 42px;
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
}

.play-pause:hover {
  background: rgba(255, 255, 255, 0.35);
}

.play-pause svg {
  width: 24px;
  height: 24px;
}

.favorite.active {
  color: #ff5277;
}

/* 底部进度条 */
.progress-section {
  display: flex;
  align-items: center;
  gap: 10px;
}

.time {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.65);
  min-width: 28px;
  font-variant-numeric: tabular-nums;
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  position: relative;
  cursor: pointer;
}

.progress-track {
  position: absolute;
  inset: 0;
  border-radius: 2px;
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  background: linear-gradient(90deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
  border-radius: 2px;
  transition: width 0.08s linear;
}

.progress-thumb {
  position: absolute;
  top: 50%;
  width: 8px;
  height: 8px;
  background: #ffffff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  transition: left 0.08s linear;
}
</style>
