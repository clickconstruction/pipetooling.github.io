import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { HOURS_GRID_FIRST_COL_LABEL } from '../constants/hoursGridFirstCol'

/** Matches Hours table `tfoot` label cell: 0.875rem, font-weight 600, horizontal padding 0.75rem. */
export function useHoursGridFirstColWidthPx(): {
  widthPx: number | null
  measurer: ReactElement
} {
  const ref = useRef<HTMLSpanElement>(null)
  const [widthPx, setWidthPx] = useState<number | null>(null)

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    setWidthPx(Math.ceil(el.getBoundingClientRect().width))
  }, [])

  useLayoutEffect(() => {
    measure()
  }, [measure])

  useEffect(() => {
    let timeoutId: number | undefined
    const onResize = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => measure(), 100)
    }
    window.addEventListener('resize', onResize)
    void document.fonts?.ready?.then(() => measure())
    return () => {
      window.removeEventListener('resize', onResize)
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [measure])

  const measurer = (
    <span
      ref={ref}
      aria-hidden
      style={{
        position: 'fixed',
        left: -9999,
        top: 0,
        visibility: 'hidden',
        whiteSpace: 'nowrap',
        fontSize: '0.875rem',
        fontWeight: 600,
        fontFamily: 'inherit',
        padding: '0 0.75rem',
        pointerEvents: 'none',
      }}
    >
      {HOURS_GRID_FIRST_COL_LABEL}
    </span>
  )

  return { widthPx, measurer }
}
