import AutosizeTextarea from '../AutosizeTextarea'
import { sendBackReasonError } from '../../lib/jobs/jobSendBackNote'

/**
 * Required reason field for the RTB → Working send-back confirms (v2.2065).
 * Shared by the Stages board and Dashboard Pipeline modals so the copy and
 * validation stay identical. The host disables its confirm button while
 * `sendBackReasonError(value) != null`.
 */
export default function SendBackReasonField({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}) {
  const err = sendBackReasonError(value)
  return (
    <label style={{ display: 'block', marginBottom: '1rem' }}>
      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
        Why is it going back?{' '}
        <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
          (required — the crew sees this on their schedule)
        </span>
      </span>
      <AutosizeTextarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minRows={2}
        disabled={disabled}
        placeholder="Missing the parts list, customer wants the trim redone…"
        style={{
          width: '100%',
          marginTop: '0.3rem',
          padding: '0.5rem',
          fontFamily: 'inherit',
          fontSize: '0.9375rem',
          border: '1px solid var(--border-strong)',
          borderRadius: 6,
          boxSizing: 'border-box',
        }}
      />
      {value.trim() !== '' && err != null ? (
        <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>
          {err}
        </span>
      ) : null}
    </label>
  )
}
