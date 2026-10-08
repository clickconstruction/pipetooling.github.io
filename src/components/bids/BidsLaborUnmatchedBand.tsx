import { useState } from 'react'
import { unmatchedHoursWords } from '../../lib/bids/laborSyncPlan'
import type { CostEstimateLaborRow, CostEstimateUnmatchedLaborRow } from '../../lib/bids/bidPricingEngineTypes'

/**
 * The Labor tab's band of set-aside hours (bid history PR 0b, punch list #73). The load sync used
 * to delete a labor row whose fixture no count row carried, so a version switch, a renamed fixture
 * or a fixture removed and counted again lost typed hours. Now such a row is set aside
 * (`cost_estimate_labor_rows_unmatched`), out of every total, and listed here: Use for <fixture>
 * puts its hours on a counted row, Remove lets it go. Counting its fixture again brings it back
 * by itself. Draws nothing when nothing is set aside.
 */
export function BidsLaborUnmatchedBand({
  rows,
  laborRows,
  onUse,
  onRemove,
}: {
  rows: ReadonlyArray<CostEstimateUnmatchedLaborRow>
  /** The counted rows a set-aside row's hours can go to. */
  laborRows: ReadonlyArray<Pick<CostEstimateLaborRow, 'id' | 'fixture'>>
  onUse: (parkedId: string, laborRowId: string) => Promise<boolean>
  onRemove: (parkedId: string) => Promise<boolean>
}) {
  const [target, setTarget] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  if (rows.length === 0) return null

  async function run(parkedId: string, act: () => Promise<boolean>) {
    setBusy(parkedId)
    try {
      await act()
    } finally {
      setBusy(null)
    }
  }

  return (
    <section
      aria-label="Hours not on the counts"
      style={{ marginTop: '0.75rem', padding: '0.75rem 0.9rem', border: '1px dashed var(--border-strong)', borderRadius: 8, background: 'var(--surface)' }}
    >
      <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.9375rem' }}>Hours not on the counts</h4>
      <p style={{ margin: '0 0 0.6rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
        These fixtures are not counted on this version. Their hours are kept here and left out of every total. Count a fixture again and its hours come back on their own.
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {rows.map((r) => {
          const pick = laborRows.find((l) => l.id === target[r.id])
          const setAside = new Date(r.parked_at)
          return (
            <li key={r.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.75rem' }}>
              <div style={{ flex: '1 1 14rem', minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{r.fixture || 'No name'}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  {unmatchedHoursWords(r)}
                  {Number.isNaN(setAside.getTime()) ? null : ` · Set aside ${setAside.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </div>
              </div>
              <select
                aria-label={`Use the hours of ${r.fixture || 'this row'} for a counted fixture`}
                value={target[r.id] ?? ''}
                onChange={(e) => setTarget((prev) => ({ ...prev, [r.id]: e.target.value }))}
                disabled={busy === r.id || laborRows.length === 0}
                style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, minHeight: 36, maxWidth: '100%' }}
              >
                <option value="">Use for…</option>
                {laborRows.map((l) => (
                  <option key={l.id} value={l.id}>{l.fixture || 'No name'}</option>
                ))}
              </select>
              {pick ? (
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => void run(r.id, async () => {
                    const ok = await onUse(r.id, pick.id)
                    if (ok) setTarget((prev) => ({ ...prev, [r.id]: '' }))
                    return ok
                  })}
                  style={{ padding: '0.35rem 0.75rem', minHeight: 36, background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Use for {pick.fixture || 'No name'}
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => void run(r.id, () => onRemove(r.id))}
                style={{ padding: '0.35rem 0.75rem', minHeight: 36, background: 'transparent', color: 'var(--text-base)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Remove
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
