import {
  JOBS_LEDGER_STATUS_PIPELINE,
  labelJobsLedgerStatus,
  normalizeJobsLedgerStatus,
} from '../../lib/jobsLedgerStatusPipeline'

type Props = { status: string | null | undefined }

export function JobLedgerStatusPipeline({ status }: Props) {
  const current = normalizeJobsLedgerStatus(status)
  if (!current) {
    return <span>—</span>
  }

  const currentLabel = labelJobsLedgerStatus(current)
  const pathHuman = JOBS_LEDGER_STATUS_PIPELINE.map(labelJobsLedgerStatus).join(', ')
  const ariaLabel = `Job billing status: ${pathHuman}. Current: ${currentLabel}.`

  return (
    <span
      role="group"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        justifyContent: 'center',
        gap: '0.35rem',
        fontSize: '0.9375rem',
        maxWidth: '100%',
      }}
    >
      {JOBS_LEDGER_STATUS_PIPELINE.map((key, i) => {
        const isActive = key === current
        const isLast = i === JOBS_LEDGER_STATUS_PIPELINE.length - 1
        return (
          <span key={key} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span
              aria-current={isActive ? 'step' : undefined}
              style={{
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text-strong)' : 'var(--text-faint)',
                background: isActive ? 'var(--bg-muted)' : 'transparent',
                padding: isActive ? '0.12rem 0.45rem' : 0,
                borderRadius: isActive ? 4 : 0,
                whiteSpace: 'nowrap',
              }}
            >
              {labelJobsLedgerStatus(key)}
            </span>
            {!isLast ? (
              <span aria-hidden style={{ color: 'var(--text-faint-300)', flexShrink: 0 }}>
                →
              </span>
            ) : null}
          </span>
        )
      })}
    </span>
  )
}
