import { watch, onBeforeUnmount, type Ref } from 'vue'

/**
 * MV 背景「平铺」模式渲染器：
 * 将 <video> 当前帧以网格方式绘制到 canvas 上（每行约 2 个高度单位，居中对齐）。
 * 仅在 enabled 为 true 时运行；优先使用 requestVideoFrameCallback，只在新帧到达时绘制，避免空转。
 */
export function useMvTileRenderer(
  videoRef: Ref<HTMLVideoElement | null>,
  canvasRef: Ref<HTMLCanvasElement | null | undefined>,
  enabled: Ref<boolean>
) {
  let running = false
  let rvfcHandle: number | null = null
  let rafHandle: number | null = null
  let boundVideo: HTMLVideoElement | null = null

  const draw = () => {
    const v = videoRef.value
    const c = canvasRef.value
    if (!v || !c || !v.videoWidth || !v.videoHeight) return
    const cw = c.clientWidth
    const ch = c.clientHeight
    if (!cw || !ch) return
    if (c.width !== cw || c.height !== ch) {
      c.width = cw
      c.height = ch
    }
    const ctx = c.getContext('2d')
    if (!ctx) return
    const th = Math.max(1, ch / 2)
    const tw = Math.max(1, th * (v.videoWidth / v.videoHeight))
    // 让中心对齐到某个瓦片的中心
    const ox = cw / 2 - tw / 2
    const oy = ch / 2 - th / 2
    const startX = ox - Math.ceil(ox / tw) * tw
    const startY = oy - Math.ceil(oy / th) * th
    ctx.clearRect(0, 0, cw, ch)
    for (let y = startY; y < ch; y += th) {
      for (let x = startX; x < cw; x += tw) {
        ctx.drawImage(v, x, y, tw, th)
      }
    }
  }

  const scheduleNext = () => {
    if (!running) return
    const v = videoRef.value as any
    if (v && typeof v.requestVideoFrameCallback === 'function') {
      rvfcHandle = v.requestVideoFrameCallback(() => {
        rvfcHandle = null
        draw()
        scheduleNext()
      })
    } else {
      rafHandle = requestAnimationFrame(() => {
        rafHandle = null
        draw()
        scheduleNext()
      })
    }
  }

  const onStaticFrame = () => draw()
  const onResize = () => draw()

  const bindVideo = (v: HTMLVideoElement | null) => {
    if (boundVideo === v) return
    unbindVideo()
    boundVideo = v
    if (v) {
      v.addEventListener('seeked', onStaticFrame)
      v.addEventListener('loadeddata', onStaticFrame)
    }
  }
  const unbindVideo = () => {
    if (boundVideo) {
      boundVideo.removeEventListener('seeked', onStaticFrame)
      boundVideo.removeEventListener('loadeddata', onStaticFrame)
      const anyV = boundVideo as any
      if (rvfcHandle != null && typeof anyV.cancelVideoFrameCallback === 'function') {
        anyV.cancelVideoFrameCallback(rvfcHandle)
      }
    }
    rvfcHandle = null
    boundVideo = null
  }

  const start = () => {
    if (running) return
    running = true
    bindVideo(videoRef.value)
    window.addEventListener('resize', onResize)
    draw()
    scheduleNext()
  }

  const stop = () => {
    running = false
    if (rafHandle != null) {
      cancelAnimationFrame(rafHandle)
      rafHandle = null
    }
    unbindVideo()
    window.removeEventListener('resize', onResize)
  }

  watch(
    [enabled, videoRef, canvasRef],
    () => {
      stop()
      if (enabled.value && videoRef.value && canvasRef.value) start()
    },
    { flush: 'post', immediate: true }
  )

  onBeforeUnmount(stop)
}
