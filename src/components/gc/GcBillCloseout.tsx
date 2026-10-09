import { useState } from 'react'
import { Btn, Chip, input } from './gcUi'
import { ownerCloseout, type OwnerCloseoutStep } from '../../lib/gc/ownerBilling'
import type { GcProject, GcState } from '../../lib/gc/types'

/**
 * GC mode, the real build, Owner Billing's O7a: Closeout in Bill the customer, the way the prototype's Bill the owner tab
 * draws it (branch spike/gc-mode). `ownerCloseout`'s six steps, each with who moves it and the next one marked; Accept
 * the work once every line is billed (`gc_record_acceptance`, the office's way); and our final pay application once
 * every trade's final and the acceptance are in, through the same Send. The final waits on every trade's final by
 * design (the lead's call 1, 2026-10-08), so the trades' step says what stands in each one's way.
 */

export interface CloseoutWrites {
  /** The customer accepted the work: the day, who walked it, and a note. */
  onAccept: (on: string, byName: string, note: string) => void
  /** Send our final pay application; with `email`, email it to the customer and the architect with its form. */
  onSendFinal: (email: boolean) => void
}

const WHO: Record<OwnerCloseoutStep['who'], string> = {
  office: 'our office',
  trades: 'the trades',
  architect: 'the architect',
  owner: 'the customer',
}

export function GcBillCloseout({
  state,
  project,
  today,
  writes,
  busy,
}: {
  state: GcState
  project: GcProject
  today: string
  writes: CloseoutWrites
  busy?: string | null
}) {
  const [on, setOn] = useState(today)
  const [byName, setByName] = useState('')
  const [note, setNote] = useState('')
  // Off to start, as Send's: the final goes without an email until it is ticked.
  const [emailIt, setEmailIt] = useState(false)
  const closeout = ownerCloseout(state, project)
  // The trades' step lists each one still waiting, with what stands in its way (the kernel counts the same trades).
  const trades = project.packages.filter((p) => !p.selfPerform).length
  const billed = closeout.steps.find((s) => s.key === 'billed')?.done === true
  if (!billed && !closeout.final) return null
  const label = { display: 'grid', gap: '0.2rem', fontSize: '0.85rem', color: 'var(--text-muted)' } as const
  const readyToAccept = on !== '' && on <= today && byName.trim() !== ''
  return (
    <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.875rem' }}>
      <div style={{ fontWeight: 600 }}>Closeout</div>
      {closeout.steps.map((step) => (
        <div key={step.key} style={{ display: 'grid', gap: '0.1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <strong>{step.label}</strong>
            <span style={{ color: 'var(--text-muted)' }}>{WHO[step.who]}</span>
            {step.done ? <Chip tone="green">done</Chip> : step.key === closeout.next?.key ? <Chip tone="amber">next</Chip> : null}
          </div>
          {step.key === 'trades' && !step.done ? (
            <div style={{ color: 'var(--text-muted)', display: 'grid', gap: '0.1rem' }}>
              <div>{`${trades - closeout.tradesWaiting.length} of ${trades} trades have sent theirs.`}</div>
              {closeout.tradesWaiting.map((w) => (
                <div key={w.packageId} style={{ paddingLeft: '0.75rem' }}>
                  {w.why}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>{step.detail}</div>
          )}
        </div>
      ))}
      {closeout.canAccept && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.6rem' }}>
          <label style={label}>
            The day they accepted it
            <input aria-label="The day they accepted the work" style={input} type="date" value={on} max={today} onChange={(e) => setOn(e.target.value)} />
          </label>
          <label style={label}>
            Who walked it
            <input aria-label="Who walked the job and accepted it" style={input} value={byName} onChange={(e) => setByName(e.target.value)} />
          </label>
          <label style={{ ...label, flex: 1, minWidth: '12rem' }}>
            A note
            <input aria-label="A note on the acceptance" style={{ ...input, width: '100%', minWidth: 0 }} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <Btn kind="primary" disabled={!readyToAccept || busy === 'accept'} onClick={() => writes.onAccept(on, byName.trim(), note.trim())}>
            Accept the work
          </Btn>
        </div>
      )}
      {closeout.canSendFinal && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input type="checkbox" checked={emailIt} onChange={(e) => setEmailIt(e.target.checked)} />
            Email it to the customer and the architect now
          </label>
          <Btn kind="primary" disabled={busy === 'send-final'} onClick={() => writes.onSendFinal(emailIt)}>
            Send the final pay application
          </Btn>
        </div>
      )}
    </div>
  )
}
