<template>
  <el-dialog
    v-model="statusDialogVisible"
    title="当前状态与设置"
    width="580px"
    class="status-dialog compact-no-scroll"
    destroy-on-close
    append-to-body
  >
    <div class="status-dialog-content">
      <!-- 1. 曲目信息与运行状态 -->
      <div class="status-card song-header-card">
        <div class="song-cover-wrapper">
          <img v-if="state.albumUrl" :src="state.albumUrl" class="song-cover-img" alt="专辑封面" />
          <div v-else class="song-cover-placeholder">🎵</div>
        </div>
        <div class="song-info-col">
          <div class="song-title-row">
            <span
              class="song-title copyable-text"
              title="点击复制曲目名"
              @click="copyToClipboard(state.title || '无', '曲目')"
            >
              {{ state.title || '未检测到播放曲目' }}
            </span>
            <span v-if="display.tagstr" class="quality-badge" title="当前音质">{{ display.tagstr }}</span>
          </div>
          <div class="song-meta-row">
            <span
              class="copyable-text meta-val"
              title="点击复制艺术家"
              @click="copyToClipboard(state.artist || '未知', '艺术家')"
            >
              {{ state.artist || '未知艺术家' }}
            </span>
            <span class="meta-dot">·</span>
            <span
              class="copyable-text meta-val"
              title="点击复制专辑名"
              @click="copyToClipboard(state.album || '未知', '专辑')"
            >
              {{ state.album || '未知专辑' }}
            </span>
            <span class="meta-dot">·</span>
            <span
              class="copyable-text meta-val mono"
              title="点击复制歌曲ID"
              @click="copyToClipboard(String(state.id || '无'), '歌曲ID')"
            >
              ID: {{ state.id || '无' }}
            </span>
          </div>
        </div>

        <div class="header-badges-col">
          <div class="badges-row">
            <span class="status-badge" :class="state.server === '1' ? 'badge-connected' : 'badge-disconnected'">
              <span class="status-dot"></span>
              {{ state.server === '1' ? '正常' : '未连接' }}
            </span>
            <span class="status-badge badge-playback">{{ state.isPlay ? '播放中' : '暂停' }}</span>
          </div>
          <div
            class="bili-account-badge"
            :class="bilibiliUser.connected ? 'bili-badge-online' : 'bili-badge-offline'"
            :title="bilibiliUser.connected ? 'Bilibili 已登录，点击打开设置' : 'Bilibili 未登录，点击前往设置登录'"
            @click="openSettings"
          >
            <span class="bili-badge-dot"></span>
            <span class="bili-badge-text">
              {{ bilibiliUser.connected ? `B站: ${bilibiliUser.uname || '已登录'}` : 'B站未登录 · 去登录' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 2. 歌词导出与重新加载 -->
      <div class="status-card export-card">
        <div class="section-title">
          <span>歌词工具</span>
          <el-button
            size="small"
            type="primary"
            plain
            :loading="reloadingLyric"
            title="强制刷新并重新获取 QQ 音乐歌词"
            @click="reloadLyricManual"
          >
            重新获取歌词
          </el-button>
        </div>
        <div class="export-actions">
          <span class="export-label">导出当前歌词：</span>
          <el-button size="small" @click="downloadLyricFile('lrc')">LRC 格式</el-button>
          <el-button size="small" @click="downloadLyricFile('qrc')">QRC 逐字</el-button>
          <el-button size="small" @click="downloadLyricFile('txt')">纯文本 TXT</el-button>
        </div>
      </div>

      <!-- 3. MV 视频与画质关联设置 -->
      <div class="status-card mv-settings-card">
        <div class="section-title">
          <span>B站 MV 关联与画面</span>
        </div>
        <div class="form-row">
          <span class="form-label">BV 编号</span>
          <div class="form-control">
            <el-input
              v-model="editMvBvid"
              placeholder="输入 BV 号，如 BV1xx411c7mD"
              size="small"
              class="bvid-input"
              clearable
            />
            <el-button
              type="primary"
              size="small"
              :loading="savingMvBvid"
              @click="saveManualBvidEdit"
            >
              保存关联
            </el-button>
            <el-button
              v-if="currentMvBvid"
              type="danger"
              plain
              size="small"
              @click="deleteMvBinding"
            >
              解除关联
            </el-button>
            <el-button
              v-if="currentMvBvid"
              size="small"
              title="在浏览器中打开该视频"
              @click="openBoundMvLink"
            >
              网页打开
            </el-button>
          </div>
        </div>

        <div class="form-row">
          <span class="form-label">声画延迟</span>
          <div class="form-control sync-control">
            <el-input-number
              v-model="editMvDelay"
              :step="100"
              size="small"
              @change="onEditMvDelayChange"
            />
            <span class="unit-text">毫秒 (ms)</span>
            <div class="sync-buttons">
              <el-button size="small" @click="adjustMvDelay(-1000)">-1s</el-button>
              <el-button size="small" @click="adjustMvDelay(-500)">-0.5s</el-button>
              <el-button size="small" @click="adjustMvDelay(-100)">-0.1s</el-button>
              <el-button size="small" @click="onEditMvDelayChange(0)">重置</el-button>
              <el-button size="small" @click="adjustMvDelay(100)">+0.1s</el-button>
              <el-button size="small" @click="adjustMvDelay(500)">+0.5s</el-button>
              <el-button size="small" @click="adjustMvDelay(1000)">+1s</el-button>
            </div>
          </div>
        </div>

        <div class="form-row">
          <span class="form-label">画面画质</span>
          <div class="form-control">
            <el-select
              v-model="mvQuality"
              placeholder="选择画质"
              size="small"
              style="width: 180px;"
              @change="onMvQualityChange"
            >
              <el-option
                v-for="q in availableMvQualities"
                :key="q.value"
                :label="q.label"
                :value="q.value"
              />
            </el-select>
          </div>
        </div>
      </div>

      <!-- 4. 歌词样式定制 -->
      <div class="status-card lyric-style-card">
        <div class="section-title">
          <span>歌词视觉设置</span>
        </div>
        <div class="form-row">
          <span class="form-label">模糊与配色</span>
          <div class="form-control switch-row">
            <div class="switch-item" title="非当前播放行显示轻微模糊效果">
              <span class="switch-label">歌词模糊</span>
              <el-switch v-model="lyricBlurEnabled" size="small" @change="toggleLyricBlur" />
            </div>
            <div class="switch-item" title="开启后使用自定颜色，关闭时根据专辑封面自动计算主题色">
              <span class="switch-label">自定义配色</span>
              <el-switch :model-value="useCustomColor" size="small" @change="toggleUseCustomColor" />
            </div>

            <template v-if="useCustomColor">
              <div class="color-item">
                <span class="color-label">主歌词</span>
                <el-color-picker
                  v-model="customPlayedColor"
                  show-alpha
                  size="small"
                  @change="onCustomColorChange"
                />
              </div>
              <div class="color-item">
                <span class="color-label">翻译</span>
                <el-color-picker
                  v-model="customTransColor"
                  show-alpha
                  size="small"
                  @change="saveLyricSettings"
                />
              </div>
              <div class="color-item">
                <span class="color-label">音译注音</span>
                <el-color-picker
                  v-model="customRomaColor"
                  show-alpha
                  size="small"
                  @change="saveLyricSettings"
                />
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { state, display, statusDialogVisible } from '@/services/store'
import { qmusicService } from '@/services/qmusicService'
import { bilibiliService, type BilibiliUser } from '@/services/bilibiliService'
import { showWindow, promptSaveFileDialog, saveTextFile } from '@/services/tauriBridge'
import {
  lyricBlurEnabled,
  customPlayedColor,
  customTransColor,
  customRomaColor,
  useCustomColor
} from '@/composables/useLyric'
import {
  mvQuality,
  currentMvBvid,
  editMvBvid,
  editMvDelay,
  savingMvBvid,
  availableMvQualities,
  openBoundMvLink,
  saveManualBvidEdit,
  deleteMvBinding,
  adjustMvDelay,
  onEditMvDelayChange,
  onMvQualityChange
} from '@/composables/useMvMode'

defineProps<{
  copyToClipboard: (text: string, label: string) => void
  saveLyricSettings: () => void
  onCustomColorChange: (val: string | null) => void
  toggleUseCustomColor: () => void
  toggleLyricBlur: () => void
}>()

const reloadingLyric = ref(false)
const bilibiliUser = ref<BilibiliUser>({
  connected: false,
  mid: null,
  uname: null,
  face: null,
  cookie: ''
})

onMounted(async () => {
  bilibiliUser.value = await bilibiliService.init()
})

function openSettings() {
  statusDialogVisible.value = false
  void showWindow('settings')
}

async function reloadLyricManual() {
  if (!state.id) {
    ElMessage.warning('当前无正在播放的歌曲')
    return
  }
  reloadingLyric.value = true
  try {
    await qmusicService.fetchLyrics(state.id)
    ElMessage.success('歌词已刷新')
  } catch {
    ElMessage.error('刷新歌词失败')
  } finally {
    reloadingLyric.value = false
  }
}

async function downloadLyricFile(format: 'lrc' | 'qrc' | 'txt') {
  if (!state.lyricLines.length) {
    ElMessage.warning('当前没有可导出的歌词内容')
    return
  }

  let content = ''
  if (format === 'qrc') {
    content = state.lyricLines
      .map((l) => `[${l.startTime},${l.endTime - l.startTime}]${l.words.map((w) => `${w.word}(${w.startTime},${w.endTime - w.startTime})`).join('')}`)
      .join('\n')
  } else if (format === 'lrc') {
    content = state.lyricLines
      .map((l) => {
        const m = Math.floor(l.startTime / 60000).toString().padStart(2, '0')
        const s = ((l.startTime % 60000) / 1000).toFixed(2).padStart(5, '0')
        return `[${m}:${s}]${l.lyric}`
      })
      .join('\n')
  } else {
    content = state.lyricLines.map((l) => l.lyric).join('\n')
  }

  const filename = `${state.title} - ${state.artist}.${format}`
  const savePath = await promptSaveFileDialog(
    '保存歌词文件',
    filename,
    [{ name: `${format.toUpperCase()} 歌词文件`, extensions: [format] }]
  )

  if (savePath) {
    try {
      await saveTextFile(savePath, content)
      ElMessage.success('歌词文件已成功保存')
    } catch (e: any) {
      ElMessage.error(`保存失败: ${e?.message || e}`)
    }
  }
}
</script>

<style scoped>
.status-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: #f1f5f9;
}

.status-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 12px 14px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.9);
}

.song-header-card {
  display: flex;
  align-items: center;
  gap: 12px;
}

.song-cover-img {
  width: 54px;
  height: 54px;
  border-radius: 6px;
  object-fit: cover;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.song-cover-placeholder {
  width: 54px;
  height: 54px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.song-info-col {
  flex: 1;
  min-width: 0;
}

.song-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.song-title {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quality-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #3b82f6;
  color: #fff;
}

.song-meta-row {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.meta-dot {
  opacity: 0.5;
}

.copyable-text {
  cursor: pointer;
}
.copyable-text:hover {
  color: #60a5fa;
}

.header-badges-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.badges-row {
  display: flex;
  gap: 6px;
}

.status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.badge-connected {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.badge-disconnected {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.bili-account-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: opacity 0.2s;
}
.bili-account-badge:hover {
  opacity: 0.85;
}

.bili-badge-online {
  background: rgba(251, 114, 153, 0.2);
  color: #fb7299;
}

.bili-badge-offline {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.5);
}

.bili-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.form-row {
  display: flex;
  align-items: center;
  margin-top: 8px;
}

.form-label {
  width: 70px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
}

.form-control {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.bvid-input {
  width: 190px;
}

.sync-buttons {
  display: flex;
  gap: 4px;
}

.unit-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.export-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.export-label {
  color: rgba(255, 255, 255, 0.6);
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.switch-item, .color-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
</style>
