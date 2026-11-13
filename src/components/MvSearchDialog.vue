<template>
  <el-dialog
    v-model="mvSearchDialogVisible"
    title="手动关联 B站 MV"
    width="50%"
    class="bilibili-search-dialog"
    :modal="true"
    :append-to-body="true"
  >
    <div class="search-input-area">
      <el-input
        v-model="mvSearchKeyword"
        placeholder="请输入搜索关键词，如：歌手 歌名"
        @keyup.enter="performMvSearch"
      />
      <el-button type="primary" :loading="mvSearching" @click="performMvSearch">搜索</el-button>
    </div>
    <div v-loading="mvSearching" class="search-results-list">
      <div
        v-for="item in mvSearchResults"
        :key="item.bvid"
        class="video-result-card"
        :class="{ 'active-binding': currentMvBvid === item.bvid }"
        @click="bindMvToCurrentSong(item)"
      >
        <div class="video-thumbnail-wrapper">
          <img :src="item.pic" alt="cover" referrerpolicy="no-referrer" />
          <span class="video-duration">{{ item.duration }}</span>
        </div>
        <div class="video-info-wrapper">
          <div class="video-title" v-html="item.title"></div>
          <div class="video-meta">
            <span class="video-uploader">UP: {{ item.author }}</span>
            <span class="video-play-count">播放: {{ formatPlayCount(item.play) }}</span>
            <span v-if="item.recommendScore !== undefined" class="video-recommend-score" :class="getScoreClass(item.recommendScore)">
              推荐评分: {{ item.recommendScore }}
            </span>
          </div>
        </div>
      </div>
      <div
        v-if="mvSearchResults.length === 0 && !mvSearching"
        style="text-align: center; color: rgba(255, 255, 255, 0.4); padding: 20px"
      >
        暂无搜索结果
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import {
  mvSearchDialogVisible,
  mvSearchKeyword,
  mvSearching,
  mvSearchResults,
  currentMvBvid,
  performMvSearch,
  bindMvToCurrentSong,
  formatPlayCount,
  getScoreClass
} from '@/composables/useMvMode'
</script>
