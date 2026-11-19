import { supabase } from './supabase'
import { salariedWeekOf, type SalariedWeek } from './salariedEffectiveHours'

export type SelfSalaryClockState = {
  isSalary: boolean
  hasTemplate: boolean
  /** The caller's own set week, Sunday first: 8 hours Monday to Friday when their pay row carries none. */
  week: SalariedWeek
}

/**
 * The RPC's row. The week came in 20261119160000; a server without it answers the other three
 * columns, and the week reads as the default.
 */
type SelfSalaryClockRow = {
  is_salary: boolean | null
  record_hours_but_salary: boolean | null
  has_template: boolean | null
  salaried_week_hours?: readonly (number | string | null)[] | null
}

/**
 * One-round-trip self-probe for the salary clock UI (identity Phase D,
 * v2.1734). The self_salary_clock_state RPC resolves the caller id-first
 * (people.account_user_id → people_pay_config.person_id) with the legacy
 * btrim(users.name) match as fallback, so a renamed user's salary clock UI
 * stays salaried. If the RPC errors (e.g. client deployed ahead of db push),
 * the original two name-keyed queries run instead — degrades to the pre-flip
 * behavior, never worse. Replaces the probes in ClockInOutButton and both
 * Dashboard effects (which previously cost 2 queries each). The caller's own
 * set week rides on the same row, so My Time's Your hours can hold a salaried
 * person to it without a read of the pay row, which a helper cannot make.
 */
export async function fetchSelfSalaryClockState(
  userId: string,
  userName: string | null,
): Promise<SelfSalaryClockState> {
  const { data, error } = await supabase.rpc('self_salary_clock_state')
  const row = (Array.isArray(data) ? data[0] : null) as SelfSalaryClockRow | null | undefined
  if (!error && row) {
    return { isSalary: !!row.is_salary, hasTemplate: !!row.has_template, week: salariedWeekOf(row) }
  }

  const name = userName?.trim()
  const [pay, tmpl] = await Promise.all([
    name
      ? supabase.from('people_pay_config').select('is_salary, salaried_week_hours').eq('person_name', name).maybeSingle()
      : Promise.resolve({ data: null as { is_salary: boolean | null; salaried_week_hours: number[] | null } | null }),
    supabase.from('salary_work_schedule_templates').select('user_id').eq('user_id', userId).maybeSingle(),
  ])
  return { isSalary: !!pay.data?.is_salary, hasTemplate: !!tmpl.data, week: salariedWeekOf(pay.data) }
}
