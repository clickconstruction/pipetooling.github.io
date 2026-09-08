/**
 * On a handshake → Get it in writing (v2.2963). Every row is a sub working
 * with nothing signed; the open row is a small work order pre-read from the
 * sheet (price = the sheet total, window from the day they started) that
 * sends from here. A sheet whose job number has no Pipeline row picks the job
 * in the same form and the button becomes "Link and send".
 */
import { useMemo, useState, type ReactNode } from 'react'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import type { JobWithDetails } from '../../../types/jobWithDetails'
import { buildHandshakeQueue, type HandshakeQueueRow } from '../../../lib/subs/subsTileQueues'
import type { WorkOrderBoardRow } from '../../../lib/subWorkOrders/workOrderBoardRows'
import { OfferSheetForm } from './rowForms'
import { sendSheetOfferWithDefaults, sentLabel } from './rowFormsSend'
import { SubsTileModal, HandledCell } from './SubsTileModal'
import { useQueueState } from './useQueueState'
import type { RosterContact, SubsTileActions } from './subsTileActions'
import type { StepCommitmentRow } from '../../../lib/workflow/stepCommitments'
import { acts, btn, chip, door, expandedRow, handledRow, money, muted, red, shortDay, td, tdAct, tdNum, telHref, th, where, who } from './subsTileStyles'

export type HandshakeQueueProps = {
  board: WorkOrderBoardRow[]
  jobs: JobWithDetails[]
  contacts: ReadonlyMap<string, RosterContact>
  authUserId: string | undefined
  todayYmd: string
  actions: SubsTileActions
  onClose: () => void
}

const keyOf = (r: HandshakeQueueRow) => r.row.key

export function HandshakeQueue({ board, jobs, contacts, authUserId, todayYmd, actions, onClose }: HandshakeQueueProps) {
  const { showToast } = useToastContext()
  const confirm = useConfirmDialog()
  const queue = useMemo(() => buildHandshakeQueue(board, todayYmd), [board, todayYmd])
  const q = useQueueState(queue.rows, keyOf, 'No longer on a handshake')
  const [, setBusy] = useState<string | null>(null)

  /** A row's order went out (from its form or the bulk send): mark it, offer Undo, move on. */
  function markSent(r: HandshakeQueueRow, order: StepCommitmentRow, subName: string) {
    q.mark(r.row.key, { label: sentLabel({ order, emailed: true, subName }, 'out'), undo: async () => { await actions.withdraw(order); q.unmark(r.row.key) } })
    q.next()
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
      const job = jobs.find((j) => j.id === r.row.jobId)
      if (!job) continue
      setBusy(r.row.key)
      try {
        const res = await sendSheetOfferWithDefaults({ row: r.row, workingSince: r.workingSince, job, contacts, authUserId, todayYmd })
        if (!res.ok) {
          showToast(`${r.row.subName}: ${res.error}`, 'error')
          continue
        }
        showToast(res.emailed ? `${res.row.record_id ?? 'Work order'} sent to ${r.row.subName}` : `${res.row.record_id ?? 'Work order'} saved · ${r.row.subName} has no email on the roster`, res.emailed ? 'success' : 'info')
        actions.changed()
        markSent(r, res.row, r.row.subName)
      } finally {
        setBusy(null)
      }
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
                {isOpen ? (
                  <tr style={expandedRow}>
                    <td colSpan={5} style={{ ...td, paddingTop: 0 }}>
                      <OfferSheetForm row={r.row} workingSince={r.workingSince} needsJob={r.needsJob} jobs={jobs} contacts={contacts} authUserId={authUserId} todayYmd={todayYmd} actions={actions} onSent={(sent) => markSent(r, sent.order, sent.subName)} />
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
