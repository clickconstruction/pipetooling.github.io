import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { useLongPress } from '../../hooks/useLongPress'
import { classifySwipe } from '../../lib/people/usersTabPhone'
import type { JobNextChip, JobNextLine, JobNextTone } from '../../lib/jobs/jobNextLine'
import { renderStagesJobHcpChip } from './jobsStagesRowShared'

/** The green strip a right-swipe uncovers; past this fraction of it the release advances. */
export const PHONE_ROW_REVEAL_PX = 96
const REVEAL_TRIGGER = 0.6

export type StagesPhoneRowAdvance = {
  /** "Ready to Bill", "Move to Working", "Bill Customer", "Mark Paid". */
  label: string
  /** The line on top of the confirmation: the move, the money, the agreement, the schedule. */
  consequence: string
  /** 'sheet' = this row confirms (the stage has no window of its own); 'own' = `onConfirm` opens one. */
  confirm: 'sheet' | 'own'
  onConfirm: () => void
}

const toneStyle: Record<JobNextTone, CSSProperties> = {
  red: { background: 'var(--bg-red-100)', color: 'var(--text-red-700)', borderColor: 'var(--border-red)' },
  amber: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderColor: 'var(--border-amber)' },
  green: { background: 'var(--bg-green-100)', color: 'var(--text-green-700)', borderColor: 'var(--border-green)' },
}

/**
 * One job on the phone Pipeline (punch list #30, PR 2a): two lines and at most one chip.
 * Tap opens the job; the chip opens its fix; press-and-hold opens the ⋯ sheet; a swipe to
 * the right uncovers the stage's forward verb and, on release, confirms it — never a live
 * status button on a touch screen.
 */
export function StagesPhoneRow({
  job,
  next,
  busy,
  flash,
  advance,
  onOpen,
  onChip,
  onMore,
}: {
  job: JobWithDetails
  next: JobNextLine
  busy: boolean
  flash: boolean
  advance: StagesPhoneRowAdvance | null
  onOpen: () => void
  onChip: (chip: JobNextChip) => void
  onMore: () => void
}) {
  const [dragX, setDragX] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const start = useRef<{ x: number; y: number; axis: 'horizontal' | 'vertical' | 'undecided' } | null>(null)
  const swiped = useRef(false)
  const { handlers: press, consumeLongPress } = useLongPress(onMore)

  const canSwipe = advance != null && !busy

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    press.onPointerDown(e)
    if (!canSwipe || e.button !== 0) return
    start.current = { x: e.clientX, y: e.clientY, axis: 'undecided' }
    swiped.current = false
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    press.onPointerMove(e)
    const s = start.current
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (s.axis === 'undecided') s.axis = classifySwipe(dx, dy)
    if (s.axis !== 'horizontal') return
    swiped.current = true
    setDragX(Math.max(0, Math.min(dx, PHONE_ROW_REVEAL_PX + 24)))
  }
  function settle() {
    const s = start.current
    start.current = null
    const fired = s?.axis === 'horizontal' && dragX >= PHONE_ROW_REVEAL_PX * REVEAL_TRIGGER
    setDragX(0)
    if (fired && advance) {
      if (advance.confirm === 'sheet') setConfirmOpen(true)
      else advance.onConfirm()
    }
  }
  function onPointerUp() {
    press.onPointerUp()
    settle()
  }
  function onPointerCancel() {
    press.onPointerCancel()
    start.current = null
    swiped.current = false
    setDragX(0)
  }

  const number = renderStagesJobHcpChip(job, { fontSize: '0.6875rem', padding: '0 0.3rem', flexShrink: 0 })
  const customer = (job.customer_name ?? '').trim()
  const title = `${(job.job_name ?? '').trim() || 'Job'}${customer ? ` · ${customer}` : ''}`

  return (
    <>
      <div
        data-stages-job-id={job.id}
        style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--border)', background: flash ? 'var(--bg-amber-100)' : 'var(--surface)' }}
      >
        {advance ? (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: PHONE_ROW_REVEAL_PX,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#16a34a',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 700,
              textAlign: 'center',
              lineHeight: 1.15,
              padding: '0 0.35rem',
              opacity: dragX > 0 ? 1 : 0,
            }}
          >
            {advance.label} ✓
          </div>
        ) : null}
        <div
          role="button"
          tabIndex={0}
          aria-label={`${title} — ${next.line}${next.chip ? ` — ${next.chip.label}` : ''}. Tap to open; hold for more; swipe right to ${advance?.label.toLowerCase() ?? 'advance'}.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => {
            press.onPointerLeave()
            onPointerCancel()
          }}
          onPointerCancel={onPointerCancel}
          onContextMenu={press.onContextMenu}
          onClick={(e) => {
            if (consumeLongPress()) return
            if (swiped.current) {
              swiped.current = false
              return
            }
            if ((e.target as HTMLElement).closest('[data-phone-row-chip]')) return
            onOpen()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onOpen()
            }
          }}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.55rem 0.75rem',
            minHeight: 56,
            background: flash ? 'var(--bg-amber-100)' : 'var(--surface)',
            transform: dragX ? `translateX(${dragX}px)` : undefined,
            transition: start.current ? undefined : 'transform 0.18s ease',
            touchAction: 'pan-y',
            cursor: 'pointer',
            WebkitTouchCallout: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
              {number}
              <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{next.line}</div>
          </div>
          {busy ? (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>…</span>
          ) : next.chip ? (
            <button
              type="button"
              data-phone-row-chip
              title={next.chip.title}
              onClick={(e) => {
                e.stopPropagation()
                if (next.chip) onChip(next.chip)
              }}
              style={{
                flexShrink: 0,
                borderWidth: 1,
                borderStyle: 'solid',
                borderRadius: 999,
                padding: '0.25rem 0.55rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                lineHeight: 1.1,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                ...toneStyle[next.chip.tone],
              }}
            >
              {next.chip.label}
            </button>
          ) : (
            <span aria-hidden="true" style={{ color: 'var(--text-faint)', fontSize: '1.1rem', flexShrink: 0 }}>
              ›
            </span>
          )}
        </div>
      </div>
      {confirmOpen && advance ? (
        <div
          role="presentation"
          onClick={() => setConfirmOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1200 }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${advance.label} — ${title}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              color: 'var(--text)',
              borderRadius: '14px 14px 0 0',
              width: '100%',
              maxWidth: 640,
              padding: '0.75rem 0.85rem calc(0.85rem + env(safe-area-inset-bottom))',
              boxShadow: '0 -8px 30px rgba(0,0,0,0.25)',
              boxSizing: 'border-box',
            }}
          >
            <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 0.6rem' }} />
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-strong)' }}>
              {advance.label} · {title}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>{advance.consequence}</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false)
                  advance.onConfirm()
                }}
                style={{ flex: 1, padding: '0.7rem', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer' }}
              >
                {advance.label}
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                style={{ padding: '0.7rem 1rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: '0.9375rem', cursor: 'pointer' }}
              >
                Not yet
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
