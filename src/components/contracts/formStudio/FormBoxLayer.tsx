import { useCallback, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { pdfRectToScreen, screenRectToPdf, type FormBox, type FormPage, type FormRect, type FormSchema, type FormValues, type ScreenRect } from '../../../lib/forms/formSchema'

/**
 * The draggable / resizable boxes over a rendered page (Form Studio). Ported
 * from govtooling's AnchorBox: controlled, emits PDF-space rects, corner
 * handles resize, the body moves. Coordinates arrive in PDF points and leave
 * in PDF points; only the pointer math happens in CSS px.
 */

type Handle = 'nw' | 'ne' | 'sw' | 'se'

const BOX_TYPE_COLORS: Record<FormBox['type'], string> = {
  text: '#2563eb',
  digits: '#7c3aed',
  checkbox: '#0891b2',
  signature: '#b0662f',
  date: '#059669',
  constant: '#6b7280',
}

export function FormBoxLayer({
  schema,
  pageNo,
  scale,
  selectedKeys,
  showSamples,
  values,
  onSelect,
  onChangeRect,
  onBackgroundClick,
}: {
  schema: FormSchema
  pageNo: number
  scale: number
  selectedKeys: string[]
  showSamples: boolean
  values: FormValues
  onSelect: (key: string, additive: boolean) => void
  onChangeRect: (key: string, rect: FormRect) => void
  onBackgroundClick?: (at: { x: number; y: number }) => void
}) {
  const page: FormPage = schema.pages[pageNo - 1] ?? { width: 612, height: 792 }
  const boxes = schema.boxes.filter((b) => b.page === pageNo)
  const layerRef = useRef<HTMLDivElement>(null)

  const onLayerPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget || !onBackgroundClick) return
      const r = e.currentTarget.getBoundingClientRect()
      const x = (e.clientX - r.left) / scale
      const y = page.height - (e.clientY - r.top) / scale
      onBackgroundClick({ x, y })
    },
    [onBackgroundClick, page.height, scale],
  )

  return (
    <div ref={layerRef} onPointerDown={onLayerPointerDown} style={{ position: 'absolute', inset: 0 }}>
      {boxes.map((b) => (
        <BoxItem
          key={b.key}
          box={b}
          rect={pdfRectToScreen(b.rect, page, scale)}
          page={page}
          scale={scale}
          selected={selectedKeys.includes(b.key)}
          sample={showSamples ? values[b.key] : undefined}
          onSelect={onSelect}
          onChangeRect={onChangeRect}
        />
      ))}
    </div>
  )
}

function BoxItem({
  box,
  rect,
  page,
  scale,
  selected,
  sample,
  onSelect,
  onChangeRect,
}: {
  box: FormBox
  rect: ScreenRect
  page: FormPage
  scale: number
  selected: boolean
  sample: string | boolean | undefined
  onSelect: (key: string, additive: boolean) => void
  onChangeRect: (key: string, rect: FormRect) => void
}) {
  const startRef = useRef<{ pointerId: number; mode: 'move' | Handle; x: number; y: number; rect: ScreenRect } | null>(null)
  const color = BOX_TYPE_COLORS[box.type]

  const begin = (e: ReactPointerEvent<HTMLDivElement>, mode: 'move' | Handle) => {
    e.stopPropagation()
    e.preventDefault()
    onSelect(box.key, e.shiftKey)
    startRef.current = { pointerId: e.pointerId, mode, x: e.clientX, y: e.clientY, rect }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = startRef.current
    if (!s || s.pointerId !== e.pointerId) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    let next: ScreenRect
    if (s.mode === 'move') next = { ...s.rect, left: s.rect.left + dx, top: s.rect.top + dy }
    else {
      const minPx = 3 * scale
      let { left, top, width, height } = s.rect
      if (s.mode.includes('w')) {
        left = s.rect.left + dx
        width = s.rect.width - dx
      }
      if (s.mode.includes('e')) width = s.rect.width + dx
      if (s.mode.includes('n')) {
        top = s.rect.top + dy
        height = s.rect.height - dy
      }
      if (s.mode.includes('s')) height = s.rect.height + dy
      if (width < minPx) {
        if (s.mode.includes('w')) left = s.rect.left + s.rect.width - minPx
        width = minPx
      }
      if (height < minPx) {
        if (s.mode.includes('n')) top = s.rect.top + s.rect.height - minPx
        height = minPx
      }
      next = { left, top, width, height }
    }
    onChangeRect(box.key, screenRectToPdf(next, page, scale))
  }
  const end = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startRef.current?.pointerId === e.pointerId) {
      startRef.current = null
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* not captured */
      }
    }
  }

  const text = sample === undefined ? '' : typeof sample === 'boolean' ? (sample ? 'X' : '') : sample
  const fontPx = Math.max(6, Math.min((box.fontSize ?? 10) * scale, rect.height * 0.8))
  const style: CSSProperties = {
    position: 'absolute',
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    boxSizing: 'border-box',
    border: `${selected ? 2 : 1}px ${box.bind || box.bindSegments ? 'solid' : 'dashed'} ${color}`,
    background: `${color}${selected ? '33' : '1a'}`,
    cursor: 'move',
    fontSize: fontPx,
    lineHeight: 1,
    color: '#111',
    fontFamily: box.type === 'signature' ? '"Great Vibes", cursive' : 'Helvetica, Arial, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: box.align === 'center' || box.type === 'checkbox' ? 'center' : box.align === 'right' ? 'flex-end' : 'flex-start',
    padding: '0 2px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    zIndex: selected ? 3 : 2,
    userSelect: 'none',
    touchAction: 'none',
  }
  const handleStyle = (h: Handle): CSSProperties => ({
    position: 'absolute',
    width: 8,
    height: 8,
    background: color,
    border: '1px solid #fff',
    borderRadius: 1,
    cursor: `${h}-resize`,
    ...(h.includes('n') ? { top: -5 } : { bottom: -5 }),
    ...(h.includes('w') ? { left: -5 } : { right: -5 }),
  })
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${box.label || box.key} (${box.type})`}
      title={`${box.key} · ${box.type}${box.bind ? ` · ${box.bind.split('.').pop()}` : ''}`}
      data-box-key={box.key}
      style={style}
      onPointerDown={(e) => begin(e, 'move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {text ? (
        <span style={{ pointerEvents: 'none' }}>{text}</span>
      ) : (
        <span style={{ pointerEvents: 'none', fontSize: Math.max(6, Math.min(9 * scale * 0.7, rect.height * 0.7)), color, fontFamily: 'ui-monospace, Menlo, monospace', opacity: 0.85 }}>{box.type === 'checkbox' ? '' : box.key}</span>
      )}
      {selected
        ? (['nw', 'ne', 'sw', 'se'] as Handle[]).map((h) => (
            <div key={h} style={handleStyle(h)} onPointerDown={(e) => begin(e, h)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
          ))
        : null}
    </div>
  )
}
