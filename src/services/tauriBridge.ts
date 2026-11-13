import { invoke } from '@tauri-apps/api/core'
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { open as openUrl } from '@tauri-apps/plugin-shell'
import { save as saveDialog } from '@tauri-apps/plugin-dialog'
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart'

export function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export interface AppConfig {
  blur_enabled: boolean
  custom_color: string
  custom_trans_color: string
  custom_roma_color: string
  disable_subline_opacity: boolean
  use_custom_color: boolean
  always_on_top: boolean
  auto_start: boolean
  close_to_tray: boolean
  island_enabled: boolean
  auto_launch_island_with_qqmusic: boolean
  island_display_mode: 'always' | 'hide_on_fullscreen' | string
  mv_mode_enabled: boolean
  mv_video_bg_enabled: boolean
  mv_blur_enabled: boolean
  mv_blur_value: number
  mv_fit_mode: string
  mv_quality: number
  subtitle_mode: boolean
  subtitle_font_size: number
  onboarding_completed: boolean
}

export const defaultAppConfig: AppConfig = {
  blur_enabled: true,
  custom_color: '',
  custom_trans_color: '',
  custom_roma_color: '',
  disable_subline_opacity: false,
  use_custom_color: false,
  always_on_top: false,
  auto_start: false,
  close_to_tray: true,
  island_enabled: true,
  auto_launch_island_with_qqmusic: true,
  island_display_mode: 'always',
  mv_mode_enabled: true,
  mv_video_bg_enabled: true,
  mv_blur_enabled: true,
  mv_blur_value: 18,
  mv_fit_mode: 'cover',
  mv_quality: 32,
  subtitle_mode: false,
  subtitle_font_size: 28,
  onboarding_completed: false
}

// Window Operations
export async function getCurrentWindow(): Promise<WebviewWindow | null> {
  if (!isTauriEnv()) return null
  try {
    return getCurrentWebviewWindow()
  } catch {
    return null
  }
}

export async function minimizeCurrentWindow(): Promise<void> {
  const win = await getCurrentWindow()
  if (win) await win.minimize()
}

export async function toggleMaximizeCurrentWindow(): Promise<void> {
  const win = await getCurrentWindow()
  if (win) await win.toggleMaximize()
}

export async function closeCurrentWindow(): Promise<void> {
  const win = await getCurrentWindow()
  if (win) {
    const config = await getAppConfig()
    if (win.label === 'main' && config.close_to_tray) {
      await win.hide()
    } else {
      await win.close()
    }
  }
}

export async function toggleFullscreenCurrentWindow(): Promise<void> {
  const win = await getCurrentWindow()
  if (win) {
    const isFullscreen = await win.isFullscreen()
    await win.setFullscreen(!isFullscreen)
  }
}

export async function startDragging(): Promise<void> {
  const win = await getCurrentWindow()
  if (win) await win.startDragging()
}

export async function setAlwaysOnTop(label: string, onTop: boolean): Promise<void> {
  if (!isTauriEnv()) return
  try {
    await invoke('set_window_always_on_top', { label, onTop })
  } catch (e) {
    console.error('setAlwaysOnTop failed:', e)
  }
}

export async function toggleWindow(label: string): Promise<void> {
  if (!isTauriEnv()) return
  try {
    await invoke('toggle_window', { label })
  } catch (e) {
    console.error('toggleWindow failed:', e)
  }
}

export async function showWindow(label: string): Promise<void> {
  if (!isTauriEnv()) return
  try {
    await invoke('show_window', { label })
  } catch (e) {
    console.error('showWindow failed:', e)
  }
}

export async function hideWindow(label: string): Promise<void> {
  if (!isTauriEnv()) return
  try {
    await invoke('hide_window', { label })
  } catch (e) {
    console.error('hideWindow failed:', e)
  }
}

export async function setIslandExpanded(expanded: boolean): Promise<void> {
  if (!isTauriEnv()) return
  try {
    await invoke('set_island_expanded', { expanded })
  } catch (e) {
    console.error('setIslandExpanded failed:', e)
  }
}

export async function getIslandPosition(): Promise<[number, number]> {
  if (!isTauriEnv()) return [0, 0]
  try {
    return await invoke<[number, number]>('get_island_position')
  } catch {
    return [0, 0]
  }
}

export async function setIslandPosition(x: number, y: number): Promise<void> {
  if (!isTauriEnv()) return
  try {
    await invoke('set_island_position', { x: Math.round(x), y: Math.round(y) })
  } catch (e) {
    console.error('setIslandPosition failed:', e)
  }
}

export async function resetIslandPosition(): Promise<void> {
  if (!isTauriEnv()) return
  try {
    await invoke('reset_island_position')
  } catch (e) {
    console.error('resetIslandPosition failed:', e)
  }
}

let cachedBiliProxyPort = 0

export async function getBiliProxyPort(): Promise<number> {
  if (!isTauriEnv()) return 0
  if (cachedBiliProxyPort > 0) return cachedBiliProxyPort
  try {
    const port = await invoke<number>('get_bili_proxy_port')
    if (port > 0) cachedBiliProxyPort = port
    return port
  } catch {
    return 0
  }
}

export async function toBiliProxyUrl(rawUrl: string): Promise<string> {
  if (!rawUrl || !isTauriEnv()) return rawUrl
  const port = await getBiliProxyPort()
  if (!port) return rawUrl
  const bytes = new TextEncoder().encode(rawUrl)
  let bin = ''
  bytes.forEach((b) => {
    bin += String.fromCharCode(b)
  })
  const b64url = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `http://127.0.0.1:${port}/proxy?b64=${b64url}`
}

export async function fetchImageDataUrl(url: string): Promise<string> {
  if (!url || url.startsWith('data:') || !isTauriEnv()) return url
  try {
    return await invoke<string>('fetch_image_data_url', { url })
  } catch (e) {
    console.warn('fetchImageDataUrl fallback:', e)
    return url
  }
}

// Autostart Operations
export async function setAutoStart(enabled: boolean): Promise<boolean> {
  if (!isTauriEnv()) return false
  try {
    if (enabled) {
      await enableAutostart()
    } else {
      await disableAutostart()
    }
    return true
  } catch (e) {
    console.error('Failed to set auto start:', e)
    return false
  }
}

export async function checkAutoStart(): Promise<boolean> {
  if (!isTauriEnv()) return false
  try {
    return await isAutostartEnabled()
  } catch {
    return false
  }
}

// App Configuration
export async function getAppConfig(): Promise<AppConfig> {
  if (!isTauriEnv()) {
    try {
      const stored = localStorage.getItem('qlyrix_config')
      return stored ? { ...defaultAppConfig, ...JSON.parse(stored) } : defaultAppConfig
    } catch {
      return defaultAppConfig
    }
  }
  try {
    return await invoke<AppConfig>('get_app_config')
  } catch (e) {
    console.error('getAppConfig error:', e)
    return defaultAppConfig
  }
}

export async function saveAppConfig(config: Partial<AppConfig>): Promise<void> {
  const current = await getAppConfig()
  const merged: AppConfig = { ...current, ...config }

  if (!isTauriEnv()) {
    try {
      localStorage.setItem('qlyrix_config', JSON.stringify(merged))
    } catch {
      // ignore
    }
    return
  }
  try {
    await invoke('save_app_config', { config: merged })
  } catch (e) {
    console.error('saveAppConfig error:', e)
  }
}

export async function emitAppEvent(event: string, payload?: unknown): Promise<void> {
  if (!isTauriEnv()) {
    window.dispatchEvent(new CustomEvent(event, { detail: payload }))
    return
  }
  try {
    await emit(event, payload)
  } catch (e) {
    console.error('emitAppEvent error:', e)
  }
}

export async function listenAppEvent<T = unknown>(
  event: string,
  handler: (payload: T) => void
): Promise<UnlistenFn> {
  if (!isTauriEnv()) {
    const listener = (e: Event) => handler((e as CustomEvent<T>).detail)
    window.addEventListener(event, listener)
    return () => window.removeEventListener(event, listener)
  }
  return await listen<T>(event, (e) => handler(e.payload))
}

// MV Mappings
export async function getMvMappings(): Promise<Record<string, any>> {
  if (!isTauriEnv()) {
    try {
      const stored = localStorage.getItem('qlyrix_mv_mappings')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }
  try {
    return await invoke<Record<string, any>>('get_mv_mappings')
  } catch {
    return {}
  }
}

export async function saveMvMappings(mappings: Record<string, any>): Promise<void> {
  if (!isTauriEnv()) {
    try {
      localStorage.setItem('qlyrix_mv_mappings', JSON.stringify(mappings))
    } catch {
      // ignore
    }
    return
  }
  try {
    await invoke('save_mv_mappings', { mappings })
  } catch (e) {
    console.error('saveMvMappings error:', e)
  }
}

// Bilibili Account
export async function getBilibiliAccount(): Promise<any> {
  if (!isTauriEnv()) {
    try {
      const stored = localStorage.getItem('qlyrix_bilibili_account')
      return stored ? JSON.parse(stored) : { connected: false, cookie: '' }
    } catch {
      return { connected: false, cookie: '' }
    }
  }
  try {
    return await invoke('get_bilibili_account')
  } catch {
    return { connected: false, cookie: '' }
  }
}

export async function saveBilibiliAccount(account: any): Promise<void> {
  if (!isTauriEnv()) {
    try {
      localStorage.setItem('qlyrix_bilibili_account', JSON.stringify(account))
    } catch {
      // ignore
    }
    return
  }
  try {
    await invoke('save_bilibili_account', { account })
  } catch (e) {
    console.error('saveBilibiliAccount error:', e)
  }
}

// Process Management
export async function startQMusicSupport(): Promise<boolean> {
  if (!isTauriEnv()) return true
  try {
    return await invoke<boolean>('start_qmusic_support')
  } catch (e) {
    console.warn('startQMusicSupport error:', e)
    return false
  }
}

export async function stopQMusicSupport(): Promise<void> {
  if (!isTauriEnv()) return
  try {
    await invoke('stop_qmusic_support')
  } catch (e) {
    console.warn('stopQMusicSupport error:', e)
  }
}

export async function restartQMusicSupport(): Promise<boolean> {
  await stopQMusicSupport()
  await new Promise((resolve) => setTimeout(resolve, 500))
  return await startQMusicSupport()
}

// Updates
export async function checkAppUpdate(currentVersion: string): Promise<any> {
  if (!isTauriEnv()) {
    return { current_version: currentVersion, has_update: false }
  }
  return await invoke('check_app_update', { currentVersion })
}

export async function checkComponentUpdate(): Promise<any> {
  if (!isTauriEnv()) {
    return { has_component: false, msg: '开发环境中无法检查组件更新' }
  }
  return await invoke('check_component_update')
}

export async function downloadAndUpdateComponent(downloadUrl: string): Promise<string> {
  if (!isTauriEnv()) {
    return '非 Tauri 环境，跳过组件下载'
  }
  return await invoke<string>('download_and_update_component', { downloadUrl })
}

// Network requests
export async function qqmusicGetLyric(songId: number): Promise<any> {
  if (!isTauriEnv()) {
    return null
  }
  return await invoke('qqmusic_get_lyric', { songId })
}

export async function bilibiliRequest(
  url: string,
  method = 'GET',
  cookie = '',
  referer = 'https://www.bilibili.com/'
): Promise<any> {
  if (!isTauriEnv()) {
    const res = await fetch(url)
    return await res.json()
  }
  return await invoke('bilibili_request', { url, method, cookie, referer })
}

// File Dialogs & Saving
export async function promptSaveFileDialog(
  title: string,
  defaultName: string,
  filters: Array<{ name: string; extensions: string[] }>
): Promise<string | null> {
  if (!isTauriEnv()) return null
  try {
    return await saveDialog({
      title,
      defaultPath: defaultName,
      filters
    })
  } catch (e) {
    console.error('promptSaveFileDialog error:', e)
    return null
  }
}

export async function saveTextFile(path: string, content: string): Promise<void> {
  if (!isTauriEnv()) return
  await invoke('save_text_file', { path, content })
}

export async function saveBinaryFile(path: string, base64Data: string): Promise<void> {
  if (!isTauriEnv()) return
  await invoke('save_binary_file', { path, base64Data })
}

export async function openExternalLink(url: string): Promise<void> {
  if (!url) return
  if (!isTauriEnv()) {
    window.open(url, '_blank')
    return
  }
  try {
    await openUrl(url)
  } catch {
    window.open(url, '_blank')
  }
}
