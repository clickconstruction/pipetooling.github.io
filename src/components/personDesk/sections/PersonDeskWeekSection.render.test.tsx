// @vitest-environment jsdom
/**
 * The desk's Your week picker (punch list #255, v2.6589): the office picks a signal and the role's guess is named; No
 * card clears it; a training account reads; a crew lead sees nothing; a refused press names its reason.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PersonDeskViewer } from '../../../lib/people/personDeskGates'
import type { WeekSignal } from '../../../lib/techWeek/weekSignal'
import type { WeekSignalIo } from '../../../lib/techWeek/weekSignalIo'
import { PersonDeskWeekSection } from './PersonDeskWeekSection'

const viewer = (p: Partial<PersonDeskViewer> = {}): PersonDeskViewer => ({ role: 'assistant', isDev: false, canAccessPay: true, canAccessHours: true, canAccessVehicles: true, canAccessLicenses: true, canAccessContracts: true, readOnly: false, ...p })

function ioWith(initial: WeekSignal | null, fail?: string): WeekSignalIo & { set: ReturnType<typeof vi.fn> } {
  return {
    read: vi.fn(async () => initial),
    set: vi.fn(async () => {
      if (fail) throw new Error(fail)
    }),
  }
}

afterEach(cleanup)

describe('PersonDeskWeekSection', () => {
  it('names the role’s guess with no signal, and a press saves the pick', async () => {
    const io = ioWith(null)
    render(<PersonDeskWeekSection userId="u-jordan" displayName="Jordan Price" personRole="helpers" viewer={viewer()} changeKey={0} io={io} />)
    expect(await screen.findByText('No signal picked yet, so no Your week card. Suggested: License hours.')).toBeTruthy()
    expect(screen.getByText('The one number Jordan sees move on Your week.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'License hours' }))
    await waitFor(() => expect(io.set).toHaveBeenCalledWith('u-jordan', 'license_hours'))
    expect((await screen.findByRole('button', { name: 'License hours' })).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'No card' }))
    await waitFor(() => expect(io.set).toHaveBeenCalledWith('u-jordan', null))
  })

  it('a training account reads the pick and presses nothing; a crew lead sees no section', async () => {
    render(<PersonDeskWeekSection userId="u" displayName="Marcus Lee" personRole="primary" viewer={viewer({ role: 'dev', readOnly: true })} changeKey={0} io={ioWith('jobs_without_callback')} />)
    const b = (await screen.findByRole('button', { name: 'Jobs without a callback' })) as HTMLButtonElement
    expect(b.getAttribute('aria-pressed')).toBe('true')
    expect(b.disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'No card' })).toBeNull()
    cleanup()
    const { container } = render(<PersonDeskWeekSection userId="u" displayName="Marcus Lee" personRole="primary" viewer={viewer({ role: 'primary' })} changeKey={0} io={ioWith(null)} />)
    expect(container.innerHTML).toBe('')
  })

  it('a refused press names its reason', async () => {
    render(<PersonDeskWeekSection userId="u" displayName="Luis Ortega" personRole="superintendent" viewer={viewer()} changeKey={0} io={ioWith(null, 'Only the leader and the office pick a week signal.')} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Crew hours against target' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Only the leader and the office pick a week signal.')
  })
})
