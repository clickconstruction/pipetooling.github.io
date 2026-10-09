import { useState } from 'react'
import { Btn, Chip, input } from './gcUi'
import { appCertified, appOpen, appPaid, ownerPayDue } from '../../lib/gc/ownerBilling'
import { GC_PROMISE_CHANNELS, payDueWords } from '../../lib/gc/moneyIn'
import type { GcProject, GcState, OwnerPayAppSent } from '../../lib/gc/types'
import { money, shortDate, weekdayDate } from '../../lib/gc/words'

/**
 * GC mode, the real build, Owner Billing's O5c: money in on one certified bill in Bill the customer, ported from the
 * prototype's Bill the owner tab (branch spike/gc-mode). When it is due, what they paid, their word on when, and our
 * unconditional waiver for what came. Every press is the Pipeline's own on the billing job: `mark_invoice_paid` and
 * `add_job_payment_promise`, and the waiver window.
 */

export interface MoneyInWrites {
  /** Mark the rest of it paid, today. */
  onPaid: (number: number) => void
  onPayPart: (number: number, amount: number) => void
  onPromise: (number: number, by: string, note: string, channel: string | null) => void
  /** Our unconditional waiver for what they paid (`LienReleaseModal` on the bill). */
  onUnconditional: (number: number) => void
}

export function GcBillMoneyIn({
  state,
  project,
  app,
  writes,
  unconditional,
  busy,
}: {
  state: GcState
  project: GcProject
  app: OwnerPayAppSent
  writes: MoneyInWrites
  /** How many of our unconditional waivers name this bill already. */
  unconditional: number
  busy?: string | null
}) {
  const [open, setOpen] = useState<'part' | 'when' | null>(null)
  const [part, setPart] = useState('')
  const [by, setBy] = useState('')
  const [note, setNote] = useState('')
  const [channel, setChannel] = useState('')
  const certified = appCertified(app)
  if (certified === null || certified <= 0.005) return null
  const due = ownerPayDue(state, project, app)
  const paidSoFar = appPaid(app)
  const left = appOpen(app)
  const partNum = Number(part)
  const working = busy === `pay-${app.number}` || busy === `promise-${app.number}`
  const payments = app.payments ?? []
  const label = { display: 'grid', gap: '0.2rem', fontSize: '0.85rem', color: 'var(--text-muted)' } as const
  const box = { display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.6rem' } as const
  const newest = (app.promises ?? [])[(app.promises ?? []).length - 1]
  return (
    <div style={{ display: 'grid', gap: '0.3rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {app.paidOn !== null ? (
          <Chip tone="green">{`paid ${money(paidSoFar)} ${shortDate(app.paidOn)}`}</Chip>
        ) : (
          <>
            {paidSoFar > 0.005 && <Chip tone="green">{`paid ${money(paidSoFar)} of ${money(certified)}`}</Chip>}
            <Chip tone={due.daysLate > 0 ? 'red' : due.promised ? 'green' : 'amber'}>{payDueWords(due)}</Chip>
            <Btn kind="primary" disabled={working} onClick={() => writes.onPaid(app.number)} title="Records the rest of it paid today.">
              {`Mark paid ${money(left)}`}
            </Btn>
            <Btn kind="quiet" onClick={() => setOpen(open === 'part' ? null : 'part')}>
              They paid part…
            </Btn>
            <Btn kind="quiet" onClick={() => setOpen(open === 'when' ? null : 'when')}>
              They said when…
            </Btn>
          </>
        )}
        {unconditional > 0 && <Chip tone="green">{unconditional === 1 ? 'our unconditional waiver went' : `our unconditional waivers went for ${unconditional} payments`}</Chip>}
        {payments.length > unconditional && (
          <Btn kind="quiet" disabled={busy === `unconditional-${app.number}`} onClick={() => writes.onUnconditional(app.number)}>
            Make our unconditional waiver
          </Btn>
        )}
      </div>
      {app.paidOn === null && newest && (
        <div style={{ fontSize: '0.85rem', color: due.daysLate > 0 ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
          {`${newest.who === 'owner' ? 'In their portal' : `On ${shortDate(newest.madeOn)}`}, they said ${weekdayDate(newest.by)}${newest.note ? `: ${newest.note.replace(/[.\s]+$/, '')}` : ''}.`}
          {due.missed > 0 ? ` They missed ${due.missed === 1 ? 'an earlier day' : `${due.missed} earlier days`} before that.` : ''}
        </div>
      )}
      {open === 'part' && app.paidOn === null && (
        <div style={box}>
          <label style={label}>
            What they paid
            <input aria-label={`What they paid on pay application ${app.number}`} style={{ ...input, width: '9rem' }} type="number" min={0} max={left} value={part} onChange={(e) => setPart(e.target.value)} />
          </label>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{money(left)} is open.</span>
          <Btn
            kind="primary"
            disabled={!(partNum > 0) || partNum > left + 0.005 || working}
            onClick={() => {
              writes.onPayPart(app.number, partNum)
              setOpen(null)
              setPart('')
            }}
          >
            Record it
          </Btn>
        </div>
      )}
      {open === 'when' && app.paidOn === null && (
        <div style={box}>
          <label style={label}>
            They will pay by
            <input aria-label={`The day they will pay pay application ${app.number}`} style={input} type="date" value={by} onChange={(e) => setBy(e.target.value)} />
          </label>
          <label style={label}>
            How they told us
            <select aria-label={`How they told us about pay application ${app.number}`} style={input} value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="">Pick one</option>
              {GC_PROMISE_CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ ...label, flex: '1 1 12rem' }}>
            What they said
            <input aria-label={`What they said about pay application ${app.number}`} style={{ ...input, width: '100%', minWidth: 0 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Who said it" />
          </label>
          <Btn
            kind="primary"
            disabled={by === '' || working}
            onClick={() => {
              writes.onPromise(app.number, by, note.trim(), channel || null)
              setOpen(null)
              setBy('')
              setNote('')
              setChannel('')
            }}
          >
            Record it
          </Btn>
        </div>
      )}
    </div>
  )
}
