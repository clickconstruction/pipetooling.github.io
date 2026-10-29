/**
 * The reads behind a signed hours statement (punch list #212, v2.6069): one person's sessions on one job for a period,
 * the pay reports that touch those weeks with their days, deductions, additional lines and payments, the person's
 * standing and current wage, the office job, and the first day the app recorded anything. Everything lands in the
 * kernel's `HoursStatementInput`; the kernel (`hoursStatement.ts`) does the rest. RLS applies as on the screens: the
 * pay tables answer only the payroll roles, so `withPay` is false for anyone else.
 */

import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from '../overheadOfficeJobSettings'
import { formatDenverTimeOnly } from '../../utils/dateUtils'
import { stubNetPay } from '../payStubDeductions'
import { hoursStatementRoundHours, hoursStatementWeekLabel, type HoursStatementInput, type HoursStatementPayGroup, type HoursStatementRow } from './hoursStatement'

/** The job's number as the papers print it: the HCP number, else the click number, else the id's first eight. */
export function hoursStatementJobNumber(job: { id: string; hcp_number: string | null; click_number: string | null }): string {
  return (job.hcp_number ?? '').trim() || (job.click_number ?? '').trim() || job.id.slice(0, 8)
}

/** A person who clocked on the job, with the span of their days there. */
export type HoursStatementPerson = { userId: string; name: string; role: string; firstDay: string; lastDay: string; sessions: number }

type SessionPersonRow = { user_id: string; work_date: string; users: { name: string; role: string } | null }

/** Everyone with a counted session on the job (not rejected, not revoked), first day first. */
export async function listHoursStatementPeople(jobId: string): Promise<HoursStatementPerson[]> {
  const rows = await withSupabaseRetry(
    () => supabase.from('clock_sessions').select('user_id, work_date, users!clock_sessions_user_id_fkey(name, role)').eq('job_ledger_id', jobId).is('rejected_at', null).is('revoked_at', null).not('clocked_out_at', 'is', null).order('work_date', { ascending: true }),
    'list the people who clocked on the job',
  )
  const byUser = new Map<string, HoursStatementPerson>()
  for (const r of (rows ?? []) as unknown as SessionPersonRow[]) {
    const cur = byUser.get(r.user_id)
    if (cur) {
      cur.sessions += 1
      if (r.work_date < cur.firstDay) cur.firstDay = r.work_date
      if (r.work_date > cur.lastDay) cur.lastDay = r.work_date
    } else byUser.set(r.user_id, { userId: r.user_id, name: r.users?.name ?? 'Unnamed', role: r.users?.role ?? '', firstDay: r.work_date, lastDay: r.work_date, sessions: 1 })
  }
  return Array.from(byUser.values()).sort((a, b) => (a.firstDay < b.firstDay ? -1 : a.firstDay > b.firstDay ? 1 : a.name.localeCompare(b.name)))
}

/** The standing the paper prints after the worker's name, from the login's role. */
export function hoursStatementStanding(role: string, salaried: boolean): string {
  const words: Record<string, string> = {
    helpers: 'helper',
    master_technician: 'master plumber',
    subcontractor: 'subcontractor',
    assistant: 'assistant',
    controller: 'controller',
    estimator: 'estimator',
    dev: 'developer',
    primary: 'primary',
    superintendent: 'superintendent',
  }
  const w = words[role] ?? 'employee'
  return salaried ? `${w}, salaried` : w
}

type SessionRow = { id: string; work_date: string; clocked_in_at: string; clocked_out_at: string | null; notes: string | null; approved_at: string | null; approved_by_user: { name: string } | null }
type StubRow = { id: string; period_start: string; period_end: string; gross_pay: number }
type StubDayRow = { pay_stub_id: string; work_date: string; rate_at_time: number | null; job_rate: number | null; office_rate: number | null }
type StubDeductionRow = { pay_stub_id: string; amount: number }
type StubAdditionalRow = { pay_stub_id: string; line_total: number }
type StubPaymentRow = { pay_stub_id: string; paid_at: string; amount: number; memo: string | null; source_kind: string | null; source_id: string | null }

export type HoursStatementReadArgs = { jobId: string; userId: string; periodStart: string; periodEnd: string; withPay: boolean; addStatedBlock?: boolean }

export type HoursStatementRead = {
  input: HoursStatementInput
  worker: { name: string; standing: string }
  approvedBy: string | null
  isOfficeJob: boolean
}

function clockLabel(iso: string): string {
  return formatDenverTimeOnly(new Date(iso).getTime()).toLowerCase()
}

/** Read everything the kernel needs for one person on one job. */
export async function loadHoursStatementInputs(args: HoursStatementReadArgs): Promise<HoursStatementRead> {
  const { jobId, userId, periodStart, periodEnd } = args
  const [sessions, user, person, officeJobId, firstRow] = await Promise.all([
    withSupabaseRetry(
      () =>
        supabase
          .from('clock_sessions')
          .select('id, work_date, clocked_in_at, clocked_out_at, notes, approved_at, approved_by_user:users!clock_sessions_approved_by_fkey(name)')
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
    withSupabaseRetry(() => supabase.from('users').select('id, name, role').eq('id', userId).maybeSingle(), 'read the worker'),
    withSupabaseRetry(() => supabase.from('people').select('id, name').eq('account_user_id', userId).limit(1).maybeSingle(), 'read the roster row'),
    fetchOverheadOfficeJobLedgerIdFromAppSettings().catch(() => null),
    withSupabaseRetry(() => supabase.from('clock_sessions').select('work_date').is('rejected_at', null).is('revoked_at', null).order('work_date', { ascending: true }).limit(1), 'read the first recorded day'),
  ])
  const isOfficeJob = officeJobId != null && officeJobId === jobId
  const workerName = (user?.name ?? person?.name ?? '').trim() || 'Unnamed'
  const payName = (person?.name ?? user?.name ?? '').trim()

  const rows: HoursStatementRow[] = []
  const approvers = new Map<string, number>()
  for (const s of (sessions ?? []) as unknown as SessionRow[]) {
    if (!s.clocked_out_at) continue
    const hours = hoursStatementRoundHours((new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime()) / 3_600_000)
    if (hours <= 0) continue
    rows.push({ day: s.work_date, hours, note: (s.notes ?? '').trim(), inLabel: clockLabel(s.clocked_in_at), outLabel: clockLabel(s.clocked_out_at), pending: s.approved_at == null })
    const who = s.approved_by_user?.name?.trim()
    if (s.approved_at && who) approvers.set(who, (approvers.get(who) ?? 0) + 1)
  }
  const approvedBy = Array.from(approvers.entries()).sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, 2).join(', ') || null

  let salaried = false
  let fallbackRate: number | null = null
  const dayRates: Record<string, number> = {}
  const payGroups: HoursStatementPayGroup[] = []
  if (args.withPay) {
    const payConfig = payName
      ? await withSupabaseRetry(() => supabase.from('people_pay_config').select('hourly_wage, office_hourly_wage, is_salary').eq('person_name', payName).maybeSingle(), 'read the pay config').catch(() => null)
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
  const input: HoursStatementInput = {
    kind: salaried ? 'schedule' : 'clock',
    periodStart,
    periodEnd,
    rows,
    withPay: args.withPay,
    dayRates,
    fallbackRate,
    payGroups,
    firstRecordedDay,
    addStatedBlock: args.addStatedBlock === true,
    isOfficeJob,
    worker: { name: workerName },
  }
  return { input, worker: { name: workerName, standing: hoursStatementStanding(user?.role ?? '', salaried) }, approvedBy, isOfficeJob }
}
