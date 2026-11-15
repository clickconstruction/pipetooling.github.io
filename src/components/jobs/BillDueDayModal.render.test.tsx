// @vitest-environment jsdom
/**
 * Render-smoke tests for This bill is due on… (punch list #341, PR 4): the window says what the bill
 * reads without a day of its own and what the day typed makes it; Save hands the day, the clause and
 * its words to the save, says every calendar reader to read again, and closes; a day on record fills
 * the form and can be cleared; a refused save says why and stays open. Every name is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { BillOwnDue } from '../../lib/jobs/payCalendar'

const { io } = vi.hoisted(() => ({ io: { saveInvoiceDueDay: vi.fn(), dispatchPayCalendarChanged: vi.fn() } }))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/jobs/payCalendarIo', () => io)

import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import BillDueDayModal from './BillDueDayModal'

installDomShims()

const RELEASE: BillOwnDue = { dueYmd: '2027-02-15', clause: '§ 9.4', words: 'Retainage is released 60 days after final acceptance.' }

function open(over: { stored?: BillOwnDue | null; otherwise?: { dueYmd: string; own: boolean } | null } = {}) {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  renderWithProviders(
    <BillDueDayModal
      invoiceId="inv-1"
      billLabel="1431 · Larkfield medical office"
      payerName="Larkfield Construction"
      stored={over.stored ?? null}
      otherwise={over.otherwise === undefined ? { dueYmd: '2026-12-30', own: true } : over.otherwise}
      onClose={onClose}
      onSaved={onSaved}
    />,
  )
  return { onClose, onSaved }
}
const preview = () => screen.getByTestId('bill-due-day-preview').textContent
const day = () => screen.getByLabelText('The day it is due') as HTMLInputElement
const save = () => screen.getByRole('button', { name: 'Save this bill’s due day' }) as HTMLButtonElement

beforeEach(() => {
  io.saveInvoiceDueDay.mockReset().mockResolvedValue(undefined)
  io.dispatchPayCalendarChanged.mockReset()
})

describe('BillDueDayModal', () => {
  it('says what the bill reads now, and holds the save until a day is picked', () => {
    open()
    expect(screen.getByRole('dialog', { name: 'This bill is due on…' })).toBeTruthy()
    expect(screen.getByText('1431 · Larkfield medical office · Larkfield Construction')).toBeTruthy()
    expect(preview()).toBe('By this job’s own pay calendar it is due Dec 30.Pick the day to see what it makes the bill.')
    expect(save().disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Clear this bill’s own day' })).toBeNull()
  })

  it('says what the day makes the bill, and saves the day with its clause and words', async () => {
    const { onClose, onSaved } = open()
    fireEvent.change(day(), { target: { value: '2027-02-15' } })
    expect(preview()).toBe('By this job’s own pay calendar it is due Dec 30.On its own day it is due Feb 15.')
    fireEvent.change(screen.getByLabelText('Clause number'), { target: { value: ' § 9.4 ' } })
    fireEvent.change(screen.getByLabelText('The clause in a few words'), { target: { value: 'Retainage is released 60 days after final acceptance.' } })
    fireEvent.click(save())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(io.saveInvoiceDueDay).toHaveBeenCalledWith(expect.anything(), { invoiceId: 'inv-1', dueYmd: '2027-02-15', clause: '§ 9.4', words: 'Retainage is released 60 days after final acceptance.' })
    expect(io.dispatchPayCalendarChanged).toHaveBeenCalledTimes(1)
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(screen.getByText('This bill’s due day saved.')).toBeTruthy()
  })

  it('reads the usual guess for a bill with no pay calendar under it', () => {
    open({ otherwise: null })
    expect(preview()).toBe('With no pay calendar it reads the usual guess.Pick the day to see what it makes the bill.')
  })

  it('fills the form from the day on record, holds the save until something changes, and clears it', async () => {
    const { onClose } = open({ stored: RELEASE, otherwise: { dueYmd: '2026-12-10', own: false } })
    expect(day().value).toBe('2027-02-15')
    expect((screen.getByLabelText('Clause number') as HTMLInputElement).value).toBe('§ 9.4')
    expect(preview()).toBe('By the pay calendar it is due Dec 10.On its own day it is due Feb 15.')
    expect(save().disabled).toBe(true)
    fireEvent.change(day(), { target: { value: '2027-03-01' } })
    expect(save().disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Clear this bill’s own day' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(io.saveInvoiceDueDay).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ invoiceId: 'inv-1', dueYmd: null }))
    expect(screen.getByText('This bill’s own day cleared.')).toBeTruthy()
  })

  it('stays open and says why when the save is refused', async () => {
    io.saveInvoiceDueDay.mockRejectedValue({ message: 'Not allowed to set the day a bill is due' })
    const { onClose, onSaved } = open()
    fireEvent.change(day(), { target: { value: '2027-02-15' } })
    fireEvent.click(save())
    await waitFor(() => expect(screen.getByText(/Not allowed to set the day a bill is due/)).toBeTruthy())
    expect(onClose).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(io.dispatchPayCalendarChanged).not.toHaveBeenCalled()
  })
})
