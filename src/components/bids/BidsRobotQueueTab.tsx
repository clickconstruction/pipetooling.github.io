import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { buildRobotQueue } from '../../lib/bids/robotQueue'
import { buildRobotBidPrompt } from '../../lib/bids/robotBidReadiness'
import {
  buildBacktestCandidateGroups,
  buildBacktestPrompt,
  holdoutSummary,
  normalizeBidNumber,
  starvationLine,
  type BacktestCandidate,
} from '../../lib/bids/backtestCandidates'
import { buildAxisCards, type RunScoreRow } from '../../lib/bids/confidenceBoard'
import type { ShadowRunRow } from '../../lib/bids/shadowStory'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, bidUpdateRefused } from '../../lib/bids/updateGuard'
import { usePriceMatrixRequests, type PriceMatrixRequestWithBid } from '../../hooks/usePriceMatrixRequests'
import { useUserDisplayNames } from '../../hooks/useUserDisplayNames'
import { buildPricerRequestPrompt, requestAgeLabel } from '../../lib/rfq/priceMatrixRequest'

// twin_run_scores / bids.backtest_axis predate the generated types
// (BidsAuditsTab pattern) — untyped until the post-push gen-types run.
const queueDb = supabase as unknown as SupabaseClient

type BidsRobotQueueTabProps = {
  bids: BidWithBuilder[]
  twinBidBySourceId: ReadonlyMap<string, BidWithBuilder>
  /** Counts/pricing presence per decided bid (v2.2547's list_reference_presence load). */
  referencePresence: ReadonlyMap<string, { hasCounts: boolean; hasPricing: boolean }>
  onOpenBid: (bid: BidWithBuilder) => void
}

const bidAxis = (bid: BidWithBuilder): string | null =>
  (bid as unknown as { backtest_axis?: string | null }).backtest_axis ?? null

const bidHoldout = (bid: BidWithBuilder): boolean =>
  (bid as unknown as { holdout?: boolean | null }).holdout === true

/** '2026-07-10' → 'Jul 2026' without a timezone round-trip. */
function decidedMonth(ymd: string | null): string {
  if (!ymd) return ''
  const m = Number(ymd.slice(5, 7))
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const name = names[m - 1]
  return name ? `${name} ${ymd.slice(0, 4)}` : ymd.slice(0, 10)
}

/**
 * The dev-only 🤖 Queue lens (v2.2542): every robot-able bid, requested (green)
 * above ready (yellow), then the backtest candidates by axis. Per-bid kickoff
 * prompts live HERE — with the person who has the twin-mcp context — not on the
 * estimator-facing board icon; the Desktop setup and kickoff and the Claude Code
 * handoff are on the Console lens (v2.3224). Same candidate logic as the board
 * icons (one kernel), so the lens and the icons can never disagree.
 */
export function BidsRobotQueueTab({ bids, twinBidBySourceId, referencePresence, onOpenBid }: BidsRobotQueueTabProps) {
  const { showToast } = useToastContext()
  const queue = useMemo(() => {
    const staleDueBefore = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    return buildRobotQueue(bids, (bidId) => twinBidBySourceId.has(bidId), { staleDueBefore })
  }, [bids, twinBidBySourceId])
  const [copiedBidId, setCopiedBidId] = useState<string | null>(null)
  const [requesterNames, setRequesterNames] = useState<Record<string, string>>({})

  // Price Matrix PR 2: the pricing robot's list — a different seat, a different
  // prompt. Open requests across every bid, newest ask last (oldest goes first).
  const { requests: matrixRequests } = usePriceMatrixRequests({ enabled: true, statuses: ['queued', 'working', 'blocked', 'ready'] })
  const matrixRequesterNames = useUserDisplayNames(matrixRequests.map((r) => r.requested_by))
  const [copiedRequestId, setCopiedRequestId] = useState<string | null>(null)
  const copyPricerPrompt = async (r: PriceMatrixRequestWithBid) => {
    const who = r.requested_by ? (matrixRequesterNames[r.requested_by] ?? null) : null
    const text = buildPricerRequestPrompt(r, r.bid ?? { bid_number: null, project_name: null }, who)
    try {
      await navigator.clipboard.writeText(text)
      setCopiedRequestId(r.id)
      showToast('Pricer prompt copied — paste it into a twin-mcp chat as twin-pricer-1.', 'success')
      window.setTimeout(() => setCopiedRequestId((cur) => (cur === r.id ? null : cur)), 2000)
    } catch {
      showToast('Could not copy — the clipboard is blocked here.', 'error')
    }
  }

  // Backtest candidates (v2.2594, mockup Variant B): axis demand comes from the
  // same rows the Scoreboard reads, so the two lenses can never disagree.
  const [runScores, setRunScores] = useState<RunScoreRow[] | null>(null)
  const [shadowRuns, setShadowRuns] = useState<ShadowRunRow[] | null>(null)
  const [axisOverrides, setAxisOverrides] = useState<Record<string, string>>({})
  const [savingAxisBidId, setSavingAxisBidId] = useState<string | null>(null)
  const [holdoutOverrides, setHoldoutOverrides] = useState<Record<string, boolean>>({})
  const [savingHoldoutBidId, setSavingHoldoutBidId] = useState<string | null>(null)
  const [showFlaggedAxes, setShowFlaggedAxes] = useState<ReadonlySet<string>>(() => new Set())
  const [showAllUnclassified, setShowAllUnclassified] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [scoreRes, shadowRes] = await Promise.all([
        queueDb.from('twin_run_scores').select('*').order('scored_at', { ascending: false }),
        queueDb.rpc('list_shadow_runs'),
      ])
      if (cancelled) return
      // Missing tables (client ahead of the migration) read as an empty program.
      setRunScores((scoreRes.data ?? []) as RunScoreRow[])
      setShadowRuns((shadowRes.data ?? []) as ShadowRunRow[])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const axisCards = useMemo(() => buildAxisCards(runScores ?? [], shadowRuns ?? []), [runScores, shadowRuns])
  const backtestGroups = useMemo(() => {
    const used = new Set<string>()
    for (const r of runScores ?? []) {
      const n = normalizeBidNumber(r.reference_bid_number)
      if (n) used.add(n)
    }
    for (const r of shadowRuns ?? []) {
      const n = normalizeBidNumber(r.reference_bid_number)
      if (n) used.add(n)
    }
    return buildBacktestCandidateGroups(bids, {
      axisOf: (bid) => axisOverrides[bid.id] ?? bidAxis(bid),
      presenceOf: (bidId) => referencePresence.get(bidId) ?? null,
      usedReferenceNumbers: used,
      axisCards,
      todayYmd: todayYmdInAppTz(),
      holdoutOf: (bid) => holdoutOverrides[bid.id] ?? bidHoldout(bid),
    })
  }, [bids, axisOverrides, holdoutOverrides, referencePresence, runScores, shadowRuns, axisCards])
  const backtestCount = backtestGroups.reduce((sum, g) => sum + g.eligible.length, 0)
  const holdouts = useMemo(() => holdoutSummary(backtestGroups), [backtestGroups])
  const knownAxes = useMemo(() => axisCards.map((c) => c.axis).sort(), [axisCards])

  async function assignAxis(bid: BidWithBuilder, axis: string) {
    setSavingAxisBidId(bid.id)
    try {
      const { data: rows, error } = await queueDb.from('bids').update({ backtest_axis: axis }).eq('id', bid.id).select('id')
      if (error) throw new Error(error.message)
      if (bidUpdateRefused(rows)) throw new Error(BID_UPDATE_NOT_APPLIED_MESSAGE)
      setAxisOverrides((prev) => ({ ...prev, [bid.id]: axis }))
    } catch (e) {
      showToast(`Couldn't assign the axis: ${e instanceof Error ? e.message : 'unknown error'}`, 'error')
    } finally {
      setSavingAxisBidId(null)
    }
  }

  async function setHoldout(bid: BidWithBuilder, holdout: boolean) {
    setSavingHoldoutBidId(bid.id)
    try {
      const { data: rows, error } = await queueDb.from('bids').update({ holdout }).eq('id', bid.id).select('id')
      if (error) throw new Error(error.message)
      if (bidUpdateRefused(rows)) throw new Error(BID_UPDATE_NOT_APPLIED_MESSAGE)
      setHoldoutOverrides((prev) => ({ ...prev, [bid.id]: holdout }))
    } catch (e) {
      showToast(`Couldn't ${holdout ? 'hold out' : 'release'} the reference: ${e instanceof Error ? e.message : 'unknown error'}`, 'error')
    } finally {
      setSavingHoldoutBidId(null)
    }
  }

  async function copyBacktestPrompt(bid: BidWithBuilder, axis: string | null) {
    try {
      await navigator.clipboard.writeText(buildBacktestPrompt(bid, axis))
      setCopiedBidId(bid.id)
      window.setTimeout(() => setCopiedBidId((cur) => (cur === bid.id ? null : cur)), 2000)
    } catch {
      setCopiedBidId(null)
    }
  }

  const requesterIds = useMemo(
    () => [...new Set(queue.requested.map((b) => b.robot_requested_by).filter((x): x is string => !!x))],
    [queue.requested],
  )
  useEffect(() => {
    if (requesterIds.length === 0) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('users').select('id, name').in('id', requesterIds)
      if (cancelled) return
      setRequesterNames(Object.fromEntries(((data ?? []) as Array<{ id: string; name: string | null }>).map((u) => [u.id, u.name ?? 'someone'])))
    })()
    return () => {
      cancelled = true
    }
  }, [requesterIds])

  async function copyPrompt(bid: BidWithBuilder) {
    try {
      await navigator.clipboard.writeText(buildRobotBidPrompt(bid))
      setCopiedBidId(bid.id)
      window.setTimeout(() => setCopiedBidId((cur) => (cur === bid.id ? null : cur)), 2000)
    } catch {
      setCopiedBidId(null)
    }
  }

  const requestAge = (iso: string | null): string => {
    if (!iso) return ''
    const hours = (Date.now() - new Date(iso).getTime()) / 3600000
    if (hours < 1) return 'just now'
    if (hours < 24) return `${Math.round(hours)}h ago`
    const days = Math.round(hours / 24)
    return days === 1 ? 'yesterday' : `${days}d ago`
  }

  const sectionHeadStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    margin: '0 0 0.4rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  }
  const dotStyle = (color: string): React.CSSProperties => ({
    width: 10,
    height: 10,
    borderRadius: 999,
    display: 'inline-block',
    background: color,
  })
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.55rem 0.75rem',
    marginBottom: '0.4rem',
    fontSize: '0.875rem',
    flexWrap: 'wrap',
  }
  const btnStyle: React.CSSProperties = {
    padding: '0.35rem 0.9rem',
    borderRadius: 6,
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    cursor: 'pointer',
    fontSize: '0.8rem',
  }

  const renderRow = (bid: BidWithBuilder, requested: boolean) => (
    <div key={bid.id} style={rowStyle}>
      <span style={{ color: 'var(--text-blue-500)', fontWeight: 600 }}>b{bid.bid_number ?? '?'}</span>
      <span style={{ fontWeight: 600 }}>{bid.project_name ?? 'Untitled'}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
        {bid.bids_gc_builders?.name ?? bid.customers?.name ?? '—'}
        {bid.bid_due_date ? ` · due ${bid.bid_due_date}` : ''}
      </span>
      {requested ? (
        <span style={{ color: 'var(--text-emerald-800)', fontSize: '0.78rem', fontWeight: 600 }}>
          requested by {bid.robot_requested_by ? (requesterNames[bid.robot_requested_by] ?? '…') : 'someone'} ·{' '}
          {requestAge(bid.robot_requested_at)}
        </span>
      ) : null}
      <span style={{ flex: 1 }} />
      <button
        type="button"
        onClick={() => void copyPrompt(bid)}
        style={requested ? { ...btnStyle, background: '#3b82f6', borderColor: '#3b82f6', color: 'white', fontWeight: 600 } : btnStyle}
      >
        {copiedBidId === bid.id ? 'Copied ✓' : 'Copy robot prompt'}
      </button>
      <button type="button" onClick={() => onOpenBid(bid)} style={btnStyle}>
        Open bid
      </button>
    </div>
  )

  return (
    <div>
      <p style={{ margin: '0 0 0.9rem', fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '68ch' }}>
        Every bid a robot could do right now — same rules as the board icons. Front-of-the-line requests come
        first (oldest ask on top); paste a prompt into the twin and it runs the pipeline blind. The Claude Desktop
        setup and kickoff, and the Claude Code handoff, are on the Console lens.
      </p>

      <h4 style={sectionHeadStyle}>
        <span style={dotStyle('#16a34a')} />
        Requested · {queue.requested.length} — humans asked, these go first
      </h4>
      {queue.requested.length === 0 ? (
        <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: 'var(--text-faint, var(--text-muted))' }}>
          No requests yet — a bid goes to the front of the line from its robot icon on the Bid Board (Front of the line next batch).
        </p>
      ) : (
        <div style={{ marginBottom: '1rem' }}>{queue.requested.map((b) => renderRow(b, true))}</div>
      )}

      <h4 style={sectionHeadStyle}>
        <span style={dotStyle('#8b5cf6')} />
        Price matrices · {matrixRequests.length} — the pricing robot’s list (quotes in the folder, a different seat)
      </h4>
      {matrixRequests.length === 0 ? (
        <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: 'var(--text-faint, var(--text-muted))' }}>
          Nothing queued — an estimator asks from Bids → Pricing → Supply house prices ▾ → Price it with the robot.
        </p>
      ) : (
        <div style={{ marginBottom: '1rem' }}>
          {[...matrixRequests].sort((a, b) => a.requested_at.localeCompare(b.requested_at)).map((r) => {
            const bid = bids.find((b) => b.id === r.bid_id) ?? null
            const who = r.requested_by ? (matrixRequesterNames[r.requested_by] ?? '…') : 'someone'
            const tone = r.status === 'ready' ? 'var(--text-emerald-800)' : r.status === 'blocked' ? 'var(--text-amber-700)' : 'var(--text-blue-500)'
            return (
              <div key={r.id} style={{ ...rowStyle, borderColor: 'var(--border-violet)' }}>
                <span style={{ color: 'var(--text-blue-500)', fontWeight: 600 }}>b{r.bid?.bid_number ?? bid?.bid_number ?? '?'}</span>
                <span style={{ fontWeight: 600 }}>{r.bid?.project_name ?? bid?.project_name ?? 'Untitled'}</span>
                <span style={{ color: tone, fontSize: '0.78rem', fontWeight: 600 }}>{r.status}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  asked by {who} · {requestAgeLabel(r.requested_at, Date.now())} · {r.sources.length} quote link{r.sources.length === 1 ? '' : 's'} · {r.scope.length} rows
                </span>
                <span style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={() => void copyPricerPrompt(r)}
                  style={r.status === 'queued' ? { ...btnStyle, background: '#8b5cf6', borderColor: '#8b5cf6', color: 'white', fontWeight: 600 } : btnStyle}
                  title="The pricing kickoff pinned to this request — paste into a Claude Desktop chat on the twin-mcp connector as twin-pricer-1"
                >
                  {copiedRequestId === r.id ? 'Copied ✓' : 'Copy pricer prompt'}
                </button>
                {bid ? (
                  <button type="button" onClick={() => onOpenBid(bid)} style={btnStyle}>
                    Open bid
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      <h4 style={sectionHeadStyle}>
        <span style={dotStyle('#eab308')} />
        Ready · {queue.ready.length} — robot-able, nobody has asked yet
      </h4>
      {queue.ready.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-faint, var(--text-muted))' }}>Nothing ready right now.</p>
      ) : (
        <div>{queue.ready.map((b) => renderRow(b, false))}</div>
      )}

      <h4 style={{ ...sectionHeadStyle, marginTop: '1.4rem' }}>
        <span style={dotStyle('#3b82f6')} />
        Backtest candidates · {backtestCount} — graded history, no run yet
      </h4>
      {runScores != null && shadowRuns != null ? (
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Holdout: {holdouts.count} reference{holdouts.count === 1 ? '' : 's'} (target 20–25, spread across axes)
          {holdouts.count > 0
            ? ` — ${[...holdouts.axes, ...(holdouts.unclassified > 0 ? [`${holdouts.unclassified} unclassified`] : [])].join(', ')}`
            : ''}
        </p>
      ) : null}
      {runScores == null || shadowRuns == null ? (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-faint, var(--text-muted))' }}>Loading run history…</p>
      ) : backtestGroups.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-faint, var(--text-muted))' }}>
          No graded references yet — grade decided bids on the board (robot icon on a decided row) to build the practice library.
        </p>
      ) : (
        backtestGroups.map((group) => {
          const axisKey = group.axis ?? '(unclassified)'
          const dim = group.demand === 'blocked'
          const unclassifiedPool = backtestGroups.find((g) => g.axis == null)?.eligible.length ?? 0
          // The unclassified bucket is raw material, not a queue — preview a
          // handful newest-first and say how many wait behind them (no silent caps).
          const UNCLASSIFIED_PREVIEW = 8
          const shownEligible =
            group.axis == null && !showAllUnclassified ? group.eligible.slice(0, UNCLASSIFIED_PREVIEW) : group.eligible
          const hiddenUnclassified = group.eligible.length - shownEligible.length
          const renderCandidate = (c: BacktestCandidate<BidWithBuilder>, kind: 'eligible' | 'flagged' | 'holdout') => {
            const flagged = kind === 'flagged'
            const held = kind === 'holdout'
            const rowAxis = group.axis ?? axisOverrides[c.bid.id] ?? null
            const hot = group.demand === 'open' || group.demand === 'new'
            return (
              <div key={c.bid.id} style={{ ...rowStyle, opacity: dim || flagged ? 0.55 : 1 }}>
                <span style={{ color: 'var(--text-blue-500)', fontWeight: 600 }}>b{normalizeBidNumber(c.bid.bid_number) ?? '?'}</span>
                <span style={{ fontWeight: 600 }}>{c.bid.project_name ?? 'Untitled'}</span>
                {held ? (
                  <span
                    title="Holdout reference — reserved for gate measurement: never run as practice, never quoted in doctrine, never named in audits."
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      borderRadius: 5,
                      padding: '1px 6px',
                      color: '#7c3aed',
                      background: 'var(--bg-muted)',
                      border: '1px solid #7c3aed',
                    }}
                  >
                    HOLDOUT
                  </span>
                ) : null}
                <span
                  title={c.grade === 'A' ? 'Grade A — plans + value + counts + pricing: full scorecard' : 'Grade B — plans + value: dollar scorecard only'}
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    borderRadius: 5,
                    padding: '1px 6px',
                    color: c.grade === 'A' ? 'var(--text-green-700)' : 'var(--text-amber-800)',
                    background: c.grade === 'A' ? 'var(--bg-green-tint)' : 'var(--bg-amber-tint)',
                  }}
                >
                  {c.grade}
                </span>
                <span style={{ color: c.bid.outcome === 'won' ? 'var(--text-green-700)' : 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>
                  {c.bid.outcome ?? 'sent'}
                  {c.bid.outcome === 'lost' && c.bid.loss_category ? ` · ${c.bid.loss_category}` : ''}
                </span>
                {flagged ? (
                  <span style={{ color: 'var(--text-amber-800)', fontSize: '0.72rem' }}>
                    {[
                      c.flags.roundValue ? 'round value' : null,
                      c.flags.weakLoss ? 'weak loss' : null,
                      c.flags.lossUncategorized ? 'uncategorized loss' : null,
                      c.flags.stale ? 'stale' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                ) : null}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  {c.bid.bids_gc_builders?.name ?? c.bid.customers?.name ?? '—'} · decided {decidedMonth(c.bid.bid_date_sent ?? c.bid.created_at)}
                </span>
                {group.axis == null ? (
                  <select
                    aria-label={`Assign axis for b${normalizeBidNumber(c.bid.bid_number) ?? '?'}`}
                    value=""
                    disabled={savingAxisBidId === c.bid.id}
                    onChange={(e) => {
                      if (e.target.value) void assignAxis(c.bid, e.target.value)
                    }}
                    style={{ ...btnStyle, padding: '0.3rem 0.5rem', color: 'var(--text-muted)' }}
                  >
                    <option value="">{savingAxisBidId === c.bid.id ? 'assigning…' : 'assign axis ▾'}</option>
                    {knownAxes.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                ) : null}
                <span style={{ flex: 1 }} />
                {held ? (
                  // No kickoff prompt for a holdout reference — practice slates never include them.
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>gate measurement only — no practice prompt</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void copyBacktestPrompt(c.bid, rowAxis)}
                    style={hot && !flagged ? { ...btnStyle, background: '#3b82f6', borderColor: '#3b82f6', color: 'white', fontWeight: 600 } : btnStyle}
                  >
                    {copiedBidId === c.bid.id ? 'Copied ✓' : 'Copy backtest prompt'}
                  </button>
                )}
                <button
                  type="button"
                  disabled={savingHoldoutBidId === c.bid.id}
                  title={
                    held
                      ? 'Return this reference to the practice pool.'
                      : 'Reserve this reference for gate measurement — robots will never practice on it.'
                  }
                  onClick={() => void setHoldout(c.bid, !held)}
                  style={{ ...btnStyle, color: held ? undefined : '#7c3aed' }}
                >
                  {savingHoldoutBidId === c.bid.id ? 'saving…' : held ? 'Release holdout' : 'Hold out'}
                </button>
                <button type="button" onClick={() => onOpenBid(c.bid)} style={btnStyle}>
                  Open bid
                </button>
              </div>
            )
          }
          return (
            <div key={axisKey} style={{ marginBottom: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.55rem', margin: '0.5rem 0 0.35rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, opacity: dim ? 0.7 : 1 }}>{group.axis ?? 'unclassified'}</span>
                {group.demand === 'open' || group.demand === 'new' ? (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      borderRadius: 5,
                      padding: '1px 6px',
                      color: 'var(--text-amber-800)',
                      background: 'var(--bg-amber-tint)',
                    }}
                  >
                    {group.demand === 'new' ? 'new axis' : 'wants reps'}
                  </span>
                ) : null}
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{group.why}</span>
              </div>
              {group.eligible.length === 0 ? (
                <div
                  style={{
                    border: '1px dashed var(--border-strong)',
                    borderRadius: 8,
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    marginBottom: '0.4rem',
                    opacity: dim ? 0.7 : 1,
                  }}
                >
                  {group.flagged.length === 0 && unclassifiedPool > 0
                    ? 'No references assigned to this axis yet — classify some from the unclassified list below.'
                    : starvationLine(group)}
                </div>
              ) : (
                <>
                  {shownEligible.map((c) => renderCandidate(c, 'eligible'))}
                  {hiddenUnclassified > 0 ? (
                    <p style={{ margin: '0.1rem 0 0.3rem', fontSize: '0.75rem', color: 'var(--text-faint, var(--text-muted))' }}>
                      + {hiddenUnclassified} more unclassified — assign axes to surface them where they're needed, or{' '}
                      <button
                        type="button"
                        onClick={() => setShowAllUnclassified(true)}
                        style={{ border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', fontSize: '0.75rem', padding: 0, textDecoration: 'underline' }}
                      >
                        show all {group.eligible.length}
                      </button>
                    </p>
                  ) : null}
                </>
              )}
              {group.holdout.map((c) => renderCandidate(c, 'holdout'))}
              {group.eligible.length > 0 && group.flagged.length > 0 ? (
                showFlaggedAxes.has(axisKey) ? (
                  group.flagged.map((c) => renderCandidate(c, 'flagged'))
                ) : (
                  <p style={{ margin: '0.1rem 0 0.3rem', fontSize: '0.75rem', color: 'var(--text-faint, var(--text-muted))' }}>
                    {group.flagged.length} flagged reference{group.flagged.length === 1 ? '' : 's'} hidden — can't move gates.{' '}
                    <button
                      type="button"
                      onClick={() => setShowFlaggedAxes((prev) => new Set([...prev, axisKey]))}
                      style={{ border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', fontSize: '0.75rem', padding: 0, textDecoration: 'underline' }}
                    >
                      Show anyway
                    </button>
                  </p>
                )
              ) : null}
            </div>
          )
        })
      )}
    </div>
  )
}
