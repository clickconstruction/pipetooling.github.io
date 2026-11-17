import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import type { DraftPart } from '../../lib/jobs/noteTags'

const px = (value: string): number => Number.parseFloat(value) || 0

/**
 * The mark in the words: a layer under a see-through box that draws the same words unseen and
 * tints each run that is a tag. It sits over the box's own text area and follows its scroll, so
 * the tint stays under the name while a single-line box slides sideways.
 */
export function TagMarkLayer({ inputRef, parts }: { inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>; parts: DraftPart[] }) {
  const outer = useRef<HTMLDivElement | null>(null)
  const inner = useRef<HTMLDivElement | null>(null)

  const sync = useCallback(() => {
    const el = inputRef.current
    const o = outer.current
    const n = inner.current
    if (!el || !o || !n) return
    const cs = window.getComputedStyle(el)
    const multi = el.tagName === 'TEXTAREA'
    const padL = px(cs.paddingLeft)
    const padR = px(cs.paddingRight)
    const padT = px(cs.paddingTop)
    const padB = px(cs.paddingBottom)
    o.style.left = `${el.offsetLeft + px(cs.borderLeftWidth) + padL}px`
    o.style.top = `${el.offsetTop + px(cs.borderTopWidth) + padT}px`
    o.style.width = `${Math.max(0, el.clientWidth - padL - padR)}px`
    o.style.height = `${Math.max(0, el.clientHeight - padT - padB)}px`
    n.style.fontFamily = cs.fontFamily
    n.style.fontSize = cs.fontSize
    n.style.fontWeight = cs.fontWeight
    n.style.fontStyle = cs.fontStyle
    n.style.letterSpacing = cs.letterSpacing
    n.style.wordSpacing = cs.wordSpacing
    n.style.lineHeight = cs.lineHeight
    n.style.textIndent = cs.textIndent
    n.style.textTransform = cs.textTransform
    n.style.transform = multi ? `translateY(${-el.scrollTop}px)` : `translateX(${-el.scrollLeft}px)`
    n.style.whiteSpace = multi ? 'pre-wrap' : 'pre'
    n.style.overflowWrap = multi ? 'break-word' : 'normal'
    // A one-line box centres its words. A taller box starts them at the top.
    o.style.alignItems = multi ? 'flex-start' : 'center'
    n.style.width = multi ? '100%' : 'auto'
  }, [inputRef])

  // After every draw: the words, the caret and so the scroll may all have moved.
  useLayoutEffect(sync)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    let frame = 0
    const later = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(sync)
    }
    const events = ['scroll', 'input', 'keyup', 'select', 'pointerup'] as const
    for (const name of events) el.addEventListener(name, later)
    document.addEventListener('selectionchange', later)
    window.addEventListener('resize', later)
    const watcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(later)
    watcher?.observe(el)
    return () => {
      window.cancelAnimationFrame(frame)
      for (const name of events) el.removeEventListener(name, later)
      document.removeEventListener('selectionchange', later)
      window.removeEventListener('resize', later)
      watcher?.disconnect()
    }
  }, [inputRef, sync])

  return (
    <div ref={outer} aria-hidden="true" data-note-tag-mark style={{ position: 'absolute', display: 'flex', overflow: 'hidden', pointerEvents: 'none', userSelect: 'none' }}>
      <div ref={inner} style={{ flex: 'none', color: 'transparent', margin: 0, padding: 0 }}>
        {parts.map((p, i) =>
          p.mark === 'tag' ? (
            <mark key={i} data-mark="tag" style={{ background: 'var(--bg-blue-tint)', color: 'transparent', borderRadius: 4, boxShadow: '0 0 0 1px var(--border-blue)' }}>
              {p.text}
            </mark>
          ) : p.mark === 'typing' ? (
            <mark key={i} data-mark="typing" style={{ background: 'transparent', color: 'transparent', boxShadow: 'inset 0 -2px 0 0 var(--text-link)' }}>
              {p.text}
            </mark>
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
        {/* Keeps the last line's height when the words end on a new line. */}
        {'\u200b'}
      </div>
    </div>
  )
}
