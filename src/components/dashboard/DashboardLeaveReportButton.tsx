import type { MouseEventHandler } from 'react'

/**
 * "Leave Report" button + optional overlaid reminder badge, shared by the
 * Dashboard job-row family (Team Ready to Bill / Assigned Jobs) and the My
 * Schedule section. Moved verbatim from `src/pages/Dashboard.tsx`
 * (extraction-series refactor; no behavior change).
 */
export function DashboardLeaveReportButton(props: {
  showReminder: boolean
  onClick: MouseEventHandler<HTMLButtonElement>
  buttonTitle?: string
  /** Render "Leave Report" on one line (compact Ready to Bill cards); default keeps the stacked two-line form. */
  singleLine?: boolean
  /** Existing reports visible to this user on the job; > 0 renders the corner badge (v2.1547). */
  reportCount?: number
  /** Tapping the corner badge opens the job's reports list; required for the badge to render. */
  onViewReports?: () => void
}) {
  const { showReminder, onClick, buttonTitle, singleLine = false, reportCount = 0, onViewReports } = props
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ position: 'relative', display: 'inline-block' }}>
        {/* Report-due state (v2.1549): the button itself turns amber and says
            why — no overlay covering the label. Blue "Leave Report" otherwise. */}
        <button
          type="button"
          onClick={onClick}
          title={showReminder ? 'Scheduled work ended — leave a job report.' : buttonTitle}
          style={{
            padding: '0.35rem 0.75rem',
            fontSize: '0.875rem',
            background: showReminder ? '#f2c230' : '#3b82f6',
            color: showReminder ? '#4a3800' : 'white',
            fontWeight: showReminder ? 600 : undefined,
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {showReminder
            ? singleLine
              ? 'Report due'
              : (
                  <>
                    Report<br />due
                  </>
                )
            : singleLine
              ? 'Leave Report'
              : (
                  <>
                    Leave<br />Report
                  </>
                )}
        </button>
        {reportCount > 0 && onViewReports ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onViewReports()
            }}
            aria-label={`View ${reportCount} ${reportCount === 1 ? 'report' : 'reports'} for this job`}
            title={`View ${reportCount} ${reportCount === 1 ? 'report' : 'reports'} for this job`}
            style={{
              position: 'absolute',
              right: -8,
              bottom: -8,
              minWidth: 22,
              height: 22,
              borderRadius: 999,
              background: 'var(--surface)',
              border: showReminder ? '1.5px solid #b8901c' : '1.5px solid #3b82f6',
              color: showReminder ? '#7a5f10' : 'var(--text-link)',
              fontSize: '0.6875rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              padding: '0 5px',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            {/* Icon: Font Awesome Free 6.x — file-lines (OFL/CC-BY) */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width={9} height={11} fill="currentColor" aria-hidden focusable={false}>
              <path d="M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V160H256c-17.7 0-32-14.3-32-32V0H64zM256 0V128H384L256 0zM112 256H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16z" />
            </svg>
            {reportCount > 99 ? '99+' : reportCount}
          </button>
        ) : null}
      </span>
    </span>
  )
}
