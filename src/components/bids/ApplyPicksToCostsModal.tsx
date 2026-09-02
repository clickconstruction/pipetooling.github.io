/**
 * Apply picks to bid costs (Rung G, v2.2655 — owner-approved option (a);
 * docs/APPLY_PICKS_TO_COSTS_DECISION.md, canvas artboard 10). The picked
 * quote lines become per-row MATERIALS overrides (labor untouched; taxed
 * like takeoff materials): per-line picks map 1:1; lots allocate their one
 * total across member rows proportional to takeoff materials (fallback:
 * per-unit), shown as an editable split with a running remainder before
 * anything writes. Every write carries provenance; lot rows share a
 * lot_group_id so revert reverts the whole package.
 */
import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'

const MODAL_Z = 10060

export type ApplyPickItem =
  | { kind: 'line'; fixture: string; houseName: string; unitCents: number; quoteLineId: string | null }
  | { kind: 'lot'; lotId: string; houseName: string; totalCents: number; fixtures: string[] }

type PlanRow = {
  countRowId: string
  fixture: string
  count: number
  beforeUnitCents: number | null
  afterUnitCents: number
  houseName: string
  lotGroupId: string | null
  quoteLineId: string | null
}

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function ApplyPicksToCostsModal({
  open,
  onClose,
  onApplied,
  bidId,
  items,
  countRows,
  takeoffMaterialsByCountRowId,
  taxPercent,
  currentTotals,
}: {
  open: boolean
  onClose: () => void
  onApplied: () => void
  bidId: string
  items: ApplyPickItem[]
  countRows: Array<{ id: string; fixture: string; count: number }>
  /** count_row_id → takeoff materials TOTAL $ for the row (pre-tax) — the allocation weights. */
  takeoffMaterialsByCountRowId: Record<string, number>
  taxPercent: number
  /** For the honest before/after margin line; null when the workbench can't total. */
  currentTotals: { totalRevenue: number; totalCost: number } | null
}) {
  const { showToast } = useToastContext()
  const [applying, setApplying] = useState(false)
  /** Lot allocations, editable: lotId → fixtureKey → unit cents. */
  const [lotEdits, setLotEdits] = useState<Record<string, Record<string, string>>>({})

  const rowByFixture = useMemo(() => {
    const m = new Map<string, { id: string; fixture: string; count: number }>()
    for (const r of countRows) {
      const k = r.fixture.trim().toLowerCase()
      if (!m.has(k) && Number.isFinite(r.count) && r.count > 0) m.set(k, r)
    }
    return m
  }, [countRows])

  useEffect(() => {
    if (!open) return
    setLotEdits({})
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  /** Default lot split: proportional to takeoff materials, fallback per-unit. */
  function defaultLotSplit(item: Extract<ApplyPickItem, { kind: 'lot' }>): Record<string, number> {
    const members = item.fixtures
      .map((f) => rowByFixture.get(f.trim().toLowerCase()))
      .filter((r): r is NonNullable<typeof r> => r != null)
    if (members.length === 0) return {}
    const weights = members.map((r) => {
      const mat = takeoffMaterialsByCountRowId[r.id]
      return mat != null && mat > 0 ? mat : null
    })
    const allWeighted = weights.every((w) => w != null)
    const totalWeight = allWeighted
      ? (weights as number[]).reduce((s, w) => s + w, 0)
      : members.reduce((s, r) => s + r.count, 0)
    const out: Record<string, number> = {}
    let allocated = 0
    members.forEach((r, i) => {
      const w = allWeighted ? (weights[i] as number) : r.count
      const share = totalWeight > 0 ? item.totalCents * (w / totalWeight) : item.totalCents / members.length
      const unit = Math.round(share / r.count)
      out[r.fixture.trim().toLowerCase()] = unit
      allocated += unit * r.count
    })
    // Push rounding remainder onto the largest member so the lot total holds.
    const largest = members.reduce((a, b) => (a.count >= b.count ? a : b))
    const k = largest.fixture.trim().toLowerCase()
    out[k] = (out[k] ?? 0) + Math.round((item.totalCents - allocated) / largest.count)
    return out
  }

  const plan = useMemo<{ rows: PlanRow[]; unmatched: string[]; lotRemainders: Array<{ lotId: string; houseName: string; remainderCents: number }> }>(() => {
    const rows: PlanRow[] = []
    const unmatched: string[] = []
    const lotRemainders: Array<{ lotId: string; houseName: string; remainderCents: number }> = []
    for (const item of items) {
      if (item.kind === 'line') {
        const r = rowByFixture.get(item.fixture.trim().toLowerCase())
        if (!r) {
          unmatched.push(item.fixture)
          continue
        }
        const takeoff = takeoffMaterialsByCountRowId[r.id]
        rows.push({
          countRowId: r.id,
          fixture: r.fixture,
          count: r.count,
          beforeUnitCents: takeoff != null && r.count > 0 ? Math.round((takeoff / r.count) * 100) : null,
          afterUnitCents: item.unitCents,
          houseName: item.houseName,
          lotGroupId: null,
          quoteLineId: item.quoteLineId,
        })
      } else {
        const defaults = defaultLotSplit(item)
        let allocated = 0
        for (const f of item.fixtures) {
          const key = f.trim().toLowerCase()
          const r = rowByFixture.get(key)
          if (!r) {
            unmatched.push(f)
            continue
          }
          const edited = lotEdits[item.lotId]?.[key]
          const unit = edited != null && edited.trim() !== '' ? Math.round(Number(edited.replace(/[$,\s]/g, '')) * 100) : (defaults[key] ?? 0)
          const takeoff = takeoffMaterialsByCountRowId[r.id]
          rows.push({
            countRowId: r.id,
            fixture: r.fixture,
            count: r.count,
            beforeUnitCents: takeoff != null && r.count > 0 ? Math.round((takeoff / r.count) * 100) : null,
            afterUnitCents: Number.isFinite(unit) && unit >= 0 ? unit : 0,
            houseName: item.houseName,
            lotGroupId: item.lotId,
            quoteLineId: null,
          })
          allocated += (Number.isFinite(unit) && unit >= 0 ? unit : 0) * r.count
        }
        lotRemainders.push({ lotId: item.lotId, houseName: item.houseName, remainderCents: item.totalCents - allocated })
      }
    }
    return { rows, unmatched, lotRemainders }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- defaultLotSplit reads rowByFixture/takeoff (stable per open)
  }, [items, rowByFixture, takeoffMaterialsByCountRowId, lotEdits])

  const marginPreview = useMemo(() => {
    if (!currentTotals || currentTotals.totalRevenue <= 0) return null
    let delta = 0
    for (const r of plan.rows) {
      const beforeMat = (takeoffMaterialsByCountRowId[r.countRowId] ?? 0) * (1 + taxPercent / 100)
      const afterMat = ((r.afterUnitCents * r.count) / 100) * (1 + taxPercent / 100)
      delta += afterMat - beforeMat
    }
    const afterCost = currentTotals.totalCost + delta
    return {
      before: ((currentTotals.totalRevenue - currentTotals.totalCost) / currentTotals.totalRevenue) * 100,
      after: ((currentTotals.totalRevenue - afterCost) / currentTotals.totalRevenue) * 100,
      deltaDollars: delta,
    }
  }, [plan.rows, currentTotals, takeoffMaterialsByCountRowId, taxPercent])

  const remaindersOff = plan.lotRemainders.filter((l) => Math.abs(l.remainderCents) > plan.rows.length * 100)

  async function apply() {
    if (plan.rows.length === 0) return
    setApplying(true)
    try {
      const writes = plan.rows.map((r) => ({
        bid_id: bidId,
        count_row_id: r.countRowId,
        unit_materials_cents: r.afterUnitCents,
        source: 'quoted',
        quote_line_id: r.quoteLineId,
        lot_group_id: r.lotGroupId,
        house_name: r.houseName,
      }))
      const { error } = await supabase.from('bid_count_row_custom_costs').upsert(writes, { onConflict: 'bid_id,count_row_id' })
      if (error) throw error
      showToast(`Applied ${plan.rows.length} quoted cost${plan.rows.length === 1 ? '' : 's'} — the workbench rows are tagged, revert any time.`, 'success')
      onApplied()
      onClose()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not apply the costs.', 'error')
    } finally {
      setApplying(false)
    }
  }

  if (!open || typeof document === 'undefined') return null

  const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
  const mono: CSSProperties = { fontFamily: 'ui-monospace, Menlo, monospace', fontVariantNumeric: 'tabular-nums' }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: MODAL_Z, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1.5rem 1rem', overflowY: 'auto' }} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label="Apply picks to costs" style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 780, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', padding: '1.1rem 1.25rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }} onMouseDown={(e) => e.stopPropagation()}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}>Apply picks to costs</h2>
          <p style={{ margin: '0.15rem 0 0', ...smallMuted }}>
            Quoted prices replace each row's <strong>materials</strong> only — labor is untouched, tax applies like takeoff materials, and every row gets a revert tag.
          </p>
        </div>

        {plan.unmatched.length > 0 ? (
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-amber-700)' }}>
            No matching count row for: {plan.unmatched.join(', ')} — those picks are skipped.
          </p>
        ) : null}

        <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) 3.5rem 6rem 6.5rem minmax(0,1fr)', gap: '0.5rem', padding: '0.3rem 0.6rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            <span>Row</span><span>Qty</span><span style={{ textAlign: 'right' }}>Takeoff /u</span><span style={{ textAlign: 'right' }}>Quoted /u</span><span>From</span>
          </div>
          <div style={{ maxHeight: '44vh', overflowY: 'auto' }}>
            {plan.rows.map((r) => (
              <div key={r.countRowId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) 3.5rem 6rem 6.5rem minmax(0,1fr)', gap: '0.5rem', padding: '0.32rem 0.6rem', borderBottom: '1px solid var(--bg-muted)', alignItems: 'center', fontSize: '0.8125rem' }}>
                <span style={{ ...mono, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{r.fixture}</span>
                <span style={{ ...smallMuted, ...mono }}>{r.count}</span>
                <span style={{ ...smallMuted, ...mono, textAlign: 'right' }}>{r.beforeUnitCents != null ? money(r.beforeUnitCents) : '—'}</span>
                {r.lotGroupId ? (
                  <input
                    value={lotEdits[r.lotGroupId]?.[r.fixture.trim().toLowerCase()] ?? (r.afterUnitCents / 100).toFixed(2)}
                    onChange={(e) =>
                      setLotEdits((m) => ({
                        ...m,
                        [r.lotGroupId!]: { ...m[r.lotGroupId!], [r.fixture.trim().toLowerCase()]: e.target.value },
                      }))
                    }
                    aria-label={`Allocated unit materials for ${r.fixture}`}
                    style={{ ...mono, textAlign: 'right', padding: '0.2rem 0.4rem', border: '1px solid #f59e0b', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)' }}
                  />
                ) : (
                  <span style={{ ...mono, textAlign: 'right', color: '#15803d', fontWeight: 700 }}>{money(r.afterUnitCents)}</span>
                )}
                <span style={smallMuted}>{r.houseName}{r.lotGroupId ? ' · package' : ''}</span>
              </div>
            ))}
          </div>
        </div>

        {plan.lotRemainders.map((l) => (
          <p key={l.lotId} style={{ margin: 0, fontSize: '0.78rem', color: Math.abs(l.remainderCents) <= plan.rows.length * 100 ? 'var(--text-muted)' : 'var(--text-amber-700)' }}>
            {l.houseName} package remainder: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(l.remainderCents)}</strong>
            {Math.abs(l.remainderCents) <= plan.rows.length * 100 ? ' ✓ (rounding)' : ' — adjust the split so the package total holds'}
          </p>
        ))}

        {marginPreview ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-strong)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.45rem 0.7rem', background: 'var(--bg-subtle)' }}>
            Margin {marginPreview.before.toFixed(1)}% → <strong style={{ color: marginPreview.after >= marginPreview.before ? '#15803d' : 'var(--text-amber-700)' }}>{marginPreview.after.toFixed(1)}%</strong>
            {' · '}materials {marginPreview.deltaDollars <= 0 ? 'down' : 'up'} ${Math.abs(marginPreview.deltaDollars).toLocaleString('en-US', { maximumFractionDigits: 0 })} across {plan.rows.length} row{plan.rows.length === 1 ? '' : 's'}
          </p>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
          <button type="button" onClick={onClose} style={{ padding: '0.5rem 0.9rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}>Cancel</button>
          <button
            type="button"
            disabled={applying || plan.rows.length === 0 || remaindersOff.length > 0}
            onClick={() => void apply()}
            style={{ padding: '0.5rem 1.1rem', background: plan.rows.length === 0 || remaindersOff.length > 0 ? 'var(--bg-200)' : '#16a34a', color: plan.rows.length === 0 || remaindersOff.length > 0 ? 'var(--text-faint)' : 'white', border: 'none', borderRadius: 4, cursor: applying || plan.rows.length === 0 || remaindersOff.length > 0 ? 'not-allowed' : 'pointer', font: 'inherit', fontWeight: 600 }}
          >
            {applying ? 'Applying…' : `Apply to ${plan.rows.length} row${plan.rows.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
