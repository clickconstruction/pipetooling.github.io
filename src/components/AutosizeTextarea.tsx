import { useCallback, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

export type AutosizeTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> & {
  minRows?: number
  /** Visual padding: add this many blank line-heights after fitting content. */
  extraLines?: number
}

function lineHeightPx(el: HTMLTextAreaElement): number {
  const lh = getComputedStyle(el).lineHeight
  const n = parseFloat(lh)
  if (Number.isFinite(n)) return n
  const fs = parseFloat(getComputedStyle(el).fontSize)
  return Number.isFinite(fs) ? fs * 1.25 : 16
}

export default function AutosizeTextarea({
  minRows = 2,
  extraLines = 0,
  style,
  className,
  value,
  ...rest
}: AutosizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const syncHeight = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const contentH = el.scrollHeight
    const pad = Math.max(0, extraLines) * lineHeightPx(el)
    el.style.height = `${contentH + pad}px`
  }, [extraLines])

  useLayoutEffect(() => {
    syncHeight()
  }, [value, minRows, syncHeight])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      syncHeight()
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
    }
  }, [syncHeight])

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      className={className}
      style={{
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        resize: 'none',
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    />
  )
}
