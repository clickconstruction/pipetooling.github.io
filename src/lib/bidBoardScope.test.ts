import { describe, it, expect } from 'vitest'
import { isRobotBid, partitionBidsByScope } from './bidBoardScope'

const TWIN = 'twin-uuid-1'
const HUMAN = 'human-uuid-1'
const twins = new Set([TWIN])

describe('isRobotBid', () => {
  it('assigned-to-twin bids are robot bids (assignment is the grant)', () => {
    expect(isRobotBid({ estimator_id: TWIN, created_by: HUMAN }, twins)).toBe(true)
  })

  it('twin-created unassigned bids are robot bids (fence probes, mission residue)', () => {
    expect(isRobotBid({ estimator_id: null, created_by: TWIN }, twins)).toBe(true)
  })

  it('human bids are not robot bids', () => {
    expect(isRobotBid({ estimator_id: HUMAN, created_by: HUMAN }, twins)).toBe(false)
    expect(isRobotBid({ estimator_id: null, created_by: null }, twins)).toBe(false)
  })

  it('no twins in the fleet → nothing is a robot bid', () => {
    expect(isRobotBid({ estimator_id: TWIN, created_by: TWIN }, new Set())).toBe(false)
  })
})

describe('partitionBidsByScope', () => {
  const bids = [
    { id: 'a', estimator_id: HUMAN, created_by: HUMAN },
    { id: 'b', estimator_id: TWIN, created_by: HUMAN },
    { id: 'c', estimator_id: null, created_by: TWIN },
    { id: 'd', estimator_id: null, created_by: null },
  ]

  it('splits into people and robots, preserving order, losing nothing', () => {
    const { people, robots } = partitionBidsByScope(bids, twins)
    expect(people.map((b) => b.id)).toEqual(['a', 'd'])
    expect(robots.map((b) => b.id)).toEqual(['b', 'c'])
    expect(people.length + robots.length).toBe(bids.length)
  })

  it('empty twin set → everything is people', () => {
    const { people, robots } = partitionBidsByScope(bids, new Set())
    expect(people).toHaveLength(4)
    expect(robots).toHaveLength(0)
  })
})
