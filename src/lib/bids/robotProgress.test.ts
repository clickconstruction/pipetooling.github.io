import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { buildRobotProgress, insideFraction, progressBidIds, ringFillForState, ringProgressFor, robotProgressByBid, usualRunWords, type RobotProgressRow } from './robotProgress'

const NOW = Date.parse('2026-10-21T19:38:00Z') // 2:38 PM Central
const T = (hhmm: string) => `2026-10-21T${hhmm}:00Z`

function row(over: Partial<RobotProgressRow> = {}): RobotProgressRow {
  return {
    bid_id: 'human-1',
    shell_bid_id: 'shell-1',
    shell_bid_number: '2041',
    run_status: 'open',
    claimed_at: T('19:04'),
    plans_filed: true,
    read_at: null,
    counted_at: null,
    priced_at: null,
    locked_at: null,
    scored_at: null,
    questions_at: null,
    heartbeat_at: T('19:36'),
    heartbeat_state: 'working',
    heartbeat_stage: 'STG-2',
    heartbeat_progress: { step: 'reading', read: '12 of 31 sheets', next: 'the fixture schedule on P-601' },
    heartbeat_is_round: true,
    key_label: "Robert's Mac Mini",
    key_last_seen_at: T('19:36'),
    median_minutes: null,
    ...over,
  }
}

describe('buildRobotProgress', () => {
  it('reading the sheets: two steps done, the third lit with its inside count, the ring at 34%', () => {
    const p = buildRobotProgress(row(), NOW)
    expect(p.steps.map((s) => s.state)).toEqual(['done', 'done', 'now', 'todo', 'todo', 'todo', 'todo'])
    expect(p.steps[2]!.detail).toBe('12 of 31 sheets')
    expect(p.done).toBe(2)
    expect(p.fraction).toBeCloseTo((2 + 12 / 31) / 7, 3)
    expect(p.tone).toBe('blue')
    expect(p.sentence).toBe('Step 3 of 7. Reading the sheets, 12 of 31 sheets. Last word 2m ago.')
    expect(p.words).toBe('Reading the sheets, 12 of 31 sheets.')
    expect(p.host).toBe("Robert's Mac Mini")
    expect(p.quiet).toBe(false)
  })

  it('the facts move the bar when the robot forgot to heartbeat', () => {
    const p = buildRobotProgress(row({ heartbeat_progress: null, heartbeat_state: null, heartbeat_at: null, read_at: T('19:20'), counted_at: T('19:30') }), NOW)
    expect(p.done).toBe(4)
    expect(p.steps[4]!.state).toBe('now')
    expect(p.words).toBe('Pricing.')
    expect(p.sentence).toBe('Step 5 of 7. Pricing. Last word 2m ago.')
  })

  it('a heartbeat ahead of the facts lights its own step; one behind them does not pull the bar back', () => {
    const ahead = buildRobotProgress(row({ heartbeat_progress: { step: 'counting' } }), NOW)
    expect(ahead.done).toBe(3)
    const behind = buildRobotProgress(row({ read_at: T('19:20'), counted_at: T('19:30'), heartbeat_progress: { step: 'reading', read: '31 of 31 sheets' } }), NOW)
    expect(behind.done).toBe(4)
    expect(behind.steps[4]!.detail).toBeNull()
  })

  it('sealed is full and green whatever the questions step says; scored says so', () => {
    const sealed = buildRobotProgress(row({ locked_at: T('19:58'), read_at: T('19:20'), counted_at: T('19:30'), priced_at: T('19:50'), heartbeat_progress: { step: 'questions' } }), NOW)
    expect(sealed.fraction).toBe(1)
    expect(sealed.tone).toBe('green')
    expect(sealed.sealed).toBe(true)
    expect(sealed.sentence).toBe('Sealed. Its number shows when you send.')
    const scored = buildRobotProgress(row({ locked_at: T('19:58'), scored_at: T('21:00'), run_status: 'scored' }), NOW)
    expect(scored.sentence).toBe('Scored.')
  })

  it('every step done once the questions are seeded', () => {
    const p = buildRobotProgress(row({ read_at: T('19:20'), counted_at: T('19:30'), priced_at: T('19:50'), locked_at: T('19:58'), questions_at: T('19:59'), heartbeat_state: 'done' }), NOW)
    expect(p.nowIndex).toBeNull()
    expect(p.done).toBe(7)
    expect(p.steps.every((s) => s.state === 'done')).toBe(true)
  })

  it('quiet: ten minutes with no word while the shell is open turns the line amber', () => {
    const p = buildRobotProgress(row({ heartbeat_at: T('19:26'), key_last_seen_at: T('19:27') }), NOW)
    expect(p.quiet).toBe(true)
    expect(p.tone).toBe('amber')
    expect(p.sentence).toBe('The robot went quiet on this bid 11m ago. Another round picks it up within ten minutes.')
    const sealedQuiet = buildRobotProgress(row({ heartbeat_at: T('18:00'), key_last_seen_at: T('18:00'), locked_at: T('18:01') }), NOW)
    expect(sealedQuiet.quiet).toBe(false)
  })

  it('a voided run is set aside and gray', () => {
    const p = buildRobotProgress(row({ run_status: 'void' }), NOW)
    expect(p.void).toBe(true)
    expect(p.tone).toBe('gray')
    expect(p.sentence).toBe('Set aside.')
  })

  it('live (v2.5751): a heartbeat within ten minutes on an open, unlocked shell; the key\'s own call does not count', () => {
    expect(buildRobotProgress(row(), NOW).live).toBe(true)
    // The heartbeat is the robot's word on THIS bid; the key may have called from another one.
    expect(buildRobotProgress(row({ heartbeat_at: T('19:20'), key_last_seen_at: T('19:37') }), NOW).live).toBe(false)
    expect(buildRobotProgress(row({ heartbeat_at: null, key_last_seen_at: T('19:37') }), NOW).live).toBe(false)
    // Exactly ten minutes is still live; a second over is not.
    expect(buildRobotProgress(row({ heartbeat_at: T('19:28') }), NOW).live).toBe(true)
    expect(buildRobotProgress(row({ heartbeat_at: '2026-10-21T19:27:59Z' }), NOW).live).toBe(false)
    expect(buildRobotProgress(row({ locked_at: T('19:37') }), NOW).live).toBe(false)
    expect(buildRobotProgress(row({ run_status: 'void' }), NOW).live).toBe(false)
  })

  it('blocked reads what it waits on', () => {
    const p = buildRobotProgress(row({ heartbeat_state: 'blocked', heartbeat_progress: { step: 'reading', waiting_on: 'you: the plans' } }), NOW)
    expect(p.words).toBe('Waiting on you: the plans.')
  })

  it('every sentence passes the plain-words rules', () => {
    const cases = [
      buildRobotProgress(row(), NOW),
      buildRobotProgress(row({ heartbeat_at: T('19:26'), key_last_seen_at: T('19:27') }), NOW),
      buildRobotProgress(row({ locked_at: T('19:58') }), NOW),
      buildRobotProgress(row({ run_status: 'void' }), NOW),
      buildRobotProgress(row({ heartbeat_state: 'blocked', heartbeat_progress: { waiting_on: 'you: the plans' } }), NOW),
    ]
    for (const c of cases) {
      expect(plainWordsFailures(c.sentence)).toEqual([])
      expect(plainWordsFailures(c.words)).toEqual([])
    }
    expect(plainWordsFailures(usualRunWords(62)!)).toEqual([])
  })
})

describe('insideFraction and usualRunWords', () => {
  it('reads "12 of 31" and ignores the rest', () => {
    expect(insideFraction('12 of 31 sheets')).toBeCloseTo(12 / 31)
    expect(insideFraction('the index')).toBeNull()
    expect(insideFraction('40 of 31')).toBe(1)
    expect(insideFraction(null)).toBeNull()
  })
  it('the usual run, once there is one', () => {
    expect(usualRunWords(null)).toBeNull()
    expect(usualRunWords('0')).toBeNull()
    expect(usualRunWords(22)).toBe('Most bids take about 20 minutes.')
    expect(usualRunWords(62)).toBe('Most bids take about an hour.')
    expect(usualRunWords(150)).toBe('Most bids take about 2.5 hours.')
    expect(usualRunWords(180)).toBe('Most bids take about 3 hours.')
  })
})

describe('ringFillForState and robotProgressByBid', () => {
  it('an icon with no row fills by its own state', () => {
    expect(ringFillForState('queued')).toEqual({ fraction: 0, tone: 'gray' })
    expect(ringFillForState('sealed')).toEqual({ fraction: 1, tone: 'green' })
    expect(ringFillForState('needs')).toEqual({ fraction: 0, tone: 'amber' })
    expect(ringFillForState('grade')).toBeNull()
  })
  it('the first row per bid wins', () => {
    const m = robotProgressByBid([row(), row({ claimed_at: T('10:00'), heartbeat_progress: null })], NOW)
    expect(m.size).toBe(1)
    expect(m.get('human-1')!.done).toBe(2)
  })
})

describe('ringProgressFor and progressBidIds (v2.5751: a sent bid\'s live run)', () => {
  const live = buildRobotProgress(row(), NOW)
  const stale = buildRobotProgress(row({ heartbeat_at: T('18:00'), key_last_seen_at: T('18:00') }), NOW)
  const sealed = buildRobotProgress(row({ locked_at: T('19:30') }), NOW)
  const voided = buildRobotProgress(row({ run_status: 'void' }), NOW)

  it('an unsent bid shows its row whatever it says', () => {
    for (const p of [live, stale, sealed, voided]) expect(ringProgressFor(p, { bid_date_sent: null })).toBe(p)
    expect(ringProgressFor(null, { bid_date_sent: null })).toBeNull()
  })

  it('a sent bid shows the ring only while a robot is live on it', () => {
    const sent = { bid_date_sent: '2026-10-20' }
    expect(ringProgressFor(live, sent)).toBe(live)
    expect(ringProgressFor(stale, sent)).toBeNull()
    expect(ringProgressFor(sealed, sent)).toBeNull()
    expect(ringProgressFor(voided, sent)).toBeNull()
    expect(ringProgressFor(null, sent)).toBeNull()
  })

  it('robot_progress is asked about every undecided bid with a run, sent or not, and no decided one', () => {
    const bids = [
      { id: 'unsent-run', outcome: null, bid_date_sent: null, run: true },
      { id: 'unsent-none', outcome: null, bid_date_sent: null, run: false },
      { id: 'sent-run', outcome: null, bid_date_sent: '2026-10-20', run: true },
      { id: 'sent-none', outcome: null, bid_date_sent: '2026-10-20', run: false },
      { id: 'won-run', outcome: 'won', bid_date_sent: '2026-10-01', run: true },
    ]
    expect(progressBidIds(bids, (b) => b.run)).toEqual(['unsent-run', 'sent-run'])
  })
})
