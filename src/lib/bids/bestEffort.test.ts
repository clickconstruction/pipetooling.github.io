import { describe, expect, it } from 'vitest'
import { bestEffortCardMode, bestEffortGap, bestEffortGapNote, bestEffortRecordNote, bestEffortStamp, summarizeBestEffortMoves } from './bestEffort'

const live = { id: 'b431', bid_number: '431', bid_date_sent: null, bid_value: null }
const record = { bid_id: 'b431', value: 148200, recorded_at: '2026-09-10T15:00:00Z', recorded_by: 'wendi' }

describe('bestEffortCardMode', () => {
  it('offers the record button with the letter amount on a live bid, naming the robot state', () => {
    expect(bestEffortCardMode({ bid: live, amount: 148200, record: null, run: { status: 'locked', locked_at: '2026-09-07T12:00:00Z' } })).toEqual({ kind: 'record', amount: 148200, robot: 'sealed' })
    expect(bestEffortCardMode({ bid: live, amount: 148200, record: null, run: { status: 'open', locked_at: null } })).toEqual({ kind: 'record', amount: 148200, robot: 'estimating' })
    expect(bestEffortCardMode({ bid: live, amount: 148200, record: null, run: null })).toEqual({ kind: 'record', amount: 148200, robot: 'none' })
  })
  it('hides with no amount, on an opted-out bid, or once sent without a record', () => {
    expect(bestEffortCardMode({ bid: live, amount: 0, record: null, run: null })).toEqual({ kind: 'hidden', why: 'no-amount' })
    expect(bestEffortCardMode({ bid: { ...live, robot_opt_out: true }, amount: 100, record: null, run: null })).toEqual({ kind: 'hidden', why: 'opted-out' })
    expect(bestEffortCardMode({ bid: { ...live, bid_date_sent: '2026-09-10', bid_value: 1 }, amount: 100, record: null, run: null })).toEqual({ kind: 'hidden', why: 'sent' })
  })
  it('once recorded: the stamp, and the envelope door only when the run has scored', () => {
    expect(bestEffortCardMode({ bid: live, amount: 999, record, run: { status: 'scored', locked_at: null } })).toEqual({ kind: 'recorded', value: 148200, recordedAt: record.recorded_at, envelope: 'open' })
    expect(bestEffortCardMode({ bid: live, amount: 999, record, run: { status: 'open', locked_at: null } })).toMatchObject({ kind: 'recorded', envelope: 'waiting' })
    expect(bestEffortCardMode({ bid: live, amount: 999, record, run: null })).toMatchObject({ kind: 'recorded', envelope: 'none' })
    // A recorded bid keeps its stamp after send too.
    expect(bestEffortCardMode({ bid: { ...live, bid_date_sent: '2026-09-11' }, amount: 999, record, run: { status: 'scored', locked_at: null } })).toMatchObject({ kind: 'recorded', envelope: 'open' })
  })
})

describe('notes and stamps', () => {
  it('writes the record note for each robot state', () => {
    expect(bestEffortRecordNote({ actorDisplayName: 'Wendi', value: 148200, robot: 'sealed' })).toBe(
      "[best effort] Wendi recorded $148,200 as the number we would send right now, before seeing the robot. The robot's sealed number opens against it.",
    )
    expect(bestEffortRecordNote({ actorDisplayName: 'Wendi', value: 148200, robot: 'estimating' })).toContain('still estimating')
    expect(bestEffortRecordNote({ actorDisplayName: 'Wendi', value: 148200, robot: 'none' })).toContain('No robot on this bid yet')
  })
  it('measures the gap and writes the send note', () => {
    const gap = bestEffortGap(148200, 151400)
    expect(gap).toEqual({ best: 148200, sent: 151400, diff: 3200, pct: 2.2 })
    expect(bestEffortGapNote(gap!, 171940)).toBe('[best effort gap] Sent $151,400 against a best effort of $148,200 (+$3,200, +2.2%) — the change after the robot\'s envelope. · robot had $171,940')
    expect(bestEffortGap('148200', 148200.4)).toBeNull()
    expect(bestEffortGap(null, 100)).toBeNull()
    expect(bestEffortGapNote(bestEffortGap(100000, 90000)!, null)).toContain('(−$10,000, -10%)')
  })
  it('stamps the date and recorder', () => {
    expect(bestEffortStamp(record, 'Wendi')).toBe('best effort 9/10 · Wendi')
    expect(bestEffortStamp(record)).toBe('best effort 9/10')
  })
  it('sums the moves for the strip', () => {
    expect(summarizeBestEffortMoves([
      { best: 100, sent: 120 },
      { best: 100, sent: 100 },
      { best: 200, sent: 150 },
      { best: null, sent: 90 },
    ])).toEqual({ moved: 2, total: 70 })
  })
})
