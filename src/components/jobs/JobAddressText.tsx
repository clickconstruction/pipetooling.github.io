import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Job-column address text. Renders the street on its own line with the city line
 * below (the clean two-line split) — but ONLY while the street fits on one line.
 * When the street itself wraps, that forced break reads badly (the street splits
 * across lines and the city is stranded below with a gap), so we drop the break
 * and let the whole address flow as one continuous, naturally-wrapping string.
 *
 * Whether the street wrapped can't be known from CSS alone, so we measure the
 * street span's line-box count (getClientRects). The ResizeObserver watches the
 * OUTER span — a flex item, so it has a real box and reliably fires on column
 * reflow, unlike an inline span whose ResizeObserver box is undefined.
 */
export function JobAddressText({ line1, line2 }: { line1: string; line2?: string }) {
  const outerRef = useRef<HTMLSpanElement>(null)
  const line1Ref = useRef<HTMLSpanElement>(null)
  const [line1Wrapped, setLine1Wrapped] = useState(false)

  useLayoutEffect(() => {
    const l1 = line1Ref.current
    const outer = outerRef.current
    if (!l1 || !outer) return
    const measure = () => setLine1Wrapped(l1.getClientRects().length > 1)
    measure()
    // Columns finish sizing after this effect's first pass — re-measure next frame.
    const raf = requestAnimationFrame(measure)
    if (typeof ResizeObserver === 'undefined') return () => cancelAnimationFrame(raf)
    const ro = new ResizeObserver(measure)
    ro.observe(outer)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [line1, line2])

  return (
    <span ref={outerRef}>
      <span ref={line1Ref}>{line1}</span>
      {line2 ? (
        line1Wrapped ? (
          ` ${line2}`
        ) : (
          <>
            <br />
            {line2}
          </>
        )
      ) : null}
    </span>
  )
}
