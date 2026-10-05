import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import type { GcNoticeBandWrongItem } from '../../lib/jobs/gcNoticeJobsBand'

/**
 * Put a GC on notice — the list under "N look wrong" (v2.4540). The count in the band's head
 * line is a button: pointing at it opens the jobs that look wrong, each with what looks wrong
 * and what is open; picking one sends the band to that row (`onPick`), which scrolls to it and
 * flashes it. A click pins the list open for a touch screen and a keyboard; Esc, a click
 * elsewhere or a pick closes it.
 */
export type GcNoticeWrongListProps = {
  items: ReadonlyArray<GcNoticeBandWrongItem>
  /** "372 · Dudley Mason" */
  labelOf: (jobId: string) => string
  onPick: (jobId: string) => void
  isMobile: boolean
}

/** Long enough that a pointer crossing the words on its way elsewhere opens nothing. */
const OPEN_DELAY_MS = 120
/** Long enough to travel from the words into the list. */
const CLOSE_DELAY_MS = 220

const trigger: CSSProperties = { background: 'none', border: 'none', borderBottom: '1px dashed currentColor', padding: 0, font: 'inherit', fontWeight: 700, color: 'var(--text-red-600)', cursor: 'pointer' }
const itemBtn: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '2px 10px', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '7px 10px', borderRadius: 7, cursor: 'pointer', font: 'inherit', color: 'var(--text-strong)' }
const stageWords = (status: string): string => (status ? status.replace(/_/g, ' ').replace(/^\w/, (m) => m.toUpperCase()) : '—')

export default function GcNoticeWrongList({ items, labelOf, onPick, isMobile }: GcNoticeWrongListProps) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const timer = useRef<number | null>(null)
  const clearTimer = () => {
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = null
  }
  const close = useCallback(() => {
    clearTimer()
    setOpen(false)
    setPinned(false)
  }, [])
  useEffect(() => clearTimer, [])

  // While it is open: Esc closes it (and only it — the window behind stays), a click elsewhere closes it.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      close()
    }
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, close])

  // The list never runs under the window's foot: it is as tall as the room under the words, in
  // the nearest scrolling box, and scrolls inside itself past that.
  const [room, setRoom] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return
    let box: HTMLElement | null = wrapRef.current.parentElement
    while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement
    const floor = box ? box.getBoundingClientRect().bottom : window.innerHeight
    setRoom(Math.max(160, Math.round(floor - wrapRef.current.getBoundingClientRect().bottom - 14)))
  }, [open])

  const n = items.length
  if (n === 0) return null
  const hoverIn = () => {
    if (isMobile) return
    clearTimer()
    if (!open) timer.current = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS)
  }
  const hoverOut = () => {
    if (isMobile || pinned) return
    clearTimer()
    timer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
  }
  const onTrigger = () => {
    clearTimer()
    if (open && pinned) close()
    else {
      setOpen(true)
      setPinned(true)
    }
  }
  const pick = (jobId: string) => {
    close()
    onPick(jobId)
  }

  return (
    <span ref={wrapRef} onMouseEnter={hoverIn} onMouseLeave={hoverOut} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={onTrigger} aria-haspopup="dialog" aria-expanded={open} title="See the jobs that look wrong" style={trigger} data-testid="gc-notice-band-wrong">
        {n} look{n === 1 ? 's' : ''} wrong <span aria-hidden="true" style={{ fontSize: '0.7em' }}>▾</span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={`The ${n} job${n === 1 ? '' : 's'} that look${n === 1 ? 's' : ''} wrong`}
          data-testid="gc-notice-band-wrong-list"
          style={{
            position: 'absolute',
            top: '100%',
            left: isMobile ? '50%' : 0,
            transform: isMobile ? 'translateX(-50%)' : undefined,
            zIndex: 30,
            // No gap under the words: the pointer never leaves the pair on its way down.
            paddingTop: 6,
            width: 'min(30rem, calc(100vw - 2.5rem))',
          }}
        >
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.18)', padding: 6, maxHeight: room != null ? Math.min(room, 416) : 'min(60vh, 26rem)', overflowY: 'auto', fontWeight: 400 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '4px 10px 6px' }}>Click a job to jump to its row</div>
            {items.map((it) => (
              <button key={it.jobId} type="button" className="gcNoticeWrongItem" onClick={() => pick(it.jobId)} style={itemBtn} data-testid="gc-notice-band-wrong-item" data-job-id={it.jobId}>
                <span style={{ fontWeight: 700, fontSize: '0.8125rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labelOf(it.jobId)}</span>
                <span style={{ fontWeight: 700, fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatUsdNoCents(it.open)}</span>
                <span style={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                  <span style={{ display: 'inline-block', padding: '0 6px', marginRight: 6, borderRadius: 5, background: 'var(--bg-muted)', color: 'var(--text-700)', fontSize: '0.68rem', fontWeight: 700, lineHeight: '17px' }}>{stageWords(it.status)}</span>
                  {it.readings.map((rd, i) => (
                    <span key={rd.key}>
                      {i > 0 ? ' · ' : ''}
                      <span style={{ color: rd.tone === 'red' ? 'var(--text-red-600)' : 'var(--text-amber-800)', fontWeight: 600 }}>{rd.label}</span>
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </span>
  )
}
