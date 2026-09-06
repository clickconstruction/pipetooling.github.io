import { hoursApprovedChipCopy, type HoursApprovedNudge } from '../../lib/people/payWeekLinks'

/**
 * T5-03 (J7-9): the pointer across the Hours → Draft Payroll seam. Appears on People → Hours
 * after an approval for pay-access roles: "6 sessions approved · Draft payroll for Aug 24 – 30 →".
 * Opening Draft Payroll (or dismissing) clears it.
 */
export function HoursApprovedNudgeChip({
  nudge,
  onOpen,
  onDismiss,
}: {
  nudge: HoursApprovedNudge
  onOpen: () => void
  onDismiss: () => void
}) {
  const copy = hoursApprovedChipCopy(nudge)
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        marginBottom: '0.75rem',
        border: '1px solid #22c55e',
        background: 'var(--bg-green-tint)',
        color: 'var(--text-green-800)',
        borderRadius: 8,
        fontSize: '0.875rem',
      }}
    >
      <span style={{ fontWeight: 600 }}>{copy.lead}</span>
      <button
        type="button"
        onClick={onOpen}
        style={{
          font: 'inherit',
          fontWeight: 600,
          color: 'var(--text-link)',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        {copy.action}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        title="Dismiss"
        style={{
          marginLeft: 'auto',
          font: 'inherit',
          color: 'var(--text-muted)',
          background: 'transparent',
          border: 'none',
          padding: '0 0.25rem',
          cursor: 'pointer',
        }}
      >
        ×
      </button>
    </div>
  )
}
