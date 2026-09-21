// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const rpc = vi.fn()
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (name: string, args: unknown) => rpc(name, args) } }))

import QuickTimeAddSheet from './QuickTimeAddSheet'

const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const words = () => screen.getByLabelText('Who, and what about') as HTMLInputElement
const go = () => screen.getByRole('button', { name: /^Add/ }) as HTMLButtonElement

// Midday on the company calendar. The rules are about "today", so a test that reads the wall clock
// fails for ten minutes either side of midnight Central — which is how this was found (a full
// local gate that ran across midnight). Only Date is faked: timers stay real for waitFor.
const NOON = Date.UTC(2026, 8, 21, 17, 0, 0)

describe('QuickTimeAddSheet — the composer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOON)
    rpc.mockReset()
    rpc.mockResolvedValue({ data: { id: 's1' }, error: null })
  })
  afterEach(() => vi.useRealTimers())

  it('＋5, ＋5, a few words — and the button says the number back', async () => {
    const onAdded = vi.fn()
    const onClose = vi.fn()
    renderWithProviders(<QuickTimeAddSheet open onClose={onClose} sessions={[]} onAdded={onAdded} />)
    expect(go().textContent).toBe('Add time')
    expect(go().disabled).toBe(true)

    press('＋5')
    press('＋5')
    expect(go().textContent).toBe('Add 10 min — say what it was')
    expect(go().disabled).toBe(true)
    expect(screen.getByRole('button', { name: '10 minutes' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '15 minutes' }).getAttribute('aria-pressed')).toBe('false')

    press('Email')
    fireEvent.change(words(), { target: { value: '  Riverside, the revised proposal ' } })
    expect(go().textContent).toBe('Add 10 min')
    expect(go().disabled).toBe(false)
    press('Add 10 min')

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith({ minutes: 10, note: 'Email — Riverside, the revised proposal' }))
    expect(rpc).toHaveBeenCalledTimes(1)
    const [name, args] = rpc.mock.calls[0] as [string, { p_minutes: number; p_note: string; p_ended_at: string }]
    expect(name).toBe('add_quick_time')
    expect(args.p_minutes).toBe(10)
    expect(args.p_note).toBe('Email — Riverside, the revised proposal')
    expect(Math.abs(Date.parse(args.p_ended_at) - Date.now())).toBeLessThan(5_000) // ended just now
    expect(onClose).toHaveBeenCalled()
  })

  it('a cell jumps there, the lit last cell steps back, and ＋5 goes quiet at 30', () => {
    renderWithProviders(<QuickTimeAddSheet open onClose={() => {}} sessions={[]} onAdded={() => {}} />)
    press('25 minutes')
    expect(go().textContent).toBe('Add 25 min — say what it was')
    press('25 minutes')
    expect(go().textContent).toBe('Add 20 min — say what it was')
    press('30 minutes')
    expect((screen.getByRole('button', { name: '＋5' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('"ended 1 h ago" moves the window, and never lands on hours already there', () => {
    const now = Date.now()
    const shift = { clocked_in_at: new Date(now - 70 * 60_000).toISOString(), clocked_out_at: new Date(now - 50 * 60_000).toISOString() }
    renderWithProviders(<QuickTimeAddSheet open onClose={() => {}} sessions={[shift]} onAdded={() => {}} />)
    press('10 minutes')
    fireEvent.change(words(), { target: { value: 'Acme, the invoice' } })
    expect(go().disabled).toBe(false) // just now is clear of a session that ended 50 minutes ago

    press('just now')
    press('1 h ago') // 70–60 minutes ago sits inside the 70–50 session
    expect(go().disabled).toBe(true)
    expect(screen.getByRole('alert').textContent).toMatch(/^You already have hours .* Pick an end time outside that, or edit that day on My Time\.$/)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('shows the database’s own sentence when it refuses, and stays open', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'That would be 125 minutes of quick adds today (the most is 120). If you are working a stretch, clock in instead.', code: 'P0001' } })
    const onClose = vi.fn()
    renderWithProviders(<QuickTimeAddSheet open onClose={onClose} sessions={[]} onAdded={() => {}} />)
    press('5 minutes')
    fireEvent.change(words(), { target: { value: 'One more call' } })
    press('Add 5 min')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('the most is 120'))
    expect(rpc).toHaveBeenCalledTimes(1) // never retried: a landed first try would make the retry an overlap refusal
    expect(onClose).not.toHaveBeenCalled()
  })

  it('just after midnight a window that starts yesterday is refused — it points at My Time', () => {
    vi.setSystemTime(Date.UTC(2026, 8, 21, 5, 4, 0)) // 12:04 am Central
    renderWithProviders(<QuickTimeAddSheet open onClose={() => {}} sessions={[]} onAdded={() => {}} />)
    press('10 minutes') // 11:54 pm – 12:04 am
    fireEvent.change(words(), { target: { value: 'Late call with Acme' } })
    expect(go().disabled).toBe(true)
    expect(screen.getByRole('alert').textContent).toBe('Quick time is for today. For another day, use My Time.')
    press('10 minutes') // the lit last cell steps back to 5: 11:59 pm – 12:04 am still starts yesterday
    expect(go().disabled).toBe(true)
  })

  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(<QuickTimeAddSheet open={false} onClose={() => {}} sessions={[]} onAdded={() => {}} />)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})
