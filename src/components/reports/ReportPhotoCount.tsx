import type { CSSProperties } from 'react'
import { photoBadge } from '../../lib/photos/reportPhotoCounts'

/**
 * The badge on a folded report row (punch list #229, PR 3): *📷 2*, read as *2 photos*. Nothing for a report with
 * none, so an old row draws as it did. `tone` is `new` on a row the reader has not opened, as the Dashboard draws
 * its fresh rows.
 */
export function ReportPhotoCount({ count, tone = 'quiet', style }: { count: number | undefined; tone?: 'quiet' | 'new'; style?: CSSProperties }) {
  const badge = photoBadge(count)
  if (!badge) return null
  return (
    <span
      data-testid="report-photo-count"
      aria-label={badge.label}
      title={badge.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: '0.72rem',
        fontWeight: 600,
        lineHeight: 1.4,
        padding: '0 0.4rem',
        borderRadius: 6,
        color: tone === 'new' ? 'var(--text-green-700)' : 'var(--text-blue-700)',
        background: tone === 'new' ? 'var(--bg-green-100)' : 'var(--bg-blue-tint)',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        ...style,
      }}
    >
      {badge.text}
    </span>
  )
}
