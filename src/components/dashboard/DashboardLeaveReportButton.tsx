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
}) {
  const { showReminder, onClick, buttonTitle, singleLine = false } = props
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
      </span>
    </span>
  )
}
