import { describe, expect, it } from 'vitest'
import { bidTile, gcProjectTile, jobTilesByKey, pipelineTile, type BidTileRow, type GcProjectTileRow } from './jobTiles'

const TODAY = '2026-10-02'
const bid = (set: Partial<BidTileRow>): BidTileRow => ({ id: 'b1', bid_number: 'B482', project_name: 'Boerne Retail Shell', bid_due_date: null, bid_date_sent: null, outcome: null, ...set })
const gc = (set: Partial<GcProjectTileRow>): GcProjectTileRow => ({
  project_id: 'p42',
  name: 'Stone Oak Pharmacy',
  project_number: '42',
  stage: 'building',
  bid_due: null,
  our_bid_sent_on: null,
  lost_on: null,
  started_on: null,
  ...set,
})

describe('a job as a tile (the prototype’s jobNum and jobDay)', () => {
  it('a bid reads its due day against today, soon within a week', () => {
    expect(bidTile(bid({ bid_due_date: '2026-10-08' }), TODAY)).toEqual({
      key: 'bid:b1',
      kind: 'bid',
      num: 'B482',
      name: 'Boerne Retail Shell',
      day: { words: 'bid due Thu Oct 8 · 6 days', tone: 'soon' },
    })
    expect(bidTile(bid({ bid_due_date: TODAY }), TODAY).day).toEqual({ words: 'bid due today', tone: 'today' })
    expect(bidTile(bid({ bid_due_date: '2026-09-30' }), TODAY).day).toEqual({ words: 'bid was due Wed Sep 30 · 2 days late', tone: 'past' })
    expect(bidTile(bid({ bid_due_date: '2026-10-22' }), TODAY).day).toEqual({ words: 'bid due Thu Oct 22', tone: '' })
  })

  it('a bid that went reads its day, and an outcome reads won or lost', () => {
    expect(bidTile(bid({ bid_due_date: '2026-10-08', bid_date_sent: '2026-09-21' }), TODAY).day.words).toBe('bid sent Mon Sep 21')
    expect(bidTile(bid({ bid_date_sent: '2026-09-21', outcome: 'Lost' }), TODAY).day.words).toBe('bid lost')
    expect(bidTile(bid({ bid_number: null, project_name: ' ' }), TODAY)).toMatchObject({ num: 'Bid', name: 'A bid', day: { words: 'bid' } })
  })

  it('a GC project reads its stage, building with its day, and a lost one its loss', () => {
    expect(gcProjectTile(gc({ started_on: '2026-09-14' }), TODAY)).toMatchObject({ key: 'project:p42', num: '#42', day: { words: 'building · since Sep 14' } })
    expect(gcProjectTile(gc({ stage: 'buyout' }), TODAY).day.words).toBe('buying out')
    expect(gcProjectTile(gc({ stage: 'bidding', bid_due: '2026-10-08' }), TODAY).day).toEqual({ words: 'bid due Thu Oct 8 · 6 days', tone: 'soon' })
    expect(gcProjectTile(gc({ stage: 'bidding', our_bid_sent_on: '2026-09-21' }), TODAY).day.words).toBe('bid sent Mon Sep 21')
    expect(gcProjectTile(gc({ stage: 'bidding', lost_on: '2026-09-29' }), TODAY).day.words).toBe('lost Tue Sep 29')
    expect(gcProjectTile(gc({ project_number: null }), TODAY).num).toBe('GC')
  })

  it('a Pipeline job reads its number and its status', () => {
    expect(pipelineTile({ id: 'j1', hcp_number: 'J1077', click_number: null, job_name: 'Fair Oaks Shops, Building D', status: 'Billed' })).toEqual({
      key: 'pipeline:j1',
      kind: 'pipeline',
      num: 'J1077',
      name: 'Fair Oaks Shops, Building D',
      day: { words: 'billed', tone: '' },
    })
    expect(pipelineTile({ id: 'j2', hcp_number: '', click_number: 'C88', job_name: null, status: null })).toMatchObject({ num: 'C88', name: 'A Pipeline job', day: { words: 'in the Pipeline' } })
  })

  it('keys every tile for a rail and a line', () => {
    expect(Object.keys(jobTilesByKey({ bids: [bid({})], projects: [gc({})], pipeline: [{ id: 'j1', hcp_number: '1', click_number: null, job_name: 'x', status: 'open' }] }, TODAY))).toEqual([
      'bid:b1',
      'project:p42',
      'pipeline:j1',
    ])
  })
})
