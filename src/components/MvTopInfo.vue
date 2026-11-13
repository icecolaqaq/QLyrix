<template>
  <div
    class="mv-top-left-info"
    :class="{ 'mv-ui-hidden': !mvUiVisible }"
    @mouseenter="onMvTopInfoMouseEnter"
    @mouseleave="onMvTopInfoMouseLeave"
  >
    <button class="mv-back-btn" title="退出MV模式" @click="toggleMvMode">
      <el-icon :size="20"><Back /></el-icon>
    </button>
    <div class="mv-top-album-art" title="点击保存专辑封面" @click="saveAlbumImage">
      <CoverTransition
        :src="state.albumUrl"
        :alt="'专辑封面'"
        :animation-type="coverAnimType"
        :duration="500"
      />
    </div>
    <div class="mv-top-meta" title="点击复制歌曲信息" @click="copySongInfo">
      <div class="mv-top-title" :title="state.title">
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
      <div class="mv-top-uploader">
        {{ state.artist }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Back } from '@element-plus/icons-vue'
import { state } from '@/services/store'
import {
  mvUiVisible,
  toggleMvMode,
  getMvMappingForCurrentSong,
  openBoundMvLink,
  currentMvQualityLabel,
  onMvTopInfoMouseEnter,
  onMvTopInfoMouseLeave
} from '@/composables/useMvMode'
import CoverTransition from './CoverTransition.vue'

defineProps<{
  coverAnimType: 'dissolve' | 'expand'
  saveAlbumImage: () => void
  copySongInfo: () => void
}>()
</script>
