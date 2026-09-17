/**
 * The Labor tab's two cost-parameter summaries, read from the tab's STRING inputs (Pricing
 * decomposition, L4 Stage A — `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md` region L4).
 *
 * Until v2.3565 each formula lived twice in `BidsLaborTab` as a string-parsing IIFE — once for
 * the box's collapsed one-liner, once for its expanded body — so a default fixed in one copy
 * could drift from the other. These two functions are those IIFEs, verbatim in their
 * arithmetic, and the four call sites read them.
 *
 * They are deliberately NOT `bidCostCalc.ts` (map quirk 7): that file reads the PERSISTED
 * `cost_estimates` row, where a stored `0` is honored and only null falls back to the default.
 * The boxes read the in-flight strings, where `parseFloat('') || 0.70` means an empty or zero
 * rate box shows the default — the number the autosave will write. Both readings are right for
 * their input; keep them apart.
 */

export type DrivingSummary = {
  /** Miles from the office, from `bids.distance_from_office` (0 when unset). */
  distance: number
  totalHours: number
  /** $/mile — the rate box, or 0.70 when empty / unparseable / zero. */
  ratePerMile: number
  /** Hours of labor per round trip — the box, or 2.0 when empty / unparseable / zero. */
  hoursPerTrip: number
  numTrips: number
  drivingCost: number
}

/** Driving cost = (Σ hours ÷ hours per trip) × $/mile × distance. */
export function drivingSummaryFromInputs(input: {
  distanceFromOffice: string | number | null | undefined
  totalHours: number
  drivingCostRate: string
  hoursPerTrip: string
}): DrivingSummary {
  const distance = parseFloat(String(input.distanceFromOffice ?? '0')) || 0
  const ratePerMile = parseFloat(input.drivingCostRate) || 0.70
  const hoursPerTrip = parseFloat(input.hoursPerTrip) || 2.0
  const numTrips = input.totalHours / hoursPerTrip
  return { distance, totalHours: input.totalHours, ratePerMile, hoursPerTrip, numTrips, drivingCost: numTrips * ratePerMile * distance }
}

export type TravelSummary = {
  /** Whole people, never negative. */
  people: number
  /** Whole nights, never negative. */
  nights: number
  mealsRate: number
  hotelRate: number
  mealsCost: number
  hotelCost: number
  /** meals + hotels. */
  travelCost: number
}

/** Lodging and meals = people × nights × (meals rate + hotel rate), people and nights rounded and floored at 0. */
export function travelSummaryFromInputs(input: {
  travelPeople: string
  travelNights: string
  travelMealsRate: string
  travelHotelRate: string
}): TravelSummary {
  const people = Math.max(0, Math.round(parseFloat(input.travelPeople) || 0))
  const nights = Math.max(0, Math.round(parseFloat(input.travelNights) || 0))
  const mealsRate = parseFloat(input.travelMealsRate) || 0
  const hotelRate = parseFloat(input.travelHotelRate) || 0
  const mealsCost = people * nights * mealsRate
  const hotelCost = people * nights * hotelRate
  return { people, nights, mealsRate, hotelRate, mealsCost, hotelCost, travelCost: mealsCost + hotelCost }
}
