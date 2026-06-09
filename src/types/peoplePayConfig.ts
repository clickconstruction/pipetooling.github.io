export type PayConfigRow = {
  person_name: string
  /** Canonical roster id; preferred for writes and joins. */
  person_id?: string | null
  hourly_wage: number | null
  /** Optional second hourly rate for office/bid/unassigned time. NULL = single rate (hourly_wage everywhere). Ignored when is_salary. */
  office_hourly_wage?: number | null
  is_salary: boolean
  show_in_hours: boolean
  show_in_cost_matrix: boolean
  record_hours_but_salary: boolean
}
