import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { ShadowRunRow } from '../../lib/bids/shadowStory'
import {
  buildAxisCards,
  buildLedger,
  type AxisCard,
  type GateSlot,
  type RunScoreRow,
} from '../../lib/bids/confidenceBoard'

// twin_run_scores predates the generated types (BidsAuditsTab pattern).
const boardDb = supabase as unknown as SupabaseClient

type BidsRobotScoreboardTabProps = {
  /** Pending audit count from the page's audit gate — the program bottleneck pill. */
  auditPending?: number
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

const money = (v: number | null) =>
  v == null ? '—' : `$${Math.round(v).toLocaleString()}`

/**
 * The twin confidence scoreboard (v2.2560, dev only): per-axis Gate-B cards
 * (5-slot bar — scored runs as green/red deltas, in-flight shadows as dashed
 * pending slots), the pipeline pills, and the unified run ledger with void
 * runs shown struck-through rather than hidden.
 */
export function BidsRobotScoreboardTab({ auditPending }: BidsRobotScoreboardTabProps) {
  const [scores, setScores] = useState<RunScoreRow[] | null>(null)
  const [shadows, setShadows] = useState<ShadowRunRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [scoreRes, shadowRes] = await Promise.all([
        boardDb.from('twin_run_scores').select('*').order('scored_at', { ascending: false }),
        boardDb.rpc('list_shadow_runs'),
      ])
      if (cancelled) return
      if (scoreRes.error) setLoadError(scoreRes.error.message)
      else setScores((scoreRes.data ?? []) as RunScoreRow[])
      if (shadowRes.error) setLoadError((prev) => prev ?? shadowRes.error.message)
      else setShadows((shadowRes.data ?? []) as ShadowRunRow[])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const cards = useMemo(() => buildAxisCards(scores ?? [], shadows ?? []), [scores, shadows])
  const ledger = useMemo(() => buildLedger(scores ?? [], shadows ?? []), [scores, shadows])
  const gatedAxes = cards.filter((c) => c.chip.tone === 'met').length
  const lockedShadows = (shadows ?? []).filter((r) => r.status === 'locked' || r.status === 'open').length

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
            </div>
          )
        })}
        {cards.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No runs recorded yet.</div>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.84rem' }}>
          <thead>
            <tr>
              {['Run', 'Axis', 'Locked', 'Reference', 'Δ', 'Counts', 'Gate'].map((h) => (
                <th key={h} style={{ textAlign: 'left', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', padding: '0.45rem 0.6rem', borderBottom: '2px solid var(--border)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ledger.map((row) => {
              const voided = row.gate === 'void'
              const cell: React.CSSProperties = {
                padding: '0.45rem 0.6rem',
                borderBottom: '1px solid var(--border)',
                fontVariantNumeric: 'tabular-nums',
                textDecoration: voided ? 'line-through' : undefined,
                color: voided ? 'var(--text-faint)' : undefined,
              }
              const deltaColor =
                row.deltaPct == null ? 'var(--text-faint)' : Math.abs(row.deltaPct) <= 8 ? 'var(--text-green-700)' : 'var(--text-red-700)'
              return (
                <tr key={row.key}>
                  <td style={cell}>
                    <span style={{ fontSize: '0.64rem', fontWeight: 700, borderRadius: 4, padding: '1px 5px', marginRight: 6, color: row.kind === 'backtest' ? 'var(--text-link)' : '#7c3aed', background: row.kind === 'backtest' ? 'var(--bg-blue-tint)' : 'var(--bg-muted)' }}>
                      {row.kind === 'backtest' ? 'BT' : 'SH'}
                    </span>
                    {row.label}{row.project ? ` · ${row.project}` : ''}
                  </td>
                  <td style={cell}>{row.axis}</td>
                  <td style={cell}>{money(row.locked)}</td>
                  <td style={cell}>{money(row.reference)}</td>
                  <td style={{ ...cell, color: voided ? 'var(--text-faint)' : deltaColor, fontWeight: 600 }}>
                    {row.deltaPct == null ? '—' : `${row.deltaPct > 0 ? '+' : ''}${row.deltaPct.toFixed(1)}%`}
                  </td>
                  <td style={{ ...cell, fontSize: '0.76rem', color: 'var(--text-muted)' }}>{row.countsNote}</td>
                  <td style={{ ...cell, fontSize: '0.76rem', color: voided ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
                    {row.gate === 'void' ? 'VOID' : row.gate}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
