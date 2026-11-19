import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { withSupabaseRetry, formatErrorMessage } from '../../../utils/errorHandling'
import { denverWorkDateToday, syncSalaryClockSessionsForUserDay } from '../../../lib/salaryScheduleSync'
import { loadPayConfigFacts, type PayConfigFacts } from '../../../lib/people/personDeskFacts'
import { stintRange, stintRows, type Stint } from '../../../lib/people/employmentStints'
import { salariedWeekLine } from '../../../lib/people/salariedWeekLine'
import { WEEK_PRESETS, draftFromFacts, money, paySetupPlan, type PaySetupDraft, type PaySetupFacts } from '../../../lib/people/paySetupEdit'
import { SALARIED_DEFAULT_WEEK, formatDayHours } from '../../../lib/salariedEffectiveHours'
import type { PersonDeskViewer } from '../../../lib/people/personDeskGates'
import type { PersonKey } from '../../../lib/people/personKey'
import { PersonOffsetFormModal } from '../../pay/PersonOffsetFormModal'
import { SalaryWorkScheduleSettings } from '../../SalaryWorkScheduleSettings'
import { BTN, BTN_BLUE, BTN_QUIET, BTN_RED, Chip, DESK_EDITOR_Z, DeskEmpty, DeskRow, DeskSection, LockTag, deskBtn, fmtDate } from '../personDeskShared'

type TimeOffRow = { id: string; start_date: string; end_date: string; kind: string | null; note: string | null }
type StubRow = { period_start: string; period_end: string; paid_at: string | null }

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const FORM_ROW: CSSProperties = { display: 'grid', gridTemplateColumns: '6.5rem minmax(0, 1fr)', gap: '0.6rem', alignItems: 'start', fontSize: '0.8125rem' }
const FORM_LABEL: CSSProperties = { color: 'var(--text-muted)', paddingTop: '0.3rem' }
const FORM_HINT: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }

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
  /** v2.6526: every stint (`employment_stints`); the row lists them when there is more than one. */
  const [stints, setStints] = useState<Stint[]>([])
  const [timeOff, setTimeOff] = useState<TimeOffRow[]>([])
  const [lastStub, setLastStub] = useState<StubRow | null | undefined>(undefined)
  const [openOffsets, setOpenOffsets] = useState<number | null>(null)
  /** The one pay setup form, open or not (the owner's mockup, 2026-11-18). */
  const [edit, setEdit] = useState<PaySetupDraft | null>(null)
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
      const [p, personRow, to, stubs, offsets, stintRowsRes] = await Promise.all([
        loadPayConfigFacts(payName),
        personId ? supabase.from('people').select('start_date, end_date').eq('id', personId).maybeSingle() : Promise.resolve({ data: null }),
        userId ? supabase.from('user_time_off').select('id, start_date, end_date, kind, note').eq('user_id', userId).gte('end_date', todayYmd).order('start_date', { ascending: true }) : Promise.resolve({ data: [] }),
        payName ? supabase.from('pay_stubs').select('period_start, period_end, paid_at').eq('person_name', payName).order('period_end', { ascending: false }).limit(1) : Promise.resolve({ data: [] }),
        payName ? supabase.from('person_offsets').select('id', { count: 'exact', head: true }).eq('person_name', payName).is('pay_stub_id', null) : Promise.resolve({ count: null }),
        personId ? supabase.from('employment_stints').select('start_date, end_date').eq('person_id', personId) : Promise.resolve({ data: [] }),
      ])
      if (cancelled) return
      setPay(p)
      setStints((((stintRowsRes as { data: Stint[] | null }).data ?? []) as Stint[]))
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

  /** What is stored, as the form reads it. Null while the pay row is loading. */
  const facts: PaySetupFacts | null =
    pay === undefined
      ? null
      : {
          exists: !!pay?.exists,
          hourlyWage: pay?.hourlyWage ?? null,
          officeWage: pay?.officeWage ?? null,
          isSalary: !!pay?.isSalary,
          recordHoursButSalary: !!pay?.recordHoursButSalary,
          week: pay?.salariedWeek ?? SALARIED_DEFAULT_WEEK,
          startDate: dates?.start ?? null,
          endDate: dates?.end ?? null,
        }
  /** What the open form would write, or the one field to fix. */
  const plan = facts && edit ? paySetupPlan(facts, edit, { todayYmd, lastReportEndYmd: lastStub?.period_end ?? null }) : null
  const saveDead = busy != null || !plan || !plan.ok || (!plan.payChanged && !plan.datesChanged)

  /** One save for the whole setup: the dates on the roster row, then the pay row, then the schedule's side step. */
  async function savePaySetup() {
    if (!payName || !plan || !plan.ok) return
    if (plan.stoppedSalaried) {
      const ok = await confirmDialog({
        message: `Turn off the set week for ${personKey.displayName}? Past pay reports and approved hours stay. Pay switches to logged hours × wage, today's unapproved auto-sessions are removed, and their workday schedule (template and overrides) is cleared.`,
        confirmLabel: 'Turn off the set week',
        danger: true,
      })
      if (!ok) return
    }
    setBusy('pay')
    let datesSaved = false
    try {
      if (plan.datesChanged && personId) {
        const { error } = await supabase.from('people').update({ start_date: plan.dates.start, end_date: plan.dates.end }).eq('id', personId)
        if (error) throw error
        datesSaved = true
      }
      if (plan.payChanged) {
        const { error } = await supabase.from('people_pay_config').upsert({ person_name: payName, person_id: personId, ...plan.write }, { onConflict: 'person_name' })
        if (error) throw error
        if (plan.becameSalaried && userId) {
          const { error: syncErr } = await syncSalaryClockSessionsForUserDay(userId, todayYmd)
          if (syncErr) showToast(syncErr, 'error')
        } else if (plan.stoppedSalaried) {
          const payload = await withSupabaseRetry(async () => supabase.rpc('pay_staff_clear_salary_schedule_by_person_name', { p_person_name: payName.trim() }), 'clear salary schedule')
          const result = payload as { ok?: boolean; message?: string }
          if (result?.ok !== true) showToast(result?.message || 'Could not remove the salaried work schedule', 'error')
        }
      }
      showToast('Pay setup saved', 'success')
      setEdit(null)
      onChanged()
    } catch (e) {
      // The dates and the pay row are two writes: say which one landed, and show it.
      const reason = formatErrorMessage(e, 'That did not save')
      showToast(datesSaved ? `The dates saved. The pay did not: ${reason}` : reason, 'error')
      if (datesSaved) onChanged()
    } finally {
      setBusy(null)
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
  /** What a salaried wage comes to: the week's days and the week's pay. Null for an hourly person. */
  const weekLine = pay ? salariedWeekLine({ isSalary: pay.isSalary, hourlyWage: pay.hourlyWage, week: pay.salariedWeek }) : null

  return (
    <DeskSection id="pay" title="Pay & schedule" who="pay roles">
      {!payName ? (
        <DeskEmpty>No pay name yet — an account or roster row gives them one.</DeskEmpty>
      ) : (
        <>
          {facts == null ? (
            <DeskRow label="Paid">
              <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
            </DeskRow>
          ) : edit == null ? (
            <>
              <DeskRow
                label="Paid"
                actions={
                  canEdit ? (
                    <button type="button" style={BTN} data-pay-setup-edit onClick={() => setEdit(draftFromFacts(facts))}>
                      Edit pay setup
                    </button>
                  ) : (
                    lock
                  )
                }
              >
                {!facts.exists ? (
                  <span style={{ color: 'var(--text-amber-800)' }}>Pay is not set up. Edit pay setup adds a wage or a set week.</span>
                ) : facts.isSalary ? (
                  <>
                    <span style={{ fontWeight: 600 }}>A set week</span>
                    {weekLine ? <span data-salaried-week>{weekLine}</span> : <span style={{ color: 'var(--text-amber-800)' }}>no weekly pay</span>}
                    {facts.hourlyWage != null ? <span style={{ color: 'var(--text-muted)' }}>{money(facts.hourlyWage)} / h</span> : null}
                  </>
                ) : (
                  <>
                    <span style={{ fontWeight: 600 }}>By the hour</span>
                    <span>{facts.hourlyWage != null ? `${money(facts.hourlyWage)} / h` : 'no wage'}</span>
                    {facts.officeWage != null ? <span style={{ color: 'var(--text-muted)' }}>office {money(facts.officeWage)} / h</span> : null}
                  </>
                )}
              </DeskRow>
              {facts.isSalary ? (
                <DeskRow
                  label="Clock"
                  actions={
                    userId ? (
                      <button type="button" style={BTN_QUIET} onClick={() => setScheduleOpen(true)}>
                        Workday schedule…
                      </button>
                    ) : null
                  }
                >
                  <span>{facts.recordHoursButSalary ? 'Still clocks in and out' : 'On the schedule alone'}</span>
                </DeskRow>
              ) : null}
              <DeskRow label="Employment">
                {!personId ? (
                  <span style={{ color: 'var(--text-muted)' }}>Dates live on the roster row — create it from the header</span>
                ) : (
                  <span style={{ display: 'grid', gap: '0.15rem' }}>
                    <span>
                      {dates?.start ? fmtDate(dates.start) : <span style={{ color: 'var(--text-muted)' }}>no start date</span>} → {dates?.end ? fmtDate(dates.end) : 'present'}
                      {dates?.end && dates.end < todayYmd ? <Chip tone="gray">Ended</Chip> : null}
                    </span>
                    {stintRows(stints, todayYmd).map((r) => (
                      <span key={`${r.kind}-${r.from ?? ''}-${r.to ?? ''}`} style={{ fontSize: '0.75rem', color: r.kind === 'away' ? 'var(--text-faint)' : 'var(--text-muted)', fontStyle: r.kind === 'away' ? 'italic' : undefined }} aria-label={`${stintRange(r)}, ${r.words}`}>
                        {stintRange(r)} · {r.words}
                      </span>
                    ))}
                  </span>
                )}
              </DeskRow>
            </>
          ) : (
            <div data-pay-setup-form style={{ display: 'grid', gap: '0.75rem', padding: '0.6rem 0', borderTop: '1px solid var(--border)' }}>
              <div style={FORM_ROW}>
                <span style={FORM_LABEL}>Paid</span>
                <div>
                  <div role="group" aria-label="How they are paid" style={{ display: 'inline-flex' }}>
                    {(['hourly', 'salaried'] as const).map((k, i) => (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={edit.kind === k}
                        onClick={() => setEdit({ ...edit, kind: k })}
                        style={{ ...BTN, borderRadius: i === 0 ? '6px 0 0 6px' : '0 6px 6px 0', marginLeft: i === 0 ? 0 : -1, ...(edit.kind === k ? { background: 'var(--bg-blue-tint)', color: 'var(--text-link)', borderColor: 'var(--text-link)', position: 'relative' as const } : {}) }}
                      >
                        {k === 'hourly' ? 'By the hour' : 'A set week'}
                      </button>
                    ))}
                  </div>
                  <div style={FORM_HINT}>{edit.kind === 'salaried' ? 'A set week pays the same each week, whatever the clock says.' : 'By the hour pays the hours logged, at the wage.'}</div>
                </div>
              </div>

              {edit.kind === 'hourly' ? (
                <div style={FORM_ROW}>
                  <span style={FORM_LABEL}>Wage</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      $<input type="number" step="0.01" min="0" value={edit.hourlyWage} onChange={(e) => setEdit({ ...edit, hourlyWage: e.target.value })} style={{ width: 84, fontSize: '0.8125rem' }} aria-label="Hourly wage" />/h
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}>
                      office $<input type="number" step="0.01" min="0" value={edit.officeWage} onChange={(e) => setEdit({ ...edit, officeWage: e.target.value })} style={{ width: 84, fontSize: '0.8125rem' }} aria-label="Office hourly wage" />/h
                    </label>
                  </div>
                </div>
              ) : (
                <>
                  <div style={FORM_ROW}>
                    <span style={FORM_LABEL}>The week</span>
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
                        {DAY_NAMES.map((name, i) => {
                          const off = !(Number(edit.week[i]) > 0)
                          return (
                            <label key={name} style={{ display: 'grid', gap: 2, justifyItems: 'center', background: 'var(--bg-subtle)', borderRadius: 6, padding: '0.3rem 0.15rem', opacity: off ? 0.6 : 1 }}>
                              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{name}</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                max="16"
                                step="0.25"
                                value={edit.week[i] ?? ''}
                                onChange={(e) => setEdit({ ...edit, week: edit.week.map((v, j) => (j === i ? e.target.value : v)) })}
                                style={{ width: '100%', minWidth: 0, textAlign: 'center', fontSize: '0.8125rem', padding: '0.2rem 0' }}
                                aria-label={`${DAY_LONG[i]} hours`}
                              />
                            </label>
                          )
                        })}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {WEEK_PRESETS.map((preset) => (
                          <button key={preset.label} type="button" style={{ ...BTN_QUIET, fontSize: '0.75rem' }} onClick={() => setEdit({ ...edit, week: preset.week.map((h) => String(h)) })}>
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={FORM_ROW}>
                    <span style={FORM_LABEL}>Weekly pay</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        $<input type="number" step="0.01" min="0" value={edit.weeklyPay} onChange={(e) => setEdit({ ...edit, weeklyPay: e.target.value })} style={{ width: 100, fontSize: '0.8125rem' }} aria-label="Weekly pay" />
                      </label>
                      {plan?.ok && plan.comesTo ? <span style={{ color: 'var(--text-muted)' }}>works out to {money(plan.comesTo.wage)} an hour</span> : null}
                    </div>
                  </div>
                  {plan?.ok && plan.comesTo ? (
                    <div style={FORM_ROW}>
                      <span style={FORM_LABEL}>Comes to</span>
                      <div data-pay-setup-comes-to style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6 }}>
                        {[
                          ['Hours a week', `${formatDayHours(plan.comesTo.weekHours)} h`],
                          ['Wage', `${money(plan.comesTo.wage)} / h`],
                          ['A Monday on a job', money(plan.comesTo.mondayCost)],
                        ].map(([label, value]) => (
                          <div key={label} style={{ background: 'var(--bg-subtle)', borderRadius: 6, padding: '0.4rem 0.55rem' }}>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{label}</div>
                            <div style={{ fontSize: '1rem', fontWeight: 600 }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div style={FORM_ROW}>
                    <span style={FORM_LABEL}>Clock</span>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input type="checkbox" checked={edit.recordHours} onChange={(e) => setEdit({ ...edit, recordHours: e.target.checked })} />
                      Still clocks in and out, so real hours show beside the pay
                    </label>
                  </div>
                </>
              )}

              <div style={FORM_ROW}>
                <span style={FORM_LABEL}>Employment</span>
                {personId ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                    <input type="date" value={edit.startDate} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} style={{ fontSize: '0.8125rem' }} aria-label="Start date" />
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                    <input type="date" value={edit.endDate} onChange={(e) => setEdit({ ...edit, endDate: e.target.value })} style={{ fontSize: '0.8125rem' }} aria-label="End date" />
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>Dates live on the roster row — create it from the header</span>
                )}
              </div>

              <div style={{ display: 'grid', gap: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
                {plan && !plan.ok ? (
                  <div role="alert" data-pay-setup-error style={{ color: 'var(--text-red-600)', fontSize: '0.8125rem' }}>
                    {plan.error}
                  </div>
                ) : null}
                {plan?.ok
                  ? plan.warnings.map((w) => (
                      <div key={w} data-pay-setup-warning style={{ color: 'var(--text-amber-800)', fontSize: '0.8125rem' }}>
                        {w}
                      </div>
                    ))
                  : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <span data-pay-setup-summary style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {plan?.ok ? plan.summary : ''}
                  </span>
                  <span style={{ display: 'inline-flex', gap: '0.4rem' }}>
                    <button type="button" style={BTN_QUIET} onClick={() => setEdit(null)}>
                      Cancel
                    </button>
                    <button type="button" style={deskBtn(BTN_BLUE, saveDead)} disabled={saveDead} onClick={() => void savePaySetup()}>
                      Save pay setup
                    </button>
                  </span>
                </div>
              </div>
            </div>
          )}
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
        <div role="dialog" aria-modal="true" aria-label="Workday schedule" style={{ position: 'fixed', inset: 0, zIndex: DESK_EDITOR_Z, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 'var(--app-top-chrome, 0px)' }} onClick={(e) => e.target === e.currentTarget && setScheduleOpen(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 8, width: 'min(720px, 96vw)', maxHeight: 'min(90vh, 100%)', overflow: 'auto', padding: '1rem 1.1rem', boxShadow: '0 16px 40px rgba(0,0,0,0.25)' }}>
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
