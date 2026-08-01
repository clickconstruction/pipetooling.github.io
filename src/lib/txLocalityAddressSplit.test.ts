import { afterEach, describe, expect, it } from 'vitest'
import {
  findEarliestTxLocalityIndex,
  parseExtraTxLocalitiesText,
  setExtraTxLocalityKeywords,
  splitJobAddressForPrefill,
} from './txLocalityAddressSplit'
import { formatAddressTwoLines } from './jobs/jobAddressUrls'

afterEach(() => {
  setExtraTxLocalityKeywords([])
})

describe('parseExtraTxLocalitiesText', () => {
  it('splits on newlines and commas, trimming and dropping empties', () => {
    expect(parseExtraTxLocalitiesText('Devine\nFloresville, Pleasanton\n\n  ')).toEqual([
      'Devine',
      'Floresville',
      'Pleasanton',
    ])
  })

  it('dedupes case-insensitively and drops built-in cities', () => {
    expect(parseExtraTxLocalitiesText('Devine\ndevine\nSeguin\nSan Antonio')).toEqual(['Devine'])
  })

  it('returns [] for empty text', () => {
    expect(parseExtraTxLocalitiesText('')).toEqual([])
    expect(parseExtraTxLocalitiesText('  \n , ')).toEqual([])
  })
})

describe('extra locality keywords (v2.1186 dev setting)', () => {
  it('findEarliestTxLocalityIndex matches org-added cities', () => {
    const addr = '1875 Co Rd 777 Devine TX'
    expect(findEarliestTxLocalityIndex(addr)).toBe(-1)
    setExtraTxLocalityKeywords(['Devine'])
    expect(findEarliestTxLocalityIndex(addr)).toBe(addr.indexOf('Devine'))
  })

  it('formatAddressTwoLines starts the second line at an org-added city', () => {
    setExtraTxLocalityKeywords(['Devine'])
    expect(formatAddressTwoLines('1875 Co Rd 777 Devine TX')).toEqual({
      line1: '1875 Co Rd 777',
      line2: 'Devine TX',
    })
  })

  it('built-in cities keep working alongside extras', () => {
    setExtraTxLocalityKeywords(['Devine'])
    expect(formatAddressTwoLines('124 Farmview Cibolo, TX')).toEqual({
      line1: '124 Farmview Cibolo',
      line2: 'TX',
    })
    expect(formatAddressTwoLines('720 Bailey St Seguin, TX')).toEqual({
      line1: '720 Bailey St',
      line2: 'Seguin, TX',
    })
  })

  it('splitJobAddressForPrefill uses extras for the city segment', () => {
    setExtraTxLocalityKeywords(['Devine'])
    expect(splitJobAddressForPrefill('1875 Co Rd 777 Devine TX 78016')).toEqual({
      street: '1875 Co Rd 777',
      city: 'Devine',
      state: 'TX',
      zip: '78016',
    })
  })
})
