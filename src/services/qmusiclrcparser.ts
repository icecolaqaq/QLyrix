interface RawLyricFile {
  lyric: string
  trans: string
  roma: string
}

/** 一个歌词单词 */
interface LyricWord {
  /** 单词的起始时间，单位为毫秒 */
  startTime: number
  /** 单词的结束时间，单位为毫秒 */
  endTime: number
  /** 单词内容 */
  word: string
  /** 单词的音译内容 */
  romanWord: string
  /** 单词内容是否包含冒犯性的不雅用语 */
  obscene: boolean
}

export interface LyricLine {
  /**
   * 该行的所有单词
   * 如果是 LyRiC 等只能表达一行歌词的格式，这里就只会有一个单词且通常其始末时间和本结构的 `startTime` 和 `endTime` 相同
   */
  words: LyricWord[]
  /** 该行歌词的纯文本内容 */
  lyric: string
  /** 该行的翻译歌词，将会显示在主歌词行的下方 */
  translatedLyric: string
  /** 该行的音译歌词，将会显示在翻译歌词行的下方 */
  romanLyric: string
  /** 句子的起始时间，单位为毫秒 */
  startTime: number
  /** 句子的结束时间，单位为毫秒 */
  endTime: number
  /** 该行是否为背景歌词行，当该行歌词的上一句非背景歌词被激活时，这行歌词将会显示出来，注意每个非背景歌词下方只能拥有一个背景歌词 */
  isBG: boolean
  /** 该行是否为对唱歌词行（即歌词行靠右对齐） */
  isDuet: boolean
}

export function parseQrcLyric(rawData: RawLyricFile): LyricLine[] {
  const result: LyricLine[] = []

  // 分离三种歌词内容
  const [mainLines, transLines, romaLines] = [rawData.lyric, rawData.trans, rawData.roma].map(
    (content) => content.split('\n').filter((l) => l.trim())
  )

  // 解析歌词行（适配QQ音乐逐字歌词格式）
  const lineRegex = /^\[(\d+),(\d+)\](.*)/
  const wordRegex = /(.*?)\((\d+),(\d+)\)/g
  let isDuet = false

  //特殊处理 翻译歌词行中包含时间戳的情况
  const transEntries = transLines.flatMap((line) => {
    // 检查文本中是否包含时间戳
    const textTimeMatches = [...line.matchAll(/\[(\d+):(\d+)\.(\d{2,3})\]/g)]

    // 如果text中包含时间戳，使用这些时间戳
    if (textTimeMatches.length > 0) {
      return textTimeMatches.map((timeMatch) => {
        // 提取时间戳
        const textTime =
          parseInt(timeMatch[1]) * 60000 +
          parseInt(timeMatch[2]) * 1000 +
          parseInt(timeMatch[3]) * (timeMatch[3].length === 2 ? 10 : 1)

        // 提取时间戳后面的文本直到下一个时间戳
        const nextMatchIndex = textTimeMatches.findIndex((m) => m.index! > timeMatch.index!)
        const textEndIndex =
          nextMatchIndex !== -1 ? textTimeMatches[nextMatchIndex].index! : line.length

        // 提取并清理文本
        const textAfterTime = line
          .slice(timeMatch.index! + timeMatch[0].length, textEndIndex)
          .trim()
        const cleanText = textAfterTime.replace(/\/\//g, '').trim()

        return {
          time: textTime,
          text: cleanText
        }
      })
    }

    // 如果text中没有时间戳，使用原来的方式
    const timeMatch = line.match(/\[(\d+):(\d+)\.(\d+)\]/)
    const text = line
      .replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '')
      .replace(/\/\//g, '')
      .trim()

    return {
      time: timeMatch
        ? parseInt(timeMatch[1]) * 60000 +
          parseInt(timeMatch[2]) * 1000 +
          parseInt(timeMatch[3]) * 10
        : -1,
      text
    }
  })

  const romaEntries = romaLines.flatMap((line) => {
    const timeMatch = line.match(/^\[(\d+),(\d+)\]/)
    if (timeMatch) {
      const text = line
        .replace(/^\[\d+,\d+\]\s*/, '')
        .replace(/\([\d,]+\)/g, '')
        .trim()
      return {
        time: parseInt(timeMatch[1]),
        text
      }
    }

    const lrcTimeMatches = [...line.matchAll(/\[(\d+):(\d+)\.(\d{1,3})\]/g)]
    const sharedText = line.replace(/\[\d+:\d+\.\d{1,3}\]/g, '').trim()
    return lrcTimeMatches.map((match) => {
      const time =
        parseInt(match[1]) * 60000 +
        parseInt(match[2]) * 1000 +
        parseInt(match[3].padEnd(3, '0').slice(0, 3))
      const nextMatch = lrcTimeMatches.find((candidate) => candidate.index! > match.index!)
      const textEndIndex = nextMatch?.index ?? line.length
      const text = line.slice(match.index! + match[0].length, textEndIndex).trim() || sharedText
      return { time, text }
    })
  })

  mainLines.forEach((line, index) => {
    const lineMatch = line.match(lineRegex)
    if (!lineMatch) return
    // 解析行基本信息
    const lineStart = parseInt(lineMatch[1])
    const lineDuration = parseInt(lineMatch[2])
    // 修改行处理逻辑
    const rawLineContent = lineMatch[3]
    // 对唱判断
    const isFemaleLineRole1 = /^女\(\d+,\d+\)：\(\d+,\d+\)$/.test(rawLineContent)
    const isFemaleLineRole2 = rawLineContent.includes('女：')
    if (isFemaleLineRole1 || isFemaleLineRole2) {
      isDuet = true
    }
    const isManLineRole1 = /^男\(\d+,\d+\)：\(\d+,\d+\)$/.test(rawLineContent)
    const isManLineRole2 = rawLineContent.includes('男：')
    if (isManLineRole1 || isManLineRole2) {
      isDuet = false
    }
    const isCommonLineRole1 = /^合\(\d+,\d+\)：\(\d+,\d+\)$/.test(rawLineContent)
    const isCommonLineRole2 = rawLineContent.includes('合：')
    if (isCommonLineRole1 || isCommonLineRole2) {
      isDuet = false
    }
    let isBG = false
    //背景判断 规则 判断歌词第一个字符是否为（
    const firstChar = rawLineContent[0]
    if (firstChar === '（') {
      isBG = true
    }

    const words: LyricLine['words'] = []
    let wordMatch
    while ((wordMatch = wordRegex.exec(rawLineContent)) !== null) {
      const text = wordMatch[1]
      const start = parseInt(wordMatch[2])
      const duration = parseInt(wordMatch[3])
      // 保留空格作为独立单词
      if (text !== undefined && text !== null) {
        words.push({
          word: text,
          startTime: start,
          endTime: start + duration,
          romanWord: '',
          obscene: false
        })
      }
    }

    const translated = transEntries.reduce(
      (closest, entry) => {
        if (entry.time === -1) return closest

        // 使用transEntries中提取的时间戳进行匹配
        const diff = Math.abs(entry.time - lineStart)

        return diff < closest.diff ? { text: entry.text, diff } : closest
      },
      { text: '', diff: Infinity }
    ).text

    const roman = romaEntries.reduce(
      (closest, entry) => {
        if (entry.time === -1) return closest

        // 去除文本中的时间戳，但保留原来的匹配逻辑
        const cleanText = entry.text.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim()

        // 使用原来的entry.time进行匹配
        const diff = Math.abs(entry.time - lineStart)

        return diff < closest.diff ? { text: cleanText, diff } : closest
      },
      { text: '', diff: Infinity }
    ).text

    if (words.length > 0) {
      result.push({
        words,
        lyric: words.map((w) => w.word).join(''),
        startTime: lineStart,
        endTime: lineStart + lineDuration,
        translatedLyric: translated,
        romanLyric: roman,
        isBG,
        isDuet
      })
    }
  })
  return result
}
