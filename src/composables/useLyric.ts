import { ref, computed, watch, reactive } from 'vue'
import type { LyricLine } from '@/services/qmusiclrcparser'
import { parseQrcLyric } from '@/services/qmusiclrcparser'
import { defaultLyricTheme, extractLyricThemeFromCover } from '@/services/lyricTheme'
import { currentLyric } from '@/services/qmusicService'
import {
  state,
  display,
  translate,
  roma,
  showMainLyric
} from '@/services/store'

export interface QqLyricPayload {
  id?: string | number
  lyric: string
  trans: string
  roma: string
  fetchSuccess?: boolean
  isPureMusic?: boolean
}

export const lyricTheme = reactive({ ...defaultLyricTheme })
export const lyricBlurEnabled = ref(false)
export const customPlayedColor = ref('')
export const customTransColor = ref('')
export const customRomaColor = ref('')
export const disableSublineOpacity = ref(false)
export const useCustomColor = ref(false)
export const showLyricFontSizeTip = ref(false)
export const lyricFontSizeTipText = ref('')
export const lyricPlayerRenderKey = ref(0)
export const lyricSeekPreviewTime = ref<number | null>(null)
export const viewportWidth = ref(typeof window === 'undefined' ? 1280 : window.innerWidth)
export const viewportHeight = ref(typeof window === 'undefined' ? 720 : window.innerHeight)

const LYRIC_FONT_BASE_SIZE_STORAGE_KEY = 'lucklink:qmusiclrc-font-base-size-rem'
const DEFAULT_LYRIC_FONT_BASE_SIZE_REM = 3
const MIN_LYRIC_FONT_BASE_SIZE_REM = 1.4
const MAX_LYRIC_FONT_BASE_SIZE_REM = 6
const LYRIC_FONT_BASE_SIZE_STEP_REM = 0.2
const LYRIC_FONT_SCALE_REFERENCE_WIDTH = 1280
const LYRIC_FONT_SCALE_REFERENCE_HEIGHT = 720

export const lyricFontBaseSizeRem = ref(loadLyricFontBaseSize())
export const lyricWindowScale = computed(() =>
  getBaseLyricFontScale(viewportWidth.value, viewportHeight.value)
)
export const resolvedLyricFontSizeRem = computed(() =>
  clampLyricFontSizeRem(lyricFontBaseSizeRem.value * lyricWindowScale.value)
)
export const displayedLyricCurrentTime = computed(
  () => lyricSeekPreviewTime.value ?? (state.isPlay ? state.currentTime + 250 : state.currentTime)
)
export const lyricPlayerStyle = computed(() => {
  const s: any = {
    width: '100%',
    height: '100%',
    '--amll-lp-color': (useCustomColor.value && customPlayedColor.value) ? customPlayedColor.value : (lyricTheme.playedColor || '#ffffff'),
    '--amll-trans-color': customTransColor.value || 'rgba(255,255,255,0.5)',
    '--amll-roma-color': customRomaColor.value || 'rgba(255,255,255,0.5)',
    '--amll-lp-font-size': `${resolvedLyricFontSizeRem.value}rem`,
    '--amll-lp-line-height': '1.5',
    mixBlendMode: 'plus-lighter',
    textShadow: lyricTheme.textShadow
  }
  return s
})

let lyricThemeRequestId = 0
let lyricSeekPreviewTimer: ReturnType<typeof setTimeout> | null = null
let lyricSeekPreviewMode: 'direct' | 'interlude' | null = null
let lyricSeekPreviewTargetTime: number | null = null
let qqLyricdata: QqLyricPayload | null = null
let templyricdata: QqLyricPayload | null = null
let playerLyricText = ''
let playerLyricTrans = ''
let playerLyricRoma = ''
let lastRenderedQqSignature = ''
let lastRenderedPlayerSignature = ''
export const setprogress = ref(false)
let latestPlayerSessionId = 0

const DEFAULT_LRC_LINE_ACTIVE_DURATION_MS = 3000
const LRC_INTERLUDE_GAP_THRESHOLD_MS = 3500

function isResolvedEmptyLyricPayload(data?: QqLyricPayload | null, lines: LyricLine[] = []) {
  if (!data || data.fetchSuccess === false) return false
  return !!data.isPureMusic || lines.length === 0
}

function canRenderCurrentQqLyric() {
  if (!qqLyricdata?.lyric) return false
  const lid = normalizeSongId(qqLyricdata.id)
  const cid = normalizeSongId(state.id)
  return !lid || !cid || lid === cid
}

function clampLyricFontBaseSizeRem(v: number) {
  return Math.min(
    MAX_LYRIC_FONT_BASE_SIZE_REM,
    Math.max(MIN_LYRIC_FONT_BASE_SIZE_REM, Math.round(v * 10) / 10)
  )
}
function clampLyricFontSizeRem(v: number) {
  return Math.min(
    MAX_LYRIC_FONT_BASE_SIZE_REM,
    Math.max(MIN_LYRIC_FONT_BASE_SIZE_REM, Math.round(v * 10) / 10)
  )
}
function getWindowAdaptiveLyricFontSizeRem(w: number, h: number) {
  return Math.max(Math.max(h * 0.05, w * 0.025), 12) / 16
}
function getBaseLyricFontScale(w: number, h: number) {
  const ref = getWindowAdaptiveLyricFontSizeRem(
    LYRIC_FONT_SCALE_REFERENCE_WIDTH,
    LYRIC_FONT_SCALE_REFERENCE_HEIGHT
  )
  return getWindowAdaptiveLyricFontSizeRem(w, h) / ref
}
function loadLyricFontBaseSize() {
  try {
    const raw = window.localStorage.getItem(LYRIC_FONT_BASE_SIZE_STORAGE_KEY)
    if (raw) {
      const p = Number.parseFloat(raw)
      if (Number.isFinite(p)) return clampLyricFontBaseSizeRem(p)
    }
  } catch {}
  return DEFAULT_LYRIC_FONT_BASE_SIZE_REM
}
function persistLyricFontBaseSize(v: number) {
  try {
    window.localStorage.setItem(LYRIC_FONT_BASE_SIZE_STORAGE_KEY, `${v}`)
  } catch {}
}

export function showLyricFontSizeFeedback() {
  lyricFontSizeTipText.value = `基础 ${lyricFontBaseSizeRem.value.toFixed(1)}rem / 当前 ${resolvedLyricFontSizeRem.value.toFixed(1)}rem`
  showLyricFontSizeTip.value = true
  setTimeout(() => {
    showLyricFontSizeTip.value = false
  }, 1200)
}

export function setLyricFontBaseSize(next: number) {
  const clamped = clampLyricFontBaseSizeRem(next)
  const changed = Math.abs(clamped - lyricFontBaseSizeRem.value) > 0.001
  lyricFontBaseSizeRem.value = clamped
  showLyricFontSizeFeedback()
  if (changed) persistLyricFontBaseSize(clamped)
}

export function handleLyricWheel(event: WheelEvent) {
  if (!event.ctrlKey) return
  try {
    if (event.cancelable) event.preventDefault()
  } catch {}
  setLyricFontBaseSize(
    lyricFontBaseSizeRem.value + (event.deltaY < 0 ? 1 : -1) * LYRIC_FONT_BASE_SIZE_STEP_REM
  )
}

export async function refreshLyricTheme(coverUrl?: string) {
  const rid = ++lyricThemeRequestId
  const theme = await extractLyricThemeFromCover(coverUrl)
  if (rid !== lyricThemeRequestId) return
  if (!useCustomColor.value || !customPlayedColor.value) lyricTheme.playedColor = theme.playedColor
  lyricTheme.textShadow = theme.textShadow
}

function clearLyricSeekPreview() {
  if (lyricSeekPreviewTimer) {
    clearTimeout(lyricSeekPreviewTimer)
    lyricSeekPreviewTimer = null
  }
  lyricSeekPreviewMode = null
  lyricSeekPreviewTargetTime = null
  lyricSeekPreviewTime.value = null
}

function findUpcomingLyricLineStartTime(targetTime: number) {
  let prev: LyricLine | undefined
  for (const line of state.lyricLines) {
    if (targetTime < line.startTime) {
      if (!prev || targetTime >= prev.endTime) return line.startTime
      return null
    }
    prev = line
  }
  return null
}

export function syncLyricSeekPreview(targetTime: number) {
  const upcoming = findUpcomingLyricLineStartTime(targetTime)
  lyricSeekPreviewTargetTime = targetTime
  if (upcoming !== null && upcoming > targetTime) {
    lyricSeekPreviewMode = 'interlude'
    lyricSeekPreviewTime.value = upcoming
    if (lyricSeekPreviewTimer) {
      clearTimeout(lyricSeekPreviewTimer)
      lyricSeekPreviewTimer = null
    }
    return
  }
  lyricSeekPreviewMode = 'direct'
  lyricSeekPreviewTime.value = targetTime
  if (lyricSeekPreviewTimer) clearTimeout(lyricSeekPreviewTimer)
  lyricSeekPreviewTimer = setTimeout(() => {
    lyricSeekPreviewTimer = null
    if (lyricSeekPreviewMode === 'direct') clearLyricSeekPreview()
  }, 1200)
}

export function bumpLyricPlayerRenderKey() {
  lyricPlayerRenderKey.value += 1
}

export function parseTimedTextEntries(
  rawText?: string
): Array<{ startTime: number; text: string }> {
  if (!rawText) return []
  const entries: Array<{ startTime: number; text: string }> = []
  const lrcRe = /\[(\d+):(\d+)(?:\.(\d{1,3}))?\]/g
  for (const rawLine of rawText.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const qrcMatch = line.match(/^\[(\d+),(\d+)\](.*)/)
    if (qrcMatch) {
      const text = (qrcMatch[3] || '')
        .replace(/\(\d+,\d+\)/g, '')
        .replace(/\/\//g, '')
        .trim()
      if (text) entries.push({ startTime: parseInt(qrcMatch[1], 10), text })
      continue
    }
    lrcRe.lastIndex = 0
    const matches = [...line.matchAll(lrcRe)]
    if (!matches.length) continue
    lrcRe.lastIndex = 0
    const sharedText = line.replace(lrcRe, '').replace(/\/\//g, '').trim()
    matches.forEach((m, i) => {
      const ms =
        parseInt(m[1], 10) * 60000 +
        parseInt(m[2], 10) * 1000 +
        (m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) : 0)
      const next = matches[i + 1]
      const textStart = (m.index || 0) + m[0].length
      const textEnd = next?.index ?? line.length
      const text = line.slice(textStart, textEnd).replace(/\/\//g, '').trim() || sharedText
      if (text) entries.push({ startTime: ms, text })
    })
  }
  return entries.sort((a, b) => a.startTime - b.startTime)
}

function findClosestTimedText(
  entries: Array<{ startTime: number; text: string }>,
  startTime: number
): string {
  if (!entries.length) return ''
  return entries.reduce(
    (c, e) => {
      const d = Math.abs(e.startTime - startTime)
      return d < c.diff ? { text: e.text, diff: d } : c
    },
    { text: '', diff: Infinity }
  ).text
}

function parsePlayerLyric(raw?: string, trans = '', romaStr = ''): LyricLine[] {
  if (!raw) return []
  if (raw.split('\n').some((l) => /^\[\d+,\d+\]/.test(l.trim())))
    return parseQrcLyric({ lyric: raw, trans, roma: romaStr })
  const entries = parseTimedTextEntries(raw)
  const transE = parseTimedTextEntries(trans)
  const romaE = parseTimedTextEntries(romaStr)
  return entries.map((e, i) => {
    const next = entries[i + 1]
    const end =
      next && next.startTime - e.startTime <= LRC_INTERLUDE_GAP_THRESHOLD_MS
        ? next.startTime
        : e.startTime + DEFAULT_LRC_LINE_ACTIVE_DURATION_MS
    return {
      words: [
        { word: e.text, startTime: e.startTime, endTime: end, romanWord: '', obscene: false }
      ],
      lyric: e.text,
      translatedLyric: findClosestTimedText(transE, e.startTime),
      romanLyric: findClosestTimedText(romaE, e.startTime),
      startTime: e.startTime,
      endTime: end,
      isBG: false,
      isDuet: false
    }
  })
}

function renderPlayerLyrics(force = false) {
  const nt = translate.value ? playerLyricTrans : ''
  const nr = roma.value ? playerLyricRoma : ''
  const sig = JSON.stringify({ lyric: playerLyricText, trans: nt, roma: nr })
  if (!force && sig === lastRenderedPlayerSignature && state.lyricLines.length > 0) return
  state.lyricLines = parsePlayerLyric(playerLyricText, nt, nr)
  lastRenderedPlayerSignature = sig
  bumpLyricPlayerRenderKey()
}

export function setlyricshow(force = false) {
  if (state.mode !== 'qq') return
  if (!qqLyricdata?.lyric) {
    state.lyricLines = []
    state.isPureMusic = isResolvedEmptyLyricPayload(qqLyricdata)
    lastRenderedQqSignature = ''
    bumpLyricPlayerRenderKey()
    return
  }
  if (!canRenderCurrentQqLyric()) return
  templyricdata = { ...qqLyricdata }
  if (!translate.value) templyricdata.trans = ''
  else templyricdata.trans = qqLyricdata.trans
  if (!roma.value) templyricdata.roma = ''
  else templyricdata.roma = qqLyricdata.roma
  const sig = JSON.stringify({
    id: normalizeSongId(qqLyricdata.id),
    lyric: templyricdata.lyric,
    trans: templyricdata.trans,
    roma: templyricdata.roma
  })
  if (!force && sig === lastRenderedQqSignature && state.lyricLines.length > 0) return
  const lines = parseQrcLyric(templyricdata)
  state.lyricLines = lines
  state.isPureMusic = isResolvedEmptyLyricPayload(qqLyricdata, lines)
  lastRenderedQqSignature = sig
  bumpLyricPlayerRenderKey()
}

export function handleLyricDisplayChange() {
  if (state.mode === 'player') renderPlayerLyrics(true)
  else if (state.mode === 'qq') setlyricshow(true)
}

export function applyQqLyricPayload(data?: {
  id?: number
  lyric?: string
  trans?: string
  roma?: string
  fetchSuccess?: boolean
  isPureMusic?: boolean
}) {
  const nd: QqLyricPayload = {
    id: data?.id,
    lyric: data?.lyric || '',
    trans: data?.trans || '',
    roma: data?.roma || '',
    fetchSuccess: data?.fetchSuccess,
    isPureMusic: !!data?.isPureMusic
  }
  qqLyricdata = nd
  state.isPureMusic = !nd.lyric ? isResolvedEmptyLyricPayload(nd) : !!nd.isPureMusic
  if (!nd.lyric) {
    if (state.mode === 'qq') {
      state.lyricLines = []
      lastRenderedQqSignature = ''
      bumpLyricPlayerRenderKey()
    }
    return
  }
  if (state.mode === 'qq' && canRenderCurrentQqLyric()) {
    setlyricshow(true)
  }
}

// 同步 qmusicService 拉取到的原始歌词数据，确保翻译/罗马音切换不会丢失歌词
watch(
  () => [currentLyric.id, currentLyric.lyric, currentLyric.trans, currentLyric.roma, currentLyric.isPureMusic],
  () => {
    if (currentLyric.id > 0 || currentLyric.lyric) {
      applyQqLyricPayload({
        id: currentLyric.id,
        lyric: currentLyric.lyric,
        trans: currentLyric.trans,
        roma: currentLyric.roma,
        fetchSuccess: currentLyric.fetchSuccess,
        isPureMusic: currentLyric.isPureMusic
      })
    }
  },
  { immediate: true }
)

// 监听歌曲切换：如果新歌的歌词已在内存则立即渲染，否则立即清空旧歌词防止串词
watch(
  () => [state.id, state.title],
  ([newId, newTitle], [oldId, oldTitle]) => {
    if (state.mode !== 'qq') return
    if (newId === oldId && newTitle === oldTitle) return

    const normalizedNewId = normalizeSongId(newId)
    const normalizedLyricId = normalizeSongId(qqLyricdata?.id)

    if (normalizedNewId && normalizedLyricId && normalizedNewId === normalizedLyricId) {
      setlyricshow(true)
    } else {
      state.lyricLines = []
      lastRenderedQqSignature = ''
      state.isPureMusic = false
      bumpLyricPlayerRenderKey()
    }
  }
)

export function applyPlayerTrackPayload(data: any) {
  const sid = typeof data.sessionId === 'number' ? data.sessionId : 0
  if (sid && latestPlayerSessionId && sid < latestPlayerSessionId) return
  if (sid) latestPlayerSessionId = sid
  state.mode = 'player'
  state.id = data.id || 0
  state.mid = data.mid || ''
  state.title = data.title || ''
  state.artist = data.artist || ''
  state.album = data.album || ''
  state.albumUrl = data.cover || ''
  state.playUrl = data.src || ''
  state.qualityLabel = normalizeQualityLabel(data.qualityLabel || '')
  state.state = '音乐播放器模式'
  state.server = '本地播放器'
  state.isPlay = data.isPlaying ?? true
  state.isPureMusic = !!data.isPureMusic
  state.currentTime = typeof data.currentTime === 'number' ? Math.round(data.currentTime * 1000) : 0
  state.endTime = typeof data.duration === 'number' ? Math.round(data.duration * 1000) : 0
  display.volume =
    typeof data.volume === 'number' ? Math.max(0, Math.min(Math.round(data.volume), 100)) : 100
  if (data.lyrics) {
    const prev = JSON.stringify({
      lyric: playerLyricText,
      trans: playerLyricTrans,
      roma: playerLyricRoma
    })
    playerLyricText = data.lyrics
    playerLyricTrans = data.trans || ''
    playerLyricRoma = data.roma || ''
    const next = JSON.stringify({
      lyric: playerLyricText,
      trans: playerLyricTrans,
      roma: playerLyricRoma
    })
    if (next !== prev || !state.lyricLines.length) renderPlayerLyrics(true)
  } else {
    playerLyricText = ''
    playerLyricTrans = ''
    playerLyricRoma = ''
    lastRenderedPlayerSignature = ''
    state.lyricLines = []
  }
}

export function resetToQqMode() {
  state.mode = 'qq'
  state.id = 0
  state.mid = ''
  state.title = ''
  state.artist = ''
  state.album = ''
  state.albumUrl = ''
  state.playUrl = ''
  state.currentTime = 0
  state.endTime = 0
  state.lyricLines = []
  qqLyricdata = null
  lastRenderedQqSignature = ''
  state.quality = 0
  state.qualityLabel = ''
  state.isPlay = false
  state.state = ''
  state.server = ''
  state.isPureMusic = false
  display.nowtime = '0:00'
  display.endTime = '-0:00'
  display.progress = 0
  display.tagstr = '未知'
}

export function showtranslate() {
  translate.value = !translate.value
  if (state.mode === 'player') renderPlayerLyrics(true)
  else if (state.mode === 'qq') setlyricshow(true)
}
export function showroma() {
  roma.value = !roma.value
  if (state.mode === 'player') renderPlayerLyrics(true)
  else if (state.mode === 'qq') setlyricshow(true)
}

const QUALITY_LABEL_MAP: Record<string, string> = {
  MP3_320: '标准',
  MP3: '标准',
  LOW: '标准',
  STANDARD: '标准',
  '0': '标准',
  HIGH: '高品质',
  '1': '高品质',
  '2': '无损',
  '16': '360P',
  '32': '480P',
  '64': '720P',
  '74': '720P 60帧',
  '80': '1080P',
  '112': '1080P+',
  '116': '1080P 60帧',
  '120': '4K'
}

export function normalizeQualityLabel(label?: string | number): string {
  const n = `${label ?? ''}`.trim().toUpperCase()
  if (!n) return ''
  return QUALITY_LABEL_MAP[n] ?? String(label)
}

export function normalizeSongId(value: unknown): string {
  if (value == null) return ''
  const n = `${value}`.trim()
  return !n || n === '0' || n === 'NaN' ? '' : n
}

export function settagstr(quality: number) {
  if (state.qualityLabel) {
    display.tagstr = normalizeQualityLabel(state.qualityLabel)
    return
  }
  if (quality >= 3) {
    display.tagstr = '臻品'
    return
  }
  switch (quality) {
    case 0:
      display.tagstr = '标准'
      break
    case 1:
      display.tagstr = '高品质'
      break
    case 2:
      display.tagstr = '无损'
      break
    default:
      display.tagstr = '未知'
      break
  }
}

export function updateEndTimeDisplay(totalMs: number) {
  const ms = Number.isFinite(totalMs) && totalMs > 0 ? totalMs : 0
  const m = Math.floor(ms / 1000 / 60)
  const s = Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, '0')
  display.endTime = `-${m}:${s}`
}

export function onLyricCleanup() {
  if (lyricSeekPreviewTimer) {
    clearTimeout(lyricSeekPreviewTimer)
    lyricSeekPreviewTimer = null
  }
}
