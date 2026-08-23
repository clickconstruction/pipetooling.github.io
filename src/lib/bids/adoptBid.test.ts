import { describe, expect, it } from 'vitest'
import { adoptPreviewLine, sortAdoptCandidates, suggestVersionName } from './adoptBid'

describe('sortAdoptCandidates', () => {
  it('puts the target customer first, newest bid number first within each group', () => {
    const rows = [
      { bid_number: '253', customer_id: 'jakes' },
      { bid_number: '999', customer_id: 'other' },
      { bid_number: '345', customer_id: 'jakes' },
      { bid_number: null, customer_id: null },
    ]
    expect(sortAdoptCandidates(rows, 'jakes').map((r) => r.bid_number)).toEqual(['345', '253', '999', null])
    expect(sortAdoptCandidates(rows, null).map((r) => r.bid_number)).toEqual(['999', '345', '253', null])
  })
})

describe('suggestVersionName', () => {
  it('drops the words shared with the package name', () => {
    expect(suggestVersionName('Jakes Burgers Revised', 'Jakes', '345')).toBe('Burgers Revised')
    expect(suggestVersionName('JAKES BURGERS', 'Jakes', '238')).toBe('BURGERS')
    expect(suggestVersionName('Jakes Split Rail - Revised VE', 'JAKES BURGERS', '348')).toBe('Split Rail - Revised VE')
  })
  it('never returns empty — falls back to the full name or the bid number', () => {
    expect(suggestVersionName('Jakes', 'Jakes', '238')).toBe('Jakes')
    expect(suggestVersionName('', 'Jakes', '238')).toBe('B238')
    expect(suggestVersionName(null, null, null)).toBe('Adopted bid')
  })
})

describe('adoptPreviewLine', () => {
  it('formats counts, scenarios and the send', () => {
    expect(adoptPreviewLine({ countRows: 57, scenarios: 2, bid_date_sent: '2026-07-17', bid_value: 274248.79 })).toBe('57 count rows · 2 price scenarios · sent 7/17 · $274,249')
    expect(adoptPreviewLine({ countRows: 1, scenarios: 1, bid_date_sent: '2026-07-17', bid_value: null })).toBe('1 count row · 1 price scenario · sent 7/17')
    expect(adoptPreviewLine({ countRows: 0, scenarios: 0, bid_date_sent: null, bid_value: null })).toBe('0 count rows · 0 price scenarios · not sent')
  })
})
