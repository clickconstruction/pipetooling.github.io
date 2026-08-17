import { supabase } from './supabase'

export type SelfSalaryClockState = { isSalary: boolean; hasTemplate: boolean }

/**
 * One-round-trip self-probe for the salary clock UI (identity Phase D,
 * v2.1734). The self_salary_clock_state RPC resolves the caller id-first
 * (people.account_user_id → people_pay_config.person_id) with the legacy
 * btrim(users.name) match as fallback, so a renamed user's salary clock UI
 * stays salaried. If the RPC errors (e.g. client deployed ahead of db push),
 * the original two name-keyed queries run instead — degrades to the pre-flip
 * behavior, never worse. Replaces the probes in ClockInOutButton and both
 * Dashboard effects (which previously cost 2 queries each).
 */
export async function fetchSelfSalaryClockState(
  userId: string,
  userName: string | null,
): Promise<SelfSalaryClockState> {
  const { data, error } = await supabase.rpc('self_salary_clock_state')
  const row = Array.isArray(data) ? data[0] : null
  if (!error && row) {
    return { isSalary: !!row.is_salary, hasTemplate: !!row.has_template }
  }

  const name = userName?.trim()
  const [pay, tmpl] = await Promise.all([
    name
      ? supabase.from('people_pay_config').select('is_salary').eq('person_name', name).maybeSingle()
      : Promise.resolve({ data: null as { is_salary: boolean | null } | null }),
    supabase.from('salary_work_schedule_templates').select('user_id').eq('user_id', userId).maybeSingle(),
  ])
  return { isSalary: !!pay.data?.is_salary, hasTemplate: !!tmpl.data }
}
