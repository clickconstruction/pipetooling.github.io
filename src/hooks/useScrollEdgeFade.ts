import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { NO_SCROLL_EDGES, scrollEdgeMask, scrollEdges, type ScrollEdges } from '../lib/scrollEdges'

/**
 * A row that scrolls sideways fades its cut ends (v2.4441): put `ref`, `onScroll` and `style` on
 * the scroller. Read after every render and on resize, because the row's width follows the tabs
 * it holds and the window; the same answer is no update.
 */
export function useScrollEdgeFade<T extends HTMLElement>(): { ref: RefObject<T>; onScroll: () => void; style: CSSProperties; edges: ScrollEdges } {
  const ref = useRef<T>(null)
  const [edges, setEdges] = useState<ScrollEdges>(NO_SCROLL_EDGES)
  const read = useCallback(() => {
    const el = ref.current
    const next = el ? scrollEdges(el) : NO_SCROLL_EDGES
    setEdges((prev) => (prev.left === next.left && prev.right === next.right ? prev : next))
  }, [])
  useEffect(() => {
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  })
  const mask = scrollEdgeMask(edges)
  return { ref, onScroll: read, style: mask ? { WebkitMaskImage: mask, maskImage: mask } : {}, edges }
}
