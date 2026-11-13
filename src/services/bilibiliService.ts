import CryptoJS from 'crypto-js'
import {
  bilibiliRequest,
  getBilibiliAccount,
  saveBilibiliAccount,
  toBiliProxyUrl
} from './tauriBridge'

export interface BilibiliUser {
  connected: boolean
  mid: string | null
  uname: string | null
  face: string | null
  cookie: string
  isLogin?: boolean
  vipType?: number
}

export interface BilibiliVideoItem {
  bvid: string
  title: string
  pic: string
  author: string
  duration: string
  play: number | string
  recommendScore?: number
}

const mixinKeyTable = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16,
  24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
]

function getMixinKey(imgKey: string, subKey: string): string {
  const rawKey = imgKey + subKey
  let key = ''
  for (let i = 0; i < 32; i++) {
    key += rawKey[mixinKeyTable[i]]
  }
  return key
}

function getWbiQuery(params: Record<string, any>, mixinKey: string): string {
  const queryObj: Record<string, any> = {
    ...params,
    wts: Math.round(Date.now() / 1000)
  }
  const keys = Object.keys(queryObj).sort()
  const queryList: string[] = []
  for (const k of keys) {
    const v = String(queryObj[k]).replace(/[!'()*]/g, '')
    queryList.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
  }
  const query = queryList.join('&')
  const w_rid = CryptoJS.MD5(query + mixinKey).toString()
  return `${query}&w_rid=${w_rid}`
}

export class BilibiliService {
  private user: BilibiliUser = {
    connected: false,
    mid: null,
    uname: null,
    face: null,
    cookie: ''
  }

  async init(): Promise<BilibiliUser> {
    const saved = await getBilibiliAccount()
    if (saved && saved.cookie) {
      this.user = {
        connected: saved.connected ?? true,
        mid: saved.mid ?? null,
        uname: saved.uname ?? null,
        face: saved.face ?? null,
        cookie: saved.cookie
      }
      // verify status
      void this.checkUserStatus()
    }
    return this.user
  }

  getUser(): BilibiliUser {
    return this.user
  }

  getCookie(): string {
    return this.user.cookie || ''
  }

  async checkUserStatus(): Promise<BilibiliUser> {
    if (!this.user.cookie) {
      this.user.connected = false
      return this.user
    }
    try {
      const res = await bilibiliRequest(
        'https://api.bilibili.com/x/web-interface/nav',
        'GET',
        this.user.cookie,
        'https://www.bilibili.com/'
      )
      if (res && res.code === 0 && res.data?.isLogin) {
        this.user.connected = true
        this.user.mid = String(res.data.mid)
        this.user.uname = res.data.uname
        this.user.face = res.data.face
        await saveBilibiliAccount(this.user)
      } else {
        this.user.connected = false
        await saveBilibiliAccount(this.user)
      }
    } catch {
      // Keep existing status if offline
    }
    return this.user
  }

  async generateLoginQr(): Promise<{ url: string; qrcode_key: string } | null> {
    try {
      const res = await bilibiliRequest(
        'https://passport.bilibili.com/x/passport-login/web/qrcode/generate',
        'GET',
        '',
        'https://passport.bilibili.com/'
      )
      if (res && res.code === 0 && res.data) {
        return {
          url: res.data.url,
          qrcode_key: res.data.qrcode_key
        }
      }
    } catch (e) {
      console.error('generateLoginQr failed:', e)
    }
    return null
  }

  async pollLoginQr(qrcode_key: string): Promise<{
    status: 'waiting' | 'scanned' | 'success' | 'expired'
    message: string
    cookie?: string
  }> {
    try {
      const res = await bilibiliRequest(
        `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(qrcode_key)}`,
        'GET',
        '',
        'https://passport.bilibili.com/'
      )

      if (!res) {
        return { status: 'waiting', message: '网络请求无响应' }
      }

      const code = res.data?.code ?? res.code
      if (code === 0) {
        // Success: extract cookies from url or direct response
        const url = res.data?.url || ''
        const cookie = this.extractCookieFromUrl(url)
        this.user.cookie = cookie
        this.user.connected = true
        await this.checkUserStatus()
        return { status: 'success', message: '登录成功', cookie }
      } else if (code === 86101) {
        return { status: 'waiting', message: '未扫码' }
      } else if (code === 86090) {
        return { status: 'scanned', message: '二维码已扫描，请在手机上确认' }
      } else if (code === 86038) {
        return { status: 'expired', message: '二维码已过期，请刷新' }
      }

      return { status: 'waiting', message: res.data?.message || '等待扫码' }
    } catch (e: any) {
      return { status: 'waiting', message: e?.message || '检查登录状态失败' }
    }
  }

  private extractCookieFromUrl(url: string): string {
    if (!url) return ''
    try {
      const parts = url.split('?')
      if (parts.length < 2) return ''
      const params = new URLSearchParams(parts[1])
      const cookies: string[] = []
      params.forEach((val, key) => {
        cookies.push(`${key}=${val}`)
      })
      return cookies.join('; ')
    } catch {
      return ''
    }
  }

  async setManualCookie(cookie: string): Promise<boolean> {
    this.user.cookie = cookie.trim()
    const updated = await this.checkUserStatus()
    return updated.connected
  }

  async logout(): Promise<void> {
    this.user = {
      connected: false,
      mid: null,
      uname: null,
      face: null,
      cookie: ''
    }
    await saveBilibiliAccount(this.user)
  }

  private buvidCookie = ''

  private async ensureBuvidCookie(): Promise<string> {
    const base = this.user.cookie || ''
    if (base.includes('buvid3=')) return base
    if (!this.buvidCookie) {
      try {
        const res = await bilibiliRequest(
          'https://api.bilibili.com/x/frontend/finger/spi',
          'GET',
          '',
          'https://www.bilibili.com/'
        )
        const b3 = res?.data?.b_3
        const b4 = res?.data?.b_4
        if (b3) {
          this.buvidCookie = b4 ? `buvid3=${b3}; buvid4=${b4}` : `buvid3=${b3}`
        }
      } catch (e) {
        console.warn('ensureBuvidCookie error:', e)
      }
    }
    if (!this.buvidCookie) return base
    return base ? `${base}; ${this.buvidCookie}` : this.buvidCookie
  }

  private async getWbiKeys(): Promise<{ imgKey: string; subKey: string } | null> {
    try {
      const cookie = await this.ensureBuvidCookie()
      const res = await bilibiliRequest(
        'https://api.bilibili.com/x/web-interface/nav',
        'GET',
        cookie,
        'https://www.bilibili.com/'
      )
      const wbiImg = res?.data?.wbi_img
      if (wbiImg?.img_url && wbiImg?.sub_url) {
        const imgKey = wbiImg.img_url.split('/').pop()?.split('.')[0] || ''
        const subKey = wbiImg.sub_url.split('/').pop()?.split('.')[0] || ''
        if (imgKey && subKey) {
          return { imgKey, subKey }
        }
      }
    } catch (e) {
      console.warn('getWbiKeys error:', e)
    }
    return null
  }

  private async normalizePicUrl(rawPic?: string): Promise<string> {
    if (!rawPic) return ''
    let pic = rawPic.trim()
    if (pic.startsWith('//')) {
      pic = `https:${pic}`
    } else if (pic.startsWith('http://')) {
      pic = `https://${pic.slice('http://'.length)}`
    }
    return await toBiliProxyUrl(pic)
  }

  private async mapSearchItems(items: any[]): Promise<BilibiliVideoItem[]> {
    return await Promise.all(
      items.map(async (item: any) => ({
        bvid: item.bvid,
        title: item.title ? item.title.replace(/<[^>]+>/g, '') : '',
        pic: await this.normalizePicUrl(item.pic),
        author: item.author || '',
        duration: item.duration || '',
        play: item.play || 0
      }))
    )
  }

  async searchVideos(keyword: string): Promise<BilibiliVideoItem[]> {
    if (!keyword.trim()) return []
    try {
      const cookie = await this.ensureBuvidCookie()
      const wbiKeys = await this.getWbiKeys()
      const params: Record<string, any> = {
        search_type: 'video',
        keyword: keyword,
        page: 1,
        page_size: 10
      }

      let url = 'https://api.bilibili.com/x/web-interface/search/type'
      if (wbiKeys) {
        const mixinKey = getMixinKey(wbiKeys.imgKey, wbiKeys.subKey)
        const query = getWbiQuery(params, mixinKey)
        url = `https://api.bilibili.com/x/web-interface/wbi/search/type?${query}`
      } else {
        url = `${url}?search_type=video&keyword=${encodeURIComponent(keyword)}&page=1&page_size=10`
      }

      const res = await bilibiliRequest(
        url,
        'GET',
        cookie,
        `https://search.bilibili.com/video?keyword=${encodeURIComponent(keyword)}`
      )

      if (res?.code === 0 && Array.isArray(res.data?.result) && res.data.result.length > 0) {
        return await this.mapSearchItems(res.data.result)
      }

      // Fallback search
      const fallbackUrl = wbiKeys
        ? `https://api.bilibili.com/x/web-interface/wbi/search/all/v2?${getWbiQuery({ keyword, page: 1 }, getMixinKey(wbiKeys.imgKey, wbiKeys.subKey))}`
        : `https://api.bilibili.com/x/web-interface/search/all/v2?keyword=${encodeURIComponent(keyword)}&page=1`
      const fallbackRes = await bilibiliRequest(
        fallbackUrl,
        'GET',
        cookie,
        `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`
      )
      if (fallbackRes?.code === 0 && Array.isArray(fallbackRes.data?.result)) {
        const videoGroup = fallbackRes.data.result.find((g: any) => g.result_type === 'video')
        const items = videoGroup?.data || []
        return await this.mapSearchItems(items)
      }
    } catch (e) {
      console.error('Bilibili search failed:', e)
    }
    return []
  }

  async getPlayurl(bvid: string, targetQn = 80): Promise<{
    url?: string
    quality?: number
    accept_quality?: number[]
    accept_description?: string[]
  } | null> {
    try {
      const cookie = await this.ensureBuvidCookie()
      const referer = `https://www.bilibili.com/video/${bvid}`

      // 1. Get CID
      const viewRes = await bilibiliRequest(
        `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
        'GET',
        cookie,
        referer
      )

      const cid = viewRes?.data?.cid
      if (!cid) return null

      // 2. Resolve progressive MP4 stream (HTML5 <video> cannot demux FLV or raw DASH .m4s segments)
      const wbiKeys = await this.getWbiKeys()
      const extractMp4Durl = (res: any): string | undefined => {
        if (res?.code !== 0) return undefined
        const fmt = String(res.data?.format || '').toLowerCase()
        const url =
          res.data?.durl?.[0]?.url ||
          res.data?.durl?.[0]?.backup_url?.[0] ||
          res.data?.durl?.[0]?.backupUrl?.[0]
        if (!url) return undefined
        if (fmt.includes('flv') || /\.flv(\?|$)/i.test(url)) return undefined
        return url
      }

      const candidateUrls: string[] = []
      if (wbiKeys) {
        const mixinKey = getMixinKey(wbiKeys.imgKey, wbiKeys.subKey)
        candidateUrls.push(
          `https://api.bilibili.com/x/player/wbi/playurl?${getWbiQuery(
            { bvid, cid, qn: targetQn, fnval: 1, fnver: 0, fourk: 1 },
            mixinKey
          )}`,
          `https://api.bilibili.com/x/player/wbi/playurl?${getWbiQuery(
            { bvid, cid, qn: targetQn, fnval: 1, platform: 'html5', high_quality: 1 },
            mixinKey
          )}`
        )
      }
      candidateUrls.push(
        `https://api.bilibili.com/x/player/playurl?bvid=${encodeURIComponent(bvid)}&cid=${encodeURIComponent(cid)}&qn=${targetQn}&fnval=1&platform=html5&high_quality=1`,
        `https://api.bilibili.com/x/player/playurl?bvid=${encodeURIComponent(bvid)}&cid=${encodeURIComponent(cid)}&qn=${targetQn}&fnval=1&fnver=0&fourk=1`
      )

      let playRes: any = null
      let rawStreamUrl: string | undefined

      for (const playUrl of candidateUrls) {
        playRes = await bilibiliRequest(playUrl, 'GET', cookie, referer)
        rawStreamUrl = extractMp4Durl(playRes)
        if (rawStreamUrl) break
      }

      if (playRes?.code === 0 && playRes.data && rawStreamUrl) {
        const data = playRes.data
        const url = await toBiliProxyUrl(rawStreamUrl)
        return {
          url,
          quality: data.quality,
          accept_quality: data.accept_quality || [],
          accept_description: data.accept_description || []
        }
      }
    } catch (e) {
      console.error('getPlayurl failed:', e)
    }
    return null
  }
}

export const bilibiliService = new BilibiliService()
