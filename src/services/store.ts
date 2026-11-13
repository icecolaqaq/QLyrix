import { reactive, ref, watch } from 'vue'
import type { LyricLine } from './qmusiclrcparser'
import { currentTrack, currentLyric } from './qmusicService'

export interface LyricSettings {
  blurEnabled: boolean
  customColor: string
  customTransColor?: string
  customRomaColor?: string
  disableSublineOpacity?: boolean
  useCustomColor: boolean
  showMainLyric?: boolean
  showLyric?: boolean
  mvModeEnabled?: boolean
  mvBlurEnabled?: boolean
  mvAutoHideEnabled?: boolean
  mvBlurValue?: number
  mvScaleValue?: number
  mvFitMode?: string
  mvMirrorH?: boolean
  mvMirrorV?: boolean
  mvOverlayColor?: string
  mvVideoBgEnabled?: boolean
  mvQuality?: number
  subtitleMode?: boolean
  subtitleEffect?: string
  subtitleFontSize?: number
}

export const state = reactive({
  mode: 'qq' as 'qq' | 'player',
  id: 0,
  mid: '',
  title: '未知歌曲',
  artist: '未知歌手',
  album: '未知专辑',
  albumUrl: '',
  playUrl: '',
  currentTime: 0,
  endTime: 0,
  lyricLines: [] as LyricLine[],
  quality: 0,
  qualityLabel: '',
  isPlay: false,
  state: '',
  server: '',
  isPureMusic: false,
  isFavorite: false
})

export const display = reactive({
  nowtime: '0:00',
  endTime: '-0:00',
  progress: 0,
  volume: 50,
  tagstr: '未知',
  scale: 'scale(1)',
  Lyricscale: 'scale(1)'
})

// Sync state with currentTrack
watch(currentTrack, (t) => {
  state.id = t.id
  state.title = t.title
  state.artist = t.artist
  state.album = t.album
  if (t.cover) {
    state.albumUrl = t.cover
  }
  state.currentTime = t.progress
  state.endTime = t.duration
  state.isPlay = t.isPlaying
  state.quality = t.quality || 0
  state.qualityLabel = t.qualityLabel
  state.server = String(t.server)
  state.isFavorite = t.favorite

  display.volume = t.volume
  display.tagstr = t.qualityLabel || '标准'
  display.scale = t.isPlaying ? 'scale(1)' : 'scale(0.8)'

  // Format times (t.progress and t.duration are in milliseconds)
  const curSec = Math.max(0, Math.floor(t.progress / 1000))
  const curM = Math.floor(curSec / 60)
  const curS = Math.floor(curSec % 60).toString().padStart(2, '0')
  display.nowtime = `${curM}:${curS}`

  const remSec = Math.max(0, Math.floor((t.duration - t.progress) / 1000))
  const remM = Math.floor(remSec / 60)
  const remS = Math.floor(remSec % 60).toString().padStart(2, '0')
  display.endTime = `-${remM}:${remS}`

  if (t.duration > 0 && !isProgressDragging.value) {
    display.progress = Math.min(100, Math.max(0, (t.progress / t.duration) * 100))
  }
})

export const translate = ref(true)
export const roma = ref(true)
export const showMainLyric = ref(true)
export const showLyric = ref(true)
export const isAlwaysOnTop = ref(false)
export const controlsVisible = ref(false)
export const showEscPrompt = ref(false)
export const normalmode = ref(true)
export const statusDialogVisible = ref(false)
export const subtitleMode = ref(false)

export type SubtitleEffect =
  | 'random'
  | 'wind'
  | 'fade'
  | 'pop'
  | 'slide'
  | 'glow'
  | 'sparkle'
  | 'cinema'
  | 'drop'
  | 'flip'
  | 'aurora'
  | 'bubble'

export const SUBTITLE_EFFECTS: { value: SubtitleEffect; label: string }[] = [
  { value: 'random', label: '随机模式' },
  { value: 'wind', label: '风吹消散' },
  { value: 'fade', label: '柔和淡入' },
  { value: 'pop', label: '弹性弹出' },
  { value: 'slide', label: '侧滑进入' },
  { value: 'glow', label: '霓虹光晕' },
  { value: 'sparkle', label: '星光闪烁' },
  { value: 'cinema', label: '电影聚焦' },
  { value: 'drop', label: '坠落弹跳' },
  { value: 'flip', label: '翻转登场' },
  { value: 'aurora', label: '极光流彩' },
  { value: 'bubble', label: '气泡上升' }
]

export const subtitleEffect = ref<SubtitleEffect>('wind')
export const subtitleFontSize = ref<number>(
  Math.min(999, Math.max(1, Math.round(Number(localStorage.getItem('pixi_subs_font_size') || 52) || 52)))
)

watch(subtitleFontSize, (v) => {
  localStorage.setItem('pixi_subs_font_size', String(v))
})

export const activeSubtitleEffect = ref<Exclude<SubtitleEffect, 'random'>>('wind')

export function getSubtitleEffectLabel(v: string) {
  return SUBTITLE_EFFECTS.find((e) => e.value === v)?.label || ''
}

function pickRandomEffect() {
  const pool = SUBTITLE_EFFECTS.filter(
    (e) => e.value !== 'random' && e.value !== activeSubtitleEffect.value
  )
  const next = pool[Math.floor(Math.random() * pool.length)]
  activeSubtitleEffect.value = next.value as Exclude<SubtitleEffect, 'random'>
}

export const isProgressDragging = ref(false)

watch(
  subtitleEffect,
  (v) => {
    if (v === 'random') pickRandomEffect()
    else activeSubtitleEffect.value = v as Exclude<SubtitleEffect, 'random'>
  },
  { immediate: true }
)

watch(
  () => `${state.id}|${state.title}|${state.artist}`,
  (key, old) => {
    if (subtitleEffect.value === 'random' && key !== old && state.title) pickRandomEffect()
  }
)
