// @vitest-environment jsdom
/**
 * Render smoke for By company as a call list (the Gantt's G-115; mock-up
 * `to-dos/gc-mode/mockups/G-115.md`): the call form's answer on new dates, which plays the prototype's
 * reducer and its Follow up sheet. The tests that draw the list alone and the opened bar's company
 * moved to main word for word with the schedule's 7c-ii (`GcCallList.render.test.tsx`, #5164).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcFollowUpSheet } from './GcFollowUpSheet'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { addDays } from '../../lib/gcMode/gcBuilding'
import { scheduleMeasures } from '../../lib/gcMode/gcBuildingSchedule'
import { callListFollowPeople } from '../../lib/gcMode/gcCallList'
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
