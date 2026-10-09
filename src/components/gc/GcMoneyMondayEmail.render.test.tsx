// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GcMoneyMondayEmail, type MoneyMondayIo } from './GcMoneyMondayEmail'
import { chicagoWeekdayAndTime } from '../../lib/gcStatementStandingCopies'
import type { MoneyMondayRequestRow } from '../../lib/gc/moneyMondayEmail'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()
afterEach(cleanup)

// 12:00 UTC in October is 7:00 AM Central: mine on Mondays, Grace's on Mondays and Thursdays.
const ROWS: MoneyMondayRequestRow[] = [
  { id: 'a', requested_by: 'me', recipient_user_id: 'me', send_at: '2026-10-12T12:00:00Z', repeat_weekly: true },
  { id: 'b', requested_by: 'me', recipient_user_id: 'grace', send_at: '2026-10-12T12:00:00Z', repeat_weekly: true },
  { id: 'c', requested_by: 'me', recipient_user_id: 'grace', send_at: '2026-10-15T12:00:00Z', repeat_weekly: true },
]

function setup(io: Partial<MoneyMondayIo> = {}) {
  const full: MoneyMondayIo = {
    list: vi.fn(async () => ROWS),
    apply: vi.fn(async () => undefined),
    preview: vi.fn(async () => ({ subject: 'Our GC money, Mon Oct 12', html: '<p>Customers owe us $62,000 on 3 bills.</p>' })),
    test: vi.fn(async () => undefined),
    ...io,
  }
  render(<GcMoneyMondayEmail me={{ id: 'me', name: 'Robert' }} team={[{ id: 'me', name: 'Robert' }, { id: 'grace', name: 'Grace' }]} io={full} />)
  return full
}

describe('GcMoneyMondayEmail', () => {
  it('says who gets it and when, and stops one person’s', async () => {
    const io = setup()
    expect(await screen.findByText('You get it on Mon at 7:00 AM.')).toBeTruthy()
    expect(screen.getByText('Grace gets it on Mon and Thu at 7:00 AM.')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Stop it' })[1]!)
    await waitFor(() => expect(io.apply).toHaveBeenCalledWith({ inserts: [], cancelIds: ['b', 'c'] }))
    expect(io.list).toHaveBeenCalledTimes(2)
  })

  it('adds a day for me as its own weekly chain', async () => {
    const io = setup()
    await screen.findByText('You get it on Mon at 7:00 AM.')
    fireEvent.click(screen.getByRole('button', { name: 'Wed' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(io.apply).toHaveBeenCalledTimes(1))
    const plan = (io.apply as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { inserts: Omit<MoneyMondayRequestRow, 'id'>[]; cancelIds: string[] }
    expect(plan.cancelIds).toEqual([])
    expect(plan.inserts.map((i) => [i.recipient_user_id, i.requested_by, i.repeat_weekly, chicagoWeekdayAndTime(i.send_at)])).toEqual([['me', 'me', true, { dow: 3, timeHm: '07:00' }]])
    expect(await screen.findByText('Saved.')).toBeTruthy()
  })

  it('shows Grace’s days when she is picked, and starts someone new on Monday at 7', async () => {
    setup({ list: vi.fn(async () => ROWS.slice(1)) })
    await screen.findByText('Grace gets it on Mon and Thu at 7:00 AM.')
    const pressed = () => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].filter((d) => screen.getByRole('button', { name: d }).getAttribute('aria-pressed') === 'true')
    expect(pressed()).toEqual(['Mon'])
    const who = screen.getByLabelText('Who gets the Monday money email')
    fireEvent.change(who, { target: { value: 'grace' } })
    expect(pressed()).toEqual(['Mon', 'Thu'])
    fireEvent.change(who, { target: { value: 'me' } })
    expect(pressed()).toEqual(['Mon'])
    expect((screen.getByLabelText('The time it goes') as HTMLInputElement).value).toBe('07:00')
  })

  it('draws the email as it would go now, and sends me a test', async () => {
    const io = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'See the email as it would go now' }))
    expect(await screen.findByTitle('The Monday money email')).toBeTruthy()
    expect(screen.getByText('Our GC money, Mon Oct 12')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Email me a test' }))
    await waitFor(() => expect(io.test).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('A test went to your email.')).toBeTruthy()
  })

  it('says why when the requests do not load', async () => {
    setup({ list: vi.fn(async () => Promise.reject(new Error('Could not load the Monday emails: network'))) })
    expect((await screen.findByRole('alert')).textContent).toBe('Could not load the Monday emails: network')
    expect(screen.getByText('Nobody gets it yet.')).toBeTruthy()
  })
})
