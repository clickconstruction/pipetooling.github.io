import { describe, expect, it } from 'vitest'

import { defaultTradeSelection, filterHousesByTrades, houseServesAnyTrade, housesForBidTrade, tradeNamesFor, tradesByHouse } from './supplyHouseTrades'

const PLUMBING = 'st-plumbing'
const ELECTRICAL = 'st-electrical'
const HVAC = 'st-hvac'
const ALL = [PLUMBING, ELECTRICAL, HVAC]
const TYPES = [
  { id: PLUMBING, name: 'Plumbing' },
  { id: ELECTRICAL, name: 'Electrical' },
  { id: HVAC, name: 'HVAC' },
]

const HOUSES = [{ id: 'ferguson' }, { id: 'ced' }, { id: 'garner' }, { id: 'moore' }]
const LINKS = [
  { supply_house_id: 'ferguson', service_type_id: PLUMBING },
  { supply_house_id: 'ferguson', service_type_id: HVAC },
  { supply_house_id: 'ced', service_type_id: ELECTRICAL },
  { supply_house_id: 'garner', service_type_id: HVAC },
]
const BY_HOUSE = tradesByHouse(LINKS)

describe('houseServesAnyTrade', () => {
  it('an untagged house serves everyone', () => {
    expect(houseServesAnyTrade('moore', [ELECTRICAL], BY_HOUSE)).toBe(true)
  })
  it('a tagged house serves only its trades', () => {
    expect(houseServesAnyTrade('ced', [ELECTRICAL], BY_HOUSE)).toBe(true)
    expect(houseServesAnyTrade('ced', [PLUMBING, HVAC], BY_HOUSE)).toBe(false)
    expect(houseServesAnyTrade('ferguson', [HVAC], BY_HOUSE)).toBe(true)
  })
})

describe('defaultTradeSelection', () => {
  it('starts a restricted viewer on their own trades and everyone else on all', () => {
    expect([...defaultTradeSelection(ALL, [PLUMBING])]).toEqual([PLUMBING])
    expect([...defaultTradeSelection(ALL, null)]).toEqual(ALL)
    expect([...defaultTradeSelection(ALL, [])]).toEqual(ALL)
  })
  it('ignores restriction ids that no longer exist, and never returns empty', () => {
    expect([...defaultTradeSelection(ALL, ['gone'])]).toEqual(ALL)
    expect([...defaultTradeSelection(ALL, ['gone', HVAC])]).toEqual([HVAC])
  })
})

describe('filterHousesByTrades', () => {
  it('applies no filter when nothing or everything is selected', () => {
    expect(filterHousesByTrades(HOUSES, new Set(), ALL, BY_HOUSE)).toHaveLength(4)
    expect(filterHousesByTrades(HOUSES, new Set(ALL), ALL, BY_HOUSE)).toHaveLength(4)
  })
  it('keeps untagged houses plus those serving a selected trade', () => {
    expect(filterHousesByTrades(HOUSES, new Set([PLUMBING]), ALL, BY_HOUSE).map((h) => h.id)).toEqual(['ferguson', 'moore'])
    expect(filterHousesByTrades(HOUSES, new Set([ELECTRICAL]), ALL, BY_HOUSE).map((h) => h.id)).toEqual(['ced', 'moore'])
    expect(filterHousesByTrades(HOUSES, new Set([HVAC, ELECTRICAL]), ALL, BY_HOUSE).map((h) => h.id)).toEqual(['ferguson', 'ced', 'garner', 'moore'])
  })
})

describe('tradeNamesFor', () => {
  it('lists names in service-type order, empty when untagged', () => {
    expect(tradeNamesFor('ferguson', BY_HOUSE, TYPES)).toEqual(['Plumbing', 'HVAC'])
    expect(tradeNamesFor('moore', BY_HOUSE, TYPES)).toEqual([])
  })
})

describe('housesForBidTrade', () => {
  it('defaults the picker to the bid trade and counts what it hid', () => {
    const r = housesForBidTrade(HOUSES, PLUMBING, BY_HOUSE)
    expect(r.shown.map((h) => h.id)).toEqual(['ferguson', 'moore'])
    expect(r.hidden).toBe(2)
  })
  it('hides nothing when the bid has no trade', () => {
    expect(housesForBidTrade(HOUSES, null, BY_HOUSE)).toEqual({ shown: HOUSES, hidden: 0 })
  })
})
