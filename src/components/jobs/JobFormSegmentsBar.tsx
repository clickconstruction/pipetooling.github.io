import { useMemo } from 'react'
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
}

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
 * The ② Invoices "100% of the job" strip (v2.1070): line items as ordered
 * segments sized by dollar share, colored by the lifecycle stage of the
 * invoice billing each one. Unbilled segments carry a checkbox; the action
 * button turns the selection into a Ready-to-Bill break-off invoice linked to
 * exactly those segments. Pure render — all math in jobSegmentsCoverage.ts,
 * all writes stay in the shell.
 */
export function JobFormSegmentsBar({
  fixtures,
  riderFeesDollars,
  invoiceStatusById,
  selectedIds,
  onToggleSegment,
  onCreateInvoiceFromSelection,
  creatingFromSelection,
}: JobFormSegmentsBarProps) {
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
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '0.5rem',
          marginBottom: '0.35rem',
        }}
      >
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          The whole job, in line-item order — each block is a segment&apos;s share of the Job Total
        </span>
        <span style={{ display: 'inline-flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {LEGEND.map((l) => (
            <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, display: 'inline-block' }} />
              {l.label}
            </span>
          ))}
        </span>
      </div>
      <div
        role="img"
        aria-label="Job segments by billing status"
        style={{
          display: 'flex',
          width: '100%',
          height: 26,
          borderRadius: 6,
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      >
        {segments.map((seg) => (
          <div
            key={seg.key}
            title={`${seg.label} — $${formatCurrency(seg.dollars)} (${seg.pctOfTotal.toFixed(1)}%)${seg.status === 'unbilled' ? '' : ` · ${seg.status.replace(/_/g, ' ')}`}`}
            style={{
              width: `${seg.pctOfTotal}%`,
              minWidth: 3,
              background: segmentFill(seg),
              borderRight: '1px solid var(--surface)',
              boxSizing: 'border-box',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1rem', marginTop: '0.4rem' }}>
        {segments.map((seg) => (
          <label
            key={seg.key}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: '0.75rem',
              color: 'var(--text-700)',
              cursor: seg.selectable ? 'pointer' : 'default',
            }}
          >
            {seg.selectable ? (
              <input
                type="checkbox"
                checked={selectedIds.has(seg.key)}
                onChange={() => onToggleSegment(seg.key)}
                aria-label={`Select segment ${seg.label} for invoicing`}
                style={{ margin: 0 }}
              />
            ) : (
              <span style={{ width: 8, height: 8, borderRadius: 2, background: segmentFill(seg), display: 'inline-block' }} />
            )}
            <span style={{ whiteSpace: 'nowrap', maxWidth: '14rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{seg.label}</span>
            <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              ${formatCurrency(seg.dollars)} · {seg.pctOfTotal.toFixed(1)}%
            </span>
          </label>
        ))}
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
