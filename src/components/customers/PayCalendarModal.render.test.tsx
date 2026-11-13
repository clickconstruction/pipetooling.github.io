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
    dispatchPayCalendarChanged: vi.fn(),
    loadPayCalendarJobs: vi.fn(),
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
import PayCalendarModal, { type PayCalendarInitial, type PayCalendarJob, type PayCalendarJobToBe } from './PayCalendarModal'

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

function open(props: { onClose?: () => void; onSaved?: () => void; job?: PayCalendarJob; jobToBe?: PayCalendarJobToBe; initial?: PayCalendarInitial; zIndex?: number } = {}) {
  const onClose = props.onClose ?? vi.fn()
  const onSaved = props.onSaved ?? vi.fn()
  renderWithProviders(<PayCalendarModal payerId="payer-1" payerName="Larkfield Construction" job={props.job} jobToBe={props.jobToBe} initial={props.initial} zIndex={props.zIndex} onClose={onClose} onSaved={onSaved} />)
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
  io.dispatchPayCalendarChanged.mockReset()
  io.loadPayCalendarJobs.mockReset().mockResolvedValue(new Map())
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
    // Nothing was saved, so no screen is told to read again.
    expect(io.dispatchPayCalendarChanged).not.toHaveBeenCalled()
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

  it('starts from a paper’s clause and words when nothing is stored, and draws above the window that opened it (PR 7)', async () => {
    open({ initial: { clause: ' § 5.2 ', words: 'in by the 25th, paid the 30th of the next month' }, zIndex: 1410 })
    await waitFor(() => expect((screen.getByLabelText('Clause number') as HTMLInputElement).value).toBe('§ 5.2'))
    expect((screen.getByLabelText('The clause in a few words') as HTMLInputElement).value).toBe('in by the 25th, paid the 30th of the next month')
    expect(screen.getByTestId('pay-calendar-modal').style.zIndex).toBe('1410')
  })

  it('keeps a stored calendar over a paper’s clause', async () => {
    io.loadPayerPayCalendars.mockResolvedValue([STORED])
    open({ initial: { clause: '§ 9', words: 'something else' } })
    await waitFor(() => expect((screen.getByLabelText('Clause number') as HTMLInputElement).value).toBe('§ 5.2'))
    expect(screen.getByTestId('pay-calendar-modal').style.zIndex).toBe('1200')
  })

  describe('the jobs that do not follow the payer (punch list #341)', () => {
    const OWN: PayCalendarRow = { payerCustomerId: 'payer-1', jobId: 'job-2', off: false, calendar: { cutoffDay: 20, payDay: 10, monthsAfter: 2, payWhenPaid: false, clause: '', words: '' }, setByName: null, setAt: null }
    const OFF: PayCalendarRow = { payerCustomerId: 'payer-1', jobId: 'job-3', off: true, calendar: null, setByName: null, setAt: null }
    const MOVED: PayCalendarRow = { ...OWN, jobId: 'job-4' }
    const facts = new Map([
      ['job-2', { job: { id: 'job-2', label: '1431 · Larkfield medical office', developmentId: null, developmentName: null }, payerIdNow: 'payer-1' }],
      ['job-3', { job: { id: 'job-3', label: '1418 · Larkfield tenant repair', developmentId: null, developmentName: null }, payerIdNow: 'payer-1' }],
      ['job-4', { job: { id: 'job-4', label: '1402 · Whitfield remodel', developmentId: null, developmentName: null }, payerIdNow: 'cust-9' }],
    ])
    const lines = () => screen.getAllByTestId('pay-calendar-own-job').map((el) => el.textContent)

    it('lists them under the payer’s calendar, says what each reads, and no longer claims every bill', async () => {
      io.loadPayerPayCalendars.mockResolvedValue([STORED, OWN, OFF])
      io.loadPayCalendarJobs.mockResolvedValue(facts)
      open()
      await waitFor(() => expect(lines()).toEqual(['1431 · Larkfield medical officeIts own: In by the 20th, paid the 10th', '1418 · Larkfield tenant repairNo pay calendar on this job']))
      expect(screen.getByTestId('pay-calendar-own-jobs').textContent).toContain('2 jobs do not follow this')
      expect(io.loadPayCalendarJobs).toHaveBeenCalledWith(expect.anything(), ['job-2', 'job-3'])
      expect(screen.getByText(/Every other bill this payer pays reads it\./)).toBeTruthy()
    })

    it('makes each job a press that reopens the window on it', async () => {
      io.loadPayerPayCalendars.mockResolvedValue([STORED, OWN])
      io.loadPayCalendarJobs.mockResolvedValue(facts)
      const onOpenJob = vi.fn()
      renderWithProviders(<PayCalendarModal payerId="payer-1" payerName="Larkfield Construction" onClose={vi.fn()} onOpenJob={onOpenJob} />)
      fireEvent.click(await screen.findByRole('button', { name: '1431 · Larkfield medical office' }))
      expect(onOpenJob).toHaveBeenCalledWith(facts.get('job-2')!.job)
      expect(screen.getByTestId('pay-calendar-own-jobs').textContent).toContain('1 job does not follow this')
    })

    it('says when a job’s calendar is held for a payer who no longer pays it', async () => {
      io.loadPayerPayCalendars.mockResolvedValue([STORED, MOVED])
      io.loadPayCalendarJobs.mockResolvedValue(facts)
      open()
      await waitFor(() => expect(lines()).toEqual(['1402 · Whitfield remodelIts own: In by the 20th, paid the 10th. Larkfield Construction no longer pays this job, so no bill reads it.']))
    })

    it('still lists a job whose name could not be read, with no press, and draws nothing with no such job', async () => {
      io.loadPayerPayCalendars.mockResolvedValue([STORED, OWN])
      const { unmount } = renderWithProviders(<PayCalendarModal payerId="payer-1" payerName="Larkfield Construction" onClose={vi.fn()} onOpenJob={vi.fn()} />)
      await waitFor(() => expect(lines()).toEqual(['A jobIts own: In by the 20th, paid the 10th']))
      expect(screen.queryByRole('button', { name: 'A job' })).toBeNull()
      unmount()
      io.loadPayerPayCalendars.mockResolvedValue([STORED])
      open()
      await waitFor(() => expect((screen.getByLabelText('Bills must be in by') as HTMLSelectElement).value).toBe('25'))
      expect(screen.queryByTestId('pay-calendar-own-jobs')).toBeNull()
      expect(screen.getByText(/Every bill this payer pays reads it\./)).toBeTruthy()
    })

    it('hides the list on the job’s own side of the window', async () => {
      io.loadPayerPayCalendars.mockResolvedValue([STORED, OWN])
      io.loadPayCalendarJobs.mockResolvedValue(facts)
      open({ job: { id: 'job-2', label: '1431 · Larkfield medical office' } })
      await waitFor(() => expect((screen.getByLabelText('Bills must be in by') as HTMLSelectElement).value).toBe('20'))
      expect(screen.queryByTestId('pay-calendar-own-jobs')).toBeNull()
      fireEvent.click(screen.getByRole('radio', { name: 'Every job Larkfield Construction pays' }))
      expect(screen.getByTestId('pay-calendar-own-jobs')).toBeTruthy()
    })
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
      expect(screen.queryByLabelText('This job has no pay calendar')).toBeNull()
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
      fireEvent.click(screen.getByLabelText('This job has no pay calendar'))
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
      // Punch list #341: every other screen is told once, however many jobs were written.
      expect(io.dispatchPayCalendarChanged).toHaveBeenCalledTimes(1)
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

describe('PayCalendarModal opened on terms an estimator read (punch list #323)', () => {
  const READ = { cutoffDay: 25, payDay: 30, monthsAfter: 1, payWhenPaid: false, clause: '§ 7.1', words: '' }
  const JOB_1431: PayCalendarJob = { id: 'job-2', label: '1431 · Larkfield medical office', developmentId: null, developmentName: null }

  it('starts on the terms and on this job, says where they came from, and replays the record against them', async () => {
    open({ job: JOB_1431, initial: { calendar: READ, scope: 'job', from: 'Dana Whitfield’s draft' } })
    await waitFor(() => expect(record()).toContain('Their last 4 payments all landed by the due day.'))
    expect(screen.getByTestId('pay-calendar-offered').textContent).toBe('Filled in from Dana Whitfield’s draft. Check it, then save.')
    expect(screen.getByRole('radio', { name: 'Only 1431 · Larkfield medical office' }).getAttribute('aria-checked')).toBe('true')
    expect((screen.getByLabelText('Bills must be in by') as HTMLSelectElement).value).toBe('25')
    expect((screen.getByLabelText('Clause number') as HTMLInputElement).value).toBe('§ 7.1')
  })

  it('keeps the terms when the office moves them to every job the payer pays, over what is stored', async () => {
    io.loadPayerPayCalendars.mockResolvedValue([STORED])
    open({ job: JOB_1431, initial: { calendar: { ...READ, payDay: 15 }, scope: 'job', from: 'Dana Whitfield’s draft' } })
    await waitFor(() => expect(record()).toContain('Their record against this.'))
    fireEvent.click(screen.getByRole('radio', { name: 'Every job Larkfield Construction pays' }))
    expect((screen.getByLabelText('They pay on the') as HTMLSelectElement).value).toBe('15')
  })

  it('for a job not made yet, hands the calendar back and writes nothing', async () => {
    const onUse = vi.fn()
    const { onClose, onSaved } = open({ jobToBe: { label: 'Larkfield Medical Office', onUse }, initial: { calendar: READ, scope: 'job', from: 'Dana Whitfield’s draft' } })
    await waitFor(() => expect(record()).toContain('Their record against this.'))
    expect(screen.getByRole('radio', { name: 'Only Larkfield Medical Office' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Use for this job' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onUse).toHaveBeenCalledWith(READ)
    expect(io.savePayCalendar).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('for a job not made yet, a calendar for every job the payer pays saves there and then', async () => {
    const onUse = vi.fn()
    const { onSaved } = open({ jobToBe: { label: 'Larkfield Medical Office', onUse }, initial: { calendar: READ, scope: 'payer', from: 'Dana Whitfield’s draft' } })
    await waitFor(() => expect(record()).toContain('Their record against this.'))
    fireEvent.click(screen.getByRole('button', { name: 'Save pay calendar' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(io.savePayCalendar).toHaveBeenCalledWith(expect.anything(), { payerId: 'payer-1', calendar: READ })
    expect(onUse).not.toHaveBeenCalled()
  })
})
