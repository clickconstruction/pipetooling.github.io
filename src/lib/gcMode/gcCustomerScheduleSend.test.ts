import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import type { GcState } from './gcTypes'
import { customerScheduleHtml, customerScheduleLetter, scheduleSends } from './gcCustomerScheduleSend'

const ID = 'fairoaksd'
const job = (state: GcState) => state.projects.find((p) => p.id === ID)!

describe("the customer's schedule, sent on its own (G-94)", () => {
  it('writes the letter from the same picture their portal shows', () => {
    const state = initialGcState()
    const letter = customerScheduleLetter(state, job(state), 'Robert Douglas')
    expect(letter.to).toBe('Elena Marchetti, Cibolo Creek Partners')
    expect(letter.subject).toBe('Your schedule on Fair Oaks Shops, Building D, Oct 2')
    expect(letter.lines.slice(0, 4)).toEqual(['Hello Elena,', 'Here is where Fair Oaks Shops, Building D stands as of Fri Oct 2.', 'We finish Fri Dec 11. Your contract says Dec 11.', '72% of the work is done. We planned 76% by today.'])
    expect(letter.lines).toContain('Dry-in: Sep 25, 7 days late.')
    expect(letter.lines.some((l) => /^Rough-in: /.test(l))).toBe(true)
    expect(letter.lines).toContain('Nothing moved this week. The schedule stands as planned.')
    expect(letter.lines.slice(-2)).toEqual(['Call me with any question.', 'Robert Douglas, Click Construction'])
    const html = customerScheduleHtml(letter)
    expect(html).toContain('<title>Your schedule on Fair Oaks Shops, Building D, Oct 2</title>')
    expect(html).toContain('<p>Hello Elena,</p>')
  })

  it('keeps each send as it went, dated, newest first', () => {
    let state = initialGcState()
    expect(scheduleSends(job(state))).toEqual([])
    state = gcReducer(state, { type: 'sendCustomerSchedule', projectId: ID, by: 'Robert Douglas' })
    const [send] = scheduleSends(job(state))
    expect(send).toMatchObject({ id: 'fairoaksd-ssend-1', on: '2026-10-02', by: 'Robert Douglas', to: 'Elena Marchetti, Cibolo Creek Partners', subject: 'Your schedule on Fair Oaks Shops, Building D, Oct 2' })
    expect(send?.lines[0]).toBe('Hello Elena,')
    expect(state.log[0]?.text).toMatch(/^Robert Douglas sent Elena Marchetti, Cibolo Creek Partners the schedule on Fair Oaks Shops, Building D: \d+ lines, kept as sent\.$/)
    state = gcReducer(state, { type: 'sendCustomerSchedule', projectId: ID, by: 'Robert Douglas' })
    expect(scheduleSends(job(state)).map((s) => s.id)).toEqual(['fairoaksd-ssend-2', 'fairoaksd-ssend-1'])
    // A job with no schedule has nothing to send.
    expect(gcReducer(state, { type: 'sendCustomerSchedule', projectId: 'helotes', by: 'Robert' })).toBe(state)
  })
})
