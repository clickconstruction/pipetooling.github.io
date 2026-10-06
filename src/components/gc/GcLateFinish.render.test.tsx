// @vitest-environment jsdom
/**
 * Render smoke for the contract's late days (the Gantt's G-98; mock-up `to-dos/gc-mode/mockups/G-98.md`):
 * the Schedule tab's Projected finish measure, Bill the customer's Finish date card and the
 * customer's schedule say the same days from one call, and a move that changes the finish moves all
 * three together.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { GcBuildingScheduleTab } from './GcBuildingSchedule'
import { GcOwnerBillingFinish } from './GcOwnerBillingFinish'
import { GcCustomerSchedule } from './GcCustomerSchedule'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { addDays } from '../../lib/gcMode/gcBuilding'
import { scheduleMeasures } from '../../lib/gcMode/gcBuildingSchedule'
import type { GcState, ScheduleMoveReason } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
  }
})

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
/** The newest change order on the job. `Array.at` is not in the build's target. */
const lastOrder = (s: GcState) => {
  const all = job(s).changeOrders ?? []
  return all[all.length - 1]!
}
const noop = () => undefined

function moveBy(s: GcState, label: string, days: number, reason: ScheduleMoveReason, note: string): GcState {
  const a = scheduleMeasures(s, job(s)).items.find((i) => i.label === label)!.activity
  return gcReducer(s, { type: 'setScheduleActivity', projectId: ID, lineId: a.lineId, start: addDays(a.start, days), finish: addDays(a.finish, days), after: a.after, why: { reason, note, by: 'Robert' } })
}

/** Trim waits a week on the customer, rain holds Test and balance, change order 1 adds a day, the fee is $500 a day. */
function lateJob(): GcState {
  let s = moveBy(initialGcState(), 'Trim', 7, 'customer', 'Waiting on the restroom tile decision.')
  s = moveBy(s, 'Test and balance', 9, 'weather', 'Rain kept the roof open a week.')
  s = gcReducer(s, { type: 'draftChangeOrder', projectId: ID, description: 'A larger roof curb for RTU-2', reason: 'plans', schedule: '', packageId: null, cost: 4_200, price: 0, days: 1 })
  const co = lastOrder(s)
  s = gcReducer(s, { type: 'sendChangeOrder', projectId: ID, changeOrderId: co.id })
  s = gcReducer(s, { type: 'ownerSignChangeOrder', projectId: ID, changeOrderId: co.id })
  return gcReducer(s, { type: 'setOwnerLateFinish', projectId: ID, perDay: 500 })
}

/** What each surface says, drawn on its own. */
function surfaces(s: GcState) {
  const schedule = render(<GcBuildingScheduleTab state={s} project={job(s)} dispatch={noop} />)
  const scheduleText = schedule.container.textContent ?? ''
  // The measure's chip on its own: the page's text runs the finish date into it.
  const chip = screen.queryAllByText(/^\d+ days? past the contract$/)[0]?.textContent ?? null
  cleanup()
  const bill = render(<GcOwnerBillingFinish state={s} project={job(s)} dispatch={noop} />)
  const billText = bill.container.textContent ?? ''
  cleanup()
  const customer = render(<GcCustomerSchedule state={s} project={job(s)} />)
  const customerText = customer.container.textContent ?? ''
  cleanup()
  return { scheduleText, billText, customerText, chip }
}

describe('the contract’s late days on three surfaces', () => {
  it('the Schedule tab’s measure has the money, whose days and the change order; Bill the customer and the customer agree', () => {
    const { scheduleText, billText, customerText } = surfaces(lateJob())
    expect(scheduleText).toContain('3 days past the contract')
    expect(scheduleText).toContain('At $500 a day, the 3 days cost $1,500.')
    expect(scheduleText).toContain("All 3 are the customer's: a change order for them would save $1,500.")
    expect(scheduleText).toContain('Change order 1 moved the contract 1 day, signed Fri Oct 2.')
    expect(billText).toContain('3 days past the contract')
    expect(billText).toContain('$1,500 at risk')
    expect(billText).toContain("All 3 are the customer's: a change order for them would save $1,500.")
    expect(billText).toContain('Change order 1 moved the contract 1 day, signed Fri Oct 2.')
    expect(customerText).toContain('We expect to finish Tue Dec 15, 3 days past the Dec 12 in your contract.')
    expect(customerText).toContain('Those 3 days came from a decision we were waiting on from you.')
    expect(customerText).not.toMatch(/\$500|\$1,500/)
  })

  it('a move that changes the finish moves all three together', () => {
    const later = moveBy(lateJob(), 'Test and balance', 5, 'crew', 'The balancer comes a week later.')
    const { scheduleText, billText, customerText, chip } = surfaces(later)
    const days = Number(/^(\d+) days past the contract$/.exec(chip ?? '')?.[1])
    expect(days).toBeGreaterThan(3)
    expect(billText).toContain(`${days} days past the contract`)
    expect(scheduleText).toContain(`At $500 a day, the ${days} days cost $${(days * 500).toLocaleString('en-US')}.`)
    expect(customerText).toMatch(new RegExp(`, ${days} days past the Dec 12 in your contract\\.`))
    expect(customerText).toContain(`We are working to make up the other ${days - 5}.`)
  })

  it('the fixture says nothing new: no days past, no fee, no change orders', () => {
    const { scheduleText, customerText } = surfaces(initialGcState())
    expect(scheduleText).toContain('no days to spare')
    expect(scheduleText).not.toContain('late fee')
    expect(scheduleText).not.toContain('Change order')
    expect(customerText).not.toContain('came from')
  })
})
