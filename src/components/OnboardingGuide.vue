<template>
  <transition name="onboarding-fade">
    <div v-if="visible" class="onboarding-overlay" @mousedown.stop @click.self="handleSkip">
      <div class="onboarding-card">
        <div class="onboarding-header">
          <div class="step-badge">第 {{ currentStep + 1 }} / {{ steps.length }} 步</div>
          <button class="skip-btn" @click="handleSkip">跳过引导</button>
        </div>

        <div class="onboarding-body">
          <div class="feature-icon">{{ activeStep.icon }}</div>
          <h2 class="feature-title">{{ activeStep.title }}</h2>
          <p class="feature-desc">{{ activeStep.description }}</p>

          <div v-if="activeStep.tips && activeStep.tips.length" class="feature-tips">
            <div v-for="(tip, idx) in activeStep.tips" :key="idx" class="tip-item">
              <span class="tip-dot"></span>
              <span>{{ tip }}</span>
            </div>
          </div>
        </div>

        <div class="onboarding-footer">
          <div class="step-dots">
            <button
              v-for="(step, idx) in steps"
              :key="step.title"
              class="step-dot"
              :class="{ active: idx === currentStep }"
              :title="step.title"
              @click="currentStep = idx"
            ></button>
          </div>

          <div class="footer-actions">
            <button v-if="currentStep > 0" class="btn-secondary" @click="prevStep">
              上一步
            </button>
            <button v-if="currentStep < steps.length - 1" class="btn-primary" @click="nextStep">
              下一步
            </button>
            <button v-else class="btn-primary btn-finish" @click="handleFinish">
              开始使用
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

interface OnboardingStep {
  icon: string
  title: string
  description: string
  tips?: string[]
}

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'complete'): void
}>()

const currentStep = ref(0)

const steps: OnboardingStep[] = [
  {
    icon: '🎵',
    title: '欢迎使用 QLyrix',
    description:
      'QLyrix 是专为 QQ 音乐打造的苹果风格桌面歌词与灵动岛伴侣，为您带来流畅的逐字歌词与沉浸式视觉体验。',
    tips: [
      '自动同步 QQ 音乐当前播放歌曲与进度',
      '支持桌面灵动岛与主歌词窗口双端联动'
    ]
  },
  {
    icon: '🏝️',
    title: '桌面灵动岛',
    description:
      '屏幕顶部的悬浮胶囊实时展示歌名与播放律动，鼠标悬停即可展开控制卡片与双行歌词。',
    tips: [
      '支持自由拖拽移动并自动记住位置',
      '可在设置中选择「全屏时隐藏」以免遮挡游戏或视频',
      '右键胶囊可快速隐藏灵动岛'
    ]
  },
  {
    icon: '✨',
    title: '逐字歌词与动态背景',
    description:
      '主歌词窗口根据专辑封面实时提取主色调，驱动动态流光网格背景与逐字高亮歌词滚动。',
    tips: [
      '点击右下角「译 / 音」按钮切换翻译与音译显示',
      '点击左下角更多按钮可调整歌词字体、模糊与时间延迟'
    ]
  },
  {
    icon: '🎬',
    title: 'MV 沉浸背景模式',
    description:
      '点击窗口顶部工具栏的「MV」图标，即可将背景切换为关联的 Bilibili MV 视频，打造影院级听歌体验。',
    tips: [
      '支持手动搜索并绑定专属 MV 视频',
      '可在设置中调节视频画质、填充模式与背景模糊度'
    ]
  },
  {
    icon: '⚙️',
    title: '个性化设置与托盘管理',
    description:
      '鼠标移至主窗口顶部可呼出置顶、灵动岛开关与设置入口；关闭窗口后可在系统托盘随时唤回。',
    tips: [
      '可在「设置 → 常规设置」中随时重新打开本新手引导',
      '点击「开始使用」即可立即体验 QLyrix'
    ]
  }
]

const activeStep = computed(() => steps[currentStep.value])

watch(
  () => props.visible,
  (val) => {
    if (val) {
      currentStep.value = 0
    }
  }
)

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value -= 1
  }
}

function nextStep() {
  if (currentStep.value < steps.length - 1) {
    currentStep.value += 1
  }
}

function handleSkip() {
  emit('complete')
}

function handleFinish() {
  emit('complete')
}

function onKeyDown(e: KeyboardEvent) {
  if (!props.visible) return
  if (e.key === 'Escape') {
    handleSkip()
  } else if (e.key === 'ArrowRight') {
    if (currentStep.value < steps.length - 1) {
      nextStep()
    } else {
      handleFinish()
    }
  } else if (e.key === 'ArrowLeft') {
    prevStep()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.onboarding-overlay {
  position: fixed;
  inset: 0;
  z-index: 9500;
  background: rgba(8, 8, 14, 0.56);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  user-select: none;
}

.onboarding-card {
  width: 100%;
  max-width: 460px;
  background: rgba(24, 24, 34, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 20px;
  padding: 22px 26px 24px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
  color: #f5f5f7;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.onboarding-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.step-badge {
  font-size: 12px;
  font-weight: 600;
  color: #a5b4fc;
  background: rgba(99, 102, 241, 0.18);
  border: 1px solid rgba(129, 140, 248, 0.28);
  padding: 4px 10px;
  border-radius: 999px;
}

.skip-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.skip-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.onboarding-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 6px 4px;
}

.feature-icon {
  width: 60px;
  height: 60px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.28), rgba(236, 72, 153, 0.24));
  border: 1px solid rgba(255, 255, 255, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  margin-bottom: 14px;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.2);
}

.feature-title {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 0.2px;
}

.feature-desc {
  margin: 0 0 16px;
  font-size: 13.5px;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.78);
}

.feature-tips {
  width: 100%;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
  box-sizing: border-box;
}

.tip-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12.5px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.85);
}

.tip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #818cf8;
  margin-top: 6px;
  flex-shrink: 0;
}

.onboarding-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
}

.step-dots {
  display: flex;
  align-items: center;
  gap: 6px;
}

.step-dot {
  width: 7px;
  height: 7px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.24);
  cursor: pointer;
  transition: all 0.25s ease;
}

.step-dot.active {
  width: 20px;
  background: #818cf8;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-secondary,
.btn-primary {
  border: none;
  border-radius: 10px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.88);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.btn-primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
}

.btn-primary:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.btn-finish {
  background: linear-gradient(135deg, #6366f1, #ec4899);
}

.onboarding-fade-enter-active,
.onboarding-fade-leave-active {
  transition: opacity 0.24s ease;
}

.onboarding-fade-enter-from,
.onboarding-fade-leave-to {
  opacity: 0;
}
</style>
