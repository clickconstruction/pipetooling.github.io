import { useEffect, useState } from 'react'
import { Btn, Chip, Stat, input } from './gcUi'
import { GcBillMoneyIn, type MoneyInWrites } from './GcBillMoneyIn'
import {
  appCertified,
  ownerAccount,
  ownerCarriedForward,
  ownerLateBills,
  ownerPayApp,
  ownerPayAppHasWork,
  ownerPayAppsSent,
  ownerRetainageWords,
} from '../../lib/gc/ownerBilling'
import type { GcProject, GcState, OwnerPayAppSent, OwnerRetainageStep } from '../../lib/gc/types'
import { money, shortDate } from '../../lib/gc/words'
import { emailedWords, type BillEmailed } from '../../lib/gc/customerEmail'

/**
 * GC mode, the real build, Owner Billing's O4a: Bill the customer, ported from the prototype's Bill the owner tab
 * (branch spike/gc-mode). Once a month our pay application to the customer: this month's bill drawn from the
 * kernels, its form as Excel or PDF, Send, the architect's certificate, which makes the bill the customer pays
 * on the Pipeline's own billing job, and where we stand with them. The database's functions check every step
 * (`gc_send_owner_pay_app`, `gc_record_certificate`); the window only carries the press. Until the app emails it
 * (O4b), the office sends the form from its own email. Money in on each certified bill (O5c) is `GcBillMoneyIn`.
 */

export interface BillCustomerWrites extends MoneyInWrites {
  /** Send this month's pay application; with `email`, email it to the customer and the architect with its form (O4b). */
  onSend: (email: boolean) => void
  /** Record the architect's certificate; with `email`, email the customer the certified bill (O4b-2). */
  onCertify: (number: number, amount: number, on: string, note: string, email: boolean) => void
  onSetRetainage: (pct: number, step: OwnerRetainageStep | null) => void
  onDownload: (which: number | 'draft', kind: 'xlsx' | 'pdf') => void
  /** Make our conditional waiver on progress payment for a sent one (`LienReleaseModal` on the billing job). */
  onWaiver: (number: number) => void
}

interface Props {
  /** The board's state with this project's billing laid on (`billingStateFor`). */
  state: GcState
  project: GcProject
  today: string
  writes: BillCustomerWrites
  /** The sent ones our conditional waiver already went with, by number. */
  waived?: number[]
  /** How many of our unconditional waivers name each sent one's bill, by number (O5c). */
  unconditional?: Record<number, number>
  /** Payments on the billing job that name no bill: shown as they are, never laid on a pay application (O5c). */
  unbilled?: { on: string | null; amount: number }[]
  /**
   * Who each sent one was emailed to and when, by number, read from its sent copies (O4b): the pay application and the
   * ask to certify it, then the certified bill.
   */
  emailed?: Record<number, BillEmailed[]>
  /** What a write is working on: 'send', 'retainage', 'cert-<n>', 'waiver-<n>' or 'file'. */
  busy?: string | null
  problem?: string | null
  onClose: () => void
}

export function GcBillCustomerWindow({ state, project, today, writes, waived = [], unconditional = {}, unbilled = [], emailed = {}, busy, problem, onClose }: Props) {
  const sent = ownerPayAppsSent(project)
  const account = ownerAccount(project)
  const late = ownerLateBills(state, project)
  const signed = project.ownerContractSignedOn !== null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name}: bill the customer`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(900px, 100%)', maxHeight: 'min(94vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{project.name} · bill the customer</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Once a month, our pay application to {project.owner || 'the customer'}. The architect certifies it, and what they certify is the bill they pay.
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
            ×
          </button>
        </div>

        <div style={{ padding: '0.8rem 1rem', overflowY: 'auto', display: 'grid', gap: '0.9rem' }}>
          {problem && (
            <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
              {problem}
            </div>
          )}

          {account && (
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
              <Stat label="Billed so far" value={money(account.billed)} />
              <Stat label="They hold back" value={money(account.retainageHeld)} />
              <Stat label="Certified or asked" value={money(account.asked)} />
              <Stat label="Waiting on the architect" value={money(account.waitingOnArchitect)} tone={account.waitingOnArchitect > 0 ? 'red' : undefined} />
            </div>
          )}

          {late.length > 0 && (
            <div style={{ display: 'grid', gap: '0.2rem', fontSize: '0.875rem', color: 'var(--text-red-700)' }}>
              {late.map((b) => (
                <div key={b.app.number}>{`Pay application ${b.app.number} is ${b.due.daysLate === 1 ? '1 day' : `${b.due.daysLate} days`} late: ${money(b.open)} open.`}</div>
              ))}
            </div>
          )}

          {unbilled.map((p, i) => (
            <div key={`unbilled-${i}`} style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {`A payment of ${money(p.amount)}${p.on ? ` on ${shortDate(p.on)}` : ''} on the billing job names no bill.`}
            </div>
          ))}

          {signed ? (
            <ThisMonth state={state} project={project} writes={writes} busy={busy} />
          ) : (
            <div style={{ fontSize: '0.875rem' }}>The contract with {project.owner || 'the customer'} is not marked signed yet. Mark it signed before the first bill.</div>
          )}

          <Retainage state={state} project={project} sentAny={sent.length > 0} writes={writes} busy={busy === 'retainage'} />

          {sent.length > 0 && (
            <div style={{ display: 'grid', gap: '0.45rem' }}>
              <div style={{ fontWeight: 600 }}>Sent</div>
              {[...sent].reverse().map((app) => (
                <SentRow key={app.number} state={state} project={project} app={app} today={today} writes={writes} waived={waived.includes(app.number)} unconditional={unconditional[app.number] ?? 0} emailed={emailed[app.number] ?? []} busy={busy} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ThisMonth({ state, project, writes, busy }: { state: GcState; project: GcProject; writes: BillCustomerWrites; busy?: string | null }) {
  // The email starts off: an untouched Send files the pay application and emails no one (O4b, the sends start off).
  const [email, setEmail] = useState(false)
  const app = ownerPayApp(state, project)
  const hasWork = ownerPayAppHasWork(app)
  const carried = ownerCarriedForward(app)
  const row = { display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.875rem' } as const
  const num = { fontVariantNumeric: 'tabular-nums', minWidth: '6.5rem', textAlign: 'right' } as const
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem', display: 'grid', gap: '0.4rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>Pay application {app.number}</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>for work through {shortDate(app.billOn)}</span>
      </div>
      <div style={{ ...row, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        <span style={{ flex: 1, minWidth: '9rem' }}>Line</span>
        <span style={num}>Worth</span>
        <span style={num}>This month</span>
        <span style={num}>So far</span>
      </div>
      {app.lines.map((l) => (
        <div key={l.id} style={row}>
          <span style={{ flex: 1, minWidth: '9rem' }}>{l.label}</span>
          <span style={num}>{money(l.worth)}</span>
          <span style={num}>{money(l.thisMonth)}</span>
          <span style={num}>{money(l.doneToDate)}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.4rem', display: 'grid', gap: '0.2rem', fontSize: '0.875rem' }}>
        <div style={row}>
          <span style={{ flex: 1 }}>Work so far{app.stored > 0.005 ? ', with materials stored' : ''}</span>
          <span style={num}>{money(app.doneToDate + app.stored)}</span>
        </div>
        <div style={row}>
          <span style={{ flex: 1 }}>They hold back, {ownerRetainageWords(app.retainagePct, app.retainageStep)}</span>
          <span style={num}>−{money(app.retainage)}</span>
        </div>
        <div style={row}>
          <span style={{ flex: 1 }}>Less earlier certificates</span>
          <span style={num}>−{money(app.askedBefore)}</span>
        </div>
        <div style={{ ...row, fontWeight: 700 }}>
          <span style={{ flex: 1 }}>This bill asks</span>
          <span style={num}>{money(app.due)}</span>
        </div>
        {carried > 0 && <div style={{ color: 'var(--text-muted)' }}>{`It asks again for ${money(carried)} the architect left out before.`}</div>}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn kind="primary" disabled={!hasWork || busy === 'send'} onClick={() => writes.onSend(email)}>
          {`Send pay application ${app.number}`}
        </Btn>
        <Btn kind="quiet" disabled={busy === 'file'} onClick={() => writes.onDownload('draft', 'xlsx')}>
          See the form in Excel
        </Btn>
        <Btn kind="quiet" disabled={busy === 'file'} onClick={() => writes.onDownload('draft', 'pdf')}>
          See the form as a PDF
        </Btn>
        {!hasWork && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nothing new to bill since the last one.</span>}
      </div>
      <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.875rem' }}>
        <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
        Email it to the customer and the architect now
      </label>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        {email
          ? `It goes to ${project.owner || 'the customer'} and ${project.architect || 'the architect'} by email now, with the form. Make our conditional waiver under Sent after. It goes in its own email.`
          : 'Send files the pay application without an email. Tick Email it to the customer and the architect now to email it too.'}
      </div>
    </div>
  )
}

function Retainage({ state, project, sentAny, writes, busy }: { state: GcState; project: GcProject; sentAny: boolean; writes: BillCustomerWrites; busy: boolean }) {
  const app = ownerPayApp(state, project)
  const [open, setOpen] = useState(false)
  const [pct, setPct] = useState(String(app.retainagePct))
  const [stepOn, setStepOn] = useState(Boolean(project.ownerRetainageStep))
  const [atPct, setAtPct] = useState(String(project.ownerRetainageStep?.atPct ?? 50))
  const [toPct, setToPct] = useState(String(project.ownerRetainageStep?.toPct ?? 5))
  const [way, setWay] = useState<OwnerRetainageStep['way']>(project.ownerRetainageStep?.way ?? 'after')
  const pctNum = Number(pct)
  const step: OwnerRetainageStep | null = stepOn ? { atPct: Number(atPct), toPct: Number(toPct), way } : null
  const ready = pct.trim() !== '' && pctNum >= 0 && pctNum <= 100 && (!step || (step.atPct > 0 && step.atPct < 100 && step.toPct >= 0 && step.toPct < pctNum))
  const label = { display: 'grid', gap: '0.2rem', fontSize: '0.85rem', color: 'var(--text-muted)' } as const
  return (
    <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.875rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>Retainage</strong>
        <span>{`They hold ${ownerRetainageWords(app.retainagePct, project.ownerRetainageStep)}.`}</span>
        {!open && (
          <Btn kind="quiet" onClick={() => setOpen(true)}>
            Change the retainage
          </Btn>
        )}
      </div>
      {open && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem', display: 'grid', gap: '0.5rem' }}>
          {sentAny && <Chip tone="amber">Bills that went keep the retainage they went with. A change counts from the next one.</Chip>}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={label}>
              Percent they hold
              <input style={{ ...input, width: '6rem' }} type="number" min={0} max={100} step={0.5} value={pct} onChange={(e) => setPct(e.target.value)} />
            </label>
            <label style={{ ...label, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <input type="checkbox" checked={stepOn} onChange={(e) => setStepOn(e.target.checked)} />
              It goes down partway
            </label>
          </div>
          {stepOn && (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={label}>
                Once the work is this far done
                <input style={{ ...input, width: '6rem' }} type="number" min={1} max={99} value={atPct} onChange={(e) => setAtPct(e.target.value)} />
              </label>
              <label style={label}>
                They hold
                <input style={{ ...input, width: '6rem' }} type="number" min={0} step={0.5} value={toPct} onChange={(e) => setToPct(e.target.value)} />
              </label>
              <label style={label}>
                On
                <select style={input} value={way} onChange={(e) => setWay(e.target.value as OwnerRetainageStep['way'])}>
                  <option value="after">the rest of the work</option>
                  <option value="all">all of the work</option>
                </select>
              </label>
            </div>
          )}
          {ready && <div style={{ color: 'var(--text-muted)' }}>{`They will hold ${ownerRetainageWords(pctNum, step ?? undefined)}.`}</div>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Btn
              kind="primary"
              disabled={!ready || busy}
              onClick={() => {
                writes.onSetRetainage(pctNum, step)
                setOpen(false)
              }}
            >
              Save the retainage
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

function SentRow({
  state,
  project,
  app,
  today,
  writes,
  waived,
  unconditional,
  emailed,
  busy,
}: {
  state: GcState
  project: GcProject
  app: OwnerPayAppSent
  today: string
  writes: BillCustomerWrites
  waived: boolean
  unconditional: number
  emailed: BillEmailed[]
  busy?: string | null
}) {
  const certified = appCertified(app)
  const asked = Math.round(app.due * 100) / 100
  const [amount, setAmount] = useState(String(asked))
  const [on, setOn] = useState(today)
  const [note, setNote] = useState('')
  // Off to start, as Send's: recording the certificate emails no one until it is ticked (O4b-2).
  const [emailIt, setEmailIt] = useState(false)
  const amountNum = Number(amount)
  const less = amount.trim() !== '' && amountNum < asked
  const ready = amount.trim() !== '' && amountNum >= 0 && amountNum <= asked && on !== '' && (!less || note.trim() !== '')
  const working = busy === `cert-${app.number}`
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.45rem', display: 'grid', gap: '0.3rem', fontSize: '0.875rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>{`Pay application ${app.number}${app.final ? ', final' : ''}`}</strong>
        <span style={{ color: 'var(--text-muted)' }}>{`through ${shortDate(app.periodTo)} · sent ${shortDate(app.sentOn)}`}</span>
        <span style={{ flex: 1 }} />
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(app.due)}</strong>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {certified !== null ? (
          <Chip tone="green">{`certified ${money(certified)} on ${shortDate(app.certifiedOn ?? app.sentOn)}`}</Chip>
        ) : (
          <Chip tone="amber">waiting on the architect</Chip>
        )}
        {certified !== null && certified < asked && app.certifiedNote && <span style={{ color: 'var(--text-muted)' }}>{app.certifiedNote}</span>}
        {waived ? (
          <Chip tone="green">our waiver went with it</Chip>
        ) : (
          <Btn kind="quiet" disabled={busy === `waiver-${app.number}`} onClick={() => writes.onWaiver(app.number)}>
            Make our conditional waiver
          </Btn>
        )}
        <span style={{ flex: 1 }} />
        <Btn kind="quiet" disabled={busy === 'file'} onClick={() => writes.onDownload(app.number, 'xlsx')}>
          Excel
        </Btn>
        <Btn kind="quiet" disabled={busy === 'file'} onClick={() => writes.onDownload(app.number, 'pdf')}>
          PDF
        </Btn>
      </div>
      {emailedWords(emailed).map((w) => (
        <div key={w} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {w}
        </div>
      ))}
      <GcBillMoneyIn state={state} project={project} app={app} writes={writes} unconditional={unconditional} busy={busy} />
      {certified === null && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ display: 'grid', gap: '0.2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            What the architect certified
            <input aria-label={`What the architect certified on pay application ${app.number}`} style={{ ...input, width: '8rem' }} type="number" min={0} max={asked} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: '0.2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            The day they signed it
            <input aria-label={`The day the architect certified pay application ${app.number}`} style={input} type="date" value={on} min={app.sentOn} max={today} onChange={(e) => setOn(e.target.value)} />
          </label>
          {less && (
            <label style={{ display: 'grid', gap: '0.2rem', color: 'var(--text-muted)', fontSize: '0.85rem', flex: 1, minWidth: '12rem' }}>
              Why it is less
              <input aria-label={`Why the certificate on pay application ${app.number} is less`} style={{ ...input, width: '100%', minWidth: 0 }} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          )}
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input type="checkbox" checked={emailIt && amountNum > 0} disabled={!(amountNum > 0)} onChange={(e) => setEmailIt(e.target.checked)} />
            Email the customer the bill now
          </label>
          <Btn kind="primary" disabled={!ready || working} onClick={() => writes.onCertify(app.number, amountNum, on, note.trim(), emailIt && amountNum > 0)}>
            Record the certificate
          </Btn>
        </div>
      )}
    </div>
  )
}
