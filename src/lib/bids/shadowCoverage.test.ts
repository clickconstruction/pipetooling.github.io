import { describe, expect, it } from 'vitest'
import { isPlansUnreadableByRobots, isShadowEligibleLiveBid, shadowCoverage, type ShadowCoverageBid } from './shadowCoverage'

const liveBid = (over: Partial<ShadowCoverageBid> = {}): ShadowCoverageBid => ({
  bid_number: '400',
  bid_date_sent: null,
  plans_link: 'https://drive.example/plans',
  project_name: 'La Villita TI',
  ...over,
})

describe('isShadowEligibleLiveBid', () => {
  it('accepts an unsent bid with plans and a real project name', () => {
    expect(isShadowEligibleLiveBid(liveBid())).toBe(true)
  })

  it('rejects sent bids', () => {
    expect(isShadowEligibleLiveBid(liveBid({ bid_date_sent: '2026-09-01' }))).toBe(false)
  })

  it('rejects bids with no plans link (blank or whitespace)', () => {
    expect(isShadowEligibleLiveBid(liveBid({ plans_link: null }))).toBe(false)
    expect(isShadowEligibleLiveBid(liveBid({ plans_link: '   ' }))).toBe(false)
  })

  it("rejects 'ZZ ' sandbox bids, case-insensitively, like the SQL NOT ILIKE 'ZZ %'", () => {
    expect(isShadowEligibleLiveBid(liveBid({ project_name: 'ZZ robot practice' }))).toBe(false)
    expect(isShadowEligibleLiveBid(liveBid({ project_name: 'zz robot practice' }))).toBe(false)
    // 'ZZ' must be a prefix word — a project that merely contains it stays live.
    expect(isShadowEligibleLiveBid(liveBid({ project_name: 'Buzz ZZ Plaza' }))).toBe(true)
    // No space after ZZ = not the sandbox convention.
    expect(isShadowEligibleLiveBid(liveBid({ project_name: 'ZZTop Bar' }))).toBe(true)
  })

  it('treats a null project name as live (nothing to match ZZ against)', () => {
    expect(isShadowEligibleLiveBid(liveBid({ project_name: null }))).toBe(true)
  })
})

describe('shadowCoverage', () => {
  it('counts covered vs live by bid number', () => {
    const bids = [
      liveBid({ bid_number: '400' }),
      liveBid({ bid_number: '401' }),
      liveBid({ bid_number: '402' }),
      liveBid({ bid_number: '403', bid_date_sent: '2026-09-01' }), // sent — not live
      liveBid({ bid_number: '404', plans_link: null }), // no plans — not live
      liveBid({ bid_number: '405', project_name: 'ZZ shadow sandbox' }), // sandbox — not live
    ]
    const stat = shadowCoverage(bids, ['400', '402', '403', null, undefined])
    expect(stat).toEqual({ covered: 2, live: 3, unreadable: [] })
  })

  it('normalizes whitespace on both sides of the match', () => {
    const stat = shadowCoverage([liveBid({ bid_number: ' 400 ' })], ['400 '])
    expect(stat).toEqual({ covered: 1, live: 1, unreadable: [] })
  })

  it('a live bid without a bid number counts as live but never covered', () => {
    const stat = shadowCoverage([liveBid({ bid_number: null })], ['400'])
    expect(stat).toEqual({ covered: 0, live: 1, unreadable: [] })
  })

  it('empty inputs produce 0/0', () => {
    expect(shadowCoverage([], [])).toEqual({ covered: 0, live: 0, unreadable: [] })
  })

  // "Plans readable by robots" (v2.3080): the probe's verdict rides on the bid.
  it('lists uncovered live bids the intake service account cannot read, with the probe reason', () => {
    const stat = shadowCoverage(
      [
        liveBid({ bid_number: '480', plans_robot_readable: false, plans_robot_probe_note: 'Drive 404 — not shared' }),
        liveBid({ bid_number: '481', plans_robot_readable: true }),
        liveBid({ bid_number: '482' }), // never probed — assumed readable
      ],
      [],
    )
    expect(stat).toEqual({ covered: 0, live: 3, unreadable: [{ bid: 'b480', why: 'Drive 404 — not shared' }] })
  })

  it('an unreadable bid that is already shadowed is covered, not listed', () => {
    const stat = shadowCoverage([liveBid({ bid_number: '480', plans_robot_readable: false })], ['480'])
    expect(stat).toEqual({ covered: 1, live: 1, unreadable: [] })
  })

  it('isPlansUnreadableByRobots is true only for a probed-false verdict', () => {
    expect(isPlansUnreadableByRobots({ plans_robot_readable: false })).toBe(true)
    expect(isPlansUnreadableByRobots({ plans_robot_readable: true })).toBe(false)
    expect(isPlansUnreadableByRobots({ plans_robot_readable: null })).toBe(false)
    expect(isPlansUnreadableByRobots({})).toBe(false)
  })
})
