import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Everything drawn above an element: its earlier siblings, and the earlier siblings of each box it sits in, up to
 * the body. When one of them grows, shrinks, appears or goes, the element's top edge moves.
 */
export function elementsAbove(el: Element): Element[] {
  const out: Element[] = []
  for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
    for (let s = node.previousElementSibling; s; s = s.previousElementSibling) out.push(s)
  }
  return out
}

/**
 * How far an element's top edge is from the top of the screen, kept current (punch list #352, PR 0).
 *
 * A page that fills the screen under the app's chrome sizes itself from this. Reading it once was not enough: when
 * the Home Screen banner above the Lien desk closed, the desk kept the height it had with the banner there and left
 * a grey band the banner's height above the phone's bottom bar. So it is read again on a window resize, when
 * anything above the element changes size, and when anything above it is added or taken away.
 */
export function useTopEdge(ref: RefObject<HTMLElement | null>): number {
  const [top, setTop] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setTop(Math.max(0, Math.round(el.getBoundingClientRect().top)))
    const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    const watchAbove = () => {
      sizes?.disconnect()
      for (const above of elementsAbove(el)) sizes?.observe(above)
    }
    const children =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(() => {
            watchAbove()
            measure()
          })
    for (let box = el.parentElement; box; box = box.parentElement) {
      children?.observe(box, { childList: true })
      if (box === document.body) break
    }
    watchAbove()
    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      sizes?.disconnect()
      children?.disconnect()
    }
  }, [ref])
  return top
}
