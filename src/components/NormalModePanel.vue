<template>
  <div class="play_background">
    <div class="play_container">
      <div class="play_container_topbar">
        <MiniBar
          :on-close="closeWindow"
          :on-maximize="maximizeWindow"
          :on-minimize="minimizeWindow"
          :on-fullscreen="fullscreenWindow"
        />
      </div>
      <div class="song_album_container">
        <div
          class="song_album"
          :class="{ 'is-paused': !state.isPlay }"
          title="点击保存专辑封面"
          @click="saveAlbumImage"
        >
          <CoverTransition
            :src="state.albumUrl"
            :alt="'专辑封面'"
            :animation-type="coverAnimType"
            :duration="500"
          />
        </div>
      </div>
      <div class="song_info_container">
        <div class="song_info" title="点击复制歌曲信息" @click="copySongInfo">
          <div class="song_name">
            {{ state.title }}
            <span
              v-if="getMvMappingForCurrentSong()"
              class="song_mv_tag"
              title="点击打开关联的 B站 MV 网页"
              @click.stop="openBoundMvLink"
              >MV</span
            >
            <span
              v-if="getMvMappingForCurrentSong() && currentMvQualityLabel"
              class="song_quality_tag"
              title="当前 MV 画面质量"
              >{{ currentMvQualityLabel }}</span
            >
          </div>
          <div class="song_artist">
            {{ state.artist }}
          </div>
        </div>
        <div class="menubutton" @click="showStatusDialog">
          <div class="menubutton_text">...</div>
        </div>
      </div>
      <div class="song_timeline_container">
        <div class="song_progress_container">
          <div
            ref="progressContainerRef"
            class="song_progress_background"
            @mousedown="startProgressDrag"
          >
            <div class="song_progress" :style="{ width: `${display.progress}%` }"></div>
          </div>
        </div>
        <div class="song_others">
          <div class="song_time_left">{{ display.nowtime }}</div>
          <div class="song_qualitytag">
            <span style="font-size: 13px; color: #ffffffa5;">{{ display.tagstr }}</span>
          </div>
          <div class="song_time_right">{{ display.endTime }}</div>
        </div>
      </div>
      <div class="song_play_controls">
        <div class="song_play_control_m b_random" @click="nofunciton">
          <el-icon :size="20"
            ><svg
              width="15"
              height="15"
              viewBox="0 0 15 15"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12.3536 1.14645C12.1583 0.951184 11.8417 0.951184 11.6464 1.14645C11.4512 1.34171 11.4512 1.65829 11.6464 1.85355L12.7929 3H12C10.7037 3 9.71111 3.58423 8.87248 4.38931C8.20065 5.03427 7.59349 5.85684 6.99461 6.6682C6.86287 6.84668 6.73154 7.02462 6.6 7.2C5.10874 9.18835 3.49037 11 0.5 11C0.223858 11 0 11.2239 0 11.5C0 11.7761 0.223858 12 0.5 12C4.00963 12 5.89126 9.81165 7.4 7.8C7.54367 7.60845 7.6832 7.41962 7.81996 7.23454L7.82005 7.23443L7.82006 7.23441C8.41674 6.42695 8.96069 5.69085 9.56502 5.11069C10.2889 4.41577 11.0463 4 12 4H12.7929L11.6464 5.14645C11.4512 5.34171 11.4512 5.65829 11.6464 5.85355C11.8417 6.04882 12.1583 6.04882 12.3536 5.85355L14.3536 3.85355C14.5488 3.65829 14.5488 3.34171 14.3536 3.14645L12.3536 1.14645ZM0.5 3C3.35278 3 5.12992 4.44588 6.50548 6.06746L6.3762 6.24266C6.2483 6.4161 6.12293 6.58609 6 6.75C5.96397 6.79804 5.92798 6.84581 5.892 6.89331C4.57348 5.29306 3.02637 4 0.5 4C0.223858 4 0 3.77614 0 3.5C0 3.22386 0.223858 3 0.5 3ZM8.87248 10.6107C8.37284 10.131 7.90897 9.55314 7.45767 8.95468C7.64688 8.71693 7.82704 8.48061 8 8.25L8.08987 8.12987C8.58412 8.79402 9.05288 9.39766 9.56502 9.88931C10.2889 10.5842 11.0463 11 12 11H12.7929L11.6464 9.85355C11.4512 9.65829 11.4512 9.34171 11.6464 9.14645C11.8417 8.95118 12.1583 8.95118 12.3536 9.14645L14.3536 11.1464C14.5488 11.3417 14.5488 11.6583 14.3536 11.8536L12.3536 13.8536C12.1583 14.0488 11.8417 14.0488 11.6464 13.8536C11.4512 13.6583 11.4512 13.3417 11.6464 13.1464L12.7929 12H12C10.7037 12 9.71111 11.4158 8.87248 10.6107Z"
                fill="#ffffff60"
                fill-rule="evenodd"
                clip-rule="evenodd"
              /></svg
          ></el-icon>
        </div>
        <div class="song_play_control b_prev" @click="playerprev">
          <el-icon :size="45"
            ><svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M81.21 478.57l418.81-264.24c17.53-10.96 40.62-5.63 51.57 11.91 3.73 5.97 5.7 12.87 5.69 19.91v187.13l345.45-218.2c17.53-10.96 40.62-5.63 51.57 11.91 3.73 5.97 5.7 12.87 5.69 19.91v531.09c-0.03 20.67-16.82 37.4-37.49 37.37a37.465 37.465 0 0 1-20.15-5.93L556.91 588.24v189.75c-0.03 20.67-16.82 37.4-37.49 37.37a37.465 37.465 0 0 1-20.15-5.93L80.47 541.08c-17.12-11.58-21.62-34.85-10.04-51.96 2.84-4.22 6.51-7.8 10.78-10.55z"
                fill="#ffffff"
              /></svg
          ></el-icon>
        </div>
        <div class="song_play_control b_play" @click="playerplay">
          <el-icon v-if="state.isPlay" :size="45"
            ><svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M307.785143 861.074286h97.28c37.723429 0 56.996571-19.712 56.996571-57.417143V219.904c0-38.985143-19.273143-56.996571-56.996571-56.996571h-97.28c-37.723429 0-57.417143 19.712-57.417143 56.996571V803.657143c0 37.723429 19.712 57.417143 57.417143 57.417143z m311.149714 0h97.28c37.723429 0 57.417143-19.712 57.417143-57.417143V219.904c0-38.985143-19.273143-56.996571-57.417143-56.996571h-97.28c-37.723429 0-56.996571 19.712-56.996571 56.996571V803.657143c0 37.723429 19.273143 57.417143 56.996571 57.417143z"
                fill="#ffffff"
              /></svg
          ></el-icon>
          <el-icon v-else :size="45"
            ><svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M810.4 465.8 253.6 134.4c-6.8-4-13.8-6.4-21.8-6.4-21.8 0-39.6 18-39.6 40L192 168l0 688 0.2 0c0 22 17.8 40 39.6 40 8.2 0 15-2.8 22.4-6.8l556.2-331c13.2-11 21.6-27.6 21.6-46.2C832 493.4 823.6 477 810.4 465.8z"
                fill="#ffffff"
              /></svg
          ></el-icon>
        </div>
        <div class="song_play_control b_next" @click="playernext">
          <el-icon :size="45"
            ><svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M943.45 545.33L525.22 809.2c-17.5 10.94-40.56 5.62-51.5-11.89a37.27 37.27 0 0 1-5.68-19.88V590.55l-344.98 217.9c-16.81 11.97-40.15 8.05-52.13-8.76A37.46 37.46 0 0 1 64 777.43V245.95c0.03-20.64 16.79-37.35 37.43-37.32a37.44 37.44 0 0 1 20.12 5.92l344.98 220.89v-189.5c0.03-20.64 16.79-37.35 37.43-37.32a37.44 37.44 0 0 1 20.12 5.92l418.23 267.98c17.54 10.89 22.93 33.93 12.05 51.46-2.8 4.51-6.52 8.37-10.92 11.32l0.01 0.03z"
                fill="#ffffff"
              /></svg
          ></el-icon>
        </div>
        <div class="song_play_control_m b_cycle" @click="nofunciton">
          <el-icon :size="20"
            ><svg
              width="15"
              height="15"
              viewBox="0 0 15 15"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3.35355 1.85355C3.54882 1.65829 3.54882 1.34171 3.35355 1.14645C3.15829 0.951184 2.84171 0.951184 2.64645 1.14645L0.646447 3.14645C0.451184 3.34171 0.451184 3.65829 0.646447 3.85355L2.64645 5.85355C2.84171 6.04882 3.15829 6.04882 3.35355 5.85355C3.54882 5.65829 3.54882 5.34171 3.35355 5.14645L2.20711 4H9.5C11.433 4 13 5.567 13 7.5C13 7.77614 13.2239 8 13.5 8C13.7761 8 14 7.77614 14 7.5C14 5.01472 11.9853 3 9.5 3H2.20711L3.35355 1.85355ZM2 7.5C2 7.22386 1.77614 7 1.5 7C1.22386 7 1 7.22386 1 7.5C1 9.98528 3.01472 12 5.5 12H12.7929L11.6464 13.1464C11.4512 13.3417 11.4512 13.6583 11.6464 13.8536C11.8417 14.0488 12.1583 14.0488 12.3536 13.8536L14.3536 11.8536C14.5488 11.6583 14.5488 11.3417 14.3536 11.1464L12.3536 9.14645C12.1583 8.95118 11.8417 8.95118 11.6464 9.14645C11.4512 9.34171 11.4512 9.65829 11.6464 9.85355L12.7929 11H5.5C3.567 11 2 9.433 2 7.5Z"
                fill="#ffffffA0"
                fill-rule="evenodd"
                clip-rule="evenodd"
              /></svg
          ></el-icon>
        </div>
      </div>
      <div class="song_sound_controls">
        <div class="song_sound_controls_volume_add">
          <el-icon :size="20"
            ><svg viewBox="0 0 1024 1024" fill="#ffffff">
              <path
                d="M64 288h192l201.376-201.376A32 32 0 0 1 512 109.248v805.504a32 32 0 0 1-54.624 22.624L256 736H64a32 32 0 0 1-32-32V320a32 32 0 0 1 32-32z"
              /></svg
          ></el-icon>
        </div>
        <div
          ref="volumeContainerRef"
          class="song_sound_controls_sound_progress_container"
          @mousedown="startVolumeDrag"
        >
          <div class="song_sound_controls_sound_progress_background">
            <div
              class="song_sound_controls_sound_progress"
              :style="{ width: `${display.volume}%` }"
            ></div>
          </div>
        </div>
        <div class="song_sound_controls_volume_minus">
          <el-icon :size="20"
            ><svg viewBox="0 0 1024 1024" fill="#ffffff">
              <path
                d="M625.152 398.848a160 160 0 0 1 0 226.304 32 32 0 0 1-45.28-45.28 96 96 0 0 0 0-135.744 32 32 0 0 1 45.28-45.28z m226.24-226.24c187.456 187.424 187.456 491.36 0 678.816a32 32 0 1 1-45.248-45.28c162.464-162.432 162.464-425.856 0-588.288a32 32 0 0 1 45.28-45.28z m-113.12 113.12c124.96 124.96 124.96 327.584 0 452.544a32 32 0 0 1-45.248-45.248 256 256 0 0 0 0-362.048A32 32 0 0 1 738.24 285.76zM64 288h192l201.376-201.376A32 32 0 0 1 512 109.248v805.504a32 32 0 0 1-54.624 22.624L256 736H64a32 32 0 0 1-32-32V320a32 32 0 0 1 32-32z"
              /></svg
          ></el-icon>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { state, display, isProgressDragging } from '@/services/store'
import {
  getMvMappingForCurrentSong,
  openBoundMvLink,
  currentMvQualityLabel
} from '@/composables/useMvMode'
import {
  playerplay,
  playernext,
  playerprev,
  startProgressDrag,
  startVolumeDrag,
  closeWindow,
  maximizeWindow,
  minimizeWindow,
  fullscreenWindow
} from '@/composables/usePlayerControls'
import MiniBar from './MiniBar.vue'
import CoverTransition from './CoverTransition.vue'

defineProps<{
  coverAnimType: 'dissolve' | 'expand'
  showStatusDialog: () => void
  saveAlbumImage: () => void
  copySongInfo: () => void
}>()

const progressContainerRef = ref<HTMLElement>()
const volumeContainerRef = ref<HTMLElement>()
const nofunciton = () => ElMessage({ plain: true, type: 'success', message: '^.^ 啥也没有发生~' })
</script>
