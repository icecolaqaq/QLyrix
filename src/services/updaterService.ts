import {
  checkAppUpdate as tauriCheckApp,
  checkComponentUpdate as tauriCheckComponent,
  downloadAndUpdateComponent as tauriUpdateComponent,
  openExternalLink
} from './tauriBridge'

export interface AppUpdateInfo {
  current_version: string
  latest_version: string
  has_update: boolean
  release_notes: string
  download_url: string
  published_at?: string
}

export interface ComponentUpdateInfo {
  has_component: boolean
  tag?: string
  name?: string
  size?: number
  browser_download_url?: string
  msg?: string
}

export const APP_CURRENT_VERSION = '2.0.0'

export class UpdaterService {
  async checkAppUpdate(): Promise<AppUpdateInfo> {
    try {
      const res = await tauriCheckApp(APP_CURRENT_VERSION)
      return {
        current_version: res.current_version || APP_CURRENT_VERSION,
        latest_version: res.latest_version || APP_CURRENT_VERSION,
        has_update: Boolean(res.has_update),
        release_notes: res.release_notes || '暂无更新日志',
        download_url: res.download_url || 'https://github.com/icecolaqaq/QLyrix/releases',
        published_at: res.published_at
      }
    } catch (e: any) {
      return {
        current_version: APP_CURRENT_VERSION,
        latest_version: APP_CURRENT_VERSION,
        has_update: false,
        release_notes: e?.message || '检查更新失败',
        download_url: 'https://github.com/icecolaqaq/QLyrix/releases'
      }
    }
  }

  async checkComponentUpdate(): Promise<ComponentUpdateInfo> {
    try {
      const res = await tauriCheckComponent()
      return res as ComponentUpdateInfo
    } catch (e: any) {
      return {
        has_component: false,
        msg: e?.message || '检查组件更新失败'
      }
    }
  }

  async updateComponent(downloadUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      const msg = await tauriUpdateComponent(downloadUrl)
      return { success: true, message: msg }
    } catch (e: any) {
      return { success: false, message: e?.message || '更新组件失败' }
    }
  }

  openReleasePage(url = 'https://github.com/icecolaqaq/QLyrix/releases') {
    void openExternalLink(url)
  }
}

export const updaterService = new UpdaterService()
