import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { buildRobotQueue } from '../../lib/bids/robotQueue'
import { buildRobotBidPrompt } from '../../lib/bids/robotBidReadiness'

type BidsRobotQueueTabProps = {
  bids: BidWithBuilder[]
  twinBidBySourceId: ReadonlyMap<string, BidWithBuilder>
  onOpenBid: (bid: BidWithBuilder) => void
}

/**
 * The dev-only 🤖 Queue lens (v2.2542): every robot-able bid, requested (green)
 * above ready (yellow). The kickoff prompt lives HERE now — with the person who
 * has the twin-mcp context — not on the estimator-facing board icon. Same
 * candidate logic as the board icons (one kernel), so the lens and the icons
 * can never disagree.
 */
export function BidsRobotQueueTab({ bids, twinBidBySourceId, onOpenBid }: BidsRobotQueueTabProps) {
  const queue = useMemo(() => {
    const staleDueBefore = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    return buildRobotQueue(bids, (bidId) => twinBidBySourceId.has(bidId), { staleDueBefore })
  }, [bids, twinBidBySourceId])
  const [copiedBidId, setCopiedBidId] = useState<string | null>(null)
  const [requesterNames, setRequesterNames] = useState<Record<string, string>>({})

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
    </div>
  )
}
