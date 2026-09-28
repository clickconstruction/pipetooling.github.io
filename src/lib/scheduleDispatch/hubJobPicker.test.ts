import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import type { ScheduleDispatchHubBidRow, ScheduleDispatchHubMergedRow } from '../scheduleDispatchHub'
import { buildHubBidPickerRows, filterHubJobPickerRows, hubJobPickerSubline } from './hubJobPicker'

/** Noon in Chicago on Monday 2026-09-28. */
const NOW = Date.parse('2026-09-28T17:00:00Z')

function jobRow(id: string, over: Partial<ScheduleDispatchHubMergedRow> = {}): ScheduleDispatchHubMergedRow {
  const hcp = over.hcp_number === undefined ? id : over.hcp_number
  const name = over.job_name === undefined ? `Job ${id}` : over.job_name
  return {
    id,
    hcp_number: hcp,
    job_name: name,
    project_id: null,
    created_at: '2026-09-01T15:00:00Z',
    status: 'working',
    displayTitle: `J${hcp ?? ''} · ${name ?? ''}`,
    totalBlocks: 0,
    byDay: {},
    ...over,
  }
}

function bidRow(id: string, over: Partial<ScheduleDispatchHubBidRow> = {}): ScheduleDispatchHubBidRow {
  return {
    id,
    bid_number: '375',
    project_name: 'Tower West',
    address: null,
    outcome: null,
    created_at: '2026-09-21T15:00:00Z',
    service_type: null,
    ...over,
  }
}

const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id)

describe('hubJobPickerSubline', () => {
  it('reads "<days>d <Mon D> | <address>"', () => {
    expect(
      hubJobPickerSubline({ created_at: '2026-09-21T15:00:00Z', job_address: '105 Dover Rd San Antonio, TX 78209' }, NOW),
    ).toBe('7d Sep 21 | 105 Dover Rd San Antonio, TX')
  })

  it('counts calendar days in the company zone, not 24-hour spans', () => {
    // 11:30 pm Sunday in Chicago, read at noon Monday: one calendar day, 12.5 hours.
    expect(hubJobPickerSubline({ created_at: '2026-09-28T04:30:00Z' }, NOW)).toBe('1d Sep 27')
    expect(hubJobPickerSubline({ created_at: '2026-09-28T15:00:00Z' }, NOW)).toBe('0d Sep 28')
  })

  it('never counts below zero for a date that is still ahead', () => {
    expect(hubJobPickerSubline({ created_at: '2026-10-05T15:00:00Z' }, NOW)).toBe('0d Oct 5')
  })

  it('gives the date alone when there is no address, and the address alone when there is no date', () => {
    expect(hubJobPickerSubline({ created_at: '2026-09-21T15:00:00Z', job_address: '  ' }, NOW)).toBe('7d Sep 21')
    expect(hubJobPickerSubline({ created_at: null, job_address: '12 Elm St' }, NOW)).toBe('12 Elm St')
    expect(hubJobPickerSubline({ job_address: '12 Elm St, Austin, TX 78701-1234' }, NOW)).toBe('12 Elm St, Austin, TX')
  })

  it('drops a date it cannot read and keeps the address', () => {
    expect(hubJobPickerSubline({ created_at: 'not a date', job_address: '12 Elm St' }, NOW)).toBe('12 Elm St')
  })

  it('returns undefined when there is nothing to say', () => {
    expect(hubJobPickerSubline({}, NOW)).toBeUndefined()
    expect(hubJobPickerSubline({ created_at: '  ', job_address: null }, NOW)).toBeUndefined()
    expect(hubJobPickerSubline({ created_at: 'not a date' }, NOW)).toBeUndefined()
  })

  it('reads the clock when it is not handed a time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW))
    try {
      expect(hubJobPickerSubline({ created_at: '2026-09-25T15:00:00Z' })).toBe('3d Sep 25')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('filterHubJobPickerRows — no search', () => {
  it('lists every job, newest first', () => {
    const rows = [
      jobRow('old', { created_at: '2026-01-05T15:00:00Z' }),
      jobRow('new', { created_at: '2026-09-20T15:00:00Z' }),
      jobRow('mid', { created_at: '2026-06-01T15:00:00Z' }),
    ]
    expect(ids(filterHubJobPickerRows(rows, '', ''))).toEqual(['new', 'mid', 'old'])
    expect(ids(filterHubJobPickerRows(rows, '   ', '  '))).toEqual(['new', 'mid', 'old'])
  })

  it('puts billed and paid jobs last, newest first within each half', () => {
    const rows = [
      jobRow('paid-new', { status: 'paid', created_at: '2026-09-25T15:00:00Z' }),
      jobRow('working-old', { status: 'working', created_at: '2026-02-01T15:00:00Z' }),
      jobRow('billed-old', { status: 'billed', created_at: '2026-03-01T15:00:00Z' }),
      jobRow('waiting-new', { status: 'waiting', created_at: '2026-09-10T15:00:00Z' }),
    ]
    expect(ids(filterHubJobPickerRows(rows, '', ''))).toEqual(['waiting-new', 'working-old', 'paid-new', 'billed-old'])
  })

  it('sinks a job with no date, and breaks a tie on the higher job number', () => {
    const rows = [
      jobRow('nodate', { created_at: null }),
      jobRow('a', { hcp_number: '999', created_at: '2026-09-01T15:00:00Z' }),
      jobRow('b', { hcp_number: '1000', created_at: '2026-09-01T15:00:00Z' }),
    ]
    expect(ids(filterHubJobPickerRows(rows, '', ''))).toEqual(['b', 'a', 'nodate'])
  })

  it('leaves the list it was handed in its own order', () => {
    const rows = [jobRow('old', { created_at: '2026-01-05T15:00:00Z' }), jobRow('new')]
    filterHubJobPickerRows(rows, '', '')
    expect(ids(rows)).toEqual(['old', 'new'])
  })
})

describe('filterHubJobPickerRows — the search box', () => {
  const rows = [
    jobRow('1', { hcp_number: '927', job_name: 'Berg AirBnb', displayTitle: 'J927 · Berg AirBnb' }),
    jobRow('2', { hcp_number: '412', job_name: 'Rough-in', job_address: '12 Elm St, Austin' }),
    jobRow('3', { hcp_number: '88', job_name: 'Repipe', customer_name: 'Hillside Builders' }),
    jobRow('4', { hcp_number: null, click_number: '4102', job_name: 'Tower', displayTitle: 'J4102 · Tower' }),
  ]

  it('finds a job by its number, its name, its address or its customer', () => {
    expect(ids(filterHubJobPickerRows(rows, '927', ''))).toEqual(['1'])
    expect(ids(filterHubJobPickerRows(rows, 'rough', ''))).toEqual(['2'])
    expect(ids(filterHubJobPickerRows(rows, 'elm st', ''))).toEqual(['2'])
    expect(ids(filterHubJobPickerRows(rows, 'hillside', ''))).toEqual(['3'])
  })

  it('finds a job by its identity line — the J prefix and a Click number only live there', () => {
    expect(ids(filterHubJobPickerRows(rows, 'j927', ''))).toEqual(['1'])
    expect(ids(filterHubJobPickerRows(rows, '4102', ''))).toEqual(['4'])
  })

  it('ignores case and the space around the search', () => {
    expect(ids(filterHubJobPickerRows(rows, '  BERG  ', ''))).toEqual(['1'])
  })

  it('shows nothing for a search nothing contains', () => {
    expect(filterHubJobPickerRows(rows, 'zzz', '')).toEqual([])
  })
})

describe('filterHubJobPickerRows — the number box', () => {
  const rows = [
    jobRow('prefix', { hcp_number: '9271', created_at: '2026-09-20T15:00:00Z' }),
    jobRow('exact', { hcp_number: '927', created_at: '2026-01-05T15:00:00Z' }),
    jobRow('click', { hcp_number: null, click_number: '927' }),
    jobRow('inside', { hcp_number: '1927' }),
    jobRow('done', { hcp_number: '9270', status: 'paid' }),
  ]

  it('lists an exact match first, then the numbers that start with it, finished jobs last', () => {
    expect(ids(filterHubJobPickerRows(rows, '', '927'))).toEqual(['exact', 'click', 'prefix', 'done'])
  })

  it('does not match a number that only contains the digits', () => {
    expect(ids(filterHubJobPickerRows(rows, '', '927'))).not.toContain('inside')
  })

  it('wins over the search box whenever it holds a digit', () => {
    expect(ids(filterHubJobPickerRows(rows, 'no such job', '1927'))).toEqual(['inside'])
  })

  it('reads only the digits, and falls back to the search when there are none', () => {
    expect(ids(filterHubJobPickerRows(rows, '', '#1927 '))).toEqual(['inside'])
    expect(ids(filterHubJobPickerRows(rows, '1927', 'J-'))).toEqual(['inside'])
  })

  it('shows nothing for a number no job has', () => {
    expect(filterHubJobPickerRows(rows, '', '55555')).toEqual([])
  })
})

describe('buildHubBidPickerRows', () => {
  it('shapes a bid as a picker row under its bid: anchor', () => {
    const rows = buildHubBidPickerRows(
      [
        bidRow('b1', {
          address: '400 Main St, Boerne, TX 78006',
          service_type: { name: 'Plumbing' },
        }),
      ],
      [],
      '',
      '',
      NOW,
    )
    expect(rows).toEqual([
      {
        id: 'bid:b1',
        displayTitle: 'B375 · Tower West',
        serviceTypeName: 'Plumbing',
        subline: '7d Sep 21 | 400 Main St, Boerne, TX',
        status: 'bid',
        blocksThisWeek: 0,
        evidence: null,
      },
    ])
  })

  it('counts each bid’s blocks this week and leaves the job blocks out', () => {
    const rows = buildHubBidPickerRows(
      [bidRow('b1'), bidRow('b2', { bid_number: '376' })],
      [{ bid_id: 'b1' }, { bid_id: null }, { bid_id: 'b1' }, { bid_id: 'gone' }],
      '',
      '',
      NOW,
    )
    expect(rows.map((r) => [r.id, r.blocksThisWeek])).toEqual([
      ['bid:b1', 2],
      ['bid:b2', 0],
    ])
  })

  it('keeps the list’s own order — no newest-first, no finished-last', () => {
    const rows = buildHubBidPickerRows(
      [
        bidRow('old', { created_at: '2026-01-05T15:00:00Z', outcome: 'won' }),
        bidRow('new', { created_at: '2026-09-25T15:00:00Z' }),
      ],
      [],
      '',
      '',
      NOW,
    )
    expect(ids(rows)).toEqual(['bid:old', 'bid:new'])
  })

  it('finds a bid by its number, its project, its address or its identity line', () => {
    const bids = [
      bidRow('b1', { bid_number: '375', project_name: 'Tower West' }),
      bidRow('b2', { bid_number: '410', project_name: 'Old Mill', address: '9 Mill Rd' }),
    ]
    expect(ids(buildHubBidPickerRows(bids, [], '375', '', NOW))).toEqual(['bid:b1'])
    expect(ids(buildHubBidPickerRows(bids, [], ' OLD mill ', '', NOW))).toEqual(['bid:b2'])
    expect(ids(buildHubBidPickerRows(bids, [], 'mill rd', '', NOW))).toEqual(['bid:b2'])
    expect(ids(buildHubBidPickerRows(bids, [], 'b375 · tower', '', NOW))).toEqual(['bid:b1'])
    expect(buildHubBidPickerRows(bids, [], 'zzz', '', NOW)).toEqual([])
  })

  it('matches a number anywhere in the bid number — unlike the job rows, which match from the start', () => {
    const bids = [bidRow('b1', { bid_number: '1375' }), bidRow('b2', { bid_number: 'P-375' }), bidRow('b3', { bid_number: '410' })]
    expect(ids(buildHubBidPickerRows(bids, [], '', '375', NOW))).toEqual(['bid:b1', 'bid:b2'])
  })

  it('lets the number box win over the search box', () => {
    const bids = [bidRow('b1', { bid_number: '375' }), bidRow('b2', { bid_number: '410', project_name: 'Old Mill' })]
    expect(ids(buildHubBidPickerRows(bids, [], 'old mill', '375', NOW))).toEqual(['bid:b1'])
  })

  it('has no number match for a bid with no number, and names it "Bid"', () => {
    const bids = [bidRow('b1', { bid_number: null, project_name: null })]
    expect(buildHubBidPickerRows(bids, [], '', '3', NOW)).toEqual([])
    expect(buildHubBidPickerRows(bids, [], '', '', NOW)[0]?.displayTitle).toBe('Bid · Bid')
  })
})
