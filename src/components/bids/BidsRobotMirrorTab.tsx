import { useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import {
  buildRobotMirror,
  mirrorAuditChip,
  mirrorRunReviewable,
  mirrorStatusLabel,
  MIRROR_SECTION_LABELS,
  MIRROR_SECTION_ORDER,
  type MirrorAudit,
  type MirrorBestEffort,
  type MirrorDraftTotal,
  type MirrorSection,
  type RobotMirrorRow,
  type RobotMirrorRun,
} from '../../lib/bids/robotMirror'
import { buildAxisCards, normalizeBidNumber, type RunScoreRow } from '../../lib/bids/confidenceBoard'
import { computeAuditDraftTotal } from '../../lib/bids/bidAudits'
import { fetchAllRowsChunkedIn } from '../../lib/supabasePaging'
import type { ShadowRunRow } from '../../lib/bids/shadowStory'
import { bestEffortStamp } from '../../lib/bids/bestEffort'
import type { RobotRowState } from '../../lib/bids/robotRowState'
import { diffTakeoffs, diffWaterfall, type DiffWaterfall } from '../../lib/bids/takeoffDiff'
import { loadPricedTakeoffRows } from '../../lib/bids/loadPricedTakeoffRows'
import { ROBOT_ICON_PATH, ROBOT_STATE_COLOR } from './RobotGlyph'

// twin_run_scores / bid_audits predate the generated types (BidsAuditsTab pattern).
const db = supabase as unknown as SupabaseClient

type MirrorAuditRow = MirrorAudit & { self_assessment?: string | null }

type BidsRobotMirrorTabProps = {
  /** The human board's bids (the People scope) — every row here is one of ours. */
  bids: BidWithBuilder[]
  /** The robots' ZZ shells (the Robots scope) — read for pairing and doors, never listed. */
  robotBids: BidWithBuilder[]
  /** The page's audit gate — the workable pending count for the strip. */
  auditPending: number
  loading: boolean
  /** A row to ring (deep links from the status sheet / comparison modal). Matches the human bid OR its shell. */
  highlightBidId: string | null
  /**
   * The Bid Board icon's state for a human bid (v2.3225). With it, every live bid with no
   * run lists too — queued, needs a person, or off — so the mirror is the human board row for row.
   */
  rowStateFor?: (bid: BidWithBuilder) => RobotRowState
  onEditBid: (bid: BidWithBuilder) => void
  /** Robot vs ours counts + pricing — the comparison modal (scored rows only). */
  onCompare: (source: BidWithBuilder, twin: BidWithBuilder) => void
  /** Open the robot's shell on the Counts tab (its rows live there). */
  onOpenShell: (twin: BidWithBuilder) => void
  /** Land on that audit's card in the Audits lens. */
  onOpenAudit: (auditId: string) => void
  /** A scored or audited run whose audit still waits (sent bids only): open the envelope now. */
  onReviewNow: (source: BidWithBuilder, run: RobotMirrorRun) => void
  /** A 'needs' row's door: the bid's robot needs sheet (gaps with fixes, Copy intake address, answers). */
  onOpenNeeds?: (bid: BidWithBuilder) => void
  /** A queued / working / sealed row's door: the robot status sheet (timeline, Front of the line). */
  onOpenStatus?: (bid: BidWithBuilder) => void
  /** A sealed run on a bid sent without a value: Edit Bid with the value field focused, so it can score. */
  onAddBidValue?: (bid: BidWithBuilder) => void
  /** The "kinds of job earned first drafts" pill's door, when the viewer has the Scoreboard lens. */
  onOpenScoreboard?: () => void
  /** Reports the listed-row count for the lens label. */
  onRowCount?: (n: number) => void
}

const money = (v: number | null) => (v == null ? '—' : `$${Math.round(v).toLocaleString()}`)
const fmtDelta = (d: number) => `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}%`
const signed = (n: number) => `${n < 0 ? '−' : '+'}$${Math.round(Math.abs(n)).toLocaleString()}`

function RunGlyph({ run }: { run: RobotMirrorRun }) {
  const outline = run.status === 'queued'
  const muted = run.status === 'void' || run.status === 'off'
  const color =
    run.status === 'scored' ? ROBOT_STATE_COLOR.scored
      : run.status === 'needs' ? ROBOT_STATE_COLOR.need
        : muted ? 'var(--text-faint)'
          : ROBOT_STATE_COLOR.robot
  const badge =
    run.status === 'sealed' ? '🔒'
      : run.status === 'scored' ? '✓'
        : run.status === 'audited' ? '$'
          : run.status === 'void' ? '✕'
            : run.status === 'needs' ? ((run.need?.questions ?? 0) > 0 ? String(Math.min(run.need?.questions ?? 0, 9)) : '?')
              : null
  return (
    <span aria-hidden style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', color, lineHeight: 0, opacity: muted ? 0.6 : 1 }}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill={outline ? 'none' : 'currentColor'} stroke={outline ? 'currentColor' : 'none'} strokeWidth={outline ? 34 : 0}>
        <path d={ROBOT_ICON_PATH} />
      </svg>
      {run.status === 'working' ? <span className="robot-glyph-pulse" style={{ position: 'absolute', right: -2, top: 0, width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: '0 0 0 2px var(--surface)' }} /> : null}
      {badge ? (
        <span style={{ position: 'absolute', right: -3, bottom: -3, fontSize: badge === '🔒' ? '0.5rem' : '0.5625rem', fontWeight: 800, lineHeight: 1, padding: '1px 3px', borderRadius: 3, color: 'white', background: muted ? 'var(--text-faint)' : color, fontFamily: 'ui-monospace, monospace', boxShadow: '0 0 0 1.5px var(--surface)' }}>
          {badge}
        </span>
      ) : null}
    </span>
  )
}

const CHIP_TONES: Record<NonNullable<ReturnType<typeof mirrorAuditChip>>['tone'], { bg: string; fg: string }> = {
  audit: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' },
  done: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)' },
  practice: { bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
  void: { bg: 'var(--bg-red-100)', fg: 'var(--text-red-600)' },
  seal: { bg: 'var(--bg-violet-100, var(--bg-muted))', fg: 'var(--text-violet-700, var(--text-700))' },
}

const th: React.CSSProperties = { textAlign: 'left', fontSize: '0.66rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.35rem 0.6rem', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.84rem', fontVariantNumeric: 'tabular-nums' }
const mono: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.78rem', textDecoration: 'underline' }

/** The door word for a 'needs' row — what the person actually does next. */
function needsDoorLabel(run: RobotMirrorRun): string {
  const gap = run.need?.gap ?? null
  if (!gap) return 'Answer'
  if (gap.key === 'plans') return 'Paste the plans'
  if (gap.key === 'plans-unreadable') return gap.copyIntake ? 'Share the plans' : 'Fix the plans link'
  return 'Fix it'
}

type RowDetail = { loading: boolean; waterfall: DiffWaterfall | null; why: string | null; error: string | null }

/**
 * The Robot Board as a mirror (v2.3222): our bids, in the human board's sections,
 * with a robot column — status before we send, the robot's number and the delta
 * after. The shells never list; every robot number here comes from a SCORED run
 * (list_shadow_runs NULLs the money until then), so this lens cannot anchor a
 * number that is still being written.
 *
 * v2.3225: the live bids with no run list too (queued · needs a person · off),
 * each with the door that moves it; a sealed run on a bid sent without a value
 * gets an "Add bid value" door; a scored row expands into where the delta lives
 * and the robot's own note; the strip speaks in plain words.
 */
export function BidsRobotMirrorTab({ bids, robotBids, auditPending, loading, highlightBidId, rowStateFor, onEditBid, onCompare, onOpenShell, onOpenAudit, onReviewNow, onOpenNeeds, onOpenStatus, onAddBidValue, onOpenScoreboard, onRowCount }: BidsRobotMirrorTabProps) {
  const [shadowRuns, setShadowRuns] = useState<ShadowRunRow[] | null>(null)
  const [scores, setScores] = useState<RunScoreRow[] | null>(null)
  const [audits, setAudits] = useState<MirrorAuditRow[]>([])
  const [standardIds, setStandardIds] = useState<ReadonlySet<string> | undefined>(undefined)
  // Audited-but-unscored shells (the first backtest slate predates score_backtest): price the
  // draft the way the Audits lens does, once per shell, so the row carries a number instead of
  // "working". Only shells whose human bid is sent ever get read (seal).
  const [draftTotals, setDraftTotals] = useState<Map<string, MirrorDraftTotal>>(() => new Map())
  const draftRequestedRef = useRef<Set<string>>(new Set())
  const [open, setOpen] = useState<Record<MirrorSection, boolean>>({ unsent: true, pending: true, won: true, startedOrComplete: true, lost: false })
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  // Where the delta lives (v2.3225): priced rows on both sides, diffed once per expanded scored row.
  const [details, setDetails] = useState<Record<string, RowDetail>>({})
  // v2.3234: bid id → recorded best effort.
  const [bestEfforts, setBestEfforts] = useState<Map<string, MirrorBestEffort>>(() => new Map())

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [runRes, scoreRes, auditRes, stdRes, beRes] = await Promise.all([
        db.rpc('list_shadow_runs'),
        db.from('twin_run_scores').select('*').order('scored_at', { ascending: false }),
        db.from('bid_audits').select('id, bid_id, status, requested_at, self_assessment').order('requested_at', { ascending: false }).limit(300),
        db.from('users').select('id').eq('calibration_standard', true),
        // v2.3234: recorded best efforts (staff-readable, never by twins); a missing table reads as none.
        db.from('bid_best_efforts').select('bid_id, value, recorded_at, recorded_by').limit(1000),
      ])
      if (cancelled) return
      setBestEfforts(new Map(((beRes.data ?? []) as Array<MirrorBestEffort & { bid_id: string }>).map((r) => [r.bid_id, { value: r.value, recorded_at: r.recorded_at, recorded_by: r.recorded_by }])))
      // Missing tables / RLS-closed reads (a client ahead of a migration) read as "no runs", never a broken lens.
      setShadowRuns((runRes.data ?? []) as ShadowRunRow[])
      setScores((scoreRes.data ?? []) as RunScoreRow[])
      setAudits((auditRes.data ?? []) as MirrorAuditRow[])
      if (!stdRes.error) setStandardIds(new Set(((stdRes.data ?? []) as Array<{ id: string }>).map((u) => u.id)))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (shadowRuns === null || scores === null) return
    const covered = new Set<string>()
    for (const r of shadowRuns) { const n = normalizeBidNumber(r.shadow_bid_number); if (n) covered.add(n) }
    for (const s of scores) { const n = normalizeBidNumber(s.twin_bid_number); if (n) covered.add(n) }
    const audited = new Set(audits.map((a) => a.bid_id))
    const sentHumanIds = new Set(bids.filter((b) => !!b.bid_date_sent).map((b) => b.id))
    const targets = robotBids.filter((b) => {
      const n = normalizeBidNumber(b.bid_number)
      return audited.has(b.id) && !(n && covered.has(n)) && !!b.twin_source_bid_id && sentHumanIds.has(b.twin_source_bid_id) && !draftRequestedRef.current.has(b.id)
    })
    if (!targets.length) return
    for (const t of targets) draftRequestedRef.current.add(t.id)
    let cancelled = false
    void (async () => {
      try {
        const ids = targets.map((t) => t.id)
        const [rows, assigns] = await Promise.all([
          fetchAllRowsChunkedIn<{ id: string; count: number; bid_version_id: string | null; bid_id: string }, string>(
            ids,
            (chunk, from, to) => db.from('bids_count_rows').select('id, count, bid_version_id, bid_id').in('bid_id', chunk).order('id').range(from, to),
            'load mirror draft rows',
          ),
          fetchAllRowsChunkedIn<{ bid_id: string; count_row_id: string; price_book_entry_id: string | null; unit_price_override: number | null }, string>(
            ids,
            (chunk, from, to) => db.from('bid_pricing_assignments').select('bid_id, count_row_id, price_book_entry_id, unit_price_override').in('bid_id', chunk).order('count_row_id').range(from, to),
            'load mirror draft pricing',
          ),
        ])
        const entryIds = [...new Set((assigns ?? []).map((a) => a.price_book_entry_id).filter((x): x is string => !!x))]
        const entries = entryIds.length ? (((await db.from('price_book_entries').select('id, total_price').in('id', entryIds)).data ?? []) as Array<{ id: string; total_price: number | null }>) : []
        const priceById = Object.fromEntries(entries.map((e) => [e.id, e.total_price ?? 0]))
        if (cancelled) return
        setDraftTotals((prev) => {
          const next = new Map(prev)
          for (const t of targets) {
            next.set(t.id, computeAuditDraftTotal((rows ?? []).filter((r) => r.bid_id === t.id), t.selected_bid_version_id ?? null, (assigns ?? []).filter((a) => a.bid_id === t.id), priceById))
          }
          return next
        })
      } catch {
        /* a draft total is optional context — the row keeps reading "working" */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bids, robotBids, audits, shadowRuns, scores])

  const mirror = useMemo(
    () =>
      buildRobotMirror({
        humanBids: bids,
        shells: robotBids.map((b) => ({ id: b.id, bid_number: b.bid_number, project_name: b.project_name, twin_source_bid_id: b.twin_source_bid_id ?? null })),
        shadowRuns: shadowRuns ?? [],
        scores: scores ?? [],
        audits,
        standardTeacherIds: standardIds,
        draftTotals,
        rowStateFor,
        bestEfforts,
      }),
    [bids, robotBids, shadowRuns, scores, audits, standardIds, draftTotals, rowStateFor, bestEfforts],
  )
  useEffect(() => {
    onRowCount?.(mirror.listedCount)
  }, [mirror.listedCount, onRowCount])

  const gate = useMemo(() => {
    const cards = buildAxisCards(scores ?? [], shadowRuns ?? [], { standardTeacherIds: standardIds })
    return { met: cards.filter((c) => c.chip.tone === 'met').length, total: cards.length }
  }, [scores, shadowRuns, standardIds])
  const oldestAuditDays = useMemo(() => {
    const pending = audits.filter((a) => a.status === 'pending').map((a) => Date.parse(a.requested_at)).filter(Number.isFinite)
    if (!pending.length) return null
    return Math.max(0, Math.floor((Date.now() - Math.min(...pending)) / 86400000))
  }, [audits])
  const auditNoteById = useMemo(() => new Map(audits.map((a) => [a.id, a.self_assessment ?? null])), [audits])

  const shellById = useMemo(() => new Map(robotBids.map((b) => [b.id, b])), [robotBids])
  // A deep link names the human bid or its shell — ring the human row either way.
  const ringedHumanId = useMemo(() => {
    if (!highlightBidId) return null
    if (bids.some((b) => b.id === highlightBidId)) return highlightBidId
    return shellById.get(highlightBidId)?.twin_source_bid_id ?? null
  }, [highlightBidId, bids, shellById])
  useEffect(() => {
    if (!ringedHumanId) return
    for (const key of MIRROR_SECTION_ORDER) {
      if (mirror.sections[key].some((r) => r.bid.id === ringedHumanId)) setOpen((p) => (p[key] ? p : { ...p, [key]: true }))
    }
    const el = document.getElementById(`robot-mirror-row-${ringedHumanId}`)
    el?.scrollIntoView({ block: 'center' })
  }, [ringedHumanId, mirror])

  const ready = shadowRuns !== null && scores !== null && !loading

  /** A scored / audited lead run with a shell and both numbers: the row can say where the delta lives. */
  const hasDeltaStory = (row: RobotMirrorRow<BidWithBuilder>) =>
    (row.latest.status === 'scored' || row.latest.status === 'audited') && !!row.latest.shellBidId && row.latest.robotTotal != null && row.latest.ourValue != null && !!row.bid.bid_date_sent

  const toggleRow = (row: RobotMirrorRow<BidWithBuilder>) => {
    const id = row.bid.id
    const opening = !expanded.has(id)
    setExpanded((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
    if (!opening || !hasDeltaStory(row) || details[id]) return
    const run = row.latest
    const shell = run.shellBidId ? shellById.get(run.shellBidId) : undefined
    if (!shell) return
    setDetails((p) => ({ ...p, [id]: { loading: true, waterfall: null, why: null, error: null } }))
    void (async () => {
      try {
        const [robotRows, ourRows] = await Promise.all([
          loadPricedTakeoffRows(shell.id, shell.selected_bid_version_id ?? null),
          loadPricedTakeoffRows(row.bid.id, row.bid.selected_bid_version_id ?? null),
        ])
        if (!robotRows.length || !ourRows.length) {
          const why = !robotRows.length
            ? "The robot's takeoff rows aren't in PipeTooling yet — only the sealed number can be compared."
            : 'Our bid has no priced count rows to diff against — the number comparison is what there is.'
          setDetails((p) => ({ ...p, [id]: { loading: false, waterfall: null, why, error: null } }))
          return
        }
        const diff = diffTakeoffs(robotRows, ourRows)
        setDetails((p) => ({ ...p, [id]: { loading: false, waterfall: diffWaterfall(diff, run.robotTotal as number, run.ourValue as number), why: null, error: null } }))
      } catch (e) {
        setDetails((p) => ({ ...p, [id]: { loading: false, waterfall: null, why: null, error: e instanceof Error ? e.message : String(e) } }))
      }
    })()
  }

  const renderRun = (row: RobotMirrorRow<BidWithBuilder>, run: RobotMirrorRun, lead: boolean) => {
    const status = mirrorStatusLabel(run)
    const chip = mirrorAuditChip(run)
    const shell = run.shellBidId ? shellById.get(run.shellBidId) : undefined
    const scored = run.status === 'scored' || run.status === 'audited'
    const inBand = run.deltaPct != null && Math.abs(run.deltaPct) <= 8
    const needs = run.status === 'needs'
    const off = run.status === 'off'
    const live = !row.bid.bid_date_sent && !row.bid.outcome
    const sentWithoutValue = lead && row.note === 'no bid value on record'
    const teacherBit = run.teacherName && (scored || run.status === 'sealed') ? ` · vs ${run.teacherName}${run.practice ? ' · practice teacher' : ''}` : ''
    return (
      <>
        <td style={td}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            {lead ? <RunGlyph run={run} /> : <span style={{ width: 18, display: 'inline-block' }} />}
            {scored ? (
              <span style={{ ...mono, fontWeight: 600 }}>{money(run.robotTotal)}</span>
            ) : (
              <span style={{ fontWeight: 500, color: needs ? 'var(--text-amber-800)' : off ? 'var(--text-muted)' : undefined }}>{status.text}</span>
            )}
          </span>
          <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', paddingLeft: 'calc(18px + 0.45rem)', maxWidth: 420 }}>
            {needs || off ? status.sub : (
              <>
                {run.label}
                {status.sub ? ` · ${status.sub}` : ''}
                {row.note && lead ? ` · ${row.note}` : ''}
                {teacherBit}
              </>
            )}
          </span>
        </td>
        <td style={{ ...td, ...mono }}>
          {(() => {
            // v2.3234: two human numbers when they differ — the recorded best effort and what went out.
            const be = lead ? row.bestEffort : null
            const beValue = be ? Number(be.value) : null
            if (be && row.gap) {
              return (
                <>
                  <span>{money(row.gap.best)} → {money(row.gap.sent)}</span>
                  <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: row.gap.diff > 0 ? 'var(--text-green-700)' : 'var(--text-amber-800)' }}>
                    {row.gap.diff > 0 ? '+' : '−'}{money(Math.abs(row.gap.diff))} after the reveal
                  </span>
                </>
              )
            }
            if (scored) {
              return (
                <>
                  <span>{money(run.ourValue)}</span>
                  {be && !row.bid.bid_date_sent ? <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{bestEffortStamp(be)} · not sent yet</span> : run.scoredAgainst === 'best_effort' ? <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>best effort · sent at the same number</span> : null}
                </>
              )
            }
            if (be && beValue != null && !row.bid.bid_date_sent) {
              return (
                <>
                  <span>{money(beValue)}</span>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{bestEffortStamp(be)} · not sent yet</span>
                </>
              )
            }
            return <span style={{ color: 'var(--text-faint)' }}>—</span>
          })()}
        </td>
        <td style={{ ...td, ...mono, fontWeight: 600, color: run.deltaPct == null ? 'var(--text-faint)' : inBand ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>
          {run.deltaPct == null ? '—' : fmtDelta(run.deltaPct)}
        </td>
        <td style={{ ...td, whiteSpace: 'nowrap' }}>
          <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {chip ? (
              <span style={{ borderRadius: 4, padding: '1px 6px', fontSize: '0.66rem', fontWeight: 600, background: CHIP_TONES[chip.tone].bg, color: CHIP_TONES[chip.tone].fg }}>{chip.text}</span>
            ) : null}
            {needs && lead && onOpenNeeds ? (
              <button type="button" onClick={() => onOpenNeeds(row.bid)} style={{ ...linkBtn, fontWeight: 600, color: 'var(--text-amber-800)' }}>{needsDoorLabel(run)} →</button>
            ) : null}
            {sentWithoutValue && onAddBidValue ? (
              <button type="button" onClick={() => onAddBidValue(row.bid)} title="The robot's number scores the moment a bid value is on the record" style={{ ...linkBtn, fontWeight: 600 }}>Add bid value →</button>
            ) : null}
            {lead && live && (run.status === 'queued' || run.status === 'working' || run.status === 'sealed') && onOpenStatus ? (
              <button type="button" onClick={() => onOpenStatus(row.bid)} style={linkBtn}>Robot status</button>
            ) : null}
            {mirrorRunReviewable(run) && row.bid.bid_date_sent ? (
              <button type="button" onClick={() => onReviewNow(row.bid, run)} style={{ ...linkBtn, fontWeight: 600 }}>Review now</button>
            ) : null}
            {run.audit?.status === 'pending' && scored ? (
              <button type="button" onClick={() => onOpenAudit(run.audit!.id)} style={linkBtn}>Open audit</button>
            ) : null}
            {scored && shell ? (
              <button type="button" onClick={() => onCompare(row.bid, shell)} style={linkBtn}>Compare</button>
            ) : null}
            {shell && (scored || row.bid.bid_date_sent) ? (
              <button type="button" onClick={() => onOpenShell(shell)} style={linkBtn}>Robot bid b{shell.bid_number ?? '?'}</button>
            ) : null}
          </span>
        </td>
      </>
    )
  }

  const renderDetail = (row: RobotMirrorRow<BidWithBuilder>) => {
    const d = details[row.bid.id]
    const note = row.latest.audit ? (auditNoteById.get(row.latest.audit.id) ?? null) : null
    const wf = d?.waterfall ?? null
    return (
      <tr key={`${row.bid.id}-detail`} style={{ background: 'var(--bg-subtle)' }}>
        <td style={td}></td>
        <td colSpan={5} style={{ ...td, fontSize: '0.76rem' }}>
          {!d || d.loading ? (
            <span role="status" style={{ color: 'var(--text-muted)' }}>Pricing both takeoffs…</span>
          ) : d.error ? (
            <span style={{ color: 'var(--text-red-600)' }}>Couldn't price the rows: {d.error}</span>
          ) : wf ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', fontSize: '0.62rem' }}>Where the delta lives</span>
              {(['missed', 'added', 'gaps', 'rates', 'other'] as const).filter((k) => Math.abs(wf[k]) >= 1).map((k) => (
                <span key={k} style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '0.1rem 0.55rem', background: 'var(--surface)' }}>
                  {k === 'gaps' ? 'counts' : k === 'rates' ? 'priced differently' : k === 'other' ? 'everything else' : k}{' '}
                  <span style={{ ...mono, fontWeight: 700, color: wf[k] < 0 ? 'var(--text-red-600)' : 'var(--text-amber-800)' }}>{signed(wf[k])}</span>
                </span>
              ))}
              <span style={{ color: 'var(--text-muted)' }}>= {signed(wf.delta)} vs ours</span>
            </div>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>{d.why}</span>
          )}
          {note ? (
            <div style={{ marginTop: d && !d.loading ? '0.35rem' : 0, color: 'var(--text-muted)', maxWidth: '80ch' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-700)' }}>Robot's own note: </span>
              {note.length > 280 ? `${note.slice(0, 277).trimEnd()}…` : note}
            </div>
          ) : null}
        </td>
      </tr>
    )
  }

  const pills: Array<{ n: string; label: string; warn: boolean; title: string; onClick?: () => void }> = [
    { n: String(mirror.rowCount), label: 'of our bids have a robot run', warn: false, title: 'Human bids with at least one shadow or backtest run' },
    { n: `${Math.max(0, mirror.liveEligible - mirror.uncoveredLive)} / ${mirror.liveEligible}`, label: 'live plumbing bids shadowed', warn: mirror.uncoveredLive > 0, title: 'Unsent, undecided bids with plans on file that a robot has (or could) shadow — every uncovered one is a free future reference' },
    { n: String(mirror.sealedCount), label: 'sealed, waiting on your number', warn: false, title: 'Robot numbers locked away on live bids — each opens the moment you record your best effort on the Cover Letter, or mark the bid sent with a value' },
    { n: String(mirror.needsCount), label: 'need something from a person', warn: mirror.needsCount > 0, title: 'Live bids the robot can\'t start on — no plans link, plans it can\'t open, or a question it asked. Each row says what, with the door.' },
    { n: String(auditPending), label: oldestAuditDays != null && auditPending > 0 ? `audits waiting · oldest ${oldestAuditDays} d` : 'audits waiting', warn: auditPending > 0, title: 'Robot audits a person still owes a verdict' },
    { n: `${gate.met} / ${gate.total}`, label: 'kinds of job earned first drafts', warn: false, title: 'A kind of job earns first drafts after five robot numbers in a row within 8% of ours', onClick: onOpenScoreboard },
    // v2.3234: the robot's worth, summed — sent bids that moved off the number recorded before the reveal.
    ...(mirror.moved.count > 0
      ? [{ n: `${mirror.moved.count} · ${money(mirror.moved.total)}`, label: `bid${mirror.moved.count === 1 ? '' : 's'} moved after the robot's envelope`, warn: false, title: 'Sent bids whose value differs from the best effort recorded before the envelope opened, and the dollars moved in total' }]
      : []),
  ]

  return (
    <div>
      {/* The program in six numbers — plain words, the mockup's strip. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', marginBottom: '0.9rem' }}>
        {pills.map((s) => {
          const style: React.CSSProperties = { border: `1px solid ${s.warn ? 'var(--text-amber-800)' : 'var(--border)'}`, borderRadius: 8, background: s.warn ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)', padding: '0.45rem 0.8rem', textAlign: 'left', color: 'inherit', font: 'inherit' }
          const body = (
            <>
              <b style={{ display: 'block', fontSize: '1.05rem', color: s.warn ? 'var(--text-amber-800)' : 'var(--text-strong)', ...mono }}>{s.n}</b>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.label}{s.onClick ? ' →' : ''}</span>
            </>
          )
          return s.onClick ? (
            <button key={s.label} type="button" title={s.title} onClick={s.onClick} style={{ ...style, cursor: 'pointer' }}>{body}</button>
          ) : (
            <div key={s.label} title={s.title} style={style}>{body}</div>
          )
        })}
      </div>

      {!ready ? (
        <p role="status" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading the robots' runs…</p>
      ) : mirror.listedCount === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No robot has run on any of these bids yet. Shadows open on their own within the hour of a plumbing bid getting readable plans.</p>
      ) : (
        MIRROR_SECTION_ORDER.map((key) => {
          const rows = mirror.sections[key]
          const isOpen = open[key]
          const needsHere = key === 'unsent' ? rows.filter((r) => r.latest.status === 'needs').length : 0
          return (
            <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', marginBottom: '0.6rem', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setOpen((p) => ({ ...p, [key]: !p[key] }))}
                aria-expanded={isOpen}
                style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', width: '100%', padding: '0.5rem 0.75rem', background: 'var(--bg-subtle)', border: 'none', borderBottom: isOpen ? '1px solid var(--border)' : 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit', fontWeight: 700, fontSize: '0.875rem' }}
              >
                <span aria-hidden>{isOpen ? '▼' : '▶'}</span>
                {MIRROR_SECTION_LABELS[key]}
                <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>({rows.length})</span>
                {needsHere > 0 ? (
                  <span style={{ marginLeft: 'auto', fontWeight: 500, fontSize: '0.74rem', color: 'var(--text-amber-800)' }}>
                    {needsHere} need{needsHere === 1 ? 's' : ''} a person before a robot can start · five minutes each
                  </span>
                ) : key === 'unsent' && !rowStateFor && mirror.uncoveredLive > 0 ? (
                  <span style={{ marginLeft: 'auto', fontWeight: 500, fontSize: '0.74rem', color: 'var(--text-amber-800)' }}>
                    {mirror.uncoveredLive} more live bid{mirror.uncoveredLive === 1 ? '' : 's'} {mirror.uncoveredLive === 1 ? 'has' : 'have'} no robot yet
                  </span>
                ) : null}
              </button>
              {isOpen ? (
                rows.length === 0 ? (
                  <div style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>No robot runs in this group</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={th}>Bid #</th>
                          <th style={th}>Project · GC</th>
                          <th style={th}>Robot</th>
                          <th style={th}>Ours</th>
                          <th style={th}>Δ</th>
                          <th style={th}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.flatMap((row) => {
                          const ringed = row.bid.id === ringedHumanId
                          const isExpanded = expanded.has(row.bid.id)
                          const story = hasDeltaStory(row)
                          const gc = row.bid.bids_gc_builders?.name ?? row.bid.customers?.name ?? null
                          const est = (Array.isArray(row.bid.estimator) ? row.bid.estimator[0] : row.bid.estimator)?.name ?? null
                          const sentLabel = row.bid.bid_date_sent ? `sent ${row.bid.bid_date_sent.slice(5, 10).replace('-', '/')}` : null
                          const dueLabel = !row.bid.bid_date_sent && row.bid.bid_due_date ? `due ${row.bid.bid_due_date.slice(5, 10).replace('-', '/')}` : null
                          const earlierLabel = row.earlier.length > 0 ? `${row.earlier.length} earlier run${row.earlier.length === 1 ? '' : 's'}${row.earlier[0]?.deltaPct != null ? ` · ${row.earlier[0].label} ${fmtDelta(row.earlier[0].deltaPct)}` : ''}` : null
                          const toggleLabel = isExpanded ? (story ? 'hide the details' : 'hide earlier runs') : [story ? 'where the delta lives' : null, earlierLabel].filter(Boolean).join(' · ')
                          const lead = (
                            <tr key={row.bid.id} id={`robot-mirror-row-${row.bid.id}`} style={ringed ? { outline: '2px solid #3b82f6', outlineOffset: -2 } : row.latest.status === 'off' ? { opacity: 0.65 } : undefined}>
                              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                                <button type="button" onClick={() => onEditBid(row.bid)} title="Open the bid" style={{ ...linkBtn, fontSize: '0.84rem', fontWeight: 700, textDecoration: 'none' }}>
                                  b{row.bid.bid_number ?? '?'}
                                </button>
                              </td>
                              <td style={{ ...td, minWidth: 160 }}>
                                <span style={{ fontWeight: 600 }}>{row.bid.project_name ?? 'Untitled'}</span>
                                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {[gc, est, sentLabel ?? dueLabel].filter(Boolean).join(' · ') || '—'}
                                </span>
                                {toggleLabel ? (
                                  <button type="button" onClick={() => toggleRow(row)} aria-expanded={isExpanded} style={{ ...linkBtn, fontSize: '0.7rem', marginTop: 2 }}>
                                    {toggleLabel}
                                  </button>
                                ) : null}
                              </td>
                              {renderRun(row, row.latest, true)}
                            </tr>
                          )
                          if (!isExpanded) return [lead]
                          return [
                            lead,
                            ...(story ? [renderDetail(row)] : []),
                            ...row.earlier.map((run, j) => (
                              <tr key={`${row.bid.id}-earlier-${j}`} style={{ background: 'var(--bg-subtle)' }}>
                                <td style={td}></td>
                                <td style={{ ...td, fontSize: '0.72rem', color: 'var(--text-muted)' }}>earlier run</td>
                                {renderRun(row, run, false)}
                              </tr>
                            )),
                          ]
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : null}
            </div>
          )
        })
      )}

      {ready && mirror.orphanShells.length > 0 ? (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          {mirror.orphanShells.length} robot shell{mirror.orphanShells.length === 1 ? '' : 's'} with no bid of ours to mirror —{' '}
          {mirror.orphanShells.map((s, i) => (
            <span key={s.id}>
              {i > 0 ? ', ' : ''}
              <button type="button" onClick={() => { const shell = shellById.get(s.id); if (shell) onOpenShell(shell) }} style={linkBtn}>b{s.bid_number ?? '?'}</button>
            </span>
          ))}
          {' '}— pair or archive.
        </p>
      ) : null}
    </div>
  )
}
