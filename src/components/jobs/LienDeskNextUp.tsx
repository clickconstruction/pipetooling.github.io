import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { groupLienNextUp, isLienReminderRow, type LienNextUpKind, type LienNextUpRow } from '../../lib/jobs/lienNextUp'
import type { LienReminderRow, LienReminders } from '../../lib/jobs/lienReminders'
import { countLienSteps, lienLaddersShown, lienStepBrief, lienStepCard, lienStepGroups, lienStepOfRow, type LienStepAt, type LienStepFacts, type LienStepLadder } from '../../lib/jobs/lienNextUpSteps'
import { EmptyState } from '../EmptyState'
import { LIEN_JOB_DOOR_TITLE } from './LienJobNumber'
import { LienStepBrief, LienStepCardView, LienStepMark, LienStepRail, LienStepRow, useLienStepCard } from './LienDeskSteps'
import { lienTimelineWhyChips, type LienTimelineRow } from '../../lib/jobs/lienNoticeTimeline'

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
 * Since punch list #262 a REMINDERS rail sits between the notices' and the affidavits', its four
 * counts from `lienReminders.ts`; the courtesy and letter-two rows read under *Reminders*, and a
 * rung pressed lists the sent notices that stand on it with no row here, each a door to its notice.
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
  printed,
  foldsOpen,
  waitingOn,
  reminders,
  onOpenReminder,
  timelineFor,
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
  /** Of the fourth rung's count, how many printed and wait on their tracking numbers (punch list #101). */
  printed?: Partial<Record<LienStepLadder, number>>
  /** Open every run row's list of jobs (the find is on, punch list #101). */
  foldsOpen?: boolean
  /** The leader the office's waiting rows wait on, by name, when they all wait on one (punch list #101 PR 3). */
  waitingOn?: string | null
  /** The REMINDERS ladder (punch list #262): every sent notice's rung, the four counts and the ones before day 7. */
  reminders?: LienReminders
  /** A rung's row with no row on the list, pressed: the desk opens its notice. Without it the row opens the notice under Sent through `onAct`. */
  onOpenReminder?: (row: LienReminderRow) => void
  /** One sent notice's dated timeline for the step brief (PR 2 of #274); null when the desk has no clock for it. */
  timelineFor?: (jobId: string) => ReadonlyArray<LienTimelineRow> | null
}) {
  // The rung the list is narrowed to (v2.4631); session-only, cleared on a second press.
  const [on, setOn] = useState<LienStepAt | null>(null)
  // The notice the brief's timeline draws (PR 2 of #274); the first on the step until picked.
  const [pickedJobId, setPickedJobId] = useState<string | null>(null)
  const counts = useMemo(() => countLienSteps(rows, ready ?? {}, reminders?.counts), [rows, ready, reminders])
  const ladders = useMemo(() => lienLaddersShown(counts), [counts])
  const card = useLienStepCard(isMobile)
  // The row whose card is open, for the card's own button.
  const [openRow, setOpenRow] = useState<LienNextUpRow | null>(null)
  // A run row's list of jobs (punch list #101), folded until pressed; the find opens them all.
  const [folds, setFolds] = useState<ReadonlySet<string>>(() => new Set())
  if (loading) return <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</div>
  const byDay = groupLienNextUp(rows, { waitingOn })
  // A pressed rung sorts the list — its rows first, the rest after, nothing faded (v2.6574, in place of v2.4631's fade).
  const groups = on ? lienStepGroups(rows, on) : byDay
  if (byDay.length === 0) {
    return (
      <div data-lien-next-up="empty" style={{ padding: '2rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Nothing needs you right now. Every lien paper is sent, filed or waiting on its day. The Deadlines tab shows what is coming.
      </div>
    )
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
    if (r.jobs) return <span style={{ ...tag('retainage') }}>Run</span>
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
      ladder={lienStepOfRow(r)?.ladder ?? r.kind}
      card={lienStepCard(r, factsFor?.(r))}
      isMobile={isMobile}
      onShow={(el, c) => {
        setOpenRow(r)
        card.show(el, c)
      }}
      onHide={card.hide}
    />
  )
  const secondary = (r: LienNextUpRow) =>
    r.secondary ? (
      <button
        type="button"
        onClick={(ev) => {
          ev.stopPropagation()
          onAct({ ...r, target: r.secondary!.target })
        }}
        style={{ ...openBtn, ...(isMobile ? { width: '100%', padding: '9px 12px', fontSize: '0.9rem' } : { padding: '2px 10px', fontSize: '0.78rem' }) }}
        data-lien-next-up-secondary={r.key}
      >
        {r.secondary.words}
      </button>
    ) : null
  // A run row's jobs (punch list #101): each a door to its job, with its day.
  const fold = (r: LienNextUpRow) => {
    if (!r.jobs || r.jobs.length === 0) return null
    const open = Boolean(foldsOpen) || folds.has(r.key)
    return (
      <div style={{ gridColumn: '1 / -1', paddingLeft: isMobile ? 0 : 'calc(84px + 0.75rem)' }} onClick={(ev) => ev.stopPropagation()}>
        {/* On a computer the row's question reads here in full: its own column is narrowed by the two buttons. */}
        {/* …and its quieter button follows the question it answers, so the row's last column keeps one button. */}
        {isMobile ? null : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginRight: 10 }}>
            <span data-lien-next-up-run-sub style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{r.sub}</span>
            {secondary(r)}
          </span>
        )}
        <button
          type="button"
          aria-expanded={open}
          data-lien-next-up-fold={r.key}
          onClick={() => setFolds((prev) => { const next = new Set(prev); if (next.has(r.key)) next.delete(r.key); else next.add(r.key); return next })}
          style={{ border: 'none', background: 'none', padding: '2px 0', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer' }}
        >
          {open ? '▾' : '▸'} The {r.jobs.length} jobs
        </button>
        {open ? (
          <div data-lien-next-up-fold-body={r.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '1px 12px', margin: '2px 0 4px', paddingLeft: 10, borderLeft: '2px solid var(--border)', fontSize: '0.8rem' }}>
            {r.jobs.map((j) => (
              <div key={j.jobId} style={{ display: 'contents' }}>
                {title({ ...r, jobId: j.jobId, title: j.title }, { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' })}
                <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{j.dueOn ? formatYmdMonthDay(j.dueOn) : ''}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }
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
  // A REMINDERS rung pressed (punch list #262): the sent notices on it that have no row here, so every name behind the count can be seen.
  const reminderStep = on?.ladder === 'reminder' ? on.step : null
  const reminderRows = reminderStep && reminders ? reminders.rows.filter((r) => r.step === reminderStep && !rows.some((x) => x.jobId === r.jobId && isLienReminderRow(x))) : []
  const reminderOnList = reminderStep ? rows.filter((r) => isLienReminderRow(r) && r.reminder?.step === reminderStep).length : 0
  const reminderStub = (r: LienReminderRow): LienNextUpRow => ({ key: `reminder:${r.jobId}`, kind: 'notice', jobId: r.jobId, gcId: null, title: r.title, sub: r.words, dueOn: null, daysLeft: null, severity: 'quiet', group: 'reminders', action: 'courtesy', button: null, target: { open: 'notices', jobId: r.jobId, pile: 'sent' }, reminder: r })
  // The brief's timeline (PR 2 of #274): the notices on the pressed REMINDERS rung, the picked one's rows, and why each is here as counts.
  const stepNotices = on?.ladder === 'reminder' ? [...(groups[0]?.rows ?? []).filter((r) => r.jobId).map((r) => ({ jobId: r.jobId as string, title: r.title })), ...reminderRows.map((r) => ({ jobId: r.jobId, title: r.title }))] : []
  const picked = stepNotices.find((n) => n.jobId === pickedJobId)?.jobId ?? stepNotices[0]?.jobId ?? null
  const timelineRows = picked && timelineFor ? timelineFor(picked) : null
  const timeline = picked && timelineRows && timelineRows.length ? { rows: timelineRows, options: stepNotices, picked, onPick: setPickedJobId } : null
  const whyChips = on?.ladder === 'reminder' && reminders ? lienTimelineWhyChips(reminders.rows.filter((r) => r.step === on.step && r.counted).map((r) => r.why ?? '')) : undefined
  const openCard = card.open
  const cardButton = openCard ? openRow : null
  return (
    <div ref={card.hostRef} data-lien-next-up="list" style={{ position: 'relative', overflowY: 'auto', minHeight: 0, padding: isMobile ? '0.6rem 0.75rem 1rem' : '0.75rem 1.25rem 1.25rem' }}>
      <LienStepRail counts={counts} ladders={ladders} on={on} isMobile={isMobile} onPick={setOn} onOpenRun={onOpenRun} viewerIsLeader={viewerIsLeader} printed={printed} reminderWaiting={reminders?.waiting} />
      {/* The step brief (v2.6574; every rail since v2.6577): what the step is, why a row is here, the usual move, the other moves, what closes it — and the REMINDERS rail's notices with no row here. */}
      {on ? (
        <LienStepBrief on={on} brief={lienStepBrief(on)} count={(groups[0]?.rows.length ?? 0) + reminderRows.length} marks={on.ladder === 'reminder' ? [...(groups[0]?.rows ?? []).map((r) => r.reminder?.day ?? null), ...reminderRows.map((r) => r.day)] : []} timeline={timeline} whyChips={whyChips} isMobile={isMobile} onClear={() => setOn(null)}>
          {reminderStep ? (
        <div data-testid="lien-reminder-step-list" data-step={reminderStep} style={{ borderTop: '1px solid var(--border)', paddingTop: 8, fontSize: '0.8125rem' }}>
          <div style={{ fontSize: '0.66rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-violet-700)', fontWeight: 700, marginBottom: 2 }}>
            Also on this step, with no row on the list · {reminderRows.length}{reminderOnList ? ` · ${reminderOnList} on the list below` : ''}
          </div>
          {reminderRows.length === 0 ? (
            // A sub-list inside the window: `main` alone, its next step the rung above it (`check:empty-words`).
            <EmptyState compact main={reminderOnList ? 'Every notice on this step is on the list below.' : 'Nothing waiting on this step.'} />
          ) : (
            reminderRows.map((r) => (
              <div key={r.jobId} data-lien-reminder-row={r.jobId} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.2fr) minmax(0, 1.6fr) auto', gap: isMobile ? 2 : 12, alignItems: 'center', padding: '3px 0' }}>
                {title(reminderStub(r), { fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', minWidth: 0 })}
                <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.words}>{r.words}</span>
                <button type="button" onClick={() => (onOpenReminder ? onOpenReminder(r) : onAct(reminderStub(r)))} style={{ ...openBtn, ...(isMobile ? { width: '100%', padding: '9px 12px', fontSize: '0.9rem' } : { padding: '2px 10px', fontSize: '0.78rem' }) }} data-lien-reminder-open={r.jobId}>
                  Open
                </button>
              </div>
            ))
          )}
        </div>
          ) : null}
        </LienStepBrief>
      ) : null}
      {groups.map((g) => (
        <section key={g.group} aria-label={g.label} data-lien-next-up-group={g.group} style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 0.4rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: g.group === 'now' ? 'var(--text-red-600)' : g.group === 'reminders' || (g.group === 'step_on' && on?.ladder === 'reminder') ? 'var(--text-violet-700)' : g.group === 'step_on' ? 'var(--text-700)' : g.group === 'mine' || g.group === 'sign' || g.group === 'pen' ? 'var(--text-link)' : 'var(--text-muted)' }}>
            {g.label} · {g.rows.length}
          </h3>
          <div style={{ display: 'grid', gap: isMobile ? 8 : 0, border: isMobile ? 'none' : '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
            {g.rows.map((r, i) => {
              const due = lienNextUpDueWords(r)
              return isMobile ? (
                <div key={r.key} data-lien-next-up-row={r.key} style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '0.6rem 0.7rem', display: 'grid', gap: 6, background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {chip(r)}
                    {due ? <span style={{ fontSize: '0.78rem', fontWeight: 600, color: dueColor(r) }}>{due}</span> : null}
                  </div>
                  <div>{title(r, { fontWeight: 700, fontSize: '0.92rem', overflowWrap: 'anywhere', whiteSpace: 'normal' })}</div>
                  {/* The four dots are four named tiles on a phone (v2.4881): no hover there, so the names are the card. */}
                  <LienStepRow at={lienStepOfRow(r)} ladder={lienStepOfRow(r)?.ladder ?? r.kind} viewerIsLeader={Boolean(viewerIsLeader)} onPress={(el) => { setOpenRow(r); card.show(el, lienStepCard(r, factsFor?.(r))) }} />
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{r.sub}</div>
                  {fold(r)}
                  {secondary(r)}
                  {button(r)}
                </div>
              ) : (
                <div
                  key={r.key}
                  data-lien-next-up-row={r.key}
                  onClick={() => onAct(r)}
                  style={{ display: 'grid', gridTemplateColumns: '84px minmax(0, 1.2fr) 86px minmax(0, 1.4fr) 170px auto', gap: '0.75rem', alignItems: 'center', padding: '0.5rem 0.8rem', borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}
                >
                  <span>{chip(r)}</span>
                  {r.jobs ? (
                    // A run row's question reads on its second line, so its title takes the question's column too (punch list #101).
                    <span style={{ gridColumn: '2 / 5', minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {title(r, { fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', minWidth: 0 })}
                      {mark(r)}
                    </span>
                  ) : (
                    <>
                      <span style={{ minWidth: 0, overflow: 'hidden' }}>{title(r, { fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' })}</span>
                      <span>{mark(r)}</span>
                      <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.sub}>{r.sub}</span>
                    </>
                  )}
                  <span style={{ fontWeight: 600, color: dueColor(r), whiteSpace: 'nowrap' }}>{due}</span>
                  <span style={{ justifySelf: 'end' }}>{button(r)}</span>
                  {fold(r)}
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
