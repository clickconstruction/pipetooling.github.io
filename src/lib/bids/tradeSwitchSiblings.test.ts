import { describe, expect, it } from 'vitest'
import { groupTradeSwitchSiblings, tradeSwitchProjectKey, type TradeSwitchSiblingRow } from './tradeSwitchSiblings'

const row = (over: Partial<TradeSwitchSiblingRow>): TradeSwitchSiblingRow => ({ id: 'b-1', bid_number: '100', service_type_id: 'st-p', project_name: 'Pondhill Building 2', ...over })

describe('tradeSwitchProjectKey', () => {
  it('trims and folds case; blank and missing are empty', () => {
    expect(tradeSwitchProjectKey('  Pondhill Building 2 ')).toBe('pondhill building 2')
    expect(tradeSwitchProjectKey('   ')).toBe('')
    expect(tradeSwitchProjectKey(null)).toBe('')
    expect(tradeSwitchProjectKey(undefined)).toBe('')
  })
})

describe('groupTradeSwitchSiblings', () => {
  it('groups the same project’s bids by trade, in the order read', () => {
    const rows = [
      row({ id: 'b-e1', bid_number: '201', service_type_id: 'st-e' }),
      row({ id: 'b-h1', bid_number: '301', service_type_id: 'st-h' }),
      row({ id: 'b-e2', bid_number: '202', service_type_id: 'st-e' }),
    ]
    expect(groupTradeSwitchSiblings(rows, 'Pondhill Building 2')).toEqual({
      'st-e': [{ id: 'b-e1', bid_number: '201' }, { id: 'b-e2', bid_number: '202' }],
      'st-h': [{ id: 'b-h1', bid_number: '301' }],
    })
  })

  it('matches the project name loosely — case and surrounding spaces do not matter', () => {
    const rows = [row({ id: 'b-e1', service_type_id: 'st-e', project_name: '  PONDHILL building 2 ' })]
    expect(Object.keys(groupTradeSwitchSiblings(rows, 'Pondhill Building 2'))).toEqual(['st-e'])
  })

  it('leaves out the customer’s other projects', () => {
    const rows = [row({ id: 'b-x', service_type_id: 'st-e', project_name: 'Pondhill Building 3' }), row({ id: 'b-y', service_type_id: 'st-e', project_name: null })]
    expect(groupTradeSwitchSiblings(rows, 'Pondhill Building 2')).toEqual({})
  })

  it('an empty project name groups nothing — not even other empty names', () => {
    const rows = [row({ project_name: '' }), row({ project_name: null })]
    expect(groupTradeSwitchSiblings(rows, '')).toEqual({})
    expect(groupTradeSwitchSiblings(rows, '  ')).toEqual({})
    expect(groupTradeSwitchSiblings(rows, null)).toEqual({})
  })

  it('keeps a missing bid number as null', () => {
    expect(groupTradeSwitchSiblings([row({ bid_number: null })], 'Pondhill Building 2')).toEqual({ 'st-p': [{ id: 'b-1', bid_number: null }] })
  })

  it('no rows, no groups', () => {
    expect(groupTradeSwitchSiblings([], 'Pondhill Building 2')).toEqual({})
  })
})
