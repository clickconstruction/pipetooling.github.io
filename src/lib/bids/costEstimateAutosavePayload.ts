/**
 * The Labor tab's autosave, as data (the Labor refresh PR 3).
 *
 * The tab's debounced effect used to parse and validate ten string boxes
 * inline and `return` on the first bad value — with the status already set
 * to "Saving…", which is where it stayed (architecture quirk #4). This kernel
 * turns the boxes into the `cost_estimates` UPDATE, or says which box is
 * wrong so the tab can show "Not saved — …" instead of hanging. The row
 * payloads live here too so every writer sends the same columns. Pure.
 */
import type { CostEstimateLaborRow } from './bidPricingEngineTypes'

export type CostEstimateAutosaveInputs = {
  laborRateInput: string
  drivingCostRate: string
  hoursPerTrip: string
  estimatorCostUseFlat: boolean
  estimatorCostPerCount: string
  estimatorCostFlatAmount: string
  travelPeople: string
  travelNights: string
  travelMealsRate: string
  travelHotelRate: string
}

export type CostEstimateAutosaveValues = {
  labor_rate: number | null
  driving_cost_rate: number
  hours_per_trip: number
  estimator_cost_per_count: number | null
  estimator_cost_flat_amount: number | null
  travel_people: number
  travel_nights: number
  travel_meals_rate: number | null
  travel_hotel_rate: number | null
}

export type CostEstimateAutosaveResult = { ok: true; values: CostEstimateAutosaveValues } | { ok: false; reason: string }

export const AUTOSAVE_DEFAULT_DRIVING_RATE = 0.7
export const AUTOSAVE_DEFAULT_HOURS_PER_TRIP = 2
export const AUTOSAVE_DEFAULT_ESTIMATOR_PER_COUNT = 10

const blank = (s: string) => s.trim() === ''
const num = (s: string) => parseFloat(s.trim())

/** The boxes → the `cost_estimates` columns, or the first reason they cannot be saved. Defaults match the tab's placeholders. */
export function buildCostEstimateAutosavePayload(i: CostEstimateAutosaveInputs): CostEstimateAutosaveResult {
  const labor_rate = blank(i.laborRateInput) ? null : num(i.laborRateInput)
  if (labor_rate != null && (!Number.isFinite(labor_rate) || labor_rate < 0)) return { ok: false, reason: 'the labor rate must be a number, 0 or more' }
  const driving_cost_rate = blank(i.drivingCostRate) ? AUTOSAVE_DEFAULT_DRIVING_RATE : num(i.drivingCostRate)
  if (!Number.isFinite(driving_cost_rate) || driving_cost_rate < 0) return { ok: false, reason: 'the driving rate must be a number, 0 or more' }
  const hours_per_trip = blank(i.hoursPerTrip) ? AUTOSAVE_DEFAULT_HOURS_PER_TRIP : num(i.hoursPerTrip)
  if (!Number.isFinite(hours_per_trip) || hours_per_trip <= 0) return { ok: false, reason: 'hours per trip must be more than 0' }
  const estimator_cost_per_count = i.estimatorCostUseFlat ? null : num(i.estimatorCostPerCount) || AUTOSAVE_DEFAULT_ESTIMATOR_PER_COUNT
  if (!i.estimatorCostUseFlat && (!Number.isFinite(estimator_cost_per_count!) || estimator_cost_per_count! < 0)) return { ok: false, reason: 'the estimator cost per count must be 0 or more' }
  const estimator_cost_flat_amount = i.estimatorCostUseFlat && !blank(i.estimatorCostFlatAmount) ? num(i.estimatorCostFlatAmount) : null
  if (estimator_cost_flat_amount != null && (!Number.isFinite(estimator_cost_flat_amount) || estimator_cost_flat_amount < 0)) return { ok: false, reason: 'the flat estimator cost must be 0 or more' }
  const travel_people = blank(i.travelPeople) ? 1 : Math.round(num(i.travelPeople))
  if (!Number.isFinite(travel_people) || travel_people < 1) return { ok: false, reason: 'travel people must be 1 or more' }
  const travel_nights = blank(i.travelNights) ? 1 : Math.round(num(i.travelNights))
  if (!Number.isFinite(travel_nights) || travel_nights < 0) return { ok: false, reason: 'travel nights must be 0 or more' }
  const travel_meals_rate = blank(i.travelMealsRate) ? null : num(i.travelMealsRate)
  if (travel_meals_rate != null && (!Number.isFinite(travel_meals_rate) || travel_meals_rate < 0)) return { ok: false, reason: 'the meals rate must be 0 or more' }
  const travel_hotel_rate = blank(i.travelHotelRate) ? null : num(i.travelHotelRate)
  if (travel_hotel_rate != null && (!Number.isFinite(travel_hotel_rate) || travel_hotel_rate < 0)) return { ok: false, reason: 'the hotel rate must be 0 or more' }
  return { ok: true, values: { labor_rate, driving_cost_rate, hours_per_trip, estimator_cost_per_count, estimator_cost_flat_amount, travel_people, travel_nights, travel_meals_rate, travel_hotel_rate } }
}

/** The columns the autosave (and the explicit row flush) writes for one labor row. */
export function laborRowAutosaveUpdate(row: CostEstimateLaborRow): Pick<CostEstimateLaborRow, 'rough_in_hrs_per_unit' | 'top_out_hrs_per_unit' | 'trim_set_hrs_per_unit' | 'count' | 'is_fixed' | 'kind'> {
  return {
    rough_in_hrs_per_unit: row.rough_in_hrs_per_unit,
    top_out_hrs_per_unit: row.top_out_hrs_per_unit,
    trim_set_hrs_per_unit: row.trim_set_hrs_per_unit,
    count: row.count,
    is_fixed: row.is_fixed ?? false,
    kind: row.kind ?? 'fixture',
  }
}

/** The columns the autosave writes for one direct-cost row (any of the five amber tables). */
export function stageAmountRowAutosaveUpdate(row: { note: string | null; rough_in: unknown; top_out: unknown; trim_set: unknown; sequence_order: number }): { note: string | null; rough_in: number; top_out: number; trim_set: number; sequence_order: number } {
  return {
    note: row.note,
    rough_in: Number(row.rough_in) || 0,
    top_out: Number(row.top_out) || 0,
    trim_set: Number(row.trim_set) || 0,
    sequence_order: row.sequence_order,
  }
}
