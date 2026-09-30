import { describe, expect, it } from 'vitest'
import { firstTwoWords, quickAssignBusyBarLabel, quickAssignBusyBarTown } from './quickAssignBusyBarLabel'

describe('quickAssignBusyBarLabel', () => {
  it('reads J-number · customer (two words) · town', () => {
    expect(
      quickAssignBusyBarLabel({ hcpNumber: '568', clickNumber: null, customerName: 'Diamondback Homes LLC', jobAddress: '12 Gun Dog Trail, Neeses, SC 29107' }),
    ).toBe('J568 · Diamondback Homes · Neeses')
  })

  it('falls back to the Click number, and finds a TX town with no comma before the state', () => {
    expect(
      quickAssignBusyBarLabel({ hcpNumber: null, clickNumber: '41', customerName: 'Paige Turner', jobAddress: '400 River Rd, Boerne TX 78006' }),
    ).toBe('J41 · Paige Turner · Boerne')
  })

  it('finds the town when the address ends in the state with no zip', () => {
    expect(quickAssignBusyBarLabel({ hcpNumber: '1057', clickNumber: null, customerName: 'DRF Harwood Repairs', jobAddress: '5339 Texas 304, Harwood, TX' })).toBe('J1057 · DRF Harwood · Harwood')
  })

  it('leaves out what the block does not have', () => {
    expect(quickAssignBusyBarLabel({ hcpNumber: '1016', clickNumber: null, customerName: 'Wendi', jobAddress: '1016 Plum St' })).toBe('J1016 · Wendi')
    expect(quickAssignBusyBarLabel({ hcpNumber: null, clickNumber: null, customerName: '', jobAddress: '' })).toBe('')
  })
})

describe('firstTwoWords', () => {
  it('keeps two words, a lone word, and nothing', () => {
    expect(firstTwoWords('  Megan   Connell  Jr ')).toBe('Megan Connell')
    expect(firstTwoWords('Office')).toBe('Office')
    expect(firstTwoWords('')).toBe('')
  })
})

describe('quickAssignBusyBarTown', () => {
  it('reads the city from the strict comma form and from the no-zip form', () => {
    expect(quickAssignBusyBarTown('582 Curvatura, Canyon Lake, TX 78132')).toBe('Canyon Lake')
    expect(quickAssignBusyBarTown('12921 FM 20, Kingsbury, TX')).toBe('Kingsbury')
  })
  it('does not mistake a two-word street for a town', () => {
    expect(quickAssignBusyBarTown('1 Test Street')).toBe('')
    expect(quickAssignBusyBarTown('1 Test Street, Austin')).toBe('')
  })
})
