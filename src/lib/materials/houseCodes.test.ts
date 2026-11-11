import { describe, expect, it } from 'vitest'
import { houseNumberOffers, isNotLiveYet, numberProblem, partNumberRows, toHouseCodes, type HouseCodeRow } from './houseCodes'
import { indexBook, indexHouseCodes, matchRow } from './partMatch'

// Every house, part and number here is made up.
const row = (over: Partial<HouseCodeRow>): HouseCodeRow => ({
  id: 'c1', supply_house_id: 'hill', code: '512207', code_key: '512207', part_id: 'kit', not_a_part: false, unit_factor: 1, taught_from: 'typed', ...over,
})
const HOUSES = [{ id: 'hill', name: 'Hillcrest Supply' }, { id: 'bord', name: 'Borden Pipe & Supply' }, { id: 'cany', name: 'Canyon Wholesale' }]

describe('toHouseCodes', () => {
  it('feeds the matcher: the house number finds the part, and a catch-all number finds none', () => {
    const codes = indexHouseCodes(toHouseCodes([row({}), row({ id: 'c2', code: '440118', code_key: '440118', part_id: null, not_a_part: true })]))
    const book = indexBook([{ id: 'kit', name: 'AX8802XL-LR-PC ARLO SUPPLY KIT' }])
    expect(matchRow({ supplyHouseId: 'hill', houseCode: '512-207', description: 'SUPPLY KIT' }, book, codes).part?.id).toBe('kit')
    expect(matchRow({ supplyHouseId: 'hill', houseCode: '440118', description: 'MISC CHARGE' }, book, codes).how).toBe('not_a_part')
  })
})

describe('partNumberRows', () => {
  it('lists the houses that price the part first, then a house with a number and no price', () => {
    const rows = partNumberRows(HOUSES, ['hill'], [row({}), row({ id: 'c3', supply_house_id: 'cany', code: 'CW-20418', code_key: 'CW20418' })])
    expect(rows.map((r) => [r.houseName, r.priced, r.codes.map((c) => c.code)])).toEqual([
      ['Hillcrest Supply', true, ['512207']],
      ['Canyon Wholesale', false, ['CW-20418']],
    ])
  })
  it('a priced house with no number yet still has its row', () => {
    expect(partNumberRows(HOUSES, ['bord'], []).map((r) => r.houseName)).toEqual(['Borden Pipe & Supply'])
  })
})

describe('numberProblem', () => {
  const name = (id: string) => (id === 'trap' ? 'AX87029-BPC ARLO P-TRAP' : null)
  it('a blank or a number with no letter or digit', () => {
    expect(numberProblem('  ', 'kit', 'Hillcrest Supply', [], name)).toBe('Type the number as the house prints it.')
    expect(numberProblem(' -- ', 'kit', 'Hillcrest Supply', [], name)).toBe('A number needs a letter or a digit.')
  })
  it('a new number is fine', () => {
    expect(numberProblem('512207', 'kit', 'Hillcrest Supply', [], name)).toBeNull()
  })
  it('names the part that house already uses the number for, however it is dashed', () => {
    expect(numberProblem('512-207', 'kit', 'Hillcrest Supply', [row({ part_id: 'trap' })], name)).toBe('Hillcrest Supply already uses 512207 for AX87029-BPC ARLO P-TRAP.')
  })
  it('already on this part, and a catch-all number', () => {
    expect(numberProblem('512207', 'kit', 'Hillcrest Supply', [row({})], name)).toBe('512207 is already kept for this part.')
    expect(numberProblem('440118', 'kit', 'Hillcrest Supply', [row({ code: '440118', code_key: '440118', part_id: null, not_a_part: true })], name)).toBe(
      'Hillcrest Supply uses 440118 for anything it does not stock, so it is not kept on a part.',
    )
  })
})

describe('houseNumberOffers', () => {
  const parts = [
    { id: 'a', name: '512207 AX8802XL-LR-PC ARLO SUPPLY KIT', notes: null },
    { id: 'b', name: 'AX87029-BPC ARLO P-TRAP', notes: ' 318002 ' },
    { id: 'c', name: '277310 TANNER PRE-RINSE', notes: null },
    { id: 'd', name: '655012 FROSTPROOF HYDRANT', notes: null },
    { id: 'e', name: '512207 ARLO SUPPLY KIT COPY', notes: null },
    { id: 'f', name: 'B0133-ADF12 TANNER', notes: 'ZN415-4NH' },
    { id: 'g', name: '2024 MODEL YEAR', notes: 'price per stick, stick=10ft 87967' },
    { id: 'h', name: '190442 CLOSET BOLT', notes: null },
  ]
  const priced = new Map([['a', ['hill']], ['b', ['hill', 'hill']], ['c', ['hill', 'bord']], ['e', ['hill']], ['f', ['hill']], ['h', ['bord']]])
  const { offers, held } = houseNumberOffers(parts, priced, [row({ supply_house_id: 'bord', code: '190442', code_key: '190442', part_id: 'h' })])

  it('offers a number at the head of a name, and a note that is one number, to the one house that prices the part', () => {
    expect(offers.map((o) => [o.partId, o.code, o.supplyHouseId, o.from])).toEqual([
      ['a', '512207', 'hill', 'name'],
      ['b', '318002', 'hill', 'notes'],
    ])
  })
  it('holds a number whose house cannot be told, with the reason', () => {
    expect(held.map((h) => [h.partId, h.why])).toEqual([
      ['g', 'No house prices this part, so the number has no house.'],
      ['c', '2 houses price this part, so the number could be any of theirs.'],
      ['e', 'Another part carries the same number at that house.'],
      ['d', 'No house prices this part, so the number has no house.'],
    ].sort((x, y) => parts.find((p) => p.id === x[0])!.name.localeCompare(parts.find((p) => p.id === y[0])!.name)))
  })
  it('passes over a number already on file and a note that is more than a number', () => {
    expect([...offers, ...held].some((x) => x.partId === 'h' || x.partId === 'f')).toBe(false)
  })
})

describe('isNotLiveYet', () => {
  it('knows a table that is not on the database yet from any other failure', () => {
    expect(isNotLiveYet({ code: 'PGRST205', message: 'Could not find the table' })).toBe(true)
    expect(isNotLiveYet({ code: '42P01', message: 'relation "supply_part_codes" does not exist' })).toBe(true)
    expect(isNotLiveYet({ code: '42501', message: 'permission denied' })).toBe(false)
    expect(isNotLiveYet(null)).toBe(false)
  })
})
