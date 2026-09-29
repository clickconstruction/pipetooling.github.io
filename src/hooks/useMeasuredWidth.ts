import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

/**
 * The element's live width (ResizeObserver), null until measured. Lifted out
 * of `StagesStageBar` in v2.4193 so the Billed rows' time bar can size its
 * segment labels by the same rule as the money bar.
 */
export function useMeasuredWidth<T extends HTMLElement>(): [RefObject<T>, number | null] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setWidth(el.getBoundingClientRect().width || null)
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}
