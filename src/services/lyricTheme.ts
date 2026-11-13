import { extractMainColors } from './octree'

interface RgbColor {
  r: number
  g: number
  b: number
}

interface LyricThemeDebugInfo {
  coverUrl?: string
  paletteSize: number
  backgroundColor: string
  selectedThemeColor: string
  adjustedThemeColor: string
  playedColor: string
  selectedContrastRatio: number
  adjustedContrastRatio: number
  backgroundBrightness: number
  selectedThemeBrightness: number
  adjustedThemeBrightness: number
  backgroundSaturation: number
  selectedThemeSaturation: number
  adjustedThemeSaturation: number
}

export interface LyricTheme {
  playedColor: string
  textShadow: string
}

export const defaultLyricTheme: LyricTheme = {
  playedColor: 'rgba(255, 255, 255, 0.98)',
  textShadow: '0 0 0.2em rgba(0, 0, 0, 0.32), 0 0 0.8em rgba(0, 0, 0, 0.18)'
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function toCssColor(color: RgbColor, alpha = 1): string {
  return `rgba(${clampChannel(color.r)}, ${clampChannel(color.g)}, ${clampChannel(color.b)}, ${alpha})`
}

function toHexColor(color: RgbColor): string {
  return `#${clampChannel(color.r).toString(16).padStart(2, '0')}${clampChannel(color.g)
    .toString(16)
    .padStart(2, '0')}${clampChannel(color.b).toString(16).padStart(2, '0')}`
}

function hexToRgb(hex: string): RgbColor | undefined {
  const normalized = hex.trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return undefined
  }
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  }
}

function mixColors(source: RgbColor, target: RgbColor, amount: number): RgbColor {
  const ratio = Math.max(0, Math.min(1, amount))
  return {
    r: source.r + (target.r - source.r) * ratio,
    g: source.g + (target.g - source.g) * ratio,
    b: source.b + (target.b - source.b) * ratio
  }
}

function getRelativeLuminance(color: RgbColor): number {
  const toLinear = (channel: number) => {
    const normalized = channel / 255
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * toLinear(color.r) + 0.7152 * toLinear(color.g) + 0.0722 * toLinear(color.b)
}

function getBrightness(color: RgbColor): number {
  return (color.r * 299 + color.g * 587 + color.b * 114) / 255000
}

function getContrastRatio(foreground: RgbColor, background: RgbColor): number {
  const fg = getRelativeLuminance(foreground)
  const bg = getRelativeLuminance(background)
  const lighter = Math.max(fg, bg)
  const darker = Math.min(fg, bg)
  return (lighter + 0.05) / (darker + 0.05)
}

function getSaturation(color: RgbColor): number {
  const r = color.r / 255
  const g = color.g / 255
  const b = color.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)

  if (max === min) {
    return 0
  }

  const lightness = (max + min) / 2
  return (max - min) / (1 - Math.abs(2 * lightness - 1))
}

function getColorDistance(a: RgbColor, b: RgbColor): number {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function getAverageColor(pixels: Array<[number, number, number]>): RgbColor {
  if (pixels.length === 0) {
    return { r: 20, g: 20, b: 24 }
  }

  const total = pixels.reduce(
    (acc, [r, g, b]) => {
      acc.r += r
      acc.g += g
      acc.b += b
      return acc
    },
    { r: 0, g: 0, b: 0 }
  )

  return {
    r: total.r / pixels.length,
    g: total.g / pixels.length,
    b: total.b / pixels.length
  }
}

function normalizeAccentColor(color: RgbColor, background: RgbColor): RgbColor {
  let adjusted = color
  const backgroundLuminance = getRelativeLuminance(background)
  const readableTarget =
    backgroundLuminance > 0.45 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 }

  for (let step = 0; step < 12 && getContrastRatio(adjusted, background) < 3.1; step += 1) {
    adjusted = mixColors(adjusted, readableTarget, 0.08)
  }

  return adjusted
}

interface HslColor {
  h: number
  s: number
  l: number
}

function rgbToHsl(r: number, g: number, b: number): HslColor {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }
  return { h, s, l }
}

function hslToRgb(h: number, s: number, l: number): RgbColor {
  let r = 0
  let g = 0
  let b = 0

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}

function brightenThemeColor(color: RgbColor): RgbColor {
  const hsl = rgbToHsl(color.r, color.g, color.b)
  
  // Vivid saturation clamp (force saturation to be vivid)
  hsl.s = Math.max(0.78, hsl.s)
  
  // Lightness clamp: Keep it bright but strictly not washed-out/white, and not dark
  hsl.l = Math.max(0.50, Math.min(0.68, hsl.l))
  
  return hslToRgb(hsl.h, hsl.s, hsl.l)
}

function pickVividAccent(hexColors: string[]): RgbColor | undefined {
  let bestColor: RgbColor | undefined
  let bestScore = Number.NEGATIVE_INFINITY

  hexColors.forEach((hexColor, index) => {
    const candidate = hexToRgb(hexColor)
    if (!candidate) {
      return
    }

    const saturation = getSaturation(candidate)
    const brightness = getBrightness(candidate)
    if (saturation < 0.18 || brightness < 0.22 || brightness > 0.92) {
      return
    }

    const dominanceScore = Math.max(hexColors.length - index, 1) * 0.12
    const score = brightness * 6.4 + saturation * 4.2 + dominanceScore

    if (score > bestScore) {
      bestScore = score
      bestColor = candidate
    }
  })

  return bestColor
}

async function loadCoverImage(url: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.decoding = 'async'
  image.src = url

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('封面加载失败'))
  })

  return image
}

export async function extractLyricThemeFromCover(coverUrl?: string): Promise<LyricTheme> {
  if (!coverUrl) {
    return defaultLyricTheme
  }

  try {
    const image = await loadCoverImage(coverUrl)
    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    if (!width || !height) {
      return defaultLyricTheme
    }

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      return defaultLyricTheme
    }

    const maxEdge = 64
    const scale = Math.min(maxEdge / width, maxEdge / height, 1)
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    const pixels = imageData.data
    const backgroundPixels: Array<[number, number, number]> = []
    const themePixels: Array<[number, number, number]> = []

    for (let index = 0; index < pixels.length; index += 4) {
      const r = pixels[index]
      const g = pixels[index + 1]
      const b = pixels[index + 2]
      const alpha = pixels[index + 3]

      if (alpha < 96) {
        continue
      }

      backgroundPixels.push([r, g, b])

      if (r < 30 && g < 30 && b < 30) {
        continue
      }
      if (r > 240 && g > 240 && b > 240) {
        continue
      }

      themePixels.push([r, g, b])
    }

    if (backgroundPixels.length === 0) {
      return defaultLyricTheme
    }

    const backgroundColor = getAverageColor(backgroundPixels)
    const paletteSource = themePixels.length >= 10 ? themePixels : backgroundPixels
    const palette = extractMainColors(paletteSource, 8)
    const rawThemeColor =
      pickVividAccent(palette) ?? mixColors(backgroundColor, { r: 255, g: 255, b: 255 }, 0.12)
    const selectedThemeColor = brightenThemeColor(rawThemeColor)
    const accentColor = normalizeAccentColor(selectedThemeColor, backgroundColor)

    const useDarkShadow =
      getRelativeLuminance(selectedThemeColor) >= getRelativeLuminance(backgroundColor)
    const primaryShadow = useDarkShadow ? 'rgba(0, 0, 0, 0.36)' : 'rgba(255, 255, 255, 0.22)'
    const secondaryShadow = useDarkShadow ? 'rgba(0, 0, 0, 0.18)' : 'rgba(255, 255, 255, 0.12)'
    const playedColor = toCssColor(selectedThemeColor, 0.98)

    return {
      playedColor,
      textShadow: `0 0 0.2em ${primaryShadow}, 0 0 0.8em ${secondaryShadow}`
    }
  } catch (error) {
    console.warn('歌词颜色提取失败:', error)
    return defaultLyricTheme
  }
}
