// @vitest-environment jsdom
/**
 * Messages, cut 2: the who-has-it pill (v2.5289). Its words for nobody, me and a teammate, the picker's rows with what
 * each teammate holds open, and a pick that hands it on, puts it back, or changes nothing. The people are the
 * prototype's demo people.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FollowUpContact } from '../../lib/followUp/followUpRows'
import type { QueueContact } from '../../lib/followUp/queue'
import { OFFICE_HOURS, type OfficeHours } from '../../lib/messages/hasRule'
import { WhoHasItPill, type Teammate, type WhoHasItPillProps } from './WhoHasItPill'

afterEach(cleanup)

const ME: Teammate = { id: 'u-robert', name: 'Robert', role: 'estimator' }
const ROSA: Teammate = { id: 'u-rosa', name: 'Rosa', role: 'assistant' }

const greg = (patch: Partial<FollowUpContact> = {}): FollowUpContact => ({
  id: 'greg',
  kind: 'trade',
  name: 'Greg Paulk',
  company: 'Hillside Excavation',
  state: 'waiting',
  has: null,
  hasUserId: null,
  hasSince: null,
  hasHow: null,
  ...patch,
})

/** Rosa holds Priya open; Elena is done, so she is not counted. */
const EVERYONE: QueueContact[] = [
  greg(),
  { id: 'priya', kind: 'customer', name: 'Dr. Priya Raman', state: 'waiting', has: 'Rosa' },
  { id: 'elena', kind: 'customer', name: 'Elena Marchetti', state: 'done', has: 'Rosa' },
]

function renderPill(contact: FollowUpContact, over: Partial<WhoHasItPillProps> = {}) {
  const onHand = vi.fn()
  render(<WhoHasItPill contact={contact} me={ME} team={[ME, ROSA]} everyone={EVERYONE} todayYmd="2026-10-02" nowIso="2026-10-02T17:00:00.000Z" onHand={onHand} {...over} />)
  return onHand
}

describe('WhoHasItPill', () => {
  it('nobody has it: take it, or hand it to a teammate with what they hold', () => {
    const onHand = renderPill(greg())
    fireEvent.click(screen.getByRole('button', { name: 'Nobody has it · Take it' }))
    expect(screen.getByText('Nobody has Greg Paulk yet. Hand it to:')).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: /^I'll take it/ }).textContent).toContain('So nobody else answers it too.')
    expect(screen.getByRole('menuitemradio', { name: /^Rosa/ }).textContent).toContain('office · holds 1 waiting')
    expect(screen.queryByRole('menuitemradio', { name: /^Nobody/ })).toBeNull()

    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Rosa/ }))
    expect(onHand).toHaveBeenCalledWith('u-rosa')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('a teammate has it: take it from them or put it back, and picking them again changes nothing', () => {
    const onHand = renderPill(greg({ has: 'Rosa', hasUserId: 'u-rosa', hasSince: '2026-09-26T19:30:00.000Z', hasHow: 'took' }))
    const pill = screen.getByRole('button', { name: 'Rosa has this' })
    expect(pill.getAttribute('title')).toMatch(/^Rosa claimed it, so nobody else answers it\. Since .+\.$/)

    fireEvent.click(pill)
    expect(screen.getByRole('menuitemradio', { name: /^I'll take it/ }).textContent).toContain('Rosa sees it move to you. The thread says so.')
    expect(screen.getByRole('menuitemradio', { name: /^Rosa/ }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Rosa/ }))
    expect(onHand).not.toHaveBeenCalled()

    fireEvent.click(pill)
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Nobody/ }))
    expect(onHand).toHaveBeenCalledWith(null)
  })

  it('mine: no row to take it, and a press outside closes the picker', () => {
    renderPill(greg({ has: 'Robert', hasUserId: 'u-robert', hasSince: '2026-10-02T15:00:00.000Z', hasHow: 'took' }))
    fireEvent.click(screen.getByRole('button', { name: 'You have this' }))
    expect(screen.getByRole('menu', { name: 'Who has Greg Paulk' })).toBeTruthy()
    expect(screen.queryByRole('menuitemradio', { name: /^I'll take it/ })).toBeNull()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('waits while its press runs', () => {
    renderPill(greg(), { busy: true })
    expect((screen.getByRole('button', { name: 'Nobody has it · Take it' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('bare, in the thread header (v2.5542): the header control class in place of the border; a row keeps its border', () => {
    renderPill(greg(), { bare: true })
    const bare = screen.getByRole('button', { name: 'Nobody has it · Take it' })
    expect(bare.className).toBe('thread-head-control')
    expect(bare.style.border).toBe('')
    cleanup()
    renderPill(greg())
    const row = screen.getByRole('button', { name: 'Nobody has it · Take it' })
    expect(row.className).toBe('')
    expect(row.style.border).toContain('1px solid')
  })
})

/** Mon to Fri, 6 AM to 8 PM, as the mock-up's example person set it; Chicago, Wednesday 2026-10-28 at 11 PM (CDT). */
const WEEKDAYS: OfficeHours = { ...OFFICE_HOURS, days: [1, 2, 3, 4, 5], opens: '06:00', closes: '20:00', always: false }
const LATE_WED = '2026-10-29T04:00:00.000Z'

describe('WhoHasItPill: who is off (v2.6060, punch list #141 PR 4)', () => {
  it('says the holder is off until their hours open, and what that means', () => {
    renderPill(greg({ has: 'Rosa', hasUserId: 'u-rosa' }), { pushHours: new Map([['u-rosa', WEEKDAYS]]), nowIso: LATE_WED })
    const pill = screen.getByRole('button', { name: 'Rosa has this · off until 6 AM' })
    expect(pill.title).toBe('Rosa has the replies and is off until 6 AM. The office hears at once. Rosa sees what waited on their Dashboard at 6 AM.')
  })

  it('says you are off when it is yours and your hours are closed', () => {
    renderPill(greg({ has: 'Robert', hasUserId: 'u-robert' }), { pushHours: new Map([['u-robert', WEEKDAYS]]), nowIso: LATE_WED })
    const pill = screen.getByRole('button', { name: 'You have this · off until 6 AM' })
    expect(pill.title).toBe('You are off until 6 AM, so a push waits for you. The office hears at once. Your Dashboard lists what waited.')
  })

  it('with nobody holding it and every office member off, says the office is off, and still takes a press', () => {
    const onHand = renderPill(greg(), { pushHours: new Map([['u-robert', WEEKDAYS], ['u-rosa', WEEKDAYS]]), nowIso: LATE_WED })
    const pill = screen.getByRole('button', { name: 'Nobody has it · the office is off until 6 AM' })
    expect(pill.title).toBe('Everyone in the office is off until 6 AM. The reply waits on Needs a reply. Each of them sees it on their Dashboard at 6 AM. Press to take it or hand it to someone.')
    fireEvent.click(pill)
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^I'll take it/ }))
    expect(onHand).toHaveBeenCalledWith('u-robert')
  })

  it('reads as before while the holder is on, when a member has no row, and without the hours', () => {
    renderPill(greg({ has: 'Rosa', hasUserId: 'u-rosa' }), { pushHours: new Map([['u-rosa', WEEKDAYS]]), nowIso: '2026-10-28T15:00:00.000Z' })
    expect(screen.getByRole('button', { name: 'Rosa has this' })).toBeTruthy()
    cleanup()
    // Robert has no row: pushed any time, so the office is never off.
    renderPill(greg(), { pushHours: new Map([['u-rosa', WEEKDAYS]]), nowIso: LATE_WED })
    expect(screen.getByRole('button', { name: 'Nobody has it · Take it' })).toBeTruthy()
    cleanup()
    renderPill(greg({ has: 'Rosa', hasUserId: 'u-rosa' }), { nowIso: LATE_WED })
    expect(screen.getByRole('button', { name: 'Rosa has this' })).toBeTruthy()
  })
})
