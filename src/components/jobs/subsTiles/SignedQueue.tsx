/**
 * Signed this month → What's next on each (v2.2963). The signature was the
 * first step; each row shows where the sheet sits on its rail and does the
 * office's one move from the board's own next-action rule: schedule the
 * inspection or mark it passed, bill the customer, pay the sub. Rows the sub
 * owns say so, so the queue count is honest. The footer steps back a month.
 */
import { useMemo } from 'react'
import type { JobWithDetails } from '../../../types/jobWithDetails'
import type { StepCommitmentRow } from '../../../lib/workflow/stepCommitments'
import type { StageWindowSpan } from '../../../lib/subs/stageWindow'
import type { WorkOrderBoardRow } from '../../../lib/subWorkOrders/workOrderBoardRows'
import { buildSignedQueue, monthName, shiftMonth, signedCountForMonth, SIGNED_NEXT_LABEL, type SignedQueueRow } from '../../../lib/subs/subsTileQueues'
import { SubsTileModal, HandledCell } from './SubsTileModal'
import { useQueueState } from './useQueueState'
import type { SubsTileActions } from './subsTileActions'
import { acts, btn, chip, door, handledRow, money, muted, shortDay, spanLabel, td, tdAct, tdNum, th, where, who } from './subsTileStyles'

export type SignedQueueProps = {
  board: WorkOrderBoardRow[]
  ordersById: ReadonlyMap<string, StepCommitmentRow>
  stageByOrderId: ReadonlyMap<string, { name: string; span: StageWindowSpan | null }>
  jobs: JobWithDetails[]
  /** `YYYY-MM` being shown; the tile opens on the current month. */
  month: string
  currentMonth: string
  onMonthChange: (month: string) => void
  actions: SubsTileActions
  onClose: () => void
}

const keyOf = (r: SignedQueueRow) => r.row.key

export function SignedQueue({ board, ordersById, stageByOrderId, jobs, month, currentMonth, onMonthChange, actions, onClose }: SignedQueueProps) {
  const queue = useMemo(() => buildSignedQueue(board, month), [board, month])
  const q = useQueueState(queue.rows, keyOf, 'Moved on')
  const prev = shiftMonth(month, -1)
  const next = shiftMonth(month, 1)
  const prevCount = signedCountForMonth(board, prev)
  const nextCount = signedCountForMonth(board, next)

  async function passed(r: SignedQueueRow) {
    if (!r.row.sheetId || !actions.setSheetStage) return
    const ok = await actions.setSheetStage(r.row.sheetId, 'customer_pay')
    if (ok !== false) {
      q.mark(r.row.key, { label: 'Passed · billing next', undo: async () => { await actions.setSheetStage!(r.row.sheetId!, 'walkthrough'); q.unmark(r.row.key) } })
      actions.changed()
    }
  }

  function pay(r: SignedQueueRow) {
    if (!r.row.sheetId || !actions.openMakePayment) return
    actions.openMakePayment({ id: r.row.sheetId, contractor: r.row.subName, hcp: r.row.jobNumber || '—', totalCost: r.row.agreed, paid: r.row.paid, outstanding: Math.max(0, r.row.open) }, r.row.open > 0 ? String(r.row.open) : '')
  }

  const officePending = q.pending.filter((r) => r.officeOwns).length

  return (
    <SubsTileModal
      ariaLabel="Signed this month"
      title={`Signed in ${monthName(month)} · what's next`}
      subtitle={queue.rows.length === 0 ? (month === currentMonth ? 'No agreements signed yet this month — the first one starts the record.' : `No agreements were signed in ${monthName(month)}.`) : `${queue.rows.length === 1 ? 'One agreement' : `${queue.rows.length} agreements`} on file. The signature was the first step — each row shows the one thing the office does next, and does it.`}
      big={{ value: money(queue.totalUsd), label: `${queue.rows.length} agreement${queue.rows.length === 1 ? '' : 's'}${queue.payableUsd > 0 ? ` · ${money(queue.payableUsd)} payable now` : ''}` }}
      queue={{ done: q.doneCount, total: q.total, hint: officePending > 0 ? `${officePending} need${officePending === 1 ? 's' : ''} the office` : 'nothing needs the office' }}
      rule={
        <>
          <b style={{ color: 'var(--text-700)', fontWeight: 600 }}>What counts:</b> orders whose signed-on date falls in the calendar month. The Next column is the board's next-action rule for the row's place on its rail.
        </>
      }
      footer={
        <>
          <button type="button" style={btn('ghost', false, false)} onClick={() => onMonthChange(prev)}>
            ‹ {monthName(prev)} · {prevCount}
          </button>
          {month < currentMonth ? (
            <button type="button" style={btn('ghost', false, false)} onClick={() => onMonthChange(next)}>
              {monthName(next)} · {nextCount} ›
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
            <th style={th}>Record</th>
            <th style={th}>Sub · job</th>
            <th style={th}>Their dates</th>
            <th style={{ ...th, textAlign: 'right' }}>Agreed</th>
            <th style={th}>Now</th>
            <th style={th}>Next</th>
          </tr>
        </thead>
        <tbody>
          {q.pending.map((r) => {
            const order = r.row.commitmentId ? ordersById.get(r.row.commitmentId) ?? null : null
            const stage = order ? stageByOrderId.get(order.id) : undefined
            const job = r.row.jobId ? jobs.find((j) => j.id === r.row.jobId) : undefined
            const picked = order?.picked_start ? { start: order.picked_start, end: order.picked_end ?? order.picked_start } : null
            const onPaper = !!order && !order.signer_signature_mode
            const isOpen = q.openKey === r.row.key
            return (
              <tr key={r.row.key} style={isOpen ? { background: 'var(--bg-blue-tint)' } : undefined} onClick={() => q.toggle(r.row.key)}>
                <td style={td}>
                  <div style={who}>{r.recordId ?? 'Signed'}</div>
                  <div style={where}>
                    signed {shortDay(r.signedOn)} · <span style={chip(onPaper ? 'gray' : 'teal')}>{onPaper ? 'on paper' : 'portal'}</span>
                  </div>
                </td>
                <td style={td}>
                  <div style={who}>
                    {r.row.subName} · {r.row.primary}
                  </div>
                  <div style={where}>{stage?.name ?? r.row.secondary ?? ''}</div>
                </td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  {picked ? (
                    <>
                      {spanLabel(picked.start, picked.end)} <span style={muted}>· their pick</span>
                    </>
                  ) : order?.proposed_start || order?.proposed_end ? (
                    spanLabel(order.proposed_start, order.proposed_end)
                  ) : (
                    <span style={muted}>set by the office</span>
                  )}
                </td>
                <td style={tdNum}>{money(r.row.agreed)}</td>
                <td style={td}>
                  <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{r.row.rail.label}</div>
                  {r.row.rail.sublabel ? <div style={where}>{r.row.rail.sublabel}</div> : null}
                </td>
                <td style={tdAct} onClick={(e) => e.stopPropagation()}>
                  <span style={acts}>
                    {order ? (
                      <button type="button" style={btn('ghost')} onClick={() => actions.print(order)}>
                        Print
                      </button>
                    ) : null}
                    {r.row.sheetId && actions.openSheet ? (
                      <button type="button" style={door} onClick={() => actions.openSheet!(r.row.sheetId!)}>
                        Sheet ›
                      </button>
                    ) : null}
                    {r.next === 'inspection' ? (
                      <>
                        <button type="button" style={btn('ghost')} onClick={actions.openAddInspection}>
                          Schedule inspection…
                        </button>
                        {actions.setSheetStage && r.row.sheetId ? (
                          <button type="button" style={btn('ok')} onClick={() => void passed(r)}>
                            Passed → bill
                          </button>
                        ) : null}
                      </>
                    ) : r.next === 'bill' ? (
                      <button type="button" style={btn('primary', !r.row.jobId)} disabled={!r.row.jobId} onClick={() => r.row.jobId && actions.billCustomer(r.row.jobId)}>
                        Bill {job?.customer_name ?? 'the customer'}
                      </button>
                    ) : r.next === 'pay' ? (
                      <button type="button" style={btn('primary', !actions.openMakePayment || !r.row.sheetId)} disabled={!actions.openMakePayment || !r.row.sheetId} onClick={() => pay(r)}>
                        Pay {r.row.subName} · {money(r.row.open)}
                      </button>
                    ) : (
                      <span style={chip('gray')}>{SIGNED_NEXT_LABEL[r.next]}</span>
                    )}
                  </span>
                </td>
              </tr>
            )
          })}
          {q.done.map(({ row: r, mark }) => (
            <tr key={`done:${r.row.key}`} style={handledRow}>
              <td style={td}>
                <div style={who}>{r.recordId ?? 'Signed'}</div>
              </td>
              <td style={td}>
                <div style={where}>
                  {r.row.subName} · {r.row.primary}
                </div>
              </td>
              <td style={td} />
              <td style={tdNum}>{money(r.row.agreed)}</td>
              <td style={td} />
              <td style={tdAct}>
                <HandledCell label={mark.label} onUndo={mark.undo ? () => void mark.undo!() : null} />
              </td>
            </tr>
          ))}
          {q.pending.length === 0 && q.done.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: '1.6rem' }}>
                {month === currentMonth ? 'The first signature this month starts the record.' : `Nothing was signed in ${monthName(month)}.`}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </SubsTileModal>
  )
}

export default SignedQueue
