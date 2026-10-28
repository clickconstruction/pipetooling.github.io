import { describe, expect, it } from 'vitest'
import {
  BID_BOARD_DEVELOPMENT_FILTER_NONE,
  bidDevelopmentName,
  bidMatchesDevelopmentQuery,
  developmentFilterLabel,
  developmentFilterOptionsFromBids,
  filterBidsByDevelopment,
} from './bidBoardDevelopment'

const harlow = { id: 'dev-h', name: 'Harlow Ranch' }
const ash = { id: 'dev-a', name: 'ash creek' }

const bids = [
  { id: 'b1', development: harlow },
  { id: 'b2', development: ash },
  { id: 'b3', development: harlow },
  { id: 'b4', development: null },
  { id: 'b5' },
]

describe('bidDevelopmentName', () => {
  it('prints the trimmed name, an em dash for a blank one, null for none', () => {
    expect(bidDevelopmentName({ development: { id: 'd', name: '  Harlow Ranch ' } })).toBe('Harlow Ranch')
    expect(bidDevelopmentName({ development: { id: 'd', name: '   ' } })).toBe('—')
    expect(bidDevelopmentName({ development: null })).toBeNull()
    expect(bidDevelopmentName({})).toBeNull()
  })
})

describe('developmentFilterOptionsFromBids', () => {
  it('lists each development once, name-sorted without regard to case', () => {
    expect(developmentFilterOptionsFromBids(bids)).toEqual([
      { id: 'dev-a', name: 'ash creek' },
      { id: 'dev-h', name: 'Harlow Ranch' },
    ])
  })

  it('is empty when no bid has a development, so the house filter stays hidden', () => {
    expect(developmentFilterOptionsFromBids([{ development: null }, {}])).toEqual([])
  })
})

describe('filterBidsByDevelopment', () => {
  it('no filter keeps every bid', () => {
    expect(filterBidsByDevelopment(bids, null).map((b) => b.id)).toEqual(['b1', 'b2', 'b3', 'b4', 'b5'])
    expect(filterBidsByDevelopment(bids, '').map((b) => b.id)).toEqual(['b1', 'b2', 'b3', 'b4', 'b5'])
  })

  it('one development keeps its bids', () => {
    expect(filterBidsByDevelopment(bids, 'dev-h').map((b) => b.id)).toEqual(['b1', 'b3'])
  })

  it('No development set keeps the bids still needing one', () => {
    expect(filterBidsByDevelopment(bids, BID_BOARD_DEVELOPMENT_FILTER_NONE).map((b) => b.id)).toEqual(['b4', 'b5'])
  })
})

describe('bidMatchesDevelopmentQuery', () => {
  it('matches part of the name without regard to case, never a blank query or a bid with none', () => {
    expect(bidMatchesDevelopmentQuery({ development: harlow }, 'harlow')).toBe(true)
    expect(bidMatchesDevelopmentQuery({ development: harlow }, '  RANCH ')).toBe(true)
    expect(bidMatchesDevelopmentQuery({ development: harlow }, 'gun dog')).toBe(false)
    expect(bidMatchesDevelopmentQuery({ development: harlow }, '')).toBe(false)
    expect(bidMatchesDevelopmentQuery({ development: null }, 'harlow')).toBe(false)
  })
})

describe('developmentFilterLabel', () => {
  it('names the development, the no-development words, or a plain fallback', () => {
    const options = developmentFilterOptionsFromBids(bids)
    expect(developmentFilterLabel('dev-h', options)).toBe('Harlow Ranch')
    expect(developmentFilterLabel(BID_BOARD_DEVELOPMENT_FILTER_NONE, options)).toBe('No development set')
    expect(developmentFilterLabel('gone', options)).toBe('Development')
  })
})
