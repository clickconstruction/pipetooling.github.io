import { useEffect, useState, type CSSProperties } from 'react'
import { formatCurrency } from '../../lib/format'
import { STAGE_COLORS, STAGE_KEYS, STAGE_LABELS, STAGE_NUMBER, type MaterialsByStageSummary } from '../../lib/bids/materialsByStage'

/**
 * Materials by stage (v2.3672): the Stages panel in the Takeoffs rail — raw
 * material per stage → × the factor, the shares, how many fixtures are staged,
 * the factor field (company default or this bid's own), "Fill from rules" with
 * the sentence saying what it did, and the door to the printed schedule.
 */

const kv: CSSProperties = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, fontSize: '0.85rem' }
const muted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const num: CSSProperties = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const mini = (primary: boolean, disabled = false): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  height: 28,
  padding: '0 0.75rem',
  borderRadius: 6,
  fontSize: '0.8rem',
  fontWeight: 600,
  border: primary ? '1px solid #2563eb' : '1px solid var(--border)',
  background: disabled ? '#9ca3af' : primary ? '#2563eb' : 'var(--surface)',
  color: primary || disabled ? '#fff' : 'var(--text-strong)',
  cursor: disabled ? 'default' : 'pointer',
})

export type TakeoffStagesPanelProps = {
  summary: MaterialsByStageSummary
  /** The company default (app_settings). */
  factorDefault: number
  /** This bid's override, when one is stored. */
  factorOverride: number | null
  onFactorChange: (next: number | null) => Promise<void>
  onFillByRules: () => Promise<void>
  /** The sentence from the last rule pass, until something else changes. */
  fillNote: string | null
  /** The printed schedule (PR 3); absent = no button. */
  onPrint?: (() => void) | null
  /** The bid's priced amount when known — the panel says what share of it the schedule covers. */
  bidAmount?: number | null
  /** How many rows have no cost at all (the rail's "no cost" count) — they are not the schedule's problem. */
  noCostCount?: number
}

export function TakeoffStagesPanel({ summary, factorDefault, factorOverride, onFactorChange, onFillByRules, fillNote, onPrint = null, bidAmount = null, noCostCount = 0 }: TakeoffStagesPanelProps) {
  const [factorDraft, setFactorDraft] = useState<string>('')
  const [editingFactor, setEditingFactor] = useState(false)
  const [filling, setFilling] = useState(false)
  useEffect(() => {
    if (!editingFactor) setFactorDraft(String(summary.factor))
  }, [summary.factor, editingFactor])
  const commitFactor = async () => {
    setEditingFactor(false)
    const n = Number(factorDraft.replace(/,/g, '').trim())
    if (!Number.isFinite(n) || n < 1 || n > 5) {
      setFactorDraft(String(summary.factor))
      return
    }
    // Typing the company number back clears the override.
    await onFactorChange(Math.abs(n - factorDefault) < 1e-9 ? null : n)
  }
  const staged = summary.stagedFixtureCount
  const costed = summary.costedFixtureCount
  const nothingStaged = summary.assignedRaw <= 0
  const pct = bidAmount && bidAmount > 0 ? Math.round((100 * summary.totalScaled) / bidAmount) : null

  return (
    <div data-testid="takeoff-stages-panel" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {STAGE_KEYS.map((k) => (
        <div key={k} style={kv}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <i aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 2, background: STAGE_COLORS[k], display: 'inline-block' }} />
            {STAGE_NUMBER[k]} {STAGE_LABELS[k]}
          </span>
          <span style={num}>
            <span style={{ ...muted, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(summary.byStage[k])} → </span>
            <span style={{ fontWeight: 700 }} data-testid={`stage-scaled-${k}`}>${formatCurrency(summary.scaled[k])}</span>
          </span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid var(--border)', margin: '2px 0' }} />
      <div style={kv}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span>Factor ×</span>
          <input
            id="takeoff-sov-factor"
            value={factorDraft}
            onFocus={() => setEditingFactor(true)}
            onChange={(e) => setFactorDraft(e.target.value)}
            onBlur={() => void commitFactor()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              } else if (e.key === 'Escape') {
                setFactorDraft(String(summary.factor))
                setEditingFactor(false)
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            inputMode="decimal"
            aria-label="Schedule of values material factor"
            title={factorOverride != null ? `This bid's own factor; the company default is ${factorDefault}` : `The company default (Settings → Bid cover letter). Type another number for this bid only.`}
            style={{ width: 54, padding: '2px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, border: `1px solid ${factorOverride != null ? 'var(--text-amber-700)' : 'var(--border-strong)'}`, borderRadius: 4, background: 'var(--surface)', color: 'inherit', fontSize: '0.8rem' }}
          />
          <span style={muted}>{factorOverride != null ? 'this bid' : 'company default'}</span>
        </span>
        <span style={{ ...num, fontWeight: 700, fontSize: '1rem' }} data-testid="stage-scaled-total">${formatCurrency(summary.totalScaled)}</span>
      </div>
      <span style={muted}>
        {costed === 0
          ? 'No costed fixtures yet.'
          : nothingStaged
            ? `${costed} costed fixture${costed === 1 ? '' : 's'}, none staged yet — press Fill from rules & book, or click the boxes under each fixture.`
            : `${staged} of ${costed} costed fixture${costed === 1 ? '' : 's'} staged${summary.incompleteFixtureIds.length > 0 ? ` · ${summary.incompleteFixtureIds.length} still need${summary.incompleteFixtureIds.length === 1 ? 's' : ''} a stage ($${formatCurrency(summary.unassignedRaw)})` : ''}${summary.ownSplitCount > 0 ? ` · ${summary.ownSplitCount} line${summary.ownSplitCount === 1 ? '' : 's'} with ${summary.ownSplitCount === 1 ? 'its' : 'their'} own` : ''}`}
        {noCostCount > 0 ? ` · ${noCostCount} with no cost` : ''}
      </span>
      {!nothingStaged ? (
        <span style={muted}>
          Shares {Math.round(summary.sharesPct.rough_in)} · {Math.round(summary.sharesPct.top_out)} · {Math.round(summary.sharesPct.trim_set)} %
          {pct != null ? ` · ${pct}% of the $${formatCurrency(bidAmount ?? 0)} bid` : ''}
        </span>
      ) : null}
      {fillNote ? (
        <div data-testid="stage-fill-note" style={{ padding: '0.4rem 0.6rem', borderRadius: 6, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-700)', fontSize: '0.75rem' }}>
          {fillNote}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
        <button
          type="button"
          disabled={filling || costed === 0}
          onClick={async () => {
            setFilling(true)
            try {
              await onFillByRules()
            } finally {
              setFilling(false)
            }
          }}
          title="What the book remembers for a fixture first; else waste pipe ½ Rough In · ½ Top Out; water, gas and vent → Top Out; drains, cleanouts, interceptors → Rough In; valves and arrestors → Top Out; set fixtures → Trim Set. Stages you set by hand are kept."
          style={mini(false, filling || costed === 0)}
        >
          {filling ? 'Filling…' : 'Fill from rules & book'}
        </button>
        {onPrint ? (
          <button type="button" disabled={nothingStaged} onClick={onPrint} style={mini(true, nothingStaged)} title="Print the schedule of values — stage material × the factor, with the fixtures under each stage">
            Print schedule of values
          </button>
        ) : null}
      </div>
    </div>
  )
}
