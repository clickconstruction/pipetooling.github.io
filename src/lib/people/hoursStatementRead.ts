/**
 * The reads behind a signed hours statement (punch list #212, v2.6069): one person's sessions on one job for a period,
 * the pay reports that touch those weeks with their days, deductions, additional lines and payments, the person's
 * standing and current wage, the office job, and the first day the app recorded anything. Everything lands in the
 * kernel's `HoursStatementInput`; the kernel (`hoursStatement.ts`) does the rest. RLS applies as on the screens: the
 * pay tables answer only the payroll roles, so `withPay` is false for anyone else. Since PR 2 (v2.6097) the read also
 * counts what the span holds for the window's line (approved sessions, typed days, quick adds left off), hands back the
 * roster id and the pay name the saved row needs, and `listHoursStatementJobs` lists the jobs a person clocked on, for
 * the window opened from the person's desk. Since v2.6636 both lists carry a sub's sheets too (`kind: 'sheet'`, the
 * sheets counted in `sessions`), and `loadHoursStatementInputs({ kind: 'sheet' })` reads a sub's sheet lines on the job
 * through `hoursStatementSheets.ts` — the kernel's `sheet` kind at last has a reader.
 */

import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from '../overheadOfficeJobSettings'
import { calendarYmdInAppTzFromIso, formatDenverTimeOnly } from '../../utils/dateUtils'
import { hoursStatementSheetCounts, hoursStatementSheetPayGroups, hoursStatementSheetRows, type HoursStatementSheet, type HoursStatementSheetLine, type HoursStatementSheetPayment } from './hoursStatementSheets'
import { stubNetPay } from '../payStubDeductions'
import { hoursStatementRoundHours, hoursStatementStanding, hoursStatementWeekLabel, type HoursStatementInput, type HoursStatementPayGroup, type HoursStatementRow } from './hoursStatement'
import { buildCrewDays, jobChargeRuleFrom, jobChargeRuleWords, type CrewUncharged } from '../charges/crewDays'
import { loadChargeAdjustments, loadCrewSessions, loadRateCard } from '../charges/jobChargesRead'
import { indexAdjustments } from '../charges/adjustments'
import { crewRateWords, parseCrewShape } from '../charges/rateCard'

/** The job's number as the papers print it: the HCP number, else the click number, else the id's first eight. */
export function hoursStatementJobNumber(job: { id: string; hcp_number: string | null; click_number: string | null }): string {
  return (job.hcp_number ?? '').trim() || (job.click_number ?? '').trim() || job.id.slice(0, 8)
}

/** Where a person's rows come from (v2.6636): the clock, or a sub's sheets (`sessions` then counts the sheets). */
export type HoursStatementSource = 'clock' | 'sheet'

/** A person who clocked on the job, or a sub on its sheets, with the span of their days there. */
export type HoursStatementPerson = { userId: string; name: string; role: string; firstDay: string; lastDay: string; sessions: number; kind?: HoursStatementSource }

type SessionPersonRow = { user_id: string; work_date: string; users: { name: string; role: string } | null }
type SheetPeopleRow = { id: string; job_date: string | null; created_at: string | null; people_labor_job_assignees: Array<{ person_id: string; people: { id: string; name: string; kind: string; account_user_id: string | null } | null }> | null }

/** A sheet's day: its job date, else the day it was made. */
function sheetDayOf(s: { job_date: string | null; created_at: string | null }): string {
  return s.job_date ?? (s.created_at ? calendarYmdInAppTzFromIso(s.created_at) : '')
}

/** Everyone with a counted session on the job (not rejected, not revoked), then every sub on the job's sheets who has a login (v2.6636), first day first. */
export async function listHoursStatementPeople(jobId: string): Promise<HoursStatementPerson[]> {
  const [rows, sheets] = await Promise.all([
    withSupabaseRetry(
      () => supabase.from('clock_sessions').select('user_id, work_date, users!clock_sessions_user_id_fkey(name, role)').eq('job_ledger_id', jobId).is('rejected_at', null).is('revoked_at', null).not('clocked_out_at', 'is', null).order('work_date', { ascending: true }),
      'list the people who clocked on the job',
    ),
    // A sub never punches: the sheets name them. A sub with no login is left off, since a statement is saved on the login.
    withSupabaseRetry(() => supabase.from('people_labor_jobs').select('id, job_date, created_at, people_labor_job_assignees(person_id, people(id, name, kind, account_user_id))').eq('job_ledger_id', jobId), 'list the subs on the job’s sheets').catch(() => [] as SheetPeopleRow[]),
  ])
  const byUser = new Map<string, HoursStatementPerson>()
  for (const r of (rows ?? []) as unknown as SessionPersonRow[]) {
    const cur = byUser.get(r.user_id)
    if (cur) {
      cur.sessions += 1
      if (r.work_date < cur.firstDay) cur.firstDay = r.work_date
      if (r.work_date > cur.lastDay) cur.lastDay = r.work_date
    } else byUser.set(r.user_id, { userId: r.user_id, name: r.users?.name ?? 'Unnamed', role: r.users?.role ?? '', firstDay: r.work_date, lastDay: r.work_date, sessions: 1, kind: 'clock' })
  }
  for (const s of (sheets ?? []) as unknown as SheetPeopleRow[]) {
    const day = sheetDayOf(s)
    if (!day) continue
    for (const a of s.people_labor_job_assignees ?? []) {
      const p = a.people
      if (!p || p.kind !== 'sub' || !p.account_user_id) continue
      const cur = byUser.get(p.account_user_id)
      if (cur) {
        if (cur.kind !== 'sheet') continue
        cur.sessions += 1
        if (day < cur.firstDay) cur.firstDay = day
        if (day > cur.lastDay) cur.lastDay = day
      } else byUser.set(p.account_user_id, { userId: p.account_user_id, name: p.name, role: 'subcontractor', firstDay: day, lastDay: day, sessions: 1, kind: 'sheet' })
    }
  }
  return Array.from(byUser.values()).sort((a, b) => (a.firstDay < b.firstDay ? -1 : a.firstDay > b.firstDay ? 1 : a.name.localeCompare(b.name)))
}

/** A job the person clocked on, or a sub's job on the sheets (v2.6636), with the span of their days there and the facts the paper prints. */
export type HoursStatementJob = { jobId: string; number: string; name: string; customer: string | null; site: string; firstDay: string; lastDay: string; sessions: number; kind?: HoursStatementSource }

type JobFacts = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; job_address: string | null; customer_name: string | null }
type SessionJobRow = { job_ledger_id: string; work_date: string; job: JobFacts | null }
type SheetJobRow = { id: string; job_ledger_id: string | null; job_date: string | null; created_at: string | null; job: JobFacts | null }

/** The roster rows behind a login (a person may have more than one). */
async function personIdsOf(userId: string): Promise<string[]> {
  const rows = (await withSupabaseRetry(() => supabase.from('people').select('id').eq('account_user_id', userId), 'read the roster rows').catch(() => [])) as Array<{ id: string }> | null
  return (rows ?? []).map((r) => r.id)
}

/** The sheets a sub's roster rows are assigned to, with the job's facts; none when they have no sheets. */
async function sheetsOf(personIds: string[], jobId: string | null): Promise<SheetJobRow[]> {
  if (personIds.length === 0) return []
  const links = (await withSupabaseRetry(() => supabase.from('people_labor_job_assignees').select('labor_job_id').in('person_id', personIds), 'read the sub’s sheets').catch(() => [])) as Array<{ labor_job_id: string }> | null
  const ids = Array.from(new Set((links ?? []).map((l) => l.labor_job_id)))
  if (ids.length === 0) return []
  const q = supabase.from('people_labor_jobs').select('id, job_ledger_id, job_date, created_at, job:jobs_ledger!job_ledger_id(id, hcp_number, click_number, job_name, job_address, customer_name)').in('id', ids)
  const rows = (await withSupabaseRetry(() => (jobId ? q.eq('job_ledger_id', jobId) : q.not('job_ledger_id', 'is', null)), 'read the sub’s sheets').catch(() => [])) as unknown as SheetJobRow[] | null
  return rows ?? []
}

function jobFactsOf(jobId: string, j: JobFacts | null, day: string, kind: HoursStatementSource): HoursStatementJob {
  return {
    jobId,
    number: j ? hoursStatementJobNumber({ id: j.id, hcp_number: j.hcp_number, click_number: j.click_number }) : jobId.slice(0, 8),
    name: (j?.job_name ?? '').trim() || 'Unnamed job',
    customer: j?.customer_name ?? null,
    site: (j?.job_address ?? '').trim(),
    firstDay: day,
    lastDay: day,
    sessions: 1,
    kind,
  }
}

/** Every job with a counted session by the person (not rejected, not revoked), and every job on a sub's sheets (v2.6636), latest day first. */
export async function listHoursStatementJobs(userId: string): Promise<HoursStatementJob[]> {
  const [rows, sheets] = await Promise.all([
    withSupabaseRetry(
      () =>
        supabase
          .from('clock_sessions')
          .select('job_ledger_id, work_date, job:jobs_ledger!clock_sessions_job_ledger_id_fkey(id, hcp_number, click_number, job_name, job_address, customer_name)')
          .eq('user_id', userId)
          .not('job_ledger_id', 'is', null)
          .is('rejected_at', null)
          .is('revoked_at', null)
          .not('clocked_out_at', 'is', null)
          .order('work_date', { ascending: true }),
      'list the jobs the person clocked on',
    ),
    personIdsOf(userId).then((ids) => sheetsOf(ids, null)),
  ])
  const byJob = new Map<string, HoursStatementJob>()
  for (const r of (rows ?? []) as unknown as SessionJobRow[]) {
    if (!r.job_ledger_id) continue
    const cur = byJob.get(r.job_ledger_id)
    if (cur) {
      cur.sessions += 1
      if (r.work_date < cur.firstDay) cur.firstDay = r.work_date
      if (r.work_date > cur.lastDay) cur.lastDay = r.work_date
    } else byJob.set(r.job_ledger_id, jobFactsOf(r.job_ledger_id, r.job, r.work_date, 'clock'))
  }
  for (const s of sheets) {
    const day = sheetDayOf(s)
    if (!s.job_ledger_id || !day) continue
    const cur = byJob.get(s.job_ledger_id)
    if (cur) {
      if (cur.kind !== 'sheet') continue
      cur.sessions += 1
      if (day < cur.firstDay) cur.firstDay = day
      if (day > cur.lastDay) cur.lastDay = day
    } else byJob.set(s.job_ledger_id, jobFactsOf(s.job_ledger_id, s.job, day, 'sheet'))
  }
  return Array.from(byJob.values()).sort((a, b) => (a.lastDay > b.lastDay ? -1 : a.lastDay < b.lastDay ? 1 : a.name.localeCompare(b.name)))
}

/** The standing the paper prints after the worker's name: the shared kernel's (`hoursStatementStanding`), re-exported for the window. */
export { hoursStatementStanding }

type UserRow = { id: string; name: string | null; role: string | null }
type PersonRow = { id: string; name: string | null }
type SessionRow = { id: string; work_date: string; clocked_in_at: string; clocked_out_at: string | null; notes: string | null; approved_at: string | null; quick_add_minutes: number | null; approved_by_user: { name: string } | null }
type StubRow = { id: string; period_start: string; period_end: string; gross_pay: number }
type StubDayRow = { pay_stub_id: string; work_date: string; rate_at_time: number | null; job_rate: number | null; office_rate: number | null }
type StubDeductionRow = { pay_stub_id: string; amount: number }
type StubAdditionalRow = { pay_stub_id: string; line_total: number }
type StubPaymentRow = { pay_stub_id: string; paid_at: string; amount: number; memo: string | null; source_kind: string | null; source_id: string | null }

export type HoursStatementReadArgs = {
  jobId: string
  userId: string
  periodStart: string
  periodEnd: string
  withPay: boolean
  addStatedBlock?: boolean
  /** Punch list #251: `charged` prices the person's days as the crew-days they were part of, at the rate card or the job's rule; missing = paid. */
  basis?: 'paid' | 'charged'
  /** Where the rows come from (v2.6636): a sub's sheet lines (`sheet`), else the clock. A sheet paper is always on the paid basis. */
  kind?: HoursStatementSource
}

/** What the charged paper was priced by, for the window's line and the saved row. */
export type HoursStatementChargeFacts = {
  /** The headline rate: the job's shape or flat rate, else the master-with-a-helper row; null when the card has none. */
  rate: number | null
  /** `master with a helper throughout · $285.00 the crew’s hour`, or `the crew on each day, from the rate card`. */
  words: string
  /** Days in the span the person was part of that could not be priced, with the reason once each. */
  unpriced: string[]
  crewDays: number
  /**
   * Who counts as nobody on this person's days that priced at nothing because nobody out counted (the live pass), most
   * such days first, and how many such days. The office window names them; the paper keeps its neutral reason.
   */
  uncharged: CrewUncharged[]
  unchargedDays: number
}

/** What the read found in the span, for the window's line: see `hoursStatementSpanWords`. */
export type HoursStatementReadCounts = { approved: number; pending: number; typedDays: number; quickAddsLeftOff: number; /** A sub's paper: the sheets in the span (`approved` is then the lines). */ sheets?: number }

export type HoursStatementRead = {
  input: HoursStatementInput
  worker: { name: string; standing: string }
  approvedBy: string | null
  isOfficeJob: boolean
  /** The roster row behind the login, for the saved row; null when the person has no roster row. */
  personId: string | null
  /** The name the pay tables know the person by. */
  payName: string
  counts: HoursStatementReadCounts
  /** On the charged basis, what the paper was priced by; null on the paid basis. */
  charge: HoursStatementChargeFacts | null
}

function clockLabel(iso: string): string {
  return formatDenverTimeOnly(new Date(iso).getTime()).toLowerCase()
}

/** Read everything the kernel needs for one person on one job: a sub's sheet lines, or the clock. */
export async function loadHoursStatementInputs(args: HoursStatementReadArgs): Promise<HoursStatementRead> {
  if (args.kind === 'sheet') return await loadSheetInputs(args)
  const { jobId, userId, periodStart, periodEnd } = args
  const [sessions, user, person, officeJobId, firstRow, typedRows] = await Promise.all([
    withSupabaseRetry(
      () =>
        supabase
          .from('clock_sessions')
          .select('id, work_date, clocked_in_at, clocked_out_at, notes, approved_at, quick_add_minutes, approved_by_user:users!clock_sessions_approved_by_fkey(name)')
          .eq('user_id', userId)
          .eq('job_ledger_id', jobId)
          .gte('work_date', periodStart)
          .lte('work_date', periodEnd)
          .is('rejected_at', null)
          .is('revoked_at', null)
          .not('clocked_out_at', 'is', null)
          .order('clocked_in_at', { ascending: true }),
      'read the sessions on the job',
    ),
    withSupabaseRetry(() => supabase.from('users').select('id, name, role').eq('id', userId).maybeSingle(), 'read the worker') as Promise<UserRow | null>,
    withSupabaseRetry(() => supabase.from('people').select('id, name').eq('account_user_id', userId).limit(1).maybeSingle(), 'read the roster row') as Promise<PersonRow | null>,
    fetchOverheadOfficeJobLedgerIdFromAppSettings().catch(() => null),
    withSupabaseRetry(() => supabase.from('clock_sessions').select('work_date').is('rejected_at', null).is('revoked_at', null).order('work_date', { ascending: true }).limit(1), 'read the first recorded day'),
    // The days with a stretch typed by hand (punch list #70): named on the window's line, never on the paper.
    withSupabaseRetry(() => supabase.from('clock_typed_entries').select('work_date').eq('user_id', userId).gte('work_date', periodStart).lte('work_date', periodEnd), 'read the typed days').catch(() => [] as Array<{ work_date: string }>),
  ])
  const isOfficeJob = officeJobId != null && officeJobId === jobId
  const workerName = (user?.name ?? person?.name ?? '').trim() || 'Unnamed'
  const payName = (person?.name ?? user?.name ?? '').trim()

  const rows: HoursStatementRow[] = []
  const approvers = new Map<string, number>()
  const counts: HoursStatementReadCounts = { approved: 0, pending: 0, typedDays: 0, quickAddsLeftOff: 0 }
  for (const s of (sessions ?? []) as unknown as SessionRow[]) {
    if (!s.clocked_out_at) continue
    const hours = hoursStatementRoundHours((new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime()) / 3_600_000)
    if (hours <= 0) continue
    const pending = s.approved_at == null
    // A quick add waits for approval off the paper altogether; once approved it is an ordinary row.
    if (pending && s.quick_add_minutes != null) {
      counts.quickAddsLeftOff += 1
      continue
    }
    if (pending) counts.pending += 1
    else counts.approved += 1
    rows.push({ day: s.work_date, hours, note: (s.notes ?? '').trim(), inLabel: clockLabel(s.clocked_in_at), outLabel: clockLabel(s.clocked_out_at), pending })
    const who = s.approved_by_user?.name?.trim()
    if (s.approved_at && who) approvers.set(who, (approvers.get(who) ?? 0) + 1)
  }
  const countedDays = new Set(rows.filter((r) => !r.pending).map((r) => r.day))
  counts.typedDays = new Set(((typedRows ?? []) as Array<{ work_date: string }>).map((t) => t.work_date).filter((d) => countedDays.has(d))).size
  const approvedBy = Array.from(approvers.entries()).sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, 2).join(', ') || null

  let salaried = false
  let fallbackRate: number | null = null
  const dayRates: Record<string, number> = {}
  const payGroups: HoursStatementPayGroup[] = []
  if (args.withPay) {
    const payConfig = payName
      ? ((await withSupabaseRetry(() => supabase.from('people_pay_config').select('hourly_wage, office_hourly_wage, is_salary').eq('person_name', payName).maybeSingle(), 'read the pay config').catch(() => null)) as { hourly_wage: number | null; office_hourly_wage: number | null; is_salary: boolean | null } | null)
      : null
    salaried = payConfig?.is_salary === true
    const wage = isOfficeJob ? (payConfig?.office_hourly_wage ?? payConfig?.hourly_wage ?? null) : (payConfig?.hourly_wage ?? null)
    fallbackRate = typeof wage === 'number' && wage > 0 ? wage : null

    const stubQuery = supabase.from('pay_stubs').select('id, period_start, period_end, gross_pay').lte('period_start', periodEnd).gte('period_end', periodStart).order('period_start', { ascending: true })
    const stubs = (await withSupabaseRetry(() => (person?.id ? stubQuery.eq('person_id', person.id) : stubQuery.eq('person_name', payName)), 'read the pay reports').catch(() => [])) as StubRow[]
    const ids = stubs.map((s) => s.id)
    if (ids.length > 0) {
      const [days, deductions, additional, payments] = await Promise.all([
        withSupabaseRetry(() => supabase.from('pay_stub_days').select('pay_stub_id, work_date, rate_at_time, job_rate, office_rate').in('pay_stub_id', ids), 'read the pay report days').catch(() => []),
        withSupabaseRetry(() => supabase.from('pay_stub_deductions').select('pay_stub_id, amount').in('pay_stub_id', ids), 'read the deductions').catch(() => []),
        withSupabaseRetry(() => supabase.from('pay_stub_additional_lines').select('pay_stub_id, line_total').in('pay_stub_id', ids), 'read the additional lines').catch(() => []),
        withSupabaseRetry(() => supabase.from('pay_stub_payments').select('pay_stub_id, paid_at, amount, memo, source_kind, source_id').in('pay_stub_id', ids).order('paid_at', { ascending: true }), 'read the payments').catch(() => []),
      ])
      for (const d of (days ?? []) as StubDayRow[]) {
        const rate = isOfficeJob ? (d.office_rate ?? d.rate_at_time) : (d.job_rate ?? d.rate_at_time)
        if (typeof rate === 'number' && rate > 0) dayRates[d.work_date] = rate
      }
      const sum = (list: ReadonlyArray<{ pay_stub_id: string }>, id: string, pick: (x: never) => number): number => list.filter((x) => x.pay_stub_id === id).reduce((s, x) => s + pick(x as never), 0)
      for (const st of stubs) {
        const due = stubNetPay(
          st.gross_pay,
          sum((deductions ?? []) as StubDeductionRow[], st.id, (x) => (x as StubDeductionRow).amount),
          sum((additional ?? []) as StubAdditionalRow[], st.id, (x) => (x as StubAdditionalRow).line_total),
        )
        payGroups.push({
          key: st.id,
          label: hoursStatementWeekLabel(st.period_start),
          from: st.period_start,
          to: st.period_end,
          due,
          payments: ((payments ?? []) as StubPaymentRow[])
            .filter((p) => p.pay_stub_id === st.id)
            .map((p) => ({ on: p.paid_at.slice(0, 10), amount: p.amount, memo: p.memo, sourceKind: p.source_kind, sourceId: p.source_id })),
        })
      }
    }
  }

  const firstRecordedDay = ((firstRow ?? []) as Array<{ work_date: string }>)[0]?.work_date ?? null

  // The charged basis (punch list #251 over #254's crew-days): the person's counted days become the crew-days they were
  // part of — the people out on the job that day, the crew's hours, the shape and its rate — so two papers never sell the
  // same hour twice. Pending rows stay pending; a day the card cannot price is listed with no amount and named.
  let charge: HoursStatementChargeFacts | null = null
  let chargedRows: HoursStatementRow[] | null = null
  if (args.basis === 'charged') {
    const [crew, card, jobRow, adjustments] = await Promise.all([
      loadCrewSessions(jobId),
      loadRateCard(),
      withSupabaseRetry(() => supabase.from('jobs_ledger').select('*').eq('id', jobId).maybeSingle(), 'read the job’s rule'),
      // The Charges window's adjustments (punch list #254, PR 3) hold on the paper too; a read that fails leaves them off.
      loadChargeAdjustments(jobId).catch(() => []),
    ])
    const rule = jobChargeRuleFrom((jobRow ?? {}) as { charge_rule?: unknown; charge_shape?: unknown; hourly_charge_rate?: unknown }, parseCrewShape)
    const applied = indexAdjustments(adjustments)
    const dayShape = new Map(Array.from(applied.dayShape.entries()).map(([day, o]) => [day, o.shape] as const))
    const days = buildCrewDays(crew.filter((s) => s.workDate >= periodStart && s.workDate <= periodEnd), card, rule, { dayShape, dayOff: applied.dayOff })
    const mine = new Map(rows.filter((r) => !r.pending).map((r) => [r.day, r] as const))
    const out: HoursStatementRow[] = []
    const unpriced = new Set<string>()
    const unchargedBy = new Map<string, CrewUncharged>()
    let unchargedDays = 0
    let crewDays = 0
    for (const d of days.days) {
      const own = mine.get(d.workDate)
      if (!own || !d.people.some((p) => p.userId === userId)) continue
      crewDays += 1
      if (d.shape == null) {
        unchargedDays += 1
        for (const p of d.people) {
          if (p.standing !== 'none') continue
          const u = unchargedBy.get(p.userId) ?? { userId: p.userId, name: p.name, days: 0 }
          u.days += 1
          unchargedBy.set(p.userId, u)
        }
      }
      const others = d.people.filter((p) => p.userId !== userId).map((p) => p.name)
      const note = `${others.length ? `with ${others.join(', ')}` : 'alone'} · ${d.shapeWords}${d.why ? ` · ${d.why}` : ''}`
      if (d.why) unpriced.add(d.why)
      // The crew's hours, or the person's own when nobody out that day is charged, so an unpriced day still shows its hours.
      out.push({ day: d.workDate, hours: d.crewHours > 0 ? d.crewHours : own.hours, note, inLabel: own.inLabel, outLabel: own.outLabel, pending: false, chargeRate: d.rate })
    }
    for (const r of rows) if (r.pending) out.push(r)
    chargedRows = out
    const headline = rule.kind === 'flat' ? rule.rate : rule.kind === 'shape' ? (card.rates[rule.shape] ?? null) : (card.rates.master_helper ?? null)
    charge = {
      rate: headline,
      words: `${jobChargeRuleWords(rule)}${headline != null ? ` · ${crewRateWords({ rate: headline, why: null })}` : ''}`,
      unpriced: Array.from(unpriced),
      crewDays,
      uncharged: Array.from(unchargedBy.values()).sort((a, b) => b.days - a.days || a.name.localeCompare(b.name)),
      unchargedDays,
    }
  }
  const input: HoursStatementInput = {
    kind: salaried ? 'schedule' : 'clock',
    periodStart,
    periodEnd,
    rows: chargedRows ?? rows,
    withPay: args.basis === 'charged' ? false : args.withPay,
    basis: args.basis === 'charged' ? 'charged' : 'paid',
    chargeWords: charge?.words ?? null,
    dayRates,
    fallbackRate,
    payGroups,
    firstRecordedDay,
    addStatedBlock: args.addStatedBlock === true,
    isOfficeJob,
    worker: { name: workerName },
  }
  return { input, worker: { name: workerName, standing: hoursStatementStanding(user?.role ?? '', salaried) }, approvedBy, isOfficeJob, personId: person?.id ?? null, payName, counts, charge }
}

type SheetItemRow = { id: string; job_id: string; fixture: string; count: number; hrs_per_unit: number; is_fixed: boolean | null; labor_rate: number | null; direct_labor_amount: number | null; sequence_order: number | null }
type SheetPaymentRow = { job_id: string; amount: number; payment_date: string | null; created_at: string | null; memo: string | null }
type SheetRow = { id: string; job_date: string | null; created_at: string | null; labor_rate: number | null }

/**
 * A sub's paper (v2.6636): the sheets on the job the sub's roster rows are assigned to, their lines and their payments,
 * through `hoursStatementSheets.ts`. The pay switch keeps the lines' rates and amounts and the per-sheet Paid lines; the
 * charged basis does not apply (a sheet is agreed work), so the paper is always paid. The first recorded day is the
 * earlier of the clock's and the sheets', since a sheet may predate the first punch (2026-03-11 on the live data).
 */
async function loadSheetInputs(args: HoursStatementReadArgs): Promise<HoursStatementRead> {
  const { jobId, userId, periodStart, periodEnd } = args
  const [user, personIds, officeJobId, firstClock, firstSheet] = await Promise.all([
    withSupabaseRetry(() => supabase.from('users').select('id, name, role').eq('id', userId).maybeSingle(), 'read the worker') as Promise<UserRow | null>,
    personIdsOf(userId),
    fetchOverheadOfficeJobLedgerIdFromAppSettings().catch(() => null),
    withSupabaseRetry(() => supabase.from('clock_sessions').select('work_date').is('rejected_at', null).is('revoked_at', null).order('work_date', { ascending: true }).limit(1), 'read the first recorded day').catch(() => []),
    withSupabaseRetry(() => supabase.from('people_labor_jobs').select('job_date').not('job_date', 'is', null).order('job_date', { ascending: true }).limit(1), 'read the first sheet').catch(() => []),
  ])
  const linked = await sheetsOf(personIds, jobId)
  const sheetIds = linked.map((s) => s.id)
  const [itemRows, paymentRows] = sheetIds.length
    ? await Promise.all([
        withSupabaseRetry(() => supabase.from('people_labor_job_items').select('id, job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount, sequence_order').in('job_id', sheetIds).order('sequence_order', { ascending: true }), 'read the sheets’ lines'),
        withSupabaseRetry(() => supabase.from('people_labor_job_payments').select('job_id, amount, payment_date, created_at, memo').in('job_id', sheetIds).order('payment_date', { ascending: true }), 'read the sheets’ payments').catch(() => []),
      ])
    : [[], []]
  // The sheets' own rates travel with the lines; the day and the rate are read again here since sheetsOf keeps the job's facts, not the sheet's.
  const sheetFacts = sheetIds.length ? ((await withSupabaseRetry(() => supabase.from('people_labor_jobs').select('id, job_date, created_at, labor_rate').in('id', sheetIds), 'read the sheets')) as unknown as SheetRow[] | null) ?? [] : []
  const sheets: HoursStatementSheet[] = sheetFacts.map((s) => ({ id: s.id, jobDate: s.job_date, createdYmd: s.created_at ? calendarYmdInAppTzFromIso(s.created_at) : null, laborRate: typeof s.labor_rate === 'number' ? s.labor_rate : null }))
  const lines: HoursStatementSheetLine[] = ((itemRows ?? []) as unknown as SheetItemRow[]).map((i, idx) => ({ sheetId: i.job_id, fixture: i.fixture, count: Number(i.count) || 0, hrsPerUnit: Number(i.hrs_per_unit) || 0, isFixed: i.is_fixed === true, laborRate: typeof i.labor_rate === 'number' ? i.labor_rate : null, directLaborAmount: typeof i.direct_labor_amount === 'number' ? i.direct_labor_amount : null, order: i.sequence_order ?? idx }))
  const payments: HoursStatementSheetPayment[] = ((paymentRows ?? []) as unknown as SheetPaymentRow[]).map((p) => ({ sheetId: p.job_id, amount: Number(p.amount) || 0, on: p.payment_date ?? (p.created_at ? calendarYmdInAppTzFromIso(p.created_at) : null), memo: p.memo }))
  const span = { from: periodStart, to: periodEnd }
  const isOfficeJob = officeJobId != null && officeJobId === jobId
  const workerName = (user?.name ?? '').trim() || 'Unnamed'
  const firstClockDay = ((firstClock ?? []) as Array<{ work_date: string }>)[0]?.work_date ?? null
  const firstSheetDay = ((firstSheet ?? []) as Array<{ job_date: string }>)[0]?.job_date ?? null
  const firstRecordedDay = [firstClockDay, firstSheetDay].filter((d): d is string => Boolean(d)).sort()[0] ?? null
  const counts = hoursStatementSheetCounts(sheets, lines, span)
  const input: HoursStatementInput = {
    kind: 'sheet',
    periodStart,
    periodEnd,
    rows: hoursStatementSheetRows(sheets, lines, span),
    withPay: args.withPay,
    basis: 'paid',
    payGroups: args.withPay ? hoursStatementSheetPayGroups(sheets, lines, payments, span) : [],
    firstRecordedDay,
    addStatedBlock: args.addStatedBlock === true,
    isOfficeJob,
    worker: { name: workerName },
  }
  return {
    input,
    worker: { name: workerName, standing: hoursStatementStanding(user?.role ?? 'subcontractor', false) },
    approvedBy: null,
    isOfficeJob,
    personId: personIds[0] ?? null,
    payName: workerName,
    counts: { approved: counts.lines, pending: 0, typedDays: 0, quickAddsLeftOff: 0, sheets: counts.sheets },
    charge: null,
  }
}
