/**
 * Send for signature (punch list #212, PR 3): the panel inside the Hours statement window that picks the channel the
 * signing link goes by — the four the contract window has (the owner's call 1): **Email the link**, **Text the link**,
 * **Copy the link**, **Hand the phone to <name>**. The worker's email and cell come filled from the roster and may be
 * changed for this send; a channel with nothing to reach the worker by is dead with its reason. Pure words and rules in
 * `lib/people/hoursStatementSigning.ts`; the window does the calls.
 */
import type { CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { HOURS_STATEMENT_CHANNELS, hoursStatementChannelHint, hoursStatementChannelLabel, hoursStatementChannelProblem, type HoursStatementChannel } from '../../lib/people/hoursStatementSigning'

export type HoursStatementContact = { email: string; phone: string }

const field: CSSProperties = { padding: '0.35rem 0.5rem', fontSize: '0.875rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit', width: '100%', boxSizing: 'border-box' }
const label: CSSProperties = { display: 'grid', gap: '0.2rem', fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }
const quiet: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }
const btn: CSSProperties = { font: 'inherit', fontSize: '0.875rem', padding: '0.45rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', fontWeight: 600, textAlign: 'left' }
const btnDead: CSSProperties = { ...btn, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, border: '1px solid transparent', cursor: 'not-allowed' }

export function HoursStatementSendSheet({
  workerName,
  contact,
  onContactChange,
  busy,
  onPick,
  onCancel,
}: {
  workerName: string
  /** Null while the worker's contact is still being read. */
  contact: HoursStatementContact | null
  onContactChange: (next: HoursStatementContact) => void
  /** The channel in flight, or null. */
  busy: HoursStatementChannel | null
  onPick: (channel: HoursStatementChannel) => void
  onCancel: () => void
}) {
  const c = contact ?? { email: '', phone: '' }
  return (
    <section aria-labelledby="hours-statement-send-title" data-testid="hours-statement-send-sheet" style={{ display: 'grid', gap: '0.7rem', padding: '0.8rem 1rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
        <h3 id="hours-statement-send-title" style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)', flex: 1 }}>
          Send for signature · {workerName}
        </h3>
        <button type="button" style={{ ...btn, padding: '0.25rem 0.6rem', fontSize: '0.8125rem' }} onClick={onCancel} disabled={busy != null}>
          Cancel
        </button>
      </div>
      <p style={quiet}>The worker reads the paper, types any days the app did not record, signs with a finger or a typed name, and the signed PDF files itself on this job and on their desk.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
        <label style={label}>
          Worker’s email
          <input type="email" style={field} value={c.email} placeholder={contact ? 'name@example.com' : 'Reading…'} disabled={!contact || busy != null} onChange={(e) => onContactChange({ ...c, email: e.target.value })} aria-label="Worker’s email" />
        </label>
        <label style={label}>
          Worker’s cell
          <input type="tel" style={field} value={c.phone} placeholder={contact ? '(555) 555-0100' : 'Reading…'} disabled={!contact || busy != null} onChange={(e) => onContactChange({ ...c, phone: e.target.value })} aria-label="Worker’s cell" />
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.5rem' }}>
        {HOURS_STATEMENT_CHANNELS.map((channel) => {
          const problem = contact ? hoursStatementChannelProblem(channel, c) : 'Reading the worker’s contact…'
          const dead = problem != null || busy != null
          const inFlight = busy === channel
          return (
            <div key={channel} style={{ display: 'grid', gap: '0.25rem' }}>
              <button type="button" style={dead && !inFlight ? btnDead : btn} disabled={dead} title={problem ?? undefined} aria-label={hoursStatementChannelLabel(channel, workerName)} onClick={() => onPick(channel)}>
                {inFlight ? 'Working…' : hoursStatementChannelLabel(channel, workerName)}
              </button>
              <span style={{ ...quiet, fontSize: '0.75rem', color: problem && contact ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>{problem && contact ? problem : hoursStatementChannelHint(channel)}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default HoursStatementSendSheet
