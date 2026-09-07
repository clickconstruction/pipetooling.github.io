import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The Wheels report loader. Its kernels (wheels.ts, vehicleFleet.ts, the
 * category-tag lookups) have their own suites; this pins the composition: the
 * window and query filters, which charges count as fuel (tag by label, else by
 * bank category), the card / off-card / company-card split, attribution to
 * people, the trucks with their holders, and a hand-computed set of rows.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => unknown = () => []
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') {
              return (resolve: (v: { data: unknown; error: null }) => void, reject: (e: unknown) => void) => {
                try {
                  resolve({ data: route(table, steps), error: null })
                } catch (e) {
                  reject(e)
                }
              }
            }
            return (...a: unknown[]) => {
              steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
  },
}))
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: null }>) => (await op()).data,
}))
const tagRow = (over: Record<string, unknown>) => ({ id: 't', name: 'Tag', icon: '🏷', color: 'gray', sort_order: 1, default_key: null, show_as_cost_line: false, hide_from_picker: false, ...over })
let tags: unknown[] = []
const members = [
  { tag_id: 'tag-fuel', bank_category: 'Gas Stations', label_id: null },
  { tag_id: 'tag-fuel', bank_category: null, label_id: 'lbl-fuel' },
  { tag_id: 'tag-meals', bank_category: 'Restaurants', label_id: null },
]
const loadCategoryTags = vi.fn(async () => ({ tags, members }))
const fetchLabelIdByTxId = vi.fn(async (_ids: readonly string[]) => new Map([['tx2', 'lbl-fuel'], ['tx6', 'lbl-other']]))
vi.mock('../banking/categoryTagsData', () => ({ loadCategoryTags: () => loadCategoryTags(), fetchLabelIdByTxId: (ids: readonly string[]) => fetchLabelIdByTxId(ids) }))
const fetchAttributions = vi.fn(async (_ids: string[], _label: string) => [{ mercury_transaction_id: 'tx1', user_id: 'u-ana' }])
vi.mock('../fetchMercuryRelationsByTxIds', () => ({ fetchAttributionsByMercuryTxIds: (ids: string[], label: string) => fetchAttributions(ids, label) }))
const loadDirectory = vi.fn(async () => ({ nicknameByCard: { 'card-b': 'Truck 2 card' } as Record<string, string>, roleByCard: { 'card-c': 'company' } as Record<string, string> }))
vi.mock('../banking/debitCards', () => ({ loadDebitCardDirectory: () => loadDirectory() }))
// The raw-payload parser has its own suite; here a card id rides on `raw.cardId`.
vi.mock('../mercuryRawDebitCard', () => ({ mercuryDebitCardIdFromRaw: (raw: { cardId?: string } | null) => raw?.cardId ?? null }))

import { loadWheelsSnapshot, saveVehicleRateOverride } from './wheelsData'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const q = (table: string, pred: (steps: Step[]) => boolean = () => true) => queries.find((x) => x.table === table && pred(x.steps))!
const session = (over: Record<string, unknown>) => ({ user_id: 'u-ana', job_ledger_id: 'j1', bid_id: null, clocked_in_at: '2026-09-01T13:00:00Z', clocked_out_at: '2026-09-01T21:00:00Z', approved_at: '2026-09-01T22:00:00Z', rejected_at: null, revoked_at: null, ...over })
const data: Record<string, unknown[]> = {
  people_pay_config: [
    { person_name: 'Ana', vehicle_arrangement: 'own_fuel_paid', vehicle_rate_override: null },
    { person_name: 'Bob ', vehicle_arrangement: 'company', vehicle_rate_override: null },
    { person_name: 'Cy', vehicle_arrangement: 'bogus', vehicle_rate_override: 2.5 },
  ],
  mercury_transactions: [
    { id: 'tx1', amount: -60, kind: 'debitCardTransaction', mercury_category: 'Gas Stations', counterparty_name: 'Shell' }, // fuel by bank category, Ana's card
    { id: 'tx2', amount: -40, kind: 'debitCardTransaction', mercury_category: 'Restaurants', counterparty_name: 'Buc-ees' }, // fuel by accounting label, nobody attributed
    { id: 'tx3', amount: -500, kind: 'externalTransfer', mercury_category: 'Gas Stations', counterparty_name: ' Fuel Supplier LLC ' }, // fuel family, no card
    { id: 'tx4', amount: -25, kind: 'debitCardTransaction', mercury_category: 'Gas Stations', counterparty_name: 'Shell' }, // company card
    { id: 'tx5', amount: -30, kind: 'debitCardTransaction', mercury_category: 'Restaurants', counterparty_name: 'Cafe' }, // meals
    { id: 'tx6', amount: -20, kind: 'debitCardTransaction', mercury_category: 'Gas Stations', counterparty_name: 'Shell' }, // labelled into no tag: untagged
  ],
  raw: [
    { id: 'tx1', raw: { cardId: 'card-a' } },
    { id: 'tx2', raw: { cardId: 'card-b' } },
    { id: 'tx3', raw: null },
    { id: 'tx4', raw: { cardId: 'card-c' } },
  ],
  clock_sessions: [
    session({}), // Ana 8 h field
    session({ user_id: 'u-bob', clocked_out_at: '2026-09-01T17:00:00Z' }), // Bob 4 h field
    session({ bid_id: 'b1', job_ledger_id: null }), // bid time: not field
    session({ user_id: 'u-bob', approved_at: null }), // pending: not counted
  ],
  vehicles: [
    { id: 'v1', year: 2022, make: 'Ford', model: 'F-150', vin: null, weekly_insurance_cost: 35, weekly_registration_cost: 7 },
    { id: 'v2', year: null, make: 'Chevy', model: 'Van', vin: null, weekly_insurance_cost: 10, weekly_registration_cost: 0 },
  ],
  vehicle_possessions: [
    { id: 'p1', vehicle_id: 'v1', user_id: 'u-bob', start_date: '2026-01-01', end_date: null },
    { id: 'p2', vehicle_id: 'v2', user_id: null, start_date: '2026-01-01', end_date: null }, // motor pool
  ],
  vehicle_insurance_periods: [{ id: 'i1', vehicle_id: 'v1', start_date: '2026-01-01', end_date: null }],
  vehicle_service_events: [
    { vehicle_id: 'v1', cost: 120, service_date: '2026-08-01' },
    { vehicle_id: 'v1', cost: null, service_date: '2026-08-02' },
  ],
}
const routeScenario = (table: string, steps: Step[]): unknown => {
  if (table === 'mercury_transactions') {
    const isRaw = argsOf(steps, 'select').some((a) => String(a[0]).includes('raw'))
    if (!isRaw) return data.mercury_transactions
    const ids = argsOf(steps, 'in')[0]![1] as string[]
    return data.raw!.filter((r) => ids.includes((r as { id: string }).id))
  }
  return data[table] ?? []
}
const input = { todayYmd: '2026-09-07', users: [{ id: 'u-ana', name: 'Ana' }, { id: 'u-bob', name: 'Bob' }] }

beforeEach(() => {
  queries.length = 0
  route = routeScenario
  tags = [tagRow({ id: 'tag-fuel', name: 'Fuel & gas', default_key: 'fuel_vehicle' }), tagRow({ id: 'tag-meals', name: 'Meals' })]
  loadCategoryTags.mockClear()
  fetchLabelIdByTxId.mockClear()
  fetchAttributions.mockClear()
  loadDirectory.mockClear()
})

describe('loadWheelsSnapshot', () => {
  it('spans the trailing 90 days and bounds every read to the window', async () => {
    const snap = await loadWheelsSnapshot(input)
    expect(snap.window).toEqual({ start: '2026-06-10', end: '2026-09-07', days: 90 })
    const tx = q('mercury_transactions', (s) => !argsOf(s, 'select').some((a) => String(a[0]).includes('raw')))
    expect(argsOf(tx.steps, 'gte')).toEqual([['posted_at', '2026-06-10']])
    expect(argsOf(tx.steps, 'lt')).toEqual([['posted_at', '2026-09-08']]) // end is inclusive → exclusive bound is the next day
    expect(argsOf(tx.steps, 'range')).toEqual([[0, 999]])
    const cs = q('clock_sessions')
    expect(argsOf(cs.steps, 'gte')).toEqual([['work_date', '2026-06-10']])
    expect(argsOf(cs.steps, 'lte')).toEqual([['work_date', '2026-09-07']])
    const sv = q('vehicle_service_events')
    expect(argsOf(sv.steps, 'gte')).toEqual([['service_date', '2026-06-10']])
    expect(argsOf(sv.steps, 'lte')).toEqual([['service_date', '2026-09-07']])
    expect(argsOf(q('vehicle_possessions').steps, 'order')).toEqual([['start_date', { ascending: false }]])
    expect(argsOf(q('vehicle_insurance_periods').steps, 'order')).toEqual([['start_date', { ascending: false }]])
    expect(fetchLabelIdByTxId).toHaveBeenCalledWith(['tx1', 'tx2', 'tx3', 'tx4', 'tx5', 'tx6'])
    expect(fetchAttributions).toHaveBeenCalledWith(['tx1', 'tx2'], 'wheels') // only card fuel is anyone's fuel
  })

  it('picks the fuel tag, splits its charges into card / off-card / company-card, and attributes card fuel to people', async () => {
    const snap = await loadWheelsSnapshot(input)
    expect(snap.fuelTag?.id).toBe('tag-fuel')
    expect(snap.unattributedFuelUsd).toBe(40)
    expect(snap.unattributedCards).toEqual([{ cardId: 'card-b', label: 'Truck 2 card', usd: 40, n: 1 }])
    expect(snap.offCardFuelFamily).toEqual({ usd: 500, n: 1, top: [{ counterparty: 'Fuel Supplier LLC', usd: 500 }] })
    expect(snap.companyCardSpend).toEqual({ usd: 25, n: 1, byCard: [{ cardId: 'card-c', label: 'card …ardc', usd: 25 }] })
  })

  it('builds the trucks with their current holders and running cost, holders first', async () => {
    const snap = await loadWheelsSnapshot(input)
    expect(snap.trucks.map((t) => [t.vehicleId, t.name, t.holderUserId, t.holderName, t.holderFieldHours])).toEqual([
      ['v1', '2022 Ford F-150', 'u-bob', 'Bob', 4],
      ['v2', 'Chevy Van', null, null, 0], // motor pool
    ])
    // 90 days = 12.857 weeks: insurance 35/wk on plan, registration 7/wk, one costed service, Bob has no fuel.
    expect(snap.trucks[0]!.cost).toEqual({ fuel: 0, insurance: 450, registration: 90, service: 120, total: 660, ratePerFieldHour: 165 })
    expect(snap.trucks[1]!.cost).toEqual({ fuel: 0, insurance: 0, registration: 0, service: 0, total: 0, ratePerFieldHour: null }) // no insurance period: not on plan
  })

  it('builds a row per pay-config person — company holders first — linking names to logins by trimmed name', async () => {
    const snap = await loadWheelsSnapshot(input)
    expect(snap.rows.map((r) => [r.name, r.userId, r.arrangement, r.fuelUsd, r.fieldHours, r.computedRate, r.effectiveRate])).toEqual([
      ['Bob ', 'u-bob', 'company', 0, 4, 165, 165],
      ['Ana', 'u-ana', 'own_fuel_paid', 60, 8, 7.5, 7.5],
      ['Cy', null, 'none', 0, 0, null, 2.5], // unknown arrangement → none; manual override wins
    ])
    expect(snap.rows[0]!.note).toBe('2022 Ford F-150 · $660 ÷ 4.0 field h')
    expect(snap.rows[2]!.note).toBe('manual override')
    expect(snap.comparison).toEqual({ ownAvg: 7.5, companyAvg: 165 })
  })

  it('without a flagged fuel tag (or with only a name match) the fuel side is empty but trucks and rows still build', async () => {
    tags = [tagRow({ id: 'tag-meals', name: 'Meals' })]
    const snap = await loadWheelsSnapshot(input)
    expect(snap.fuelTag).toBeNull()
    expect(fetchLabelIdByTxId).not.toHaveBeenCalled()
    expect(fetchAttributions).not.toHaveBeenCalled()
    expect(snap.unattributedFuelUsd).toBe(0)
    expect(snap.offCardFuelFamily).toEqual({ usd: 0, n: 0, top: [] })
    expect(snap.trucks).toHaveLength(2)
    expect(snap.rows.map((r) => r.fuelUsd)).toEqual([0, 0, 0])

    tags = [tagRow({ id: 'tag-named', name: 'Diesel & fuel' })]
    expect((await loadWheelsSnapshot(input)).fuelTag?.id).toBe('tag-named') // name fallback
  })

  it('a failed card directory read degrades: no company cards, so that charge counts as unattributed card fuel', async () => {
    loadDirectory.mockRejectedValueOnce(new Error('rls'))
    const snap = await loadWheelsSnapshot(input)
    expect(snap.companyCardSpend).toEqual({ usd: 0, n: 0, byCard: [] })
    expect(snap.unattributedFuelUsd).toBe(65)
    expect(snap.unattributedCards).toEqual([
      { cardId: 'card-b', label: 'card …ardb', usd: 40, n: 1 },
      { cardId: 'card-c', label: 'card …ardc', usd: 25, n: 1 },
    ])
  })

  it('a failed core read throws to the caller', async () => {
    route = (table, steps) => {
      if (table === 'vehicles') throw new Error('vehicles rls')
      return routeScenario(table, steps)
    }
    await expect(loadWheelsSnapshot(input)).rejects.toThrow('vehicles rls')
  })
})

describe('saveVehicleRateOverride', () => {
  it('writes the manual $/field hour (or null to clear) onto the person’s pay config', async () => {
    await saveVehicleRateOverride('Ana', 12.5)
    expect(argsOf(q('people_pay_config').steps, 'update')).toEqual([[{ vehicle_rate_override: 12.5 }]])
    expect(argsOf(q('people_pay_config').steps, 'eq')).toEqual([['person_name', 'Ana']])
    queries.length = 0
    await saveVehicleRateOverride('Ana', null)
    expect(argsOf(q('people_pay_config').steps, 'update')).toEqual([[{ vehicle_rate_override: null }]])
    route = () => {
      throw new Error('read only')
    }
    await expect(saveVehicleRateOverride('Ana', 1)).rejects.toThrow('read only')
  })
})
