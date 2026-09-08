import { useEffect, useId, useState, type CSSProperties } from 'react'
import { MoneyDecimalAmountInput } from '../MoneyDecimalAmountInput'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { moveRowById } from '../../lib/jobs/jobFormReorder'
import type { StageKind } from '../../lib/jobs/stagePlan'
import {
  CHANGE_ORDER_ROW,
  SEGMENT_GENERATOR_PRESETS,
  isOrderRow,
  segmentGeneratorAllocatedPct,
  segmentGeneratorDollarsByRowId,
  segmentGeneratorPayload,
  segmentGeneratorTotals,
  type SegmentGeneratorPayloadLine,
  type SegmentGeneratorRow,
} from '../../lib/jobs/segmentGenerator'
import { StageKindSelector } from './StageKindControls'

type MultipleSegmentGeneratorModalProps = {
  open: boolean
  /** Prefill for the total — the job's current Job Total (editable). */
  initialTotalDollars: number
  zIndex: number
  onCancel: () => void
  /** "Add to Job": append these lines to the existing ① Line Items. */
  onAddToJob: (lines: SegmentGeneratorPayloadLine[]) => void
}

function newRow(over: Partial<Omit<SegmentGeneratorRow, 'id'>> = {}): SegmentGeneratorRow {
  return { id: crypto.randomUUID(), name: '', pct: null, kind: 'order', amount: null, ...over }
}

const ANY_FILL = '#b45309'

/** The small badge at the left of a generator row: its number among Order rows, a diamond, or a dashed circle. */
function GeneratorKindBadge({ kind, number }: { kind: StageKind | null; number: number | null }) {
  const base: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, flexShrink: 0, fontSize: 11, fontWeight: 700, boxSizing: 'border-box' }
  if (kind === 'order') {
    return (
      <span aria-label={number != null ? `Stage ${number}` : 'Stage'} style={{ ...base, borderRadius: '50%', border: '1.5px solid var(--border-strong)', color: 'var(--text-muted)' }}>
        {number ?? ''}
      </span>
    )
  }
  if (kind === 'any') {
    return (
      <span aria-label="Any-time stage" style={base}>
        <span style={{ width: 14, height: 14, transform: 'rotate(45deg)', borderRadius: 2, border: `2px solid ${ANY_FILL}`, boxSizing: 'border-box' }} />
      </span>
    )
  }
  return <span aria-label="Plain line item" style={{ ...base, borderRadius: '50%', border: '1.5px dashed var(--border-strong)' }} />
}

/**
 * The "Multiple Segment Generator" (v2.1071; kinds since the Stage Plan,
 * PR 3): enter a total, split it into named percentage segments (two
 * one-click presets, all in order), add change orders with their own price
 * outside the split, say what kind each row is, re-arrange with ▲▼, and
 * append the result to the job's line items with their kinds. All math in
 * segmentGenerator.ts; this component only holds field state.
 */
export function MultipleSegmentGeneratorModal({
  open,
  initialTotalDollars,
  zIndex,
  onCancel,
  onAddToJob,
}: MultipleSegmentGeneratorModalProps) {
  const titleId = useId()
  const [totalDollars, setTotalDollars] = useState(0)
  const [rows, setRows] = useState<SegmentGeneratorRow[]>([])

  useEffect(() => {
    if (!open) return
    setTotalDollars(initialTotalDollars > 0 ? initialTotalDollars : 0)
    setRows([newRow(), newRow()])
  }, [open, initialTotalDollars])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const dollarsByRowId = segmentGeneratorDollarsByRowId(totalDollars, rows)
  const allocatedPct = segmentGeneratorAllocatedPct(rows)
  const totals = segmentGeneratorTotals(totalDollars, rows)
  const payload = segmentGeneratorPayload(totalDollars, rows)
  const hasOrderRows = rows.some(isOrderRow)
  const allocationOff = hasOrderRows && Math.abs(allocatedPct - 100) > 0.001

  function applyPreset(presetKey: string) {
    const preset = SEGMENT_GENERATOR_PRESETS.find((p) => p.key === presetKey)
    if (!preset) return
    // The preset replaces the split; change orders and plain lines already typed stay below it.
    setRows((prev) => [...preset.rows.map((r) => newRow({ name: r.name, pct: r.pct, kind: r.kind })), ...prev.filter((r) => !isOrderRow(r) && (r.name.trim() || r.amount))])
  }

  function addChangeOrder() {
    setRows((prev) => [...prev.filter((r) => isOrderRow(r) || r.name.trim() || r.amount || r.pct != null), newRow(CHANGE_ORDER_ROW)])
  }

  function updateRow(id: string, updates: Partial<SegmentGeneratorRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)))
  }

  function setKind(id: string, kind: StageKind | null) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        // Leaving the split: the row keeps its current dollars as its own amount. Joining it: the amount clears.
        if (kind === 'order') return { ...r, kind, amount: null }
        return { ...r, kind, pct: null, amount: r.kind === 'order' ? (dollarsByRowId[r.id] ?? 0) || null : r.amount }
      }),
    )
  }

  let orderNumber = 0
  const chipStyle: CSSProperties = {
    padding: '0.3rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    background: 'var(--bg-subtle)',
    color: 'var(--text-700)',
    border: '1px solid var(--border)',
    borderRadius: 999,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: '0.35rem',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        padding: '1rem',
      }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 640,
          width: '100%',
          maxHeight: 'min(88vh, 760px)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div id={titleId} style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-strong)' }}>
          Multiple Segment Generator
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Set the total, name the segments of work, give each a percentage and say whether it goes <strong>in order</strong> or{' '}
          <strong>any time</strong>. <strong>Add to Job</strong> appends them to the line items with their stage set.
        </div>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-700)' }}>
          Total amount
          <MoneyDecimalAmountInput
            value={totalDollars}
            onChange={setTotalDollars}
            commitOnType
            aria-label="Total amount to split"
            style={{
              width: '8rem',
              padding: '0.375rem 0.5rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              fontSize: '0.875rem',
              textAlign: 'right',
            }}
          />
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {SEGMENT_GENERATOR_PRESETS.map((p) => (
            <button key={p.key} type="button" onClick={() => applyPreset(p.key)} style={chipStyle}>
              {p.label}
              <span style={{ fontSize: '0.6875rem', fontWeight: 400, color: 'var(--text-muted)' }}>{p.hint}</span>
            </button>
          ))}
          <button type="button" onClick={addChangeOrder} style={{ ...chipStyle, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderColor: 'var(--bg-amber-200)' }}>
            + Change order
            <span style={{ fontSize: '0.6875rem', fontWeight: 400, color: 'var(--text-amber-700)' }}>any time · own price</span>
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6rem 1fr 4.6rem 6rem auto', gap: '0.4rem', alignItems: 'center', fontSize: '0.625rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingLeft: '1.6rem' }}>
          <span />
          <span>Segment</span>
          <span style={{ textAlign: 'right' }}>%</span>
          <span style={{ textAlign: 'right' }}>Value</span>
          <span>Stage</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {rows.map((r, idx) => {
            const order = isOrderRow(r)
            const number = order ? ++orderNumber : null
            return (
              <div key={r.id} data-testid={`generator-row-${r.kind ?? 'plain'}`} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setRows((prev) => moveRowById(prev, r.id, 'up'))}
                    disabled={idx === 0}
                    title="Move up"
                    aria-label="Move segment up"
                    style={{ padding: '0 0.15rem', fontSize: '0.625rem', lineHeight: 1.2, background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1 }}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => setRows((prev) => moveRowById(prev, r.id, 'down'))}
                    disabled={idx === rows.length - 1}
                    title="Move down"
                    aria-label="Move segment down"
                    style={{ padding: '0 0.15rem', fontSize: '0.625rem', lineHeight: 1.2, background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: idx === rows.length - 1 ? 'default' : 'pointer', opacity: idx === rows.length - 1 ? 0.3 : 1 }}
                  >
                    ▼
                  </button>
                </div>
                <GeneratorKindBadge kind={r.kind} number={number} />
                <input
                  type="text"
                  value={r.name}
                  onChange={(e) => updateRow(r.id, { name: e.target.value })}
                  placeholder={order ? 'Segment of work' : r.kind === 'any' ? 'Change order' : 'Plain line'}
                  aria-label="Segment name"
                  style={{ flex: 1, minWidth: 0, padding: '0.375rem 0.625rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem' }}
                />
                {order ? (
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={r.pct ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === '') {
                        updateRow(r.id, { pct: null })
                        return
                      }
                      const n = Number(raw)
                      updateRow(r.id, { pct: Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null })
                    }}
                    aria-label="Segment percentage"
                    style={{ width: '3.4rem', padding: '0.375rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem', textAlign: 'right' }}
                  />
                ) : (
                  <span aria-label="Not a share of the total" title="Its own price, not a share of the total" style={{ width: '3.4rem', padding: '0.375rem 0.4rem', border: '1px dashed var(--border)', borderRadius: 6, fontSize: '0.875rem', textAlign: 'center', color: 'var(--text-faint)', boxSizing: 'border-box' }}>
                    —
                  </span>
                )}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>%</span>
                {order ? (
                  <span style={{ width: '5.5rem', textAlign: 'right', fontSize: '0.8125rem', color: 'var(--text-700)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    ${formatCurrency(dollarsByRowId[r.id] ?? 0)}
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'stretch', width: '5.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                    <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', padding: '0 0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderRight: '1px solid var(--border)' }}>
                      $
                    </span>
                    <MoneyDecimalAmountInput
                      value={r.amount ?? 0}
                      onChange={(n) => updateRow(r.id, { amount: n === 0 ? null : n })}
                      commitOnType
                      placeholder="—"
                      aria-label="Segment amount"
                      style={{ flex: 1, width: '100%', minWidth: 0, padding: '0.375rem 0.4rem', border: 'none', borderRadius: 0, fontSize: '0.8125rem', textAlign: 'right', background: 'transparent' }}
                    />
                  </span>
                )}
                <StageKindSelector value={r.kind} onChange={(kind) => setKind(r.id, kind)} rowName={r.name.trim() || `row ${idx + 1}`} />
                <button
                  type="button"
                  onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((x) => x.id !== r.id) : prev))}
                  disabled={rows.length === 1}
                  title="Remove segment"
                  aria-label="Remove segment"
                  style={{ padding: '0.2rem 0.4rem', background: 'transparent', color: rows.length === 1 ? 'var(--text-faint)' : '#991b1c', border: 'none', cursor: rows.length === 1 ? 'default' : 'pointer', fontSize: '0.875rem', flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, newRow()])}
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            + Add segment
          </button>
          <span data-testid="generator-allocation" style={{ fontSize: '0.75rem', color: allocationOff ? 'var(--text-amber-700)' : 'var(--text-green-700)', fontWeight: 600 }}>
            {hasOrderRows ? `${allocatedPct}% allocated` : 'No split'}
            {allocationOff ? ' — segments usually total 100%' : ''}
            {hasOrderRows ? ` · $${formatCurrency(totals.inOrderDollars)} in order` : ''}
            {totals.outsideDollars > 0 ? ` · $${formatCurrency(totals.outsideDollars)} outside the split` : ''}
          </span>
        </div>
        <div data-testid="generator-summary" style={{ display: 'flex', gap: '0.4rem 1.2rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {totals.orderCount > 0 && (
            <span>
              <strong style={{ color: 'var(--text-700)' }}>{totals.orderCount} in order</strong> · numbered top to bottom
            </span>
          )}
          {totals.anyCount > 0 && (
            <span>
              <strong style={{ color: 'var(--text-700)' }}>
                {totals.anyCount} any time
              </strong>{' '}
              · its own price, not a share
            </span>
          )}
          {totals.plainCount > 0 && (
            <span>
              <strong style={{ color: 'var(--text-700)' }}>
                {totals.plainCount} plain line{totals.plainCount === 1 ? '' : 's'}
              </strong>{' '}
              · bills with the final draw
            </span>
          )}
          <span style={{ marginLeft: 'auto' }}>
            <strong style={{ color: 'var(--text-700)' }}>Job total ${formatCurrency(totals.jobTotalDollars)}</strong>
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem', background: 'var(--bg-subtle)', color: 'var(--text-700)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onAddToJob(payload)}
            disabled={payload.length === 0}
            style={{
              padding: '0.45rem 0.9rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              background: payload.length === 0 ? 'var(--border-strong)' : '#16a34a',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: payload.length === 0 ? 'default' : 'pointer',
            }}
          >
            Add to Job{payload.length > 0 ? ` (${payload.length} line${payload.length === 1 ? '' : 's'})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
