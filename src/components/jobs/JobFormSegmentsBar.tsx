import { useMemo, useState } from 'react'
import { BILLED_COLOR, DRAFT_COLOR, PAID_COLOR, UNBILLED_COLOR } from './MoneyLifecycleBar'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import type { FixtureRow } from '../../lib/jobs/jobFormTypes'
import {
  buildJobSegmentsBar,
  segmentSelectionSummary,
  type JobBarSegment,
} from '../../lib/jobs/jobSegmentsCoverage'

type JobFormSegmentsBarProps = {
  fixtures: FixtureRow[]
  riderFeesDollars: number
  invoiceStatusById: Record<string, string>
  selectedIds: ReadonlySet<string>
  onToggleSegment: (fixtureRowId: string) => void
  onCreateInvoiceFromSelection: () => void
  creatingFromSelection: boolean
  /** Label for the blue sample chip in the how-it-moves explainer, e.g. "Job 742" (v2.1074). */
  jobLabel?: string | null
}

/** Sample chips in the explainer wear the exact Stages colors users will see there. */
const EXPLAINER_CHIP_BASE = {
  display: 'inline-block',
  padding: '0.1rem 0.45rem',
  borderRadius: 4,
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: '#ffffff',
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
} as const

function segmentFill(seg: JobBarSegment): string {
  if (seg.kind === 'riders') return 'var(--border-strong)'
  if (seg.status === 'paid') return PAID_COLOR
  if (seg.status === 'billed') return BILLED_COLOR
  if (seg.status === 'ready_to_bill') return DRAFT_COLOR
  return UNBILLED_COLOR
}

const LEGEND: Array<{ label: string; color: string }> = [
  { label: 'Unbilled', color: UNBILLED_COLOR },
  { label: 'Ready to Bill', color: DRAFT_COLOR },
  { label: 'Billed', color: BILLED_COLOR },
  { label: 'Paid', color: PAID_COLOR },
]

/**
 * The ② Invoices "100% of the job" strip (v2.1070, reworked v2.1072): line
 * items as ordered segments sized by dollar share, each block carrying its
 * ellipsized name and colored by the billing lifecycle of its invoice. The
 * detail list renders one segment per row. Clicking a block (or its row /
 * checkbox) highlights both in sync — for unbilled segments that IS the
 * invoice selection; billed/rider blocks get a passive focus highlight.
 * Pure render — math in jobSegmentsCoverage.ts, writes stay in the shell.
 */
export function JobFormSegmentsBar({
  fixtures,
  riderFeesDollars,
  invoiceStatusById,
  selectedIds,
  onToggleSegment,
  onCreateInvoiceFromSelection,
  creatingFromSelection,
  jobLabel,
}: JobFormSegmentsBarProps) {
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [explainerOpen, setExplainerOpen] = useState(false)
  const segments = useMemo(
    () => buildJobSegmentsBar({ fixtures, riderFeesDollars, invoiceStatusById }),
    [fixtures, riderFeesDollars, invoiceStatusById],
  )
  const selection = useMemo(
    () => segmentSelectionSummary(fixtures, selectedIds),
    [fixtures, selectedIds],
  )
  if (segments.length === 0) return null
  const anySelectable = segments.some((s) => s.selectable)

  const isHighlighted = (seg: JobBarSegment) =>
    (seg.selectable && selectedIds.has(seg.key)) || focusedKey === seg.key

  function handleSegmentClick(seg: JobBarSegment) {
    if (seg.selectable) {
      onToggleSegment(seg.key)
      return
    }
    setFocusedKey((cur) => (cur === seg.key ? null : seg.key))
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '0.6rem',
          marginBottom: '0.35rem',
        }}
      >
        <button
          type="button"
          onClick={() => setExplainerOpen((v) => !v)}
          aria-expanded={explainerOpen}
          style={{
            padding: 0,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-link)',
            textDecoration: 'underline',
            fontSize: '0.6875rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          ⓘ How invoices and jobs move
        </button>
        <span style={{ display: 'inline-flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {LEGEND.map((l) => (
            <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, display: 'inline-block' }} />
              {l.label}
            </span>
          ))}
        </span>
      </div>
      {explainerOpen && (
        <div
          style={{
            borderLeft: '2px solid var(--border-strong)',
            padding: '0.35rem 0 0.35rem 0.75rem',
            marginBottom: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          <div>
            1. Create an invoice here — it breaks off as its own <strong style={{ color: 'var(--text-700)' }}>green card</strong> on the
            Stages board and moves by itself:
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ ...EXPLAINER_CHIP_BASE, background: '#16a34a', border: '1px solid rgba(255,255,255,0.5)' }}>
              ${formatCurrency(segments[0]?.dollars ?? 1450)}
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>→ Ready to Bill → Billed → Paid</span>
          </div>
          <div>
            2. The job itself stays a <strong style={{ color: 'var(--text-700)' }}>blue card</strong> in Working. When its last payment
            lands, it floats through on its own:
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ ...EXPLAINER_CHIP_BASE, background: '#2563eb', border: 'none' }}>{jobLabel || 'This job'}</span>
            <span style={{ whiteSpace: 'nowrap' }}>→ Paid</span>
          </div>
        </div>
      )}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 28,
          borderRadius: 6,
          border: '1px solid var(--border)',
        }}
      >
        {segments.map((seg, idx) => {
          const highlighted = isHighlighted(seg)
          return (
            <button
              key={seg.key}
              type="button"
              onClick={() => handleSegmentClick(seg)}
              title={`${seg.label} — $${formatCurrency(seg.dollars)} (${seg.pctOfTotal.toFixed(1)}%)${seg.status === 'unbilled' ? '' : ` · ${seg.status.replace(/_/g, ' ')}`}`}
              aria-label={`Segment ${seg.label}: $${formatCurrency(seg.dollars)}, ${seg.pctOfTotal.toFixed(1)} percent${seg.selectable ? (selectedIds.has(seg.key) ? ', selected for invoicing' : ', click to select for invoicing') : ''}`}
              aria-pressed={highlighted}
              style={{
                width: `${seg.pctOfTotal}%`,
                minWidth: 6,
                padding: '0 4px',
                background: segmentFill(seg),
                border: 'none',
                borderRight: idx < segments.length - 1 ? '1px solid var(--surface)' : 'none',
                borderRadius: idx === 0 ? '5px 0 0 5px' : idx === segments.length - 1 ? '0 5px 5px 0' : 0,
                boxSizing: 'border-box',
                cursor: 'pointer',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                // Highlight: inset ring so widths never shift.
                boxShadow: highlighted ? 'inset 0 0 0 2px var(--text-strong)' : 'none',
                opacity: highlighted ? 1 : 0.92,
              }}
            >
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: seg.kind === 'riders' ? 'var(--text-700)' : '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {seg.label}
              </span>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.4rem' }}>
        {segments.map((seg) => {
          const highlighted = isHighlighted(seg)
          const rowInner = (
            <>
              {seg.selectable ? (
                <input
                  type="checkbox"
                  checked={selectedIds.has(seg.key)}
                  onChange={() => onToggleSegment(seg.key)}
                  aria-label={`Select segment ${seg.label} for invoicing`}
                  style={{ margin: 0, flexShrink: 0 }}
                />
              ) : (
                <span style={{ width: 8, height: 8, borderRadius: 2, background: segmentFill(seg), display: 'inline-block', flexShrink: 0 }} />
              )}
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {seg.label}
              </span>
              <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                ${formatCurrency(seg.dollars)} · {seg.pctOfTotal.toFixed(1)}%
              </span>
            </>
          )
          const rowStyle = {
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            width: '100%',
            fontSize: '0.75rem',
            color: 'var(--text-700)',
            padding: '0.2rem 0.3rem',
            borderRadius: 4,
            background: highlighted ? 'var(--bg-blue-tint)' : 'transparent',
            cursor: 'pointer',
            textAlign: 'left' as const,
          }
          // Selectable rows are labels so any click toggles the checkbox;
          // the rest are buttons toggling the passive focus highlight.
          return seg.selectable ? (
            <label key={seg.key} style={rowStyle}>
              {rowInner}
            </label>
          ) : (
            <button
              key={seg.key}
              type="button"
              onClick={() => handleSegmentClick(seg)}
              aria-pressed={highlighted}
              style={{ ...rowStyle, border: 'none', fontFamily: 'inherit' }}
            >
              {rowInner}
            </button>
          )
        })}
      </div>
      {anySelectable && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onCreateInvoiceFromSelection}
            disabled={creatingFromSelection || selection.count === 0}
            style={{
              padding: '0.4rem 0.75rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              background: selection.count === 0 ? 'var(--border-strong)' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: creatingFromSelection || selection.count === 0 ? 'default' : 'pointer',
            }}
          >
            {creatingFromSelection
              ? 'Creating…'
              : selection.count === 0
                ? 'Create invoice from selected segments'
                : `Create invoice from ${selection.count} segment${selection.count === 1 ? '' : 's'} ($${formatCurrency(selection.totalDollars)})`}
          </button>
          {selection.count > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Breaks off a Ready-to-Bill invoice for exactly these segments and locks them in ① Line Items.
            </span>
          )}
        </div>
      )}
    </div>
  )
}
