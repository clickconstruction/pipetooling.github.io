import { useEffect, useId, useState } from 'react'
import { MoneyDecimalAmountInput } from '../MoneyDecimalAmountInput'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { moveRowById } from '../../lib/jobs/jobFormReorder'
import {
  SEGMENT_GENERATOR_PRESETS,
  segmentGeneratorAllocatedPct,
  segmentGeneratorDollarsByRowId,
  segmentGeneratorPayload,
  type SegmentGeneratorPayloadLine,
  type SegmentGeneratorRow,
} from '../../lib/jobs/segmentGenerator'

type MultipleSegmentGeneratorModalProps = {
  open: boolean
  /** Prefill for the total — the job's current Job Total (editable). */
  initialTotalDollars: number
  zIndex: number
  onCancel: () => void
  /** "Add to Job": append these lines to the existing ① Line Items. */
  onAddToJob: (lines: SegmentGeneratorPayloadLine[]) => void
}

function newRow(name = '', pct: number | null = null): SegmentGeneratorRow {
  return { id: crypto.randomUUID(), name, pct }
}

/**
 * The "Multiple Segment Generator" (v2.1071): enter a total, split it into
 * named percentage segments (with two one-click presets), re-arrange with
 * ▲▼, and append the result to the job's line items. All math in
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
  const payload = segmentGeneratorPayload(totalDollars, rows)
  const allocationOff = Math.abs(allocatedPct - 100) > 0.001

  function applyPreset(presetKey: string) {
    const preset = SEGMENT_GENERATOR_PRESETS.find((p) => p.key === presetKey)
    if (!preset) return
    setRows(preset.rows.map((r) => newRow(r.name, r.pct)))
  }

  function updateRow(id: string, updates: Partial<SegmentGeneratorRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)))
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
          maxWidth: 520,
          width: '100%',
          maxHeight: 'min(85vh, 640px)',
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
          Set the total, name the segments of work, and give each a percentage — the dollar split updates as
          you type. <strong>Add to Job</strong> appends them to the existing line items.
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-700)' }}>
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
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              style={{
                padding: '0.3rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'var(--bg-subtle)',
                color: 'var(--text-700)',
                border: '1px solid var(--border)',
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {rows.map((r, idx) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
              <input
                type="text"
                value={r.name}
                onChange={(e) => updateRow(r.id, { name: e.target.value })}
                placeholder="Segment of work"
                aria-label="Segment name"
                style={{ flex: 1, minWidth: 0, padding: '0.375rem 0.625rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem' }}
              />
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
                style={{ width: '4rem', padding: '0.375rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem', textAlign: 'right' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>%</span>
              <span style={{ width: '5.5rem', textAlign: 'right', fontSize: '0.8125rem', color: 'var(--text-700)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                ${formatCurrency(dollarsByRowId[r.id] ?? 0)}
              </span>
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
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, newRow()])}
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            + Add segment
          </button>
          <span style={{ fontSize: '0.75rem', color: allocationOff ? '#b45309' : 'var(--text-muted)', fontWeight: allocationOff ? 600 : 400 }}>
            {allocatedPct}% allocated{allocationOff ? ' — segments usually total 100%' : ''}
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
