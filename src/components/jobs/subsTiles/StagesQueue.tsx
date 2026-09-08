/**
 * Stages waiting → Put a sub on it (v2.2963). Every row is a window with no
 * order behind it. The open row is a sub picker that answers "are they free"
 * before you ask — each roster sub shows their other live orders and days off
 * across the span, from the same data the dispatch Subs lanes read — plus the
 * window (pre-moved when it has passed), the price from the line item, and
 * Send. A GC's open ask is answered on the row; "Crew does this one" clears
 * the window so it stops counting.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { useToastContext } from '../../../contexts/ToastContext'
import type { JobWithDetails } from '../../../types/jobWithDetails'
import type { StepCommitmentRow } from '../../../lib/workflow/stepCommitments'
import type { SubsJobGroup } from '../../../lib/subs/subsTabRows'
import { buildStagesQueue, STAGES_QUEUE_PHASE_LABEL, type StagesQueueRow } from '../../../lib/subs/subsTileQueues'
import { stageWindowLabel, stageWindowWeekdays } from '../../../lib/subs/stageWindow'
import type { SubDispatchOrder } from '../../../lib/subs/subDispatch'
import { askProblem } from '../../../../supabase/functions/_shared/stageAsk'
import { OfferStageForm, type StagePickerSub } from './rowForms'
import { sentLabel } from './rowFormsSend'
import { SubsTileModal, HandledCell } from './SubsTileModal'
import { useQueueState } from './useQueueState'
import type { RosterContact, SubsTileActions } from './subsTileActions'
import { acts, btn, chip, ctl, expandedRow, field, fieldWide, formBox, handledRow, label, money, muted, sectionTd, sendLine, sendNote, td, tdAct, tdNum, th, where, who } from './subsTileStyles'

export type StagesQueueSub = StagePickerSub

export type StagesQueueProps = {
  groups: SubsJobGroup[]
  jobs: JobWithDetails[]
  subs: StagesQueueSub[]
  contacts: ReadonlyMap<string, RosterContact>
  /** Live orders + off days across the range the modal loaded — the availability chips. */
  orders: readonly SubDispatchOrder[]
  offDaysByPerson: ReadonlyMap<string, readonly string[]>
  availabilityLoading: boolean
  authUserId: string | undefined
  todayYmd: string
  actions: SubsTileActions
  onClose: () => void
}

type AskForm = { start: string; end: string; note: string }

const keyOf = (r: StagesQueueRow) => r.row.key

export function StagesQueue({ groups, jobs, subs, contacts, orders, offDaysByPerson, availabilityLoading, authUserId, todayYmd, actions, onClose }: StagesQueueProps) {
  const { showToast } = useToastContext()
  const queue = useMemo(() => buildStagesQueue(groups, todayYmd), [groups, todayYmd])
  const q = useQueueState(queue.rows, keyOf, 'Off the list')
  const [ask, setAsk] = useState<{ key: string; form: AskForm } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  function markSent(r: StagesQueueRow, order: StepCommitmentRow, subName: string) {
    q.mark(r.row.key, { label: sentLabel({ order, emailed: true, subName }, 'to'), undo: async () => { await actions.withdraw(order); q.unmark(r.row.key) } })
    q.next()
  }

  async function answer(r: StagesQueueRow, a: { kind: 'accept' } | { kind: 'propose'; start: string; end: string; note: string }) {
    setBusy(r.row.key)
    try {
      await actions.answerGcAsk(r.row.window, a, null)
      setAsk(null)
    } finally {
      setBusy(null)
    }
  }

  let lastPhase: StagesQueueRow['phase'] | null = null

  return (
    <SubsTileModal
      ariaLabel="Stages waiting"
      title="Put a sub on each stage"
      subtitle={queue.rows.length === 0 && q.done.length === 0 ? 'Every window has an order behind it.' : `${queue.rows.length === 1 ? 'One window is' : `${queue.rows.length} windows are`} set with nobody committed. Pick the sub, see whether they are free, send the offer. Passed windows first.`}
      big={{ value: String(queue.rows.length), label: `stage${queue.rows.length === 1 ? '' : 's'} · ${money(queue.totalUsd)}` }}
      queue={{ done: q.doneCount, total: q.total, hint: 'Enter sends the open row' }}
      rule={
        <>
          <b style={{ color: 'var(--text-700)', fontWeight: 600 }}>What counts:</b> a window no work order carries as its stage. Offering from here stamps the order with the stage, so the row leaves this tile and rides the order on the board.
        </>
      }
      footer={
        <button type="button" style={btn('primary', q.pending.length === 0, false)} disabled={q.pending.length === 0} onClick={q.next}>
          Next row ↓
        </button>
      }
      onClose={onClose}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Stage</th>
            <th style={th}>Job</th>
            <th style={th}>Window</th>
            <th style={{ ...th, textAlign: 'right' }}>Line item</th>
            <th style={th} />
          </tr>
        </thead>
        <tbody>
          {q.pending.map((r) => {
            const isOpen = q.openKey === r.row.key
            const rowBusy = busy === r.row.key
            const asked = r.askOpen && r.row.window.asked_start && r.row.window.asked_end ? { start: r.row.window.asked_start, end: r.row.window.asked_end } : null
            const section = r.phase !== lastPhase ? r.phase : null
            lastPhase = r.phase
            const noBottom = isOpen ? { borderBottom: 'none' } : {}
            return (
              <FragmentRow key={r.row.key}>
                {section ? (
                  <tr>
                    <td colSpan={5} style={sectionTd}>
                      {STAGES_QUEUE_PHASE_LABEL[section]}
                    </td>
                  </tr>
                ) : null}
                <tr style={isOpen ? expandedRow : undefined} onClick={() => q.toggle(r.row.key)}>
                  <td style={{ ...td, ...noBottom }}>
                    <div style={who}>{r.row.stage.name}</div>
                    <div style={where}>
                      {r.row.window.window_by === 'gc' ? 'as the GC asked' : 'set by the office'}
                      {r.row.stage.shared ? (
                        <>
                          {' · '}
                          <span style={chip('teal')}>Shown to the GC</span>
                        </>
                      ) : null}
                    </div>
                  </td>
                  <td style={{ ...td, ...noBottom }}>
                    <div style={who}>{r.group.primary}</div>
                    <div style={where}>{r.group.secondary ?? ''}</div>
                  </td>
                  <td style={{ ...td, ...noBottom }}>
                    {r.row.span ? <span style={chip(r.phase === 'passed' ? 'red' : 'green')}>{stageWindowLabel(r.row.span)}{r.phase === 'passed' ? ' · passed' : ''}</span> : <span style={muted}>no dates</span>}
                    {r.row.span && r.phase !== 'passed' ? <span style={{ ...muted, marginLeft: 6, fontSize: '0.74rem' }}>· {stageWindowWeekdays(r.row.span)} working days</span> : null}
                    {asked ? (
                      <div style={{ marginTop: 4 }}>
                        <span style={chip('amber')}>GC asked {stageWindowLabel(asked)}</span>
                        {r.row.window.asked_note ? <span style={{ ...where, marginLeft: 6 }}>“{r.row.window.asked_note}”</span> : null}
                      </div>
                    ) : null}
                  </td>
                  <td style={{ ...tdNum, ...noBottom }}>{r.row.stage.amount > 0 ? money(r.row.stage.amount) : <span style={muted}>—</span>}</td>
                  <td style={{ ...tdAct, ...noBottom }} onClick={(e) => e.stopPropagation()}>
                    <span style={acts}>
                      {asked ? (
                        <>
                          <button type="button" style={btn('ok', rowBusy)} disabled={rowBusy} onClick={() => void answer(r, { kind: 'accept' })}>
                            Accept {stageWindowLabel(asked)}
                          </button>
                          <button type="button" style={btn('warn', rowBusy)} disabled={rowBusy} onClick={() => setAsk(ask?.key === r.row.key ? null : { key: r.row.key, form: { start: r.row.span?.start ?? '', end: r.row.span?.end ?? '', note: '' } })}>
                            Answer with…
                          </button>
                        </>
                      ) : null}
                      <button type="button" style={btn('ghost', rowBusy)} disabled={rowBusy} title="Clear the window — this stage is not sub work" onClick={() => void actions.removeWindow(r.row.window, r.row.stage.name)}>
                        Crew does this one
                      </button>
                      {!isOpen ? (
                        <button type="button" style={btn('primary')} onClick={() => q.setOpenKey(r.row.key)}>
                          Offer to…
                        </button>
                      ) : null}
                    </span>
                  </td>
                </tr>
                {ask?.key === r.row.key ? (
                  <tr style={expandedRow}>
                    <td colSpan={5} style={{ ...td, paddingTop: 0, ...(isOpen ? { borderBottom: 'none' } : {}) }}>
                      <form
                        style={formBox}
                        onSubmit={(e) => {
                          e.preventDefault()
                          const p = askProblem(ask.form.start, ask.form.end, todayYmd)
                          if (p) {
                            showToast(p, 'error')
                            return
                          }
                          void answer(r, { kind: 'propose', start: ask.form.start, end: ask.form.end, note: ask.form.note })
                        }}
                      >
                        <div style={field}>
                          <label style={label}>Our window from</label>
                          <input type="date" style={ctl} value={ask.form.start} onChange={(e) => setAsk({ key: r.row.key, form: { ...ask.form, start: e.target.value } })} />
                        </div>
                        <div style={field}>
                          <label style={label}>to</label>
                          <input type="date" style={ctl} value={ask.form.end} onChange={(e) => setAsk({ key: r.row.key, form: { ...ask.form, end: e.target.value } })} />
                        </div>
                        <div style={fieldWide}>
                          <label style={label}>Why (the GC reads this)</label>
                          <input style={ctl} maxLength={300} value={ask.form.note} onChange={(e) => setAsk({ key: r.row.key, form: { ...ask.form, note: e.target.value } })} placeholder="Our crew is on the slab that week" />
                        </div>
                        <div style={sendLine}>
                          <span style={sendNote}>The GC's card reads your dates and the why.</span>
                          <button type="button" style={btn('ghost', false, false)} onClick={() => setAsk(null)}>
                            Cancel
                          </button>
                          <button type="submit" style={btn('warn', rowBusy, false)} disabled={rowBusy}>
                            Propose
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : null}
                {isOpen ? (
                  <tr style={expandedRow}>
                    <td colSpan={5} style={{ ...td, paddingTop: 0 }}>
                      <OfferStageForm row={r.row} suggestedSpan={r.suggestedSpan} phasePassed={r.phase === 'passed'} jobs={jobs} subs={subs} contacts={contacts} orders={orders} offDaysByPerson={offDaysByPerson} availabilityLoading={availabilityLoading} authUserId={authUserId} todayYmd={todayYmd} actions={actions} onSent={(sent) => markSent(r, sent.order, sent.subName)} />
                    </td>
                  </tr>
                ) : null}
              </FragmentRow>
            )
          })}
          {q.done.map(({ row: r, mark }) => (
            <tr key={`done:${r.row.key}`} style={handledRow}>
              <td style={td}>
                <div style={{ ...who, textDecoration: 'line-through', textDecorationColor: 'var(--text-faint)' }}>{r.row.stage.name}</div>
              </td>
              <td style={td}>
                <div style={where}>{r.group.primary}</div>
              </td>
              <td style={td}>{r.row.span ? stageWindowLabel(r.row.span) : '—'}</td>
              <td style={tdNum}>{r.row.stage.amount > 0 ? money(r.row.stage.amount) : '—'}</td>
              <td style={tdAct}>
                <HandledCell label={mark.label} onUndo={mark.undo ? () => void mark.undo!() : null} />
              </td>
            </tr>
          ))}
          {q.pending.length === 0 && q.done.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: '1.6rem' }}>
                Every window has an order behind it.
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

export default StagesQueue
