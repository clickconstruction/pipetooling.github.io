import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { buildRobotMirror, type MirrorAudit, type MirrorBestEffort } from '../../lib/bids/robotMirror'
import { buildAxisCards, type RunScoreRow } from '../../lib/bids/confidenceBoard'
import type { ShadowRunRow } from '../../lib/bids/shadowStory'
import type { RobotRowState } from '../../lib/bids/robotRowState'
import type { BidsTabKey } from '../../lib/bids/bidsTabAccess'
import { buildRobotStripTiles, oldestPendingAuditDays } from '../../lib/bids/robotGroupStrip'

// twin_run_scores / bid_audits predate the generated types (BidsAuditsTab pattern).
const db = supabase as unknown as SupabaseClient

const mono: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }

/**
 * The Robots group's header (punch list #63, PR 2, v2.4256): the program in six numbers,
 * drawn under the lens bar on every lens, each tile a door to the lens that works it. Lifted
 * from the Robot Board (v2.3225), which drew it alone; it loads the same runs, scores and
 * audits the board does and builds the same mirror, so the two never disagree. Every read
 * is fail-soft — a missing table or an RLS-closed read draws zeros, never a broken bar.
 */
export function RobotGroupStrip({ bids, robotBids, auditPending, rowStateFor, activeKey, canOpen, onOpen }: {
  /** The human board's bids (the People scope). */
  bids: BidWithBuilder[]
  /** The robots' ZZ shells, for pairing. */
  robotBids: BidWithBuilder[]
  /** The page's audit gate — the workable pending count. */
  auditPending: number
  /** The Bid Board icon's state for a human bid, so the live bids with no run count too. */
  rowStateFor?: (bid: BidWithBuilder) => RobotRowState
  activeKey: BidsTabKey
  /** Whether this viewer may open a lens (the Scoreboard needs the audit roles). */
  canOpen: (key: BidsTabKey) => boolean
  onOpen: (key: BidsTabKey) => void
}) {
  const [shadowRuns, setShadowRuns] = useState<ShadowRunRow[] | null>(null)
  const [scores, setScores] = useState<RunScoreRow[] | null>(null)
  const [audits, setAudits] = useState<MirrorAudit[]>([])
  const [standardIds, setStandardIds] = useState<ReadonlySet<string> | undefined>(undefined)
  const [bestEfforts, setBestEfforts] = useState<Map<string, MirrorBestEffort>>(() => new Map())

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [runRes, scoreRes, auditRes, stdRes, beRes] = await Promise.all([
        db.rpc('list_shadow_runs'),
        db.from('twin_run_scores').select('*').order('scored_at', { ascending: false }),
        db.from('bid_audits').select('id, bid_id, status, requested_at').order('requested_at', { ascending: false }).limit(300),
        db.from('users').select('id').eq('calibration_standard', true),
        db.from('bid_best_efforts').select('bid_id, value, recorded_at, recorded_by').limit(1000),
      ])
      if (cancelled) return
      setShadowRuns((runRes.data ?? []) as ShadowRunRow[])
      setScores((scoreRes.data ?? []) as RunScoreRow[])
      setAudits((auditRes.data ?? []) as MirrorAudit[])
      if (!stdRes.error) setStandardIds(new Set(((stdRes.data ?? []) as Array<{ id: string }>).map((u) => u.id)))
      setBestEfforts(new Map(((beRes.data ?? []) as Array<MirrorBestEffort & { bid_id: string }>).map((r) => [r.bid_id, { value: r.value, recorded_at: r.recorded_at, recorded_by: r.recorded_by }])))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const tiles = useMemo(() => {
    const mirror = buildRobotMirror({
      humanBids: bids,
      shells: robotBids.map((b) => ({ id: b.id, bid_number: b.bid_number, project_name: b.project_name, twin_source_bid_id: b.twin_source_bid_id ?? null })),
      shadowRuns: shadowRuns ?? [],
      scores: scores ?? [],
      audits,
      standardTeacherIds: standardIds,
      rowStateFor,
      bestEfforts,
    })
    const cards = buildAxisCards(scores ?? [], shadowRuns ?? [], { standardTeacherIds: standardIds })
    return buildRobotStripTiles({
      rowCount: mirror.rowCount,
      liveEligible: mirror.liveEligible,
      uncoveredLive: mirror.uncoveredLive,
      sealedCount: mirror.sealedCount,
      needsCount: mirror.needsCount,
      auditPending,
      oldestAuditDays: oldestPendingAuditDays(audits),
      gate: { met: cards.filter((c) => c.chip.tone === 'met').length, total: cards.length },
      moved: mirror.moved,
    })
  }, [bids, robotBids, shadowRuns, scores, audits, standardIds, bestEfforts, rowStateFor, auditPending])

  return (
    <div data-testid="robot-group-strip" role="group" aria-label="The robots in six numbers" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', marginBottom: '0.9rem' }}>
      {tiles.map((t) => {
        const open = canOpen(t.door)
        const here = t.door === activeKey
        const style: React.CSSProperties = {
          border: `1px solid ${t.warn ? 'var(--text-amber-800)' : here ? '#3b82f6' : 'var(--border)'}`,
          borderRadius: 8,
          background: t.warn ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)',
          padding: '0.45rem 0.8rem',
          textAlign: 'left',
          color: 'inherit',
          font: 'inherit',
          cursor: open ? 'pointer' : 'default',
        }
        const body = (
          <>
            <b style={{ display: 'block', fontSize: '1.05rem', color: t.warn ? 'var(--text-amber-800)' : 'var(--text-strong)', ...mono }}>{t.n}</b>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.label}{open && !here ? ' →' : ''}</span>
          </>
        )
        return open ? (
          <button key={t.key} type="button" title={t.title} aria-current={here ? 'true' : undefined} onClick={() => onOpen(t.door)} style={style}>{body}</button>
        ) : (
          <div key={t.key} title={t.title} style={style}>{body}</div>
        )
      })}
    </div>
  )
}
