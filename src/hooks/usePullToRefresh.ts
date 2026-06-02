import { useEffect, useRef, useState } from 'react'

export const PULL_THRESHOLD = 60
const MAX_DISPLAY = 72
const RESISTANCE = 0.45

export function usePullToRefresh(
  containerRef: React.RefObject<HTMLElement | null>,
  onRefresh: () => void,
  disabled = false,
) {
  const [pullDistance, setPullDistance] = useState(0)
  const startYRef = useRef<number | null>(null)
  const isPullingRef = useRef(false)
  const pullDistRef = useRef(0)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onTouchStart(e: TouchEvent) {
      if (disabledRef.current || el!.scrollTop > 0) return
      startYRef.current = e.touches[0].clientY
      isPullingRef.current = false
    }

    function onTouchMove(e: TouchEvent) {
      if (startYRef.current === null) return
      if (el!.scrollTop > 0) { startYRef.current = null; return }
      const raw = e.touches[0].clientY - startYRef.current
      if (raw <= 0) { startYRef.current = null; return }
      isPullingRef.current = true
      e.preventDefault()
      const dist = Math.min(raw * RESISTANCE, MAX_DISPLAY)
      pullDistRef.current = dist
      setPullDistance(dist)
    }

    function onTouchEnd() {
      if (isPullingRef.current && pullDistRef.current >= PULL_THRESHOLD) {
        onRefreshRef.current()
      }
      startYRef.current = null
      isPullingRef.current = false
      pullDistRef.current = 0
      setPullDistance(0)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [containerRef])

  return { pullDistance, triggered: pullDistRef.current >= PULL_THRESHOLD }
}
