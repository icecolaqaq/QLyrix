import { ref } from 'vue'
import { state, display, isAlwaysOnTop, isProgressDragging } from '@/services/store'
import { qmusicService } from '@/services/qmusicService'
import { syncMvVideoProgress, syncMvPlayState } from './useMvMode'
import {
  minimizeCurrentWindow,
  toggleMaximizeCurrentWindow,
  closeCurrentWindow,
  toggleFullscreenCurrentWindow,
  setAlwaysOnTop
} from '@/services/tauriBridge'

export const volumeContainer = ref<HTMLElement>()
export const progressContainer = ref<HTMLElement>()
let isVolumeDragging = false
let isActiveProgressDrag = false
let progressDragResetTimer: any = null

export function playerplay() {
  qmusicService.togglePlay()
}

export function playernext() {
  qmusicService.next()
}

export function playerprev() {
  qmusicService.prev()
}

export function playerfavorite() {
  qmusicService.favorite()
}

export function lineclink(timestampMs: number) {
  qmusicService.seek(Math.max(0, timestampMs))
}

export function minimizeWindow() {
  void minimizeCurrentWindow()
}

export function maximizeWindow() {
  void toggleMaximizeCurrentWindow()
}

export function closeWindow() {
  void closeCurrentWindow()
}

export function fullscreenWindow() {
  void toggleFullscreenCurrentWindow()
}

export function toggleAlwaysOnTop() {
  isAlwaysOnTop.value = !isAlwaysOnTop.value
  void setAlwaysOnTop('main', isAlwaysOnTop.value)
}

export function updateTimeDisplay(ms: number) {
  const m = Math.floor(ms / 1000 / 60)
  const s = Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, '0')
  display.nowtime = `${m}:${s}`
  if (!isProgressDragging.value) {
    display.progress = state.endTime > 0 ? (ms / state.endTime) * 100 : 0
  }
  syncMvVideoProgress(ms)
}

export function updatePlayState(isPlay: boolean) {
  if (!isProgressDragging.value) {
    state.isPlay = isPlay
    display.scale = isPlay ? 'scale(1)' : 'scale(0.8)'
  }
  syncMvPlayState(isPlay)
}

export function startProgressDrag(e: MouseEvent) {
  if (progressDragResetTimer) {
    clearTimeout(progressDragResetTimer)
    progressDragResetTimer = null
  }
  progressContainer.value = e.currentTarget as HTMLElement
  isActiveProgressDrag = true
  isProgressDragging.value = true
  document.addEventListener('mousemove', handleProgressDrag)
  document.addEventListener('mouseup', stopProgressDrag)
  updateProgress(e)
}

function stopProgressDrag() {
  if (isActiveProgressDrag) {
    isActiveProgressDrag = false
    const tsMs = (display.progress / 100) * state.endTime
    qmusicService.seek(tsMs)
  }
  if (progressDragResetTimer) clearTimeout(progressDragResetTimer)
  progressDragResetTimer = setTimeout(() => {
    isProgressDragging.value = false
  }, 1000)
  document.removeEventListener('mousemove', handleProgressDrag)
  document.removeEventListener('mouseup', stopProgressDrag)
}

function handleProgressDrag(e: MouseEvent) {
  if (isActiveProgressDrag) {
    updateProgress(e)
  }
}

function updateProgress(e: MouseEvent) {
  if (!progressContainer.value) return
  const rect = progressContainer.value.getBoundingClientRect()
  const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  display.progress = p * 100

  const currentMs = p * state.endTime
  const m = Math.floor(currentMs / 1000 / 60)
  const s = Math.floor((currentMs / 1000) % 60)
    .toString()
    .padStart(2, '0')
  display.nowtime = `${m}:${s}`
}

export function startVolumeDrag(e: MouseEvent) {
  volumeContainer.value = e.currentTarget as HTMLElement
  isVolumeDragging = true
  document.addEventListener('mousemove', handleVolumeDrag)
  document.addEventListener('mouseup', stopVolumeDrag)
  updateVolume(e)
}

function stopVolumeDrag() {
  isVolumeDragging = false
  document.removeEventListener('mousemove', handleVolumeDrag)
  document.removeEventListener('mouseup', stopVolumeDrag)
}

function handleVolumeDrag(e: MouseEvent) {
  if (isVolumeDragging) {
    updateVolume(e)
  }
}

function updateVolume(e: MouseEvent) {
  if (!volumeContainer.value) return
  const rect = volumeContainer.value.getBoundingClientRect()
  const v = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  qmusicService.setVolume(Math.round(v * 100))
}
