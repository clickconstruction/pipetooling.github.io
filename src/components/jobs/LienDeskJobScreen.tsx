import { useEffect, useRef, type CSSProperties } from 'react'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import type { LienNextUpRow } from '../../lib/jobs/lienNextUp'
import type { LienStepCard } from '../../lib/jobs/lienNextUpSteps'
import type { LienJobScreen, LienJobScreenDoorKey } from '../../lib/jobs/lienPhoneJobScreen'
import { LienStepCardItems } from './LienDeskSteps'

/**
 * A job as its own screen on a phone's Lien desk (punch list #352, PR 4): it fills the desk's panel, over the header
 * and the list. The way back and the job on one line, when the paper is due, the four steps written out, the doors,
 * and the row's own press pinned at the foot where a thumb rests. The words are `lienJobScreen`'s; the steps are the
 * step card's. Nothing is written here: the press hands the row back to the desk, as the row's button does.
 */

const TONE: Record<LienStepCard['tone'], { fg: string; bg: string }> = {
  red: { fg: 'var(--text-red-700)', bg: 'var(--bg-red-tint)' },
  amber: { fg: 'var(--text-amber-800)', bg: 'var(--bg-amber-tint)' },
  quiet: { fg: 'var(--text-700)', bg: 'var(--bg-subtle)' },
}

const DOOR: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: '0 0.75rem', width: '100%', minHeight: 56, padding: '0.5rem 0.9rem', border: 'none', borderTop: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit', textAlign: 'left', cursor: 'pointer' }
const HEAD: CSSProperties = { margin: 0, padding: '0.9rem 0.9rem 0.35rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const PRESS: CSSProperties = { minHeight: 48, padding: '0 16px', borderRadius: 10, font: 'inherit', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }

export default function LienDeskJobScreen({
  row,
  screen,
  card,
  onClose,
  onAct,
  onSecondary,
  onDoor,
  onOpenJob,
}: {
  row: LienNextUpRow
  screen: LienJobScreen
  card: LienStepCard
  onClose: () => void
  /** The pinned press: what the row's button does. */
  onAct: () => void
  onSecondary?: () => void
  onDoor: (key: LienJobScreenDoorKey) => void
  /** A run row's jobs are doors to each job. */
  onOpenJob?: (jobId: string) => void
}) {
  const backRef = useRef<HTMLButtonElement | null>(null)
  const isTopmost = useModalStackEntry()
  useEffect(() => {
    backRef.current?.focus()
  }, [row.key])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !isTopmost()) return
      e.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, isTopmost])
  const tone = TONE[screen.tone]
  return (
    <div role="dialog" aria-modal="true" aria-label={`${screen.title}: where its lien paper stands`} data-lien-job-screen={row.key} style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', background: 'var(--surface)', color: 'var(--text-base)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.15rem 0.6rem 0.45rem 0.3rem', borderBottom: '1px solid var(--border)' }}>
        <button ref={backRef} type="button" onClick={onClose} aria-label="Back to the list" data-lien-job-screen-back style={{ flex: 'none', width: 44, height: 44, display: 'inline-grid', placeItems: 'center', border: 'none', background: 'none', color: 'var(--text-700)', font: 'inherit', fontSize: '1.5rem', lineHeight: 1, cursor: 'pointer' }}>
          <span aria-hidden="true">‹</span>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 data-lien-job-screen-title style={{ margin: 0, fontSize: '1.0625rem', lineHeight: 1.25, overflowWrap: 'anywhere' }}>{screen.title}</h2>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {screen.kindWords}
            {screen.owes ? <span data-lien-job-screen-owes style={{ fontWeight: 700, color: 'var(--text-base)', fontVariantNumeric: 'tabular-nums' }}> · {screen.owes}</span> : null}
          </div>
        </div>
      </div>
      <div data-lien-job-screen-body style={{ overflowY: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
        <div data-lien-job-screen-due data-tone={screen.tone} style={{ padding: '0.7rem 0.9rem', background: tone.bg, borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: tone.fg }}>{screen.due}</div>
          {screen.state ? <div style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>{screen.state}</div> : null}
        </div>
        <h3 style={HEAD}>Where it stands</h3>
        <div style={{ padding: '0 0.9rem 0.4rem' }}>
          <LienStepCardItems card={card} roomy />
          {card.blocked ? (
            <div data-testid="lien-step-card-blocked" style={{ marginTop: 6, fontSize: '0.875rem', color: 'var(--text-amber-800)' }}>
              <strong>Blocked by:</strong> {card.blocked}
            </div>
          ) : null}
          <div data-lien-job-screen-foot-words style={{ marginTop: 6, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{card.foot}</div>
        </div>
        {screen.jobs.length > 0 ? (
          <>
            <h3 style={HEAD}>The {screen.jobs.length} jobs</h3>
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              {screen.jobs.map((j) => (
                <button key={j.jobId} type="button" disabled={!onOpenJob} onClick={() => onOpenJob?.(j.jobId)} data-lien-job-screen-job={j.jobId} style={{ ...DOOR, minHeight: 48, cursor: onOpenJob ? 'pointer' : 'default' }}>
                  <span style={{ minWidth: 0, fontSize: '1rem', fontWeight: 600, overflowWrap: 'anywhere' }}>{j.title}</span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{j.dueOn ? formatYmdMonthDay(j.dueOn) : ''}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
        {screen.doors.length > 0 ? (
          <div style={{ marginTop: '0.6rem', borderBottom: '1px solid var(--border)' }}>
            {screen.doors.map((d) => (
              <button key={d.key} type="button" onClick={() => onDoor(d.key)} data-lien-job-screen-door={d.key} style={DOOR}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '1rem', fontWeight: 600 }}>{d.label}</span>
                  {d.hint ? <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: d.warn ? 700 : 400, color: d.warn ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{d.hint}</span> : null}
                </span>
                <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '1.25rem', lineHeight: 1 }}>›</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div data-lien-job-screen-foot style={{ display: 'flex', gap: 8, padding: '0.6rem 0.75rem calc(0.6rem + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--border-strong)', background: 'var(--surface)' }}>
        {screen.secondary && onSecondary ? (
          <button type="button" onClick={onSecondary} data-lien-job-screen-secondary style={{ ...PRESS, flex: 'none', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)' }}>
            {screen.secondary}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onAct}
          data-lien-job-screen-act={row.action}
          style={{ ...PRESS, flex: 1, minWidth: 0, ...(screen.press.primary ? { border: 'none', background: '#2563eb', color: '#fff' } : { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)' }) }}
        >
          {screen.press.label}
        </button>
      </div>
    </div>
  )
}
