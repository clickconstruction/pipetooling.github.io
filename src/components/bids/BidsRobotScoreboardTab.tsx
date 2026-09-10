import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { ShadowRunRow } from '../../lib/bids/shadowStory'
import {
  buildAxisCards,
  buildLedger,
  normalizeBidNumber,
  type AxisCard,
  type GateSlot,
  type RunScoreRow,
} from '../../lib/bids/confidenceBoard'
// v2.3222: the per-run ledger and the coverage pill moved to the Robot Board mirror
// (one row per human bid, earlier runs folded behind the newest); this lens keeps the
// axis cards — the program's Gate-B health — and the pills the mirror doesn't carry.
import { shadowCoverage, type ShadowCoverageBid } from '../../lib/bids/shadowCoverage'

// twin_run_scores predates the generated types (BidsAuditsTab pattern).
const boardDb = supabase as unknown as SupabaseClient

type BidsRobotScoreboardTabProps = {
  /** Pending audit count from the page's audit gate — the program bottleneck pill. */
  auditPending?: number
  /**
   * The page's (human) bids — feeds the shadow-coverage pill (v2.2943,
   * LEARNING_PLAN item 8): live shadow-eligible bids vs those already
   * shadowed. Omit and the pill stays hidden.
   */
  bids?: readonly ShadowCoverageBid[]
}

const chipColors: Record<AxisCard['chip']['tone'], { color: string; bg: string }> = {
  met: { color: 'var(--text-green-700)', bg: 'var(--bg-green-tint)' },
  progress: { color: 'var(--text-link)', bg: 'var(--bg-blue-tint)' },
  blocked: { color: 'var(--text-amber-800)', bg: 'var(--bg-amber-tint)' },
  awaiting: { color: 'var(--text-muted)', bg: 'var(--bg-muted)' },
}

function Slot({ slot }: { slot: GateSlot }) {
  const bg = slot.state === 'in' ? '#16a34a' : slot.state === 'out' ? '#dc2626' : 'var(--bg-muted)'
  return (
    <div
      title={slot.title}
      style={{
        flex: 1,
        height: 26,
        borderRadius: 5,
        background: bg,
        border: slot.state === 'pending' ? '1.5px dashed var(--border-strong)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.66rem',
        fontWeight: 700,
        color: slot.state === 'pending' ? 'var(--text-faint)' : 'white',
        fontVariantNumeric: 'tabular-nums',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      {slot.label}
    </div>
  )
}

/**
 * The twin confidence scoreboard (v2.2560, dev only): per-axis Gate-B cards
 * (5-slot bar — scored runs as green/red deltas, in-flight shadows as dashed
 * pending slots) and the pipeline pills. The per-run ledger lives on the Robot
 * Board mirror since v2.3222.
 */
export function BidsRobotScoreboardTab({ auditPending, bids }: BidsRobotScoreboardTabProps) {
  const [scores, setScores] = useState<RunScoreRow[] | null>(null)
  const [shadows, setShadows] = useState<ShadowRunRow[] | null>(null)
  const [holdoutRefs, setHoldoutRefs] = useState<ReadonlySet<string>>(() => new Set())
  // Calibration standards (v2.3099): users.calibration_standard ids. undefined
  // = not loaded / column absent → backtests gate on gate_eligible alone.
  const [standardIds, setStandardIds] = useState<ReadonlySet<string> | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [scoreRes, shadowRes, holdoutRes, standardRes] = await Promise.all([
        boardDb.from('twin_run_scores').select('*').order('scored_at', { ascending: false }),
        boardDb.rpc('list_shadow_runs'),
        // bids.holdout (v2.2942) — a missing column (client ahead of the
        // migration) reads as "no holdout designated yet", never an error.
        boardDb.from('bids').select('bid_number').eq('holdout', true),
        boardDb.from('users').select('id').eq('calibration_standard', true),
      ])
      if (cancelled) return
      if (scoreRes.error) setLoadError(scoreRes.error.message)
      else setScores((scoreRes.data ?? []) as RunScoreRow[])
      if (shadowRes.error) setLoadError((prev) => prev ?? shadowRes.error.message)
      else setShadows((shadowRes.data ?? []) as ShadowRunRow[])
      const holdoutNums = ((holdoutRes.data ?? []) as Array<{ bid_number: number | string | null }>)
        .map((b) => normalizeBidNumber(b.bid_number))
        .filter((n): n is string => n != null)
      setHoldoutRefs(new Set(holdoutNums))
      if (!standardRes.error) setStandardIds(new Set(((standardRes.data ?? []) as Array<{ id: string }>).map((u) => u.id)))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const cards = useMemo(
    () => buildAxisCards(scores ?? [], shadows ?? [], { holdoutReferenceNumbers: holdoutRefs, standardTeacherIds: standardIds }),
    [scores, shadows, holdoutRefs, standardIds],
  )
  const ledger = useMemo(() => buildLedger(scores ?? [], shadows ?? [], { standardTeacherIds: standardIds }), [scores, shadows, standardIds])
  const gatedAxes = cards.filter((c) => c.chip.tone === 'met').length
  const lockedShadows = (shadows ?? []).filter((r) => r.status === 'locked' || r.status === 'open').length
  // Coverage pill (v2.2943, item 8): every uncovered live bid is a free future
  // grade-A reference — shadows cost the estimator zero minutes.
  const coverage = useMemo(
    () => (bids ? shadowCoverage(bids, (shadows ?? []).map((r) => r.reference_bid_number)) : null),
    [bids, shadows],
  )

  if (loadError) {
    return <div style={{ color: 'var(--text-red-700)', padding: '1rem 0' }}>Scoreboard failed to load: {loadError}</div>
  }
  if (scores === null || shadows === null) {
    return <div style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>Loading scoreboard…</div>
  }

  return (
    <div>
      <p style={{ margin: '0 0 0.9rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
        <b style={{ color: 'var(--text-strong)' }}>Phase 1 · Shadow.</b> Gate B (5 consecutive runs within
        ±8%, per axis): <b style={{ color: 'var(--text-strong)' }}>{gatedAxes} of {cards.length} axes ready</b>.
        Green fills the bar; dashed slots are runs in flight.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1.1rem' }}>
        {typeof auditPending === 'number' && (
          <div
            style={{
              background: auditPending > 0 ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)',
              border: `1px solid ${auditPending > 0 ? 'var(--text-amber-800)' : 'var(--border)'}`,
              borderRadius: 10,
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            <b style={{ display: 'block', fontSize: '1.05rem', color: auditPending > 0 ? 'var(--text-amber-800)' : 'var(--text-strong)' }}>
              {auditPending}
            </b>
            audits pending
          </div>
        )}
        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.45rem 0.85rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <b style={{ display: 'block', fontSize: '1.05rem', color: 'var(--text-strong)' }}>{lockedShadows}</b>
          shadows awaiting score
        </div>
        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.45rem 0.85rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <b style={{ display: 'block', fontSize: '1.05rem', color: 'var(--text-strong)' }}>{ledger.filter((r) => r.gate === 'eligible').length}</b>
          scored runs on record
        </div>
        {/* "Plans readable by robots" (v2.3080): live bids the Drive intake service
            account cannot read are invisible to the shadow program until a human
            repairs the link — say which ones, and why. */}
        {coverage && coverage.unreadable.length > 0 && (
          <div
            title={`The intake service account cannot read the plans on these live bids, so no shadow can open on them. Share the file with the service account, or link the PDF itself.\n${coverage.unreadable.map((u) => `${u.bid}: ${u.why ?? 'unreadable'}`).join('\n')}`}
            style={{ background: 'var(--bg-amber-tint)', border: '1px solid var(--text-amber-800)', borderRadius: 10, padding: '0.45rem 0.85rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}
          >
            <b style={{ display: 'block', fontSize: '1.05rem', color: 'var(--text-amber-800)' }}>
              {coverage.unreadable.length}
            </b>
            plans unreadable by robots · {coverage.unreadable.map((u) => u.bid).join(', ')}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.8rem', marginBottom: '1.3rem' }}>
        {cards.map((card) => {
          const tone = chipColors[card.chip.tone]
          return (
            <div key={card.axis} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 0.95rem 0.7rem', background: 'var(--bg-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.55rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-strong)' }}>{card.axis}</span>
                <span style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.04em', borderRadius: 999, padding: '1px 9px', color: tone.color, background: tone.bg, whiteSpace: 'nowrap' }}>
                  {card.chip.text}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 5, marginBottom: '0.45rem' }}>
                {card.slots.map((slot, i) => <Slot key={i} slot={slot} />)}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border)', paddingTop: '0.45rem' }}>
                {card.nextLine}
              </div>
              {/* Holdout awareness (v2.2942): a streak built only on practiced
                  references can overstate readiness — say so, mutedly. The gate
                  math itself is unchanged; holdout-only denominators are a
                  future owner decision. */}
              {card.scoredCount > 0 ? (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-faint, var(--text-muted))', paddingTop: '0.3rem' }}>
                  {card.streakHoldoutRuns === 0
                    ? 'no holdout evidence yet'
                    : `${card.streakHoldoutRuns} of streak on holdout refs · ${card.holdoutRuns} holdout / ${card.practiceRuns} practice runs`}
                </div>
              ) : null}
            </div>
          )
        })}
        {cards.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No runs recorded yet.</div>
        )}
      </div>

    </div>
  )
}
