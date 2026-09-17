/**
 * Move or remove a sub sheet payment (v2.3562). Two always-mounted dialogs driven by an
 * imperative handle, the same way SubLaborPaymentModals is — they open from the sheet form's
 * Payments table (and from the Edit dialog's Remove button).
 *
 * Move: the same sub's other sheets first, a search for any other, and a "What changes" panel
 * that reads both sheets before and after (kernel `planSubPaymentMove`). Remove: reason chips,
 * "Wrong job" as the door to Move, and the promise of a 30-day Undo on the sheet's trace line.
 * Both write through one RPC each; the parent reloads the ledger.
 */
import { forwardRef, useImperativeHandle, useMemo, useState, type CSSProperties, type ForwardedRef } from 'react'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import type { LaborJob } from '../../types/laborJob'
import type { EditingPaymentTarget } from './SubLaborPaymentModals'
import {
  SUB_PAYMENT_REMOVE_REASONS,
  SUB_PAYMENT_UNDO_DAYS,
  planSubPaymentMove,
  rankSubPaymentMoveDestinations,
  sheetLabel,
  subPaymentRemoveReasonText,
  type SubPaymentRemoveReasonKey,
} from '../../lib/jobs/subPaymentMoveRemove'

export type SubLaborPaymentMoveRemoveHandle = {
  openMove: (payment: EditingPaymentTarget) => void
  openRemove: (payment: EditingPaymentTarget) => void
  clear: () => void
}

export type SubLaborPaymentMoveRemoveModalsProps = {
  laborJobs: LaborJob[]
  laborJobAssigneesByJobId: ReadonlyMap<string, ReadonlyArray<{ personId: string }>>
  laborJobNamesByJobId: Record<string, string>
  moveLaborJobPayment: (paymentId: string, toJobId: string, reason: string | null) => Promise<boolean>
  removeLaborJobPayment: (paymentId: string, reason: string | null) => Promise<boolean>
}

const overlay: CSSProperties = { position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }
const panel: CSSProperties = { background: 'var(--surface)', borderRadius: 10, width: '100%', maxWidth: 560, maxHeight: 'min(92vh, 100%)', overflow: 'auto', padding: '1.25rem 1.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '0.85rem' }
const h2: CSSProperties = { margin: 0, fontSize: '1.25rem', fontWeight: 700 }
const btn: CSSProperties = { font: 'inherit', padding: '0.6rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem' }
const primary: CSSProperties = { ...btn, background: '#2563eb', color: 'white', border: 'none', fontWeight: 600 }
const danger: CSSProperties = { ...btn, background: '#dc2626', color: 'white', border: 'none', fontWeight: 600 }
const input: CSSProperties = { font: 'inherit', width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.95rem', background: 'var(--surface)', color: 'var(--text-strong)' }
const chip = (on: boolean): CSSProperties => ({ font: 'inherit', padding: '0.45rem 0.8rem', borderRadius: 999, border: on ? '1px solid #2563eb' : '1px solid var(--border-strong)', background: on ? '#2563eb' : 'var(--surface)', color: on ? 'white' : 'var(--text-700)', fontSize: '0.85rem', fontWeight: on ? 600 : 400, cursor: 'pointer' })
const quiet: CSSProperties = { fontSize: '0.85rem', color: 'var(--text-700)', lineHeight: 1.5, borderLeft: '3px solid var(--border-strong)', paddingLeft: '0.65rem' }

function paymentSummary(p: EditingPaymentTarget): string {
  const kind = p.isBackcharge ? 'Backcharge' : 'Payment'
  const when = p.paymentDate ? new Date(p.paymentDate + 'T00:00:00').toLocaleDateString() : p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ''
  return [`$${formatCurrency(Math.abs(p.amount))}`, kind, when, (p.memo ?? '').trim()].filter(Boolean).join(' · ')
}

function SubLaborPaymentMoveRemoveModalsInner(
  { laborJobs, laborJobAssigneesByJobId, laborJobNamesByJobId, moveLaborJobPayment, removeLaborJobPayment }: SubLaborPaymentMoveRemoveModalsProps,
  ref: ForwardedRef<SubLaborPaymentMoveRemoveHandle>,
) {
  const [moving, setMoving] = useState<EditingPaymentTarget | null>(null)
  const [moveQuery, setMoveQuery] = useState('')
  const [moveToId, setMoveToId] = useState<string | null>(null)
  const [moveReason, setMoveReason] = useState('wrong job')
  const [moveBusy, setMoveBusy] = useState(false)
  const [removing, setRemoving] = useState<EditingPaymentTarget | null>(null)
  const [removeReason, setRemoveReason] = useState<SubPaymentRemoveReasonKey | null>(null)
  const [removeNote, setRemoveNote] = useState('')
  const [removeBusy, setRemoveBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useImperativeHandle(ref, () => ({
    openMove: (payment) => {
      setError(null)
      setMoveQuery('')
      setMoveToId(null)
      setMoveReason('wrong job')
      setRemoving(null)
      setMoving(payment)
    },
    openRemove: (payment) => {
      setError(null)
      setRemoveReason(null)
      setRemoveNote('')
      setMoving(null)
      setRemoving(payment)
    },
    clear: () => {
      setMoving(null)
      setRemoving(null)
    },
  }))

  const fromSheet = useMemo(() => (moving ? laborJobs.find((j) => j.id === moving.jobId) ?? null : null), [moving, laborJobs])
  const destinations = useMemo(
    () => (moving ? rankSubPaymentMoveDestinations(laborJobs, moving.jobId, laborJobAssigneesByJobId, laborJobNamesByJobId, moveQuery) : []),
    [moving, laborJobs, laborJobAssigneesByJobId, laborJobNamesByJobId, moveQuery],
  )
  const toSheet = useMemo(() => (moveToId ? laborJobs.find((j) => j.id === moveToId) ?? null : null), [moveToId, laborJobs])
  const plan = useMemo(() => {
    if (!moving || !fromSheet || !toSheet) return null
    const payment = fromSheet.payments?.find((p) => p.id === moving.id) ?? { id: moving.id, amount: moving.isBackcharge ? -Math.abs(moving.amount) : Math.abs(moving.amount) }
    return planSubPaymentMove(payment, fromSheet, toSheet, laborJobNamesByJobId)
  }, [moving, fromSheet, toSheet, laborJobNamesByJobId])

  async function submitMove() {
    if (!moving || !toSheet) return
    setMoveBusy(true)
    setError(null)
    const ok = await moveLaborJobPayment(moving.id, toSheet.id, moveReason.trim() || null)
    setMoveBusy(false)
    if (ok) setMoving(null)
    else setError('Could not move the payment. Try again, or check that the migration is applied.')
  }

  async function submitRemove() {
    if (!removing) return
    setRemoveBusy(true)
    setError(null)
    const ok = await removeLaborJobPayment(removing.id, subPaymentRemoveReasonText(removeReason, removeNote))
    setRemoveBusy(false)
    if (ok) setRemoving(null)
    else setError('Could not remove the payment. Try again, or check that the migration is applied.')
  }

  const money = (n: number) => `$${formatCurrency(n)}`

  return (
    <>
      {moving ? (
        <div role="presentation" style={overlay} onClick={() => !moveBusy && setMoving(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="sub-payment-move-title" style={panel} onClick={(e) => e.stopPropagation()} data-testid="sub-payment-move-dialog">
            <h2 id="sub-payment-move-title" style={h2}>Move this {moving.isBackcharge ? 'backcharge' : 'payment'}</h2>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', background: 'var(--bg-subtle)', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.9rem' }}>
              <span><strong>{paymentSummary(moving)}</strong></span>
              <span style={{ color: 'var(--text-muted)' }}>on {fromSheet ? sheetLabel(fromSheet, laborJobNamesByJobId) : 'this sheet'}</span>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem', fontWeight: 600 }}>
              To which sheet?
              <input type="search" value={moveQuery} onChange={(e) => { setMoveQuery(e.target.value); setMoveToId(null) }} placeholder="Search by job number, address or sub" style={{ ...input, fontWeight: 400 }} />
            </label>
            <div style={{ fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              {moveQuery.trim() ? 'Matching sheets — the same sub first' : `${fromSheet?.assigned_to_name ?? 'The sub'}'s other sheets`}
            </div>
            <div role="listbox" aria-label="Destination sheet" style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 220, overflowY: 'auto' }}>
              {destinations.length === 0 ? (
                <div style={{ padding: '0.7rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {moveQuery.trim() ? 'No sheet matches.' : 'No other sheet for this sub — search above for any sheet.'}
                </div>
              ) : (
                destinations.map(({ sheet, sameSub }) => {
                  const on = sheet.id === moveToId
                  const m = sheetMoneyLine(sheet)
                  return (
                    <button
                      key={sheet.id}
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => setMoveToId(sheet.id)}
                      style={{ font: 'inherit', textAlign: 'left', padding: '0.6rem 0.75rem', border: 'none', borderBottom: '1px solid var(--border)', borderLeft: on ? '3px solid #2563eb' : '3px solid transparent', background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600 }}>{sheetLabel(sheet, laborJobNamesByJobId)}</span>
                        <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {sameSub ? sheet.assigned_to_name : <strong>{sheet.assigned_to_name}</strong>} · {m}
                          {sheet.job_date ? ` · sheet dated ${new Date(sheet.job_date + 'T00:00:00').toLocaleDateString()}` : ''}
                        </span>
                      </span>
                      {on ? <span style={{ fontSize: '0.75rem', color: 'var(--text-blue-800)', fontWeight: 600 }}>Selected</span> : null}
                    </button>
                  )
                })
              )}
            </div>
            {plan ? (
              <div data-testid="sub-payment-move-plan" style={{ border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text-700)' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-amber-700)' }}>What changes</div>
                <div>{plan.from.label}: paid {money(plan.from.paidBefore)} → <strong>{money(plan.from.paidAfter)}</strong>, owed {money(plan.from.owedBefore)} → <strong>{money(plan.from.owedAfter)}</strong></div>
                <div>{plan.to.label}: paid {money(plan.to.paidBefore)} → <strong>{money(plan.to.paidAfter)}</strong>, owed {money(plan.to.owedBefore)} → <strong>{money(plan.to.owedAfter)}{plan.toPaidInFull ? ' · paid in full' : ''}</strong></div>
                <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>Date, memo and the portal-visibility setting travel with it.</div>
              </div>
            ) : null}
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem', fontWeight: 600 }}>
              Why (kept with the trace)
              <input type="text" value={moveReason} onChange={(e) => setMoveReason(e.target.value)} style={{ ...input, fontWeight: 400 }} />
            </label>
            <div style={quiet}>Both sheets keep a grey line — <em>Moved {fromSheet ? sheetLabel(fromSheet, laborJobNamesByJobId) : ''} → {toSheet ? sheetLabel(toSheet, laborJobNamesByJobId) : '…'}</em>, who and why. Nothing to tick; it is always written. Moving it back is another Move.</div>
            {error ? <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{error}</div> : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" onClick={() => setMoving(null)} disabled={moveBusy} style={btn}>Cancel</button>
              <button type="button" onClick={() => void submitMove()} disabled={moveBusy || !toSheet} style={{ ...primary, opacity: moveBusy || !toSheet ? 0.6 : 1 }}>
                {moveBusy ? 'Moving…' : toSheet ? `Move ${money(Math.abs(moving.amount))} to ${(toSheet.job_number ?? '').trim() || 'that sheet'}` : 'Pick a sheet'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {removing ? (
        <div role="presentation" style={overlay} onClick={() => !removeBusy && setRemoving(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="sub-payment-remove-title" style={{ ...panel, maxWidth: 500 }} onClick={(e) => e.stopPropagation()} data-testid="sub-payment-remove-dialog">
            <h2 id="sub-payment-remove-title" style={h2}>Remove this {removing.isBackcharge ? 'backcharge' : 'payment'}?</h2>
            <div style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-700)' }}>
              Removes <strong>{paymentSummary(removing)}</strong> from <strong>{fromSheetFor(removing, laborJobs, laborJobNamesByJobId)}</strong>. The sheet's balance moves by that amount and the line leaves the sub's portal.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Why?</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }} role="group" aria-label="Reason">
                {SUB_PAYMENT_REMOVE_REASONS.map((r) => (
                  <button key={r.key} type="button" aria-pressed={removeReason === r.key} onClick={() => setRemoveReason(r.key)} style={chip(removeReason === r.key)}>
                    {r.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const p = removing
                    setRemoving(null)
                    setError(null)
                    setMoveQuery('')
                    setMoveToId(null)
                    setMoveReason('wrong job')
                    setMoving(p)
                  }}
                  style={{ ...chip(false), border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)', fontWeight: 600 }}
                >
                  Wrong job → Move it instead
                </button>
              </div>
              <input type="text" value={removeNote} onChange={(e) => setRemoveNote(e.target.value)} placeholder="A few words (optional)" style={input} />
            </div>
            <div style={quiet}>The sheet keeps a grey line — <em>Removed · who · why</em> — with <strong>Undo</strong> on it for {SUB_PAYMENT_UNDO_DAYS} days. The portal shows the line without the reason.</div>
            {error ? <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{error}</div> : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" onClick={() => setRemoving(null)} disabled={removeBusy} style={btn}>Cancel</button>
              <button type="button" onClick={() => void submitRemove()} disabled={removeBusy} style={{ ...danger, opacity: removeBusy ? 0.6 : 1 }}>
                {removeBusy ? 'Removing…' : `Remove ${removing.isBackcharge ? 'backcharge' : 'payment'}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function sheetMoneyLine(sheet: LaborJob): string {
  const paid = (sheet.payments ?? []).filter((p) => Number(p.amount) >= 0).reduce((s, p) => s + Number(p.amount), 0)
  const plan = planSubPaymentMove({ id: '__none__', amount: 0 }, sheet, sheet, {})
  const owed = plan.from.owedBefore
  return `owed $${formatCurrency(owed)} · ${paid > 0 ? `paid $${formatCurrency(paid)}` : 'nothing paid yet'}`
}

function fromSheetFor(p: EditingPaymentTarget, laborJobs: LaborJob[], names: Record<string, string>): string {
  const s = laborJobs.find((j) => j.id === p.jobId)
  return s ? sheetLabel(s, names) : 'this sheet'
}

const SubLaborPaymentMoveRemoveModals = forwardRef(SubLaborPaymentMoveRemoveModalsInner)
export default SubLaborPaymentMoveRemoveModals
