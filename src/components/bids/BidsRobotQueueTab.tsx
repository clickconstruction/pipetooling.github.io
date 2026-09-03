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
  normalizeBidNumber,
  starvationLine,
  type BacktestCandidate,
} from '../../lib/bids/backtestCandidates'
import { buildAxisCards, type RunScoreRow } from '../../lib/bids/confidenceBoard'
import type { ShadowRunRow } from '../../lib/bids/shadowStory'
import { todayYmdInAppTz } from '../../utils/dateUtils'

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
 * above ready (yellow). The kickoff prompt lives HERE now — with the person who
 * has the twin-mcp context — not on the estimator-facing board icon. Same
 * candidate logic as the board icons (one kernel), so the lens and the icons
 * can never disagree.
 */
export function BidsRobotQueueTab({ bids, twinBidBySourceId, referencePresence, onOpenBid }: BidsRobotQueueTabProps) {
  const { showToast } = useToastContext()
  const queue = useMemo(() => {
    const staleDueBefore = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    return buildRobotQueue(bids, (bidId) => twinBidBySourceId.has(bidId), { staleDueBefore })
  }, [bids, twinBidBySourceId])
  const [copiedBidId, setCopiedBidId] = useState<string | null>(null)
  const [requesterNames, setRequesterNames] = useState<Record<string, string>>({})

  // Backtest candidates (v2.2594, mockup Variant B): axis demand comes from the
  // same rows the Scoreboard reads, so the two lenses can never disagree.
  const [runScores, setRunScores] = useState<RunScoreRow[] | null>(null)
  const [shadowRuns, setShadowRuns] = useState<ShadowRunRow[] | null>(null)
  const [axisOverrides, setAxisOverrides] = useState<Record<string, string>>({})
  const [savingAxisBidId, setSavingAxisBidId] = useState<string | null>(null)
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
    })
  }, [bids, axisOverrides, referencePresence, runScores, shadowRuns, axisCards])
  const backtestCount = backtestGroups.reduce((sum, g) => sum + g.eligible.length, 0)
  const knownAxes = useMemo(() => axisCards.map((c) => c.axis).sort(), [axisCards])

  async function assignAxis(bid: BidWithBuilder, axis: string) {
    setSavingAxisBidId(bid.id)
    try {
      const { error } = await queueDb.from('bids').update({ backtest_axis: axis }).eq('id', bid.id)
      if (error) throw new Error(error.message)
      setAxisOverrides((prev) => ({ ...prev, [bid.id]: axis }))
    } catch (e) {
      showToast(`Couldn't assign the axis: ${e instanceof Error ? e.message : 'unknown error'}`, 'error')
    } finally {
      setSavingAxisBidId(null)
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
        Every bid a robot could do right now — same rules as the board icons. Green requests come first
        (oldest ask on top); paste a prompt into the twin and it runs the pipeline blind.
      </p>

      <h4 style={sectionHeadStyle}>
        <span style={dotStyle('#16a34a')} />
        Requested · {queue.requested.length} — humans asked, these go first
      </h4>
      {queue.requested.length === 0 ? (
        <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: 'var(--text-faint, var(--text-muted))' }}>
          No requests yet — estimators click a yellow robot on the Bid Board to add one.
        </p>
      ) : (
        <div style={{ marginBottom: '1rem' }}>{queue.requested.map((b) => renderRow(b, true))}</div>
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
          const renderCandidate = (c: BacktestCandidate<BidWithBuilder>, flagged: boolean) => {
            const rowAxis = group.axis ?? axisOverrides[c.bid.id] ?? null
            const hot = group.demand === 'open' || group.demand === 'new'
            return (
              <div key={c.bid.id} style={{ ...rowStyle, opacity: dim || flagged ? 0.55 : 1 }}>
                <span style={{ color: 'var(--text-blue-500)', fontWeight: 600 }}>b{normalizeBidNumber(c.bid.bid_number) ?? '?'}</span>
                <span style={{ fontWeight: 600 }}>{c.bid.project_name ?? 'Untitled'}</span>
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
                <button
                  type="button"
                  onClick={() => void copyBacktestPrompt(c.bid, rowAxis)}
                  style={hot && !flagged ? { ...btnStyle, background: '#3b82f6', borderColor: '#3b82f6', color: 'white', fontWeight: 600 } : btnStyle}
                >
                  {copiedBidId === c.bid.id ? 'Copied ✓' : 'Copy backtest prompt'}
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
                  {shownEligible.map((c) => renderCandidate(c, false))}
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
              {group.eligible.length > 0 && group.flagged.length > 0 ? (
                showFlaggedAxes.has(axisKey) ? (
                  group.flagged.map((c) => renderCandidate(c, true))
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
