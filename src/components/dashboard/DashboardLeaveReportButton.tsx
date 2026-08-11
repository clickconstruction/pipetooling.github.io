import type { MouseEventHandler } from 'react'

/**
 * "Leave Report" button + optional overlaid reminder badge, shared by the
 * Dashboard job-row family (Team Ready to Bill / Assigned Jobs) and the My
 * Schedule section. Moved verbatim from `src/pages/Dashboard.tsx`
 * (extraction-series refactor; no behavior change).
 */
/** The yellow circle-exclamation reminder icon, shared with the My Schedule banner. */
export function LeaveReportReminderIcon({ size = 21 }: { size?: number }) {
  return (
    // Icon: Font Awesome Free 7.x — circle exclamation (OFL/CC-BY)
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 640"
      width={size}
      height={size}
      aria-hidden
      focusable={false}
      style={{ color: '#FFE600', flexShrink: 0 }}
    >
      <path
        fill="currentColor"
        d="M320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576zM320 384C302.3 384 288 398.3 288 416C288 433.7 302.3 448 320 448C337.7 448 352 433.7 352 416C352 398.3 337.7 384 320 384zM320 192C301.8 192 287.3 207.5 288.6 225.7L296 329.7C296.9 342.3 307.4 352 319.9 352C332.5 352 342.9 342.3 343.8 329.7L351.2 225.7C352.5 207.5 338.1 192 319.8 192z"
      />
    </svg>
  )
}

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
        <button
          type="button"
          onClick={onClick}
          title={buttonTitle}
          style={{
            padding: '0.35rem 0.75rem',
            fontSize: '0.875rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {singleLine ? 'Leave Report' : <>Leave<br />Report</>}
        </button>
        {showReminder ? (
          <span
            role="status"
            aria-label="Scheduled work ended — leave a job report."
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'inline-flex',
              pointerEvents: 'none',
            }}
          >
            <LeaveReportReminderIcon />
          </span>
        ) : null}
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
              border: '1.5px solid #3b82f6',
              color: 'var(--text-link)',
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
