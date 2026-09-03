export type PayConfigRow = {
  person_name: string
  /** Canonical roster id; preferred for writes and joins. */
  person_id?: string | null
  hourly_wage: number | null
  /** Optional second hourly rate for office/bid/unassigned time. NULL = single rate (hourly_wage everywhere). Ignored when is_salary. */
  office_hourly_wage?: number | null
  is_salary: boolean
  record_hours_but_salary: boolean
  /** Wheels on Labor (v2.2733): none | own_fuel_paid | company — where fuel and truck cost land on Review. */
  vehicle_arrangement?: 'none' | 'own_fuel_paid' | 'company'
  /** Manual $/field hour that replaces the computed vehicle rate. NULL = computed. */
  vehicle_rate_override?: number | null
}
