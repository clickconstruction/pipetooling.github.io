import { describe, expect, it } from 'vitest'
import { formatDeltaPct, robotGaps, robotRowState, robotStatusTimeline, type RobotRowBid, type RobotRowInput, type RobotRowRun } from './robotRowState'

function bid(over: Partial<RobotRowBid> = {}): RobotRowBid {
  return {
    id: 'b1',
    bid_number: '483',
    project_name: 'Laynes Chicken Fingers',
    plans_link: 'https://drive.google.com/drive/folders/abc',
    service_type_id: 'st-plumbing',
    distance_from_office: 41,
    bid_due_date: '2026-09-18',
    gc_builder_id: null,
    customer_id: 'c1',
    outcome: null,
    bid_date_sent: null,
    bid_value: null,
    ...over,
  }
}

function run(over: Partial<RobotRowRun> = {}): RobotRowRun {
  return {
    status: 'open',
    created_at: '2026-09-09T16:02:00Z',
    locked_at: null,
    scored_at: null,
    delta_pct: null,
    shadow_bid_number: '489',
    requested_by_name: null,
    teacher_name: null,
    ...over,
  }
}

function input(over: Partial<RobotRowInput> = {}): RobotRowInput {
  return { bid: bid(), serviceTypeName: 'Plumbing', twinBidNumber: null, run: null, openQuestions: 0, presence: null, ...over }
}

describe('robotRowState', () => {
  it('queues an eligible live bid with no run yet', () => {
    const s = robotRowState(input())
    expect(s.kind).toBe('queued')
    expect(s.kind === 'queued' && s.title).toMatch(/next batch/)
  })

  it('is working while the shadow run is open, and when only a twin pairing exists', () => {
    expect(robotRowState(input({ run: run() })).kind).toBe('working')
    const paired = robotRowState(input({ twinBidNumber: '489' }))
    expect(paired.kind).toBe('working')
    expect(paired.kind === 'working' && paired.twinBidNumber).toBe('489')
  })

  it('seals on a locked run and never mentions the number', () => {
    const s = robotRowState(input({ run: run({ status: 'locked', locked_at: '2026-09-09T19:14:00Z' }) }))
    expect(s.kind).toBe('sealed')
    expect(s.kind === 'sealed' && s.lockedAt).toBe('2026-09-09T19:14:00Z')
    expect(s.title).not.toMatch(/\$/)
  })

  it('scores once the run is scored, carrying the signed delta', () => {
    const s = robotRowState(input({ bid: bid({ bid_date_sent: '2026-09-12', bid_value: 48200 }), run: run({ status: 'scored', delta_pct: -6.2 }) }))
    expect(s.kind).toBe('scored')
    expect(s.kind === 'scored' && s.deltaPct).toBe(-6.2)
    expect(s.title).toContain('-6.2%')
  })

  it('sealed beats an open question — the robot already finished', () => {
    const s = robotRowState(input({ run: run({ status: 'locked', locked_at: 'x' }), openQuestions: 2 }))
    expect(s.kind).toBe('sealed')
  })

  it('needs something when the plans link is missing, with the fix', () => {
    const s = robotRowState(input({ bid: bid({ plans_link: null }) }))
    expect(s.kind).toBe('needs')
    if (s.kind !== 'needs') throw new Error()
    expect(s.badge).toBe('?')
    expect(s.gaps[0]?.key).toBe('plans')
    expect(s.gaps[0]?.required).toBe(true)
    expect(s.title).toMatch(/no plans link/i)
  })

  it('needs something when the probe says the plans are not shared, offering the intake address', () => {
    const s = robotRowState(input({ bid: bid({ plans_robot_readable: false, plans_robot_probe_note: 'folder not shared with the service account' }) }))
    expect(s.kind).toBe('needs')
    if (s.kind !== 'needs') throw new Error()
    expect(s.gaps[0]?.key).toBe('plans-unreadable')
    expect(s.gaps[0]?.copyIntake).toBe(true)
    expect(s.gaps[0]?.fix).toMatch(/folder/)
  })

  it('a plans ask names the fix in the title, not "asked a question" (v2.3212)', () => {
    const s = robotRowState(input({ run: run(), openQuestions: 1, plansAsks: 1 }))
    expect(s.kind).toBe('needs')
    if (s.kind !== 'needs') throw new Error()
    expect(s.badge).toBe('1')
    expect(s.title).toMatch(/different plan set/i)
    expect(s.title).toMatch(/click to fix/i)
  })

  it('needs something when the robot asked, even while it is working; badge is the count', () => {
    const s = robotRowState(input({ run: run(), openQuestions: 2 }))
    expect(s.kind).toBe('needs')
    if (s.kind !== 'needs') throw new Error()
    expect(s.badge).toBe('2')
    expect(s.questions).toBe(2)
    expect(s.title).toMatch(/2 questions/)
    expect(robotRowState(input({ openQuestions: 12 })).kind === 'needs' && (robotRowState(input({ openQuestions: 12 })) as { badge: string }).badge).toBe('9+')
  })

  it('soft gaps (distance, due date, GC) never trigger needs but ride along in the gap list', () => {
    const s = robotRowState(input({ bid: bid({ distance_from_office: null, bid_due_date: null }) }))
    expect(s.kind).toBe('queued')
    const gaps = robotGaps(bid({ distance_from_office: null, bid_due_date: null }))
    expect(gaps.map((g) => g.key)).toEqual(['distance', 'due-date'])
    expect(gaps.every((g) => !g.required)).toBe(true)
  })

  it('is off for an opted-out bid and for a non-plumbing division', () => {
    const off = robotRowState(input({ bid: bid({ robot_opt_out: true }) }))
    expect(off.kind === 'off' && off.reason).toBe('opt-out')
    const elec = robotRowState(input({ serviceTypeName: 'Electrical' }))
    expect(elec.kind === 'off' && elec.reason).toBe('division')
    expect(elec.title).toMatch(/electrical/)
    // Unknown division name: no division verdict.
    expect(robotRowState(input({ serviceTypeName: null })).kind).toBe('queued')
  })

  it('a decided bid grades from whatever presence is known', () => {
    const s = robotRowState(input({ bid: bid({ outcome: 'won', bid_value: 12000 }), presence: { hasCounts: true, hasPricing: true } }))
    expect(s.kind === 'grade' && s.grade).toBe('A')
    const noPresence = robotRowState(input({ bid: bid({ outcome: 'lost', bid_value: 12000 }) }))
    expect(noPresence.kind === 'grade' && noPresence.grade).toBe('B')
    // Decided always wins, even over an opt-out or a robot.
    expect(robotRowState(input({ bid: bid({ outcome: 'won', robot_opt_out: true }), run: run() })).kind).toBe('grade')
  })

  it('a sent-undecided bid without a robot grades only once presence is loaded', () => {
    const waiting = robotRowState(input({ bid: bid({ bid_date_sent: '2026-09-08', bid_value: 51000 }) }))
    expect(waiting.kind).toBe('none')
    const graded = robotRowState(input({ bid: bid({ bid_date_sent: '2026-09-08', bid_value: 51000 }), presence: { hasCounts: true, hasPricing: false } }))
    expect(graded.kind === 'grade' && graded.grade).toBe('B')
  })

  it('a sent bid whose robot has not scored yet stays with the robot', () => {
    const s = robotRowState(input({ bid: bid({ bid_date_sent: '2026-09-08' }), run: run({ status: 'locked', locked_at: 'x' }) }))
    expect(s.kind).toBe('sealed')
    expect(s.title).toMatch(/bid value/)
    const working = robotRowState(input({ bid: bid({ bid_date_sent: '2026-09-08' }), twinBidNumber: '489' }))
    expect(working.kind).toBe('working')
    expect(working.title).toMatch(/b489 .* click to compare/)
  })
})

describe('robotStatusTimeline', () => {
  it('walks the five steps from queued to scored', () => {
    const queued = robotStatusTimeline(input())
    expect(queued.map((s) => s.state)).toEqual(['now', 'todo', 'todo', 'todo', 'todo'])
    expect(queued[0]?.label).toMatch(/next batch/)

    const working = robotStatusTimeline(input({ run: run() }))
    expect(working.map((s) => s.state)).toEqual(['done', 'now', 'todo', 'todo', 'todo'])
    expect(working[0]?.detail).toBe('robot bid b489')

    const sealed = robotStatusTimeline(input({ run: run({ status: 'locked', locked_at: '2026-09-09T19:14:00Z' }) }))
    expect(sealed.map((s) => s.state)).toEqual(['done', 'done', 'done', 'now', 'todo'])
    expect(sealed[2]?.at).toBe('2026-09-09T19:14:00Z')
    expect(sealed[2]?.detail).toMatch(/Nobody sees the number/)

    const sentNoValue = robotStatusTimeline(input({ bid: bid({ bid_date_sent: '2026-09-12' }), run: run({ status: 'locked', locked_at: 'x' }) }))
    expect(sentNoValue.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'now'])
    expect(sentNoValue[4]?.detail).toMatch(/bid value/)

    const scored = robotStatusTimeline(input({ bid: bid({ bid_date_sent: '2026-09-12', bid_value: 48200 }), run: run({ status: 'scored', locked_at: 'x', scored_at: '2026-09-12T20:00:00Z', delta_pct: -6.2, teacher_name: 'Grace' }) }))
    expect(scored.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'done'])
    expect(scored[4]?.label).toBe('Scored -6.2%')
    expect(scored[4]?.detail).toMatch(/Grace/)
  })

  it('names who asked for it when a person moved it to the front', () => {
    const t = robotStatusTimeline(input({ run: run({ requested_by_name: 'Wendi' }) }))
    expect(t[0]?.label).toMatch(/asked for by Wendi/)
  })
})

describe('formatDeltaPct', () => {
  it('signs and rounds', () => {
    expect(formatDeltaPct(-6.24)).toBe('-6.2%')
    expect(formatDeltaPct(3)).toBe('+3.0%')
    expect(formatDeltaPct(0)).toBe('0.0%')
    expect(formatDeltaPct(null)).toBeNull()
  })
})
