import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { groupLienNextUp, type LienNextUpKind, type LienNextUpRow } from '../../lib/jobs/lienNextUp'
import { countLienSteps, lienLaddersShown, lienStepCard, lienStepOfRow, type LienStepAt, type LienStepFacts, type LienStepLadder } from '../../lib/jobs/lienNextUpSteps'
import { LIEN_JOB_DOOR_TITLE } from './LienJobNumber'
import { LienStepCardView, LienStepMark, LienStepRail, useLienStepCard } from './LienDeskSteps'

/**
 * The Lien desk's Do now tab (Next up until v2.4630; punch list #82, PR 2): every lien paper that asks for an act,
 * in deadline order, one button a row. The list is `lienNextUp.ts`; this draws it. A button
 * (or a press on the row) hands the row back to the desk, which opens the pane that already
 * does the work. Nothing is written here.
 *
 * Since v2.4631 the steps read too: a rail of four rungs per kind of paper above the rows
 * (`lienNextUpSteps.ts`), each with its count, a press narrowing the list to that rung; four
 * dots and a fraction on every row; and a card on the dots that writes the row's ladder out.
 *
 * A table on a computer; the same rows as cards on a phone.
 */

const KIND_WORDS: Record<LienNextUpKind, string> = { notice: 'Notice', affidavit: 'Affidavit', retainage: 'Retainage' }
const KIND_TONE: Record<LienNextUpKind, { bg: string; fg: string }> = {
  notice: { bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-700)' },
  affidavit: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-700)' },
  retainage: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' },
}

const tag = (kind: LienNextUpKind): CSSProperties => ({ display: 'inline-block', padding: '0 7px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 700, lineHeight: '18px', whiteSpace: 'nowrap', background: KIND_TONE[kind].bg, color: KIND_TONE[kind].fg })
const actBtn: CSSProperties = { padding: '5px 12px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', whiteSpace: 'nowrap' }
const openBtn: CSSProperties = { padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', whiteSpace: 'nowrap' }

/** "Oct 15 · 10 days left", "Oct 1 · 4 days late", "Oct 5 · today"; empty with no day. */
export function lienNextUpDueWords(r: Pick<LienNextUpRow, 'dueOn' | 'daysLeft'>): string {
  if (!r.dueOn || r.daysLeft == null) return ''
  const day = formatYmdMonthDay(r.dueOn)
  if (r.daysLeft < 0) return `${day} · ${-r.daysLeft} ${r.daysLeft === -1 ? 'day' : 'days'} late`
  if (r.daysLeft === 0) return `${day} · today`
  return `${day} · ${r.daysLeft} ${r.daysLeft === 1 ? 'day' : 'days'} left`
}

function dueColor(r: LienNextUpRow): string {
  if (r.daysLeft != null && r.daysLeft < 0) return 'var(--text-red-600)'
  return r.severity === 'red' ? 'var(--text-red-600)' : r.severity === 'amber' ? 'var(--text-amber-800)' : 'var(--text-muted)'
}

export default function LienDeskNextUp({
  rows,
  markTitle,
  loading,
  isMobile,
  onAct,
  onOpenJob,
  ready,
  onOpenRun,
  factsFor,
  viewerIsLeader,
  onOpenPaper,
  gapsFor,
}: {
  rows: ReadonlyArray<LienNextUpRow>
  loading: boolean
  isMobile: boolean
  onAct: (row: LienNextUpRow) => void
  /** The job's number and name as a door to the Job window (v2.4628); a GC's run row has no job and stays plain. */
  onOpenJob?: (jobId: string) => void
  /** Notices (and retainage notices) approved and waiting for the run — the ladders' fourth rung (v2.4631). */
  ready?: Partial<Record<LienStepLadder, number>>
  /** The rail's fourth rung opens the run (v2.4631). */
  onOpenRun?: () => void
  /** What the desk knows about a row's job, for its card (v2.4631). */
  factsFor?: (row: LienNextUpRow) => LienStepFacts
  viewerIsLeader?: boolean
  /** The chip as a door to the paper (v2.4632): opens the notice or the affidavit as it stands, blanks marked. */
  onOpenPaper?: (row: LienNextUpRow) => void
  /** How many statutory blanks the row's paper has (the chip's red count; a tick at zero); null when unknown. */
  gapsFor?: (row: LienNextUpRow) => number | null
  /** The find (v2.4721): a row's title with the typed words marked. */
  markTitle?: (text: string) => ReactNode
}) {
  // The rung the list is narrowed to (v2.4631); session-only, cleared on a second press.
  const [on, setOn] = useState<LienStepAt | null>(null)
  const counts = useMemo(() => countLienSteps(rows, ready ?? {}), [rows, ready])
  const ladders = useMemo(() => lienLaddersShown(counts), [counts])
  const card = useLienStepCard(isMobile)
  // The row whose card is open, for the card's own button.
  const [openRow, setOpenRow] = useState<LienNextUpRow | null>(null)
  if (loading) return <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</div>
  const groups = groupLienNextUp(rows)
  if (groups.length === 0) {
    return (
      <div data-lien-next-up="empty" style={{ padding: '2rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Nothing needs you right now. Every lien paper is sent, filed or waiting on its day. The Deadlines tab shows what is coming.
      </div>
    )
  }
  const dimmed = (r: LienNextUpRow): boolean => {
    if (!on) return false
    const at = lienStepOfRow(r)
    return !at || at.ladder !== on.ladder || at.step !== on.step
  }
  // The title: a text door to the job when there is one, underlined on hover (`.lienJobDoor`); the click stops here, so the row keeps its own.
  const title = (r: LienNextUpRow, style: CSSProperties) => {
    const jobId = r.jobId
    if (!jobId || !onOpenJob) return <span style={style} title={r.title}>{markTitle ? markTitle(r.title) : r.title}</span>
    return (
      <button
        type="button"
        className="lienJobDoor"
        data-testid={`lien-next-up-job-${jobId}`}
        title={LIEN_JOB_DOOR_TITLE}
        onClick={(ev) => {
          ev.stopPropagation()
          onOpenJob(jobId)
        }}
        style={{ ...style, border: 'none', background: 'none', padding: 0, margin: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', borderRadius: 3, minWidth: 0, maxWidth: '100%', ...(isMobile ? { minHeight: 28 } : null) }}
      >
        {markTitle ? markTitle(r.title) : r.title}
      </button>
    )
  }
  // The chip: a door to the paper when the desk offers one (v2.4632), ringed on hover, a red count of blanks or a tick.
  const chip = (r: LienNextUpRow) => {
    const canOpen = onOpenPaper && r.jobId && r.kind !== 'retainage'
    if (!canOpen) return <span style={tag(r.kind)}>{KIND_WORDS[r.kind]}</span>
    const gaps = gapsFor?.(r) ?? null
    return (
      <button
        type="button"
        className="lienPaperDoor"
        data-testid={`lien-next-up-paper-${r.jobId}-${r.kind}`}
        title={gaps ? `Open the ${r.kind} as it stands: ${gaps} ${gaps === 1 ? 'detail' : 'details'} missing` : `Open the ${r.kind} as it stands`}
        onClick={(ev) => {
          ev.stopPropagation()
          onOpenPaper(r)
        }}
        style={{ ...tag(r.kind), display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', font: 'inherit', fontSize: '0.68rem', cursor: 'pointer', ...(isMobile ? { minHeight: 28 } : null) }}
      >
        {KIND_WORDS[r.kind]}
        {gaps == null ? null : gaps > 0 ? (
          <span data-testid="lien-paper-gap-count" style={{ background: '#dc2626', color: '#fff', borderRadius: 999, minWidth: 14, height: 14, display: 'inline-grid', placeItems: 'center', fontSize: '0.6rem', padding: '0 4px', lineHeight: 1 }}>{gaps}</span>
        ) : (
          <span data-testid="lien-paper-gap-ok" aria-label="nothing missing" style={{ color: 'var(--text-green-700)', fontSize: '0.7rem', lineHeight: 1 }}>✓</span>
        )}
      </button>
    )
  }
  const mark = (r: LienNextUpRow) => (
    <LienStepMark
      at={lienStepOfRow(r)}
      ladder={r.kind}
      card={lienStepCard(r, factsFor?.(r))}
      isMobile={isMobile}
      onShow={(el, c) => {
        setOpenRow(r)
        card.show(el, c)
      }}
      onHide={card.hide}
    />
  )
  const button = (r: LienNextUpRow) => (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation()
        onAct(r)
      }}
      style={{ ...(r.button ? actBtn : openBtn), ...(isMobile ? { width: '100%', padding: '9px 12px', fontSize: '0.9rem' } : {}) }}
      data-lien-next-up-act={r.action}
    >
      {r.button ?? 'Open'}
    </button>
  )
  const openCard = card.open
  const cardButton = openCard ? openRow : null
  return (
    <div ref={card.hostRef} data-lien-next-up="list" style={{ position: 'relative', overflowY: 'auto', minHeight: 0, padding: isMobile ? '0.6rem 0.75rem 1rem' : '0.75rem 1.25rem 1.25rem' }}>
      <LienStepRail counts={counts} ladders={ladders} on={on} isMobile={isMobile} onPick={setOn} onOpenRun={onOpenRun} viewerIsLeader={viewerIsLeader} />
      {groups.map((g) => (
        <section key={g.group} aria-label={g.label} data-lien-next-up-group={g.group} style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 0.4rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: g.group === 'now' ? 'var(--text-red-600)' : 'var(--text-muted)' }}>
            {g.label} · {g.rows.length}
          </h3>
          <div style={{ display: 'grid', gap: isMobile ? 8 : 0, border: isMobile ? 'none' : '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
            {g.rows.map((r, i) => {
              const due = lienNextUpDueWords(r)
              const dim = dimmed(r)
              return isMobile ? (
                <div key={r.key} data-lien-next-up-row={r.key} data-dim={dim ? 'yes' : undefined} style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '0.6rem 0.7rem', display: 'grid', gap: 6, background: 'var(--surface)', opacity: dim ? 0.3 : 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {chip(r)}
                    {mark(r)}
                    {due ? <span style={{ fontSize: '0.78rem', fontWeight: 600, color: dueColor(r) }}>{due}</span> : null}
                  </div>
                  <div>{title(r, { fontWeight: 700, fontSize: '0.92rem', overflowWrap: 'anywhere', whiteSpace: 'normal' })}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{r.sub}</div>
                  {button(r)}
                </div>
              ) : (
                <div
                  key={r.key}
                  data-lien-next-up-row={r.key}
                  data-dim={dim ? 'yes' : undefined}
                  onClick={() => onAct(r)}
                  style={{ display: 'grid', gridTemplateColumns: '84px minmax(0, 1.2fr) 86px minmax(0, 1.4fr) 170px auto', gap: '0.75rem', alignItems: 'center', padding: '0.5rem 0.8rem', borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', opacity: dim ? 0.3 : 1 }}
                >
                  <span>{chip(r)}</span>
                  <span style={{ minWidth: 0, overflow: 'hidden' }}>{title(r, { fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' })}</span>
                  <span>{mark(r)}</span>
                  <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.sub}>{r.sub}</span>
                  <span style={{ fontWeight: 600, color: dueColor(r), whiteSpace: 'nowrap' }}>{due}</span>
                  <span style={{ justifySelf: 'end' }}>{button(r)}</span>
                </div>
              )
            })}
          </div>
        </section>
      ))}
      {openCard ? (
        <LienStepCardView card={openCard.card} place={openCard.place} onClose={card.close} onMouseEnter={card.cancelHide} onMouseLeave={card.hide}>
            {cardButton?.button ? (
              <button
                type="button"
                onClick={() => {
                  card.close()
                  onAct(cardButton)
                }}
                style={{ ...actBtn, padding: '4px 10px', fontSize: '0.78rem' }}
                data-testid="lien-step-card-act"
              >
                {cardButton.button}
              </button>
            ) : null}
        </LienStepCardView>
      ) : null}
    </div>
  )
}
