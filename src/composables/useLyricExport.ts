import { state } from '@/services/store'
import { saveTextFile } from '@/services/tauriBridge'
import { ElMessage } from 'element-plus'

function formatTime(ms: number): string {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const ml = Math.floor(ms % 1000)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ml.toString().padStart(3, '0')}`
}

function generateLrcContent(): string {
  const lines: string[] = [`[ti:${state.title}]`, `[ar:${state.artist}]`, `[al:${state.album}]`, '']
  for (const l of state.lyricLines) {
    const t = formatTime(l.startTime)
    lines.push(`[${t}]${l.words.map((w) => w.word).join('')}`)
    if (l.translatedLyric) lines.push(`[${t}]${l.translatedLyric}`)
    if (l.romanLyric) lines.push(`[${t}]${l.romanLyric}`)
  }
  return lines.join('\n')
}

function generateQrcContent(): string {
  const lines: string[] = [`[ti:${state.title}]`, `[ar:${state.artist}]`, `[al:${state.album}]`, '']
  for (const l of state.lyricLines) {
    const dur = l.endTime - l.startTime
    const words = l.words
      .map((w) => `${w.word}(${w.startTime},${w.endTime - w.startTime})`)
      .join('')
    lines.push(`[${l.startTime},${dur}]${words}`)
    if (l.translatedLyric) lines.push(`[${l.startTime},${dur}]${l.translatedLyric}`)
    if (l.romanLyric) lines.push(`[${l.startTime},${dur}]${l.romanLyric}`)
  }
  return lines.join('\n')
}

function generateTxtContent(): string {
  const lines: string[] = [
    `${state.title} - ${state.artist}`,
    `专辑：${state.album}`,
    '',
    '【歌词】'
  ]
  for (const l of state.lyricLines) lines.push(l.words.map((w) => w.word).join(''))
  if (state.lyricLines.some((l) => l.translatedLyric)) {
    lines.push('', '---', '', '【翻译】')
    for (const l of state.lyricLines) lines.push(l.translatedLyric || '')
  }
  if (state.lyricLines.some((l) => l.romanLyric)) {
    lines.push('', '---', '', '【音译】')
    for (const l of state.lyricLines) lines.push(l.romanLyric || '')
  }
  return lines.join('\n')
}

export async function downloadLyric(format: 'qrc' | 'lrc' | 'txt') {
  if (!state.lyricLines.length) {
    ElMessage.warning('暂无歌词')
    return
  }
  const generators = { qrc: generateQrcContent, lrc: generateLrcContent, txt: generateTxtContent }
  const content = generators[format]()
  const safeTitle = (state.title || 'untitled').replace(/[\\/:*?"<>|]/g, '_')
  const safeArtist = (state.artist || 'unknown').replace(/[\\/:*?"<>|]/g, '_')
  const filename = `${safeTitle} - ${safeArtist}.${format}`

  try {
    await saveTextFile(filename, content)
    ElMessage.success('歌词已保存')
  } catch (err: any) {
    ElMessage.error(`保存失败: ${err?.message || err}`)
  }
}
