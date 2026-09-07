/**
 * On a handshake → Get it in writing (v2.2963). Every row is a sub working
 * with nothing signed; the open row is a small work order pre-read from the
 * sheet (price = the sheet total, window from the day they started) that
 * sends from here. A sheet whose job number has no Pipeline row picks the job
 * in the same form and the button becomes "Link and send".
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import type { JobWithDetails } from '../../../types/jobWithDetails'
import { buildHandshakeQueue, quickOfferDefaults, quickOfferProblem, addCalendarDays, type HandshakeQueueRow } from '../../../lib/subs/subsTileQueues'
import { endAfterWeekdays } from '../../../lib/subs/stageWindow'
import type { WorkOrderBoardRow } from '../../../lib/subWorkOrders/workOrderBoardRows'
import { quickSendJobOf, quickSendWorkOrder } from '../../../lib/subWorkOrders/quickSendWorkOrder'
import { SubsTileModal, HandledCell } from './SubsTileModal'
import { useQueueState } from './useQueueState'
import type { RosterContact, SubsTileActions } from './subsTileActions'
import { acts, btn, chip, ctl, ctlMoney, door, expandedRow, field, fieldWide, formBox, handledRow, label, money, muted, problem, red, sendLine, sendNote, shortDay, td, tdAct, tdNum, telHref, th, where, who } from './subsTileStyles'

export type HandshakeQueueProps = {
  board: WorkOrderBoardRow[]
  jobs: JobWithDetails[]
  contacts: ReadonlyMap<string, RosterContact>
  authUserId: string | undefined
  todayYmd: string
  actions: SubsTileActions
  onClose: () => void
}

type Form = { jobId: string; amount: string; start: string; end: string; workDays: string; goodFor: string }

const keyOf = (r: HandshakeQueueRow) => r.row.key

export function HandshakeQueue({ board, jobs, contacts, authUserId, todayYmd, actions, onClose }: HandshakeQueueProps) {
  const { showToast } = useToastContext()
  const confirm = useConfirmDialog()
  const queue = useMemo(() => buildHandshakeQueue(board, todayYmd), [board, todayYmd])
  const q = useQueueState(queue.rows, keyOf, 'No longer on a handshake')
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const open = q.pending.find((r) => keyOf(r) === q.openKey) ?? null

  const jobsByNumberDesc = useMemo(() => [...jobs].sort((a, b) => b.hcp_number.localeCompare(a.hcp_number, undefined, { numeric: true })), [jobs])

  // Seed the form whenever a different row opens.
  useEffect(() => {
    if (!open) {
      setForm(null)
      return
    }
    const d = quickOfferDefaults({ sheetDate: open.workingSince, todayYmd, agreed: open.row.agreed, unpriced: open.row.unpriced })
    const match = open.needsJob ? jobs.find((j) => j.hcp_number.trim().toLowerCase() === open.row.jobNumber.trim().toLowerCase()) : null
    setForm({ jobId: open.row.jobId ?? match?.id ?? '', amount: d.amount, start: d.start, end: d.end, workDays: String(d.workDays), goodFor: '7' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.openKey])

  const expires = form ? addCalendarDays(todayYmd, Math.max(1, Number(form.goodFor) || 7)) : ''
  const formProblem = form && open ? quickOfferProblem({ amount: form.amount, start: form.start, end: form.end, expires, todayYmd, hasJob: !!form.jobId }) : null
  const canQuickSend = !!open?.row.personId && !!open?.row.sheetId

  async function send(r: HandshakeQueueRow, f: Form) {
    const job = jobs.find((j) => j.id === f.jobId)
    if (!job || !r.row.personId || !r.row.sheetId) return
    setBusy(r.row.key)
    try {
      if (r.needsJob) {
        const linked = await actions.linkSheetToJobQuiet(r.row.sheetId, job)
        if (!linked) return
      }
      const res = await quickSendWorkOrder({
        job: quickSendJobOf(job),
        person: { id: r.row.personId, name: r.row.subName, email: contacts.get(r.row.personId)?.email ?? null },
        laborJobId: r.row.sheetId,
        stageWindowId: null,
        amount: Number(f.amount),
        proposedStart: f.start,
        proposedEnd: f.end,
        workDays: Number(f.workDays) || null,
        expires: addCalendarDays(todayYmd, Math.max(1, Number(f.goodFor) || 7)),
        authUserId: authUserId ?? null,
      })
      if (!res.ok) {
        showToast(res.error, 'error')
        if (res.needsAssembler) actions.openAssembler({ jobId: job.id, laborJobId: r.row.sheetId, personId: r.row.personId, amount: Number(f.amount) || null, proposedStart: f.start, proposedEnd: f.end })
        return
      }
      const row = res.row
      q.mark(r.row.key, { label: `${row.record_id ?? 'Work order'} out · good through ${shortDay(row.offer_expires_at)}`, undo: async () => { await actions.withdraw(row); q.unmark(r.row.key) } })
      showToast(res.emailed ? `${row.record_id ?? 'Work order'} sent to ${r.row.subName} — they sign on their portal` : `${row.record_id ?? 'Work order'} saved · ${r.row.subName} has no email on the roster — share their portal link`, res.emailed ? 'success' : 'info')
      actions.changed()
      q.next()
    } finally {
      setBusy(null)
    }
  }

  async function sendRest() {
    const ready = q.pending.filter((r) => r.row.personId && r.row.sheetId && r.row.jobId && !r.row.unpriced && r.row.agreed > 0)
    if (ready.length === 0) {
      showToast('Nothing is ready to send as drafted — the remaining rows need a job, a price, or one named sub', 'info')
      return
    }
    const ok = await confirm({ title: `Send ${ready.length} work order${ready.length === 1 ? '' : 's'} as drafted?`, message: `Each goes out at its sheet total with the trade's default scope, a window from the day they started, and a week to sign. ${money(ready.reduce((s, r) => s + r.row.agreed, 0))} in all.`, confirmLabel: 'Send them' })
    if (!ok) return
    for (const r of ready) {
      const d = quickOfferDefaults({ sheetDate: r.workingSince, todayYmd, agreed: r.row.agreed, unpriced: r.row.unpriced })
      await send(r, { jobId: r.row.jobId!, amount: d.amount, start: d.start, end: d.end, workDays: String(d.workDays), goodFor: '7' })
    }
  }

  const readyCount = q.pending.filter((r) => r.row.personId && r.row.sheetId && r.row.jobId && !r.row.unpriced && r.row.agreed > 0).length

  return (
    <SubsTileModal
      ariaLabel="On a handshake"
      title="Get it in writing"
      subtitle={queue.rows.length === 0 && q.done.length === 0 ? 'Nothing is on a handshake — every working sub has an agreement behind them.' : `${queue.rows.length === 1 ? 'One sub is' : `${queue.rows.length} subs are`} working with nothing signed. Send each one the work order for what they are already doing — the price and dates are read from their sheet; you only correct what is wrong.`}
      big={{ value: money(queue.openUsd), label: 'open on a handshake', red: queue.openUsd > 0 }}
      queue={{ done: q.doneCount, total: q.total, hint: 'Enter sends the open row' }}
      rule={
        <>
          <b style={{ color: 'var(--text-700)', fontWeight: 600 }}>What counts:</b> a roster sub's sheet with a balance open and no live work order. A sent row leaves the tile the moment you send; the tile re-counts when you close.
        </>
      }
      footer={
        <>
          {readyCount > 1 ? (
            <button type="button" style={btn('ghost', false, false)} onClick={() => void sendRest()}>
              Send the rest as drafted · {readyCount}
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
            <th style={th}>Job</th>
            <th style={th}>Working since</th>
            <th style={{ ...th, textAlign: 'right' }}>Open</th>
            <th style={th} />
          </tr>
        </thead>
        <tbody>
          {q.pending.map((r) => {
            const isOpen = q.openKey === r.row.key
            const phone = contacts.get(r.row.personId ?? '')?.phone ?? null
            const tel = telHref(phone)
            const rowBusy = busy === r.row.key
            return (
              <FragmentRow key={r.row.key}>
                <tr style={isOpen ? expandedRow : undefined} onClick={() => q.toggle(r.row.key)}>
                  <td style={{ ...td, ...(isOpen ? { borderBottom: 'none' } : {}) }}>
                    <div style={who}>{r.row.subName}</div>
                    <div style={where}>
                      {phone ? (tel ? <a href={tel} onClick={(e) => e.stopPropagation()} style={{ color: 'inherit' }}>📞 {phone}</a> : `📞 ${phone}`) : 'no phone on the roster'}
                      {r.row.subNames.length > 1 ? ' · several names on the sheet' : ''}
                    </div>
                  </td>
                  <td style={{ ...td, ...(isOpen ? { borderBottom: 'none' } : {}) }}>
                    <div style={who}>{r.row.primary}</div>
                    <div style={where}>
                      {r.row.secondary ?? ''}
                      {r.needsJob ? (
                        <>
                          {r.row.secondary ? ' · ' : ''}
                          <span style={chip('amber')}>Not in Pipeline</span>
                        </>
                      ) : null}
                    </div>
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap', ...(isOpen ? { borderBottom: 'none' } : {}) }}>
                    {r.workingSince ? (
                      <>
                        {shortDay(r.workingSince)} <span style={muted}>· {r.daysWorking} day{r.daysWorking === 1 ? '' : 's'}</span>
                      </>
                    ) : (
                      <span style={muted}>—</span>
                    )}
                  </td>
                  <td style={{ ...tdNum, ...(isOpen ? { borderBottom: 'none' } : {}) }}>{r.row.unpriced ? <span style={muted}>no price yet</span> : <span style={red}>{money(r.row.open)}</span>}</td>
                  <td style={{ ...tdAct, ...(isOpen ? { borderBottom: 'none' } : {}) }} onClick={(e) => e.stopPropagation()}>
                    <span style={acts}>
                      {r.row.sheetId && actions.openSheet ? (
                        <button type="button" style={door} onClick={() => actions.openSheet!(r.row.sheetId!)}>
                          Sheet ›
                        </button>
                      ) : null}
                      {!isOpen ? (
                        <button type="button" style={btn('primary')} onClick={() => q.setOpenKey(r.row.key)}>
                          Draft a work order…
                        </button>
                      ) : null}
                    </span>
                  </td>
                </tr>
                {isOpen && form ? (
                  <tr style={expandedRow}>
                    <td colSpan={5} style={{ ...td, paddingTop: 0 }}>
                      {canQuickSend ? (
                        <form
                          style={formBox}
                          onSubmit={(e) => {
                            e.preventDefault()
                            if (!formProblem && !rowBusy) void send(r, form)
                          }}
                        >
                          {r.needsJob ? (
                            <div style={fieldWide}>
                              <label style={label}>Job — needed before it can be sent</label>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <select style={ctl} value={form.jobId} onChange={(e) => setForm({ ...form, jobId: e.target.value })}>
                                  <option value="">Pick a job…</option>
                                  {jobsByNumberDesc.map((j) => (
                                    <option key={j.id} value={j.id}>
                                      #{j.hcp_number} · {j.customer_name ?? 'No customer'}
                                      {j.hcp_number.trim().toLowerCase() === r.row.jobNumber.trim().toLowerCase() ? ' — matches the sheet' : ''}
                                    </option>
                                  ))}
                                </select>
                                <button type="button" style={door} onClick={() => actions.newJobForSheet(r.row)}>
                                  New job…
                                </button>
                              </div>
                            </div>
                          ) : null}
                          <div style={field}>
                            <label style={label}>Price</label>
                            <input style={ctlMoney} inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
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
                            <input type="number" min={1} max={120} style={ctl} value={form.workDays} onChange={(e) => setForm({ ...form, workDays: e.target.value, end: form.start && Number(e.target.value) >= 1 ? endAfterWeekdays(form.start < todayYmd ? todayYmd : form.start, Number(e.target.value)) : form.end })} />
                          </div>
                          <div style={field}>
                            <label style={label}>Offer good for</label>
                            <select style={ctl} value={form.goodFor} onChange={(e) => setForm({ ...form, goodFor: e.target.value })}>
                              <option value="3">3 days · through {shortDay(addCalendarDays(todayYmd, 3))}</option>
                              <option value="7">7 days · through {shortDay(addCalendarDays(todayYmd, 7))}</option>
                              <option value="14">14 days · through {shortDay(addCalendarDays(todayYmd, 14))}</option>
                            </select>
                          </div>
                          <div style={sendLine}>
                            {formProblem ? <span style={problem}>{formProblem}</span> : <span style={sendNote}>Scope: the trade library's default lines · goes to their portal · the sheet stays as it is</span>}
                            <button type="button" style={door} onClick={() => actions.openAssembler({ jobId: form.jobId || r.row.jobId, laborJobId: r.row.sheetId, personId: r.row.personId, amount: Number(form.amount) || null, proposedStart: form.start || null, proposedEnd: form.end || null })}>
                              Open the full assembler ›
                            </button>
                            <button type="submit" style={btn('primary', !!formProblem || rowBusy, false)} disabled={!!formProblem || rowBusy}>
                              {rowBusy ? 'Sending…' : r.needsJob ? 'Link and send' : 'Send'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div style={{ ...formBox, gridTemplateColumns: '1fr' }}>
                          <span style={sendNote}>{!r.row.sheetId ? 'This row is an order without a sheet — open it to send.' : 'Several names share this sheet, so the assembler has to pick the sub.'}</span>
                          <div style={sendLine}>
                            <button type="button" style={btn('primary', false, false)} onClick={() => actions.openAssembler(r.row.commitmentId ? { commitmentId: r.row.commitmentId } : { jobId: r.row.jobId, laborJobId: r.row.sheetId, amount: r.row.agreed > 0 ? r.row.agreed : null })}>
                              Open the full assembler ›
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
              <td style={td}>{r.workingSince ? shortDay(r.workingSince) : '—'}</td>
              <td style={tdNum}>{money(r.row.agreed)}</td>
              <td style={tdAct}>
                <HandledCell label={mark.label} onUndo={mark.undo ? () => void mark.undo!() : null} />
              </td>
            </tr>
          ))}
          {q.pending.length === 0 && q.done.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: '1.6rem' }}>
                Every working sub has an agreement behind them.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </SubsTileModal>
  )
}

/** A keyed wrapper for the two `<tr>`s a row may render (React fragments cannot carry the style). */
function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export default HandshakeQueue
