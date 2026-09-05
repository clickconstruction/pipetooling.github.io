import type { CSSProperties } from 'react'
import { percentProvenanceLabel, percentProvenanceTitle } from '../../lib/jobPercentProvenance'
import type { JobSummaryPercentSource } from '../../lib/jobSummaryPercentComplete'

/**
 * The tiny "% done" provenance badge (v2.2852): "crew report Aug 27" · "set by office" ·
 * "fully collected". Renders nothing for `none`. Sits beside the % on the Job Summary row,
 * the Job Detail / Stages activity header and the report modal's slider hint.
 */
export function PercentProvenanceChip({
  source,
  reportedOn,
  style,
}: {
  source: JobSummaryPercentSource
  reportedOn?: string | null
  style?: CSSProperties
}) {
  const label = percentProvenanceLabel(source, { reportedOn })
  if (!label) return null
  return (
    <span
      title={percentProvenanceTitle(source) ?? undefined}
      data-pct-source={source}
      style={{
        display: 'inline-block',
        marginLeft: 6,
        fontSize: '0.66rem',
        fontWeight: 600,
        lineHeight: 1.4,
        padding: '0.05rem 0.4rem',
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'var(--bg-subtle)',
        color: 'var(--text-muted)',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        ...style,
      }}
    >
      {label}
    </span>
  )
}
