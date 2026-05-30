/**
 * Pure cost calculations for the Bids page, extracted from `src/pages/Bids.tsx`.
 */

/**
 * Travel (Meals + Hotels) cost from a cost_estimates row.
 * travelCost = people x nights x (mealsRate + hotelRate); meals-days = nights.
 * Defaults: people = 1, nights = 1, rates = 0 (so $0 until rates are entered).
 */
export function computeTravelCost(ce: unknown): number {
  const row = (ce ?? {}) as {
    travel_people?: unknown
    travel_nights?: unknown
    travel_meals_rate?: unknown
    travel_hotel_rate?: unknown
  }
  const people = row.travel_people != null ? Number(row.travel_people) : 1
  const nights = row.travel_nights != null ? Number(row.travel_nights) : 1
  const mealsRate = row.travel_meals_rate != null ? Number(row.travel_meals_rate) : 0
  const hotelRate = row.travel_hotel_rate != null ? Number(row.travel_hotel_rate) : 0
  if (!Number.isFinite(people) || !Number.isFinite(nights) || !Number.isFinite(mealsRate) || !Number.isFinite(hotelRate)) {
    return 0
  }
  return people * nights * (mealsRate + hotelRate)
}

/**
 * Driving cost rate ($/mile) from a cost_estimates row. Default 0.70.
 * An explicitly stored `0` is honored (only `null`/`undefined` falls back).
 */
export function costEstimateDrivingRate(ce: unknown): number {
  const v = (ce as { driving_cost_rate?: unknown } | null)?.driving_cost_rate
  return v != null ? Number(v) : 0.7
}

/**
 * Hours per round trip from a cost_estimates row. Default 2.0.
 * An explicitly stored `0` is honored (only `null`/`undefined` falls back).
 */
export function costEstimateHoursPerTrip(ce: unknown): number {
  const v = (ce as { hours_per_trip?: unknown } | null)?.hours_per_trip
  return v != null ? Number(v) : 2.0
}

/**
 * Estimator cost from a cost_estimates row.
 * Uses `estimator_cost_flat_amount` when present, otherwise
 * `countLen * (estimator_cost_per_count || 10)`.
 */
export function costEstimateEstimatorCost(ce: unknown, countLen: number): number {
  const row = (ce ?? {}) as {
    estimator_cost_flat_amount?: unknown
    estimator_cost_per_count?: unknown
  }
  return row.estimator_cost_flat_amount != null
    ? Number(row.estimator_cost_flat_amount)
    : countLen * (Number(row.estimator_cost_per_count) || 10)
}
