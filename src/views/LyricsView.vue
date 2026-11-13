<template>
  <div
    class="window-controls"
    :style="{ opacity: controlsVisible ? 1 : 0 }"
    @mouseenter="controlsVisible = true"
    @mouseleave="controlsVisible = false"
  >
    <div class="drag-area" @mousedown="onStartDrag"></div>
    <div class="controls-buttons">
      <!-- 切换MV模式 -->
      <button
        :class="['btn-mv-mode', { 'btn-mv-active': mvModeEnabled }]"
        title="切换MV模式"
        @click="toggleMvMode"
      >
        <el-icon :size="13">
          <svg
            class="icon"
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            width="200"
            height="200"
          >
            <path
              d="M807.538 408.872l-99.22 231.336c-5.233 12.162-16.68 19.405-28.892 19.837a86.04 86.04 0 0 1-2.907 0c-12.311-0.416-23.858-7.66-29.108-19.837L561.499 441.17v185.847c0 18.359-14.87 33.228-33.228 33.228s-33.23-14.87-33.23-33.228V527.93l-66.755 115.618c-6.396 11.081-18.208 16.93-30.154 16.448-11.43 0.482-22.745-5.367-28.86-16.448l-73.601-133.28v116.749c0 18.359-14.87 33.228-33.229 33.228s-33.229-14.87-33.229-33.228V394.418c0-18.36 14.87-33.229 33.23-33.229 14.104 0 26.067 8.822 30.902 21.2 4.719 2.824 104.786 180.48 104.786 180.48l96.91-167.853s14.87-33.827 33.229-33.827c10.051 0 18.94 4.553 25.037 11.597 3.09-3.538 6.895-6.53 11.414-8.573 16.83-7.642 36.435-0.016 43.778 17.013l69.447 160.908 69.015-160.908c7.31-17.03 26.799-24.656 43.53-17.013 16.714 7.626 24.357 27.63 17.047 44.66z"
              fill="#ffffff"
            ></path>
            <path
              d="M927.011 294.733c0-82.573-66.939-149.528-149.528-149.528H245.83c-82.59 0-149.528 66.955-149.528 149.528v431.969c0 82.589 66.939 149.527 149.528 149.527h531.653c82.59 0 149.528-66.938 149.528-149.527v-431.97zM794.097 942.686H229.214c-110.102 0-199.37-89.268-199.37-199.37V278.117c0-110.102 89.268-199.37 199.37-199.37h564.883c110.102 0 199.37 89.268 199.37 199.37v465.197c0 110.103-89.268 199.371-199.37 199.371z"
              fill="#ffffff"
            ></path>
          </svg>
        </el-icon>
      </button>

      <!-- 窗口置顶 -->
      <button
        :class="['btn-pin', { active: isAlwaysOnTop }]"
        title="窗口置顶"
        @click="toggleAlwaysOnTop"
      >
        <el-icon :size="13">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />
          </svg>
        </el-icon>
      </button>

      <!-- 切换桌面灵动岛 -->
      <button class="btn-island" title="切换灵动岛" @click="toggleIsland">
        <el-icon :size="13">
          <svg
            class="icon"
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            width="200"
            height="200"
          >
            <path
              d="M565.248 844.8h-373.76a25.6 25.6 0 0 1-25.6-25.6V195.328a25.6 25.6 0 0 1 25.6-25.6H814.08a25.6 25.6 0 0 1 25.6 25.6v370.944a25.6 25.6 0 1 0 51.2 0V195.328a76.8 76.8 0 0 0-76.8-76.8H191.488a76.8 76.8 0 0 0-76.8 76.8V819.2a76.8 76.8 0 0 0 76.8 76.8h373.76a25.6 25.6 0 0 0 0-51.2z"
              fill="#ffffff"
            ></path>
            <path
              d="M691.2 640h153.6q51.2 0 51.2 51.2v153.6q0 51.2-51.2 51.2H691.2q-51.2 0-51.2-51.2V691.2q0-51.2 51.2-51.2z"
              fill="#ffffff"
            ></path>
          </svg>
        </el-icon>
      </button>

      <!-- 打开设置窗口 -->
      <button class="btn-settings" title="设置" @click="openSettings">
        <el-icon :size="13"><Setting /></el-icon>
      </button>

      <!-- 窗口操作按钮 -->
      <button class="btn-fullscreen" title="全屏" @click="fullscreenWindow">
        <el-icon :size="13"><FullScreen /></el-icon>
      </button>
      <button class="btn-minimize" title="最小化" @click="minimizeWindow">
        <el-icon :size="13"><Minus /></el-icon>
      </button>
      <button class="btn-maximize" title="最大化" @click="maximizeWindow">
        <el-icon :size="13"><Plus /></el-icon>
      </button>
      <button class="btn-close" title="关闭" @click="closeWindow">
        <el-icon :size="13"><Close /></el-icon>
      </button>
    </div>
  </div>

  <!-- 动态背景 -->
  <BackgroundRender
    v-if="!mvModeEnabled || !mvVideoBgEnabled || !mvVideoUrl"
    ref="bgRef"
    :album="state.albumUrl"
    :album-is-video="false"
    :playing="state.isPlay"
    :has-lyric="state.lyricLines.length > 0"
    :fps="60"
    :flow-speed="3"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%"
  />

  <!-- MV 视频背景 -->
  <div v-if="mvModeEnabled && mvVideoBgEnabled" class="mv-background-container">
    <video
      ref="mvVideoRef"
      class="mv-video"
      :style="{
        filter:
          mvFitMode !== 'tile' && mvBlurEnabled && mvBlurValue > 0
            ? `blur(${mvBlurValue}px) saturate(140%) brightness(0.92)`
            : 'none',
        transform: mvVideoTransform,
        objectFit: mvFitMode === 'tile' ? 'contain' : (mvFitMode as any),
        opacity: mvFitMode === 'tile' ? 0 : 1,
        visibility: mvVideoUrl ? 'visible' : 'hidden'
      }"
      muted
      autoplay
      playsinline
      disablePictureInPicture
      disableRemotePlayback
      @loadedmetadata="onVideoLoadedMetadata"
      @loadeddata="onVideoLoadedData"
      @waiting="onVideoWaiting"
      @playing="onVideoPlaying"
      @seeking="onVideoSeeking"
      @seeked="onVideoSeeked"
      @canplay="onVideoCanPlay"
      @error="onVideoError"
    ></video>
    <canvas
      v-if="mvFitMode === 'tile'"
      ref="mvTileCanvasRef"
      class="mv-video mv-tile-canvas"
      :style="{
        filter:
          mvBlurEnabled && mvBlurValue > 0
            ? `blur(${mvBlurValue}px) saturate(140%) brightness(0.92)`
            : 'none',
        transform: mvVideoTransform,
        visibility: mvVideoUrl ? 'visible' : 'hidden'
      }"
    ></canvas>
    <div class="mv-dark-overlay" :style="{ '--mv-overlay-color': mvOverlayColor }"></div>
    <div v-if="mvLoading" class="mv-loading-overlay">
      <div class="mv-loading-content">
        <div class="mv-loading-spinner"></div>
        <span class="mv-loading-text">视频加载中...</span>
      </div>
    </div>
  </div>

  <!-- 主界面内容区 -->
  <div
    class="base_container"
    :class="{ 'mv-mode-active': mvModeEnabled }"
    style="height: 100%; width: 100%; position: absolute; top: 0; left: 0; z-index: 5000"
  >
    <!-- MV 顶部歌曲信息 -->
    <MvTopInfo
      v-if="mvModeEnabled"
      :cover-anim-type="coverAnimType"
      :save-album-image="saveAlbumImage"
      :copy-song-info="copySongInfo"
    />

    <!-- MV 底部控制栏 -->
    <MvBottomBar
      v-if="mvModeEnabled"
      :show-status-dialog="showStatusDialog"
      :save-lyric-settings="saveLyricSettings"
      :on-subtitle-mode-change="onSubtitleModeChange"
    />

    <!-- Pixi 粒子特效字幕 -->
    <PixiSubtitles
      v-if="showLyric && mvModeEnabled && subtitleMode && state.lyricLines.length > 0"
      :lyric-lines="state.lyricLines"
      :current-time="displayedLyricCurrentTime"
      :playing="state.isPlay"
      :played-color="
        useCustomColor && customPlayedColor
          ? customPlayedColor
          : lyricTheme.playedColor || '#ff6b9d'
      "
      default-color="rgba(255,255,255,0.5)"
      :effect="activeSubtitleEffect"
      :trans-color="customTransColor || 'rgba(255,255,255,0.35)'"
    />

    <el-row :gutter="24" style="height: 100%">
      <!-- 常规模式左侧面板 -->
      <el-col v-if="normalmode && !mvModeEnabled" :span="10">
        <NormalModePanel
          :cover-anim-type="coverAnimType"
          :show-status-dialog="showStatusDialog"
          :save-album-image="saveAlbumImage"
          :copy-song-info="copySongInfo"
        />
      </el-col>

      <!-- 歌词主展示区 -->
      <el-col :span="normalmode && !mvModeEnabled ? 14 : 24">
        <div class="box_right">
          <!-- 迷你模式顶部栏 -->
          <div v-if="!normalmode && !mvModeEnabled" class="song_play_info">
            <div class="mini_info">
              <div class="play_container_topbar_mini">
                <MiniBar
                  :on-close="closeWindow"
                  :on-maximize="maximizeWindow"
                  :on-minimize="minimizeWindow"
                  :on-fullscreen="fullscreenWindow"
                />
              </div>

              <el-row class="mini_container" :gutter="20">
                <el-col :span="8">
                  <div
                    class="song_album_mini"
                    :class="{ 'is-paused': !state.isPlay }"
                  >
                    <CoverTransition
                      :src="state.albumUrl"
                      :alt="'专辑封面'"
                      :animation-type="coverAnimType"
                      :duration="500"
                    />
                  </div>
                </el-col>
                <el-col :span="14">
                  <div class="song_info_container_mini">
                    <div class="song_info_mini">
                      <div class="song_name">
                        {{ state.title }}
                        <span
                          v-if="getMvMappingForCurrentSong()"
                          class="song_mv_tag"
                          title="点击打开关联的 B站 MV 网页"
                          @click.stop="openBoundMvLink"
                        >
                          MV
                        </span>
                        <span
                          v-if="getMvMappingForCurrentSong() && currentMvQualityLabel"
                          class="song_quality_tag"
                          title="当前 MV 画面质量"
                        >
                          {{ currentMvQualityLabel }}
                        </span>
                      </div>
                      <div class="song_artist">
                        {{ state.artist }}
                      </div>
                    </div>
                  </div>
                </el-col>
                <el-col :span="2">
                  <div class="menubutton_mini" @click="showStatusDialog">
                    <div class="menubutton_text_mini">...</div>
                  </div>
                </el-col>
              </el-row>
            </div>
          </div>

          <!-- AMLL 歌词播放器容器 -->
          <div
            class="Lyric_container"
            :class="{
              'hide-main-lyric': mvModeEnabled && !showMainLyric,
              'subtitle-mode-active': mvModeEnabled && subtitleMode,
              'hide-all-lyrics': mvModeEnabled && !showLyric
            }"
            :data-disable-subline-opacity="disableSublineOpacity"
            :style="{ transform: `${display.Lyricscale}` }"
            @wheel.passive="handleLyricWheel"
          >
            <LyricPlayer
              :key="lyricPlayerRenderKey"
              ref="playerRef"
              :lyric-lines="state.lyricLines"
              :current-time="displayedLyricCurrentTime"
              :playing="state.isPlay"
              :disabled="mvModeEnabled && (subtitleMode || !showLyric)"
              :enable-spring="!mvModeEnabled"
              :enable-blur="!mvModeEnabled && lyricBlurEnabled"
              :style="lyricPlayerStyle"
              @line-click="
                (e) => {
                  lineclinkWithPreview(e.line.getLine().startTime)
                }
              "
            ></LyricPlayer>
            <div
              v-if="state.isPureMusic && state.lyricLines.length === 0"
              class="pure-music-lyric"
            >
              此歌曲为没有填词的纯音乐，请您欣赏
            </div>
          </div>

          <!-- 缩放提示 -->
          <Transition name="fade">
            <div v-if="showLyricFontSizeTip" class="lyric-font-size-tip">
              {{ lyricFontSizeTipText }}
            </div>
          </Transition>
        </div>
      </el-col>
    </el-row>
  </div>

  <!-- 常规模式底部语言切换按钮 (已按需求去除下载歌曲功能) -->
  <div v-if="normalmode && !mvModeEnabled" class="bottonbuttons">
    <div class="button_share" style="margin-left: 3%;" title="分享" @click="() => {}">
      <el-icon :size="26">
        <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="200" height="200">
          <path
            d="M512 618.666667l213.333333 256H298.666667l213.333333-256z"
            fill="#ffffff60"
          />
          <path
            d="M512 149.333333c188.501333 0 341.333333 152.832 341.333333 341.333334 0 98.218667-41.514667 186.794667-107.946666 249.045333l-45.738667-48.896C754.218667 639.701333 789.333333 569.173333 789.333333 490.666667c0-153.173333-124.16-277.333333-277.333333-277.333334S234.666667 337.493333 234.666667 490.666667c0 78.506667 35.114667 149.034667 89.685333 200.106666l-45.738667 48.896C212.181333 677.461333 170.666667 588.885333 170.666667 490.666667c0-188.501333 152.832-341.333333 341.333333-341.333334z"
            fill="#ffffff60"
          />
          <path
            d="M512 277.333333c117.802667 0 213.333333 95.530667 213.333333 213.333334 0 60.501333-25.216 115.114667-65.664 153.941333l-44.373333-47.445333C643.84 569.728 661.333333 532.224 661.333333 490.666667c0-82.474667-66.858667-149.333333-149.333333-149.333334s-149.333333 66.858667-149.333333 149.333334c0 41.557333 17.493333 79.061333 46.037333 106.496l-44.373333 47.445333C323.882667 605.781333 298.666667 551.168 298.666667 490.666667c0-117.802667 95.530667-213.333333 213.333333-213.333334z"
            fill="#ffffff60"
          />
          <path
            d="M512 405.333333a85.333333 85.333333 0 1 1 0 170.666667 85.333333 85.333333 0 0 1 0-170.666667z"
            fill="#ffffff60"
          />
        </svg>
      </el-icon>
    </div>
    <div class="button_right" style="margin-right: 3%; width: auto; margin-left: auto; display: flex; gap: 8px;">
      <!-- 翻译开关 -->
      <div class="button_translate" title="显示/隐藏翻译" @click="showtranslate">
        <el-icon :size="28">
          <svg
            class="icon"
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            width="200"
            height="200"
          >
            <path
              d="M677.676657 294.6142c19.165116 57.5433 44.715939 102.2992 89.431879 147.0551 38.322239-38.3622 63.873063-89.5118 83.038178-147.0551h-172.470057z m-421.56861 319.685h166.076358l-83.038179-223.7795-83.038179 223.7795z"
              fill="#ffffff60"
            ></path>
            <path
              d="M894.854661 0.504H128.353929C58.095158 0.504 0.607803 58.0473 0.607803 128.378v767.244c0 70.3307 57.487355 127.874 127.746126 127.874h766.500733c70.258771 0 127.746126-57.5433 127.746126-127.874V128.378c0-70.3307-51.101647-127.874-127.746126-127.874zM581.867062 825.2913c-12.771416 12.7874-25.550824 12.7874-38.322239 12.7874-6.3937 0-19.165116 0-25.550824-6.3937-6.3937-6.3937-12.779408 0-12.779408-6.3937s-6.385708-12.7874-12.771415-25.5748c-6.3937-12.7874-6.3937-19.1811-12.779408-31.9685l-25.542832-70.3307H230.557224L205.0064 767.748c-12.771416 25.5748-19.165116 44.7559-25.550824 57.5433-6.3937 12.7874-19.165116 12.7874-38.322239 12.7874-12.779408 0-25.550824-6.3937-38.330231-12.7874-12.771416-12.7874-19.157124-19.1811-19.157124-31.9685 0-6.3937 0-12.7874 6.385708-25.5748 6.3937-12.7874 6.3937-19.1811 12.771416-31.9685l140.525533-358.0472c6.3937-12.7874 6.3937-25.5748 12.779408-38.3622 6.385708-12.7874 12.771416-25.5748 19.157124-31.9685 6.3937-6.3937 12.779408-19.1811 25.550823-25.5748 12.779408-6.3937 25.550824-6.3937 38.330232-6.3937 12.771416 0 25.542832 0 38.322239 6.3937 12.771416 6.3937 19.165116 12.7874 25.550824 25.5748 6.385708 6.3937 12.771416 19.1811 19.157124 31.9685 6.3937 12.7874 12.779408 25.5748 19.165115 44.7559l140.525534 351.6535c12.771416 25.5748 19.165116 44.7559 19.165116 57.5433-6.3937 6.3937-12.779408 19.1811-19.165116 31.9685zM933.176901 575.937c-70.258771-25.5748-121.360418-57.5433-166.076358-95.9055-44.707947 44.7559-102.195302 76.7244-172.462065 95.9055l-19.157124-31.9685c70.258771-19.1811 127.746126-44.7559 172.462066-89.5118C703.22748 409.7008 664.905241 352.1575 652.125833 288.2205h-63.873063v-25.5748h172.470058c-12.7874-19.1811-25.558816-44.7559-38.330232-63.937l19.157124-6.3937c12.779408 19.1811 31.944524 44.7559 44.715939 70.3307h159.682658v31.9685h-63.873063c-19.157124 63.937-51.093655 121.4803-89.423887 159.8425 44.715939 38.3622 95.809594 70.3307 166.076358 89.5118l-25.550824 31.9685z"
              fill="#ffffff60"
            ></path>
          </svg>
        </el-icon>
      </div>

      <!-- 罗马音/音译开关 -->
      <div class="button_roma" title="显示/隐藏罗马音" @click="showroma">
        <el-icon :size="28">
          <svg
            class="icon"
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            width="200"
            height="200"
          >
            <path
              d="M540.621118 279.850932c19.080745 31.801242 38.161491 63.602484 76.322981 82.683229 38.161491-25.440994 69.962733-50.881988 89.043479-82.683229H540.621118z"
              fill="#ffffff60"
            ></path>
            <path
              d="M903.15528 12.720497H120.84472C57.242236 12.720497 6.360248 63.602484 6.360248 127.204969v782.310559c0 63.602484 50.881988 114.484472 114.484472 114.484472h782.31056c63.602484 0 114.484472-50.881988 114.484472-114.484472V127.204969c0-63.602484-50.881988-114.484472-114.484472-114.484472z m-629.664597 190.807453c44.521739 31.801242 82.68323 69.962733 114.484472 101.763975l-44.521739 44.52174c-25.440994-31.801242-63.602484-63.602484-114.484472-101.763976l44.521739-44.521739z m6.360249 610.583851l-25.440994-57.242236c12.720497-12.720497 19.080745-25.440994 19.080745-38.16149v-254.409938H197.167702v-63.602485h146.285714v279.850932l57.242236-57.242236 19.080746 69.962733c-50.881988 44.521739-89.043478 89.043478-139.925466 120.84472z m527.900621-89.043478H636.024845v120.84472H572.42236v-120.84472H419.776398v-63.602484H572.42236v-63.602485H445.217391v-63.602484h127.204969v-57.242236h63.602485v57.242236h133.565217v57.242236H636.024845v63.602484h165.366459c6.360248 6.360248 6.360248 69.962733 6.360249 69.962733z m-6.360249-235.329193c-76.322981-6.360248-139.925466-25.440994-190.807453-57.242236-50.881988 25.440994-114.484472 44.521739-190.807453 63.602485L387.975155 445.217391c63.602484-12.720497 120.84472-31.801242 165.36646-50.881987-38.161491-31.801242-63.602484-69.962733-76.322981-114.484472h-44.52174v-57.242236h337.093168v57.242236c-19.080745 44.521739-50.881988 89.043478-95.403727 120.84472 38.161491 12.720497 89.043478 25.440994 152.645963 31.801242l-25.440994 57.242236z"
              fill="#ffffff60"
            ></path>
          </svg>
        </el-icon>
      </div>
    </div>
  </div>

  <!-- 全屏退出提示 -->
  <Transition name="fade">
    <div v-if="showEscPrompt" class="escexitprompt">按 ESC 退出全屏</div>
  </Transition>

  <!-- 状态及歌词设置弹窗 -->
  <StatusDialog
    :copy-to-clipboard="copyToClipboard"
    :save-lyric-settings="saveLyricSettings"
    :on-custom-color-change="onCustomColorChange"
    :toggle-use-custom-color="toggleUseCustomColor"
    :toggle-lyric-blur="toggleLyricBlur"
  />

  <!-- MV 搜索弹窗 -->
  <MvSearchDialog />

  <!-- 新手功能引导 -->
  <OnboardingGuide :visible="showOnboarding" @complete="onOnboardingComplete" />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, onBeforeUnmount } from 'vue'
import { BackgroundRender, type BackgroundRenderRef } from '@/components/BackgroundRender'
import { LyricPlayer, type LyricPlayerRef } from '@/components/LyricPlayer'
import '@applemusic-like-lyrics/core/style.css'
import { ElMessage } from 'element-plus'
import { Minus, Close, Plus, FullScreen, Setting } from '@element-plus/icons-vue'
import MiniBar from '@/components/MiniBar.vue'
import CoverTransition from '@/components/CoverTransition.vue'
import PixiSubtitles from '@/components/PixiSubtitles.vue'
import MvTopInfo from '@/components/MvTopInfo.vue'
import MvBottomBar from '@/components/MvBottomBar.vue'
import NormalModePanel from '@/components/NormalModePanel.vue'
import StatusDialog from '@/components/StatusDialog.vue'
import MvSearchDialog from '@/components/MvSearchDialog.vue'
import OnboardingGuide from '@/components/OnboardingGuide.vue'
import '@/styles/qmusic.scss'

import {
  state,
  display,
  translate,
  roma,
  showMainLyric,
  showLyric,
  isAlwaysOnTop,
  controlsVisible,
  showEscPrompt,
  normalmode,
  statusDialogVisible,
  subtitleMode,
  subtitleEffect,
  subtitleFontSize,
  activeSubtitleEffect,
  type SubtitleEffect
} from '@/services/store'

import {
  lyricTheme,
  lyricBlurEnabled,
  customPlayedColor,
  customTransColor,
  customRomaColor,
  disableSublineOpacity,
  useCustomColor,
  showLyricFontSizeTip,
  lyricFontSizeTipText,
  lyricPlayerRenderKey,
  displayedLyricCurrentTime,
  lyricPlayerStyle,
  viewportWidth,
  viewportHeight,
  refreshLyricTheme,
  showtranslate,
  showroma,
  handleLyricWheel,
  syncLyricSeekPreview,
  bumpLyricPlayerRenderKey,
  onLyricCleanup
} from '@/composables/useLyric'

import {
  mvModeEnabled,
  mvBlurEnabled,
  mvVideoUrl,
  mvVideoRef,
  currentMvQualityLabel,
  mvBlurValue,
  mvVideoTransform,
  mvFitMode,
  mvOverlayColor,
  mvVideoBgEnabled,
  syncMvVideoProgress,
  syncMvPlayState,
  toggleMvMode,
  getMvMappingForCurrentSong,
  openBoundMvLink,
  loadMvSettings,
  onMvCleanup,
  mvLoading,
  onVideoWaiting,
  onVideoPlaying,
  onVideoSeeking,
  onVideoSeeked,
  onVideoCanPlay,
  onVideoLoadedData,
  onVideoError,
  onVideoLoadedMetadata
} from '@/composables/useMvMode'

import {
  playerplay,
  playernext,
  playerprev,
  lineclink,
  minimizeWindow,
  maximizeWindow,
  closeWindow,
  fullscreenWindow,
  toggleAlwaysOnTop
} from '@/composables/usePlayerControls'

import { useMvTileRenderer } from '@/composables/useMvTile'
import {
  getAppConfig,
  saveAppConfig,
  toggleWindow,
  showWindow,
  startDragging,
  saveBinaryFile,
  listenAppEvent
} from '@/services/tauriBridge'

const mvTileCanvasRef = ref<HTMLCanvasElement | null>(null)
useMvTileRenderer(
  mvVideoRef,
  mvTileCanvasRef,
  computed(() => mvModeEnabled.value && mvVideoBgEnabled.value && mvFitMode.value === 'tile')
)

const coverAnimType = ref<'dissolve' | 'expand'>('expand')
const bgRef = ref<BackgroundRenderRef>()
const playerRef = ref<LyricPlayerRef>()
const showOnboarding = ref(false)
let unlistenOnboarding: (() => void) | null = null

async function onOnboardingComplete() {
  showOnboarding.value = false
  await saveAppConfig({ onboarding_completed: true })
}

function onStartDrag(e: MouseEvent) {
  if (e.button === 0) {
    startDragging()
  }
}

function toggleIsland() {
  toggleWindow('island')
}

function openSettings() {
  showWindow('settings')
}

function showStatusDialog() {
  statusDialogVisible.value = true
}

function lineclinkWithPreview(timestampMs: number) {
  lineclink(timestampMs)
  syncLyricSeekPreview(timestampMs)
}

function copyToClipboard(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => ElMessage.success('已复制到剪贴板'))
    .catch(() => ElMessage.error('复制失败'))
}

async function saveAlbumImage() {
  if (!state.albumUrl) {
    ElMessage.warning('暂无专辑封面')
    return
  }
  try {
    const res = await fetch(state.albumUrl)
    const blob = await res.blob()
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      const filename = `${state.title || 'album'} - ${state.artist || 'cover'}.jpg`
      await saveBinaryFile(filename, base64)
      ElMessage.success('专辑封面已保存')
    }
    reader.readAsDataURL(blob)
  } catch (e: any) {
    ElMessage.error(`保存封面失败: ${e?.message || e}`)
  }
}

function copySongInfo() {
  const info = `${state.title} - ${state.artist}`
  copyToClipboard(info)
}

function onSubtitleModeChange() {
  saveLyricSettings()
}

function toggleLyricBlur() {
  lyricBlurEnabled.value = !lyricBlurEnabled.value
  bumpLyricPlayerRenderKey()
  saveLyricSettings()
}

function toggleUseCustomColor() {
  useCustomColor.value = !useCustomColor.value
  bumpLyricPlayerRenderKey()
  saveLyricSettings()
}

function onCustomColorChange(color: string | null) {
  customPlayedColor.value = color || ''
  bumpLyricPlayerRenderKey()
  saveLyricSettings()
}

async function saveLyricSettings() {
  try {
    await saveAppConfig({
      blur_enabled: lyricBlurEnabled.value,
      custom_color: customPlayedColor.value,
      custom_trans_color: customTransColor.value,
      custom_roma_color: customRomaColor.value,
      disable_subline_opacity: disableSublineOpacity.value,
      use_custom_color: useCustomColor.value,
      subtitle_mode: subtitleMode.value,
      subtitle_font_size: subtitleFontSize.value
    })
  } catch (e) {
    console.error('Failed to save lyric settings:', e)
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    fullscreenWindow()
  }
}

function handleResize() {
  viewportWidth.value = window.innerWidth
  viewportHeight.value = window.innerHeight

  if (window.innerWidth < 890 || window.innerWidth / window.innerHeight <= 1) {
    normalmode.value = false
    display.Lyricscale = 'scale(1)'
  } else {
    normalmode.value = true
    display.Lyricscale = 'scale(1.2)'
  }
}

watch(
  () => state.albumUrl,
  (url) => {
    void refreshLyricTheme(url)
  },
  { immediate: true }
)

watch(
  () => state.currentTime,
  (t) => {
    if (mvModeEnabled.value) {
      syncMvVideoProgress(t)
    }
  }
)

watch(
  () => state.isPlay,
  (playing) => {
    if (mvModeEnabled.value) {
      syncMvPlayState(playing)
    }
  }
)

onMounted(async () => {
  handleResize()
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('resize', handleResize)

  // 读取已保存设置
  try {
    const cfg = await getAppConfig()
    lyricBlurEnabled.value = cfg.blur_enabled
    customPlayedColor.value = cfg.custom_color || ''
    customTransColor.value = cfg.custom_trans_color || ''
    customRomaColor.value = cfg.custom_roma_color || ''
    disableSublineOpacity.value = cfg.disable_subline_opacity
    useCustomColor.value = cfg.use_custom_color
    subtitleMode.value = cfg.subtitle_mode
    if (cfg.subtitle_font_size) {
      subtitleFontSize.value = cfg.subtitle_font_size
    }
    if (!cfg.onboarding_completed) {
      showOnboarding.value = true
    }
  } catch (err) {
    console.error('Failed to load initial settings:', err)
  }

  unlistenOnboarding = await listenAppEvent('start-onboarding', () => {
    showOnboarding.value = true
  })

  await loadMvSettings()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('resize', handleResize)
  if (unlistenOnboarding) {
    unlistenOnboarding()
    unlistenOnboarding = null
  }
  onLyricCleanup()
  onMvCleanup()
})
</script>
