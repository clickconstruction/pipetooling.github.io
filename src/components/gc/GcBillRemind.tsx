import { useState } from 'react'
import { Btn, input } from './gcUi'
import { payReminderEmail, payReminderSentWords, payReminderStep } from '../../lib/gc/ownerBillingRemind'
import type { GcProject, GcState, OwnerPayAppSent } from '../../lib/gc/types'

/**
 * GC mode, the real build, Owner Billing's O5b: remind the customer to pay a late bill in Bill the customer, ported
 * from the prototype's pay reminder send (`GcCustomerPayReminder`, branch spike/gc-mode). The kernel says which bills
 * can be reminded (`payReminderStep`: certified, open, past the day it was due). The send shows the pay-by day, five
 * days out to start, the office's own line and the email as the customer will read it. `gc_remind_customer_to_pay`
 * files it with one note on the chase list, and `gc-customer-email` sends it.
 */

export interface RemindWrites {
  /** Remind them to pay a late bill by a day, with a line of the office's own. */
  onRemind: (number: number, by: string, note: string) => void
}

export function GcBillRemind({
  state,
  project,
  app,
  writes,
  busy,
}: {
  state: GcState
  project: GcProject
  app: OwnerPayAppSent
  writes: RemindWrites
  busy?: string | null
}) {
  const step = payReminderStep(state, project, app.number)
  const [open, setOpen] = useState(false)
  const [by, setBy] = useState(step?.by ?? state.today)
  const [note, setNote] = useState('')
  const sent = payReminderSentWords(state, project, app.number)
  if (!step && !sent) return null
  const reminders = app.reminders ?? []
  const last = reminders[reminders.length - 1]
  const working = busy === `remind-${app.number}`
  const email = payReminderEmail(state, state.customers.find((c) => c.id === project.customerId), project, app.number, by, note)
  const label = { display: 'grid', gap: '0.2rem', fontSize: '0.85rem', color: 'var(--text-muted)' } as const
  return (
    <div style={{ display: 'grid', gap: '0.3rem' }}>
      {sent && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{`${sent}${last?.emailed === false ? ' The email did not go.' : ''}`}</div>}
      {step && !open && (
        <div>
          <Btn kind="quiet" disabled={working} onClick={() => setOpen(true)}>
            Remind them to pay
          </Btn>
        </div>
      )}
      {step && open && (
        <div style={{ display: 'grid', gap: '0.45rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.6rem' }}>
          <div style={{ fontSize: '0.875rem' }}>{step.history}</div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={label}>
              {step.dayWord}
              <input aria-label={`The day to pay pay application ${app.number} by`} style={input} type="date" value={by} min={state.today} onChange={(e) => setBy(e.target.value)} />
            </label>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', flex: 1, minWidth: '12rem' }}>{step.dayNote}</span>
          </div>
          <label style={label}>
            Your line in it
            <textarea
              aria-label={`Your line in the reminder on pay application ${app.number}`}
              style={{ ...input, width: '100%', minWidth: 0, minHeight: '3rem', resize: 'vertical' }}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div style={{ display: 'grid', gap: '0.3rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.45rem 0.6rem', fontSize: '0.85rem' }}>
            <strong>{email.subject}</strong>
            {email.lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{`It goes to ${project.owner || 'the customer'} by email, with their portal link when they have one.`}</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Btn
              kind="primary"
              disabled={working || by === '' || by < state.today}
              onClick={() => {
                writes.onRemind(app.number, by, note.trim())
                setOpen(false)
                setNote('')
              }}
            >
              {step.sendLabel}
            </Btn>
            <Btn kind="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}
