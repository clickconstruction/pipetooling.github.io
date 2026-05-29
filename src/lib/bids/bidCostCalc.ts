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
