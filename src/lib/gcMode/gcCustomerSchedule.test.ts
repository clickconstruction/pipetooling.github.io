import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { addDays } from './gcBuilding'
import type { GcState } from './gcTypes'
import { customerAsks, customerChanges, customerStages, customerStanding } from './gcCustomerSchedule'
import { customerFullChart, customerMaySeeEveryBar } from './gcCustomerSchedule'
import { CUSTOMER_NOTHING_MOVED, CUSTOMER_STAGE_WORDS, customerBarWords, customerDoneWords, customerSchedulePicture } from './gcCustomerSchedule'

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

  it('asks for the change orders waiting on their signature, and the decisions they owe', () => {
    const state = initialGcState()
    const asks = customerAsks(job(state))
    expect(asks.every((a) => a.words.startsWith('Your signature on change order') || a.words.startsWith('Your decision on'))).toBe(true)
    expect(asks.some((a) => a.words.startsWith('Your decision on the restroom tile'))).toBe(true)
  })
})

describe('a GC or owner’s rep customer may see every bar (call 3, the owner’s OK 2026-10-06)', () => {
  it('is offered to them only, as the List view with the names of the work', () => {
    const state = initialGcState()
    const project = job(state)
    expect(customerMaySeeEveryBar(project)).toBe(false)
    expect(customerMaySeeEveryBar({ ...project, customerRole: 'gc' })).toBe(true)
    expect(customerMaySeeEveryBar({ ...project, customerRole: 'ownersRep' })).toBe(true)
    const groups = customerFullChart(state, project)
    expect(groups.length).toBeGreaterThan(0)
    expect(groups[0]?.now).toBe(true)
    expect(groups.flatMap((g) => g.group.bars).length).toBe(project.schedule!.activities.length)
  })
})

describe('the customer’s words in one place: the portal, the letter and the printed copy (G-21)', () => {
  it('says a stage, a bar and the work done one way', () => {
    const state = initialGcState()
    const project = job(state)
    expect(CUSTOMER_STAGE_WORDS).toEqual({ done: 'done', underway: 'under way', behind: 'behind', notStarted: 'not started' })
    expect(CUSTOMER_NOTHING_MOVED).toBe('Nothing moved. The schedule stands as planned.')
    expect(customerDoneWords(customerStanding(state, project))).toBe('72% of the work is done. We planned 76% by today.')
    const bars = customerFullChart(state, project).flatMap((g) => g.group.bars)
    const of = (status: string) => {
      const b = bars.find((x) => x.status === status)
      if (!b) throw new Error(`no ${status} bar on Fair Oaks D`)
      return b
    }
    expect(customerBarWords(of('onTrack'))).toEqual({ words: 'on plan', tone: 'grey' })
    expect(customerBarWords(of('notStarted'))).toEqual({ words: 'not started', tone: 'grey' })
    expect(customerBarWords(of('failed'))).toEqual({ words: 'failed', tone: 'red' })
  })

  it('gathers the picture the printed copy draws: the stages for an owner, every bar for a GC or an owner’s rep', () => {
    const state = initialGcState()
    const project = job(state)
    const owner = customerSchedulePicture(state, project)
    expect(owner).toMatchObject({ name: 'Cibolo Creek Partners', everyBar: false, fullChart: [], doneWords: '72% of the work is done. We planned 76% by today.' })
    expect(owner.stages).toEqual(customerStages(state, project))
    expect(owner.changes).toEqual(customerChanges(project, state.today))
    expect(owner.asks).toEqual(customerAsks(project).map((a) => a.words))
    const gc = customerSchedulePicture(state, { ...project, customerRole: 'gc' })
    expect(gc.everyBar).toBe(true)
    expect(gc.fullChart).toEqual(customerFullChart(state, { ...project, customerRole: 'gc' }))
  })
})
