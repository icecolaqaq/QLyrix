import './worker.polyfill'
import * as PIXI from 'pixi.js'
import type { LyricLine } from '@/services/qmusiclrcparser'

// Set PixiJS to use WebWorkerAdapter in Web Worker environment
if (PIXI.WebWorkerAdapter) {
  PIXI.DOMAdapter.set(PIXI.WebWorkerAdapter)
}


export interface SubtitlesWorkerInitMessage {
  type: 'init'
  canvas: OffscreenCanvas
  CW: number
  CH: number
  baseFontSize: number
  playedColor?: string
  defaultColor?: string
  transColor?: string
  effect?: string
  lyricLines: LyricLine[]
  currentTime: number
  playing: boolean
}

export interface SubtitlesWorkerUpdateTimeMessage {
  type: 'updateTime'
  currentTime: number
  playing: boolean
}

export interface SubtitlesWorkerUpdatePlayingMessage {
  type: 'updatePlaying'
  playing: boolean
  currentTime: number
}

export interface SubtitlesWorkerUpdateLyricLinesMessage {
  type: 'updateLyricLines'
  lyricLines: LyricLine[]
  currentTime: number
}

export interface SubtitlesWorkerUpdateColorsMessage {
  type: 'updateColors'
  playedColor?: string
  defaultColor?: string
  transColor?: string
}

export interface SubtitlesWorkerUpdateFontSizeMessage {
  type: 'updateFontSize'
  fontSize: number
}

export interface SubtitlesWorkerUpdateEffectMessage {
  type: 'updateEffect'
  effect: string
}

export interface SubtitlesWorkerDestroyMessage {
  type: 'destroy'
}

export type SubtitlesWorkerMessage =
  | SubtitlesWorkerInitMessage
  | SubtitlesWorkerUpdateTimeMessage
  | SubtitlesWorkerUpdatePlayingMessage
  | SubtitlesWorkerUpdateLyricLinesMessage
  | SubtitlesWorkerUpdateColorsMessage
  | SubtitlesWorkerUpdateFontSizeMessage
  | SubtitlesWorkerUpdateEffectMessage
  | SubtitlesWorkerDestroyMessage

let CW = 1200
let CH = 500
const PAD_X = 72
const FONT = '"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif'

const ENTER_DUR = 520
const DISS_DUR = 400
const PRELIGHT_MS = 150

let app: PIXI.Application | null = null
let raf: number | null = null
let wordContainer: PIXI.Container | null = null
let particleGfx: PIXI.Graphics | null = null
let ambientGfx: PIXI.Graphics | null = null

// Interlude elements
let interludeContainer: PIXI.Container | null = null
let interludeBaseText: PIXI.Text | null = null
let interludeColorText: PIXI.Text | null = null
let interludeColorGfx: PIXI.Graphics | null = null

// Single line visual components
let baseText: PIXI.Text | null = null
let shadowText: PIXI.Text | null = null
let maskSprite: PIXI.Sprite | null = null
let currentMaskTexture: PIXI.Texture | null = null
let colorContainer: PIXI.Container | null = null
let colorGfx: PIXI.Graphics | null = null
let sweepSprite: PIXI.Sprite | null = null
let wipeGfx: PIXI.Graphics | null = null
let lineVisualContainer: PIXI.Container | null = null

// Reusable sweep gradient resources (0 texture allocations per frame)
let sweepCanvas: OffscreenCanvas | null = null
let sweepCtx: OffscreenCanvasRenderingContext2D | null = null
let sweepSource: PIXI.CanvasSource | null = null
let sweepTexture: PIXI.Texture | null = null
let lastSweepScSig = ''

// Subtitle effect style: wind(particle dissolve) | fade | pop | slide | glow | sparkle
type SubtitleEffect =
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
const VALID_EFFECTS: SubtitleEffect[] = [
  'wind',
  'fade',
  'pop',
  'slide',
  'glow',
  'sparkle',
  'cinema',
  'drop',
  'flip',

  'aurora',
  'bubble'
]

function easeOutBounce(x: number) {
  const n1 = 7.5625
  const d1 = 2.75
  if (x < 1 / d1) return n1 * x * x
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375
  return n1 * (x -= 2.625 / d1) * x + 0.984375
}

function hslHex(h: number, s: number, l: number): number {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return hexColor(f(0) * 255, f(8) * 255, f(4) * 255)
}
const SOFT_EXIT_DUR = 280
let effect: SubtitleEffect = 'wind'
let glowText: PIXI.Text | null = null

function normalizeEffect(v?: string): SubtitleEffect {
  return VALID_EFFECTS.includes(v as SubtitleEffect) ? (v as SubtitleEffect) : 'wind'
}

function easeOutBack(v: number) {
  const c1 = 1.4
  const c3 = c1 + 1
  return 1 + c3 * (v - 1) ** 3 + c1 * (v - 1) ** 2
}

let transTextObj: PIXI.Text | null = null
let transShadowObj: PIXI.Text | null = null

interface RgbaColor {
  r: number
  g: number
  b: number
  a: number
}

interface WordSpan {
  startX: number
  endX: number
  s: number
  e: number
}

interface Particle {
  x: number
  y: number
  tx: number
  ty: number
  vx: number
  vy: number
  spin: number
  a: number
  sz: number
  c: number
  life: number
  age: number
}

let wordSpans: WordSpan[] = []
let lineFontSize = 44
let lineMainY = 0
let lineBaseX = 0
let lineTotalW = 0
let lineStartAt = 0
let lastColorSig = ''
let renderedPlayheadX = 0
let lastPlayheadRenderAt = 0

let allWindCandidates: Particle[] = []
let particles: Particle[] = []
let ci = -1
let dissolving = false
let dissStart = 0
let pendingIdx = -1
let lastEraseX = 0
let currentPlayheadX = 0

let baseFontSize = 52

let offCvs: OffscreenCanvas | null = null
let offCtx: OffscreenCanvasRenderingContext2D | null = null

let lastUpdateTime = 0
let baseTime = 0
let smoothedTime = 0
let lastFrameTime = 0

let isPlaying = false
let lyricLines: LyricLine[] = []
let playedColor = '#ff6b9d'
let defaultColor = 'rgba(255,255,255,0.5)'
let transColor = 'rgba(255,255,255,0.35)'

let isInitialized = false
let initPromise: Promise<void> | null = null

function smoothTime() {
  let nowTime = baseTime
  if (isPlaying && lastUpdateTime > 0) {
    const elapsed = performance.now() - lastUpdateTime
    nowTime = baseTime + elapsed
  }
  return nowTime
}

function clamp(v: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v))
}

function easeOutCubic(v: number) {
  return 1 - (1 - v) ** 3
}

function easeInOut(v: number) {
  return v < 0.5 ? 4 * v * v * v : 1 - (-2 * v + 2) ** 3 / 2
}

function getOffCtx(): OffscreenCanvasRenderingContext2D {
  if (!offCvs) {
    offCvs = new OffscreenCanvas(CW, CH)
  }
  if (!offCtx) {
    offCtx = offCvs.getContext('2d', { willReadFrequently: true })!
  }
  return offCtx
}

function pc(s: string): RgbaColor {
  if (!s) return { r: 255, g: 255, b: 255, a: 0.45 }
  const input = s.trim()
  if (input[0] === '#') {
    let h = input.slice(1)
    if (h.length === 3 || h.length === 4) {
      h = h
        .split('')
        .map((v) => v + v)
        .join('')
    }
    return {
      r: parseInt(h.slice(0, 2), 16) || 255,
      g: parseInt(h.slice(2, 4), 16) || 255,
      b: parseInt(h.slice(4, 6), 16) || 255,
      a: h.length >= 8 ? (parseInt(h.slice(6, 8), 16) || 255) / 255 : 1
    }
  }
  const m = input.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (!m) return { r: 255, g: 255, b: 255, a: 0.45 }
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 }
}

function hexColor(r: number, g: number, b: number): number {
  return (
    (Math.min(255, Math.max(0, Math.round(r))) << 16) |
    (Math.min(255, Math.max(0, Math.round(g))) << 8) |
    Math.min(255, Math.max(0, Math.round(b)))
  )
}

function cssColor(c: RgbaColor, alpha = c.a) {
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${clamp(alpha)})`
}

function mix(a: RgbaColor, b: RgbaColor, p: number): RgbaColor {
  const v = clamp(p)
  return {
    r: a.r + (b.r - a.r) * v,
    g: a.g + (b.g - a.g) * v,
    b: a.b + (b.b - a.b) * v,
    a: a.a + (b.a - a.a) * v
  }
}

function colorAtProgress(x: number) {
  if (!wordSpans.length) return hexColor(255, 255, 255)
  const sc = pc(playedColor || '#ff6b9d')
  const dc = pc(defaultColor || 'rgba(255,255,255,0.5)')
  const white = { r: 255, g: 255, b: 255, a: 1 }
  const now = smoothedTime

  for (const span of wordSpans) {
    if (x < span.startX || x > span.endX) continue
    const d = Math.max(1, span.e - span.s)
    const fillP = clamp((now - span.s) / d)
    const leadP = clamp((now - (span.s - PRELIGHT_MS)) / (d + PRELIGHT_MS))
    const local = clamp((x - span.startX) / Math.max(1, span.endX - span.startX))
    if (local <= fillP + 0.02) return hexColor(sc.r, sc.g, sc.b)
    if (local <= leadP + 0.03) {
      const c = mix(white, sc, clamp((local - fillP) / 0.28))
      return hexColor(c.r, c.g, c.b)
    }
    return hexColor(dc.r, dc.g, dc.b)
  }

  return hexColor(sc.r, sc.g, sc.b)
}

function makeText(text: string, fs: number, color: number, alpha: number, weight: any = '800') {
  const t = new PIXI.Text({
    text,
    style: {
      fontFamily: FONT,
      fontSize: fs,
      fontWeight: weight,
      fill: color,
      letterSpacing: 0
    }
  })
  t.anchor.set(0, 0.5)
  t.alpha = alpha
  return t
}

function initSweepResources() {
  if (!sweepCanvas) {
    sweepCanvas = new OffscreenCanvas(48, 2)
    sweepCtx = sweepCanvas.getContext('2d')
    sweepSource = new PIXI.CanvasSource({ resource: sweepCanvas })
    sweepTexture = new PIXI.Texture({ source: sweepSource })
    lastSweepScSig = ''
  }
}

function updateSweepGradient(sc: RgbaColor, glowAlpha: number) {
  if (!sweepCtx || !sweepTexture || !sweepSource) return
  const sig = `${sc.r},${sc.g},${sc.b},${sc.a}_${Math.round(glowAlpha * 8)}`
  if (sig === lastSweepScSig) return
  lastSweepScSig = sig

  const scSolid = { ...sc, a: 1 }
  const whiteStop = cssColor(mix({ r: 255, g: 255, b: 255, a: 1 }, scSolid, 1 - glowAlpha))

  sweepCtx.clearRect(0, 0, 48, 2)
  const grad = sweepCtx.createLinearGradient(0, 0, 48, 0)
  grad.addColorStop(0, cssColor(sc))
  grad.addColorStop(0.5, whiteStop)
  grad.addColorStop(1, cssColor({ ...sc, a: 0 }))
  sweepCtx.fillStyle = grad
  sweepCtx.fillRect(0, 0, 48, 2)

  sweepSource.update()
}

function clearLine() {
  if (currentMaskTexture) {
    try {
      currentMaskTexture.destroy(false)
    } catch {}
    currentMaskTexture = null
  }
  if (colorContainer && sweepSprite) {
    try {
      colorContainer.removeChild(sweepSprite)
    } catch {}
  }
  sweepSprite = null

  if (lineVisualContainer) {
    try {
      lineVisualContainer.destroy({ children: true })
    } catch {}
    lineVisualContainer = null
  }
  if (wipeGfx) {
    try {
      wipeGfx.destroy()
    } catch {}
    wipeGfx = null
  }
  if (wordContainer) wordContainer.removeChildren()
  baseText = null
  shadowText = null
  maskSprite = null
  colorContainer = null
  colorGfx = null
  transTextObj = null
  transShadowObj = null
  glowText = null
  wordSpans = []
  lineTotalW = 0
  lineBaseX = 0
  lastColorSig = ''
  lastSweepScSig = ''
  renderedPlayheadX = 0
  lastPlayheadRenderAt = 0
}

function updateTextColors(force = false) {
  const sig = `${defaultColor}|${playedColor}|${transColor}`
  if (!force && sig === lastColorSig) return
  lastColorSig = sig

  const dc = pc(defaultColor || 'rgba(255,255,255,0.5)')
  const sc = pc(playedColor || '#ff6b9d')
  const tc = pc(transColor || 'rgba(255,255,255,0.35)')

  if (baseText) {
    baseText.style.fill = hexColor(dc.r, dc.g, dc.b)
    baseText.alpha = dc.a
  }
  if (glowText && effect !== 'aurora') {
    glowText.style.fill = hexColor(sc.r, sc.g, sc.b)
    if (glowText.style.dropShadow && typeof glowText.style.dropShadow === 'object') {
      glowText.style.dropShadow.color = hexColor(sc.r, sc.g, sc.b)
    }
  }
  if (transTextObj) {
    transTextObj.style.fill = hexColor(tc.r, tc.g, tc.b)
    transTextObj.alpha = tc.a
  }
  if (interludeBaseText && interludeColorText) {
    interludeBaseText.style.fill = hexColor(dc.r, dc.g, dc.b)
    interludeBaseText.alpha = dc.a
    interludeColorText.style.fill = hexColor(sc.r, sc.g, sc.b)
    interludeColorText.alpha = sc.a
  }
  lastSweepScSig = ''
}

function setLine(line: LyricLine | null) {
  try {
    clearLine()
    if (!wordContainer || !line) return

    const words =
      line.words && line.words.length > 0
        ? line.words
        : [
            {
              word: line.lyric || '',
              startTime: line.startTime,
              endTime: line.endTime,
              romanWord: '',
              obscene: false
            }
          ]
    const text = words.map((w: any) => w.word).join('')
    if (!text) return

    const ctx = getOffCtx()
    const hasTrans = !!line.translatedLyric
    let fs = baseFontSize
    const minFs = 16

    // 智能自适应字号：同时检查主歌词宽度、翻译歌词宽度以及总高度！
    // 留出上下各 45px 的安全边距，防止各种特效（如 drop / flip / cinema）在上下位移或缩放时碰到画布边界截断
    const maxAllowedH = Math.max(120, CH - 90)

    while (fs > minFs) {
      ctx.font = `800 ${fs}px ${FONT}`
      const tw = ctx.measureText(text).width
      const tfs = hasTrans ? Math.max(12, Math.round(fs * 0.46)) : 0
      const gap = hasTrans ? Math.max(10, Math.round(fs * 0.18)) : 0
      const totalH = fs + (hasTrans ? (gap + tfs) : 0)

      let ttw = 0
      if (hasTrans && line.translatedLyric) {
        ctx.font = `500 ${tfs}px ${FONT}`
        ttw = ctx.measureText(line.translatedLyric).width
      }

      if (tw > CW - PAD_X * 2 || ttw > CW - PAD_X * 2 || totalH > maxAllowedH) {
        fs -= 2
      } else {
        break
      }
    }

    ctx.font = `800 ${fs}px ${FONT}`
    const tw = ctx.measureText(text).width

    lineFontSize = fs
    lineTotalW = tw
    lineBaseX = (CW - tw) / 2
    lineStartAt = performance.now()

    const tfs = hasTrans ? Math.max(12, Math.round(fs * 0.46)) : 0
    const gap = hasTrans ? Math.max(10, Math.round(fs * 0.18)) : 0
    const totalH = fs + (hasTrans ? (gap + tfs) : 0)
    const blockTop = (CH - totalH) / 2

    lineMainY = blockTop + fs * 0.5
    const transY = blockTop + fs + gap + tfs * 0.5

    // 1. Build word spans
    let cx = lineBaseX
    wordSpans = []
    for (let i = 0; i < words.length; i += 1) {
      const w = words[i]
      const ww = ctx.measureText(w.word).width
      wordSpans.push({
        startX: cx,
        endX: cx + ww,
        s: w.startTime,
        e: w.endTime
      })
      cx += ww
    }

    const dc = pc(defaultColor || 'rgba(255,255,255,0.5)')
    const tc = pc(transColor || 'rgba(255,255,255,0.35)')

    lineVisualContainer = new PIXI.Container()

    // Shadow
    shadowText = makeText(text, fs, 0x000000, 0.38, '800')
    shadowText.x = lineBaseX + fs * 0.025
    shadowText.y = lineMainY + fs * 0.055

    // Base unplayed text (created fully opaque first for mask generation)
    baseText = makeText(text, fs, 0xffffff, 1.0, '800')
    baseText.x = lineBaseX
    baseText.y = lineMainY

    // Generate alpha mask from baseText's fully opaque rendering texture
    if (currentMaskTexture) {
      try {
        currentMaskTexture.destroy(false)
      } catch {}
      currentMaskTexture = null
    }
    const maskTexture = app!.renderer.generateTexture(baseText)
    currentMaskTexture = maskTexture
    maskSprite = new PIXI.Sprite(maskTexture)
    maskSprite.x = lineBaseX
    maskSprite.y = lineMainY
    maskSprite.anchor.set(0, 0.5)

    // Adjust baseText to default unplayed colors and transparency
    baseText.style.fill = hexColor(dc.r, dc.g, dc.b)
    baseText.alpha = dc.a

    // Played color container masked by character paths
    colorContainer = new PIXI.Container()
    colorContainer.mask = maskSprite

    colorGfx = new PIXI.Graphics()

    initSweepResources()
    const bandH = Math.ceil(fs * 1.35)
    sweepSprite = new PIXI.Sprite(sweepTexture!)
    sweepSprite.width = 48
    sweepSprite.height = bandH
    sweepSprite.y = lineMainY - bandH / 2
    sweepSprite.visible = false

    colorContainer.addChild(colorGfx, sweepSprite)

    if (effect === 'glow' || effect === 'aurora') {
      // Static pre-rasterised glow (texture cached once per line; only alpha animates per frame)
      const scP = pc(playedColor || '#ff6b9d')
      // aurora uses a white glow layer that is tinted per frame (hue cycling)
      const scG = effect === 'aurora' ? { ...scP, r: 255, g: 255, b: 255 } : scP
      glowText = new PIXI.Text({
        text,
        style: {
          fontFamily: FONT,
          fontSize: fs,
          fontWeight: '800',
          fill: hexColor(scG.r, scG.g, scG.b),
          dropShadow: {
            color: hexColor(scG.r, scG.g, scG.b),
            alpha: 0.9,
            blur: Math.max(6, Math.round(fs * 0.22)),
            angle: 0,
            distance: 0
          }
        }
      })
      glowText.anchor.set(0, 0.5)
      glowText.x = lineBaseX
      glowText.y = lineMainY
      glowText.alpha = 0.35
      lineVisualContainer.addChild(shadowText, glowText, baseText, colorContainer, maskSprite)
    } else {
      lineVisualContainer.addChild(shadowText, baseText, colorContainer, maskSprite)
    }

    // Translation text
    if (hasTrans && line.translatedLyric) {
      ctx.font = `500 ${tfs}px ${FONT}`
      const ttw = ctx.measureText(line.translatedLyric).width
      const transX = (CW - ttw) / 2

      transShadowObj = makeText(line.translatedLyric, tfs, 0x000000, 0.32, '500')
      transShadowObj.x = transX + 1
      transShadowObj.y = transY + 2

      transTextObj = makeText(line.translatedLyric, tfs, hexColor(tc.r, tc.g, tc.b), tc.a, '500')
      transTextObj.x = transX
      transTextObj.y = transY

      lineVisualContainer.addChild(transShadowObj, transTextObj)
    }

    wordContainer.addChild(lineVisualContainer)
    updateTextColors(true)
  } catch (err) {
    console.error('[subtitles.worker] Error in setLine:', err)
  }
}

function updateGlowLayer() {
  if (!glowText) return
  const t = performance.now()
  const age = t - lineStartAt
  if ((effect as any) === 'neon') {
    // neon-sign flicker while powering on, then a steady hum
    if (age < 800) {
      const on = Math.sin(age * 0.09) + Math.sin(age * 0.23 + 1.3) > -0.4 || age > 650
      glowText!.alpha = on ? 0.55 + 0.3 * (age / 800) : 0.05
    } else {
      glowText!.alpha = 0.78 + 0.07 * Math.sin(t * 0.004)
    }
  } else if (effect === 'aurora') {
    glowText.tint = hslHex((t * 0.00006 + currentPlayheadX / (CW * 1.6)) % 1, 0.85, 0.62)
    glowText.alpha = 0.62 + 0.12 * Math.sin(t * 0.002)
  } else {
    glowText.alpha = 0.32 + 0.18 * (0.5 + 0.5 * Math.sin(t * 0.003))
  }
}

function resetContainerTransform() {
  if (!wordContainer) return
  wordContainer.x = CW / 2
  wordContainer.y = CH / 2
  wordContainer.scale.set(1)
}

function applyEnterTransform(raw: number, enter: number) {
  if (!wordContainer) return
  let a = enter
  let dx = 0
  let dy = 0
  let sc = 1
  let scY: number | undefined
  switch (effect) {
    case 'fade':
      dy = (1 - enter) * 8
      break
    case 'pop': {
      const b = easeOutBack(clamp(raw))
      a = clamp(raw * 2.2)
      sc = 0.72 + 0.28 * b
      break
    }
    case 'slide':
      dx = -(1 - enter) * 90
      break
    case 'cinema':
      // letter-spacing style "focus in": starts wide + faint, tightens to normal
      a = clamp(raw * 1.6)
      sc = 1.22 - 0.22 * easeOutCubic(clamp(raw))
      break
    case 'drop':
      dy = -(1 - easeOutBounce(clamp(raw))) * 120
      a = clamp(raw * 4)
      break
    case 'flip':
      a = clamp(raw * 2.5)
      scY = Math.max(0.02, easeOutBack(clamp(raw)))
      break

    case 'aurora':
      sc = 0.985 + 0.015 * enter
      break
    case 'bubble':
      dy = (1 - enter) * 14
      break
    case 'glow':
      sc = 0.96 + 0.04 * enter
      break
    case 'sparkle':
      dy = (1 - enter) * 10
      sc = 0.97 + 0.03 * enter
      break
    default:
      dy = (1 - enter) * 18
      sc = 0.985 + enter * 0.015
  }
  wordContainer.alpha = a
  wordContainer.x = CW / 2 + dx
  wordContainer.y = CH / 2 + dy
  wordContainer.scale.set(sc, scY ?? sc)
}

function updateKaraoke() {
  const now = smoothedTime
  const enter = easeOutCubic(clamp((performance.now() - lineStartAt) / ENTER_DUR))

  if (wordContainer) {
    applyEnterTransform(clamp((performance.now() - lineStartAt) / ENTER_DUR), enter)
  }
  if (glowText) {
    updateGlowLayer()
  }

  let playheadX = lineBaseX
  if (wordSpans.length > 0) {
    for (const span of wordSpans) {
      if (now < span.s) {
        playheadX = span.startX
        break
      }
      if (now <= span.e) {
        const ratio = clamp((now - span.s) / Math.max(1, span.e - span.s))
        playheadX = span.startX + (span.endX - span.startX) * ratio
        break
      }
      playheadX = span.endX
    }
  }

  const renderNow = performance.now()
  if (!lastPlayheadRenderAt || renderedPlayheadX === 0) {
    renderedPlayheadX = playheadX
  } else {
    const elapsed = Math.min(80, renderNow - lastPlayheadRenderAt)
    const follow = 1 - Math.exp(-elapsed / 70)
    renderedPlayheadX += (playheadX - renderedPlayheadX) * follow
  }
  lastPlayheadRenderAt = renderNow
  playheadX = renderedPlayheadX
  currentPlayheadX = playheadX

  const startX = Math.max(0, playheadX - 24)
  const midX = playheadX
  const endX = playheadX + 24

  const sc = pc(playedColor || '#ff6b9d')

  // Adjust white sweep intensity as it approaches the end of the line (fade to playedColor)
  const distToEnd = lineBaseX + lineTotalW - playheadX
  const glowAlpha = clamp(distToEnd / 44)

  updateSweepGradient(sc, glowAlpha)

  // 1. Played solid part (playedColor), tightly bounded to the text band
  if (colorGfx) {
    colorGfx.clear()
    if (startX > lineBaseX && playheadX > lineBaseX) {
      const bandH = Math.ceil(lineFontSize * 1.35)
      colorGfx
        .rect(lineBaseX, lineMainY - bandH / 2, startX - lineBaseX, bandH)
        .fill({ color: hexColor(sc.r, sc.g, sc.b), alpha: sc.a })
    }
  }

  // 2. Sweeping light gradient (48px transition: playedColor -> whiteStop -> transparent)
  if (sweepSprite) {
    if (endX > startX && playheadX > lineBaseX && playheadX < lineBaseX + lineTotalW + 36) {
      sweepSprite.visible = true
      sweepSprite.x = startX
    } else {
      sweepSprite.visible = false
    }
  }
}

function spawnWindParticles() {
  try {
    allWindCandidates = []
    particles = []
    const line = ci >= 0 ? lyricLines[ci] : null
    if (!line) return

    const ctx = getOffCtx()
    ctx.clearRect(0, 0, CW, CH)

    // 1. Draw main lyric
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = `800 ${lineFontSize}px ${FONT}`
    ctx.fillStyle = '#ffffff'
    const words = line.words && line.words.length > 0 ? line.words : []
    const text = words.length > 0 ? words.map((w: any) => w.word).join('') : (line.lyric || '')
    ctx.fillText(text, lineBaseX, lineMainY)

    // 2. Draw translation
    if (transTextObj && line.translatedLyric) {
      const tfs = Number(transTextObj.style.fontSize) || Math.round(lineFontSize * 0.46)
      ctx.font = `500 ${tfs}px ${FONT}`
      ctx.fillText(line.translatedLyric, transTextObj.x, transTextObj.y)
    }

    const bx = Math.max(0, Math.floor(lineBaseX - 8))
    const by = Math.max(0, Math.floor(lineMainY - lineFontSize * 0.7))
    const bw = Math.min(CW - bx, Math.max(1, Math.ceil(lineTotalW + 16)))
    const bh = Math.min(CH - by, Math.max(1, Math.ceil(lineFontSize * (transTextObj ? 2.1 : 1.4))))
    const img = ctx.getImageData(bx, by, bw, bh).data
    const step = 4
    const maxCandidates = 420

    for (let ry = 0; ry < bh; ry += step) {
      for (let rx = 0; rx < bw; rx += step) {
        const x = bx + rx
        const y = by + ry
        const index = (ry * bw + rx) * 4
        const alpha = img[index + 3]
        if (alpha <= 42) continue

        let pColor = hexColor(255, 255, 255)
        if (transTextObj && y > lineMainY + lineFontSize * 0.4) {
          const tc = pc(transColor || 'rgba(255,255,255,0.35)')
          pColor = hexColor(tc.r, tc.g, tc.b)
        } else {
          pColor = colorAtProgress(x)
        }

        const gust = 0.5 + Math.random() * 1.5
        if (allWindCandidates.length >= maxCandidates) continue
        allWindCandidates.push({
          x,
          y,
          tx: x,
          ty: y,
          vx: (3.0 + Math.random() * 4.0) * gust,
          vy: -(1.5 + Math.random() * 3.0) * gust,
          spin: (Math.random() - 0.5) * 0.22,
          a: 0.85 + Math.random() * 0.15,
          sz: 0.6 + Math.random() * 1.2,
          c: pColor,
          life: 0.28 + Math.random() * 0.22,
          age: 0
        })
      }
    }

    lastEraseX = lineBaseX - 20
  } catch (err) {
    console.error('[subtitles.worker] Error in spawnWindParticles:', err)
  }
}

function updateSingleParticle(p: Particle, dt: number, _now: number) {
  p.age += dt

  const angle = -0.55 + Math.sin(p.x * 0.012 + p.age * 0.09 + p.spin * 12) * 0.52
  p.vx += Math.cos(angle) * 0.3 * dt
  p.vy += Math.sin(angle) * 0.25 * dt

  p.x += p.vx * dt
  p.y += p.vy * dt
  p.sz *= Math.pow(0.978, dt)

  let edgeAlpha = 1.0
  const marginX = 90
  const marginY = 70
  if (p.x > CW - marginX) {
    edgeAlpha *= clamp((CW - p.x) / marginX)
  }
  if (p.x < 40) {
    edgeAlpha *= clamp((p.x - 40) / 40)
  }
  if (p.y < marginY) {
    edgeAlpha *= clamp(p.y / marginY)
  }
  if (p.y > CH - 40) {
    edgeAlpha *= clamp((CH - p.y) / 40)
  }

  p.a = Math.max(0, (1.0 - p.age / (p.life * 60)) * edgeAlpha)
}

function finishDissolve() {
  dissolving = false
  particles = []
  allWindCandidates = []
  particleGfx?.clear()
  resetContainerTransform()
  const targetIdx = pendingIdx >= 0 ? pendingIdx : findLineIndex(smoothedTime)
  ci = targetIdx
  pendingIdx = -1
  if (ci >= 0 && ci < lyricLines.length) {
    setLine(lyricLines[ci])
  } else {
    clearLine()
  }
}

// Lightweight exit used by every non-wind effect: only container alpha/transform change
function updateSoftDissolve(now: number) {
  const progress = clamp((now - dissStart) / SOFT_EXIT_DUR)
  const e = easeInOut(progress)
  if (wordContainer) {
    wordContainer.alpha = 1 - e
    switch (effect) {
      case 'pop':
        wordContainer.scale.set(1 + 0.08 * e)
        break
      case 'slide':
        wordContainer.x = CW / 2 + 70 * e
        break
      case 'drop':
        wordContainer.y = CH / 2 + 26 * e
        break
      case 'flip':
        wordContainer.scale.set(1, Math.max(0.02, 1 - e))
        break
      case 'cinema':
        wordContainer.scale.set(1 - 0.06 * e)
        break
      case 'sparkle':
        wordContainer.y = CH / 2 - 12 * e
        break
      default:
        wordContainer.y = CH / 2 - 8 * e
    }
  }
  if (progress >= 1) finishDissolve()
}

function updateDissolve(dt: number, now: number) {
  if (effect !== 'wind') {
    updateSoftDissolve(now)
    return
  }
  try {
    const progress = clamp((now - dissStart) / DISS_DUR)
    const wipe = easeInOut(progress)

    const eraseX = lineBaseX + (lineTotalW + 120) * wipe

    if (allWindCandidates.length > 0) {
      for (const c of allWindCandidates) {
        if (c.tx >= lastEraseX && c.tx < eraseX) {
          particles.push({
            ...c,
            x: c.tx + (Math.random() - 0.5) * 2,
            y: c.ty + (Math.random() - 0.5) * 2
          })
        }
      }
      lastEraseX = eraseX
    }

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i]
      updateSingleParticle(p, dt, now)
      if (p.a <= 0 || p.x > CW || p.y < 0) {
        particles.splice(i, 1)
      }
    }

    if (wipeGfx) {
      wipeGfx.clear()
      if (eraseX < CW) {
        wipeGfx.rect(eraseX, 0, CW - eraseX, CH).fill({ color: 0xffffff, alpha: 1 })
      }
    }

    if (wordContainer) {
      wordContainer.alpha = clamp(1 - (progress - 0.7) / 0.3)
    }

    if (progress >= 1) finishDissolve()
  } catch (err) {
    console.error('[subtitles.worker] Error in updateDissolve:', err)
    dissolving = false
  }
}

function drawParticles() {
  if (!particleGfx) return
  particleGfx.clear()
  if (!particles.length) return

  const buckets = new Map<number, Particle[]>()
  for (const p of particles) {
    if (p.a < 0.015) continue
    const alphaBucket = Math.min(9, Math.max(0, Math.round(p.a * 9)))
    const key = p.c * 10 + alphaBucket
    let list = buckets.get(key)
    if (!list) {
      list = []
      buckets.set(key, list)
    }
    list.push(p)
  }

  buckets.forEach((list, key) => {
    const color = Math.floor(key / 10)
    const alpha = ((key % 10) + 1) / 10
    particleGfx!.beginPath()
    for (const p of list) particleGfx!.circle(p.x, p.y, p.sz)
    particleGfx!.fill({ color, alpha })
  })
}

// Twinkling 4-point stars around the playhead. 10 tiny shapes, one Graphics clear per frame.
function drawSparkles(now: number) {
  if (!ambientGfx) return
  const sc = pc(playedColor || '#ff6b9d')
  const lit = mix({ ...sc, a: 1 }, { r: 255, g: 255, b: 255, a: 1 }, 0.6)
  const color = hexColor(lit.r, lit.g, lit.b)
  ambientGfx.clear()
  const n = 10
  for (let i = 0; i < n; i += 1) {
    const phase = (now * 0.0011 + i * 0.173) % 1
    const tw = Math.sin(phase * Math.PI)
    if (tw <= 0.02) continue
    const seed = Math.sin(i * 12.9898 + Math.floor(now * 0.0011 + i * 0.173) * 78.233) * 43758.5453
    const rnd = seed - Math.floor(seed)
    const rnd2 = (rnd * 7.31) % 1
    const x = currentPlayheadX + (rnd - 0.5) * lineFontSize * 3
    const y = lineMainY + (rnd2 - 0.5) * lineFontSize * 1.5 - phase * 10
    const r = (2 + (i % 3) * 1.6) * tw
    ambientGfx
      .poly([x, y - r * 2, x + r * 0.45, y - r * 0.45, x + r * 2, y, x + r * 0.45, y + r * 0.45, x, y + r * 2, x - r * 0.45, y + r * 0.45, x - r * 2, y, x - r * 0.45, y - r * 0.45])
      .fill({ color, alpha: 0.85 * tw })
  }
}

// Rising translucent bubbles under/around the line. 14 stroked circles, no textures.
function drawBubbles(now: number) {
  if (!ambientGfx) return
  const sc = pc(playedColor || '#ff6b9d')
  const lit = mix({ ...sc, a: 1 }, { r: 255, g: 255, b: 255, a: 1 }, 0.55)
  const color = hexColor(lit.r, lit.g, lit.b)
  ambientGfx.clear()
  const n = 14
  const span = Math.max(200, lineTotalW)
  const rise = lineFontSize * 1.9
  for (let i = 0; i < n; i += 1) {
    const period = 2600 + (i % 5) * 450
    const p = ((now + i * 377) % period) / period
    const x =
      lineBaseX + ((i * 0.6180339) % 1) * span + Math.sin(now * 0.002 + i * 1.7) * 8
    const y = lineMainY + lineFontSize * 0.55 - p * rise
    const r = 2.5 + (i % 4) * 1.6
    const fade = Math.sin(p * Math.PI)
    ambientGfx.circle(x, y, r).stroke({ color, width: 1.2, alpha: 0.5 * fade })
    ambientGfx.circle(x - r * 0.3, y - r * 0.3, r * 0.22).fill({ color, alpha: 0.45 * fade })
  }
}

function drawAmbient(now: number) {
  if (!ambientGfx || !wordSpans.length || dissolving || (effect !== 'wind' && effect !== 'sparkle' && effect !== 'bubble')) {
    ambientGfx?.clear()
    return
  }

  if (effect === 'sparkle') {
    drawSparkles(now)
    return
  }
  if (effect === 'bubble') {
    drawBubbles(now)
    return
  }

  const sc = pc(playedColor || '#ff6b9d')

  ambientGfx.clear()
  for (let i = 0; i < 7; i += 1) {
    const drift = (now * 0.025 + i * 37) % (lineFontSize * 2.2)
    const x = currentPlayheadX - lineFontSize * 0.7 + drift
    const y = lineMainY + Math.sin(now * 0.0018 + i) * lineFontSize * 0.24
    ambientGfx.circle(x, y, 1.1 + (i % 3) * 0.45).fill({
      color: hexColor(
        mix({ ...sc, a: 1 }, { r: 255, g: 255, b: 255, a: 1 }, 0.45).r,
        mix({ ...sc, a: 1 }, { r: 255, g: 255, b: 255, a: 1 }, 0.45).g,
        mix({ ...sc, a: 1 }, { r: 255, g: 255, b: 255, a: 1 }, 0.45).b
      ),
      alpha: 0.08 + (i % 2) * 0.05
    })
  }
}

function checkInterlude() {
  if (dissolving || ci >= 0) return false
  const t = smoothedTime

  let nextIdx = -1
  for (let i = 0; i < lyricLines.length; i++) {
    if (lyricLines[i].startTime > t) {
      nextIdx = i
      break
    }
  }

  if (nextIdx >= 0) {
    const nextLine = lyricLines[nextIdx]
    const prevLine = nextIdx > 0 ? lyricLines[nextIdx - 1] : null
    const prevEnd = prevLine ? prevLine.endTime : 0
    const totalGap = nextLine.startTime - prevEnd

    if (totalGap >= 3000) {
      const remaining = nextLine.startTime - t
      if (remaining > 800) {
        return true
      }
    }
  }
  return false
}

function drawInterlude(_now: number, dt: number) {
  if (!interludeContainer || !interludeColorGfx) return

  const show = checkInterlude()
  if (show) {
    interludeContainer.alpha = Math.min(1.0, interludeContainer.alpha + 0.06 * dt)
  } else {
    interludeContainer.alpha = Math.max(0.0, interludeContainer.alpha - 0.1 * dt)
  }

  if (interludeContainer.alpha <= 0) return

  const t = smoothedTime
  let prevEnd = 0
  let nextStart = 0
  for (let i = 0; i < lyricLines.length; i++) {
    const l = lyricLines[i]
    if (l.startTime > t) {
      nextStart = l.startTime
      if (i > 0) prevEnd = lyricLines[i - 1].endTime
      break
    }
  }

  const duration = Math.max(1, nextStart - prevEnd)
  const ratio = clamp((t - prevEnd) / duration)

  const startX = CW / 2 - 70
  const endX = CW / 2 + 70
  const sweepX = startX + (endX - startX) * ratio

  interludeColorGfx.clear()
  if (sweepX > 0) {
    interludeColorGfx.rect(0, 0, sweepX, CH).fill({ color: 0xffffff, alpha: 1 })
  }
}

function tick() {
  raf = null
  if (!app) return
  const now = performance.now()
  const elapsedRaw = lastFrameTime ? now - lastFrameTime : 16.67
  if (lastFrameTime && elapsedRaw < 15) {
    raf = requestAnimationFrame(tick)
    return
  }
  const elapsed = Math.min(elapsedRaw, 100)
  lastFrameTime = now
  const dt = Math.max(0.2, Math.min(elapsed / 16.67, 3))

  const target = smoothTime()
  const diff = target - smoothedTime

  if (smoothedTime === 0 || diff < -400 || diff > 1500) {
    smoothedTime = target
  } else {
    if (diff > 0) {
      smoothedTime = target
    } else if (isPlaying) {
      const increment = Math.max(0, elapsed + diff * 0.1)
      smoothedTime += increment
    }
  }

  // 核心：在每帧 tick 时根据 smoothedTime 主动检测歌词行切换
  if (!dissolving) {
    const ni = findLineIndex(smoothedTime)
    if (ni !== ci) {
      transitionTo(ni)
    }
  }

  updateTextColors()
  if (dissolving) updateDissolve(dt, now)
  else {
    updateKaraoke()

    if (particles.length > 0) {
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i]
        updateSingleParticle(p, dt, now)
        if (p.a <= 0 || p.x > CW || p.y < 0) {
          particles.splice(i, 1)
        }
      }
    }
  }

  drawAmbient(now)
  drawInterlude(now, dt)
  drawParticles()

  try {
    app.render()
  } catch {}

  // 休眠判定：当播放暂停，且既无粒子飞散也无淡出过渡、间奏点未激活时，停止循环，完全释放计算资源
  const isIdle =
    !isPlaying &&
    !dissolving &&
    particles.length === 0 &&
    (!interludeContainer || interludeContainer.alpha <= 0)

  if (!isIdle) {
    raf = requestAnimationFrame(tick)
  }
}

function wakeTick() {
  if (!app) return
  if (!raf) {
    raf = requestAnimationFrame(tick)
  }
}

function findLineIndex(t: number) {
  for (let i = lyricLines.length - 1; i >= 0; i -= 1) {
    const l = lyricLines[i]
    const nextLine = i < lyricLines.length - 1 ? lyricLines[i + 1] : null
    const leadTime = 600
    const prevEnd = i > 0 ? Math.min(lyricLines[i - 1].endTime, l.startTime) : 0
    const startToShow = i > 0 ? Math.max(l.startTime - leadTime, prevEnd) : l.startTime - leadTime
    const endToShow = nextLine
      ? Math.max(l.endTime, Math.min(nextLine.startTime - leadTime, l.endTime + 800))
      : l.endTime + 3000
    if (t >= startToShow && t <= endToShow) return i
  }
  return -1
}

function transitionTo(idx: number) {
  wakeTick()
  if (idx === ci && !dissolving) return
  if (dissolving) {
    pendingIdx = idx
    return
  }

  if (ci >= 0 && wordSpans.length > 0 && lineVisualContainer) {
    dissolving = true
    dissStart = performance.now()
    pendingIdx = idx

    if (effect === 'wind') {
      // 附着 dissolve wipe 蒙版，使整行文字随风向右消散
      if (!wipeGfx) {
        wipeGfx = new PIXI.Graphics()
        wordContainer?.addChild(wipeGfx)
      }
      wipeGfx.clear()
      wipeGfx.rect(0, 0, CW, CH).fill({ color: 0xffffff, alpha: 1 })
      lineVisualContainer.mask = wipeGfx

      spawnWindParticles()
    }
  } else {
    ci = idx
    if (idx >= 0 && idx < lyricLines.length) setLine(lyricLines[idx])
    else clearLine()
  }
}

function onUpdateTime(t: number, playing: boolean) {
  isPlaying = playing
  const now = performance.now()
  if (isPlaying && smoothedTime > 0) {
    const correction = t - smoothedTime
    if (Math.abs(correction) > 2000) {
      smoothedTime = t
      baseTime = t
      dissolving = false
      particles = []
      const ni = findLineIndex(smoothedTime)
      ci = ni
      if (ci >= 0 && ci < lyricLines.length) setLine(lyricLines[ci])
      else clearLine()
      wakeTick()
      return
    } else {
      baseTime = smoothedTime + Math.max(-220, Math.min(220, correction))
    }
  } else {
    smoothedTime = t
    baseTime = t
  }
  lastUpdateTime = now
  wakeTick()
  if (!dissolving) {
    const ni = findLineIndex(smoothedTime)
    if (ni !== ci) {
      transitionTo(ni)
    }
  }
}

function onUpdatePlaying(playing: boolean, currentTime: number) {
  isPlaying = playing
  if (playing) {
    lastUpdateTime = performance.now()
    lastFrameTime = performance.now()
    baseTime = currentTime
    wakeTick()
  } else {
    lastUpdateTime = 0
  }
}

function onUpdateLyricLines(lines: LyricLine[], currentTime: number) {
  lyricLines = lines
  ci = -1
  pendingIdx = -1
  particles = []
  dissolving = false
  clearLine()
  const idx = findLineIndex(currentTime)
  if (idx >= 0) {
    ci = idx
    setLine(lyricLines[idx])
  }
  wakeTick()
}

function onUpdateColors(pc?: string, dc?: string, tc?: string) {
  if (pc !== undefined) playedColor = pc
  if (dc !== undefined) defaultColor = dc
  if (tc !== undefined) transColor = tc
  updateTextColors(true)
  wakeTick()
}

function onUpdateEffect(next?: string) {
  const ne = normalizeEffect(next)
  if (ne === effect) return
  effect = ne
  dissolving = false
  pendingIdx = -1
  particles = []
  allWindCandidates = []
  particleGfx?.clear()
  ambientGfx?.clear()
  resetContainerTransform()
  if (ci >= 0 && ci < lyricLines.length) setLine(lyricLines[ci])
  wakeTick()
}

function onUpdateFontSize(fontSize: number) {
  if (fontSize === baseFontSize) return
  baseFontSize = fontSize
  if (interludeBaseText && interludeColorText) {
    interludeBaseText.style.fontSize = Math.round(fontSize * 0.85)
    interludeColorText.style.fontSize = Math.round(fontSize * 0.85)
  }
  if (ci >= 0 && ci < lyricLines.length) {
    setLine(lyricLines[ci])
  }
  wakeTick()
}

async function init(canvas: OffscreenCanvas, msg: SubtitlesWorkerInitMessage) {
  CW = msg.CW
  CH = msg.CH
  baseFontSize = msg.baseFontSize
  effect = normalizeEffect(msg.effect)
  if (msg.playedColor) playedColor = msg.playedColor
  if (msg.defaultColor) defaultColor = msg.defaultColor
  if (msg.transColor) transColor = msg.transColor
  lyricLines = msg.lyricLines || []
  isPlaying = msg.playing
  baseTime = msg.currentTime
  smoothedTime = msg.currentTime
  lastFrameTime = performance.now()

  if (PIXI.WebWorkerAdapter) {
    PIXI.DOMAdapter.set(PIXI.WebWorkerAdapter)
  }

  if (canvas) {
    if (!('style' in canvas)) {
      ;(canvas as any).style = {}
    }
    if (!(canvas as any).addEventListener) {
      ;(canvas as any).addEventListener = () => {}
      ;(canvas as any).removeEventListener = () => {}
      ;(canvas as any).dispatchEvent = () => false
    }
  }

  app = new PIXI.Application()
  await app.init({
    canvas,
    width: CW,
    height: CH,
    backgroundAlpha: 0,
    antialias: false,
    resolution: 1,
    autoDensity: true,
    preference: 'webgl',
    eventMode: 'none',
    autoStart: false,
    eventFeatures: {
      move: false,
      globalMove: false,
      click: false,
      wheel: false
    }
  })

  ambientGfx = new PIXI.Graphics()
  wordContainer = new PIXI.Container()
  // Pivot at canvas centre so scale/pop effects grow from the middle of the subtitle
  wordContainer.pivot.set(CW / 2, CH / 2)
  wordContainer.position.set(CW / 2, CH / 2)
  particleGfx = new PIXI.Graphics()

  interludeContainer = new PIXI.Container()
  interludeContainer.alpha = 0

  interludeBaseText = makeText(
    '· · ·',
    Math.round(baseFontSize * 0.85),
    0xffffff,
    0.45,
    '800'
  )
  interludeBaseText.anchor.set(0.5, 0.5)
  interludeBaseText.x = CW / 2
  interludeBaseText.y = CH / 2

  interludeColorText = makeText(
    '· · ·',
    Math.round(baseFontSize * 0.85),
    0xffffff,
    1.0,
    '800'
  )
  interludeColorText.anchor.set(0.5, 0.5)
  interludeColorText.x = CW / 2
  interludeColorText.y = CH / 2

  interludeColorGfx = new PIXI.Graphics()
  interludeColorText.mask = interludeColorGfx

  interludeContainer.addChild(interludeBaseText, interludeColorText, interludeColorGfx)
  app.stage.addChild(ambientGfx, wordContainer, particleGfx, interludeContainer)

  const idx = findLineIndex(msg.currentTime)
  if (idx >= 0) {
    ci = idx
    setLine(lyricLines[idx])
  }
  if (isPlaying) {
    lastUpdateTime = performance.now()
  }
  wakeTick()
}

function destroy() {
  if (raf) cancelAnimationFrame(raf)
  raf = null
  try {
    app?.destroy(true)
  } catch {}
  app = null
  clearLine()
  if (sweepTexture) {
    try {
      sweepTexture.destroy(true)
    } catch {}
    sweepTexture = null
  }
  sweepSource = null
  sweepCanvas = null
  sweepCtx = null
  wordContainer = null
  particleGfx = null
  ambientGfx = null
  interludeContainer = null
  interludeBaseText = null
  interludeColorText = null
  interludeColorGfx = null
  particles = []
  allWindCandidates = []
  offCvs = null
  offCtx = null
  lastUpdateTime = 0
  baseTime = 0
  smoothedTime = 0
  ci = -1
  pendingIdx = -1
  dissolving = false
  glowText = null
}

self.onmessage = async (e: MessageEvent<SubtitlesWorkerMessage>) => {
  const msg = e.data
  if (msg.type === 'init') {
    try {
      initPromise = init(msg.canvas, msg)
      await initPromise
      isInitialized = true
    } catch (err) {
      console.error('[subtitles.worker] Failed to initialize Pixi worker:', err)
    }
    return
  }
  if (initPromise) {
    try {
      await initPromise
    } catch {
      return
    }
  }
  if (!isInitialized) return

  switch (msg.type) {
    case 'updateTime':
      onUpdateTime(msg.currentTime, msg.playing)
      break
    case 'updatePlaying':
      onUpdatePlaying(msg.playing, msg.currentTime)
      break
    case 'updateLyricLines':
      onUpdateLyricLines(msg.lyricLines, msg.currentTime)
      break
    case 'updateColors':
      onUpdateColors(msg.playedColor, msg.defaultColor, msg.transColor)
      break
    case 'updateFontSize':
      onUpdateFontSize(msg.fontSize)
      break
    case 'updateEffect':
      onUpdateEffect(msg.effect)
      break
    case 'destroy':
      destroy()
      break
  }
}

self.onerror = (e) => {
  console.error('[subtitles.worker] Uncaught worker error:', e)
}
