import { describe, expect, it } from 'vitest'
import { buildRobotQueue, plumbingServiceTypeIdOf, robotQueueRunStatus, type RobotQueueBidFields, type RobotQueueInput } from './robotQueue'

const PLUMBING = 'st-plumbing'
const NOW = Date.parse('2026-10-23T00:10:00Z')
const TODAY = '2026-10-22'

const base = (over: Partial<RobotQueueBidFields> & { id: string }): RobotQueueBidFields => ({
  bid_number: over.id.replace(/\D/g, '') || '1',
  project_name: 'P',
  plans_link: 'https://plans',
  service_type_id: PLUMBING,
  bid_due_date: '2026-10-28',
  created_at: '2026-10-19T12:00:00Z',
  robot_requested_at: null,
  robot_requested_by: null,
  bid_date_sent: null,
  outcome: null,
  robot_opt_out: false,
  plans_robot_readable: true,
  working_board_archived_at: null,
  ...over,
})

const input = (over: Partial<RobotQueueInput> = {}): RobotQueueInput => ({
  plumbingServiceTypeId: PLUMBING,
  shadowRunByBidNumber: new Map(),
  twinExistsForBidId: () => false,
  todayYmd: TODAY,
  nowMs: NOW,
  ...over,
})

describe('buildRobotQueue (one rule with the dispatcher, v2.5753)', () => {
  it('splits requested (oldest ask first) above ready (by due date), and lists what the rounds pass over under held', () => {
    const bids = [
      base({ id: 'a', robot_requested_at: '2026-08-31T10:00:00Z', created_at: '2026-06-01T00:00:00Z' }), // a request has no age
      base({ id: 'b', robot_requested_at: '2026-08-30T10:00:00Z' }),
      base({ id: 'c', bid_due_date: '2026-11-04' }),
      base({ id: 'd', bid_due_date: '2026-10-28' }),
      base({ id: 'e', plans_link: null }), // needs plans: the board's own door, not held
      base({ id: 'f' }), // a paired shell with no run row reads as open
      base({ id: 'g', bid_date_sent: '2026-08-01' }), // sent
      base({ id: 'h', outcome: 'lost' }), // decided
      base({ id: 'i', service_type_id: 'st-electrical' }), // another trade: neither ready nor held
      base({ id: 'j', created_at: '2026-09-01T00:00:00Z' }), // held: too old, nobody asked
      base({ id: 'k', robot_opt_out: true }), // held: left to a person
    ]
    const q = buildRobotQueue(bids, input({ twinExistsForBidId: (id) => id === 'f' }))
    expect(q.requested.map((b) => b.id)).toEqual(['b', 'a'])
    expect(q.ready.map((b) => b.id)).toEqual(['d', 'c'])
    // Held sorts like Ready: due date, then the oldest made first.
    expect(q.held.map((h) => [h.bid.id, h.reason])).toEqual([
      ['j', 'too_old'],
      ['k', 'opted_out'],
    ])
  })

  it('the run row outranks the pairing: a voided shell is not a robot on the bid, a live one is', () => {
    const runs = new Map([
      ['510', { status: 'void' }],
      ['511', { status: 'open' }],
      ['512', { status: 'locked' }],
    ])
    const bids = [base({ id: 'b510' }), base({ id: 'b511' }), base({ id: 'b512' }), base({ id: 'b513' })]
    const q = buildRobotQueue(bids, input({ shadowRunByBidNumber: runs, twinExistsForBidId: (id) => id === 'b510' || id === 'b513' }))
    expect(q.ready.map((b) => b.id)).toEqual(['b510'])
    expect(robotQueueRunStatus({ id: 'b510', bid_number: '510' }, { shadowRunByBidNumber: runs, twinExistsForBidId: () => true })).toBe('void')
    expect(robotQueueRunStatus({ id: 'b513', bid_number: ' 513 ' }, { shadowRunByBidNumber: runs, twinExistsForBidId: () => true })).toBe('open')
    expect(robotQueueRunStatus({ id: 'b514', bid_number: null }, { shadowRunByBidNumber: runs, twinExistsForBidId: () => false })).toBeNull()
    expect(robotQueueRunStatus({ id: 'b515', bid_number: '515' }, { shadowRunByBidNumber: new Map([['515', { status: 'odd' }]]), twinExistsForBidId: () => false })).toBe('open')
  })

  it('null due dates sort last in ready, then by age', () => {
    const q = buildRobotQueue(
      [base({ id: 'x', bid_due_date: null, created_at: '2026-10-20T00:00:00Z' }), base({ id: 'y', bid_due_date: '2026-11-02' }), base({ id: 'z', bid_due_date: null, created_at: '2026-10-15T00:00:00Z' })],
      input(),
    )
    expect(q.ready.map((b) => b.id)).toEqual(['y', 'z', 'x'])
  })

  it('a due date 30 days gone is held as stale', () => {
    const q = buildRobotQueue([base({ id: 'old', bid_due_date: '2026-03-11' }), base({ id: 'new', bid_due_date: '2026-11-02' })], input())
    expect(q.ready.map((b) => b.id)).toEqual(['new'])
    expect(q.held.map((h) => [h.bid.id, h.reason])).toEqual([['old', 'stale_due']])
  })

  it('a requested bid that lost its service type is not queued; the board’s own door says what is missing', () => {
    const q = buildRobotQueue([base({ id: 'z', robot_requested_at: '2026-08-31T00:00:00Z', service_type_id: null })], input())
    expect(q).toEqual({ requested: [], ready: [], held: [] })
  })

  it('with the service types not loaded yet, the division is not checked', () => {
    const q = buildRobotQueue([base({ id: 'i', service_type_id: 'st-electrical' })], input({ plumbingServiceTypeId: null }))
    expect(q.ready.map((b) => b.id)).toEqual(['i'])
  })
})

describe('plumbingServiceTypeIdOf', () => {
  it('finds the Plumbing type by name, whatever its case; null with none', () => {
    expect(plumbingServiceTypeIdOf([{ id: 'e', name: 'Electrical' }, { id: 'p', name: 'plumbing' }])).toBe('p')
    expect(plumbingServiceTypeIdOf([{ id: 'e', name: 'Electrical' }, { id: 'n', name: null }])).toBeNull()
    expect(plumbingServiceTypeIdOf([])).toBeNull()
  })
})
