import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase } from '../../lib/supabase'
import { buildAxisCards, GATE_B_PCT, GATE_B_STREAK, type RunScoreRow } from '../../lib/bids/confidenceBoard'
import type { RobotRowState } from '../../lib/bids/robotRowState'
import {
  axisByRobotBidNumber,
  buildJobTypeRows,
  buildLiveRuns,
  buildPracticeRuns,
  buildYourPart,
  receiptsByAxis,
  recentRuns,
  type JobSlot,
  type LiveRun,
  type PracticeRun,
  type ReceiptNoteRow,
  type YourPartBid,
  type YourPartDoor,
  type YourPartTone,
} from '../../lib/bids/robotScoreboard'
import { shadowCoverage, type ShadowCoverageBid } from '../../lib/bids/shadowCoverage'
import type { ShadowRunRow } from '../../lib/bids/shadowStory'

// twin_run_scores / bid_audit_notes predate the generated types (BidsAuditsTab pattern).
const boardDb = supabase as unknown as SupabaseClient

export type ScoreboardBid = ShadowCoverageBid & YourPartBid

type BidsRobotScoreboardTabProps = {
  /** Pending audit count from the page's audit gate. */
  auditPending?: number
  /** Open estimator-lane robot questions (plans asks excluded — those sit on the bid). */
  questionsWaiting?: number
  /** The page's human bids: coverage, "your part", and whose send a sealed run waits on. */
  bids?: readonly ScoreboardBid[]
  /** The robot shells on the page — to match audit receipts to a job type by bid number. */
  robotBids?: ReadonlyArray<{ id: string; bid_number: string | null }>
  viewerId?: string | null
  /** Devs also get the operator's raw notes behind a toggle. */
  isDev?: boolean
  /** The Bid Board icon's state for a human bid — one kernel, so the strip and the icon agree. */
  stateFor?: (bid: YourPartBid) => RobotRowState
  onOpenBid?: (bidId: string) => void
  onOpenBidNumber?: (bidNumber: string) => void
  onOpenAudits?: () => void
  onOpenBidBoard?: () => void
}

const PRACTICE_PREVIEW = 6

const toneColor: Record<YourPartTone, string> = {
  seal: '#7c3aed',
  good: '#16a34a',
  accent: '#3b82f6',
  amber: '#d97706',
  red: '#dc2626',
  muted: 'var(--border-strong)',
}

const chipTone = {
  ready: { color: 'var(--text-green-700)', bg: 'var(--bg-green-tint)' },
  progress: { color: 'var(--text-link)', bg: 'var(--bg-blue-tint)' },
  awaiting: { color: 'var(--text-muted)', bg: 'var(--bg-muted)' },
  blocked: { color: 'var(--text-amber-800)', bg: 'var(--bg-amber-tint)' },
} as const

function Slot({ slot }: { slot: JobSlot }) {
  const bg = slot.state === 'in' ? '#16a34a' : slot.state === 'out' ? '#dc2626' : 'var(--bg-muted)'
  return (
    <div
      title={slot.title}
      style={{
        flex: 1,
        height: 22,
        borderRadius: 5,
        background: bg,
        border: slot.state === 'pending' ? '1.5px dashed var(--border-strong)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.66rem',
        fontWeight: 700,
        color: slot.state === 'in' || slot.state === 'out' ? 'white' : 'var(--text-faint)',
        fontVariantNumeric: 'tabular-nums',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        padding: '0 3px',
      }}
    >
      {slot.label}
    </div>
  )
}

const linkBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: 'var(--text-link)',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '0.82rem',
  textDecoration: 'underline',
  whiteSpace: 'nowrap',
}
const btn: React.CSSProperties = {
  padding: '0.3rem 0.75rem',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  cursor: 'pointer',
  fontSize: '0.78rem',
  color: 'var(--text-strong)',
  whiteSpace: 'nowrap',
}
const primaryBtn: React.CSSProperties = { ...btn, background: '#3b82f6', borderColor: '#3b82f6', color: 'white', fontWeight: 600 }
const sectionHead: React.CSSProperties = {
  fontSize: '0.72rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  fontWeight: 700,
  margin: '1.1rem 0 0.45rem',
  display: 'flex',
  alignItems: 'baseline',
  gap: '0.6rem',
  flexWrap: 'wrap',
}
const subHead: React.CSSProperties = { textTransform: 'none', letterSpacing: 0, fontWeight: 400, fontSize: '0.78rem' }
const rowCard: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.5rem 0.8rem',
  fontSize: '0.85rem',
}

/**
 * The Robots → Scoreboard lens (v2.2560 dev-only; opened to every audit role
 * and rewritten in plain words in v2.3221). Reads twin_run_scores and
 * list_shadow_runs() — the same gate math as before, phrased by
 * robotScoreboard.ts: the rule up top with the last five scored runs, a
 * "Your part" strip of sentences with doors, job types ranked closest to
 * ready with one lesson line each, then runs on live bids (the sealed
 * envelope, expandable) and practice on past bids folded under. The
 * operator's raw notes stay for devs behind a toggle.
 */
export function BidsRobotScoreboardTab({
  auditPending,
  questionsWaiting,
  bids,
  robotBids,
  viewerId,
  isDev,
  stateFor,
  onOpenBid,
  onOpenBidNumber,
  onOpenAudits,
  onOpenBidBoard,
}: BidsRobotScoreboardTabProps) {
  const [scores, setScores] = useState<RunScoreRow[] | null>(null)
  const [shadows, setShadows] = useState<ShadowRunRow[] | null>(null)
  // Calibration standards (v2.3099): users.calibration_standard ids. undefined
  // = not loaded / column absent → backtests gate on gate_eligible alone.
  const [standardIds, setStandardIds] = useState<ReadonlySet<string> | undefined>(undefined)
  const [receipts, setReceipts] = useState<ReceiptNoteRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [showAllPractice, setShowAllPractice] = useState(false)
  const [showRobotNotes, setShowRobotNotes] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [scoreRes, shadowRes, standardRes] = await Promise.all([
        boardDb.from('twin_run_scores').select('*').order('scored_at', { ascending: false }),
        boardDb.rpc('list_shadow_runs'),
        boardDb.from('users').select('id').eq('calibration_standard', true),
      ])
      if (cancelled) return
      if (scoreRes.error) setLoadError(scoreRes.error.message)
      else setScores((scoreRes.data ?? []) as RunScoreRow[])
      if (shadowRes.error) setLoadError((prev) => prev ?? shadowRes.error.message)
      else setShadows((shadowRes.data ?? []) as ShadowRunRow[])
      if (!standardRes.error) setStandardIds(new Set(((standardRes.data ?? []) as Array<{ id: string }>).map((u) => u.id)))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // The lesson line: the robot's newest digest receipt per job type, credited
  // to whoever finished that audit. Three small reads, each fail-soft — a
  // missing receipt just leaves the axis with its waiting-on sentence.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data: notes } = await boardDb
          .from('bid_audit_notes')
          .select('bid_id, audit_id, body, created_at')
          .eq('kind', 'receipt')
          .order('created_at', { ascending: false })
          .limit(300)
        if (cancelled || !notes || notes.length === 0) return
        const rows = notes as Array<{ bid_id: string; audit_id: string; body: string; created_at: string | null }>
        const auditIds = [...new Set(rows.map((r) => r.audit_id))]
        const { data: audits } = await boardDb.from('bid_audits').select('id, completed_by').in('id', auditIds)
        if (cancelled) return
        const completedBy = new Map(((audits ?? []) as Array<{ id: string; completed_by: string | null }>).map((a) => [a.id, a.completed_by]))
        const userIds = [...new Set([...completedBy.values()].filter((x): x is string => !!x))]
        const names = new Map<string, string>()
        if (userIds.length > 0) {
          const { data: users } = await boardDb.from('users').select('id, name').in('id', userIds)
          for (const u of (users ?? []) as Array<{ id: string; name: string | null }>) if (u.name) names.set(u.id, u.name)
        }
        if (cancelled) return
        setReceipts(
          rows.map((r) => {
            const by = completedBy.get(r.audit_id) ?? null
            return { bid_id: r.bid_id, body: r.body, created_at: r.created_at, auditor: by ? (names.get(by) ?? null) : null }
          }),
        )
      } catch {
        // RLS-closed or table missing: the lesson lines fall back to the waiting-on sentence.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const cards = useMemo(() => buildAxisCards(scores ?? [], shadows ?? [], { standardTeacherIds: standardIds }), [scores, shadows, standardIds])
  const receiptMap = useMemo(() => {
    const byNumber = new Map<string, string | null>((robotBids ?? []).map((b) => [b.id, b.bid_number]))
    return receiptsByAxis(receipts, byNumber, axisByRobotBidNumber(scores ?? [], shadows ?? []))
  }, [receipts, robotBids, scores, shadows])
  const jobTypes = useMemo(() => buildJobTypeRows(cards, shadows ?? [], receiptMap), [cards, shadows, receiptMap])
  const recent = useMemo(() => recentRuns(scores ?? [], shadows ?? [], standardIds), [scores, shadows, standardIds])
  const liveRuns = useMemo(() => buildLiveRuns(shadows ?? [], bids ?? [], viewerId ?? null), [shadows, bids, viewerId])
  const practice = useMemo(() => buildPracticeRuns(scores ?? [], standardIds), [scores, standardIds])
  const coverage = useMemo(
    () => (bids ? shadowCoverage(bids, (shadows ?? []).map((r) => r.reference_bid_number)) : null),
    [bids, shadows],
  )
  const yourPart = useMemo(
    () =>
      bids && stateFor
        ? buildYourPart({
            viewerId: viewerId ?? null,
            bids,
            stateFor,
            auditsPending: auditPending ?? 0,
            questionsWaiting: questionsWaiting ?? 0,
            coverage: coverage ? { covered: coverage.covered, live: coverage.live } : null,
          })
        : [],
    [bids, stateFor, viewerId, auditPending, questionsWaiting, coverage],
  )
  const ready = jobTypes.filter((j) => j.tone === 'ready').length
  const started = jobTypes.filter((j) => j.tone === 'progress' && j.streak > 0).length
  const withinRecent = recent.filter((r) => r.within).length

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const openDoor = (door: YourPartDoor) => {
    if (door.kind === 'audits') onOpenAudits?.()
    else if (door.kind === 'bid-board') onOpenBidBoard?.()
    else if (door.bidId) onOpenBid?.(door.bidId)
  }

  if (loadError) {
    return <div style={{ color: 'var(--text-red-700)', padding: '1rem 0' }}>Scoreboard failed to load: {loadError}</div>
  }
  if (scores === null || shadows === null) {
    return <div style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>Loading scoreboard…</div>
  }

  const headline =
    jobTypes.length === 0
      ? 'No scored runs yet.'
      : ready > 0
        ? `${ready} of ${jobTypes.length} job types ${ready === 1 ? 'is' : 'are'} there.`
        : started > 0
          ? `None are there yet; ${started === 1 ? 'one is' : `${started} are`} ${started === 1 ? 'a run in' : 'on their way'}.`
          : 'None are there yet.'

  return (
    <div>
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: 'var(--text-700)' }}>
        <b style={{ color: 'var(--text-strong)' }}>How close are the robots?</b> A job type is ready for robot first drafts when the robot lands
        within {GATE_B_PCT}% of our number {GATE_B_STREAK} times in a row. {headline}
      </p>
      {recent.length > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
          Last {recent.length === 1 ? 'scored run' : `${recent.length} scored runs`}, newest first:
          {recent.map((r, i) => (
            <span
              key={`${r.label}-${i}`}
              title={r.label}
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontWeight: 600,
                padding: '1px 7px',
                borderRadius: 5,
                background: r.within ? 'var(--bg-green-tint)' : 'var(--bg-red-tint)',
                color: r.within ? 'var(--text-green-700)' : 'var(--text-red-700)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {r.delta > 0 ? '+' : '−'}
              {Math.abs(r.delta).toFixed(1)}%
            </span>
          ))}
          <span>
            · {withinRecent} of {recent.length} within {GATE_B_PCT}%
          </span>
        </div>
      ) : null}

      {yourPart.length > 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 1rem', marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.45rem', fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
            Your part
          </h4>
          {yourPart.map((line, i) => (
            <div
              key={line.key}
              style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', padding: '0.3rem 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)', flexWrap: 'wrap' }}
            >
              <span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, flexShrink: 0, position: 'relative', top: 1, background: toneColor[line.tone] }} />
              <div style={{ flex: 1, minWidth: 260, fontSize: '0.875rem', color: line.tone === 'muted' ? 'var(--text-muted)' : 'var(--text-strong)' }}>
                <b style={{ fontWeight: 600 }}>{line.text}</b>
                {line.detail ? <span style={{ color: 'var(--text-700)' }}> {line.detail}</span> : null}
              </div>
              {line.doors.map((door) => (
                <button key={door.label} type="button" onClick={() => openDoor(door)} style={door.primary ? primaryBtn : linkBtn}>
                  {door.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      <div style={sectionHead}>
        Job types
        <span style={subHead}>closest to ready first · last five scored runs, oldest on the left</span>
        {isDev ? (
          <button type="button" onClick={() => setShowRobotNotes((v) => !v)} style={{ ...linkBtn, fontSize: '0.75rem', marginLeft: 'auto' }}>
            {showRobotNotes ? 'Hide robot notes' : 'Show robot notes'}
          </button>
        ) : null}
      </div>
      {jobTypes.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No runs recorded yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {jobTypes.map((j) => {
            const tone = chipTone[j.tone]
            return (
              <div
                key={j.axis}
                className="robot-scoreboard-job"
                style={{ ...rowCard, borderRadius: 9, padding: '0.6rem 0.85rem', display: 'grid', gridTemplateColumns: 'minmax(150px, 200px) 1fr', gap: '0.9rem', alignItems: 'start', opacity: j.tone === 'blocked' ? 0.78 : 1 }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-strong)' }}>{j.label}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {j.scoredCount === 0 ? 'no scored run' : `${j.scoredCount} scored run${j.scoredCount === 1 ? '' : 's'}`}
                    {j.inFlight > 0 ? ` · ${j.inFlight} sealed` : ''}
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.15rem' }}>
                    <span style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.04em', borderRadius: 999, padding: '1px 9px', color: tone.color, background: tone.bg, whiteSpace: 'nowrap' }}>
                      {j.statusText}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 5, margin: '0.1rem 0 0.35rem', maxWidth: 380 }}>
                    {j.slots.map((slot, i) => (
                      <Slot key={i} slot={slot} />
                    ))}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-700)', maxWidth: '66ch' }}>{j.lesson}</div>
                  {isDev && showRobotNotes ? (
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border)', marginTop: '0.4rem', paddingTop: '0.3rem' }}>
                      <span style={{ fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.62rem' }}>robot notes</span> {j.rawNote}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={sectionHead}>
        On live bids
        <span style={subHead}>the robot sealed a number before ours existed</span>
      </div>
      {liveRuns.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No shadow runs yet — the robots pick up live plumbing bids with readable plans on the weekday batch; a bid’s robot icon on the Bid Board says where it stands.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {liveRuns.map((r) => (
            <LiveRunRow key={r.key} run={r} open={expanded.has(r.key)} onToggle={() => toggle(r.key)} onOpenBidNumber={onOpenBidNumber} />
          ))}
        </div>
      )}

      {practice.length > 0 ? (
        <>
          <div style={sectionHead}>
            Practice on past bids
            <span style={subHead}>
              the robot re-bid a decided job blind, then we opened the envelope · {practice.length} run{practice.length === 1 ? '' : 's'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {(showAllPractice ? practice : practice.slice(0, PRACTICE_PREVIEW)).map((r) => (
              <PracticeRunRow key={r.key} run={r} open={expanded.has(r.key)} onToggle={() => toggle(r.key)} onOpenBidNumber={onOpenBidNumber} />
            ))}
            {!showAllPractice && practice.length > PRACTICE_PREVIEW ? (
              <div style={{ padding: '0.3rem 0' }}>
                <button type="button" onClick={() => setShowAllPractice(true)} style={linkBtn}>
                  Show all {practice.length} practice runs
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.9rem', maxWidth: '80ch' }}>
        Runs count toward a job type’s {GATE_B_STREAK}-in-a-row only when the robot was scored against a calibration standard’s number — the estimator the
        robots are tuned to. Runs against other estimators’ numbers are shown for comparison. Voided runs stay listed with the reason, so the record is honest.
      </p>
    </div>
  )
}

function deltaStyle(phase: 'in' | 'out' | 'seal' | 'void'): React.CSSProperties {
  const color =
    phase === 'seal' ? '#7c3aed' : phase === 'void' ? 'var(--text-faint)' : phase === 'in' ? 'var(--text-green-700)' : 'var(--text-red-700)'
  return { fontVariantNumeric: 'tabular-nums', fontWeight: phase === 'seal' ? 600 : 700, whiteSpace: 'nowrap', color }
}

function BidNumberButton({ number, prefix, onOpenBidNumber }: { number: string | null; prefix?: string; onOpenBidNumber?: (n: string) => void }) {
  if (!number) return <span style={{ color: 'var(--text-faint)' }}>—</span>
  const label = `${prefix ?? ''}b${number}`
  return onOpenBidNumber ? (
    <button type="button" onClick={() => onOpenBidNumber(number)} style={{ ...linkBtn, fontWeight: 700, textDecoration: 'none' }}>
      {label}
    </button>
  ) : (
    <span style={{ color: 'var(--text-link)', fontWeight: 700 }}>{label}</span>
  )
}

function LiveRunRow({ run, open, onToggle, onOpenBidNumber }: { run: LiveRun; open: boolean; onToggle: () => void; onOpenBidNumber?: (n: string) => void }) {
  const tone = run.phase === 'scored' ? (run.deltaPct != null && Math.abs(run.deltaPct) <= GATE_B_PCT ? 'in' : 'out') : run.phase === 'void' ? 'void' : 'seal'
  return (
    <div style={{ ...rowCard, opacity: run.phase === 'void' ? 0.6 : 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: '0.8rem', alignItems: 'baseline' }}>
        <div>
          <BidNumberButton number={run.shadowNumber} onOpenBidNumber={onOpenBidNumber} />
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            shadow of <BidNumberButton number={run.refNumber} onOpenBidNumber={onOpenBidNumber} />
          </div>
        </div>
        <div>
          <button type="button" onClick={onToggle} aria-expanded={open} style={{ ...linkBtn, color: 'var(--text-strong)', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'normal', textAlign: 'left' }}>
            {run.project}
          </button>
          <span style={{ color: 'var(--text-muted)' }}>
            {run.jobType ? ` · ${run.jobType}` : ''} · {run.line}
          </span>
          {run.counts ? (
            <span title="Counts toward this job type’s five in a row" style={{ marginLeft: 6, color: 'var(--text-green-700)', fontWeight: 700 }}>
              ✓
            </span>
          ) : null}
        </div>
        <div style={deltaStyle(tone)}>{run.deltaText}</div>
      </div>
      {open ? (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.5rem', padding: '0.5rem 0 0.15rem', fontSize: '0.74rem', color: 'var(--text-700)' }}>
          {run.steps.map((step, i) => {
            const seal = !!step.seal
            const bg = seal ? '#7c3aed' : step.state === 'done' ? '#16a34a' : step.state === 'now' ? 'var(--bg-amber-100)' : 'var(--bg-subtle)'
            const border = seal ? '#7c3aed' : step.state === 'done' ? '#16a34a' : step.state === 'now' ? '#eab308' : 'var(--border-strong)'
            const color = seal || step.state === 'done' ? 'white' : step.state === 'now' ? 'var(--text-amber-800)' : 'var(--text-faint)'
            return (
              <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <span aria-hidden style={{ width: 22, height: 22, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, border: `2px solid ${border}`, background: bg, color }}>
                  {seal ? '🔒' : step.state === 'done' ? '✓' : step.state === 'now' ? '⏳' : i + 1}
                </span>
                <span style={{ margin: '0 8px 0 5px', maxWidth: 130, lineHeight: 1.25, color: step.state === 'todo' ? 'var(--text-faint)' : undefined }}>{step.label}</span>
                {i < run.steps.length - 1 ? <span aria-hidden style={{ width: 24, height: 2, background: step.state === 'done' ? '#16a34a' : 'var(--border)', marginRight: 8, flexShrink: 0 }} /> : null}
              </span>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function PracticeRunRow({ run, open, onToggle, onOpenBidNumber }: { run: PracticeRun; open: boolean; onToggle: () => void; onOpenBidNumber?: (n: string) => void }) {
  const tone = run.voided ? 'void' : run.deltaPct != null && Math.abs(run.deltaPct) <= GATE_B_PCT ? 'in' : 'out'
  return (
    <div style={{ ...rowCard, opacity: run.voided ? 0.6 : 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: '0.8rem', alignItems: 'baseline' }}>
        <div>
          <span style={{ color: 'var(--text-link)', fontWeight: 700 }}>{run.label}</span>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            vs <BidNumberButton number={run.refNumber} onOpenBidNumber={onOpenBidNumber} />
          </div>
        </div>
        <div>
          <button type="button" onClick={onToggle} aria-expanded={open} style={{ ...linkBtn, color: 'var(--text-strong)', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'normal', textAlign: 'left' }}>
            {run.project}
          </button>
          <span style={{ color: 'var(--text-muted)' }}>
            {run.jobType ? ` · ${run.jobType}` : ''}
            {run.voided ? ' · didn’t count' : run.robot && run.ours ? ` · robot ${run.robot}, ours ${run.ours}` : ''}
          </span>
          {run.counts ? (
            <span title="Counts toward this job type’s five in a row" style={{ marginLeft: 6, color: 'var(--text-green-700)', fontWeight: 700 }}>
              ✓
            </span>
          ) : null}
        </div>
        <div style={deltaStyle(tone)}>{run.deltaText}</div>
      </div>
      {open && run.note ? (
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', padding: '0.4rem 0 0.1rem', maxWidth: '90ch' }}>
          {run.voided ? 'Why it didn’t count: ' : 'The robot’s counts check: '}
          {run.note}
        </div>
      ) : open ? (
        <div style={{ fontSize: '0.76rem', color: 'var(--text-faint)', padding: '0.4rem 0 0.1rem' }}>No notes on this run.</div>
      ) : null}
    </div>
  )
}

