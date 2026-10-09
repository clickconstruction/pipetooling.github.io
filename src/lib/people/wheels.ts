// Wheels on Labor (v2.2733): what a person's vehicle costs per field hour.
//
// Every field person is on one of three deals. Since punch list #52 PR 5 (v2.4653) fuel stays
// on the jobs it was put on, on every screen, Review included; the deal decides only what the
// person's vehicle line on People → Review charges for what is NOT on a job:
//   none          — rides along / office. No vehicle line.
//   own_fuel_paid — drives their own vehicle, the company pays fuel. The line is their fuel on
//                   no job in the period (plus a manual fixed $/field h, if the office sets one).
//   company       — drives a company truck. The line is the truck's fixed costs (insurance +
//                   registration + service + wear, v2.5039) per field hour, plus their fuel on no job.
// This module is pure: the loader (`wheelsData.ts`) gathers the trailing-90-day
// facts and these functions turn them into rates and report rows.

import { ymdAddDays } from '../../utils/dateUtils'

export type VehicleArrangement = 'none' | 'own_fuel_paid' | 'company'

export const VEHICLE_ARRANGEMENT_OPTIONS: ReadonlyArray<{ key: VehicleArrangement; label: string; short: string; icon: string }> = [
  { key: 'none', label: 'None', short: '—', icon: '' },
  { key: 'own_fuel_paid', label: 'Own vehicle · fuel paid', short: 'own', icon: '🚗' },
  { key: 'company', label: 'Company truck', short: 'company', icon: '🚚' },
]

export function parseVehicleArrangement(raw: unknown): VehicleArrangement {
  return raw === 'own_fuel_paid' || raw === 'company' ? raw : 'none'
}

export function vehicleArrangementLabel(a: VehicleArrangement): string {
  return VEHICLE_ARRANGEMENT_OPTIONS.find((o) => o.key === a)?.label ?? 'None'
}

/** Trailing window every Wheels number is measured over. Matches the parts-burden rate's 90 days. */
export const WHEELS_WINDOW_DAYS = 90

export function wheelsWindow(todayYmd: string): { start: string; end: string; days: number } {
  return { start: ymdAddDays(todayYmd, -(WHEELS_WINDOW_DAYS - 1)), end: todayYmd, days: WHEELS_WINDOW_DAYS }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Wheels PR 3 (v2.5039, the owner's call of 2026-10-09): wear is the truck's own value over its
 * life — its latest replacement value spread over this many years, pro-rated to the window. The
 * fleet's server read (`fleet_truck_rate_per_field_hour`) uses the same life.
 */
export const WHEELS_WEAR_LIFE_YEARS = 5

/** A truck's wear in a window of `days`: its replacement value ÷ the life in days × the window. $0 with no value on file. */
export function truckWearForWindow(replacementValueUsd: number | null | undefined, days: number): number {
  const value = Number(replacementValueUsd ?? 0)
  if (!Number.isFinite(value) || value <= 0) return 0
  return round2((value / (WHEELS_WEAR_LIFE_YEARS * 365)) * Math.max(0, days))
}

/** Money out as cost: a purchase (negative on the bank's side) adds, a refund (positive) comes off — the one card rule's sign (`cardChargeCostUsd`). */
function costUsd(amount: number): number {
  const n = Number(amount)
  return Number.isFinite(n) ? 0 - n : 0
}

/** Fuel spend by user: a purchase adds and a refund comes off, as on every job screen. */
export function sumFuelByUser(charges: ReadonlyArray<{ amount: number; userId: string | null }>): Map<string, number> {
  const m = new Map<string, number>()
  for (const c of charges) {
    if (!c.userId) continue
    m.set(c.userId, round2((m.get(c.userId) ?? 0) + costUsd(c.amount)))
  }
  return m
}

/** A transaction in the fuel family, before the card test. */
export type FuelFamilyTx = {
  id: string
  amount: number
  kind: string
  counterparty: string | null
  /** True when the row carries a Mercury debit card: a purchase, or a refund to the card (Mercury files those as kind `other`). */
  hasCard: boolean
  /** The card id when known (lower-cased). */
  cardId?: string | null
}

export type FuelSplit = {
  /** Purchases on a person's card — the only rows that can be someone's fuel. */
  card: FuelFamilyTx[]
  /** Fuel-family rows with no card (ACH supplier payments, transfers…) — usually a mislabel; shown, never counted. */
  offCard: { usd: number; n: number; top: Array<{ counterparty: string; usd: number }> }
  /** Purchases on company cards (management tools — GPS, charging, subscriptions): not fuel, shown by card. v2.2750 */
  companyCard: { usd: number; n: number; byCard: Array<{ cardId: string; usd: number }> }
}

/**
 * Only card charges count as fuel (v2.2739). A $36k ACH to a supply
 * house that someone filed under a vehicle label is not anyone's fill-up;
 * before this split it showed up as "fuel with no person on it". A card
 * charge is any row carrying a card (v2.4653): a refund to the card is kind
 * `other` and comes off, as it does on the jobs.
 */
export function splitFuelFamily(rows: readonly FuelFamilyTx[], companyCardIds: ReadonlySet<string> = new Set()): FuelSplit {
  const card: FuelFamilyTx[] = []
  const byCp = new Map<string, number>()
  const byCompanyCard = new Map<string, number>()
  let usd = 0
  let n = 0
  let companyUsd = 0
  let companyN = 0
  for (const r of rows) {
    if (r.hasCard) {
      if (r.cardId && companyCardIds.has(r.cardId)) {
        companyUsd += costUsd(r.amount)
        companyN++
        byCompanyCard.set(r.cardId, (byCompanyCard.get(r.cardId) ?? 0) + costUsd(r.amount))
        continue
      }
      card.push(r)
      continue
    }
    usd += costUsd(r.amount)
    n++
    const cp = (r.counterparty ?? '').trim() || 'Unknown'
    byCp.set(cp, (byCp.get(cp) ?? 0) + costUsd(r.amount))
  }
  const top = [...byCp.entries()]
    .map(([counterparty, u]) => ({ counterparty, usd: round2(u) }))
    .sort((a, b) => b.usd - a.usd)
    .slice(0, 3)
  const byCard = [...byCompanyCard.entries()].map(([cardId, u]) => ({ cardId, usd: round2(u) })).sort((a, b) => b.usd - a.usd)
  return { card, offCard: { usd: round2(usd), n, top }, companyCard: { usd: round2(companyUsd), n: companyN, byCard } }
}

/** Card fuel nobody is attributed to, grouped by card — the list to link. */
export function unattributedFuelByCard(
  rows: ReadonlyArray<{ amount: number; cardId: string | null; userId: string | null }>,
  nicknameByCard: ReadonlyMap<string, string>,
): Array<{ cardId: string | null; label: string; usd: number; n: number }> {
  const m = new Map<string, { cardId: string | null; usd: number; n: number }>()
  for (const r of rows) {
    if (r.userId) continue
    const key = r.cardId ?? '(no card)'
    const e = m.get(key) ?? { cardId: r.cardId, usd: 0, n: 0 }
    e.usd += costUsd(r.amount)
    e.n++
    m.set(key, e)
  }
  return [...m.values()]
    .map((e) => ({
      cardId: e.cardId,
      label: e.cardId ? (nicknameByCard.get(e.cardId) ?? `card …${e.cardId.replace(/-/g, '').slice(-4)}`) : 'no card',
      usd: round2(e.usd),
      n: e.n,
    }))
    .sort((a, b) => b.usd - a.usd)
}

export type WheelsSessionRow = {
  user_id: string
  job_ledger_id: string | null
  bid_id: string | null
  clocked_in_at: string
  clocked_out_at: string | null
  approved_at: string | null
  rejected_at: string | null
  revoked_at: string | null
}

/** Approved, closed sessions on a job (not a bid) → hours per user. The same "field hours" the parts burden divides by. */
export function fieldHoursByUser(sessions: readonly WheelsSessionRow[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of sessions) {
    if (!s.job_ledger_id || s.bid_id) continue
    if (!s.approved_at || s.rejected_at || s.revoked_at || !s.clocked_out_at) continue
    const t0 = new Date(s.clocked_in_at).getTime()
    const t1 = new Date(s.clocked_out_at).getTime()
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) continue
    m.set(s.user_id, (m.get(s.user_id) ?? 0) + (t1 - t0) / 3600000)
  }
  return m
}

export type TruckRunningCostInput = {
  /** Fuel & gas card charges attributed to the holder in the window. */
  fuelUsd: number
  weeklyInsurance: number | null | undefined
  weeklyRegistration: number | null | undefined
  /** Off an insurance plan → the stored premium is not being paid. */
  onPlan: boolean
  /** Window length in days; weekly costs are pro-rated by days ÷ 7. */
  days: number
  /** Oil changes + services with a cost in the window. */
  serviceUsd: number
  /** The holder's field hours in the window. */
  holderFieldHours: number
  /** v2.5039 · the truck's latest replacement value: its wear. Absent or null adds none. */
  replacementValueUsd?: number | null
}

export type TruckRunningCost = {
  fuel: number
  insurance: number
  registration: number
  service: number
  /** v2.5039 · the truck's value over its life, for the window (`truckWearForWindow`); 0 with no replacement value. */
  wear: number
  /** A replacement value is on file, so wear could be priced. */
  hasReplacementValue: boolean
  total: number
  /** The all-in rate, fuel included — the report's comparison. null when the holder logged no field hours. */
  ratePerFieldHour: number | null
  /** Insurance + registration + service + wear per field hour — what Review charges besides the holder's fuel on no job. null with no field hours. */
  fixedRatePerFieldHour: number | null
}

export function truckRunningCost(i: TruckRunningCostInput): TruckRunningCost {
  const weeks = Math.max(0, i.days) / 7
  const insurance = round2((i.onPlan ? Math.max(0, i.weeklyInsurance ?? 0) : 0) * weeks)
  const registration = round2(Math.max(0, i.weeklyRegistration ?? 0) * weeks)
  const fuel = round2(Math.max(0, i.fuelUsd))
  const service = round2(Math.max(0, i.serviceUsd))
  const wear = truckWearForWindow(i.replacementValueUsd, i.days)
  const hasReplacementValue = Number(i.replacementValueUsd ?? 0) > 0
  const total = round2(fuel + insurance + registration + service + wear)
  const ratePerFieldHour = i.holderFieldHours > 0 ? round2(total / i.holderFieldHours) : null
  const fixedRatePerFieldHour = i.holderFieldHours > 0 ? round2((insurance + registration + service + wear) / i.holderFieldHours) : null
  return { fuel, insurance, registration, service, wear, hasReplacementValue, total, ratePerFieldHour, fixedRatePerFieldHour }
}

/** One company vehicle as the fleet rate reads it: its fixed costs and its value, no holder. */
export type FleetTruckInput = {
  weeklyInsurance: number | null | undefined
  weeklyRegistration: number | null | undefined
  onPlan: boolean
  serviceUsd: number
  replacementValueUsd: number | null | undefined
}

/**
 * Wheels PR 3 (v2.5039): what the company's trucks cost per field hour, for the Bids crew-rate card.
 * Every vehicle's fixed costs and wear in the window (`truckRunningCost`, fuel left on the jobs),
 * divided by the whole crew's field hours in the same window. null with no field hours. The server
 * read `fleet_truck_rate_per_field_hour` computes the same for roles that cannot read the fleet.
 */
export function fleetTruckRate(trucks: ReadonlyArray<FleetTruckInput>, crewFieldHours: number, days: number): { fixedUsd: number; ratePerFieldHour: number | null } {
  const fixedUsd = round2(
    trucks.reduce((sum, t) => {
      const c = truckRunningCost({ fuelUsd: 0, weeklyInsurance: t.weeklyInsurance, weeklyRegistration: t.weeklyRegistration, onPlan: t.onPlan, days, serviceUsd: t.serviceUsd, holderFieldHours: 0, replacementValueUsd: t.replacementValueUsd })
      return sum + c.insurance + c.registration + c.service + c.wear
    }, 0),
  )
  return { fixedUsd, ratePerFieldHour: crewFieldHours > 0 ? round2(fixedUsd / crewFieldHours) : null }
}

/** Own vehicle, fuel paid: that person's fuel ÷ their field hours. */
export function ownVehicleFuelRate(fuelUsd: number, fieldHours: number): number | null {
  return fieldHours > 0 ? round2(Math.max(0, fuelUsd) / fieldHours) : null
}

export type WheelsTruck = {
  vehicleId: string
  name: string
  holderUserId: string | null
  holderName: string | null
  cost: TruckRunningCost
  holderFieldHours: number
}

export type WheelsPersonRow = {
  userId: string | null
  name: string
  arrangement: VehicleArrangement
  truck: WheelsTruck | null
  /** Fuel & gas charges attributed to this person in the window, whatever the arrangement. */
  fuelUsd: number
  fieldHours: number
  fuelPerFieldHour: number | null
  /** What the deal costs per field hour, fuel included (own: fuel ÷ h; company: the truck all-in) — the report's comparison, not what Review charges. */
  allInRate: number | null
  /** Manual fixed $/field h from pay config; wins over the computed fixed rate. Fuel is never in it. */
  override: number | null
  /** Fixed costs per field hour for the deal (own: none, $0; company: the truck's insurance + registration + service). */
  computedFixedRate: number | null
  /** What Review charges per field hour besides the person's fuel on no job: the override, else the computed fixed rate. */
  fixedRate: number | null
  /** Why the rate is what it is, or why there is none. */
  note: string
}

export type WheelsPersonInput = {
  name: string
  userId: string | null
  arrangement: VehicleArrangement
  override: number | null
}

export function buildWheelsRows(
  people: readonly WheelsPersonInput[],
  fuelByUser: ReadonlyMap<string, number>,
  fieldHoursByUserId: ReadonlyMap<string, number>,
  trucks: readonly WheelsTruck[],
): WheelsPersonRow[] {
  const truckByHolder = new Map<string, WheelsTruck>()
  for (const t of trucks) if (t.holderUserId) truckByHolder.set(t.holderUserId, t)
  const rows: WheelsPersonRow[] = people.map((p) => {
    const fuelUsd = p.userId ? (fuelByUser.get(p.userId) ?? 0) : 0
    const fieldHours = p.userId ? (fieldHoursByUserId.get(p.userId) ?? 0) : 0
    const fuelPerFieldHour = ownVehicleFuelRate(fuelUsd, fieldHours)
    const truck = p.userId ? (truckByHolder.get(p.userId) ?? null) : null
    let allInRate: number | null = null
    let computedFixedRate: number | null = null
    let note = ''
    if (p.arrangement === 'own_fuel_paid') {
      allInRate = fuelPerFieldHour
      computedFixedRate = 0
      note = 'fuel stays on the jobs; Review charges their fuel on no job'
      if (!p.userId) note = 'not linked to a login — fuel cannot be attributed'
    } else if (p.arrangement === 'company') {
      if (!truck) note = 'holds no company truck — assign one on Vehicles'
      else {
        allInRate = truck.cost.ratePerFieldHour
        computedFixedRate = truck.cost.fixedRatePerFieldHour
        const fixed = round2(truck.cost.insurance + truck.cost.registration + truck.cost.service + truck.cost.wear)
        // v2.5039 · wear is in the fixed part; a truck with no replacement value on file says so.
        const noWear = truck.cost.hasReplacementValue ? '' : ', no replacement value on file'
        note =
          truck.holderFieldHours <= 0
            ? `${truck.name} · no field hours in the window`
            : fixed > 0
              ? `${truck.name} · $${fixed.toLocaleString('en-US')} fixed ÷ ${truck.holderFieldHours.toFixed(1)} field h${noWear}; fuel stays on the jobs`
              : `${truck.name} · no insurance, registration, service or replacement value on file; Review charges only their fuel on no job`
      }
    } else {
      note = truck ? `holds ${truck.name} but is set to None` : fuelUsd > 0 ? 'fuel stays on the job as parts' : ''
    }
    const fixedRate = p.override ?? computedFixedRate
    if (p.override != null) note = `manual fixed rate${computedFixedRate != null ? ` (computed $${computedFixedRate.toFixed(2)})` : ''}; fuel stays on the jobs`
    return { userId: p.userId, name: p.name, arrangement: p.arrangement, truck, fuelUsd, fieldHours, fuelPerFieldHour, allInRate, override: p.override, computedFixedRate, fixedRate, note }
  })
  const order: Record<VehicleArrangement, number> = { company: 0, own_fuel_paid: 1, none: 2 }
  return rows.sort((a, b) => order[a.arrangement] - order[b.arrangement] || b.fuelUsd - a.fuelUsd || a.name.localeCompare(b.name))
}

/** The line under the report: how the two deals compare per field hour. */
export function wheelsComparison(rows: readonly WheelsPersonRow[]): { ownAvg: number | null; companyAvg: number | null } {
  const avg = (xs: number[]) => (xs.length > 0 ? round2(xs.reduce((s, x) => s + x, 0) / xs.length) : null)
  return {
    ownAvg: avg(rows.filter((r) => r.arrangement === 'own_fuel_paid' && r.allInRate != null).map((r) => r.allInRate as number)),
    companyAvg: avg(rows.filter((r) => r.arrangement === 'company' && r.allInRate != null).map((r) => r.allInRate as number)),
  }
}
