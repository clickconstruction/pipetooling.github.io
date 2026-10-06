// @vitest-environment jsdom
/**
 * Render smoke for By company as a call list (the Gantt's G-115; mock-up
 * `to-dos/gc-mode/mockups/G-115.md`): a row per person with Follow up's Call and Follow up, a line
 * about a bar that opens it, Hide, the opened bar's company, and the call form's answer on new dates.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcBarCaller, GcCallList } from './GcCallList'
import { GcFollowUpSheet } from './GcFollowUpSheet'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { addDays } from '../../lib/gcMode/gcBuilding'
import { scheduleMeasures } from '../../lib/gcMode/gcBuildingSchedule'
import { barCaller, callList, callListFollowPeople } from '../../lib/gcMode/gcCallList'
import type { GcState } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

beforeAll(() => {
  // The Follow up sheet asks whether it is on a phone.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
  }
})

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const lineOf = (s: GcState, label: string) => scheduleMeasures(s, job(s)).items.find((i) => i.label === label)!.activity.lineId
/** Press a `tel:` link without jsdom trying to follow it. */
function press(link: Element) {
  link.addEventListener('click', (e) => e.preventDefault(), { once: true })
  fireEvent.click(link)
}

function list(onFollowUp = vi.fn(), onWorkList = vi.fn(), onReason = vi.fn()) {
  const state = initialGcState()
  const calls = callList(state, job(state), new Map())
  const view = render(<GcCallList list={calls} onFollowUp={onFollowUp} onWorkList={onWorkList} onReason={onReason} />)
  return { ...view, state, calls, onFollowUp, onWorkList, onReason }
}

describe('the call list', () => {
  it('has a row per person, each with Call and Follow up', () => {
    const { container, calls } = list()
    expect(screen.getByText(`${calls.count} to call about the schedule`)).toBeTruthy()
    expect(screen.getByText(`· ${calls.late} late`)).toBeTruthy()
    expect(screen.getAllByText('Follow up').length).toBe(calls.count)
    expect(container.querySelectorAll('a[href^="tel:"]').length).toBe(calls.count)
    expect(screen.getByText('Pecan Valley Electric')).toBeTruthy()
  })

  it('Call and Follow up open the sheet at the person, and Work the list from the first', () => {
    const { container, calls, onFollowUp, onWorkList } = list()
    press(container.querySelector('a[href^="tel:"]')!)
    expect(onFollowUp).toHaveBeenLastCalledWith(calls.people[0], true)
    fireEvent.click(screen.getAllByText('Follow up')[1]!)
    expect(onFollowUp).toHaveBeenLastCalledWith(calls.people[1], false)
    fireEvent.click(screen.getByText('Work the list'))
    expect(onWorkList).toHaveBeenCalledTimes(1)
  })

  it('a line about a bar opens the bar; a reason with no bar is words only', () => {
    const { state, onReason } = list()
    fireEvent.click(screen.getByText('Lighting is behind: 40% done against 48% in the plan. It is due Fri Oct 23.'))
    expect(onReason).toHaveBeenCalledWith(lineOf(state, 'Lighting'))
    expect(screen.getByText('Their insurance ran out Tue Sep 15. Nothing they do for us is covered. They are at work on Panels and feeders, and Lighting.').closest('button')).toBeNull()
  })

  it('Hide folds it to its first line, and Show brings it back', () => {
    const { calls } = list()
    fireEvent.click(screen.getByText('Hide'))
    expect(screen.queryAllByText('Follow up').length).toBe(0)
    expect(screen.getByText(`${calls.count} to call about the schedule`)).toBeTruthy()
    fireEvent.click(screen.getByText('Show'))
    expect(screen.getAllByText('Follow up').length).toBe(calls.count)
  })

  it('says so when nobody is to call', () => {
    const state = initialGcState()
    const drawing = state.projects.find((p) => p.stage !== 'building')!
    render(<GcCallList list={callList(state, drawing, new Map())} onFollowUp={vi.fn()} onWorkList={vi.fn()} onReason={vi.fn()} />)
    expect(screen.getByText('Nobody to call about the schedule.')).toBeTruthy()
  })
})

describe('the opened bar’s company', () => {
  it('says who does it, with Call and Follow up', () => {
    const state = initialGcState()
    const caller = barCaller(state, job(state), lineOf(state, 'Rooftop units'))!
    const onFollowUp = vi.fn()
    const { container } = render(<GcBarCaller caller={caller} onFollowUp={onFollowUp} />)
    expect(screen.getByText('Cool Breeze Mechanical')).toBeTruthy()
    const call = container.querySelector('a[href^="tel:"]')!
    expect(call.textContent).toBe('Call Andre')
    press(call)
    expect(onFollowUp).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getByText('Follow up'))
    expect(onFollowUp).toHaveBeenLastCalledWith(false)
  })
})

describe('the call form’s answer on new dates', () => {
  it('They work, then Save the call, answers the dates the way the portal does', () => {
    // The roof moved a month for the rain and Summit was told: its new dates wait on an answer.
    let state = initialGcState()
    const tpo = job(state).schedule!.activities.find((a) => a.lineId === lineOf(state, 'TPO membrane'))!
    state = gcReducer(state, { type: 'setScheduleActivity', projectId: ID, lineId: tpo.lineId, start: addDays(tpo.start, 30), finish: addDays(tpo.finish, 30), after: tpo.after, why: { reason: 'weather', note: 'Rain stopped the roof for a week.', by: 'Robert' } })
    const move = job(state).schedule!.moves![0]!
    state = gcReducer(state, { type: 'tellTradesMoves', projectId: ID, moveIds: [move.id], by: 'Robert' })
    const summit = state.partners.find((p) => p.company === 'Summit Roofing')!
    const dispatch = vi.fn()
    render(<GcFollowUpSheet state={state} dispatch={dispatch} startPartnerId={summit.id} startCalling onClose={vi.fn()} list={(s) => callListFollowPeople(s, job(s), new Map())} title={job(state).name} />)
    expect(screen.getByRole('group', { name: 'On the new dates' })).toBeTruthy()
    expect(screen.getByText('Save the call').closest('button')?.disabled).toBe(true)
    fireEvent.click(screen.getByText('They work'))
    fireEvent.click(screen.getByText('Save the call'))
    const sent = dispatch.mock.calls.map((c) => c[0])
    expect(sent).toContainEqual({ type: 'tradeAnswerDates', projectId: ID, partnerId: summit.id, moveId: move.id, ok: true, note: 'Said the new dates work.' })
    expect(sent.some((a) => a.type === 'logPartnerContact' && a.partnerId === summit.id)).toBe(true)
  })
})
