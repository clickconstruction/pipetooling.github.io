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
})
