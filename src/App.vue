<template>
  <div class="app-root">
    <component :is="activeViewComponent" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import LyricsView from '@/views/LyricsView.vue'
import IslandView from '@/views/IslandView.vue'
import SettingsView from '@/views/SettingsView.vue'
import { qmusicService } from '@/services/qmusicService'

const searchParams = new URLSearchParams(window.location.search)
const winType = searchParams.get('win') || 'main'

const activeViewComponent = computed(() => {
  if (winType === 'island') return IslandView
  if (winType === 'settings') return SettingsView
  return LyricsView
})

onMounted(() => {
  // 初始化 QMusicSupport 后台监听
  qmusicService.init()
})
</script>

<style>
.app-root {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  position: relative;
}
</style>
