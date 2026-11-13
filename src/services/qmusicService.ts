import { reactive, ref } from 'vue'
import { fetchImageDataUrl, qqmusicGetLyric, startQMusicSupport } from './tauriBridge'
import qrc_decrypt from './qrc_decrypt'
import { parseQrcLyric, type LyricLine } from './qmusiclrcparser'

export interface MusicInfo {
  id: number
  title: string
  artist: string
  album: string
  cover: string
  progress: number
  duration: number
  isPlaying: boolean
  volume: number
  favorite: boolean
  quality?: number
  qualityLabel: string
  server: number
}

export interface LyricPayload {
  id: number
  lyric: string
  trans: string
  roma: string
  lines: LyricLine[]
  fetchSuccess: boolean
  isPureMusic: boolean
}

export const currentTrack = reactive<MusicInfo>({
  id: 0,
  title: '未知歌曲',
  artist: '未知歌手',
  album: '未知专辑',
  cover: '',
  progress: 0,
  duration: 0,
  isPlaying: false,
  volume: 50,
  favorite: false,
  qualityLabel: '',
  server: 0
})

export const currentLyric = reactive<LyricPayload>({
  id: 0,
  lyric: '',
  trans: '',
  roma: '',
  lines: [],
  fetchSuccess: false,
  isPureMusic: false
})

export const isWsConnected = ref(false)

const QRC_PATTERN = /<Lyric_.* LyricType=".*" LyricContent="(?<content>.*?)"\/>/s

class QMusicManager {
  private ws: WebSocket | null = null
  private port = 12689
  private retryTimer: any = null
  private isDestroyed = false
  private prevSongId = 0
  private lastFetchSongId = 0
  private lastCoverSourceUrl = ''
  private coverCache = new Map<string, string>()

  async init() {
    await startQMusicSupport()
    this.connect()
  }

  private connect(port = this.port) {
    if (this.isDestroyed) return

    try {
      this.ws = new WebSocket(`ws://127.0.0.1:${port}`)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      isWsConnected.value = true
      currentTrack.server = 1
      this.port = port
      console.log(`[QMusicSupport] WebSocket 已连接至端口 ${port}`)
    }

    this.ws.onmessage = (event) => {
      try {
        const raw = typeof event.data === 'string' ? event.data : ''
        const cleaned = raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
        const data = JSON.parse(cleaned)

        const songId = Number(data.id) || 0
        currentTrack.id = songId
        currentTrack.title = data.title || '未知歌曲'
        currentTrack.artist = data.artist || '未知歌手'
        currentTrack.album = data.album || '未知专辑'
        if (data.cover) {
          this.resolveSafeCover(data.cover)
        }
        currentTrack.progress = Math.floor(data.progress) || 0
        currentTrack.duration = Math.floor(data.duration) || 0
        currentTrack.isPlaying = !data.pause
        if (typeof data.volume === 'number') {
          currentTrack.volume = data.volume
        }
        currentTrack.favorite = Boolean(data.favorite)

        // Quality label
        if (typeof data.quality === 'number') {
          currentTrack.quality = data.quality
          if (data.quality === 10) currentTrack.qualityLabel = '臻品2.0'
          else if (data.quality === 9) currentTrack.qualityLabel = '臻品母带'
          else if (data.quality === 6) currentTrack.qualityLabel = 'Hi-Res'
          else if (data.quality === 2) currentTrack.qualityLabel = '无损'
          else if (data.quality === 1) currentTrack.qualityLabel = '高品质'
          else if (data.quality === 0) currentTrack.qualityLabel = '标准'
          else currentTrack.qualityLabel = ''
        }

        // Trigger lyric fetch on song change
        if (songId > 0 && songId !== this.prevSongId) {
          this.prevSongId = songId
          this.fetchLyrics(songId)
        }
      } catch (err) {
        console.warn('[QMusicSupport] 消息解析错误:', err)
      }
    }

    this.ws.onclose = () => {
      isWsConnected.value = false
      currentTrack.server = 0
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      isWsConnected.value = false
      currentTrack.server = 0
    }
  }

  private resolveSafeCover(rawUrl: string) {
    if (!rawUrl || rawUrl === this.lastCoverSourceUrl) return
    this.lastCoverSourceUrl = rawUrl

    const cached = this.coverCache.get(rawUrl)
    if (cached) {
      currentTrack.cover = cached
      return
    }

    fetchImageDataUrl(rawUrl).then((dataUrl) => {
      if (this.coverCache.size > 30) {
        const firstKey = this.coverCache.keys().next().value
        if (firstKey) this.coverCache.delete(firstKey)
      }
      this.coverCache.set(rawUrl, dataUrl)
      if (this.lastCoverSourceUrl === rawUrl) {
        currentTrack.cover = dataUrl
      }
    })
  }

  private scheduleReconnect() {
    if (this.isDestroyed || this.retryTimer) return
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.connect(this.port)
    }, 2500)
  }

  async fetchLyrics(songId: number) {
    if (this.lastFetchSongId === songId) return
    this.lastFetchSongId = songId

    try {
      const res = await qqmusicGetLyric(songId)
      if (this.prevSongId !== songId) return // outdated response

      const lyricInfo = res?.['music.musichallSong.PlayLyricInfo.GetPlayLyricInfo']?.data
      if (!lyricInfo) {
        currentLyric.lines = []
        currentLyric.fetchSuccess = false
        return
      }

      let lyricText = lyricInfo.lyric ? qrc_decrypt(lyricInfo.lyric) : ''
      const transText = lyricInfo.trans ? qrc_decrypt(lyricInfo.trans) : ''
      let romaText = lyricInfo.roma ? qrc_decrypt(lyricInfo.roma) : ''

      if (lyricText) {
        const mQrc = QRC_PATTERN.exec(lyricText)
        if (mQrc?.groups?.content) {
          lyricText = mQrc.groups.content
        }
      }

      if (romaText) {
        const mRoma = QRC_PATTERN.exec(romaText)
        if (mRoma?.groups?.content) {
          romaText = mRoma.groups.content
        }
      }

      currentLyric.id = songId
      currentLyric.lyric = lyricText
      currentLyric.trans = transText
      currentLyric.roma = romaText
      currentLyric.lines = parseQrcLyric({
        lyric: lyricText,
        trans: transText,
        roma: romaText
      })
      currentLyric.fetchSuccess = currentLyric.lines.length > 0
      currentLyric.isPureMusic = currentLyric.lines.length === 0
    } catch (e) {
      console.error('[QMusicSupport] 歌词获取失败:', e)
      if (this.prevSongId === songId) {
        currentLyric.fetchSuccess = false
      }
    }
  }

  sendCommand(command: string, arg = 0) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    try {
      this.ws.send(JSON.stringify({ command, arg }))
    } catch (e) {
      console.warn('[QMusicSupport] 发送命令失败:', e)
    }
  }

  play() {
    this.sendCommand('play')
  }

  stop() {
    this.sendCommand('stop')
  }

  togglePlay() {
    if (currentTrack.isPlaying) {
      this.stop()
    } else {
      this.play()
    }
  }

  next() {
    this.sendCommand('next')
  }

  prev() {
    this.sendCommand('prev')
  }

  favorite() {
    this.sendCommand('favorite')
    currentTrack.favorite = !currentTrack.favorite
  }

  setVolume(vol: number) {
    this.sendCommand('volume', Math.round(vol))
    currentTrack.volume = vol
  }

  seek(progressMs: number) {
    this.sendCommand('progress', Math.round(progressMs))
  }

  destroy() {
    this.isDestroyed = true
    if (this.retryTimer) clearTimeout(this.retryTimer)
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

export const qmusicService = new QMusicManager()
