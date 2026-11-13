<template>
  <div
    class="mv-bottom-controls-bar"
    :class="{ 'mv-ui-hidden': !mvUiVisible }"
    @mouseenter="onMvControlsMouseEnter"
    @mouseleave="onMvControlsMouseLeave"
  >
    <div class="mv-ctrl-buttons">
      <button class="mv-ctrl-btn" title="喜欢" @click="nofunciton">
        <el-icon :size="16"
          ><svg viewBox="0 0 1024 1024" fill="currentColor">
            <path
              d="M512 896a42.667 42.667 0 0 1-30.293-12.373L135.467 537.387c-67.414-67.414-67.414-177.067 0-244.48 67.413-67.413 177.066-67.413 244.48 0L512 424.96l132.053-132.053c67.414-67.414 177.067-67.414 244.48 0 67.414 67.413 67.414 177.066 0 244.48l-346.24 346.24A42.667 42.667 0 0 1 512 896z"
            /></svg
        ></el-icon>
      </button>
      <button class="mv-ctrl-btn" title="手动关联MV" @click="openMvSearch">
        <el-icon :size="16"><Search /></el-icon>
      </button>

      <el-popover
        ref="blurPopoverRef"
        placement="top"
        :width="220"
        trigger="contextmenu"
        popper-style="background: rgba(20,20,20,0.95); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 12px; color: #fff;"
        @show="onPopoverShow('blur')"
      >
        <template #reference>
          <button
            :class="['mv-ctrl-btn', { 'btn-mv-active': mvBlurEnabled }]"
            title="背景模糊 (右键调整)"
            @click="toggleMvBlur"
          >
            <el-icon :size="16"
              ><svg viewBox="0 0 1024 1024" fill="currentColor">
                <path
                  d="M512 85.333c-235.648 0-426.667 191.019-426.667 426.667s191.019 426.667 426.667 426.667 426.667-191.019 426.667-426.667S747.648 85.333 512 85.333zm0 768c-188.587 0-341.333-152.747-341.333-341.333S323.413 170.667 512 170.667 853.333 323.413 853.333 512 700.587 853.333 512 853.333zM341.333 512a170.667 170.667 0 1 0 341.334 0 170.667 170.667 0 1 0-341.334 0z"
                /></svg
            ></el-icon>
          </button>
        </template>
        <div style="display: flex; flex-direction: column; gap: 12px">
          <div
            style="
              font-size: 12px;
              font-weight: bold;
              border-bottom: 1px solid rgba(255, 255, 255, 0.1);
              padding-bottom: 4px;
              margin-bottom: 4px;
            "
          >
            背景填充设置
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px">
            <span style="font-size: 11px; color: rgba(255, 255, 255, 0.6)">填充方式</span>
            <div class="fit-mode-group">
              <button
                v-for="m in MV_FIT_MODES"
                :key="m.value"
                :class="['fit-mode-btn', { active: mvFitMode === m.value }]"
                :title="fitModeTitles[m.value]"
                @click="setMvFitMode(m.value)"
              >
                {{ m.label }}
              </button>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px">
            <span style="font-size: 11px; color: rgba(255, 255, 255, 0.6)">画面镜像</span>
            <div class="mirror-btn-group">
              <button
                type="button"
                :class="['mirror-btn', { active: mvMirrorH }]"
                title="水平翻转（左右镜像）"
                @click="toggleMirrorH"
              >
                左右镜像
              </button>
              <button
                type="button"
                :class="['mirror-btn', { active: mvMirrorV }]"
                title="垂直翻转（上下镜像）"
                @click="toggleMirrorV"
              >
                上下镜像
              </button>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px">
            <div style="display: flex; align-items: center; justify-content: space-between">
              <div style="display: inline-flex; align-items: center; font-size: 11px; color: rgba(255, 255, 255, 0.6)">
                <span>模糊度:&nbsp;</span>
                <div v-if="isEditingBlur" style="display: inline-flex; align-items: center; gap: 2px;">
                  <input
                    ref="blurInputRef"
                    v-model="blurInputVal"
                    type="number"
                    min="0"
                    max="200"
                    class="popover-inline-input"
                    @blur="commitBlurInput"
                    @keydown.enter.prevent="commitBlurInput"
                    @keydown.esc.prevent="cancelBlurInput"
                  />
                  <span>px</span>
                </div>
                <span
                  v-else
                  class="popover-val-clickable"
                  title="点击手动输入数字 (0 ~ 100)"
                  @click="startEditBlur"
                >{{ mvBlurValue }}px</span>
              </div>
              <button
                class="popover-reset-btn"
                title="恢复默认模糊度 (30px)"
                @click="resetBlurValue"
              >
                <el-icon :size="12"><RefreshLeft /></el-icon>
              </button>
            </div>
            <el-slider
              v-model="mvBlurValue"
              :min="0"
              :max="100"
              :step="1"
              size="small"
              @change="saveLyricSettings"
            />
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px">
            <div style="display: flex; align-items: center; justify-content: space-between">
              <div style="display: inline-flex; align-items: center; font-size: 11px; color: rgba(255, 255, 255, 0.6)">
                <span>背景缩放:&nbsp;</span>
                <div v-if="isEditingScale" style="display: inline-flex; align-items: center; gap: 2px;">
                  <input
                    ref="scaleInputRef"
                    v-model="scaleInputVal"
                    type="number"
                    step="0.05"
                    min="-5"
                    max="5"
                    class="popover-inline-input"
                    @blur="commitScaleInput"
                    @keydown.enter.prevent="commitScaleInput"
                    @keydown.esc.prevent="cancelScaleInput"
                  />
                </div>
                <span
                  v-else
                  class="popover-val-clickable"
                  title="点击手动输入数字 (-5.00 ~ 5.00)"
                  @click="startEditScale"
                >{{ mvScaleValue.toFixed(2) }}</span>
              </div>
              <button
                class="popover-reset-btn"
                title="恢复默认缩放 (1.00)"
                @click="resetScaleValue"
              >
                <el-icon :size="12"><RefreshLeft /></el-icon>
              </button>
            </div>
            <el-slider
              v-model="scaleSliderPos"
              :min="-100"
              :max="100"
              :step="1"
              :format-tooltip="() => mvScaleValue.toFixed(2)"
              size="small"
              @change="saveLyricSettings"
            />
          </div>
          <div style="display: flex; align-items: center; gap: 8px; justify-content: space-between">
            <span style="font-size: 11px; color: rgba(255, 255, 255, 0.6)">背景遮罩颜色</span>
            <el-color-picker
              v-model="mvOverlayColor"
              show-alpha
              size="small"
              @change="saveLyricSettings"
            />
          </div>
        </div>
      </el-popover>

      <el-popover
        ref="lyricPopoverRef"
        placement="top"
        :width="180"
        trigger="contextmenu"
        popper-style="background: rgba(20,20,20,0.95); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 10px;"
        @show="onPopoverShow('lyric')"
      >
        <template #reference>
          <button
            :class="['mv-ctrl-btn', { 'btn-mv-active': showLyric }]"
            title="歌词显示 (右键展开菜单)"
            @click="toggleAllLyrics"
          >
            <el-icon :size="16"
              ><svg
                t="1782568412821"
                class="icon"
                viewBox="0 0 1024 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                p-id="1806"
                width="200"
                height="200"
              >
                <path
                  d="M728.615385 472.615385v216.615384a16.935385 16.935385 0 0 1-1.378462 7.089231 108.307692 108.307692 0 1 1-38.006154-100.430769V452.923077a19.692308 19.692308 0 0 1 19.692308-19.692308h59.076923a19.692308 19.692308 0 0 1 0 39.384616zM236.307692 157.538462a78.769231 78.769231 0 0 0-78.76923 78.76923v551.384616a78.769231 78.769231 0 0 0 78.76923 78.76923h551.384616a78.769231 78.769231 0 0 0 78.76923-78.76923V236.307692a78.769231 78.769231 0 0 0-78.76923-78.76923z m0-39.384616h551.384616a118.153846 118.153846 0 0 1 118.153846 118.153846v551.384616a118.153846 118.153846 0 0 1-118.153846 118.153846H236.307692a118.153846 118.153846 0 0 1-118.153846-118.153846V236.307692a118.153846 118.153846 0 0 1 118.153846-118.153846z m384 630.153846a68.923077 68.923077 0 1 0-68.923077-68.923077 68.923077 68.923077 0 0 0 68.923077 68.923077zM571.076923 354.461538a19.692308 19.692308 0 0 1-19.692308 19.692308H295.384615a19.692308 19.692308 0 0 1 0-39.384615h256a19.692308 19.692308 0 0 1 19.692308 19.692307z m-137.846154 177.23077a19.692308 19.692308 0 0 1-19.692307 19.692307h-118.153847a19.692308 19.692308 0 0 1 0-39.384615h118.153847a19.692308 19.692308 0 0 1 19.692307 19.692308z"
                  fill="currentColor"
                  p-id="1807"
                ></path></svg
            ></el-icon>
          </button>
        </template>
        <div style="display: flex; flex-direction: column; gap: 8px; padding: 4px">
          <el-radio-group v-model="subtitleMode" @change="onSubtitleModeRadioChange">
            <el-radio :value="false" :label="false" style="color: #fff; margin-right: 12px;">普通模式</el-radio>
            <el-radio :value="true" :label="true" style="color: #fff; margin-right: 0;">字幕模式</el-radio>
          </el-radio-group>
          <div v-if="subtitleMode" style="display: flex; flex-direction: column; gap: 6px;">
            <span style="color: rgba(255,255,255,0.6); font-size: 12px;">字幕特效</span>
            <span v-if="subtitleEffect === 'random'" style="color: rgba(255,255,255,0.6); font-size: 12px;">当前：{{ getSubtitleEffectLabel(activeSubtitleEffect) }}</span>
            <el-select
              v-model="subtitleEffect"
              size="small"
              style="width: 100%"
              popper-class="subtitle-effect-popper"
              @change="props.saveLyricSettings()"
            >
              <el-option v-for="e in SUBTITLE_EFFECTS" :key="e.value" :label="e.label" :value="e.value" />
            </el-select>
            <div style="display: flex; flex-direction: column; gap: 2px; margin-top: 2px;">
              <div style="display: flex; align-items: center; color: rgba(255,255,255,0.6); font-size: 12px;">
                <span>字幕大小:&nbsp;</span>
                <div v-if="isEditingSubtitleSize" style="display: inline-flex; align-items: center; gap: 2px;">
                  <input
                    ref="subtitleSizeInputRef"
                    v-model="subtitleSizeInputVal"
                    type="number"
                    min="1"
                    max="999"
                    class="subtitle-size-inline-input"
                    @blur="commitSubtitleSizeInput"
                    @keydown.enter.prevent="commitSubtitleSizeInput"
                    @keydown.esc.prevent="cancelSubtitleSizeInput"
                  />
                  <span>px</span>
                </div>
                <span
                  v-else
                  class="subtitle-size-clickable"
                  title="点击手动输入数字"
                  @click="startEditSubtitleSize"
                >{{ subtitleFontSize }}px</span>
              </div>
              <el-slider
                v-model="subtitleSliderValue"
                :min="12"
                :max="120"
                :step="2"
                size="small"
                @change="props.saveLyricSettings()"
              />
            </div>
          </div>
          <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); margin-top: 4px; padding-top: 4px; display: flex; flex-direction: column; gap: 4px;">
            <el-checkbox
              v-model="showMainLyric"
              label="主歌词"
              size="small"
              style="color: #fff; margin-right: 0"
              @change="handleLyricDisplayChange"
            />
            <el-checkbox
              v-model="translate"
              label="翻译"
              size="small"
              style="color: #fff; margin-right: 0"
              @change="handleLyricDisplayChange"
            />
            <el-checkbox
              v-model="roma"
              label="罗马音"
              size="small"
              style="color: #fff; margin-right: 0"
              @change="handleLyricDisplayChange"
            />
          </div>
        </div>
      </el-popover>

      <button class="mv-ctrl-btn" title="歌词与状态信息" @click="showStatusDialog">
        <el-icon :size="16"
          ><svg viewBox="0 0 1024 1024" fill="currentColor">
            <path
              d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896zm0 85.333a362.667 362.667 0 1 0 0 725.334 362.667 362.667 0 0 0 0-725.334zM512 426.667a42.667 42.667 0 0 1 42.667 42.666v213.334a42.667 42.667 0 0 1-85.334 0V469.333A42.667 42.667 0 0 1 512 426.667zm0-170.667a42.667 42.667 0 1 1 0 85.334 42.667 42.667 0 0 1 0-85.334z"
            /></svg
        ></el-icon>
      </button>
    </div>

    <div class="mv-ctrl-divider"></div>

    <div class="mv-ctrl-buttons">
      <button class="mv-ctrl-btn" title="上一首" @click="playerprev">
        <el-icon :size="16"
          ><svg viewBox="0 0 1024 1024" fill="currentColor">
            <path
              d="M81.21 478.57l418.81-264.24c17.53-10.96 40.62-5.63 51.57 11.91 3.73 5.97 5.7 12.87 5.69 19.91v187.13l345.45-218.2c17.53-10.96 40.62-5.63 51.57 11.91 3.73 5.97 5.7 12.87 5.69 19.91v531.09c-0.03 20.67-16.82 37.4-37.49 37.37a37.465 37.465 0 0 1-20.15-5.93L556.91 588.24v189.75c-0.03 20.67-16.82 37.4-37.49 37.37a37.465 37.465 0 0 1-20.15-5.93L80.47 541.08c-17.12-11.58-21.62-34.85-10.04-51.96 2.84-4.22 6.51-7.8 10.78-10.55z"
            /></svg
        ></el-icon>
      </button>
      <button class="mv-ctrl-btn play-pause-btn" title="播放/暂停" @click="playerplay">
        <el-icon :size="18">
          <svg v-if="state.isPlay" viewBox="0 0 1024 1024" fill="currentColor">
            <path
              d="M307.785143 861.074286h97.28c37.723429 0 56.996571-19.712 56.996571-57.417143V219.904c0-38.985143-19.273143-56.996571-56.996571-56.996571h-97.28c-37.723429 0-57.417143 19.712-57.417143 56.996571V803.657143c0 37.723429 19.712 57.417143 57.417143 57.417143z m311.149714 0h97.28c37.723429 0 57.417143-19.712 57.417143-57.417143V219.904c0-38.985143-19.273143-56.996571-57.417143-56.996571h-97.28c-37.723429 0-56.996571 19.712-56.996571 56.996571V803.657143c0 37.723429 19.273143 57.417143 56.996571 57.417143z"
            />
          </svg>
          <svg v-else viewBox="0 0 1024 1024" fill="currentColor">
            <path
              d="M810.4 465.8 253.6 134.4c-6.8-4-13.8-6.4-21.8-6.4-21.8 0-39.6 18-39.6 40L192 168l0 688 0.2 0c0 22 17.8 40 39.6 40 8.2 0 15-2.8 22.4-6.8l556.2-331c13.2-11 21.6-27.6 21.6-46.2C832 493.4 823.6 477 810.4 465.8z"
            />
          </svg>
        </el-icon>
      </button>
      <button class="mv-ctrl-btn" title="下一首" @click="playernext">
        <el-icon :size="16"
          ><svg viewBox="0 0 1024 1024" fill="currentColor">
            <path
              d="M943.45 545.33L525.22 809.2c-17.5 10.94-40.56 5.62-51.5-11.89a37.27 37.27 0 0 1-5.68-19.88V590.55l-344.98 217.9c-16.81 11.97-40.15 8.05-52.13-8.76A37.46 37.46 0 0 1 64 777.43V245.95c0.03-20.64 16.79-37.35 37.43-37.32a37.44 37.44 0 0 1 20.12 5.92l344.98 220.89v-189.5c0.03-20.64 16.79-37.35 37.43-37.32a37.44 37.44 0 0 1 20.12 5.92l418.23 267.98c17.54 10.89 22.93 33.93 12.05 51.46-2.8 4.51-6.52 8.37-10.92 11.32l0.01 0.03z"
            /></svg
        ></el-icon>
      </button>
    </div>

    <div class="mv-ctrl-divider"></div>

    <div class="mv-timeline-area">
      <span class="mv-time-text">{{ display.nowtime }}</span>
      <div
        ref="progressContainerRef"
        class="mv-progress-bar-wrapper"
        @mousedown="startProgressDrag"
      >
        <div class="mv-progress-bar-bg">
          <div class="mv-progress-bar-fill" :style="{ width: `${display.progress}%` }"></div>
        </div>
      </div>
      <span class="mv-time-text">{{ display.endTime }}</span>
    </div>

    <div class="mv-ctrl-divider"></div>

    <div class="mv-utility-area">
      <div
        ref="volumeContainerRef"
        class="mv-progress-bar-wrapper mv-volume-slider-wrapper"
        style="width: 80px; margin: 0 4px"
        @mousedown="startVolumeDrag"
      >
        <button class="mv-ctrl-btn" style="margin-right: 4px" title="音量" @click="nofunciton">
          <el-icon :size="16"
            ><svg viewBox="0 0 1024 1024" fill="currentColor">
              <path
                d="M64 288h192l201.376-201.376A32 32 0 0 1 512 109.248v805.504a32 32 0 0 1-54.624 22.624L256 736H64a32 32 0 0 1-32-32V320a32 32 0 0 1 32-32z"
              /></svg
          ></el-icon>
        </button>
        <div class="mv-progress-bar-bg" style="height: 3px">
          <div class="mv-progress-bar-fill" :style="{ width: `${display.volume}%` }"></div>
        </div>
      </div>
      <el-popover
        placement="top"
        :width="300"
        trigger="click"
        popper-style="background: rgba(22, 22, 26, 0.96); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 14px; color: #fff; box-shadow: 0 8px 32px rgba(0,0,0,0.5);"
        @show="refreshSongMediaStatus"
      >
        <template #reference>
          <button
            :class="[
              'mv-ctrl-btn',
              {
                'btn-mv-active': mvCacheStatus.isCached || songMediaStatus?.video?.isCached,
                'btn-mv-caching': mvCacheStatus.isCaching
              }
            ]"
            :title="cacheBarBtnTitle"
          >
            <el-icon v-if="mvCacheStatus.isCaching" class="is-loading" :size="16"><Loading /></el-icon>
            <el-icon v-else :size="16">
              <svg viewBox="0 0 1024 1024" fill="currentColor">
                <path
                  d="M805.333 640a42.667 42.667 0 0 1 42.667 42.667v170.666A85.333 85.333 0 0 1 762.667 938.667H261.333A85.333 85.333 0 0 1 176 853.333V682.667a42.667 42.667 0 1 1 85.333 0v170.666h501.334V682.667A42.667 42.667 0 0 1 805.333 640zM512 85.333a42.667 42.667 0 0 1 42.667 42.667v438.827l126.933-126.934a42.667 42.667 0 1 1 60.373 60.374l-200 200a42.667 42.667 0 0 1-60.373 0l-200-200a42.667 42.667 0 1 1 60.373-60.374L469.333 566.827V128A42.667 42.667 0 0 1 512 85.333z"
                />
              </svg>
            </el-icon>
          </button>
        </template>
        <div class="mv-cache-popover-content">
          <div class="mv-cache-header">
            <span class="mv-cache-title">缓存管理</span>
            <el-switch
              v-model="mvAutoCacheEnabled"
              style="color: #fff;"
              active-text="自动缓存"
              @change="toggleMvAutoCache"
            />
          </div>

          <div class="mv-cache-status-card">
            <div class="mv-cache-status-row">
              <span class="label">🎬 MV 视频：</span>
              <span v-if="!currentMvBvid" class="val text-muted">未关联 MV</span>
              <span
                v-else-if="mvCacheStatus.isCached || songMediaStatus?.video?.isCached"
                class="val text-success"
              >
                已缓存 ({{ mvCacheStatus.sizeFormatted || songMediaStatus?.video?.sizeFormatted || '' }})
              </span>
              <span v-else-if="mvCacheStatus.isCaching" class="val text-warning">
                正在缓存 {{ mvCacheStatus.progress }}%
              </span>
              <span v-else class="val text-muted">未缓存</span>
            </div>

            <div class="mv-cache-status-row" style="margin-top: 5px;">
              <span class="label">📝 歌曲歌词：</span>
              <span v-if="songMediaStatus?.lyric?.isCached" class="val text-success">已离线缓存</span>
              <span v-else class="val text-muted">未离线</span>
            </div>

            <div class="mv-cache-status-row" style="margin-top: 5px;">
              <span class="label">🖼️ 专辑封面：</span>
              <span v-if="songMediaStatus?.cover?.isCached" class="val text-success">已离线缓存</span>
              <span v-else class="val text-muted">未离线</span>
            </div>

            <div v-if="mvCacheStatus.isCaching" style="margin: 8px 0 4px 0">
              <el-progress
                :percentage="mvCacheStatus.progress"
                :stroke-width="5"
                :show-text="false"
                status="success"
              />
            </div>

            <div class="mv-cache-actions">
              <el-button
                type="primary"
                size="small"
                title="一键离线缓存本歌曲的全部视频、歌词和封面"
                @click="cacheCurrentSongAll"
              >
                一键缓存
              </el-button>
              <el-button
                v-if="mvCacheStatus.isCaching"
                type="danger"
                size="small"
                @click="cancelCurrentMvCache"
              >
                取消缓存
              </el-button>
              <el-button
                size="small"
                :disabled="!mvCacheStatus.isCached && !songMediaStatus?.video?.isCached"
                @click="saveCurrentMvAs"
              >
                另存MV
              </el-button>
              <el-button
                type="danger"
                plain
                size="small"
                @click="deleteCurrentSongAllCache"
              >
                清除缓存
              </el-button>
            </div>
          </div>

          <div class="mv-cache-divider"></div>

          <div class="mv-cache-footer">
            <div class="mv-cache-summary">
              全部缓存: {{ allCacheStats.count }} 首 ({{ allCacheStats.totalSizeFormatted }})
            </div>
            <div class="mv-cache-footer-buttons">
              <el-button size="small" @click="openCurrentSongCacheDir">打开文件夹</el-button>
              <el-button
                size="small"
                type="danger"
                plain
                :disabled="allCacheStats.count === 0"
                @click="clearAllMvCache"
              >
                清理全部缓存
              </el-button>
            </div>
          </div>
        </div>
      </el-popover>

      <button
        :class="['mv-ctrl-btn', { 'btn-mv-active': mvVideoBgEnabled }]"
        :title="mvVideoBgEnabled ? '关闭MV视频' : '开启MV视频'"
        @click="toggleMvVideoBg"
      >
        <el-icon :size="16"><Film /></el-icon>
      </button>
      <button
        :class="['mv-ctrl-btn', { 'btn-mv-active': mvAutoHideEnabled }]"
        title="隐藏UI（2S）"
        @click="toggleMvAutoHide"
      >
        <el-icon :size="16"
          ><svg viewBox="0 0 1024 1024" fill="currentColor">
            <path
              d="M512 853.333c-188.587 0-341.333-152.747-341.333-341.333S323.413 170.667 512 170.667 853.333 323.413 853.333 512 700.587 853.333 512 853.333zM512 85.333C276.352 85.333 85.333 276.352 85.333 512s191.019 426.667 426.667 426.667 426.667-191.019 426.667-426.667S747.648 85.333 512 85.333zM544 298.667c0-17.664-14.336-32-32-32s-32 14.336-32 32V512c0 8.832 3.584 17.152 9.376 22.624l160 149.333c12.512 11.68 32.768 10.944 44.448-1.568 11.68-12.512 10.944-32.768-1.568-44.448L544 502.816V298.667z"
              fill="currentColor"
            /></svg
        ></el-icon>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { Search, Film, Loading, RefreshLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  state,
  display,
  translate,
  roma,
  showMainLyric,
  showLyric,
  subtitleMode,
  subtitleEffect,
  subtitleFontSize,
  activeSubtitleEffect,
  getSubtitleEffectLabel,
  SUBTITLE_EFFECTS
} from '@/services/store'
import { handleLyricDisplayChange } from '../composables/useLyric'
import {
  currentMvBvid,
  mvBlurEnabled,
  mvBlurValue,
  mvScaleValue,
  mvMirrorH,
  mvMirrorV,
  toggleMirrorH,
  toggleMirrorV,
  mvFitMode,
  MV_FIT_MODES,
  type MvFitMode,
  mvOverlayColor,
  mvVideoBgEnabled,
  mvAutoHideEnabled,
  mvUiVisible,
  mvAutoCacheEnabled,
  mvCacheStatus,
  allCacheStats,
  cacheCurrentMv,
  cancelCurrentMvCache,
  deleteCurrentMvCache,
  clearAllMvCache,
  openMvCacheDir,
  saveCurrentMvAs,
  toggleMvAutoCache,
  toggleMvBlur,
  toggleMvVideoBg,
  toggleMvAutoHide,
  toggleAllLyrics,
  onMvControlsMouseEnter,
  onMvControlsMouseLeave,
  openMvSearch,
  songMediaStatus,
  refreshSongMediaStatus,
  cacheCurrentSongAll,
  openCurrentSongCacheDir,
  deleteCurrentSongAllCache
} from '../composables/useMvMode'
import {
  playerplay,
  playernext,
  playerprev,
  startProgressDrag,
  startVolumeDrag
} from '../composables/usePlayerControls'

const props = defineProps<{
  showStatusDialog: () => void
  saveLyricSettings: () => void
  onSubtitleModeChange: () => void
}>()

// 分段线性映射：滑块居中(0)时对应缩放 1.00，左端(-100)对应 -5.00，右端(100)对应 5.00
const scaleSliderPos = computed<number>({
  get() {
    const v = mvScaleValue.value
    if (v >= 1) {
      return Math.round(((Math.min(5, v) - 1) / 4) * 100)
    }
    return Math.round(((Math.max(-5, v) - 1) / 6) * 100)
  },
  set(pos: number) {
    if (pos === 0) {
      mvScaleValue.value = 1
    } else if (pos > 0) {
      mvScaleValue.value = Number((1 + (pos / 100) * 4).toFixed(2))
    } else {
      mvScaleValue.value = Number((1 + (pos / 100) * 6).toFixed(2))
    }
  }
})

function resetBlurValue() {
  mvBlurValue.value = 30
  props.saveLyricSettings()
}

function resetScaleValue() {
  mvScaleValue.value = 1
  props.saveLyricSettings()
}

const isEditingBlur = ref(false)
const blurInputVal = ref('')
const blurInputRef = ref<HTMLInputElement | null>(null)

function startEditBlur() {
  blurInputVal.value = String(mvBlurValue.value)
  isEditingBlur.value = true
  nextTick(() => {
    blurInputRef.value?.focus()
    blurInputRef.value?.select()
  })
}

function commitBlurInput() {
  if (!isEditingBlur.value) return
  isEditingBlur.value = false
  const parsed = Math.round(Number(blurInputVal.value))
  if (Number.isFinite(parsed)) {
    mvBlurValue.value = Math.min(200, Math.max(0, parsed))
    props.saveLyricSettings()
  }
}

function cancelBlurInput() {
  isEditingBlur.value = false
}

const isEditingScale = ref(false)
const scaleInputVal = ref('')
const scaleInputRef = ref<HTMLInputElement | null>(null)

function startEditScale() {
  scaleInputVal.value = mvScaleValue.value.toFixed(2)
  isEditingScale.value = true
  nextTick(() => {
    scaleInputRef.value?.focus()
    scaleInputRef.value?.select()
  })
}

function commitScaleInput() {
  if (!isEditingScale.value) return
  isEditingScale.value = false
  const parsed = Number(Number(scaleInputVal.value).toFixed(2))
  if (Number.isFinite(parsed)) {
    mvScaleValue.value = Number(Math.min(5, Math.max(-5, parsed)).toFixed(2))
    props.saveLyricSettings()
  }
}

function cancelScaleInput() {
  isEditingScale.value = false
}

const isEditingSubtitleSize = ref(false)
const subtitleSizeInputVal = ref('')
const subtitleSizeInputRef = ref<HTMLInputElement | null>(null)

// 滑块仅覆盖 12~120；手动输入允许 1~999。
// 滑块绑定一个已钳制的中间值，避免 el-slider 在值超出 max 时自动回写导致手动输入值被改回。
const subtitleSliderValue = computed<number>({
  get: () => Math.min(120, Math.max(12, subtitleFontSize.value)),
  set: (v: number) => {
    subtitleFontSize.value = v
  }
})

const fitModeTitles: Record<MvFitMode, string> = {
  cover: '填充：等比缩放铺满窗口，超出部分裁剪',
  contain: '适应：等比缩放完整显示画面，可能留黑边',
  fill: '拉伸：拉伸画面铺满窗口，不保持比例',
  tile: '平铺：画面以网格方式重复铺满窗口',
  none: '居中：保持视频原始尺寸居中显示'
}

function setMvFitMode(m: MvFitMode) {
  mvFitMode.value = m
  props.saveLyricSettings()
}

const blurPopoverRef = ref<any>(null)
const lyricPopoverRef = ref<any>(null)
function onPopoverShow(which: 'blur' | 'lyric') {
  const other = which === 'blur' ? lyricPopoverRef.value : blurPopoverRef.value
  other?.hide?.()
}

function startEditSubtitleSize() {
  subtitleSizeInputVal.value = String(subtitleFontSize.value)
  isEditingSubtitleSize.value = true
  nextTick(() => {
    subtitleSizeInputRef.value?.focus()
    subtitleSizeInputRef.value?.select()
  })
}

function commitSubtitleSizeInput() {
  if (!isEditingSubtitleSize.value) return
  isEditingSubtitleSize.value = false
  const parsed = Math.round(Number(subtitleSizeInputVal.value))
  if (Number.isFinite(parsed) && parsed > 0) {
    subtitleFontSize.value = Math.min(999, Math.max(1, parsed))
    props.saveLyricSettings()
  }
}

function cancelSubtitleSizeInput() {
  isEditingSubtitleSize.value = false
}

const cacheBarBtnTitle = computed(() => {
  if (mvCacheStatus.value.isCaching) {
    return `MV 缓存中: ${mvCacheStatus.value.progress}%`
  }
  if (mvCacheStatus.value.isCached) {
    return `MV 已缓存 (${mvCacheStatus.value.sizeFormatted || ''}) - 点击管理`
  }
  return 'MV 缓存与管理'
})

function onSubtitleModeRadioChange(val: any) {
  subtitleMode.value = !!val
  showMainLyric.value = !val
  showLyric.value = true
  handleLyricDisplayChange()
  props.onSubtitleModeChange()
}

const progressContainerRef = ref<HTMLElement>()
const volumeContainerRef = ref<HTMLElement>()
const nofunciton = () => ElMessage({ plain: true, type: 'success', message: '^.^ 啥也没有发生~' })
</script>

<style scoped>
.btn-mv-caching {
  color: #f59e0b !important;
  animation: pulse-caching 1.5s infinite alternate;
}

@keyframes pulse-caching {
  0% {
    opacity: 0.7;
    transform: scale(0.98);
  }
  100% {
    opacity: 1;
    transform: scale(1.05);
  }
}

.mv-cache-popover-content {
  font-size: 12px;
  line-height: 1.5;
}

.mv-cache-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 8px;
  margin-bottom: 10px;
}

.mv-cache-title {
  font-weight: bold;
  font-size: 13px;
  color: #fff;
}

.mv-cache-status-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 10px;
}

.mv-cache-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.mv-cache-status-row .label {
  color: rgba(255, 255, 255, 0.6);
}

.text-success {
  color: #10b981;
  font-weight: bold;
}

.text-warning {
  color: #f59e0b;
  font-weight: bold;
}

.text-muted {
  color: rgba(255, 255, 255, 0.4);
}

.mv-cache-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.mv-cache-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 10px 0;
}

.mv-cache-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mv-cache-summary {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.mv-cache-footer-buttons {
  display: flex;
  gap: 8px;
}

.mv-cache-header :deep(.el-switch__label--right){
  color: #d5d5d5;
}

.popover-reset-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  width: 20px;
  height: 18px;
  padding: 0;
  cursor: pointer;
  transition: all 0.2s ease;
}

.popover-reset-btn:hover {
  background: rgba(56, 189, 248, 0.2);
  border-color: rgba(56, 189, 248, 0.45);
  color: #38bdf8;
}

.fit-mode-group {
  display: flex;
  gap: 4px;
}

.fit-mode-btn {
  flex: 1;
  padding: 3px 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.fit-mode-btn:hover {
  background: rgba(56, 189, 248, 0.15);
  color: #fff;
}

.fit-mode-btn.active {
  background: rgba(56, 189, 248, 0.28);
  border-color: rgba(56, 189, 248, 0.7);
  color: #38bdf8;
  font-weight: 600;
}

.mirror-btn-group {
  display: flex;
  gap: 6px;
}

.mirror-btn {
  flex: 1;
  padding: 4px 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.mirror-btn:hover {
  background: rgba(56, 189, 248, 0.15);
  color: #fff;
}

.mirror-btn.active {
  background: rgba(56, 189, 248, 0.28);
  border-color: rgba(56, 189, 248, 0.7);
  color: #38bdf8;
  font-weight: 600;
}

.popover-val-clickable {
  cursor: pointer;
  color: #38bdf8;
  font-weight: 600;
  padding: 0 4px;
  border-radius: 3px;
  border-bottom: 1px dashed rgba(56, 189, 248, 0.55);
  transition: all 0.15s ease;
}

.popover-val-clickable:hover {
  background: rgba(56, 189, 248, 0.15);
  color: #7dd3fc;
}

.popover-inline-input {
  width: 52px;
  height: 18px;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid #38bdf8;
  border-radius: 3px;
  color: #fff;
  font-size: 11px;
  padding: 0 4px;
  outline: none;
  text-align: center;
}

.popover-inline-input::-webkit-inner-spin-button,
.popover-inline-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.subtitle-size-clickable {
  cursor: pointer;
  color: #38bdf8;
  font-weight: 600;
  padding: 0 4px;
  border-radius: 3px;
  border-bottom: 1px dashed rgba(56, 189, 248, 0.55);
  transition: all 0.15s ease;
}

.subtitle-size-clickable:hover {
  background: rgba(56, 189, 248, 0.15);
  color: #7dd3fc;
}

.subtitle-size-inline-input {
  width: 48px;
  height: 20px;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid #38bdf8;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  padding: 0 4px;
  outline: none;
  text-align: center;
}

.subtitle-size-inline-input::-webkit-inner-spin-button,
.subtitle-size-inline-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>

