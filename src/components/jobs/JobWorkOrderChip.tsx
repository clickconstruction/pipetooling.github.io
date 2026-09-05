/**
 * The job work-order coverage chip (Work Orders tab, PR 3 — v2.2829): one
 * look on the Job window's fact row and the View bill strip. Gray = nothing
 * / draft, amber = out for signature, green = signed, red = declined. Same
 * tone grammar as JobContractChip so contract-in and work-order-out read as
 * one system.
 */
import type { CSSProperties } from 'react'
import { workOrderChipLabel, workOrderChipTitle, workOrderChipTone, type JobWorkOrderCoverage } from '../../lib/subWorkOrders/workOrderCoverage'

const TONE_STYLES: Record<string, { bg: string; fg: string; border: string }> = {
  signed: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-700)', border: 'var(--border)' },
  sent: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-700)', border: 'var(--border-amber)' },
  declined: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-700)', border: 'var(--border)' },
  draft: { bg: 'var(--bg-subtle)', fg: 'var(--text-muted)', border: 'var(--border-strong)' },
  none: { bg: 'var(--bg-subtle)', fg: 'var(--text-muted)', border: 'var(--border-strong)' },
}

export function JobWorkOrderChip({
  coverage,
  onClick,
  compact,
  style,
}: {
  coverage: JobWorkOrderCoverage | null | undefined
  /** When set the chip is a button (opens the assembler / the signed record). */
  onClick?: () => void
  compact?: boolean
  style?: CSSProperties
}) {
  const tone = workOrderChipTone(coverage)
  const t = TONE_STYLES[tone]!
  const base: CSSProperties = {
    display: 'inline-block',
    background: t.bg,
    color: t.fg,
    border: `1px solid ${t.border}`,
    borderRadius: 999,
    padding: compact ? '0 0.4rem' : '0.08rem 0.5rem',
    fontSize: compact ? '0.62rem' : '0.68rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
    lineHeight: 1.5,
    fontFamily: 'inherit',
    ...style,
  }
  const label = workOrderChipLabel(coverage)
  const title = workOrderChipTitle(coverage)
  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title} aria-label={`${label} — open work order`} style={{ ...base, cursor: 'pointer' }}>
        {label}
      </button>
    )
  }
  return (
    <span title={title} style={base}>
      {label}
    </span>
  )
}

export default JobWorkOrderChip
