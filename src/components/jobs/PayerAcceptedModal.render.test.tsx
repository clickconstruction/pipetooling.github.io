// @vitest-environment jsdom
/**
 * Render-smoke tests for They accepted it on… (punch list #323, PR 4): the window shows what the day
 * the bill went in makes it and what the accepted day makes it, in amber when the two differ; Save
 * hands the day to the save and closes; a day on record can be cleared; a refused save says why and
 * stays open. Every name is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { PAY_CALENDAR_DEFAULT } from '../../lib/jobs/payCalendar'

const { io } = vi.hoisted(() => ({ io: { saveInvoiceAcceptance: vi.fn() } }))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/jobs/payCalendarIo', () => io)

import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import PayerAcceptedModal from './PayerAcceptedModal'

installDomShims()

function open(over: { acceptedYmd?: string | null } = {}) {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  renderWithProviders(
    <PayerAcceptedModal invoiceId="inv-1" billLabel="1406 · Larkfield clinic, rough-in" payerName="Larkfield Construction" calendar={PAY_CALENDAR_DEFAULT} wentInYmd="2026-11-24" acceptedYmd={over.acceptedYmd ?? null} onClose={onClose} onSaved={onSaved} />,
  )
  return { onClose, onSaved }
}
const preview = () => screen.getByTestId('payer-accepted-preview')
const day = () => screen.getByLabelText('The day they accepted it') as HTMLInputElement

beforeEach(() => {
  io.saveInvoiceAcceptance.mockReset().mockResolvedValue(undefined)
})

describe('PayerAcceptedModal', () => {
  it('says what the day it went in makes the bill, and asks for the day', () => {
    open()
    expect(screen.getByRole('dialog', { name: 'They accepted it on…' })).toBeTruthy()
    expect(preview().textContent).toBe('In on Nov 24, it is due Dec 10.Pick the day to see what it makes the bill.')
    expect((screen.getByRole('button', { name: 'Save the accepted day' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Clear the accepted day' })).toBeNull()
  })

  it('shows a month lost when they accepted it past the cutoff, then saves the day and closes', async () => {
    const { onClose, onSaved } = open()
    fireEvent.change(day(), { target: { value: '2026-12-02' } })
    expect(preview().textContent).toBe('In on Nov 24, it is due Dec 10.Accepted Dec 2, it is due Jan 10.')
    fireEvent.click(screen.getByRole('button', { name: 'Save the accepted day' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(io.saveInvoiceAcceptance).toHaveBeenCalledWith(expect.anything(), { invoiceId: 'inv-1', acceptedYmd: '2026-12-02' })
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('opens on a day already on record and clears it', async () => {
    const { onClose } = open({ acceptedYmd: '2026-12-02' })
    expect(day().value).toBe('2026-12-02')
    // The same day again is nothing to save.
    expect((screen.getByRole('button', { name: 'Save the accepted day' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Clear the accepted day' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(io.saveInvoiceAcceptance).toHaveBeenCalledWith(expect.anything(), { invoiceId: 'inv-1', acceptedYmd: null })
  })

  it('stays open and says why when the save is refused', async () => {
    io.saveInvoiceAcceptance.mockRejectedValue({ message: 'Not allowed to set the day a bill was accepted' })
    const { onClose } = open()
    fireEvent.change(day(), { target: { value: '2026-11-28' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the accepted day' }))
    expect(await screen.findByText(/Not allowed to set the day a bill was accepted/)).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })
})
