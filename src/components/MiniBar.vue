<template>
  <div class="mini-bar" @mousemove="onMouseMove" @mouseleave="onMouseLeave" @mouseup="onMouseUp">
    <div class="indicator" :class="{ active: isHovering }" :style="indicatorStyle">
      <i :class="`icon-${currentIcon}`"></i>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, ref, computed } from 'vue'

export default defineComponent({
  name: 'MiniBar',
  props: {
    onClose: { type: Function, default: () => console.log('Close action') },
    onMaximize: { type: Function, default: () => console.log('Maximize action') },
    onMinimize: { type: Function, default: () => console.log('Minimize action') },
    onFullscreen: { type: Function, default: () => console.log('Fullscreen action') },
    onReset: { type: Function, default: () => console.log('Reset action') }
  },
  setup(props) {
    const isHovering = ref(false)
    const mousePosition = reactive({ x: 0, y: 0 })
    const hoverArea = reactive({ width: 100, height: 100 })

    const currentIcon = ref('reset')

    const indicatorStyle = computed(() => ({
      transform: `translate(${mousePosition.x}px, ${mousePosition.y}px)`
    }))

    const onMouseMove = (event: MouseEvent) => {
      isHovering.value = true

      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const offsetX = event.clientX - rect.left - rect.width / 2
      const offsetY = event.clientY - rect.top - rect.height / 2

      mousePosition.x = offsetX * 0.8 // 添加缓动系数
      mousePosition.y = offsetY * 0.8

      const directionThreshold = 10
      if (Math.abs(offsetY) > directionThreshold) {
        currentIcon.value = offsetY > 0 ? 'fullscreen' : 'close'
      } else if (Math.abs(offsetX) > directionThreshold) {
        currentIcon.value = offsetX > 0 ? 'maximize' : 'minimize'
      } else {
        currentIcon.value = 'reset'
      }
    }

    const onMouseLeave = () => {
      isHovering.value = false
      currentIcon.value = 'reset'
      mousePosition.x = 0
      mousePosition.y = 0
    }

    const onMouseUp = () => {
      isHovering.value = false
      switch (currentIcon.value) {
        case 'close':
          props.onClose()
          break
        case 'maximize':
          props.onMaximize()
          break
        case 'minimize':
          props.onMinimize()
          break
        case 'fullscreen':
          props.onFullscreen()
          break
        default:
          props.onReset()
          break
      }
    }

    return {
      isHovering,
      mousePosition,
      hoverArea,
      currentIcon,
      indicatorStyle,
      onMouseMove,
      onMouseLeave,
      onMouseUp
    }
  }
})
</script>

<style lang="scss">
.mini-bar {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  .indicator {
    width: 50px;
    height: 8px;
    background-color: #ffffff30;
    border-radius: 10px;
    transition:
      width,
      height 0.1s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    &.active {
      width: 25px;
      height: 25px;
      border-radius: 5px;
    }

    i {
      font-size: 18px;
      color: white;

      &::before {
        content: '';
        display: inline-block;
        width: 18px;
        height: 18px;
        transition: background-image 0.1s ease;
      }
    }

    .icon-close::before {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(0, 0, 0, 0.3)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='18' y1='6' x2='6' y2='18'%3E%3C/line%3E%3Cline x1='6' y1='6' x2='18' y2='18'%3E%3C/line%3E%3C/svg%3E");
    }
    .icon-maximize::before {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(0, 0, 0, 0.3)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3'%3E%3C/path%3E%3C/svg%3E");
    }
    .icon-minimize::before {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(0, 0, 0, 0.3)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='5' y1='12' x2='19' y2='12'%3E%3C/line%3E%3C/svg%3E");
    }
    .icon-fullscreen::before {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(0, 0, 0, 0.3)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='15 3 21 3 21 9'%3E%3C/polyline%3E%3Cpolyline points='9 21 3 21 3 15'%3E%3C/polyline%3E%3Cline x1='21' y1='3' x2='14' y2='10'%3E%3C/line%3E%3Cline x1='3' y1='21' x2='10' y2='14'%3E%3C/line%3E%3C/svg%3E");
    }
  }
}
</style>
