// Wheels on Labor (v2.2733): what a person's vehicle costs per field hour.
//
// Every field person is on one of three deals, and the deal decides where fuel
// and truck cost land on People → Review (PR 2):
//   none          — rides along / office. Nothing changes for them.
//   own_fuel_paid — drives their own vehicle, the company pays fuel. Fuel is
//                   part of employing that person → their labor cost.
//   company       — drives a company truck. Fuel + insurance + registration +
//                   service, per field hour, tied to the truck they hold.
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

/** Card charges are negative amounts; refunds positive. Both count toward fuel spend as |amount|, same as the card-charge sums elsewhere. */
export function sumFuelByUser(charges: ReadonlyArray<{ amount: number; userId: string | null }>): Map<string, number> {
  const m = new Map<string, number>()
  for (const c of charges) {
    if (!c.userId) continue
    m.set(c.userId, round2((m.get(c.userId) ?? 0) + Math.abs(c.amount)))
  }
  return m
}

/** A transaction in the fuel family, before the card test. */
export type FuelFamilyTx = {
  id: string
  amount: number
  kind: string
  counterparty: string | null
  /** True when the row carries a Mercury debit card (a purchase at the pump / the parts counter). */
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
 * Only card purchases count as fuel (v2.2739). A $36k ACH to a supply
 * house that someone filed under a vehicle label is not anyone's fill-up;
 * before this split it showed up as "fuel with no person on it".
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
    if (r.hasCard && r.kind === 'debitCardTransaction') {
      if (r.cardId && companyCardIds.has(r.cardId)) {
        companyUsd += Math.abs(r.amount)
        companyN++
        byCompanyCard.set(r.cardId, (byCompanyCard.get(r.cardId) ?? 0) + Math.abs(r.amount))
        continue
      }
      card.push(r)
      continue
    }
    usd += Math.abs(r.amount)
    n++
    const cp = (r.counterparty ?? '').trim() || 'Unknown'
    byCp.set(cp, (byCp.get(cp) ?? 0) + Math.abs(r.amount))
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
    e.usd += Math.abs(r.amount)
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
}

export type TruckRunningCost = {
  fuel: number
  insurance: number
  registration: number
  service: number
  total: number
  /** null when the holder logged no field hours — there is nothing to divide by. */
  ratePerFieldHour: number | null
}

export function truckRunningCost(i: TruckRunningCostInput): TruckRunningCost {
  const weeks = Math.max(0, i.days) / 7
  const insurance = round2((i.onPlan ? Math.max(0, i.weeklyInsurance ?? 0) : 0) * weeks)
  const registration = round2(Math.max(0, i.weeklyRegistration ?? 0) * weeks)
  const fuel = round2(Math.max(0, i.fuelUsd))
  const service = round2(Math.max(0, i.serviceUsd))
  const total = round2(fuel + insurance + registration + service)
  const ratePerFieldHour = i.holderFieldHours > 0 ? round2(total / i.holderFieldHours) : null
  return { fuel, insurance, registration, service, total, ratePerFieldHour }
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
  /** Manual $/field h from pay config; wins over the computed rate. */
  override: number | null
  /** Computed rate for the arrangement (own: fuel ÷ h; company: the truck's all-in rate). */
  computedRate: number | null
  effectiveRate: number | null
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
    let computedRate: number | null = null
    let note = ''
    if (p.arrangement === 'own_fuel_paid') {
      computedRate = fuelPerFieldHour
      note = fieldHours > 0 ? `fuel ÷ ${fieldHours.toFixed(1)} field h` : 'no field hours in the window'
      if (!p.userId) note = 'not linked to a login — fuel cannot be attributed'
    } else if (p.arrangement === 'company') {
      if (!truck) note = 'holds no company truck — assign one on Vehicles'
      else {
        computedRate = truck.cost.ratePerFieldHour
        note = truck.holderFieldHours > 0 ? `${truck.name} · $${truck.cost.total.toLocaleString('en-US')} ÷ ${truck.holderFieldHours.toFixed(1)} field h` : `${truck.name} · no field hours in the window`
      }
    } else {
      note = truck ? `holds ${truck.name} but is set to None` : fuelUsd > 0 ? 'fuel stays on the job as parts' : ''
    }
    const effectiveRate = p.override ?? computedRate
    if (p.override != null) note = `manual override${computedRate != null ? ` (computed $${computedRate.toFixed(2)})` : ''}`
    return { userId: p.userId, name: p.name, arrangement: p.arrangement, truck, fuelUsd, fieldHours, fuelPerFieldHour, override: p.override, computedRate, effectiveRate, note }
  })
  const order: Record<VehicleArrangement, number> = { company: 0, own_fuel_paid: 1, none: 2 }
  return rows.sort((a, b) => order[a.arrangement] - order[b.arrangement] || b.fuelUsd - a.fuelUsd || a.name.localeCompare(b.name))
}

/** The line under the report: how the two deals compare per field hour. */
export function wheelsComparison(rows: readonly WheelsPersonRow[]): { ownAvg: number | null; companyAvg: number | null } {
  const avg = (xs: number[]) => (xs.length > 0 ? round2(xs.reduce((s, x) => s + x, 0) / xs.length) : null)
  return {
    ownAvg: avg(rows.filter((r) => r.arrangement === 'own_fuel_paid' && r.computedRate != null).map((r) => r.computedRate as number)),
    companyAvg: avg(rows.filter((r) => r.arrangement === 'company' && r.computedRate != null).map((r) => r.computedRate as number)),
  }
}
