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
    loadDevelopmentJobIds: vi.fn(),
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
import PayCalendarModal, { type PayCalendarJob } from './PayCalendarModal'

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

function open(props: { onClose?: () => void; onSaved?: () => void; job?: PayCalendarJob } = {}) {
  const onClose = props.onClose ?? vi.fn()
  const onSaved = props.onSaved ?? vi.fn()
  renderWithProviders(<PayCalendarModal payerId="payer-1" payerName="Larkfield Construction" job={props.job} onClose={onClose} onSaved={onSaved} />)
  return { onClose, onSaved }
}

const record = () => screen.getByTestId('pay-calendar-record').textContent
const preview = () => screen.getByTestId('pay-calendar-preview').textContent

beforeEach(() => {
  auth.role = 'assistant'
  io.loadPayerPayCalendars.mockReset().mockResolvedValue([])
  io.loadPayerReceipts.mockReset().mockResolvedValue(RECEIPTS)
  io.savePayCalendar.mockReset().mockResolvedValue(undefined)
  io.loadDevelopmentJobIds.mockReset().mockResolvedValue([])
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

  describe('opened from a job (PR 4)', () => {
    const JOB: PayCalendarJob = { id: 'job-2', label: '1412 · Larkfield retail shell', developmentId: 'dev-1', developmentName: 'Larkfield Commons' }
    const JOB_OWN: PayCalendarRow = { payerCustomerId: 'payer-1', jobId: 'job-2', off: false, calendar: { cutoffDay: 20, payDay: 10, monthsAfter: 2, payWhenPaid: false, clause: '', words: '' }, setByName: 'Mo', setAt: '2026-11-10T18:00:00Z' }
    const scope = (name: string) => screen.getByRole('radio', { name }) as HTMLButtonElement

    it('opens on the payer, and offers the job as the other choice', async () => {
      io.loadPayerPayCalendars.mockResolvedValue([STORED])
      open({ job: JOB })
      await waitFor(() => expect((screen.getByLabelText('Bills must be in by') as HTMLSelectElement).value).toBe('25'))
      expect(scope('Every job Larkfield Construction pays').getAttribute('aria-checked')).toBe('true')
      expect(scope('Only 1412 · Larkfield retail shell').getAttribute('aria-checked')).toBe('false')
      expect(screen.getByRole('button', { name: 'Save pay calendar' })).toBeTruthy()
      expect(screen.queryByLabelText('No pay calendar on this job')).toBeNull()
    })

    it('saves a calendar for the job alone, starting from the payer’s', async () => {
      io.loadPayerPayCalendars.mockResolvedValue([STORED])
      const { onClose, onSaved } = open({ job: JOB })
      await waitFor(() => expect((screen.getByLabelText('Bills must be in by') as HTMLSelectElement).value).toBe('25'))
      fireEvent.click(scope('Only 1412 · Larkfield retail shell'))
      expect(screen.getByTestId('pay-calendar-payer-words').textContent).toBe('Larkfield Construction on every other job: In by the 25th, paid the 30th.')
      fireEvent.change(screen.getByLabelText('They pay on the'), { target: { value: '15' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save for this job' }))
      await waitFor(() => expect(onClose).toHaveBeenCalled())
      expect(io.savePayCalendar).toHaveBeenCalledTimes(1)
      expect(io.savePayCalendar).toHaveBeenCalledWith(expect.anything(), { payerId: 'payer-1', jobId: 'job-2', calendar: { ...STORED.calendar, payDay: 15 } })
      expect(onSaved).toHaveBeenCalledTimes(1)
      expect(screen.getByText(/Only this job’s bills read it\./)).toBeTruthy()
    })

    it('opens on the job when it carries its own, and puts it back on the payer’s with one press and no question', async () => {
      io.loadPayerPayCalendars.mockResolvedValue([STORED, JOB_OWN])
      const { onClose } = open({ job: JOB })
      await waitFor(() => expect((screen.getByLabelText('Bills must be in by') as HTMLSelectElement).value).toBe('20'))
      expect(scope('Only 1412 · Larkfield retail shell').getAttribute('aria-checked')).toBe('true')
      expect(screen.getByText(/Set by Mo on Nov 10, 2026\./)).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Follow Larkfield Construction again' }))
      await waitFor(() => expect(onClose).toHaveBeenCalled())
      expect(io.savePayCalendar).toHaveBeenCalledWith(expect.anything(), { payerId: 'payer-1', jobId: 'job-2', calendar: null })
      // Switching back to the payer shows the payer's own calendar, untouched.
    })

    it('switches the calendar off for the job', async () => {
      io.loadPayerPayCalendars.mockResolvedValue([STORED])
      const { onClose } = open({ job: JOB })
      await waitFor(() => expect((screen.getByLabelText('Bills must be in by') as HTMLSelectElement).value).toBe('25'))
      fireEvent.click(scope('Only 1412 · Larkfield retail shell'))
      fireEvent.click(screen.getByLabelText('No pay calendar on this job'))
      expect((screen.getByLabelText('Bills must be in by') as HTMLSelectElement).disabled).toBe(true)
      expect(preview()).toBe('This job reads the usual guess: the bill date plus how long they take to pay.')
      expect(screen.queryByTestId('pay-calendar-record')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Save for this job' }))
      await waitFor(() => expect(onClose).toHaveBeenCalled())
      expect(io.savePayCalendar).toHaveBeenCalledWith(expect.anything(), { payerId: 'payer-1', jobId: 'job-2', calendar: { off: true } })
    })

    it('sets the development’s other jobs with it, past one that fails, and says which did not take', async () => {
      io.loadPayerPayCalendars.mockResolvedValue([STORED])
      io.loadDevelopmentJobIds.mockResolvedValue(['job-1', 'job-2', 'job-3', 'job-4'])
      io.savePayCalendar.mockImplementation(async (_db: unknown, args: { jobId?: string | null }) => {
        if (args.jobId === 'job-3') throw { message: 'Job not found' }
      })
      const { onClose, onSaved } = open({ job: JOB })
      await waitFor(() => expect((screen.getByLabelText('Bills must be in by') as HTMLSelectElement).value).toBe('25'))
      fireEvent.click(scope('Only 1412 · Larkfield retail shell'))
      fireEvent.click(await screen.findByLabelText('Also set on the other 3 jobs in Larkfield Commons'))
      fireEvent.click(screen.getByRole('button', { name: 'Save for 4 jobs' }))
      expect(await screen.findByText('Saved 3 jobs. 1 did not save. Job not found')).toBeTruthy()
      expect(io.savePayCalendar.mock.calls.map((c) => (c[1] as { jobId: string }).jobId)).toEqual(['job-2', 'job-1', 'job-3', 'job-4'])
      expect(io.loadDevelopmentJobIds).toHaveBeenCalledWith(expect.anything(), 'dev-1')
      // The window stays open on a partial save, and the board is told to read again.
      expect(onClose).not.toHaveBeenCalled()
      expect(onSaved).toHaveBeenCalledTimes(1)
    })

    it('offers no neighbours for a job in no development', async () => {
      open({ job: { id: 'job-9', label: '1500 · Stand-alone repair' } })
      await waitFor(() => expect(record()).toContain('Usually about 6.'))
      fireEvent.click(scope('Only 1500 · Stand-alone repair'))
      expect(screen.getByTestId('pay-calendar-payer-words').textContent).toBe('Larkfield Construction has no pay calendar of their own.')
      expect(screen.queryByLabelText(/Also set on the other/)).toBeNull()
      expect(io.loadDevelopmentJobIds).not.toHaveBeenCalled()
    })
  })
})
