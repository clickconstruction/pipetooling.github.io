import type { PeopleHoursPendingSummary } from '../../lib/peopleHoursPendingByCell'

export interface PeopleHoursPendingBannerProps {
  summary: PeopleHoursPendingSummary
  canAccessHours: boolean
  canAccessPay: boolean
  onReviewApprove: () => void
  /** Opens the all-weeks approvals queue — the banner itself only knows about the visible week. */
  onOpenQueue?: () => void
  /**
   * "+N sessions in earlier weeks" (Tier-1 #15, J7-2): the rest of the backlog the visible-week
   * count cannot see, from the all-weeks approvals count (v2.2694). '' / undefined hides the line.
   */
  outsideWeekLine?: string
}

/** Hours grid warning banner: pending sessions not yet in payroll, with a bulk review/approve CTA. Renders nothing when there is nothing pending. */
export function PeopleHoursPendingBanner({
  summary,
  canAccessHours,
  canAccessPay,
  onReviewApprove,
  onOpenQueue,
  outsideWeekLine,
}: PeopleHoursPendingBannerProps) {
  if (!(summary.totalSessions > 0 && (canAccessHours || canAccessPay))) return null
  return (
    <div
      role="status"
      style={{
        marginBottom: '0.5rem',
        padding: '0.45rem 0.6rem',
        border: '1px solid #f59e0b',
        background: 'var(--bg-amber-100)',
        color: 'var(--text-amber-800)',
        borderRadius: 6,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.8125rem',
        lineHeight: 1.35,
      }}
    >
      <span aria-hidden style={{ fontSize: '0.95rem', lineHeight: 1 }}>⚠</span>
      <span style={{ flex: '1 1 auto', minWidth: 0 }}>
        <strong>Pending: {summary.peopleCount}</strong>{' '}
        {summary.peopleCount === 1 ? 'person' : 'people'} ·{' '}
        <strong>{summary.totalDiffHours.toFixed(2)} h</strong> not yet in payroll
        {summary.workDates.length > 0 ? (
          <>
            {' '}across{' '}
            {summary.workDates.length}{' '}
            {summary.workDates.length === 1 ? 'day' : 'days'}
          </>
        ) : null}
        .
        {outsideWeekLine ? (
          <>
            {' '}
            {onOpenQueue ? (
              <button
                type="button"
                onClick={onOpenQueue}
                title="Open the all-weeks approvals queue"
                style={{
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  font: 'inherit',
                  fontWeight: 600,
                  color: 'inherit',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                {outsideWeekLine}
              </button>
            ) : (
              <strong>{outsideWeekLine}</strong>
            )}
            .
          </>
        ) : null}
      </span>
      <button
        type="button"
        onClick={onReviewApprove}
        style={{
          padding: '0.25rem 0.6rem',
          fontSize: '0.8125rem',
          fontWeight: 600,
          border: '1px solid #b45309',
          background: '#b45309',
          color: 'white',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        Review &amp; approve
      </button>
      {onOpenQueue ? (
        <button
          type="button"
          onClick={onOpenQueue}
          title="Every pending session, all weeks — not just the week shown here"
          style={{
            padding: '0.25rem 0.6rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            border: '1px solid #b45309',
            background: 'transparent',
            color: 'var(--text-amber-800)',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          All weeks
        </button>
      ) : null}
    </div>
  )
}
