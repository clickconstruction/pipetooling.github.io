import { useMemo, useState } from 'react'
import { BILLED_COLOR, DRAFT_COLOR, PAID_COLOR, UNBILLED_COLOR } from './MoneyLifecycleBar'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import type { FixtureRow } from '../../lib/jobs/jobFormTypes'
import {
  buildJobSegmentsBar,
  segmentSelectionNetSummary,
  type JobBarSegment,
  type JobDollarCoverage,
} from '../../lib/jobs/jobSegmentsCoverage'

type JobFormSegmentsBarProps = {
  fixtures: FixtureRow[]
  riderFeesDollars: number
  invoiceStatusById: Record<string, string>
  selectedIds: ReadonlySet<string>
  onToggleSegment: (fixtureRowId: string) => void
  /** Rendered between the strip and the per-segment rows (the break-off track). */
  trackSlot?: React.ReactNode
  /**
   * The break-off track's dollar axis total. When set, the legend row carries
   * the $0 / $total anchors at its far left and right (they used to sit under
   * the track itself).
   */
  axisTotalDollars?: number
  /**
   * Dollar-invoice coverage (v2.1132): money paid or invoiced by amount (no
   * line-item links) hatches the strip via a first-items-first waterfall,
   * locks fully covered rows, and caps "create invoice from selection" at the
   * slider's Remaining. Omit (new job) to disable all three.
   */
  coverage?: JobDollarCoverage
}

/**
 * "② Invoices" heading with the ⓘ how-it-moves explainer beside it (v2.1146) —
 * the trigger used to live inside the segment strip's header row; the modal
 * renders this instead so the explainer sits next to the section title.
 */
export function InvoicesSectionHeading({
  sampleDollars,
  jobLabel,
}: {
  sampleDollars: number | null
  jobLabel?: string | null
}) {
  const [explainerOpen, setExplainerOpen] = useState(false)
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 400, textDecoration: 'underline', fontSize: '0.9375rem', color: 'var(--text-700)' }}>
          ② Invoices
        </span>
        <button
          type="button"
          onClick={() => setExplainerOpen((v) => !v)}
          aria-expanded={explainerOpen}
          style={{
            padding: 0,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-link)',
            fontSize: '0.6875rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          ⓘ How invoices and jobs move
        </button>
      </div>
      {explainerOpen && (
        <div
          style={{
            borderLeft: '2px solid var(--border-strong)',
            padding: '0.35rem 0 0.35rem 0.75rem',
            marginTop: '0.5rem',
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
              ${formatCurrency(sampleDollars ?? 1450)}
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
    </div>
  )
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
  trackSlot,
  axisTotalDollars,
  coverage,
}: JobFormSegmentsBarProps) {
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const segments = useMemo(
    () => buildJobSegmentsBar({ fixtures, riderFeesDollars, invoiceStatusById }),
    [fixtures, riderFeesDollars, invoiceStatusById],
  )
  if (segments.length === 0) return null

  const segCoverage = (key: string) => coverage?.bySegmentKey[key]
  /** Selectable for invoicing: unbilled AND not fully covered by dollar invoices/payments. */
  const isSelectable = (seg: JobBarSegment) => seg.selectable && !(segCoverage(seg.key)?.fullyCovered ?? false)
  const showCoverage = coverage != null && coverage.unattributedDollars > 0

  const isHighlighted = (seg: JobBarSegment) =>
    (isSelectable(seg) && selectedIds.has(seg.key)) || focusedKey === seg.key

  function handleSegmentClick(seg: JobBarSegment) {
    if (isSelectable(seg)) {
      onToggleSegment(seg.key)
      return
    }
    setFocusedKey((cur) => (cur === seg.key ? null : seg.key))
  }

  const coverageChip = (seg: JobBarSegment) => {
    const c = segCoverage(seg.key)
    if (!c || !(c.coveredDollars > 0) || seg.status !== 'unbilled') return null
    return (
      <span
        title={
          c.fullyCovered
            ? 'Fully covered by money already paid or invoiced by dollar amount (first line items first). Void or delete that bill to invoice this line again.'
            : 'Partially covered by money already paid or invoiced by dollar amount (first line items first) — the rest is still billable.'
        }
        style={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          background: 'var(--bg-blue-tint)',
          color: 'var(--text-blue-700)',
          borderRadius: 999,
          padding: '0 0.5rem',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {c.fullyCovered ? 'covered' : `$${formatCurrency(c.coveredDollars)} covered`}
      </span>
    )
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          justifyContent: axisTotalDollars != null ? 'space-between' : 'center',
          gap: '0.6rem',
          marginBottom: '0.35rem',
        }}
      >
        {axisTotalDollars != null && (
          <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            $0
          </span>
        )}
        <span style={{ display: 'inline-flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {LEGEND.map((l) => (
            <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, display: 'inline-block' }} />
              {l.label}
            </span>
          ))}
          {showCoverage && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  display: 'inline-block',
                  border: '1px solid var(--border-strong)',
                  background: 'repeating-linear-gradient(-45deg, rgba(29,95,165,0.5) 0 2px, transparent 2px 4px)',
                }}
              />
              Covered by other bills
            </span>
          )}
        </span>
        {axisTotalDollars != null && (
          <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {formatUsdNoCents(axisTotalDollars)}
          </span>
        )}
      </div>
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
              title={`${seg.label} — $${formatCurrency(seg.dollars)} (${seg.pctOfTotal.toFixed(1)}%)${seg.status === 'unbilled' ? '' : ` · ${seg.status.replace(/_/g, ' ')}`}${(() => {
                const c = segCoverage(seg.key)
                return c && c.coveredDollars > 0 ? ` · $${formatCurrency(c.coveredDollars)} covered by other bills` : ''
              })()}`}
              aria-label={`Segment ${seg.label}: $${formatCurrency(seg.dollars)}, ${seg.pctOfTotal.toFixed(1)} percent${isSelectable(seg) ? (selectedIds.has(seg.key) ? ', selected for invoicing' : ', click to select for invoicing') : segCoverage(seg.key)?.fullyCovered ? ', covered by an existing bill' : ''}`}
              aria-pressed={highlighted}
              style={{
                position: 'relative',
                width: `${seg.pctOfTotal}%`,
                minWidth: 6,
                padding: '0 4px',
                background: segmentFill(seg),
                border: 'none',
                borderRight: idx < segments.length - 1 ? '1px solid var(--surface)' : 'none',
                // First AND last corners round independently — a single-segment
                // strip gets all four (it used to end hard on the right).
                borderRadius: `${idx === 0 ? 5 : 0}px ${idx === segments.length - 1 ? 5 : 0}px ${idx === segments.length - 1 ? 5 : 0}px ${idx === 0 ? 5 : 0}px`,
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
              {(() => {
                // Hatch = the waterfall's coverage of THIS block, so the strip,
                // the row chips, and the locks always tell the same story.
                const c = segCoverage(seg.key)
                if (!c || !(c.coveredDollars > 0) || !(seg.dollars > 0)) return null
                const pct = Math.min(100, (c.coveredDollars / seg.dollars) * 100)
                return (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${pct}%`,
                      background: 'repeating-linear-gradient(-45deg, rgba(29,95,165,0.45) 0 5px, transparent 5px 10px)',
                      borderRight: c.fullyCovered ? 'none' : '2px solid #185FA5',
                      pointerEvents: 'none',
                    }}
                  />
                )
              })()}
              <span
                style={{
                  // Above the absolutely-positioned coverage hatch (v2.1144) —
                  // the label reads on top of the stripes, not under them.
                  position: 'relative',
                  zIndex: 1,
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: seg.kind === 'riders' ? 'var(--text-700)' : '#ffffff',
                  // 1px dark rim around each character (8-direction shadow —
                  // CSS has no outside text stroke) so white labels stay
                  // crisp over the coverage hatch. Riders keep dark-on-light.
                  textShadow:
                    seg.kind === 'riders'
                      ? undefined
                      : '-1px -1px 0 rgba(31,41,55,0.9), 1px -1px 0 rgba(31,41,55,0.9), -1px 1px 0 rgba(31,41,55,0.9), 1px 1px 0 rgba(31,41,55,0.9), -1px 0 0 rgba(31,41,55,0.9), 1px 0 0 rgba(31,41,55,0.9), 0 -1px 0 rgba(31,41,55,0.9), 0 1px 0 rgba(31,41,55,0.9)',
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
      {trackSlot}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.4rem' }}>
        {segments.map((seg) => {
          const highlighted = isHighlighted(seg)
          const rowInner = (
            <>
              {isSelectable(seg) ? (
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
              {coverageChip(seg)}
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
          return isSelectable(seg) ? (
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
    </div>
  )
}

/**
 * The "Create invoice from remaining on selected segments" action + its
 * helper/warning text. Rendered by the shell BELOW the equation row (the
 * Paid + Billed + New invoice → Left to bill chips), separate from the bar.
 * The amount is the selection NET of dollar coverage — covered money is
 * subtracted, so a partially covered segment bills only what's left on it.
 */
export function JobFormSegmentsCreateAction({
  fixtures,
  riderFeesDollars,
  invoiceStatusById,
  selectedIds,
  onCreateInvoiceFromSelection,
  creatingFromSelection,
  coverage,
}: Omit<JobFormSegmentsBarProps, 'onToggleSegment' | 'trackSlot'> & {
  onCreateInvoiceFromSelection: () => void
  creatingFromSelection: boolean
}) {
  const segments = useMemo(
    () => buildJobSegmentsBar({ fixtures, riderFeesDollars, invoiceStatusById }),
    [fixtures, riderFeesDollars, invoiceStatusById],
  )
  // Net of dollar coverage: the button bills what's LEFT on the selection,
  // not its face value — covered money is already spoken for.
  const selection = useMemo(
    () => segmentSelectionNetSummary(fixtures, selectedIds, coverage),
    [fixtures, selectedIds, coverage],
  )
  const anySelectable = segments.some(
    (seg) => seg.selectable && !(coverage?.bySegmentKey[seg.key]?.fullyCovered ?? false),
  )
  if (segments.length === 0 || !anySelectable) return null

  /** Cents-exact backstop: with consistent coverage the net can't exceed the
   * slider's Remaining (coverage nets out first), but stale state still can. */
  const selectionExceedsRemaining =
    coverage != null && Math.round(selection.netDollars * 100) > Math.round(coverage.remainingDollars * 100)

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={onCreateInvoiceFromSelection}
        disabled={creatingFromSelection || selection.count === 0 || selectionExceedsRemaining}
        title={selectionExceedsRemaining && coverage ? `The selection would bill more than the $${formatCurrency(coverage.remainingDollars)} left on the job` : undefined}
        style={{
          padding: '0.4rem 0.75rem',
          fontSize: '0.8125rem',
          fontWeight: 600,
          background: selection.count === 0 || selectionExceedsRemaining ? 'var(--bg-200)' : '#3b82f6',
          color: selection.count === 0 || selectionExceedsRemaining ? 'var(--text-faint)' : 'white',
          border: selection.count === 0 || selectionExceedsRemaining ? '1px solid var(--border)' : 'none',
          borderRadius: 6,
          cursor: creatingFromSelection || selection.count === 0 || selectionExceedsRemaining ? 'default' : 'pointer',
        }}
      >
        {creatingFromSelection
          ? 'Creating…'
          : selection.count === 0
            ? 'Create invoice from remaining on selected segments'
            : `Create invoice from remaining on ${selection.count} segment${selection.count === 1 ? '' : 's'} ($${formatCurrency(selection.netDollars)})`}
      </button>
      {selectionExceedsRemaining && coverage ? (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-red-600)', fontWeight: 600 }}>
          Exceeds the ${formatCurrency(coverage.remainingDollars)} left to bill — money already paid or invoiced
          covers the rest.
        </span>
      ) : selection.count > 0 ? (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {selection.coveredDollars > 0
            ? `Breaks off a Ready-to-Bill invoice for what's left on these segments — $${formatCurrency(selection.coveredDollars)} already covered is subtracted — and locks them in ① Line Items.`
            : 'Breaks off a Ready-to-Bill invoice for exactly these segments and locks them in ① Line Items.'}
        </span>
      ) : null}
    </div>
  )
}
