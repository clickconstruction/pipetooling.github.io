import { describe, expect, it } from 'vitest'
import {
  BID_DAY_COLORS,
  bidDayEntries,
  bidDayMarksFromKept,
  bidDayNote,
  bidDayPressLabel,
  bidDayRowLine,
  bidDaySize,
  bidDayTabLabel,
  bidDayTabsLabel,
  buildBidDayList,
  readBidDay,
  type BidDayPayload,
} from './bidDay'

// A made-up day, 2026-11-25 in the company's zone: clocked in at 7:00 (13:00 UTC), read at 15:00 (21:00 UTC).
const B412 = 'b412'
const B398 = 'b398'
const B420 = 'b420'
const B431 = 'b431'
const at = (hhmm: string) => `2026-11-25T${hhmm}:00+00:00`

const payload = (over: Partial<BidDayPayload> = {}): BidDayPayload => ({
  day: '2026-11-25',
  from: '2026-11-25T06:00:00+00:00',
  to: '2026-11-26T06:00:00+00:00',
  now: at('21:00'),
  changes: [],
  beats: [],
  kept: [],
  sessions: [{ in: at('13:00'), out: null }],
  bids: [],
  ...over,
})
const names = { nameOf: (id: string) => `B${id.slice(1)} · ZZ Test ${id}`, jobOf: (id: string) => (id === B398 ? 'J1007' : null) }
const none = new Map<string, 'kept' | 'off'>()

describe('bidDaySize', () => {
  it('is to the minute under ten minutes, and never under one', () => {
    expect(bidDaySize(5)).toBe('1 minute')
    expect(bidDaySize(60)).toBe('1 minute')
    expect(bidDaySize(120)).toBe('2 minutes')
    expect(bidDaySize(9 * 60)).toBe('9 minutes')
  })
  it('is to five minutes under an hour', () => {
    expect(bidDaySize(10 * 60)).toBe('10 minutes')
    expect(bidDaySize(28 * 60)).toBe('30 minutes')
    expect(bidDaySize(42 * 60)).toBe('40 minutes')
    expect(bidDaySize(57 * 60)).toBe('55 minutes')
  })
  it('is to the half hour from an hour up', () => {
    expect(bidDaySize(58 * 60)).toBe('1 hour')
    expect(bidDaySize(70 * 60)).toBe('1 hour')
    expect(bidDaySize(80 * 60)).toBe('1.5 hours')
    expect(bidDaySize(172 * 60)).toBe('3 hours')
  })
})

describe('tab words', () => {
  it('names the tabs the app knows and spells out one it does not', () => {
    expect(bidDayTabLabel('cover-letter')).toBe('Cover Letter')
    expect(bidDayTabLabel('submission-followup')).toBe('Followup')
    expect(bidDayTabLabel('permit_news')).toBe('Permit News')
  })
  it('joins the first two', () => {
    expect(bidDayTabsLabel(['takeoffs', 'pricing', 'counts'])).toBe('Takeoffs and Pricing')
    expect(bidDayTabsLabel(['counts'])).toBe('Counts')
    expect(bidDayTabsLabel([])).toBe('')
  })
})

describe('readBidDay', () => {
  it('is null with no read', () => {
    expect(readBidDay(null)).toBeNull()
  })

  it('reads a bid the person changed as worked, sized from its beats, with the tab the time went to first', () => {
    const read = readBidDay(
      payload({
        changes: [{ bid_id: B412, at: at('14:00'), own: 3, app: 0, tables: ['bid_pricing_assignments'] }],
        beats: [
          { bid_id: B412, tab: 'takeoffs', at: at('14:00'), seconds: 300 },
          { bid_id: B412, tab: 'takeoffs', at: at('14:05'), seconds: 300 },
          { bid_id: B412, tab: 'pricing', at: at('14:10'), seconds: 240 },
        ],
      }),
    )
    expect(read?.bids).toHaveLength(1)
    const b = read?.bids[0]
    expect(b).toMatchObject({ bidId: B412, kind: 'worked', seconds: 840, changes: 3, tabs: ['takeoffs', 'pricing'] })
    expect(b?.runs).toEqual([[Date.parse(at('14:00')), Date.parse(at('14:15'))]])
  })

  it('sizes a run of changes with no beat: the whole of a middle bucket, half of an end, a minute for one alone', () => {
    const read = readBidDay(
      payload({
        changes: [
          { bid_id: B412, at: at('14:00'), own: 1, app: 0, tables: ['bids_count_rows'] },
          { bid_id: B412, at: at('14:05'), own: 9, app: 0, tables: ['bids_count_rows'] },
          { bid_id: B412, at: at('14:10'), own: 2, app: 0, tables: ['bids_count_rows'] },
          { bid_id: B420, at: at('16:00'), own: 1, app: 0, tables: ['bids'] },
        ],
      }),
    )
    expect(read?.bids.map((b) => [b.bidId, b.seconds, b.tabs])).toEqual([
      [B412, 150 + 300 + 150, ['counts']],
      [B420, 60, ['edit-bid']],
    ])
  })

  it('reads a bid in front with nothing of the person changed as opened, and drops one seen under a minute', () => {
    const read = readBidDay(
      payload({
        changes: [{ bid_id: B431, at: at('15:00'), own: 0, app: 4, tables: ['cost_estimate_labor_rows'] }],
        beats: [
          { bid_id: B431, tab: 'labor', at: at('15:00'), seconds: 290 },
          { bid_id: B398, tab: 'counts', at: at('15:30'), seconds: 40 },
        ],
      }),
    )
    expect(read?.bids.map((b) => [b.bidId, b.kind, b.seconds])).toEqual([[B431, 'opened', 290]])
  })

  it('shows nothing for a bid only the app wrote, with no beat', () => {
    const read = readBidDay(payload({ changes: [{ bid_id: B431, at: at('15:00'), own: 0, app: 4, tables: ['cost_estimate_labor_rows'] }] }))
    expect(read?.bids).toEqual([])
  })

  it('runs the strip from the first clock in to now while a session is open', () => {
    const read = readBidDay(payload({ beats: [{ bid_id: B412, tab: 'pricing', at: at('14:00'), seconds: 300 }] }))
    expect(read?.startMs).toBe(Date.parse(at('13:00')))
    expect(read?.endMs).toBe(Date.parse(at('21:00')))
  })

  it('ends the strip at the last clock out when no session is open, and starts at the first trace with no session', () => {
    const closed = readBidDay(payload({ sessions: [{ in: at('13:00'), out: at('19:30') }], beats: [{ bid_id: B412, tab: 'pricing', at: at('14:00'), seconds: 300 }] }))
    expect(closed?.endMs).toBe(Date.parse(at('19:30')))
    const noClock = readBidDay(payload({ sessions: [], beats: [{ bid_id: B412, tab: 'pricing', at: at('14:00'), seconds: 300 }] }))
    expect(noClock?.startMs).toBe(Date.parse(at('14:00')))
    expect(noClock?.endMs).toBe(Date.parse(at('14:05')))
  })

  it('orders the bids by when each first shows', () => {
    const read = readBidDay(
      payload({
        beats: [
          { bid_id: B398, tab: 'pricing', at: at('16:00'), seconds: 300 },
          { bid_id: B412, tab: 'pricing', at: at('14:00'), seconds: 300 },
        ],
      }),
    )
    expect(read?.bids.map((b) => b.bidId)).toEqual([B412, B398])
  })
})

describe('buildBidDayList', () => {
  const read = readBidDay(
    payload({
      changes: [
        { bid_id: B412, at: at('14:00'), own: 3, app: 0, tables: ['bid_pricing_assignments'] },
        { bid_id: B398, at: at('17:00'), own: 1, app: 0, tables: ['bids_submission_entries'] },
      ],
      beats: [
        { bid_id: B412, tab: 'pricing', at: at('14:00'), seconds: 300 },
        { bid_id: B431, tab: 'counts', at: at('18:00'), seconds: 300 },
      ],
    }),
  )

  it('puts a changed bid on the upper shelf, kept, and an opened one on the lower', () => {
    const list = buildBidDayList(read, none, [], names)
    expect(list.worked.map((r) => [r.bidId, r.kept, bidDayRowLine(r)])).toEqual([
      [B412, true, '5 minutes · Pricing'],
      [B398, true, '1 minute · Followup'],
    ])
    expect(list.opened.map((r) => [r.bidId, bidDayRowLine(r)])).toEqual([[B431, '5 minutes · Counts']])
    expect(list.keptCount).toBe(2)
    expect(list.empty).toBe(false)
    expect(list.worked[1]?.jobLabel).toBe('J1007')
  })

  it('gives each bid one colour, on its row and on its block, filled only while it is kept', () => {
    const list = buildBidDayList(read, new Map([[B412, 'off']]), [], names)
    expect(list.worked[0]).toMatchObject({ bidId: B412, kept: false, color: BID_DAY_COLORS[0] })
    const seg = (id: string) => list.strip.segments.find((s) => s.bidId === id)
    expect(seg(B412)).toMatchObject({ color: BID_DAY_COLORS[0], filled: false })
    expect(seg(B398)).toMatchObject({ color: BID_DAY_COLORS[1], filled: true })
    expect(seg(B431)).toMatchObject({ color: BID_DAY_COLORS[2], filled: false })
    expect(list.keptCount).toBe(1)
  })

  it('moves an opened bid up, with its own line, once the person ticks it', () => {
    const list = buildBidDayList(read, new Map([[B431, 'kept']]), [], names)
    expect(list.opened).toEqual([])
    expect(list.worked.map((r) => [r.bidId, bidDayRowLine(r)])).toContainEqual([B431, '5 minutes · Counts'])
    expect(list.strip.segments.find((s) => s.bidId === B431)?.filled).toBe(true)
  })

  it('lists a bid the person added that the app never saw, with no size and no block', () => {
    const list = buildBidDayList(read, none, [B420], names)
    const row = list.worked[list.worked.length - 1]
    expect(row).toMatchObject({ bidId: B420, kept: true, source: 'person', size: '', where: 'Added by you', color: null })
    expect(bidDayRowLine(row!)).toBe('Added by you')
    expect(list.strip.segments.some((s) => s.bidId === B420)).toBe(false)
    expect(list.keptCount).toBe(3)
  })

  it('places a block by its share of the day', () => {
    const list = buildBidDayList(read, none, [], names)
    const seg = list.strip.segments.find((s) => s.bidId === B412)
    // 14:00 to 14:05 of a strip that runs 13:00 to 21:00.
    expect(seg?.leftPct).toBeCloseTo(12.5, 5)
    expect(seg?.widthPct).toBeCloseTo((5 / 480) * 100, 5)
  })

  it('is empty on a day the app saw nothing, and not once a bid is added', () => {
    const blank = readBidDay(payload())
    expect(buildBidDayList(blank, none, [], names)).toMatchObject({ empty: true, keptCount: 0, worked: [], opened: [] })
    expect(buildBidDayList(blank, none, [B420], names)).toMatchObject({ empty: false, keptCount: 1 })
    expect(buildBidDayList(null, none, [], names).empty).toBe(true)
  })

  it('keeps what an earlier clock out of the day said, and a bid kept then that today no longer names', () => {
    const marks = bidDayMarksFromKept([
      { bid_id: B412, state: 'off', source: 'app' },
      { bid_id: B420, state: 'kept', source: 'person' },
    ])
    const list = buildBidDayList(read, marks, [], names)
    expect(list.worked.find((r) => r.bidId === B412)?.kept).toBe(false)
    expect(list.worked.find((r) => r.bidId === B420)).toMatchObject({ kept: true, source: 'person' })
  })
})

describe('what the press keeps', () => {
  const read = readBidDay(
    payload({
      changes: [{ bid_id: B398, at: at('17:00'), own: 2, app: 0, tables: ['bid_pricing_assignments'] }],
      beats: [
        { bid_id: B398, tab: 'pricing', at: at('17:00'), seconds: 300 },
        { bid_id: B431, tab: 'counts', at: at('18:00'), seconds: 300 },
      ],
    }),
  )
  const list = buildBidDayList(read, new Map([[B431, 'off']]), [B420], names)

  it('writes the note one line a kept bid, the job beside its bid, then what the person typed', () => {
    expect(bidDayNote(list, '  Site walk  ')).toBe('B398 · ZZ Test b398 (J1007): 5 minutes, Pricing\nB420 · ZZ Test b420\nSite walk')
    expect(bidDayNote(buildBidDayList(null, none, [], names), '')).toBe('')
  })

  it('keeps every row of the upper shelf, kept or off, and leaves an opened bid alone', () => {
    expect(bidDayEntries(list)).toEqual([
      { bid_id: B398, state: 'kept', source: 'app', seen_seconds: 300, tabs: ['pricing'], changes: 2 },
      { bid_id: B420, state: 'kept', source: 'person', seen_seconds: null, tabs: [], changes: 0 },
    ])
  })
})

describe('bidDayPressLabel', () => {
  it('says what the press keeps, and is the verb alone with no bid', () => {
    expect(bidDayPressLabel('Complete clock out', 4)).toBe('Complete clock out · 4 bids')
    expect(bidDayPressLabel('Complete clock out', 1)).toBe('Complete clock out · 1 bid')
    expect(bidDayPressLabel('Complete clock out', 0)).toBe('Complete clock out')
  })
})
