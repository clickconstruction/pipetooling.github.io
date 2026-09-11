import { describe, expect, it } from 'vitest'

import { buildRobotBacklog, describeBacklogAge, type RobotBacklogBid, type RobotBacklogRequest } from './robotBacklog'

const NOW = Date.parse('2026-09-11T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const H = 3600000
const D = 24 * H

const bid = (id: string, p: Partial<RobotBacklogBid> = {}): RobotBacklogBid => ({
  id,
  bid_number: id.replace(/^b/, ''),
  project_name: 'Marriott shell',
  plans_link: 'https://drive/x',
  service_type_id: 'st-plumbing',
  distance_from_office: 12,
  bid_due_date: '2026-10-01',
  gc_builder_id: 'gc',
  customer_id: null,
  robot_requested_at: null,
  robot_requested_by: null,
  bid_date_sent: null,
  outcome: null,
  ...p,
})
const req = (id: string, p: Partial<RobotBacklogRequest> = {}): RobotBacklogRequest => ({
  id,
  status: 'queued',
  requested_at: ago(5 * H),
  claimed_at: null,
  heartbeat_at: null,
  bid: { bid_number: '359', project_name: 'SpaceX BA-2' },
  ...p,
})

describe('buildRobotBacklog', () => {
  it('is silent when nothing is waiting', () => {
    expect(buildRobotBacklog([], () => false, [], NOW)).toBeNull()
    // A sent bid, a shadowed bid, a bid with no plans, and a finished request are not backlog.
    const bids = [bid('b1', { bid_date_sent: '2026-09-01' }), bid('b2'), bid('b3', { plans_link: null })]
    expect(buildRobotBacklog(bids, (id) => id === 'b2', [req('r1', { status: 'ready' })], NOW)).toBeNull()
  })

  it('counts requested + ready bids, names the oldest request, and ages it', () => {
    const bids = [
      bid('b482', { robot_requested_at: ago(3 * D), project_name: 'Marriott shell' }),
      bid('b490', { robot_requested_at: ago(1 * D), project_name: 'Vet clinic' }),
      bid('b495', { project_name: 'Fitness club' }),
      bid('b500', { bid_due_date: '2026-07-01', project_name: 'stale' }),
    ]
    const b = buildRobotBacklog(bids, () => false, [], NOW)!
    expect(b.bidsWaiting).toBe(3)
    expect(b.bidsRequested).toBe(2)
    expect(b.firstBid).toBe('BP482 Marriott shell')
    expect(describeBacklogAge(b.oldestRequestMs!)).toBe('3 days')
    expect(b.requestOverdue).toBe(false)
    expect(b.matricesOpen).toBe(0)
    expect(b.firstMatrix).toBeNull()
  })

  it('a request older than a week is overdue; a ready bid names itself when nothing is requested', () => {
    expect(buildRobotBacklog([bid('b1', { robot_requested_at: ago(8 * D) })], () => false, [], NOW)!.requestOverdue).toBe(true)
    const b = buildRobotBacklog([bid('b7', { project_name: 'Ready one' })], () => false, [], NOW)!
    expect(b.firstBid).toBe('BP7 Ready one')
    expect(b.oldestRequestMs).toBeNull()
  })

  it('counts open matrices, flags blocked and silent-working ones as stuck, and names the oldest', () => {
    const rs = [
      req('r1', { requested_at: ago(5 * H) }),
      req('r2', { status: 'working', requested_at: ago(2 * H), claimed_at: ago(90 * 60000), heartbeat_at: ago(70 * 60000), bid: { bid_number: '398', project_name: 'ZZ Test' } }),
      req('r3', { status: 'working', requested_at: ago(1 * H), claimed_at: ago(30 * 60000), heartbeat_at: ago(5 * 60000) }),
      req('r4', { status: 'blocked', requested_at: ago(30 * 60000) }),
      req('r5', { status: 'ready', requested_at: ago(9 * H) }),
      req('r6', { status: 'cancelled', requested_at: ago(9 * H) }),
    ]
    const b = buildRobotBacklog([], () => false, rs, NOW)!
    expect(b.matricesOpen).toBe(4)
    expect(b.matricesStuck).toBe(2)
    expect(b.firstMatrix).toBe('BP359 SpaceX BA-2')
    expect(describeBacklogAge(b.oldestMatrixMs!)).toBe('5 hours')
    expect(b.bidsWaiting).toBe(0)
  })
})

describe('describeBacklogAge', () => {
  it('is coarse on purpose', () => {
    expect(describeBacklogAge(30000)).toBe('just now')
    expect(describeBacklogAge(20 * 60000)).toBe('20 minutes')
    expect(describeBacklogAge(1 * H)).toBe('1 hour')
    expect(describeBacklogAge(26 * H)).toBe('1 day')
    expect(describeBacklogAge(3 * D + 5 * H)).toBe('3 days')
  })
})
