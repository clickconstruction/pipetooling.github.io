/**
 * The job-contract coverage chip (Contract Desk PR 1) — one look everywhere:
 * Pipeline rows, the Job window, the View bill strip. Gray = nothing on file,
 * amber = out for signature, green = signed. Same tone grammar as
 * BidRoomStateChip so the two read as one system.
 */
import type { CSSProperties } from 'react'
import {
  jobContractChipLabel,
  jobContractChipTitle,
  jobContractChipTone,
  type JobContractCoverage,
} from '../../lib/jobs/jobContractCoverage'
import type { ContractRowChipTone } from '../../lib/jobs/contractRowChip'

const TONE_STYLES: Record<string, { bg: string; fg: string; border: string }> = {
  signed: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-700)', border: 'var(--border)' },
  sent: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-700)', border: 'var(--border-amber)' },
  draft: { bg: 'var(--bg-subtle)', fg: 'var(--text-muted)', border: 'var(--border-strong)' },
  none: { bg: 'var(--bg-subtle)', fg: 'var(--text-muted)', border: 'var(--border-strong)' },
  /** The office answered Not needed (PR 0): quieter than a gap — faint text, dashed edge. */
  not_needed: { bg: 'transparent', fg: 'var(--text-faint)', border: 'var(--border)' },
  /** v2.4342: a Pipeline row's ask (a crew booked or on site, nothing on file) — the amber of a sent contract. */
  ask: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-700)', border: 'var(--border-amber)' },
}

export function JobContractChip({
  coverage,
  onClick,
  compact,
  style,
  words,
}: {
  coverage: JobContractCoverage | null | undefined
  /** When set the chip is a button (opens the Contract modal, PR 2). */
  onClick?: () => void
  compact?: boolean
  style?: CSSProperties
  /** v2.4342: the Pipeline row's own words for the chip (`contractRowChip`), in place of the coverage's. */
  words?: { label: string; title: string; tone: ContractRowChipTone } | null
}) {
  const tone = words?.tone ?? jobContractChipTone(coverage)
  const t = TONE_STYLES[tone]!
  const base: CSSProperties = {
    display: 'inline-block',
    background: t.bg,
    color: t.fg,
    border: `1px ${tone === 'not_needed' ? 'dashed' : 'solid'} ${t.border}`,
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
  const label = words?.label ?? jobContractChipLabel(coverage)
  const title = words?.title ?? jobContractChipTitle(coverage)
  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title} aria-label={`${label} — open contract`} style={{ ...base, cursor: 'pointer' }}>
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

export default JobContractChip
