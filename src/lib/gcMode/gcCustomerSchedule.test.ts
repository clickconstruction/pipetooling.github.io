import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { addDays } from './gcBuilding'
import type { GcState } from './gcTypes'
import { customerAsks, customerChanges, customerStages, customerStanding } from './gcCustomerSchedule'

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!

describe("the customer's schedule", () => {
  it('rolls the job up to its stages, in order, with no company names', () => {
    const state = initialGcState()
    const stages = customerStages(state, job(state))
    expect(stages.length).toBeGreaterThan(3)
    expect(stages[0]?.label).toBe('Site prep')
    expect(stages.some((s) => s.label === 'Inspections')).toBe(false)
    expect(stages.every((s) => s.start <= s.finish)).toBe(true)
    expect(stages.some((s) => s.state === 'done')).toBe(true)
    expect(stages.some((s) => s.state === 'behind')).toBe(true)
    expect(JSON.stringify(stages)).not.toContain('Summit Roofing')
  })

  it('says the finish against the contract, and the next date they will care about', () => {
    const state = initialGcState()
    const s = customerStanding(state, job(state))
    expect(s.finish).toBe('2026-12-11')
    expect(s.contract).toBe('2026-12-11')
    expect(s.late).toBe(0)
    expect(s.finishWords).toBe('We finish Fri Dec 11. Your contract says Dec 11.')
    expect(s.donePct).toBe(72)
    expect(s.next?.milestone.label).toBe('Dry-in')
  })

  it('tells what changed this week by stage and reason, never by company', () => {
    const state = initialGcState()
    expect(customerChanges(job(state), state.today)).toEqual([])
    const tpoId = job(state).packages.flatMap((k) => k.sow?.sov ?? []).find((l) => l.label === 'TPO membrane')!.id
    const a = job(state).schedule!.activities.find((x) => x.lineId === tpoId)!
    const moved = gcReducer(state, { type: 'setScheduleActivity', projectId: ID, lineId: a.lineId, start: addDays(a.start, 7), finish: addDays(a.finish, 7), after: a.after, why: { reason: 'weather', note: 'Rain stopped the roof.', by: 'Robert' } })
    const [line] = customerChanges(job(moved), moved.today)
    expect(line).toBe('Dry-in is 7 days later than planned, because of the weather. The finish holds.')
    expect(line).not.toContain('Summit')
    // A week on, it is no longer this week's news.
    expect(customerChanges(job(moved), addDays(moved.today, 8))).toEqual([])
  })

  it('asks for the change orders waiting on their signature', () => {
    const state = initialGcState()
    const asks = customerAsks(job(state))
    expect(asks.every((a) => a.words.startsWith('Your signature on change order'))).toBe(true)
  })
})
