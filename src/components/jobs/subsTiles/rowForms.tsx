/**
 * The three inline row forms (v2.2963, step 4) — the same forms the tile
 * queues open, lifted so a board row can expand into them: a mini work order
 * for a sheet on a handshake, the sub picker for a stage with a window, and
 * the re-send for an expired offer. Each owns its fields, sends through
 * `quickSendWorkOrder`, and reports the new order to its caller.
 */
import { useEffect, useMemo, useState } from 'react'
import { useToastContext } from '../../../contexts/ToastContext'
import type { JobWithDetails } from '../../../types/jobWithDetails'
import type { StepCommitmentRow } from '../../../lib/workflow/stepCommitments'
import type { WorkOrderBoardRow } from '../../../lib/subWorkOrders/workOrderBoardRows'
import type { SubsStageRow } from '../../../lib/subs/subsTabRows'
import type { SubDispatchOrder } from '../../../lib/subs/subDispatch'
import { addCalendarDays, availabilityLabel, availabilityTone, quickOfferDefaults, quickOfferProblem, subAvailabilityForSpan } from '../../../lib/subs/subsTileQueues'
import { defaultStageWindow, endAfterWeekdays, stageWindowLabel, stageWindowWeekdays } from '../../../lib/subs/stageWindow'
import { quickSendJobOf, quickSendWorkOrder } from '../../../lib/subWorkOrders/quickSendWorkOrder'
import type { RowFormSent } from './rowFormsSend'
import type { RosterContact, SubsTileActions } from './subsTileActions'
import { btn, chip, ctl, ctlMoney, door, field, fieldWide, formBox, label, muted, problem, sendLine, sendNote, shortDay } from './subsTileStyles'

// ── 1 · A sheet on a handshake → the mini work order ────────────────────────

export type OfferSheetFormProps = {
  row: WorkOrderBoardRow
  /** The sheet's own date — the window opens on the day they started. */
  workingSince: string | null
  needsJob: boolean
  jobs: JobWithDetails[]
  contacts: ReadonlyMap<string, RosterContact>
  authUserId: string | undefined
  todayYmd: string
  actions: Pick<SubsTileActions, 'linkSheetToJobQuiet' | 'newJobForSheet' | 'openAssembler' | 'changed'>
  onSent: (sent: RowFormSent) => void
  onCancel?: () => void
}

type SheetForm = { jobId: string; amount: string; start: string; end: string; workDays: string; goodFor: string }

export function OfferSheetForm({ row, workingSince, needsJob, jobs, contacts, authUserId, todayYmd, actions, onSent, onCancel }: OfferSheetFormProps) {
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState(false)
  const jobsByNumberDesc = useMemo(() => [...jobs].sort((a, b) => b.hcp_number.localeCompare(a.hcp_number, undefined, { numeric: true })), [jobs])
  const [form, setForm] = useState<SheetForm>(() => {
    const d = quickOfferDefaults({ sheetDate: workingSince, todayYmd, agreed: row.agreed, unpriced: row.unpriced })
    const match = needsJob ? jobs.find((j) => j.hcp_number.trim().toLowerCase() === row.jobNumber.trim().toLowerCase()) : null
    return { jobId: row.jobId ?? match?.id ?? '', amount: d.amount, start: d.start, end: d.end, workDays: String(d.workDays), goodFor: '7' }
  })
  const expires = addCalendarDays(todayYmd, Math.max(1, Number(form.goodFor) || 7))
  const formProblem = quickOfferProblem({ amount: form.amount, start: form.start, end: form.end, expires, todayYmd, hasJob: !!form.jobId })
  const canQuickSend = !!row.personId && !!row.sheetId

  async function send() {
    const job = jobs.find((j) => j.id === form.jobId)
    if (!job || !row.personId || !row.sheetId) return
    setBusy(true)
    try {
      if (needsJob) {
        const linked = await actions.linkSheetToJobQuiet(row.sheetId, job)
        if (!linked) return
      }
      const res = await quickSendWorkOrder({
        job: quickSendJobOf(job),
        person: { id: row.personId, name: row.subName, email: contacts.get(row.personId)?.email ?? null },
        laborJobId: row.sheetId,
        stageWindowId: null,
        amount: Number(form.amount),
        proposedStart: form.start,
        proposedEnd: form.end,
        workDays: Number(form.workDays) || null,
        expires,
        authUserId: authUserId ?? null,
      })
      if (!res.ok) {
        showToast(res.error, 'error')
        if (res.needsAssembler) actions.openAssembler({ jobId: job.id, laborJobId: row.sheetId, personId: row.personId, amount: Number(form.amount) || null, proposedStart: form.start, proposedEnd: form.end })
        return
      }
      showToast(res.emailed ? `${res.row.record_id ?? 'Work order'} sent to ${row.subName} — they sign on their portal` : `${res.row.record_id ?? 'Work order'} saved · ${row.subName} has no email on the roster — share their portal link`, res.emailed ? 'success' : 'info')
      actions.changed()
      onSent({ order: res.row, emailed: res.emailed, subName: row.subName })
    } finally {
      setBusy(false)
    }
  }

  if (!canQuickSend) {
    return (
      <div style={{ ...formBox, gridTemplateColumns: '1fr' }}>
        <span style={sendNote}>{!row.sheetId ? 'This row is an order without a sheet — open it to send.' : 'Several names share this sheet, so the assembler has to pick the sub.'}</span>
        <div style={sendLine}>
          {onCancel ? (
            <button type="button" style={btn('ghost', false, false)} onClick={onCancel}>
              Cancel
            </button>
          ) : null}
          <button type="button" style={btn('primary', false, false)} onClick={() => actions.openAssembler(row.commitmentId ? { commitmentId: row.commitmentId } : { jobId: row.jobId, laborJobId: row.sheetId, amount: row.agreed > 0 ? row.agreed : null })}>
            Open the full assembler ›
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      style={formBox}
      onSubmit={(e) => {
        e.preventDefault()
        if (!formProblem && !busy) void send()
      }}
    >
      {needsJob ? (
        <div style={fieldWide}>
          <label style={label}>Job — needed before it can be sent</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select style={ctl} value={form.jobId} onChange={(e) => setForm({ ...form, jobId: e.target.value })}>
              <option value="">Pick a job…</option>
              {jobsByNumberDesc.map((j) => (
                <option key={j.id} value={j.id}>
                  #{j.hcp_number} · {j.customer_name ?? 'No customer'}
                  {j.hcp_number.trim().toLowerCase() === row.jobNumber.trim().toLowerCase() ? ' — matches the sheet' : ''}
                </option>
              ))}
            </select>
            <button type="button" style={door} onClick={() => actions.newJobForSheet(row)}>
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
        {onCancel ? (
          <button type="button" style={btn('ghost', false, false)} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="button" style={door} onClick={() => actions.openAssembler({ jobId: form.jobId || row.jobId, laborJobId: row.sheetId, personId: row.personId, amount: Number(form.amount) || null, proposedStart: form.start || null, proposedEnd: form.end || null })}>
          Open the full assembler ›
        </button>
        <button type="submit" style={btn('primary', !!formProblem || busy, false)} disabled={!!formProblem || busy}>
          {busy ? 'Sending…' : needsJob ? 'Link and send' : 'Send'}
        </button>
      </div>
    </form>
  )
}

// ── 2 · A stage with a window → the sub picker ──────────────────────────────

export type StagePickerSub = { id: string; name: string; benched: boolean }

export type OfferStageFormProps = {
  row: SubsStageRow
  /** For a passed window: the same number of weekdays from the next weekday. */
  suggestedSpan: { start: string; end: string } | null
  phasePassed: boolean
  jobs: JobWithDetails[]
  subs: StagePickerSub[]
  contacts: ReadonlyMap<string, RosterContact>
  orders: readonly SubDispatchOrder[]
  offDaysByPerson: ReadonlyMap<string, readonly string[]>
  availabilityLoading: boolean
  authUserId: string | undefined
  todayYmd: string
  actions: Pick<SubsTileActions, 'saveWindow' | 'openAssembler' | 'changed'>
  onSent: (sent: RowFormSent) => void
  onCancel?: () => void
}

type StageForm = { personId: string; start: string; end: string; amount: string; workDays: string; goodFor: string; showBench: boolean }

export function OfferStageForm({ row, suggestedSpan, phasePassed, jobs, subs, contacts, orders, offDaysByPerson, availabilityLoading, authUserId, todayYmd, actions, onSent, onCancel }: OfferStageFormProps) {
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<StageForm>(() => {
    const span = suggestedSpan ?? row.span ?? defaultStageWindow(todayYmd)
    return { personId: '', start: span.start, end: span.end, amount: row.stage.amount > 0 ? String(row.stage.amount) : '', workDays: String(Math.max(1, stageWindowWeekdays(span))), goodFor: '7', showBench: false }
  })
  const span = /^\d{4}-\d{2}-\d{2}$/.test(form.start) && /^\d{4}-\d{2}-\d{2}$/.test(form.end) && form.end >= form.start ? { start: form.start, end: form.end } : null
  const expires = addCalendarDays(todayYmd, Math.max(1, Number(form.goodFor) || 7))
  const formProblem = !form.personId ? 'Pick the sub' : quickOfferProblem({ amount: form.amount, start: form.start, end: form.end, expires, todayYmd, hasJob: true })
  const windowMoved = !!(span && (span.start !== row.span?.start || span.end !== row.span?.end))
  const activeSubs = subs.filter((s) => !s.benched)
  const benched = subs.filter((s) => s.benched)

  async function send() {
    const job = jobs.find((j) => j.id === row.jobId)
    const sub = subs.find((s) => s.id === form.personId)
    if (!job || !sub || !span) return
    setBusy(true)
    try {
      if (windowMoved) {
        const ok = await actions.saveWindow(job.id, row.stage.id, span, null)
        if (!ok) return
      }
      const res = await quickSendWorkOrder({
        job: quickSendJobOf(job),
        person: { id: sub.id, name: sub.name, email: contacts.get(sub.id)?.email ?? null },
        laborJobId: null,
        stageWindowId: row.window.id,
        amount: Number(form.amount),
        proposedStart: span.start,
        proposedEnd: span.end,
        workDays: Number(form.workDays) || null,
        expires,
        authUserId: authUserId ?? null,
      })
      if (!res.ok) {
        showToast(res.error, 'error')
        if (res.needsAssembler) actions.openAssembler({ jobId: job.id, personId: sub.id, stageWindowId: row.window.id, proposedStart: span.start, proposedEnd: span.end, amount: Number(form.amount) || null })
        return
      }
      showToast(res.emailed ? `${res.row.record_id ?? 'Work order'} sent to ${sub.name} — they pick a start inside ${stageWindowLabel(span)}` : `${res.row.record_id ?? 'Work order'} saved · ${sub.name} has no email on the roster — share their portal link`, res.emailed ? 'success' : 'info')
      actions.changed()
      onSent({ order: res.row, emailed: res.emailed, subName: sub.name })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      style={formBox}
      onSubmit={(e) => {
        e.preventDefault()
        if (!formProblem && !busy) void send()
      }}
    >
      <div style={{ ...fieldWide, gridRow: 'span 2' }}>
        <label style={label}>Who · {span ? `free ${stageWindowLabel(span)}?` : 'pick the window first'}</label>
        <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(form.showBench ? [...activeSubs, ...benched] : activeSubs).map((s) => {
            const a = span ? subAvailabilityForSpan(s.id, span, orders, offDaysByPerson) : { busy: [], off: [] }
            const tone = availabilityTone(a)
            const on = form.personId === s.id
            return (
              <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', padding: '4px 8px', border: `1px solid ${on ? '#2563eb' : 'var(--border)'}`, borderRadius: 5, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', cursor: 'pointer' }}>
                <input type="radio" name={`sub-${row.key}`} checked={on} onChange={() => setForm({ ...form, personId: s.id })} />
                <span style={{ fontWeight: 600, flex: 1 }}>{s.name}</span>
                {s.benched ? <span style={chip('gray')}>on the bench</span> : null}
                {span ? availabilityLoading ? <span style={muted}>checking…</span> : <span style={chip(tone === 'free' ? 'green' : tone === 'busy' ? 'amber' : 'gray')} title={a.busy.join(' · ') || undefined}>{availabilityLabel(a, shortDay)}</span> : null}
              </label>
            )
          })}
          {benched.length > 0 && !form.showBench ? (
            <button type="button" style={{ ...door, alignSelf: 'flex-start' }} onClick={() => setForm({ ...form, showBench: true })}>
              + {benched.length} on the bench
            </button>
          ) : null}
          {subs.length === 0 ? <span style={muted}>No subs on the roster yet — add one from the full assembler.</span> : null}
        </div>
      </div>
      <div style={field}>
        <label style={label}>{phasePassed ? 'Move the window to' : 'Window from'}</label>
        <input type="date" style={ctl} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
      </div>
      <div style={field}>
        <label style={label}>to</label>
        <input type="date" style={ctl} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
      </div>
      <div style={field}>
        <label style={label}>Price</label>
        <input style={ctlMoney} inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
      </div>
      <div style={field}>
        <label style={label}>Takes about (working days)</label>
        <input type="number" min={1} max={120} style={ctl} value={form.workDays} onChange={(e) => setForm({ ...form, workDays: e.target.value })} />
      </div>
      <div style={field}>
        <label style={label}>Offer good for</label>
        <select style={ctl} value={form.goodFor} onChange={(e) => setForm({ ...form, goodFor: e.target.value })}>
          <option value="3">3 days</option>
          <option value="7">7 days</option>
          <option value="14">14 days</option>
        </select>
      </div>
      <div style={sendLine}>
        {formProblem ? <span style={problem}>{formProblem}</span> : <span style={sendNote}>Scope: the trade library's default lines · they pick a start inside the window</span>}
        {onCancel ? (
          <button type="button" style={btn('ghost', false, false)} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="button" style={door} onClick={() => actions.openAssembler({ jobId: row.jobId, personId: form.personId || null, stageWindowId: row.window.id, proposedStart: form.start || null, proposedEnd: form.end || null, amount: Number(form.amount) || null })}>
          Open the full assembler ›
        </button>
        <button type="submit" style={btn('primary', !!formProblem || busy, false)} disabled={!!formProblem || busy}>
          {busy ? 'Sending…' : windowMoved ? 'Move window and send offer' : 'Send offer'}
        </button>
      </div>
    </form>
  )
}

// ── 3 · An expired (or lapsing) offer → re-send ─────────────────────────────

export type ResendFormProps = {
  order: StepCommitmentRow
  jobs: JobWithDetails[]
  contacts: ReadonlyMap<string, RosterContact>
  authUserId: string | undefined
  todayYmd: string
  actions: Pick<SubsTileActions, 'openAssembler' | 'changed'>
  onSent: (sent: RowFormSent) => void
  onCancel?: () => void
}

type ResendFormState = { amount: string; start: string; end: string; workDays: string; goodFor: string }

export function ResendForm({ order, jobs, contacts, authUserId, todayYmd, actions, onSent, onCancel }: ResendFormProps) {
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<ResendFormState>(() => ({ amount: order.amount != null ? String(Number(order.amount)) : '', start: order.proposed_start ?? '', end: order.proposed_end ?? '', workDays: order.work_days != null ? String(order.work_days) : '', goodFor: '7' }))
  // A different order under the same row (after a reload) re-seeds the form.
  useEffect(() => {
    setForm({ amount: order.amount != null ? String(Number(order.amount)) : '', start: order.proposed_start ?? '', end: order.proposed_end ?? '', workDays: order.work_days != null ? String(order.work_days) : '', goodFor: '7' })
  }, [order.id, order.amount, order.proposed_start, order.proposed_end, order.work_days])
  const expires = addCalendarDays(todayYmd, Math.max(1, Number(form.goodFor) || 7))
  const formProblem = quickOfferProblem({ amount: form.amount, start: form.start || todayYmd, end: form.end || form.start || todayYmd, expires, todayYmd, hasJob: !!order.job_id })

  async function resend() {
    const job = order.job_id ? jobs.find((j) => j.id === order.job_id) : null
    if (!job) return
    setBusy(true)
    try {
      const res = await quickSendWorkOrder({
        job: quickSendJobOf(job),
        person: { id: order.person_id, name: order.display_name, email: contacts.get(order.person_id)?.email ?? null },
        laborJobId: order.labor_job_id,
        stageWindowId: order.stage_window_id,
        amount: Number(form.amount),
        proposedStart: form.start || null,
        proposedEnd: form.end || null,
        workDays: Number(form.workDays) || null,
        expires,
        authUserId: authUserId ?? null,
        existingId: order.id,
      })
      if (!res.ok) {
        showToast(res.error, 'error')
        if (res.needsAssembler) actions.openAssembler({ commitmentId: order.id })
        return
      }
      showToast(res.emailed ? `${res.row.record_id ?? 'Work order'} re-sent to ${order.display_name}` : `${res.row.record_id ?? 'Work order'} extended · ${order.display_name} has no email on the roster — share their portal link`, res.emailed ? 'success' : 'info')
      actions.changed()
      onSent({ order: res.row, emailed: res.emailed, subName: order.display_name })
    } finally {
      setBusy(false)
    }
  }

  if (!order.job_id) {
    return (
      <div style={{ ...formBox, gridTemplateColumns: '1fr' }}>
        <span style={sendNote}>This order is not on a Pipeline job — re-send it from its record.</span>
        <div style={sendLine}>
          {onCancel ? (
            <button type="button" style={btn('ghost', false, false)} onClick={onCancel}>
              Cancel
            </button>
          ) : null}
          <button type="button" style={btn('primary', false, false)} onClick={() => actions.openAssembler({ commitmentId: order.id })}>
            Open the record ›
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      style={formBox}
      onSubmit={(e) => {
        e.preventDefault()
        if (!formProblem && !busy) void resend()
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
        {onCancel ? (
          <button type="button" style={btn('ghost', false, false)} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="button" style={door} onClick={() => actions.openAssembler({ commitmentId: order.id })}>
          Open the record ›
        </button>
        <button type="submit" style={btn('primary', !!formProblem || busy, false)} disabled={!!formProblem || busy}>
          {busy ? 'Sending…' : 'Re-send'}
        </button>
      </div>
    </form>
  )
}
