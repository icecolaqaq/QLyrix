<template>
  <div class="settings-container">
    <!-- 顶部拖拽标题栏 -->
    <div class="settings-titlebar" @mousedown="onStartDrag">
      <div class="titlebar-title">
        <span class="app-icon">🎵</span>
        <span>QLyrix 设置</span>
      </div>
      <div class="titlebar-actions" @mousedown.stop>
        <button class="titlebar-btn close-btn" title="关闭" @mousedown.stop @click.stop="closeSettings">
          <el-icon :size="14"><Close /></el-icon>
        </button>
      </div>
    </div>

    <!-- 主体区域：左侧导航 + 右侧内容 -->
    <div class="settings-body">
      <!-- 左侧分类侧边栏 -->
      <div class="settings-sidebar">
        <div
          v-for="tab in tabs"
          :key="tab.key"
          class="sidebar-item"
          :class="{ active: currentTab === tab.key }"
          @click="currentTab = tab.key"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
        </div>
      </div>

      <!-- 右侧内容面板 -->
      <div class="settings-content">
        <!-- 1. 常规设置 -->
        <div v-if="currentTab === 'general'" class="settings-tab-panel">
          <h2 class="panel-title">常规设置</h2>
          <div class="setting-group">
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-name">开机自启动</div>
                <div class="setting-desc">系统启动时自动运行 QLyrix</div>
              </div>
              <el-switch v-model="config.auto_start" @change="onAutoStartChange" />
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-name">窗口默认置顶</div>
                <div class="setting-desc">主歌词窗口启动时保持在最前端</div>
              </div>
              <el-switch v-model="config.always_on_top" @change="onAlwaysOnTopChange" />
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-name">关闭窗口时最小化至托盘</div>
                <div class="setting-desc">点击关闭按钮时隐藏至系统托盘，后台持续保持服务</div>
              </div>
              <el-switch v-model="config.close_to_tray" @change="saveConfig" />
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-name">桌面灵动岛</div>
                <div class="setting-desc">开启独立的桌面迷你灵动岛胶囊状态与双行歌词</div>
              </div>
              <el-switch v-model="config.island_enabled" @change="onIslandToggle" />
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-name">QQ音乐启动时自动开启灵动岛</div>
                <div class="setting-desc">检测到 QQ 音乐客户端启动运行时，自动显示桌面灵动岛</div>
              </div>
              <el-switch v-model="config.auto_launch_island_with_qqmusic" @change="saveConfig" />
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-name">灵动岛显示方式</div>
                <div class="setting-desc">选择灵动岛在桌面上的显示时机</div>
              </div>
              <el-select
                v-model="config.island_display_mode"
                style="width: 150px"
                @change="saveConfig"
              >
                <el-option label="总是" value="always" />
                <el-option label="全屏时隐藏" value="hide_on_fullscreen" />
              </el-select>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-name">新手功能引导</div>
                <div class="setting-desc">重新查看 QLyrix 核心功能与操作指引</div>
              </div>
              <el-button size="small" @click="restartOnboarding">重新开始引导</el-button>
            </div>
          </div>
        </div>

        <!-- 2. 显示与歌词 -->
        <div v-if="currentTab === 'display'" class="settings-tab-panel">
          <h2 class="panel-title">显示与歌词</h2>
          <div class="setting-group">
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-name">动态专辑背景模糊</div>
                <div class="setting-desc">启用根据封面自适应颜色的流光与高斯模糊着色器</div>
              </div>
              <el-switch v-model="config.blur_enabled" @change="saveConfig" />
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-name">自定义播放高亮颜色</div>
                <div class="setting-desc">覆盖默认提取的专辑主题色，自定逐字跳动高亮</div>
              </div>
              <div class="color-picker-wrapper">
                <el-switch v-model="config.use_custom_color" style="margin-right: 12px;" @change="saveConfig" />
                <el-color-picker
                  v-model="config.custom_color"
                  :disabled="!config.use_custom_color"
                  show-alpha
                  @change="saveConfig"
                />
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-name">翻译/音译字体颜色</div>
                <div class="setting-desc">自定义副歌词文本（翻译/罗马音）显示色彩</div>
              </div>
              <el-color-picker
                v-model="config.custom_trans_color"
                show-alpha
                @change="saveConfig"
              />
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-name">消除未播歌词透明度限制</div>
                <div class="setting-desc">让未播放的歌词行清晰可见</div>
              </div>
              <el-switch v-model="config.disable_subline_opacity" @change="saveConfig" />
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-name">MV 默认清晰度</div>
                <div class="setting-desc">优先请求的哔哩哔哩 MV 画质</div>
              </div>
              <el-select v-model="config.mv_quality" style="width: 140px;" @change="saveConfig">
                <el-option :value="116" label="1080P 60帧" />
                <el-option :value="80" label="1080P 高清" />
                <el-option :value="64" label="720P 高清" />
                <el-option :value="32" label="480P 清晰" />
              </el-select>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-name">MV 画面适应模式</div>
                <div class="setting-desc">视频背景铺满与展示方式</div>
              </div>
              <el-select v-model="config.mv_fit_mode" style="width: 140px;" @change="saveConfig">
                <el-option value="cover" label="裁剪填充 (Cover)" />
                <el-option value="contain" label="完整包含 (Contain)" />
                <el-option value="tile" label="多重平铺 (Tile)" />
              </el-select>
            </div>
          </div>
        </div>

        <!-- 3. 哔哩哔哩账号 -->
        <div v-if="currentTab === 'bilibili'" class="settings-tab-panel">
          <h2 class="panel-title">哔哩哔哩账号</h2>
          <div class="setting-group">
            <!-- 已登录状态 -->
            <div v-if="biliUser.connected" class="bili-profile-card">
              <img :src="biliUser.face || ''" class="bili-avatar" alt="用户头像" />
              <div class="bili-info">
                <div class="bili-name">
                  <span>{{ biliUser.uname || 'B站用户' }}</span>
                  <span v-if="(biliUser.vipType || 0) > 0" class="vip-badge">大会员</span>
                </div>
                <div class="bili-uid">UID: {{ biliUser.mid }}</div>
                <div class="bili-tip">已登录账号，可免费解锁 1080P 及高帧率 MV 播放</div>
              </div>
              <el-button type="danger" plain size="small" @click="handleBiliLogout">
                退出登录
              </el-button>
            </div>

            <!-- 未登录状态 -->
            <div v-else class="bili-login-card">
              <div v-if="!qrCodeDataUrl" class="bili-login-trigger">
                <div class="bili-login-desc">
                  登录 Bilibili 账号可解锁 1080P+ 高码率及 60fps 超清 MV 视频画质。
                </div>
                <el-button type="primary" :loading="qrLoading" @click="startBiliLogin">
                  扫码登录
                </el-button>
              </div>

              <!-- 二维码展示区 -->
              <div v-else class="bili-qr-box">
                <img :src="qrCodeDataUrl" class="bili-qr-img" alt="B站登录二维码" />
                <div class="bili-qr-status">{{ qrStatusText }}</div>
                <div class="bili-qr-hint">请使用哔哩哔哩移动客户端扫码登录</div>
                <el-button size="small" text style="margin-top: 8px;" @click="startBiliLogin">
                  刷新二维码
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. QMusicSupport 组件管理 -->
        <div v-if="currentTab === 'component'" class="settings-tab-panel">
          <h2 class="panel-title">QMusicSupport 组件</h2>
          <div class="setting-group">
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-name">QQ音乐通信支持组件</div>
                <div class="setting-desc">用于捕获 QQ 音乐本地客户端的播放状态、歌词与音量控制</div>
              </div>
              <el-tag :type="componentRunning ? 'success' : 'info'">
                {{ componentRunning ? '服务运行中' : '未连接 (127.0.0.1:12689)' }}
              </el-tag>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-name">重启支持服务</div>
                <div class="setting-desc">若 QQ 音乐切歌后未同步歌词，可尝试重启本地支持进程</div>
              </div>
              <el-button size="small" @click="restartComponent">重启进程</el-button>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-name">检查组件更新</div>
                <div class="setting-desc">
                  最新发布于 GitHub Releases
                  <span v-if="componentUpdateInfo" class="version-tip">
                    (发现新版本: {{ componentUpdateInfo.version }})
                  </span>
                </div>
              </div>
              <el-button
                size="small"
                type="primary"
                plain
                :loading="checkingComponent"
                @click="checkComponentUpdateNow"
              >
                检查更新
              </el-button>
            </div>

            <div v-if="componentUpdateInfo?.has_update" class="update-banner">
              <div class="banner-title">发现新版 QMusicSupport 组件 ({{ componentUpdateInfo.version }})</div>
              <div class="banner-body">{{ componentUpdateInfo.notes || '组件稳定性与解析优化' }}</div>
              <el-button
                type="primary"
                size="small"
                :loading="updatingComponent"
                style="margin-top: 10px;"
                @click="installComponentUpdate"
              >
                一键更新并重启
              </el-button>
            </div>
          </div>
        </div>

        <!-- 5. 程序更新 -->
        <div v-if="currentTab === 'updater'" class="settings-tab-panel">
          <h2 class="panel-title">程序更新</h2>
          <div class="setting-group">
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-name">当前版本</div>
                <div class="setting-desc">QLyrix v{{ appVersion }} (Tauri Edition)</div>
              </div>
              <el-button
                type="primary"
                plain
                size="small"
                :loading="checkingAppUpdate"
                @click="checkAppUpdateNow"
              >
                检查更新
              </el-button>
            </div>

            <div v-if="appUpdateInfo?.has_update" class="update-banner">
              <div class="banner-title">🎉 发现新版本: {{ appUpdateInfo.version }}</div>
              <div class="banner-body">{{ appUpdateInfo.notes }}</div>
              <el-button
                type="primary"
                size="small"
                style="margin-top: 10px;"
                @click="openGitHubRelease"
              >
                前往 GitHub Releases 下载
              </el-button>
            </div>

            <div v-else-if="appUpdateChecked" class="no-update-tip">
              当前已是最新版本！
            </div>
          </div>
        </div>

        <!-- 6. 关于 QLyrix -->
        <div v-if="currentTab === 'about'" class="settings-tab-panel">
          <h2 class="panel-title">关于 QLyrix</h2>
          <div class="about-card">
            <div class="about-logo">🎵</div>
            <div class="about-name">QLyrix</div>
            <div class="about-ver">版本 2.0.0</div>
            <div class="about-intro">
              基于 Tauri v2 + Vue 3 的轻量级 Apple Music 风格歌词与哔哩哔哩 MV 桌面播放器
            </div>

            <div class="about-links">
              <el-button text type="primary" @click="openRepo">
                GitHub 仓库 (icecolaqaq/QLyrix)
              </el-button>
              <el-button text type="primary" @click="openReleasePage">
                版本发布页
              </el-button>
            </div>

            <div class="about-credits">
              <div class="credits-title">致谢与开源项目</div>
              <div class="credits-item">• Apple Music Like Lyrics (AMLL) 核心渲染器</div>
              <div class="credits-item">• QMusicSupport QQ 音乐本地通信协议</div>
              <div class="credits-item">• Tauri 桌面跨平台轻量框架</div>
              <div class="credits-item">• Element Plus UI 组件库</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import QRCode from 'qrcode'
import {
  getAppConfig,
  saveAppConfig,
  startDragging,
  hideWindow,
  showWindow,
  setAutoStart,
  setAlwaysOnTop,
  openExternalLink,
  emitAppEvent,
  restartQMusicSupport,
  checkAppUpdate,
  checkComponentUpdate,
  downloadAndUpdateComponent,
  type AppConfig,
  defaultAppConfig
} from '@/services/tauriBridge'
import { bilibiliService, type BilibiliUser } from '@/services/bilibiliService'
import { qmusicService } from '@/services/qmusicService'

const tabs = [
  { key: 'general', label: '常规设置', icon: '⚙️' },
  { key: 'display', label: '显示与歌词', icon: '🎨' },
  { key: 'bilibili', label: 'B站账号', icon: '📺' },
  { key: 'component', label: '支持组件', icon: '🧩' },
  { key: 'updater', label: '检查更新', icon: '🚀' },
  { key: 'about', label: '关于', icon: 'ℹ️' }
]

const currentTab = ref('general')
const config = ref<AppConfig>({ ...defaultAppConfig })
const appVersion = ref('2.0.0')

// B站登录
const biliUser = ref<BilibiliUser>({ connected: false, mid: null, uname: null, face: null, cookie: '' })
const qrCodeDataUrl = ref('')
const qrStatusText = ref('')
const qrLoading = ref(false)
let biliPollInterval: any = null

// 组件与更新
const componentRunning = ref(true)
const checkingComponent = ref(false)
const updatingComponent = ref(false)
const componentUpdateInfo = ref<any>(null)

const checkingAppUpdate = ref(false)
const appUpdateChecked = ref(false)
const appUpdateInfo = ref<any>(null)

function onStartDrag(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (target?.closest('button, .titlebar-actions, .titlebar-btn')) return
  if (e.button === 0) {
    startDragging()
  }
}

function closeSettings() {
  hideWindow('settings')
}

async function restartOnboarding() {
  await showWindow('main')
  await emitAppEvent('start-onboarding')
  await hideWindow('settings')
}

async function saveConfig() {
  try {
    await saveAppConfig(config.value)
    ElMessage.success('设置已保存')
  } catch (err: any) {
    ElMessage.error(`保存失败: ${err?.message || err}`)
  }
}

async function onAutoStartChange(val: any) {
  await setAutoStart(!!val)
  await saveConfig()
}

async function onAlwaysOnTopChange(val: any) {
  await setAlwaysOnTop('main', !!val)
  await saveConfig()
}

function onIslandToggle(val: any) {
  if (val) {
    void showWindow('island')
  } else {
    void hideWindow('island')
  }
  void saveConfig()
}

// Bilibili Login
async function checkBiliStatus() {
  const user = await bilibiliService.checkUserStatus()
  biliUser.value = user
}

async function startBiliLogin() {
  qrLoading.value = true
  qrStatusText.value = '正在获取登录二维码...'
  if (biliPollInterval) clearInterval(biliPollInterval)

  try {
    const res = await bilibiliService.generateLoginQr()
    if (!res?.url || !res?.qrcode_key) {
      ElMessage.error('获取登录二维码失败')
      qrLoading.value = false
      return
    }

    qrCodeDataUrl.value = await QRCode.toDataURL(res.url, {
      margin: 1,
      width: 180,
      color: { dark: '#000000', light: '#ffffff' }
    })
    qrStatusText.value = '等待扫码中...'
    qrLoading.value = false

    // 轮询二维码扫码状态
    biliPollInterval = setInterval(async () => {
      const pollRes = await bilibiliService.pollLoginQr(res.qrcode_key)
      if (pollRes.status === 'success') {
        clearInterval(biliPollInterval)
        qrCodeDataUrl.value = ''
        qrStatusText.value = ''
        ElMessage.success('Bilibili 登录成功')
        await checkBiliStatus()
      } else if (pollRes.status === 'expired') {
        clearInterval(biliPollInterval)
        qrStatusText.value = '二维码已失效，请重新生成'
      } else if (pollRes.status === 'scanned') {
        qrStatusText.value = '已扫码，请在手机端确认'
      }
    }, 2000)
  } catch (err: any) {
    ElMessage.error(`获取二维码异常: ${err?.message || err}`)
    qrLoading.value = false
  }
}

async function handleBiliLogout() {
  await bilibiliService.logout()
  biliUser.value = { connected: false, mid: null, uname: null, face: null, cookie: '' }
  ElMessage.success('已退出 Bilibili 登录')
}

// 组件管理
async function restartComponent() {
  try {
    const ok = await restartQMusicSupport()
    if (ok) {
      qmusicService.init()
      ElMessage.success('组件已重新启动')
    } else {
      ElMessage.error('组件重启失败')
    }
  } catch (e: any) {
    ElMessage.error(`重启组件异常: ${e?.message || e}`)
  }
}

async function checkComponentUpdateNow() {
  checkingComponent.value = true
  try {
    const res = await checkComponentUpdate()
    componentUpdateInfo.value = res
    if (res?.has_update) {
      ElMessage.info(`发现新版本: ${res.version}`)
    } else {
      ElMessage.success('当前组件已是最新版本')
    }
  } catch (e: any) {
    ElMessage.error(`检查组件更新失败: ${e?.message || e}`)
  } finally {
    checkingComponent.value = false
  }
}

async function installComponentUpdate() {
  if (!componentUpdateInfo.value?.download_url) return
  updatingComponent.value = true
  try {
    const ok = await downloadAndUpdateComponent(componentUpdateInfo.value.download_url)
    if (ok) {
      ElMessage.success('组件更新完成并已启动')
      componentUpdateInfo.value = null
      qmusicService.init()
    } else {
      ElMessage.error('更新失败')
    }
  } catch (e: any) {
    ElMessage.error(`更新过程出错: ${e?.message || e}`)
  } finally {
    updatingComponent.value = false
  }
}

// 程序更新
async function checkAppUpdateNow() {
  checkingAppUpdate.value = true
  try {
    const res = await checkAppUpdate(appVersion.value)
    appUpdateInfo.value = res
    appUpdateChecked.value = true
    if (res?.has_update) {
      ElMessage.info(`发现新版本: ${res.version}`)
    } else {
      ElMessage.success('当前已是最新版本')
    }
  } catch (e: any) {
    ElMessage.error(`检查更新失败: ${e?.message || e}`)
  } finally {
    checkingAppUpdate.value = false
  }
}

function openGitHubRelease() {
  openExternalLink('https://github.com/icecolaqaq/QLyrix/releases')
}

function openRepo() {
  openExternalLink('https://github.com/icecolaqaq/QLyrix')
}

function openReleasePage() {
  openExternalLink('https://github.com/icecolaqaq/QLyrix/releases')
}

onMounted(async () => {
  try {
    const cfg = await getAppConfig()
    config.value = { ...defaultAppConfig, ...cfg }
  } catch (err) {
    console.error('Failed to load app config:', err)
  }
  await checkBiliStatus()
})

onBeforeUnmount(() => {
  if (biliPollInterval) clearInterval(biliPollInterval)
})
</script>

<style scoped>
.settings-container {
  width: 100vw;
  height: 100vh;
  background: rgba(22, 22, 28, 0.94);
  backdrop-filter: blur(35px);
  -webkit-backdrop-filter: blur(35px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #f1f1f1;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  box-sizing: border-box;
}

/* 顶部标题栏 */
.settings-titlebar {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  cursor: grab;
}

.titlebar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.titlebar-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.titlebar-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.close-btn:hover {
  background: #e81123 !important;
  color: #fff !important;
}

/* 主体 */
.settings-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 侧边栏 */
.settings-sidebar {
  width: 180px;
  background: rgba(0, 0, 0, 0.2);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  transition: all 0.15s ease;
}

.sidebar-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.sidebar-item.active {
  background: rgba(99, 102, 241, 0.25);
  color: #818cf8;
  font-weight: 600;
}

.tab-icon {
  font-size: 15px;
}

/* 内容区 */
.settings-content {
  flex: 1;
  padding: 24px 32px;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.settings-content::-webkit-scrollbar {
  width: 6px;
}

.settings-content::-webkit-scrollbar-track {
  background: transparent;
  margin: 8px 0;
}

.settings-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  transition: background 0.2s ease;
}

.settings-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.32);
}

.settings-content::-webkit-scrollbar-thumb:active {
  background: rgba(129, 140, 248, 0.55);
}

.settings-tab-panel {
  max-width: 580px;
}

.panel-title {
  font-size: 18px;
  font-weight: 600;
  margin-top: 0;
  margin-bottom: 20px;
  color: #fff;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-name {
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
}

.setting-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.color-picker-wrapper {
  display: flex;
  align-items: center;
}

/* B站卡片 */
.bili-profile-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.bili-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.bili-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bili-name {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 8px;
}

.vip-badge {
  font-size: 10px;
  background: #fb7299;
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: normal;
}

.bili-uid {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.bili-tip {
  font-size: 11px;
  color: #34d399;
}

.bili-login-card {
  padding: 24px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  text-align: center;
}

.bili-login-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 16px;
}

.bili-qr-box {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bili-qr-img {
  width: 170px;
  height: 170px;
  border-radius: 8px;
  background: #fff;
  padding: 6px;
}

.bili-qr-status {
  font-size: 13px;
  font-weight: 500;
  color: #818cf8;
  margin-top: 10px;
}

.bili-qr-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
}

/* 更新 Banner */
.update-banner {
  padding: 16px;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 10px;
  margin-top: 8px;
}

.banner-title {
  font-size: 14px;
  font-weight: 600;
  color: #818cf8;
}

.banner-body {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 6px;
  white-space: pre-wrap;
}

.no-update-tip {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  padding: 12px;
  text-align: center;
}

/* 关于卡片 */
.about-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.about-logo {
  font-size: 48px;
  margin-bottom: 8px;
}

.about-name {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.about-ver {
  font-size: 12px;
  color: #818cf8;
  margin-top: 2px;
  margin-bottom: 12px;
}

.about-intro {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  max-width: 420px;
  line-height: 1.5;
  margin-bottom: 16px;
}

.about-links {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.about-credits {
  text-align: left;
  width: 100%;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 16px;
}

.credits-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 6px;
}

.credits-item {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.8;
}
</style>
