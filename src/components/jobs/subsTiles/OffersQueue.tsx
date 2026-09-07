/**
 * Offers out → Chase the signature (v2.2963). Every row is a sent work order
 * waiting on a signature. Each row says which move it wants: an expired offer
 * opens on Re-send (a fresh good-through, the price and window editable, the
 * same WO number) or hands the work to someone else; a live one offers Nudge,
 * Extend +7 days, Withdraw and Signed on paper. "Seen" reads the portal visit
 * log so the office knows who has never opened it.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import type { JobWithDetails } from '../../../types/jobWithDetails'
import type { StepCommitmentRow } from '../../../lib/workflow/stepCommitments'
import type { SubPortalVisitSummary } from '../../../lib/portal/subPortalVisits'
import type { StageWindowSpan } from '../../../lib/subs/stageWindow'
import type { WorkOrderBoardRow } from '../../../lib/subWorkOrders/workOrderBoardRows'
import { addCalendarDays, buildOffersQueue, quickOfferProblem, type OffersQueueRow } from '../../../lib/subs/subsTileQueues'
import { quickSendJobOf, quickSendWorkOrder } from '../../../lib/subWorkOrders/quickSendWorkOrder'
import { SubsTileModal, HandledCell } from './SubsTileModal'
import { useQueueState } from './useQueueState'
import type { RosterContact, SubsTileActions } from './subsTileActions'
import { acts, btn, chip, ctl, ctlMoney, door, expandedRow, field, formBox, handledRow, label, money, muted, problem, sendLine, sendNote, shortDay, spanLabel, td, tdAct, tdNum, telHref, th, where, who } from './subsTileStyles'

export type OffersQueueProps = {
  board: WorkOrderBoardRow[]
  ordersById: ReadonlyMap<string, StepCommitmentRow>
  /** The stage an order fulfils — name and window — by order id. */
  stageByOrderId: ReadonlyMap<string, { name: string; span: StageWindowSpan | null }>
  jobs: JobWithDetails[]
  contacts: ReadonlyMap<string, RosterContact>
  visits: ReadonlyMap<string, SubPortalVisitSummary>
  authUserId: string | undefined
  todayYmd: string
  actions: SubsTileActions
  onClose: () => void
}

type Form = { amount: string; start: string; end: string; workDays: string; goodFor: string }

const keyOf = (r: OffersQueueRow) => r.row.key

export function OffersQueue({ board, ordersById, stageByOrderId, jobs, contacts, visits, authUserId, todayYmd, actions, onClose }: OffersQueueProps) {
  const { showToast } = useToastContext()
  const confirm = useConfirmDialog()
  const queue = useMemo(() => buildOffersQueue(board, todayYmd), [board, todayYmd])
  const q = useQueueState(queue.rows, keyOf, 'Withdrawn or signed')
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const open = q.pending.find((r) => keyOf(r) === q.openKey) ?? null
  const openOrder = open?.row.commitmentId ? ordersById.get(open.row.commitmentId) ?? null : null

  useEffect(() => {
    if (!open || !openOrder) {
      setForm(null)
      return
    }
    setForm({ amount: openOrder.amount != null ? String(Number(openOrder.amount)) : '', start: openOrder.proposed_start ?? '', end: openOrder.proposed_end ?? '', workDays: openOrder.work_days != null ? String(openOrder.work_days) : '', goodFor: '7' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.openKey])

  const expires = form ? addCalendarDays(todayYmd, Math.max(1, Number(form.goodFor) || 7)) : ''
  const formProblem = form ? quickOfferProblem({ amount: form.amount, start: form.start || todayYmd, end: form.end || form.start || todayYmd, expires, todayYmd, hasJob: !!openOrder?.job_id }) : null

  function orderOf(r: OffersQueueRow): StepCommitmentRow | null {
    return r.row.commitmentId ? ordersById.get(r.row.commitmentId) ?? null : null
  }

  async function resend(r: OffersQueueRow, f: Form) {
    const order = orderOf(r)
    const job = order?.job_id ? jobs.find((j) => j.id === order.job_id) : null
    if (!order || !job) return
    setBusy(r.row.key)
    try {
      const res = await quickSendWorkOrder({
        job: quickSendJobOf(job),
        person: { id: order.person_id, name: order.display_name, email: contacts.get(order.person_id)?.email ?? null },
        laborJobId: order.labor_job_id,
        stageWindowId: order.stage_window_id,
        amount: Number(f.amount),
        proposedStart: f.start || null,
        proposedEnd: f.end || null,
        workDays: Number(f.workDays) || null,
        expires,
        authUserId: authUserId ?? null,
        existingId: order.id,
      })
      if (!res.ok) {
        showToast(res.error, 'error')
        if (res.needsAssembler) actions.openAssembler({ commitmentId: order.id })
        return
      }
      q.mark(r.row.key, { label: `Re-sent · good through ${shortDay(res.row.offer_expires_at)}`, undo: async () => { await actions.withdraw(res.row); q.unmark(r.row.key) } })
      showToast(res.emailed ? `${res.row.record_id ?? 'Work order'} re-sent to ${order.display_name}` : `${res.row.record_id ?? 'Work order'} extended · ${order.display_name} has no email on the roster — share their portal link`, res.emailed ? 'success' : 'info')
      actions.changed()
      q.next()
    } finally {
      setBusy(null)
    }
  }

  async function nudge(r: OffersQueueRow) {
    const order = orderOf(r)
    if (!order) return
    setBusy(r.row.key)
    try {
      await actions.nudge(order)
      q.mark(r.row.key, { label: `Nudged ${shortDay(todayYmd)}` })
      q.next()
    } finally {
      setBusy(null)
    }
  }

  async function extend(r: OffersQueueRow, days: number) {
    const order = orderOf(r)
    if (!order) return
    setBusy(r.row.key)
    try {
      const ok = await actions.extendOffer(order, days)
      if (ok) {
        const base = order.offer_expires_at && order.offer_expires_at >= todayYmd ? order.offer_expires_at : todayYmd
        q.mark(r.row.key, { label: `Good through ${shortDay(addCalendarDays(base, days))}` })
        q.next()
      }
    } finally {
      setBusy(null)
    }
  }

  async function offerSomeoneElse(r: OffersQueueRow) {
    const order = orderOf(r)
    if (!order) return
    const ok = await confirm({ title: `Offer this work to someone else?`, message: `${order.record_id ?? 'The work order'} to ${order.display_name} is withdrawn and the assembler opens on the same job, price and dates for the next sub.`, confirmLabel: 'Withdraw and pick another' })
    if (!ok) return
    setBusy(r.row.key)
    try {
      const ok2 = await actions.withdrawQuiet(order)
      if (!ok2) return
      actions.openAssembler({ jobId: order.job_id, laborJobId: order.labor_job_id, stageWindowId: order.stage_window_id, proposedStart: order.proposed_start, proposedEnd: order.proposed_end, amount: order.amount != null ? Number(order.amount) : null })
    } finally {
      setBusy(null)
    }
  }

  const unopened = q.pending.filter((r) => {
    const v = r.row.personId ? visits.get(r.row.personId) : undefined
    return v != null && v.outsideOpens === 0
  })

  async function nudgeUnopened() {
    for (const r of unopened) await nudge(r)
  }

  return (
    <SubsTileModal
      ariaLabel="Offers out"
      title="Chase the signatures"
      subtitle={queue.rows.length === 0 && q.done.length === 0 ? 'No offers are waiting on a signature.' : `${queue.rows.length === 1 ? 'One offer is' : `${queue.rows.length} offers are`} waiting${queue.expiredCount > 0 ? ` · ${queue.expiredCount} expired` : ''}. Expired and unopened wants a call or a re-send; opened today can wait a day.`}
      big={{ value: String(queue.rows.length), label: `out · ${money(queue.totalUsd)}${queue.expiredCount > 0 ? ` · ${queue.expiredCount} expired` : ''}`, red: queue.expiredCount > 0 }}
      queue={{ done: q.doneCount, total: q.total, hint: 'handled = re-sent, nudged, extended, withdrawn or signed' }}
      rule={
        <>
          <b style={{ color: 'var(--text-700)', fontWeight: 600 }}>What counts:</b> work orders with an offer out. An expired one stays here in red until you act — it never silently drops.
        </>
      }
      footer={
        <>
          {unopened.length > 0 ? (
            <button type="button" style={btn('ghost', false, false)} onClick={() => void nudgeUnopened()}>
              Nudge everyone unopened · {unopened.length}
            </button>
          ) : null}
          <button type="button" style={btn('primary', q.pending.length === 0, false)} disabled={q.pending.length === 0} onClick={q.next}>
            Next row ↓
          </button>
        </>
      }
      onClose={onClose}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Sub</th>
            <th style={th}>Job · stage</th>
            <th style={th}>Sent · seen</th>
            <th style={th}>Good through</th>
            <th style={{ ...th, textAlign: 'right' }}>Price</th>
            <th style={th} />
          </tr>
        </thead>
        <tbody>
          {q.pending.map((r) => {
            const isOpen = q.openKey === r.row.key
            const order = orderOf(r)
            const rowBusy = busy === r.row.key
            const contact = order ? contacts.get(order.person_id) : undefined
            const tel = telHref(contact?.phone)
            const stage = order ? stageByOrderId.get(order.id) : undefined
            const v = r.row.personId ? visits.get(r.row.personId) : undefined
            const noBottom = isOpen ? { borderBottom: 'none' } : {}
            const amount = r.row.coverage.kind === 'sent' ? r.row.coverage.amount : r.row.agreed
            return (
              <FragmentRow key={r.row.key}>
                <tr style={isOpen ? expandedRow : undefined} onClick={() => q.toggle(r.row.key)}>
                  <td style={{ ...td, ...noBottom }}>
                    <div style={who}>{r.row.subName}</div>
                    <div style={where}>
                      {r.row.recordId ?? order?.record_id ?? ''}
                      {contact?.phone ? (
                        <>
                          {' · '}
                          {tel ? <a href={tel} onClick={(e) => e.stopPropagation()} style={{ color: 'inherit' }}>📞 {contact.phone}</a> : `📞 ${contact.phone}`}
                        </>
                      ) : null}
                    </div>
                  </td>
                  <td style={{ ...td, ...noBottom }}>
                    <div style={who}>{r.row.primary}</div>
                    <div style={where}>
                      {stage ? `${stage.name} · ` : ''}
                      {stage?.span ? `pick a start inside ${spanLabel(stage.span.start, stage.span.end)}` : order?.proposed_start || order?.proposed_end ? spanLabel(order.proposed_start, order.proposed_end) : 'no dates on the offer'}
                    </div>
                  </td>
                  <td style={{ ...td, ...noBottom, whiteSpace: 'nowrap' }}>
                    {r.sentOn ? (
                      <>
                        {shortDay(r.sentOn)} <span style={muted}>· {r.daysOut} day{r.daysOut === 1 ? '' : 's'}</span>
                      </>
                    ) : (
                      <span style={muted}>—</span>
                    )}
                    <div style={where}>{v == null ? '' : v.outsideOpens === 0 ? 'never opened their portal' : `opened ${v.lastOutsideAt ? shortDay(v.lastOutsideAt.slice(0, 10)) : ''} · ${v.outsideOpens}×`}</div>
                  </td>
                  <td style={{ ...td, ...noBottom, whiteSpace: 'nowrap' }}>
                    {r.goodThrough ? <span style={chip(r.expired ? 'red' : r.daysLeft != null && r.daysLeft <= 2 ? 'amber' : 'green')}>{r.expired ? `expired ${shortDay(r.goodThrough)}` : `${shortDay(r.goodThrough)} · ${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'} left`}</span> : <span style={muted}>no end date</span>}
                  </td>
                  <td style={{ ...tdNum, ...noBottom }}>{money(amount)}</td>
                  <td style={{ ...tdAct, ...noBottom }} onClick={(e) => e.stopPropagation()}>
                    <span style={acts}>
                      {order ? (
                        <>
                          <button type="button" style={btn('ghost', rowBusy)} disabled={rowBusy} title="They signed a printed copy" onClick={() => void actions.markSignedOnPaper(order)}>
                            Signed on paper
                          </button>
                          <button type="button" style={btn('ghost', rowBusy)} disabled={rowBusy} onClick={() => void actions.withdraw(order)}>
                            Withdraw
                          </button>
                          {r.expired ? (
                            <>
                              <button type="button" style={btn('ghost', rowBusy)} disabled={rowBusy} onClick={() => void offerSomeoneElse(r)}>
                                Offer someone else…
                              </button>
                              {!isOpen ? (
                                <button type="button" style={btn('warn')} onClick={() => q.setOpenKey(r.row.key)}>
                                  Re-send…
                                </button>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <button type="button" style={btn('ghost', rowBusy)} disabled={rowBusy} onClick={() => void extend(r, 7)}>
                                Extend +7 days
                              </button>
                              <button type="button" style={btn('primary', rowBusy)} disabled={rowBusy} onClick={() => void nudge(r)}>
                                Nudge
                              </button>
                            </>
                          )}
                        </>
                      ) : null}
                    </span>
                  </td>
                </tr>
                {isOpen && form && order ? (
                  <tr style={expandedRow}>
                    <td colSpan={6} style={{ ...td, paddingTop: 0 }}>
                      {order.job_id ? (
                        <form
                          style={formBox}
                          onSubmit={(e) => {
                            e.preventDefault()
                            if (!formProblem && !rowBusy) void resend(r, form)
                          }}
                        >
                          <div style={field}>
                            <label style={label}>Good for</label>
                            <select style={ctl} value={form.goodFor} onChange={(e) => setForm({ ...form, goodFor: e.target.value })}>
                              <option value="3">3 more days · through {shortDay(addCalendarDays(todayYmd, 3))}</option>
                              <option value="7">7 more days · through {shortDay(addCalendarDays(todayYmd, 7))}</option>
                              <option value="14">14 more days · through {shortDay(addCalendarDays(todayYmd, 14))}</option>
                            </select>
                          </div>
                          <div style={field}>
                            <label style={label}>Price</label>
                            <input style={ctlMoney} inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                          </div>
                          <div style={field}>
                            <label style={label}>Window from</label>
                            <input type="date" style={ctl} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
                          </div>
                          <div style={field}>
                            <label style={label}>to</label>
                            <input type="date" style={ctl} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
                          </div>
                          <div style={field}>
                            <label style={label}>Takes about (working days)</label>
                            <input type="number" min={1} max={120} style={ctl} value={form.workDays} onChange={(e) => setForm({ ...form, workDays: e.target.value })} />
                          </div>
                          <div style={sendLine}>
                            {formProblem ? <span style={problem}>{formProblem}</span> : <span style={sendNote}>Keeps {order.record_id ?? 'the WO number'} · the same offer notice goes out again · they sign on their portal</span>}
                            <button type="button" style={door} onClick={() => actions.openAssembler({ commitmentId: order.id })}>
                              Open the record ›
                            </button>
                            <button type="submit" style={btn('primary', !!formProblem || rowBusy, false)} disabled={!!formProblem || rowBusy}>
                              {rowBusy ? 'Sending…' : 'Re-send'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div style={{ ...formBox, gridTemplateColumns: '1fr' }}>
                          <span style={sendNote}>This order is not on a Pipeline job — re-send it from its record.</span>
                          <div style={sendLine}>
                            <button type="button" style={btn('primary', false, false)} onClick={() => actions.openAssembler({ commitmentId: order.id })}>
                              Open the record ›
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : null}
              </FragmentRow>
            )
          })}
          {q.done.map(({ row: r, mark }) => (
            <tr key={`done:${r.row.key}`} style={handledRow}>
              <td style={td}>
                <div style={{ ...who, textDecoration: 'line-through', textDecorationColor: 'var(--text-faint)' }}>{r.row.subName}</div>
              </td>
              <td style={td}>
                <div style={where}>{r.row.primary}</div>
              </td>
              <td style={td}>{r.sentOn ? shortDay(r.sentOn) : '—'}</td>
              <td style={td} />
              <td style={tdNum}>{money(r.row.coverage.kind === 'sent' ? r.row.coverage.amount : r.row.agreed)}</td>
              <td style={tdAct}>
                <HandledCell label={mark.label} onUndo={mark.undo ? () => void mark.undo!() : null} />
              </td>
            </tr>
          ))}
          {q.pending.length === 0 && q.done.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: '1.6rem' }}>
                Nothing is waiting on a signature.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </SubsTileModal>
  )
}

function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export default OffersQueue
