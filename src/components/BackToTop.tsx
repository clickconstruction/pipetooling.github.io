import { useEffect, useState, type RefObject } from 'react'
import { BACK_TO_TOP_LABEL, backToTopScrollBehavior, backToTopShown } from '../lib/backToTop'

/**
 * A quiet press at the foot of a long page that takes the person back to its top (v2.8334, the owner's ask of
 * 2026-11-23 for the Dashboard). The rules are in `src/lib/backToTop.ts`.
 *
 * It sits in the page's own flow, centred, in muted words with an arrow, a thumb tall. It is not a filled
 * button and it floats over nothing. It draws nothing on a page under two screens tall, and it reads the
 * page's height again as the page's cards load and fold.
 *
 * The window is what scrolls. The press sends it to the top, a glide unless the person asked for less
 * motion, and moves focus to `topRef` so a keyboard and a screen reader are at the top too. Focus moves at
 * once and without a scroll of its own, so it never cuts the glide short.
 */
export function BackToTop({ topRef, onPress }: { topRef: RefObject<HTMLElement | null>; onPress?: () => void }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const read = () => setShown(backToTopShown({ pageHeight: document.documentElement.scrollHeight, viewportHeight: window.innerHeight }))
    read()
    window.addEventListener('resize', read)
    // The page grows as its cards load, and shrinks as they fold.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read)
    ro?.observe(document.body)
    return () => {
      window.removeEventListener('resize', read)
      ro?.disconnect()
    }
  }, [])

  if (!shown) return null

  const goUp = () => {
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, left: 0, behavior: backToTopScrollBehavior(reduced) })
    topRef.current?.focus({ preventScroll: true })
    onPress?.()
  }

  return (
    <div data-back-to-top="" style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0 0.25rem' }}>
      <button
        type="button"
        onClick={goUp}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          minHeight: 44,
          padding: '0.5rem 1.25rem',
          border: 'none',
          background: 'none',
          color: 'var(--text-muted)',
          fontFamily: 'inherit',
          fontSize: '0.875rem',
          cursor: 'pointer',
        }}
      >
        <span aria-hidden="true">↑</span>
        {BACK_TO_TOP_LABEL}
      </button>
    </div>
  )
}
