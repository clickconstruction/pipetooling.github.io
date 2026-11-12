// @vitest-environment jsdom
/**
 * Render-smoke tests for the Pay calendar window (punch list #323, PR 1): a payer with no
 * calendar opens on the common one and says it back in plain dates; the record line replays
 * the payer's measured payments against what is typed and follows a change; Save hands the
 * calendar to the save and closes; a stored calendar fills the form and offers its removal,
 * behind a confirm whose button names the act; a reader who cannot set one sees it and no
 * Save; a read that fails says why. Every name is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { PayCalendarRow } from '../../lib/jobs/payCalendar'

const { io, auth } = vi.hoisted(() => ({
  io: {
    loadPayerPayCalendars: vi.fn(),
    loadPayerReceipts: vi.fn(),
    savePayCalendar: vi.fn(),
  },
  auth: { role: 'assistant' as string },
}))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: auth.role })
  return { useAuth: value, useOptionalAuth: value }
})
vi.mock('../../lib/jobs/payCalendarIo', () => io)
vi.mock('../../utils/dateUtils', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../utils/dateUtils')>()), todayYmdInAppTz: () => '2026-11-12' }))

import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import PayCalendarModal from './PayCalendarModal'

installDomShims()

/** Bills in during a month are due the 10th of the next; these landed on it, 6 days after, 14 after and 6 after. */
const RECEIPTS = [
  { billedYmd: '2026-10-06', paidYmd: '2026-11-10' },
  { billedYmd: '2026-10-27', paidYmd: '2026-11-16' },
  { billedYmd: '2026-09-03', paidYmd: '2026-10-24' },
  { billedYmd: '2026-08-20', paidYmd: '2026-09-16' },
]

const STORED: PayCalendarRow = {
  payerCustomerId: 'payer-1',
  jobId: null,
  off: false,
  calendar: { cutoffDay: 25, payDay: 30, monthsAfter: 1, payWhenPaid: false, clause: '§ 5.2', words: 'Paid the 30th of the next month.' },
  setByName: 'Rosa',
  setAt: '2026-11-03T18:00:00Z',
}

function open(props: { onClose?: () => void; onSaved?: () => void } = {}) {
  const onClose = props.onClose ?? vi.fn()
  const onSaved = props.onSaved ?? vi.fn()
  renderWithProviders(<PayCalendarModal payerId="payer-1" payerName="Larkfield Construction" onClose={onClose} onSaved={onSaved} />)
  return { onClose, onSaved }
}

const record = () => screen.getByTestId('pay-calendar-record').textContent
const preview = () => screen.getByTestId('pay-calendar-preview').textContent

beforeEach(() => {
  auth.role = 'assistant'
  io.loadPayerPayCalendars.mockReset().mockResolvedValue([])
  io.loadPayerReceipts.mockReset().mockResolvedValue(RECEIPTS)
  io.savePayCalendar.mockReset().mockResolvedValue(undefined)
})

describe('PayCalendarModal', () => {
  it('opens on the common calendar, says it back in dates and replays the record against it', async () => {
    open()
    await waitFor(() => expect(record()).toContain('Their last 4 payments landed 0 to 14 days after the due day. Usually about 6.'))
    expect(screen.getByRole('dialog', { name: 'Pay calendar · Larkfield Construction' })).toBeTruthy()
    expect(preview()).toBe('A bill in by Nov 30 is due Dec 10.A bill in on Dec 1 is due Jan 10.')
    expect((screen.getByLabelText('Bills must be in by') as HTMLSelectElement).value).toBe('eom')
    expect(screen.queryByRole('button', { name: 'Remove the pay calendar' })).toBeNull()
  })

  it('follows what is typed: the dates and the record move with the cutoff and the pay day', async () => {
    open()
    await waitFor(() => expect(record()).toContain('Usually about 6.'))
    fireEvent.change(screen.getByLabelText('Bills must be in by'), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText('They pay on the'), { target: { value: '30' } })
    expect(preview()).toBe('A bill in by Nov 25 is due Dec 30.A bill in on Nov 26 is due Jan 30.')
    // Against the 30th of the next month those same payments were early or on time.
    await waitFor(() => expect(record()).toContain('Their last 4 payments all landed by the due day.'))
  })

  it('hands the calendar to the save, tells the opener and closes', async () => {
    const { onClose, onSaved } = open()
    await waitFor(() => expect(record()).toContain('Usually about 6.'))
    fireEvent.change(screen.getByLabelText('Clause number'), { target: { value: ' § 5.2 ' } })
    fireEvent.click(screen.getByLabelText(/They pay when the owner pays them/))
    fireEvent.click(screen.getByRole('button', { name: 'Save pay calendar' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(io.savePayCalendar).toHaveBeenCalledWith(expect.anything(), {
      payerId: 'payer-1',
      calendar: { cutoffDay: null, payDay: 10, monthsAfter: 1, payWhenPaid: true, clause: '§ 5.2', words: '' },
    })
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('keeps the window open and says why when the save is refused', async () => {
    io.savePayCalendar.mockRejectedValue({ message: 'Not allowed to set a pay calendar' })
    const { onClose } = open()
    await waitFor(() => expect(record()).toContain('Usually about 6.'))
    fireEvent.click(screen.getByRole('button', { name: 'Save pay calendar' }))
    expect(await screen.findByText(/Not allowed to set a pay calendar/)).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('fills the form from a stored calendar and removes it behind a confirm that names the act', async () => {
    io.loadPayerPayCalendars.mockResolvedValue([STORED])
    const { onClose, onSaved } = open()
    await waitFor(() => expect((screen.getByLabelText('Bills must be in by') as HTMLSelectElement).value).toBe('25'))
    expect((screen.getByLabelText('They pay on the') as HTMLSelectElement).value).toBe('30')
    expect((screen.getByLabelText('Clause number') as HTMLInputElement).value).toBe('§ 5.2')
    expect(screen.getByText(/Set by Rosa on Nov 3, 2026\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove the pay calendar' }))
    // The confirm's own button carries the same words; it is the second one on the page.
    const presses = await screen.findAllByRole('button', { name: 'Remove the pay calendar' })
    expect(presses.length).toBe(2)
    fireEvent.click(presses[1]!)
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(io.savePayCalendar).toHaveBeenCalledWith(expect.anything(), { payerId: 'payer-1', calendar: null })
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('shows a reader the calendar and offers no save', async () => {
    auth.role = 'primary'
    io.loadPayerPayCalendars.mockResolvedValue([STORED])
    open()
    await waitFor(() => expect((screen.getByLabelText('Bills must be in by') as HTMLSelectElement).value).toBe('25'))
    expect((screen.getByLabelText('Bills must be in by') as HTMLSelectElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Save pay calendar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove the pay calendar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
    expect(screen.getByText(/The office sets this\./)).toBeTruthy()
  })

  it('says there is no payment on record for a payer with none', async () => {
    io.loadPayerReceipts.mockResolvedValue([])
    open()
    await waitFor(() => expect(record()).toContain('No payment on record yet. The due day is the best guess there is.'))
  })

  it('says why when the calendar cannot be read, and holds the save', async () => {
    io.loadPayerPayCalendars.mockRejectedValue({ message: 'permission denied for table payer_pay_calendars' })
    open()
    expect((await screen.findByRole('alert')).textContent).toContain('permission denied for table payer_pay_calendars')
    expect((screen.getByRole('button', { name: 'Save pay calendar' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
