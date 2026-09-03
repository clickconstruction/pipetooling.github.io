import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { withSupabaseRetry } from '../../../utils/errorHandling'
import { denverWorkDateToday, syncSalaryClockSessionsForUserDay } from '../../../lib/salaryScheduleSync'
import { loadPayConfigFacts, type PayConfigFacts } from '../../../lib/people/personDeskFacts'
import type { PersonDeskViewer } from '../../../lib/people/personDeskGates'
import type { PersonKey } from '../../../lib/people/personKey'
import { PersonOffsetFormModal } from '../../pay/PersonOffsetFormModal'
import { SalaryWorkScheduleSettings } from '../../SalaryWorkScheduleSettings'
import { BTN, BTN_BLUE, BTN_QUIET, BTN_RED, Chip, DESK_EDITOR_Z, DeskEmpty, DeskRow, DeskSection, LockTag, deskBtn, fmtDate } from '../personDeskShared'

type TimeOffRow = { id: string; start_date: string; end_date: string; kind: string | null; note: string | null }
type StubRow = { period_start: string; period_end: string; paid_at: string | null }

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Pay & schedule (PR 2): wage / office rate / salaried through the same
 * name-keyed upsert Payroll uses (with the salary sync side effects the
 * usePayConfig hook performs), employment dates on the roster row, time off,
 * the salaried workday schedule, and the money pointers.
 */
export function PersonDeskPaySection({
  personKey,
  viewer,
  changeKey,
  onChanged,
}: {
  personKey: PersonKey
  viewer: PersonDeskViewer
  changeKey: number
  onChanged: () => void
}) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [pay, setPay] = useState<PayConfigFacts | null | undefined>(undefined)
  const [dates, setDates] = useState<{ start: string | null; end: string | null } | null>(null)
  const [timeOff, setTimeOff] = useState<TimeOffRow[]>([])
  const [lastStub, setLastStub] = useState<StubRow | null | undefined>(undefined)
  const [openOffsets, setOpenOffsets] = useState<number | null>(null)
  const [editWage, setEditWage] = useState<{ wage: string; office: string } | null>(null)
  const [editDates, setEditDates] = useState<{ start: string; end: string } | null>(null)
  const [addTimeOff, setAddTimeOff] = useState<{ start: string; end: string; kind: 'paid' | 'unpaid'; note: string } | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [offsetOpen, setOffsetOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const { payName, personId, userId } = personKey
  const canEdit = viewer.canAccessPay && !viewer.readOnly
  const todayYmd = denverWorkDateToday()

  useEffect(() => {
    if (!viewer.canAccessPay) return
    let cancelled = false
    void (async () => {
      const [p, personRow, to, stubs, offsets] = await Promise.all([
        loadPayConfigFacts(payName),
        personId ? supabase.from('people').select('start_date, end_date').eq('id', personId).maybeSingle() : Promise.resolve({ data: null }),
        userId ? supabase.from('user_time_off').select('id, start_date, end_date, kind, note').eq('user_id', userId).gte('end_date', todayYmd).order('start_date', { ascending: true }) : Promise.resolve({ data: [] }),
        payName ? supabase.from('pay_stubs').select('period_start, period_end, paid_at').eq('person_name', payName).order('period_end', { ascending: false }).limit(1) : Promise.resolve({ data: [] }),
        payName ? supabase.from('person_offsets').select('id', { count: 'exact', head: true }).eq('person_name', payName).is('pay_stub_id', null) : Promise.resolve({ count: null }),
      ])
      if (cancelled) return
      setPay(p)
      const pr = (personRow as { data: { start_date: string | null; end_date: string | null } | null }).data
      setDates(personId ? { start: pr?.start_date ?? null, end: pr?.end_date ?? null } : null)
      setTimeOff(((to as { data: unknown[] | null }).data ?? []) as TimeOffRow[])
      setLastStub((((stubs as { data: StubRow[] | null }).data ?? [])[0]) ?? null)
      setOpenOffsets((offsets as { count: number | null }).count ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [payName, personId, userId, viewer.canAccessPay, changeKey, todayYmd])

  if (!viewer.canAccessPay) return null

  async function upsertPay(patch: Partial<{ hourly_wage: number | null; office_hourly_wage: number | null; is_salary: boolean; record_hours_but_salary: boolean }>) {
    if (!payName) return
    const cur = pay ?? { exists: false, hourlyWage: null, officeWage: null, isSalary: false, recordHoursButSalary: false }
    const full = {
      person_name: payName,
      person_id: personId,
      hourly_wage: patch.hourly_wage !== undefined ? patch.hourly_wage : cur.hourlyWage,
      office_hourly_wage: patch.office_hourly_wage !== undefined ? patch.office_hourly_wage : cur.officeWage,
      is_salary: patch.is_salary !== undefined ? patch.is_salary : cur.isSalary,
      record_hours_but_salary: patch.record_hours_but_salary !== undefined ? patch.record_hours_but_salary : cur.recordHoursButSalary,
    }
    const { error } = await supabase.from('people_pay_config').upsert(full, { onConflict: 'person_name' })
    if (error) throw error
    const becameSalary = full.is_salary && !cur.isSalary
    const stoppedSalary = !full.is_salary && cur.isSalary
    if (becameSalary && userId) {
      const { error: syncErr } = await syncSalaryClockSessionsForUserDay(userId, todayYmd)
      if (syncErr) showToast(syncErr, 'error')
    } else if (stoppedSalary) {
      const payload = await withSupabaseRetry(async () => supabase.rpc('pay_staff_clear_salary_schedule_by_person_name', { p_person_name: payName.trim() }), 'clear salary schedule')
      const result = payload as { ok?: boolean; message?: string }
      if (result?.ok !== true) showToast(result?.message || 'Could not remove the salaried work schedule', 'error')
    }
  }

  async function saveWage() {
    if (!editWage) return
    const wage = editWage.wage.trim() === '' ? null : Number.parseFloat(editWage.wage)
    const office = editWage.office.trim() === '' ? null : Number.parseFloat(editWage.office)
    if ((wage != null && !Number.isFinite(wage)) || (office != null && !Number.isFinite(office))) {
      showToast('Enter a number', 'warning')
      return
    }
    setBusy('wage')
    try {
      await upsertPay({ hourly_wage: wage, office_hourly_wage: office })
      showToast('Pay saved', 'success')
      setEditWage(null)
      onChanged()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'That did not save', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function toggleSalaried(on: boolean) {
    if (!payName) return
    if (!on) {
      const ok = await confirmDialog({
        message: `Turn off Salaried for ${personKey.displayName}? Past pay reports and approved hours stay. Pay switches to logged hours × wage, today's unapproved auto-sessions are removed, and their workday schedule (template and overrides) is cleared.`,
        confirmLabel: 'Turn off Salaried',
        danger: true,
      })
      if (!ok) return
    }
    setBusy('salary')
    try {
      await upsertPay({ is_salary: on })
      showToast(on ? 'Salaried — today’s schedule sessions sync in a moment' : 'Salaried turned off', 'success')
      onChanged()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'That did not save', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function saveDates() {
    if (!editDates || !personId) return
    const start = editDates.start || null
    const end = editDates.end || null
    if (start && end && end < start) {
      showToast('End date must be on or after start date', 'warning')
      return
    }
    setBusy('dates')
    const { error } = await supabase.from('people').update({ start_date: start, end_date: end }).eq('id', personId)
    setBusy(null)
    if (error) showToast(error.message, 'error')
    else {
      showToast('Employment dates saved', 'success')
      setEditDates(null)
      onChanged()
    }
  }

  async function saveTimeOff() {
    if (!addTimeOff || !userId) return
    if (!addTimeOff.start || !addTimeOff.end || addTimeOff.end < addTimeOff.start) {
      showToast('Start and end dates are required, end on or after start', 'warning')
      return
    }
    const kind = addTimeOff.kind === 'paid' && pay?.isSalary ? 'paid' : 'unpaid'
    setBusy('timeoff')
    const { error } = await supabase.from('user_time_off').insert({ user_id: userId, start_date: addTimeOff.start, end_date: addTimeOff.end, kind, note: addTimeOff.note.trim() || null })
    setBusy(null)
    if (error) showToast(error.message, 'error')
    else {
      showToast(kind === 'paid' ? 'Paid time off saved' : 'Time off saved', 'success')
      if (todayYmd >= addTimeOff.start && todayYmd <= addTimeOff.end) {
        const { error: syncErr } = await syncSalaryClockSessionsForUserDay(userId, todayYmd)
        if (syncErr) showToast(syncErr, 'warning')
      }
      setAddTimeOff(null)
      onChanged()
    }
  }

  async function removeTimeOff(row: TimeOffRow) {
    if (!userId) return
    const ok = await confirmDialog({ message: `Remove time off ${fmtDate(row.start_date)} – ${fmtDate(row.end_date)}?`, confirmLabel: 'Remove', danger: true })
    if (!ok) return
    const { error } = await supabase.from('user_time_off').delete().eq('id', row.id).eq('user_id', userId)
    if (error) showToast(error.message, 'error')
    else {
      showToast('Removed', 'success')
      onChanged()
    }
  }

  const lock = canEdit ? null : <LockTag label={viewer.readOnly ? 'training mode' : 'pay roles'} />

  return (
    <DeskSection title="Pay & schedule" who="pay roles">
      {!payName ? (
        <DeskEmpty>No pay name yet — an account or roster row gives them one.</DeskEmpty>
      ) : (
        <>
          <DeskRow
            label="Wage"
            actions={
              canEdit ? (
                editWage ? (
                  <>
                    <button type="button" style={deskBtn(BTN_BLUE, busy === 'wage')} disabled={busy === 'wage'} onClick={() => void saveWage()}>
                      Save
                    </button>
                    <button type="button" style={BTN_QUIET} onClick={() => setEditWage(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" style={BTN_QUIET} onClick={() => setEditWage({ wage: pay?.hourlyWage != null ? String(pay.hourlyWage) : '', office: pay?.officeWage != null ? String(pay.officeWage) : '' })}>
                    Edit
                  </button>
                )
              ) : (
                lock
              )
            }
          >
            {pay === undefined ? (
              <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
            ) : editWage ? (
              <>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  $<input type="number" step="0.01" min="0" value={editWage.wage} onChange={(e) => setEditWage({ ...editWage, wage: e.target.value })} style={{ width: 80, fontSize: '0.8125rem' }} aria-label="Hourly wage" />/h
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}>
                  office $<input type="number" step="0.01" min="0" value={editWage.office} onChange={(e) => setEditWage({ ...editWage, office: e.target.value })} style={{ width: 80, fontSize: '0.8125rem' }} aria-label="Office hourly wage" />/h
                </label>
              </>
            ) : pay == null || !pay.exists ? (
              <span style={{ color: 'var(--text-amber-800)' }}>No pay setup — Edit to add a wage or turn on Salaried</span>
            ) : (
              <>
                <span style={{ fontWeight: 600 }}>{pay.hourlyWage != null ? `${money(pay.hourlyWage)} / h` : pay.isSalary ? 'Salaried' : 'no wage'}</span>
                {pay.officeWage != null ? <span style={{ color: 'var(--text-muted)' }}>office {money(pay.officeWage)} / h</span> : null}
              </>
            )}
          </DeskRow>
          <DeskRow
            label="Salaried"
            actions={
              pay?.isSalary && userId ? (
                <button type="button" style={BTN_QUIET} onClick={() => setScheduleOpen(true)}>
                  Workday schedule…
                </button>
              ) : null
            }
          >
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: canEdit ? 'pointer' : 'default' }}>
              <input type="checkbox" checked={Boolean(pay?.isSalary)} disabled={!canEdit || busy != null || pay === undefined} onChange={(e) => void toggleSalaried(e.target.checked)} />
              {pay?.isSalary ? 'Yes — schedule-driven sessions' : 'No — logged hours × wage'}
            </label>
            {pay?.isSalary ? (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: canEdit ? 'pointer' : 'default' }} title="Keep recording real punches alongside the salary">
                <input
                  type="checkbox"
                  checked={Boolean(pay.recordHoursButSalary)}
                  disabled={!canEdit || busy != null}
                  onChange={(e) => {
                    setBusy('rhs')
                    void upsertPay({ record_hours_but_salary: e.target.checked })
                      .then(() => onChanged())
                      .catch((err) => showToast(err instanceof Error ? err.message : 'That did not save', 'error'))
                      .finally(() => setBusy(null))
                  }}
                />
                also record hours
              </label>
            ) : null}
          </DeskRow>
          <DeskRow
            label="Employment"
            actions={
              canEdit && personId ? (
                editDates ? (
                  <>
                    <button type="button" style={deskBtn(BTN_BLUE, busy === 'dates')} disabled={busy === 'dates'} onClick={() => void saveDates()}>
                      Save
                    </button>
                    <button type="button" style={BTN_QUIET} onClick={() => setEditDates(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" style={BTN_QUIET} onClick={() => setEditDates({ start: dates?.start ?? '', end: dates?.end ?? '' })}>
                    Edit dates
                  </button>
                )
              ) : canEdit ? null : (
                lock
              )
            }
          >
            {!personId ? (
              <span style={{ color: 'var(--text-muted)' }}>Dates live on the roster row — create it from the header</span>
            ) : editDates ? (
              <>
                <input type="date" value={editDates.start} onChange={(e) => setEditDates({ ...editDates, start: e.target.value })} style={{ fontSize: '0.8125rem' }} aria-label="Start date" />
                <span style={{ color: 'var(--text-muted)' }}>→</span>
                <input type="date" value={editDates.end} onChange={(e) => setEditDates({ ...editDates, end: e.target.value })} style={{ fontSize: '0.8125rem' }} aria-label="End date" />
              </>
            ) : (
              <span>
                {dates?.start ? fmtDate(dates.start) : <span style={{ color: 'var(--text-muted)' }}>no start date</span>} → {dates?.end ? fmtDate(dates.end) : 'present'}
                {dates?.end && dates.end < todayYmd ? <Chip tone="gray">Ended</Chip> : null}
              </span>
            )}
          </DeskRow>
          <DeskRow
            label="Time off"
            actions={
              canEdit && userId ? (
                addTimeOff ? (
                  <>
                    <button type="button" style={deskBtn(BTN_BLUE, busy === 'timeoff')} disabled={busy === 'timeoff'} onClick={() => void saveTimeOff()}>
                      Save
                    </button>
                    <button type="button" style={BTN_QUIET} onClick={() => setAddTimeOff(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" style={BTN_QUIET} onClick={() => setAddTimeOff({ start: todayYmd, end: todayYmd, kind: 'unpaid', note: '' })}>
                    Add
                  </button>
                )
              ) : null
            }
          >
            {!userId ? (
              <span style={{ color: 'var(--text-muted)' }}>Needs a login</span>
            ) : addTimeOff ? (
              <>
                <input type="date" value={addTimeOff.start} onChange={(e) => setAddTimeOff({ ...addTimeOff, start: e.target.value })} style={{ fontSize: '0.8125rem' }} aria-label="Time off start" />
                <span style={{ color: 'var(--text-muted)' }}>→</span>
                <input type="date" value={addTimeOff.end} onChange={(e) => setAddTimeOff({ ...addTimeOff, end: e.target.value })} style={{ fontSize: '0.8125rem' }} aria-label="Time off end" />
                {pay?.isSalary ? (
                  <select value={addTimeOff.kind} onChange={(e) => setAddTimeOff({ ...addTimeOff, kind: e.target.value as 'paid' | 'unpaid' })} style={{ fontSize: '0.8125rem' }} aria-label="Time off kind">
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                ) : null}
                <input type="text" value={addTimeOff.note} onChange={(e) => setAddTimeOff({ ...addTimeOff, note: e.target.value })} placeholder="note" style={{ fontSize: '0.8125rem', width: 120 }} aria-label="Time off note" />
              </>
            ) : timeOff.length === 0 ? (
              <span style={{ color: 'var(--text-muted)' }}>None scheduled</span>
            ) : (
              timeOff.map((t) => (
                <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Chip tone={t.kind === 'paid' ? 'blue' : 'gray'}>
                    {fmtDate(t.start_date)}
                    {t.end_date !== t.start_date ? ` – ${fmtDate(t.end_date)}` : ''}
                    {t.kind === 'paid' ? ' · paid' : ''}
                  </Chip>
                  {canEdit ? (
                    <button type="button" aria-label="Remove time off" onClick={() => void removeTimeOff(t)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, fontSize: '0.9rem' }}>
                      ×
                    </button>
                  ) : null}
                </span>
              ))
            )}
          </DeskRow>
          <DeskRow
            label="Money"
            actions={
              <>
                {viewer.isDev && payName ? (
                  <a href={`/people?tab=pay_stubs&view=ledger&person=${encodeURIComponent(payName)}`} style={{ ...BTN_QUIET, textDecoration: 'none' }}>
                    Ledger
                  </a>
                ) : null}
                <a href="/people?tab=pay_stubs" style={{ ...BTN_QUIET, textDecoration: 'none' }}>
                  Payroll
                </a>
                {canEdit ? (
                  <button type="button" style={BTN} onClick={() => setOffsetOpen(true)}>
                    Add offset
                  </button>
                ) : null}
              </>
            }
          >
            {lastStub === undefined ? (
              <span style={{ color: 'var(--text-muted)' }}>—</span>
            ) : (
              <>
                <span>
                  {lastStub ? (
                    <>
                      Last pay report through {fmtDate(lastStub.period_end)} {lastStub.paid_at ? <Chip tone="green">paid</Chip> : <Chip tone="amber">unpaid</Chip>}
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>No pay report yet</span>
                  )}
                </span>
                {openOffsets != null ? (
                  <span style={{ color: openOffsets > 0 ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
                    · {openOffsets} open offset{openOffsets === 1 ? '' : 's'}
                  </span>
                ) : null}
              </>
            )}
          </DeskRow>
        </>
      )}

      {scheduleOpen && userId && payName ? (
        <div role="dialog" aria-modal="true" aria-label="Workday schedule" style={{ position: 'fixed', inset: 0, zIndex: DESK_EDITOR_Z, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseDown={(e) => e.target === e.currentTarget && setScheduleOpen(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 8, width: 'min(720px, 96vw)', maxHeight: '90vh', overflow: 'auto', padding: '1rem 1.1rem', boxShadow: '0 16px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{personKey.displayName} · workday schedule</h2>
              <button type="button" aria-label="Close" onClick={() => setScheduleOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)' }}>
                ×
              </button>
            </div>
            <SalaryWorkScheduleSettings userId={userId} userPayName={payName} canEditPastDayOverrides={viewer.isDev || viewer.role === 'master_technician' || viewer.role === 'assistant' || viewer.role === 'controller'} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button type="button" style={BTN_RED} onClick={() => setScheduleOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {offsetOpen && payName ? (
        <PersonOffsetFormModal
          open
          zIndex={DESK_EDITOR_Z}
          editingOffset={null}
          initialCreateDraft={{ personName: payName, type: 'backcharge', amount: '', description: '', occurredDate: todayYmd }}
          personNameOptions={[payName]}
          onClose={() => setOffsetOpen(false)}
          onSaved={() => {
            setOffsetOpen(false)
            showToast('Offset saved', 'success')
            onChanged()
          }}
          onError={(m) => showToast(m, 'error')}
        />
      ) : null}
    </DeskSection>
  )
}
