import { describe, expect, it } from 'vitest'
import { robotOfferNote, robotScheduleNote, scheduleReadHoldsStepOpen } from './robotNote'
import type { SubmittalTaskRow } from './robotTasks'

const live = { live: true, line: 'A robot was working 12 min ago.' }
const NOW = new Date('2026-10-05T15:00:00Z').getTime()
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const task = (o: Partial<SubmittalTaskRow>): SubmittalTaskRow => ({ id: 't1', bid_id: 'b', submittal_id: null, kind: 'read_schedule', input: {}, result: null, status: 'queued', requested_at: '2026-10-05T14:30:00Z', claimed_at: null, finished_at: null, reviewed_at: null, summary: null, ...o } as SubmittalTaskRow)

describe('robotOfferNote', () => {
  it('no live seat, no offer', () => {
    expect(robotOfferNote('read_schedule', { live: false, line: 'No robot has run yet.' }, { hasPlans: true })).toBeNull()
  })

  it('the button is the line; the card says what it does, what it needs with the awake line, and what you do after', () => {
    const n = robotOfferNote('read_schedule', live, { hasPlans: true })!
    expect(n.chip).toBeNull()
    expect(n.button).toEqual({ label: 'Ask the robot to read the schedule', held: false })
    expect(n.lines).toEqual([
      'The robot can read the fixture schedule off the plans.',
      'Needs the plans on this bid ✓ · A robot was working 12 min ago.',
      'Its tags land here in a few minutes. You tick the right ones. Nothing counts until you do.',
    ])
    expect(n.tone).toBe('plain')
    expect(n.guide).toBe(true)
  })

  it('a bid with no plans link holds the button and says why beside it, without a hover', () => {
    const n = robotOfferNote('read_schedule', live, { hasPlans: false })!
    expect(n.button?.held).toBe(true)
    expect(n.heldWhy).toBe('needs the plans link on the bid')
    expect(n.tone).toBe('warn')
    expect(n.lines[1]).toContain('✗ Add the plans link on the bid first.')
  })

  it('the other two chores read the same way', () => {
    expect(robotOfferNote('file_cut_sheets', live)!.button?.label).toBe('Ask the robot to split this file')
    expect(robotOfferNote('read_redlines', live)!.button?.label).toBe('Ask the robot to read the redlines')
  })
})

describe('robotScheduleNote', () => {
  it('a fresh ask: a plain chip and Cancel', () => {
    const n = robotScheduleNote(task({}), live, NOW, day)
    expect([n.tone, n.chip, n.button?.label]).toEqual(['plain', 'Queued to read the plans', 'Cancel'])
    expect(n.lines[0]).toBe('The robot is queued to read the fixture schedule off the plans.')
  })

  it('an ask nobody came for: the chip is amber and names the day; the card says what to do by hand', () => {
    const n = robotScheduleNote(task({ requested_at: '2026-10-03T15:00:00Z' }), { live: true, line: 'A robot last ran 6 days ago.' }, NOW, day)
    expect([n.tone, n.chip, n.button?.label]).toEqual(['warn', 'Asked Oct 3 · not picked up yet', 'Take the ask back'])
    expect(n.lines).toEqual(['You asked the robot on Oct 3. A robot last ran 6 days ago. It has not picked this up.', 'Nobody is reading the plans. Type the schedule yourself, or leave the ask in place.'])
  })

  it('v2.4690 · an ask eight days old counts the days and offers Withdraw the ask', () => {
    const n = robotScheduleNote(task({ requested_at: '2026-09-27T15:00:00Z' }), { live: true, line: 'A robot last ran 6 days ago.' }, NOW, day)
    expect([n.tone, n.chip, n.button?.label]).toEqual(['warn', 'Asked 8 days ago · nobody picked it up', 'Withdraw the ask'])
    expect(n.lines[0]).toBe('You asked the robot 8 days ago. Nobody has picked it up.')
  })

  it('no robot on shift at all makes even a new ask stale', () => {
    const n = robotScheduleNote(task({}), { live: false, line: 'No robot has run in 12 days.' }, NOW, day)
    expect(n.chip).toBe('Asked Oct 5 · no robot has run in 12 days')
  })

  it('working has nothing to press', () => {
    const n = robotScheduleNote(task({ status: 'working' }), live, NOW, day)
    expect([n.chip, n.button]).toEqual(['Reading the plans now', null])
  })

  it('read: the chip counts the tags and points under the cards; no tags says so', () => {
    const rows = [{ tag: 'WC-1', model: 'CT708', confidence: 0.95 }, { tag: 'HB-3', model: 'B74', confidence: 0.4 }]
    const read = robotScheduleNote(task({ status: 'ready', result: { rows } }), live, NOW, day)
    expect([read.tone, read.chip]).toEqual(['good', 'Read 2 tags · confirm below'])
    const none = robotScheduleNote(task({ status: 'ready', result: { rows: [] } }), live, NOW, day)
    expect([none.tone, none.chip]).toEqual(['plain', 'Found no tags'])
  })

  it('blocked: red, the robot’s own reason leads the card, and Dismiss', () => {
    const n = robotScheduleNote(task({ status: 'blocked', summary: 'The plans link asks for a sign-in.' }), live, NOW, day)
    expect([n.tone, n.chip, n.button?.label, n.lines[0]]).toEqual(['bad', 'Could not read the plans', 'Dismiss', 'The plans link asks for a sign-in.'])
  })
})

describe('scheduleReadHoldsStepOpen', () => {
  it('only a read that is back with tags to confirm keeps step 1 open', () => {
    const rows = [{ tag: 'WC-1', model: 'CT708', confidence: 0.95 }]
    expect(scheduleReadHoldsStepOpen(task({ status: 'ready', result: { rows } }))).toBe(true)
  })
  it('queued, stuck, working, blocked, a read with no tags, or no ask at all: the step folds like any other', () => {
    for (const t of [task({}), task({ requested_at: '2026-09-28T15:00:00Z' }), task({ status: 'working' }), task({ status: 'blocked' }), task({ status: 'ready', result: { rows: [] } })]) expect(scheduleReadHoldsStepOpen(t)).toBe(false)
    expect(scheduleReadHoldsStepOpen(null)).toBe(false)
  })
})
