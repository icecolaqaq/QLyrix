import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  state,
  display,
  showMainLyric,
  showLyric,
  subtitleMode,
  subtitleEffect,
  subtitleFontSize,
  SUBTITLE_EFFECTS,
  type SubtitleEffect,
  isProgressDragging,
  statusDialogVisible
} from '@/services/store'
import { normalizeSongId, normalizeQualityLabel, handleLyricDisplayChange } from './useLyric'
import { bilibiliService, type BilibiliVideoItem } from '@/services/bilibiliService'
import { getMvMappings, saveMvMappings, openExternalLink, getAppConfig, saveAppConfig } from '@/services/tauriBridge'

export interface MvMappingItem {
  bvid: string
  title?: string
  author?: string
  pic?: string
  delay?: number
  songTitle?: string
  songArtist?: string
}

export const mvModeEnabled = ref(false)
export const mvBlurEnabled = ref(true)
export const mvVideoUrl = ref('')
export const currentMvBvid = ref('')
export const mvVideoRef = ref<HTMLVideoElement | null>(null)
export const mvQuality = ref(32)
export const currentMvQualityLabel = ref('')
export const mvBlurValue = ref(20)
export const mvScaleValue = ref(1.1)
export const mvMirrorH = ref(false)
export const mvMirrorV = ref(false)

export const realMvScale = computed(() => {
  const v = mvScaleValue.value
  if (v >= 1) return Math.min(5, v)
  const clamped = Math.max(-5, v)
  return Number((0.01 + ((clamped + 5) / 6) * 0.99).toFixed(4))
})

export const mvVideoTransform = computed(() => {
  const s = realMvScale.value
  const sx = mvMirrorH.value ? -s : s
  const sy = mvMirrorV.value ? -s : s
  return `translate3d(-50%, -50%, 0) scale(${sx}, ${sy})`
})

export function toggleMirrorH() {
  mvMirrorH.value = !mvMirrorH.value
  saveMvSettings()
}

export function toggleMirrorV() {
  mvMirrorV.value = !mvMirrorV.value
  saveMvSettings()
}

export type MvFitMode = 'cover' | 'fill' | 'contain' | 'none' | 'tile'
export const MV_FIT_MODES: { value: MvFitMode; label: string }[] = [
  { value: 'cover', label: '填充' },
  { value: 'contain', label: '适应' },
  { value: 'fill', label: '拉伸' },
  { value: 'tile', label: '平铺' },
  { value: 'none', label: '居中' }
]

export const mvFitMode = ref<MvFitMode>('cover')
export const mvOverlayColor = ref('rgba(0, 0, 0, 0.55)')
export const mvVideoBgEnabled = ref(true)
export const mvAutoHideEnabled = ref(false)
export const mvUiVisible = ref(true)
export const mvSearchDialogVisible = ref(false)
export const mvMappings = ref<Record<string, MvMappingItem>>({})

export const mvSearchKeyword = ref('')
export const mvSearching = ref(false)
export const mvSearchResults = ref<BilibiliVideoItem[]>([])
export const editMvBvid = ref('')
export const editMvDelay = ref(0)
export const savingMvBvid = ref(false)
export const mvLoading = ref(false)

let isSilentSyncSeeking = false
let mvWaitingTimer: any = null

export function clearMvWaitingTimer() {
  if (mvWaitingTimer) {
    clearTimeout(mvWaitingTimer)
    mvWaitingTimer = null
  }
}

export function setSilentSyncSeek(v: HTMLVideoElement, time: number) {
  isSilentSyncSeeking = true
  v.currentTime = time
  setTimeout(() => {
    if (isSilentSyncSeeking && (!v || !v.seeking)) {
      isSilentSyncSeeking = false
    }
  }, 1000)
}

const DEFAULT_QUALITIES = [
  { value: 0, label: '自动 (最高画质)' },
  { value: 120, label: '超清 4K' },
  { value: 116, label: '高清 1080P60' },
  { value: 80, label: '高清 1080P' },
  { value: 64, label: '高清 720P' },
  { value: 32, label: '清晰 480P' },
  { value: 16, label: '流畅 360P' }
]
export const availableMvQualities = ref([...DEFAULT_QUALITIES])

export function getMvMappingForCurrentSong(): MvMappingItem | null {
  const songId = normalizeSongId(state.id)
  if (songId && mvMappings.value[songId]) {
    return mvMappings.value[songId]
  }
  const key = `${state.title.trim().toLowerCase()}-${state.artist.trim().toLowerCase()}`
  if (mvMappings.value[key]) {
    return mvMappings.value[key]
  }
  return null
}

export function openBoundMvLink() {
  const mapping = getMvMappingForCurrentSong()
  if (mapping?.bvid) {
    void openExternalLink(`https://www.bilibili.com/video/${mapping.bvid}`)
  }
}

export async function loadMvMappings() {
  try {
    const data = await getMvMappings()
    mvMappings.value = data || {}
  } catch (e) {
    console.error('loadMvMappings failed:', e)
  }
}

export async function saveCurrentMvMapping(bvid: string, meta?: Partial<MvMappingItem>) {
  const songId = normalizeSongId(state.id)
  const key = songId || `${state.title.trim().toLowerCase()}-${state.artist.trim().toLowerCase()}`
  if (!key) return

  const item: MvMappingItem = {
    bvid,
    title: meta?.title || state.title,
    author: meta?.author || state.artist,
    pic: meta?.pic || '',
    delay: meta?.delay ?? editMvDelay.value,
    songTitle: state.title,
    songArtist: state.artist
  }

  mvMappings.value[key] = item
  await saveMvMappings(mvMappings.value)
  ElMessage.success('已保存当前歌曲的 MV 关联')
}

export async function deleteMvBinding() {
  const songId = normalizeSongId(state.id)
  const key = songId || `${state.title.trim().toLowerCase()}-${state.artist.trim().toLowerCase()}`
  if (key && mvMappings.value[key]) {
    delete mvMappings.value[key]
    await saveMvMappings(mvMappings.value)
    currentMvBvid.value = ''
    mvVideoUrl.value = ''
    ElMessage.info('已解除 MV 关联')
  }
}

export function openMvSearch() {
  mvSearchKeyword.value = `${state.title} ${state.artist}`.trim()
  mvSearchDialogVisible.value = true
  void performMvSearch()
}

export async function performMvSearch() {
  if (!mvSearchKeyword.value.trim()) return
  mvSearching.value = true
  try {
    mvSearchResults.value = await bilibiliService.searchVideos(mvSearchKeyword.value)
  } catch (e) {
    console.error('performMvSearch error:', e)
  } finally {
    mvSearching.value = false
  }
}

export async function bindMvToCurrentSong(item: BilibiliVideoItem) {
  currentMvBvid.value = item.bvid
  await saveCurrentMvMapping(item.bvid, {
    title: item.title,
    author: item.author,
    pic: item.pic
  })
  mvSearchDialogVisible.value = false
  await loadAndPlayMv(item.bvid)
}

export async function saveManualBvidEdit() {
  const bvid = editMvBvid.value.trim()
  if (!bvid) return
  savingMvBvid.value = true
  try {
    currentMvBvid.value = bvid
    await saveCurrentMvMapping(bvid, { delay: editMvDelay.value })
    await loadAndPlayMv(bvid)
  } catch (e) {
    console.error('saveManualBvidEdit failed:', e)
  } finally {
    savingMvBvid.value = false
  }
}

export async function loadAndPlayMv(bvid: string) {
  if (!bvid) return
  mvLoading.value = true
  currentMvBvid.value = bvid
  try {
    const playResult = await bilibiliService.getPlayurl(bvid, mvQuality.value)
    if (playResult && playResult.url) {
      mvVideoUrl.value = playResult.url
      currentMvQualityLabel.value = normalizeQualityLabel(playResult.quality || mvQuality.value)
      await nextTick()
      if (mvVideoRef.value) {
        mvVideoRef.value.src = playResult.url
        syncVideoTimeWithSong(state.currentTime / 1000)
        if (state.isPlay) {
          mvVideoRef.value.play().catch(() => {})
        }
      }
    } else {
      ElMessage.warning('未能获取到该视频的播放流地址')
    }
  } catch (e) {
    console.error('loadAndPlayMv failed:', e)
  } finally {
    mvLoading.value = false
  }
}

export function syncVideoTimeWithSong(currentTimeSec: number, force = false) {
  const v = mvVideoRef.value
  if (!v || !mvModeEnabled.value || !mvVideoUrl.value) return

  const mapping = getMvMappingForCurrentSong()
  const delaySec = (mapping?.delay ?? editMvDelay.value ?? 0) / 1000
  const targetTime = Math.max(0, currentTimeSec + delaySec)

  const diff = Math.abs(v.currentTime - targetTime)
  if (force || diff > 0.6) {
    setSilentSyncSeek(v, targetTime)
  }
}

export function syncMvVideoProgress(currentTimeMs: number) {
  syncVideoTimeWithSong(currentTimeMs / 1000)
}

export function syncMvPlayState(isPlaying: boolean) {
  const v = mvVideoRef.value
  if (!v || !mvModeEnabled.value) return
  if (isPlaying) {
    v.play().catch(() => {})
  } else {
    v.pause()
  }
}

export function toggleMvMode() {
  mvModeEnabled.value = !mvModeEnabled.value
  if (mvModeEnabled.value) {
    autoMatchMvForCurrentSong()
  }
  saveMvSettings()
}

export function toggleMvBlur() {
  mvBlurEnabled.value = !mvBlurEnabled.value
  saveMvSettings()
}

export function toggleMvVideoBg() {
  mvVideoBgEnabled.value = !mvVideoBgEnabled.value
  saveMvSettings()
}

export function toggleMvAutoHide() {
  mvAutoHideEnabled.value = !mvAutoHideEnabled.value
  saveMvSettings()
}

export function toggleAllLyrics() {
  showLyric.value = !showLyric.value
}

export function adjustMvDelay(deltaMs: number) {
  editMvDelay.value += deltaMs
  const mapping = getMvMappingForCurrentSong()
  if (mapping) {
    mapping.delay = editMvDelay.value
    void saveCurrentMvMapping(mapping.bvid, { delay: editMvDelay.value })
  } else if (currentMvBvid.value) {
    void saveCurrentMvMapping(currentMvBvid.value, { delay: editMvDelay.value })
  }
  syncVideoTimeWithSong(state.currentTime / 1000, true)
}

export function onEditMvDelayChange(newDelay: number) {
  const normalized = Number.isFinite(newDelay) ? newDelay : 0
  editMvDelay.value = normalized
  const mapping = getMvMappingForCurrentSong()
  if (mapping) {
    mapping.delay = normalized
    void saveCurrentMvMapping(mapping.bvid, { delay: normalized })
  } else if (currentMvBvid.value) {
    void saveCurrentMvMapping(currentMvBvid.value, { delay: normalized })
  }
  syncVideoTimeWithSong(state.currentTime / 1000, true)
}

export function onMvQualityChange(qn: number) {
  mvQuality.value = qn
  if (currentMvBvid.value) {
    void loadAndPlayMv(currentMvBvid.value)
  }
}

export async function autoMatchMvForCurrentSong() {
  const mapping = getMvMappingForCurrentSong()
  if (mapping?.bvid) {
    currentMvBvid.value = mapping.bvid
    editMvBvid.value = mapping.bvid
    editMvDelay.value = mapping.delay || 0
    await loadAndPlayMv(mapping.bvid)
    return
  }

  // Auto search Bilibili
  if (state.title && state.title !== '未知歌曲') {
    const kw = `${state.title} ${state.artist}`.trim()
    try {
      const results = await bilibiliService.searchVideos(kw)
      if (results.length > 0) {
        const best = results[0]
        await bindMvToCurrentSong(best)
      }
    } catch (e) {
      console.warn('Auto match MV failed:', e)
    }
  }
}

// Video Element event handlers
export function onVideoLoadedMetadata() {
  mvLoading.value = false
  syncVideoTimeWithSong(state.currentTime / 1000)
}

export function onVideoLoadedData() {
  mvLoading.value = false
}

export function onVideoWaiting() {
  // waiting
}

export function onVideoPlaying() {
  mvLoading.value = false
}

export function onVideoSeeking() {}
export function onVideoSeeked() {
  isSilentSyncSeeking = false
}

export function onVideoCanPlay() {
  mvLoading.value = false
}

export function onVideoError() {
  mvLoading.value = false
  if (mvVideoUrl.value) {
    const err = mvVideoRef.value?.error
    console.error('MV video element error:', err?.code, err?.message, mvVideoUrl.value)
    ElMessage.warning('MV 视频流加载失败，请尝试切换画质或更换视频源')
  }
}

export function onMvTopInfoMouseEnter() {
  mvUiVisible.value = true
}

export function onMvTopInfoMouseLeave() {
  if (mvAutoHideEnabled.value) {
    mvUiVisible.value = false
  }
}

export function onMvControlsMouseEnter() {
  mvUiVisible.value = true
}

export function onMvControlsMouseLeave() {
  if (mvAutoHideEnabled.value) {
    mvUiVisible.value = false
  }
}

export function formatPlayCount(count: number | string): string {
  const num = Number(count)
  if (isNaN(num)) return String(count)
  if (num > 10000) return `${(num / 10000).toFixed(1)}万`
  return String(num)
}

export function getScoreClass(score: number): string {
  if (score >= 80) return 'score-high'
  if (score >= 60) return 'score-medium'
  return 'score-low'
}

export function onMvCleanup() {
  if (mvVideoRef.value) {
    mvVideoRef.value.pause()
    mvVideoRef.value.src = ''
  }
}

export async function loadMvSettings() {
  try {
    const [config, user] = await Promise.all([getAppConfig(), bilibiliService.init()])
    mvModeEnabled.value = config.mv_mode_enabled ?? true
    mvBlurEnabled.value = config.mv_blur_enabled ?? true
    mvVideoBgEnabled.value = config.mv_video_bg_enabled ?? true
    mvBlurValue.value = config.mv_blur_value ?? 18
    mvFitMode.value = (config.mv_fit_mode as any) || 'cover'
    mvQuality.value = user.connected ? (config.mv_quality ?? 80) : 32
  } catch (e) {
    console.error('loadMvSettings error:', e)
  }
}

export async function saveMvSettings() {
  try {
    const config = await getAppConfig()
    config.mv_mode_enabled = mvModeEnabled.value
    config.mv_blur_enabled = mvBlurEnabled.value
    config.mv_video_bg_enabled = mvVideoBgEnabled.value
    config.mv_blur_value = mvBlurValue.value
    config.mv_fit_mode = mvFitMode.value
    config.mv_quality = mvQuality.value
    config.subtitle_mode = subtitleMode.value
    config.subtitle_font_size = subtitleFontSize.value
    await saveAppConfig(config)
  } catch (e) {
    console.error('saveMvSettings error:', e)
  }
}

// Cache & local media stubs (local download & cache removed per requirement #2)
export const mvAutoCacheEnabled = ref(false)
export const mvCacheStatus = ref({
  isCached: false,
  isCaching: false,
  progress: 0,
  sizeFormatted: ''
})
export const allCacheStats = ref({
  count: 0,
  totalSizeFormatted: '0 B',
  totalMvFiles: 0,
  totalMvSizeBytes: 0,
  totalMvSizeFormatted: '0 B'
})
export const songMediaStatus = ref<any>({
  audio: { isCached: false },
  video: { isCached: false }
})
export async function cacheCurrentMv() {}
export async function cancelCurrentMvCache() {}
export async function deleteCurrentMvCache() {}
export async function clearAllMvCache() {}
export async function openMvCacheDir() {}
export async function saveCurrentMvAs() {}
export function toggleMvAutoCache() {}
export async function refreshSongMediaStatus() {}
export async function cacheCurrentSongAll() {}
export async function openCurrentSongCacheDir() {}
export async function deleteCurrentSongAllCache() {}

// Watch song changes to auto update MV
watch(
  () => state.id,
  (newId, oldId) => {
    if (newId !== oldId && mvModeEnabled.value && newId > 0) {
      void autoMatchMvForCurrentSong()
    }
  }
)
