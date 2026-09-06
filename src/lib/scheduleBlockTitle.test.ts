import { describe, expect, it } from 'vitest'
import {
  addBidAnchorTitles,
  blocksToBidWeekMatrixRows,
  buildBidTitleById,
  collectScheduledBidIds,
  scheduleBidAnchorId,
  scheduleBlockTitle,
} from './scheduleBlockTitle'

describe('scheduleBlockTitle', () => {
  it.each([
    // kind, hcp, jobTitle, click, expected
    ['job with HCP number', { kind: 'job' as const, hcpNumber: '983', jobTitle: 'Knight Springtown Vet' }, 'J983 · Knight Springtown Vet'],
    ['click-number-only job prints the click number (J18-F5)', { kind: 'job' as const, hcpNumber: null, jobTitle: 'Water Heater removal', clickNumber: '1042' }, 'J1042 · Water Heater removal'],
    ['HCP wins over click number when both exist', { kind: 'job' as const, hcpNumber: '927', jobTitle: 'Malik Pretest', clickNumber: '1042' }, 'J927 · Malik Pretest'],
    ['blank HCP falls to click number', { kind: 'job' as const, hcpNumber: '   ', jobTitle: 'Rough-in', clickNumber: ' 55 ' }, 'J55 · Rough-in'],
    ['job with no number and no name is the placeholder', { kind: 'job' as const, hcpNumber: null, jobTitle: null }, '— · Job'],
    ['job with a number but no name says Job', { kind: 'job' as const, hcpNumber: '12', jobTitle: '  ' }, 'J12 · Job'],
    ['bid visit with a plain B title', { kind: 'bid' as const, bidTitle: 'B408 · Oakmont Clubhouse' }, 'Bid visit · B408 · Oakmont Clubhouse'],
    ['bid visit with a per-trade prefix title', { kind: 'bid' as const, bidTitle: 'BP375 · SPACEX BA-02N Architectural' }, 'Bid visit · BP375 · SPACEX BA-02N Architectural'],
    ['bid the caller could not name (RLS-hidden) is still a bid visit', { kind: 'bid' as const, bidTitle: null }, 'Bid visit'],
    ['blank bid title trims to the bare label', { kind: 'bid' as const, bidTitle: '   ' }, 'Bid visit'],
  ])('%s', (_label, input, expected) => {
    expect(scheduleBlockTitle(input)).toBe(expected)
  })
})

describe('collectScheduledBidIds', () => {
  it('unions block anchors with clock-session bids, unique, first-seen order, blanks dropped', () => {
    const blocks = [
      { bid_id: 'b1' },
      { bid_id: null },
      { bid_id: 'b2' },
      { bid_id: 'b1' },
      { bid_id: '  ' },
    ]
    const sessions = [{ bid_id: 'b3' }, { bid_id: 'b2' }, { bid_id: null }]
    expect(collectScheduledBidIds(blocks, sessions)).toEqual(['b1', 'b2', 'b3'])
  })

  it('names a scheduled-but-unclocked bid (J18-F4 correction) — blocks alone are enough', () => {
    expect(collectScheduledBidIds([{ bid_id: 'scheduled-only' }])).toEqual(['scheduled-only'])
    expect(collectScheduledBidIds([], [])).toEqual([])
  })
})

describe('buildBidTitleById', () => {
  const rows = [
    { id: 'b1', bid_number: '375', project_name: 'SPACEX BA-02N Architectural', service_type_id: 'st-plumbing' },
    { id: 'b2', bid_number: null, project_name: 'Unnumbered site walk', service_type_id: null },
    { id: 'b3', bid_number: '  ', project_name: '  ', service_type_id: null },
  ]

  it('uses the per-trade prefix when a prefix map is given', () => {
    const map = buildBidTitleById(rows, { 'st-plumbing': { job: 'JP', bid: 'BP' } })
    expect(map.get('b1')).toBe('BP375 · SPACEX BA-02N Architectural')
    expect(map.get('b2')).toBe('Unnumbered site walk')
    expect(map.get('b3')).toBe('Bid')
  })

  it("falls back to the hub's plain B prefix without a map", () => {
    const map = buildBidTitleById(rows, null)
    expect(map.get('b1')).toBe('B375 · SPACEX BA-02N Architectural')
    expect(map.get('b2')).toBe('Unnumbered site walk')
  })
})

describe('addBidAnchorTitles', () => {
  it('adds bid:<uuid> → "Bid visit · <title>" entries without touching job entries or the inputs', () => {
    const jobs = new Map([['j1', 'J983 · Knight Springtown Vet']])
    const bids = new Map([['b1', 'BP375 · SPACEX']])
    const merged = addBidAnchorTitles(jobs, bids)
    expect(merged.get('j1')).toBe('J983 · Knight Springtown Vet')
    expect(merged.get(scheduleBidAnchorId('b1'))).toBe('Bid visit · BP375 · SPACEX')
    expect(merged.size).toBe(2)
    expect(jobs.size).toBe(1)
    expect(bids.size).toBe(1)
  })

  it('keeps the anchor prefix in sync with jobScheduleBlocks', () => {
    expect(scheduleBidAnchorId('abc')).toBe('bid:abc')
  })
})

describe('blocksToBidWeekMatrixRows', () => {
  const title = (anchorId: string) => (anchorId === 'bid:b1' ? 'Bid visit · B408 · Oakmont' : `Bid visit · ${anchorId}`)

  it('gives every scheduled bid a matrix row and skips job blocks (J18-F7)', () => {
    const blocks = [
      { job_id: 'j1', bid_id: null, work_date: '2026-08-31' },
      { job_id: null, bid_id: 'b1', work_date: '2026-08-31' },
      { job_id: null, bid_id: 'b1', work_date: '2026-08-31' },
      { job_id: null, bid_id: 'b1', work_date: '2026-09-02' },
      { job_id: null, bid_id: 'b2', work_date: '2026-09-01' },
    ]
    const rows = blocksToBidWeekMatrixRows(blocks, title)
    expect(rows.map((r) => r.id)).toEqual(['bid:b1', 'bid:b2'])
    expect(rows[0]).toEqual({
      id: 'bid:b1',
      displayTitle: 'Bid visit · B408 · Oakmont',
      totalBlocks: 3,
      byDay: { '2026-08-31': 2, '2026-09-02': 1 },
    })
    expect(rows[1]?.totalBlocks).toBe(1)
  })

  it('returns no rows for a week with only job blocks, and ignores malformed bid anchors', () => {
    expect(blocksToBidWeekMatrixRows([{ job_id: 'j1', bid_id: null, work_date: '2026-08-31' }], title)).toEqual([])
    expect(blocksToBidWeekMatrixRows([{ job_id: null, bid_id: '  ', work_date: '2026-08-31' }], title)).toEqual([])
  })

  it('sorts ties by title', () => {
    const rows = blocksToBidWeekMatrixRows(
      [
        { job_id: null, bid_id: 'zeta', work_date: '2026-08-31' },
        { job_id: null, bid_id: 'alpha', work_date: '2026-08-31' },
      ],
      (id) => id,
    )
    expect(rows.map((r) => r.id)).toEqual(['bid:alpha', 'bid:zeta'])
  })
})
