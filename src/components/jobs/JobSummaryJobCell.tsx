import type { ReactNode } from 'react'
import { JobIdentityCell } from '../search/JobIdentityCell'

/**
 * The one identity cell on Jobs → Job Summary (v2.3176). Folds the old Job # ·
 * Name · Address columns into two lines so the money columns get the width
 * back: line 1 is the expand caret, the trade pill + J-number (the standard
 * `JobIdentityCell`), the job name in semibold and any row chips (write-down,
 * collections); line 2 is the address, muted and smaller, ellipsized past
 * ~44 characters with the whole address on hover. The row's own click / key
 * handlers stay on the `<tr>`; this is presentational.
 */
export function JobSummaryJobCell({
  expanded,
  hcpNumber,
  clickNumber,
  serviceTypeName,
  jobName,
  address,
  chips,
}: {
  expanded: boolean
  hcpNumber: string | null | undefined
  clickNumber?: string | null | undefined
  serviceTypeName?: string | null | undefined
  jobName: string | null | undefined
  address: string | null | undefined
  /** Row chips (✂ write-down, ⚑ collections) — rendered at the end of the name line. */
  chips?: ReactNode
}) {
  const name = jobName?.trim() || '—'
  const addr = address?.trim() || ''
  return (
    <div data-testid="job-summary-job-cell" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '0.35rem', alignItems: 'start', minWidth: 0 }}>
      <span style={{ color: 'var(--text-muted)', userSelect: 'none', paddingTop: 1 }} aria-hidden>
        {expanded ? '▼' : '▶'}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem', flexWrap: 'wrap' }}>
          <JobIdentityCell hcpNumber={hcpNumber} clickNumber={clickNumber} serviceTypeName={serviceTypeName} />
          <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{name}</span>
          {chips}
        </div>
        <div
          title={addr || undefined}
          style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '44ch' }}
        >
          {addr || '—'}
        </div>
      </div>
    </div>
  )
}
