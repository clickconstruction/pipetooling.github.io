// @vitest-environment jsdom
/**
 * Render smoke for the counts (`to-dos/gc-mode/mockups/counts.md`): the board row's people card
 * carries Pecan Valley Electric's schedule reasons, the row's schedule block goes red with the days
 * past the contract, and a trade's bench says when it told us ahead of the day.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcPeoplePill } from './GcPeoplePill'
import { GcBuildingScheduleBlock } from './GcBuildingSchedule'
import { GcPartnersBoard } from './GcTradeBench'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { addDays } from '../../lib/gcMode/gcBuilding'
import { projectPeople } from '../../lib/gcMode/gcProjectPeople'
import { pastContract } from '../../lib/gcMode/gcCounts'
import type { GcState, ScheduleMoveReason } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
  }
})

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const s0 = initialGcState()

function moveBy(s: GcState, lineId: string, days: number, reason: ScheduleMoveReason): GcState {
  const a = job(s).schedule!.activities.find((x) => x.lineId === lineId)!
  return gcReducer(s, { type: 'setScheduleActivity', projectId: ID, lineId, start: addDays(a.start, days), finish: addDays(a.finish, days), after: a.after, why: { reason, note: 'The late job, as G-98 plays it.', by: 'Robert' } })
}

describe('the board row', () => {
  it("the people card says Pecan Valley's insurance at work and the bars that wait on it, still two to call", () => {
    render(<GcPeoplePill summary={projectPeople(s0, job(s0))} projectName="Fair Oaks Shops, Building D" onFollowUp={() => undefined} onWorkList={() => undefined} onOpenFollowUp={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: /Show who and why\./ }))
    expect(screen.getByText('Their insurance ran out Tue Sep 15. Nothing they do for us is covered. They are at work on Panels and feeders, and Lighting.')).toBeTruthy()
    expect(screen.getByText('Site lighting and Fire alarm wait on current insurance. Site lighting starts Mon Oct 19.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^2 to call/ })).toBeTruthy()
  })

  it('the schedule block goes red with the days past the contract, and says the finish on its hover', () => {
    const late = gcReducer(moveBy(moveBy(s0, 'fplumb-4', 7, 'customer'), 'fhvac-4', 9, 'weather'), { type: 'setOwnerLateFinish', projectId: ID, perDay: 500 })
    const past = pastContract(late, job(late))
    const { container } = render(<GcBuildingScheduleBlock project={job(late)} today={late.today} box={{}} pastContract={past} />)
    expect(container.querySelector('[data-gc-past-contract]')?.textContent).toBe('4 days past contract')
    const block = container.firstElementChild as HTMLElement
    expect(block.getAttribute('title')).toMatch(/It finishes Tue Dec 15, 4 days past the contract's Fri Dec 11\./)
    expect(block.style.background).toBe('var(--bg-red-100)')
    cleanup()
    // On time, the block keeps its milestones line.
    const { container: onTime } = render(<GcBuildingScheduleBlock project={job(s0)} today={s0.today} box={{}} pastContract={pastContract(s0, job(s0))} />)
    expect(onTime.querySelector('[data-gc-past-contract]')).toBeNull()
    expect(onTime.textContent).toMatch(/milestones/)
  })
})

describe('the bench', () => {
  it('a trade that told us ahead of the day has it on its line', () => {
    const told = gcReducer(s0, { type: 'tradeSayLate', projectId: ID, partnerId: 'summit', lineId: 'froof-1', day: '2026-10-14', reason: 'materials', note: 'The membrane ships Oct 12. We finish two days after it lands.' })
    const { container } = render(<GcPartnersBoard state={told} dispatch={() => undefined} onOpenProject={() => undefined} onFollowUp={() => undefined} />)
    expect(container.querySelector('[data-gc-told-ahead="summit"]')?.textContent).toBe('Told us it would be late before the day, 1 time.')
    cleanup()
    const { container: none } = render(<GcPartnersBoard state={s0} dispatch={() => undefined} onOpenProject={() => undefined} onFollowUp={() => undefined} />)
    expect(none.querySelector('[data-gc-told-ahead]')).toBeNull()
  })
})
