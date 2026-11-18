import { useState } from 'react'
import type { UserRole } from '../../hooks/useAuth'
import {
  readJobModeCardDismissed,
  readJobModeStoredValue,
  showJobModeFirstRunCard,
  writeJobModeCardDismissed,
} from '../../lib/jobModeToggle'
import { recordJobModeEnabledOncePerSession } from '../../lib/jobModeTelemetry'

/**
 * One-time Dashboard card — "Working in the field? Turn on Job Mode" — for the
 * roles that CAN use Job Mode but default off and plausibly work on site
 * (master_technician, superintendent). Sub-like roles never see it (Job Mode is
 * on by default for them, v2.2877 / journey-map Tier-2 #26); office roles never
 * see it (`showJobModeFirstRunCard`). One tap turns Job Mode on (stored
 * per user + device with provenance `card`) and the Dashboard re-renders into
 * the Job Mode card; "Not now" hides it for good on this device. "Not now" sits at the
 * left edge and the green press at the right (v2.7787).
 */
export default function DashboardJobModeFirstRunCard({
  userId,
  role,
  onEnable,
}: {
  userId: string | null | undefined
  role: UserRole | string | null | undefined
  /** Turn Job Mode on — the Dashboard passes the hook's setter with source `card`. */
  onEnable: () => void
}) {
  const [dismissed, setDismissed] = useState(() => readJobModeCardDismissed(userId))
  if (!userId) return null
  if (!showJobModeFirstRunCard(role, readJobModeStoredValue(userId), dismissed)) return null

  function dismiss() {
    writeJobModeCardDismissed(userId)
    setDismissed(true)
  }

  return (
    <section
      aria-label="Turn on Job Mode"
      data-testid="job-mode-first-run-card"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.6rem 1rem',
        padding: '0.75rem 0.9rem',
        marginBottom: '1rem',
        borderRadius: 10,
        border: '1px solid var(--border-green)',
        background: 'var(--bg-green-tint)',
        color: 'var(--text-base)',
      }}
    >
      <div style={{ flex: '9999 1 240px', minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>Working in the field? Turn on Job Mode.</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
          One big card with your current job, today&apos;s stops, Clock In, Leave Report and Next Job. You can turn it
          off any time from the gear menu.
        </div>
      </div>
      {/* Not now on the left, Turn on Job Mode on the right. Under the words on a phone the row is the card's whole
          width, so the two sit at its two edges. Beside the words on a desk it is only as wide as the two presses. */}
      <div data-job-mode-card-presses style={{ flex: '1 0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={dismiss}
          style={{
            padding: '0.55rem 0.8rem',
            borderRadius: 8,
            border: '1px solid var(--border-strong)',
            background: 'var(--surface)',
            color: 'var(--text-gray-800)',
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Not now
        </button>
        <button
          type="button"
          onClick={() => {
            recordJobModeEnabledOncePerSession(userId, typeof role === 'string' ? role : null, 'card')
            onEnable()
            try {
              window.scrollTo({ top: 0 })
            } catch {
              /* ignore */
            }
          }}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: 8,
            border: 'none',
            background: '#16a34a',
            color: 'white',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          Turn on Job Mode
        </button>
      </div>
    </section>
  )
}
