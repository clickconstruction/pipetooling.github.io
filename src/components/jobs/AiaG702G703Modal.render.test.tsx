// @vitest-environment jsdom
/**
 * Render smoke for the AIA G702-G703 window with its paper preview: wide, the paper sits left of
 * the form and follows it as you type; a box left empty is empty; a box pressed on
 * the paper puts the cursor in its field; narrow, Form / Preview swap the two.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import AiaG702G703Modal from './AiaG702G703Modal'
import { payApplicationWriteFromForm, savedPayApplicationFromRow, type PayApplicationRow, type PayApplicationWrite, type SavedPayApplication } from '../../lib/aiaPayApplications'
import type { PayApplicationLine } from '../../lib/aiaPayApplicationLines'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }) }))
vi.mock('../../lib/physicalInvoiceIssuer', () => ({
  fetchPhysicalInvoiceIssuerFromAppSettings: () => Promise.resolve(),
  getPhysicalInvoiceIssuerDraft: () => ({
    companyName: 'Click Plumbing and Electrical',
    addressText: '5501 Balcones Dr A141\nAustin, TX 78731',
    phone: '',
    email: '',
    tagline: '',
    licenseLine: '',
  }),
}))

vi.mock('../../lib/aiaG702G703PrefillIo', () => ({
  loadAiaPrefillFacts: () =>
    Promise.resolve({ ownerName: 'Heron Construction Group', ownerAddress: '900 Broadway St, San Antonio, TX 78215', contractSignedOn: '2026-07-14' }),
}))

// The job's saved applications: a list the tests set, and the writes they watch.
const { TakenError } = vi.hoisted(() => ({
  TakenError: class extends Error {
    constructor(public readonly applicationNumber: number) {
      super('taken')
    }
  },
}))
let onJob: SavedPayApplication[] = []
const saveSpy = vi.fn((write: PayApplicationWrite, id: string | null): Promise<SavedPayApplication> => {
  if (onJob.some((a) => a.applicationNumber === write.application_number && a.id !== id)) {
    return Promise.reject(new TakenError(write.application_number))
  }
  return Promise.resolve(savedPayApplicationFromRow({ id: id ?? `new-${write.application_number}`, updated_at: '2026-10-04T15:00:00Z', ...write } as PayApplicationRow))
})
const deleteSpy = vi.fn((_id: string) => Promise.resolve())
vi.mock('../../lib/aiaPayApplicationsIo', () => ({
  PayApplicationNumberTaken: TakenError,
  loadPayApplications: () => Promise.resolve(onJob),
  savePayApplication: (write: PayApplicationWrite, id: string | null) => saveSpy(write, id),
  deletePayApplication: (id: string) => deleteSpy(id),
}))
// The workbook itself is covered by the fill tests; here Generate only has to hand over a file.
const fillSpy = vi.fn((_url: string, _values: unknown, _lines: PayApplicationLine[], _options: { splitLaborMaterial?: boolean }) => Promise.resolve(new ArrayBuffer(8)))
vi.mock('../../lib/fillAiaG702G703Workbook', async () => {
  const actual = await vi.importActual<typeof import('../../lib/fillAiaG702G703Workbook')>('../../lib/fillAiaG702G703Workbook')
  return {
    ...actual,
    fetchAndFillAiaTemplate: (url: string, values: unknown, lines: PayApplicationLine[], options: { splitLaborMaterial?: boolean }) => fillSpy(url, values, lines, options),
  }
})

/** The one line these applications carry, as the job starts it. */
const oneLine = (p: Partial<PayApplicationLine>): PayApplicationLine[] => [{ id: 'line-1', label: 'Plumbing', scheduledValue: 48500, labor: null, stage: null, fromPrevious: 0, thisPeriod: 0, stored: 0, ...p }]

/** Application 1 as it was saved: 19,400 of a 48,500 contract at 10%. */
function savedOne(thisPeriod = 19400, updatedAt = '2026-10-02T15:00:00Z'): SavedPayApplication {
  const w = payApplicationWriteFromForm('job-x', {
    values: {
      g702_n5_project: '1',
      g702_n6_period_to: '09/30/2026',
      g702_h6_project_name: 'Water Sample Test',
      g702_d6_owner_name: 'Heron Construction Group',
      g702_h18_original_contract_sum: 48500,
      g702_c28_retainage_percent: 10,
    },
    lines: oneLine({ thisPeriod }),
    splitLaborMaterial: false,
  })
  if (!w.ok) throw new Error(w.reason)
  return savedPayApplicationFromRow({ id: 'app-1', updated_at: updatedAt, ...w.row } as PayApplicationRow)
}

/** Application 2 as it went out after application 1: 19,400 before, 9,700 that period. */
function savedTwo(reason?: string): SavedPayApplication {
  const w = payApplicationWriteFromForm(
    'job-x',
    {
      values: {
        g702_n5_project: '2',
        g702_n6_period_to: '10/31/2026',
        g702_h18_original_contract_sum: 48500,
        g702_c28_retainage_percent: 10,
        g702_h40_less_previous_certificates: 17460,
      },
      lines: oneLine({ fromPrevious: 19400, thisPeriod: 9700 }),
      splitLaborMaterial: false,
    },
    '',
    reason,
  )
  if (!w.ok) throw new Error(w.reason)
  return savedPayApplicationFromRow({ id: 'app-2', updated_at: '2026-11-02T15:00:00Z', ...w.row } as PayApplicationRow)
}

/** Application 1 after someone reopened it: 21,000 of work, not 19,400. */
const savedOneChanged = (): SavedPayApplication => savedOne(21000, '2026-11-05T15:00:00Z')

function setWide(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

const job = makeJob({ job_name: 'Water Sample Test', customer_name: 'Heron Construction Group', revenue: 48500, pct_complete: 40 })
const cell = (key: string) => document.querySelector(`[data-aia-cell="${key}"]`) as HTMLButtonElement
const field = (key: string) => document.getElementById(`aia-field-${key}`) as HTMLInputElement
/** A box of a line in the form: label, scheduled, from, pct, this or stored. */
const lineField = (column: string, id = 'line-1') => document.getElementById(`aia-line-${id}-${column}`) as HTMLInputElement

beforeEach(() => {
  onJob = []
  saveSpy.mockClear()
  deleteSpy.mockClear()
  fillSpy.mockClear()
  URL.createObjectURL = () => 'blob:aia'
  URL.revokeObjectURL = () => undefined
  // jsdom has no downloads: the link Generate presses goes nowhere.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
})

afterEach(() => {
  // @ts-expect-error the next test installs its own
  delete window.matchMedia
})

describe('AiaG702G703Modal', () => {
  it('draws the paper beside the form and follows what is typed', async () => {
    setWide(true)
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await waitFor(() => expect(field('g702_h18_original_contract_sum').value).toBe('48500'))

    expect(screen.getByTestId('aia-preview-pane')).toBeTruthy()
    expect(cell('g702_h18_original_contract_sum').textContent).toBe('$48,500.00')
    expect(cell('g702_h18_original_contract_sum').dataset.aiaSource).toBe('typed')
    // The job is the project; the payer read beside it is the owner; the number waits to be typed.
    expect(cell('g702_h6_project_name').textContent).toBe('Water Sample Test')
    expect(cell('g702_d6_owner_name').textContent).toBe('Heron Construction Group')
    expect(cell('g702_d7_owner_address').textContent).toBe('900 Broadway St')
    expect(cell('g702_n9_contract_date').textContent).toBe('07/14/2026')
    expect(cell('g702_n5_project').dataset.aiaSource).toBe('blank')
    expect(field('g702_c28_retainage_percent').value).toBe('10')
    // Nothing typed for the period: the box is empty, on the paper and in the download.
    expect(cell('g702_n6_period_to').textContent?.trim()).toBe('')
    expect(cell('g702_n6_period_to').dataset.aiaSource).toBe('blank')

    fireEvent.change(field('g702_n6_period_to'), { target: { value: 'October 31, 2026' } })
    expect(cell('g702_n6_period_to').textContent).toBe('October 31, 2026')
    expect(cell('g703_k4_period_to').textContent).toBe('October 31, 2026')

    // 40% of 48,500 = 19,400 this period, less the 10% retainage the form starts with.
    expect(screen.getByLabelText('G702 page').textContent).toContain('CURRENT PAYMENT DUE$17,460.00')
  })

  it('puts the cursor in the field of a box pressed on the paper, opening Change Orders for its boxes', async () => {
    setWide(true)
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await settle()

    fireEvent.click(cell('g702_f50_this_month_change_order_additions'))
    await waitFor(() => expect(document.activeElement).toBe(field('g702_f50_this_month_change_order_additions')))
    expect((document.querySelector('details.aia-g702-details-wrap') as HTMLDetailsElement).open).toBe(true)
  })

  it('swaps the form for the paper on a narrow screen', async () => {
    setWide(false)
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await settle()

    expect(screen.queryByTestId('aia-preview-pane')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByTestId('aia-preview-pane')).toBeTruthy()
    fireEvent.click(cell('g702_n7_project_no'))
    await waitFor(() => expect(document.activeElement).toBe(field('g702_n7_project_no')))
    expect(screen.queryByTestId('aia-preview-pane')).toBeNull()
  })

  it('saves the application on the job under its number, and says why when it has none', async () => {
    setWide(true)
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await waitFor(() => expect(field('g702_h18_original_contract_sum').value).toBe('48500'))
    expect(screen.getByTestId('aia-applications').textContent).toContain('Nothing is saved on this job yet.')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/Type the application number as a whole number/)).toBeTruthy()
    expect(saveSpy).not.toHaveBeenCalled()

    fireEvent.change(field('g702_n5_project'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Application 1 saved on the job.')).toBeTruthy()
    const [write, id] = saveSpy.mock.calls[0]!
    expect(id).toBeNull()
    expect(write).toMatchObject({ job_id: job.id, application_number: 1, total_completed_and_stored: 19400, retainage_held: 1940, current_payment_due: 17460 })
    // It is now a chip on the list, and the one that is open.
    expect(screen.getByRole('button', { name: /^1 · \$17,460\.00 due$/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Reset to saved' })).toBeTruthy()

    // Saving again writes the same row.
    fireEvent.change(field('g702_n6_period_to'), { target: { value: '10/31/2026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(2))
    expect(saveSpy.mock.calls[1]![1]).toBe('new-1')
    expect(saveSpy.mock.calls[1]![0].period_to).toBe('2026-10-31')
  })

  it('keeps a pasted link beside the application and offers to open it', async () => {
    setWide(true)
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await waitFor(() => expect(field('g702_h18_original_contract_sum').value).toBe('48500'))
    const linkBox = screen.getByLabelText(/LINK TO THE FILE YOU SENT/) as HTMLInputElement

    fireEvent.change(field('g702_n5_project'), { target: { value: '1' } })
    fireEvent.change(linkBox, { target: { value: 'my drive' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/The link to the file is not a web address/)).toBeTruthy()
    expect(saveSpy).not.toHaveBeenCalled()

    fireEvent.change(linkBox, { target: { value: 'https://docs.google.com/spreadsheets/d/abc123/edit' } })
    expect((screen.getByRole('link', { name: 'Open' }) as HTMLAnchorElement).href).toBe('https://docs.google.com/spreadsheets/d/abc123/edit')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1))
    expect(saveSpy.mock.calls[0]![0].files).toEqual([{ kind: 'link', url: 'https://docs.google.com/spreadsheets/d/abc123/edit' }])
    // Saved, the link is still in its box.
    await waitFor(() => expect(linkBox.value).toBe('https://docs.google.com/spreadsheets/d/abc123/edit'))
  })

  it('starts the next application from the last one saved', async () => {
    setWide(true)
    onJob = [savedOne()]
    // The job today: 60% of 48,500 is 29,100 created.
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={{ ...job, pct_complete: 60 }} hcpForFilename="1023" />)
    await waitFor(() => expect(field('g702_n5_project').value).toBe('2'))

    expect(screen.getByTestId('aia-applications').textContent).toContain('It starts from application 1')
    expect(lineField('from').value).toBe('19400')
    expect(field('g702_h40_less_previous_certificates').value).toBe('17460')
    expect(lineField('this').value).toBe('9700')
    // 29,100 of 48,500 is 60%.
    expect(lineField('pct').value).toBe('60')
    // 29,100 to date less 10% is 26,190 earned; 17,460 was certified before.
    expect(screen.getByLabelText('G702 page').textContent).toContain('CURRENT PAYMENT DUE$8,730.00')

    // The saved one opens as it was saved.
    fireEvent.click(screen.getByRole('button', { name: /^1 · 09\/30\/2026/ }))
    await waitFor(() => expect(field('g702_n5_project').value).toBe('1'))
    expect(lineField('from').value).toBe('')
    expect(screen.getByLabelText('G702 page').textContent).toContain('CURRENT PAYMENT DUE$17,460.00')
  })

  it('offers 5% retainage once the job is past halfway, and Use 5% takes it', async () => {
    setWide(true)
    onJob = [savedOne()]
    // 60% of 48,500 created: application 2 opens with 19,400 before and 9,700 now.
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={{ ...job, pct_complete: 60 }} hcpForFilename="1023" />)
    await waitFor(() => expect(field('g702_n5_project').value).toBe('2'))

    const offer = screen.getByTestId('aia-retainage-drop')
    expect(offer.textContent).toContain('This job is 60% complete.')
    expect(offer.textContent).toContain('Held would go from $2,910.00 to $1,455.00, and $1,455.00 more would be due.')
    fireEvent.click(screen.getByRole('button', { name: 'Use 5%' }))
    expect(field('g702_c28_retainage_percent').value).toBe('5')
    expect(screen.queryByTestId('aia-retainage-drop')).toBeNull()
    // 29,100 at 5% leaves 27,645 earned; 17,460 was certified before.
    expect(screen.getByLabelText('G702 page').textContent).toContain('CURRENT PAYMENT DUE$10,185.00')

    // Application 1 was 40% complete: no offer there.
    fireEvent.click(screen.getByRole('button', { name: /^1 · 09\/30\/2026/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Leave' }))
    await waitFor(() => expect(field('g702_n5_project').value).toBe('1'))
    expect(screen.queryByTestId('aia-retainage-drop')).toBeNull()
  })

  it('flags an application that no longer matches the one before it, and saves it with a reason', async () => {
    setWide(true)
    onJob = [savedOneChanged(), savedTwo()]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" initialApplicationNumber={2} />)
    await waitFor(() => expect(field('g702_n5_project').value).toBe('2'))

    const flag = screen.getByTestId('aia-carry-mismatch')
    expect(flag.textContent).toContain('This application does not match application 1.')
    expect(flag.textContent).toContain('Plumbing, work from previous application: $19,400.00 here, $21,000.00 from application 1.')
    expect(flag.textContent).toContain('LESS PREVIOUS CERTIFICATES FOR PAYMENT: $17,460.00 here, $18,900.00 from application 1.')
    // Its chip carries the mark; application 1's does not.
    expect(screen.getByRole('button', { name: /^⚠ 2 · 10\/31\/2026/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^1 · 09\/30\/2026/ })).toBeTruthy()

    // It is not blocked: a reason is typed and it saves as it is.
    fireEvent.change(screen.getByLabelText('WHY IT STAYS AS IT IS'), { target: { value: 'It went out this way on Nov 2.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1))
    expect(saveSpy.mock.calls[0]![1]).toBe('app-2')
    expect(saveSpy.mock.calls[0]![0].carry_reason).toBe('It went out this way on Nov 2.')
    expect(saveSpy.mock.calls[0]![0].total_earned_less_retainage).toBe(26190)
  })

  it('takes the earlier application\'s amounts on request, which clears the flag and the reason', async () => {
    setWide(true)
    onJob = [savedOneChanged(), savedTwo('It went out this way on Nov 2.')]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" initialApplicationNumber={2} />)
    await waitFor(() => expect(field('g702_n5_project').value).toBe('2'))
    expect((screen.getByLabelText('WHY IT STAYS AS IT IS') as HTMLInputElement).value).toBe('It went out this way on Nov 2.')

    fireEvent.click(screen.getByRole('button', { name: 'Use application 1\'s amounts' }))
    expect(lineField('from').value).toBe('21000')
    expect(field('g702_h40_less_previous_certificates').value).toBe('18900')
    expect(screen.queryByTestId('aia-carry-mismatch')).toBeNull()
    // 30,700 to date less 10% is 27,630 earned; 18,900 was certified before.
    expect(screen.getByLabelText('G702 page').textContent).toContain('CURRENT PAYMENT DUE$8,730.00')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1))
    // The reason it had is cleared with the mismatch.
    expect(saveSpy.mock.calls[0]![0].carry_reason).toBe('')
  })

  it('leaves the reason column alone on an application that matches', async () => {
    setWide(true)
    onJob = [savedOne(), savedTwo()]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" initialApplicationNumber={2} />)
    await waitFor(() => expect(field('g702_n5_project').value).toBe('2'))
    expect(screen.queryByTestId('aia-carry-mismatch')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1))
    expect('carry_reason' in saveSpy.mock.calls[0]![0]).toBe(false)
  })

  it('asks before typed work is lost, and keeps it on Stay', async () => {
    setWide(true)
    onJob = [savedOne()]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await waitFor(() => expect(field('g702_n5_project').value).toBe('2'))

    fireEvent.change(field('g702_n6_period_to'), { target: { value: '10/31/2026' } })
    fireEvent.click(screen.getByRole('button', { name: /^1 · 09\/30\/2026/ }))
    expect(await screen.findByText('Leave without saving?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }))
    await settle()
    expect(field('g702_n5_project').value).toBe('2')
    expect(field('g702_n6_period_to').value).toBe('10/31/2026')
  })

  it('will not save over another application\'s number', async () => {
    setWide(true)
    onJob = [savedOne()]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await waitFor(() => expect(field('g702_n5_project').value).toBe('2'))

    fireEvent.change(field('g702_n5_project'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/Application 1 is already saved on this job\. Open it from the list/)).toBeTruthy()
  })

  it('keeps what Generate downloaded on the job', async () => {
    setWide(true)
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await waitFor(() => expect(field('g702_h18_original_contract_sum').value).toBe('48500'))

    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    expect(await screen.findByText(/Workbook downloaded\. Not saved on the job: Type the application number/)).toBeTruthy()

    fireEvent.change(field('g702_n5_project'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    expect(await screen.findByText('Workbook downloaded. Application 1 saved on the job.')).toBeTruthy()
    expect(saveSpy).toHaveBeenCalledTimes(1)
  })

  it('deletes a saved application after asking', async () => {
    setWide(true)
    onJob = [savedOne()]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await waitFor(() => expect(field('g702_n5_project').value).toBe('2'))
    fireEvent.click(screen.getByRole('button', { name: /^1 · 09\/30\/2026/ }))
    await waitFor(() => expect(field('g702_n5_project').value).toBe('1'))

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Delete application 1?')).toBeTruthy()
    const buttons = screen.getAllByRole('button', { name: 'Delete' })
    fireEvent.click(buttons[buttons.length - 1]!)
    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('app-1'))
    // With nothing saved, the new application is the first again.
    await waitFor(() => expect(screen.getByRole('button', { name: 'New · 1' })).toBeTruthy())
    expect(field('g702_n5_project').value).toBe('')
  })

  it('takes a percent done for a line and works out this period, and the other way round', async () => {
    setWide(true)
    onJob = [savedOne()]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await waitFor(() => expect(field('g702_n5_project').value).toBe('2'))
    // Application 2 opens with 19,400 before and nothing this period: 40% done.
    expect(lineField('pct').value).toBe('40')

    fireEvent.change(lineField('pct'), { target: { value: '90' } })
    // 90% of 48,500 is 43,650; 19,400 was claimed before.
    expect(lineField('this').value).toBe('24250')
    expect(screen.getByLabelText('G703 continuation sheet').textContent).toContain('$24,250.00')

    fireEvent.blur(lineField('pct'))
    fireEvent.change(lineField('this'), { target: { value: '4850' } })
    expect(lineField('pct').value).toBe('50')
  })

  it('adds a line and removes one: the sheet gains a row and the totals follow', async () => {
    setWide(true)
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await waitFor(() => expect(field('g702_h18_original_contract_sum').value).toBe('48500'))
    expect(screen.getAllByTestId('aia-line')).toHaveLength(1)
    expect(screen.getByTestId('aia-lines').textContent).toContain('1 of 34 rows')
    // One line cannot be removed.
    expect(screen.queryByRole('button', { name: 'Remove line 001' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Add a line' }))
    const cards = screen.getAllByTestId('aia-line')
    expect(cards).toHaveLength(2)
    const newId = (cards[1]!.querySelector('input') as HTMLInputElement).id.replace(/^aia-line-|-label$/g, '')
    fireEvent.change(lineField('label', newId), { target: { value: 'CO 1: Added hose bibbs' } })
    fireEvent.change(lineField('scheduled', newId), { target: { value: '3,200' } })
    fireEvent.change(lineField('this', newId), { target: { value: '3200' } })

    const sheet = screen.getByLabelText('G703 continuation sheet')
    expect(sheet.querySelectorAll('[data-aia-row]')).toHaveLength(2)
    expect(sheet.textContent).toContain('CO 1: Added hose bibbs')
    // 19,400 on the first line and 3,200 on the second, less 10%.
    expect(screen.getByLabelText('G702 page').textContent).toContain('CURRENT PAYMENT DUE$20,340.00')

    fireEvent.change(field('g702_n5_project'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1))
    const write = saveSpy.mock.calls[0]![0]
    expect((write.lines as PayApplicationLine[]).map((l) => [l.label, l.scheduledValue, l.thisPeriod])).toEqual([
      ['', 48500, 19400],
      ['CO 1: Added hose bibbs', 3200, 3200],
    ])
    expect(write.total_completed_and_stored).toBe(22600)

    fireEvent.click(screen.getByRole('button', { name: 'Remove line 002' }))
    expect(screen.getAllByTestId('aia-line')).toHaveLength(1)
    expect(screen.getByLabelText('G702 page').textContent).toContain('CURRENT PAYMENT DUE$17,460.00')
  })

  it('puts the cursor in a line\'s field when its box is pressed on the sheet', async () => {
    setWide(true)
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await waitFor(() => expect(field('g702_h18_original_contract_sum').value).toBe('48500'))
    fireEvent.click(cell('line:line-1:this'))
    await waitFor(() => expect(document.activeElement).toBe(lineField('this')))
    fireEvent.click(cell('line:line-1:label'))
    await waitFor(() => expect(document.activeElement).toBe(lineField('label')))
  })

  it('hands Generate the lines, and says so when the sheet cannot hold them', async () => {
    setWide(true)
    const many: PayApplicationLine[] = Array.from({ length: 35 }, (_, i) => ({ id: `l${i}`, label: `Line ${i + 1}`, scheduledValue: 100, labor: null, stage: null, fromPrevious: 0, thisPeriod: 0, stored: 0 }))
    const w = payApplicationWriteFromForm('job-x', { values: { g702_n5_project: '1' }, lines: many, splitLaborMaterial: false })
    if (!w.ok) throw new Error(w.reason)
    onJob = [savedPayApplicationFromRow({ id: 'app-1', updated_at: null, ...w.row } as PayApplicationRow)]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" initialApplicationNumber={1} />)
    await waitFor(() => expect(screen.getAllByTestId('aia-line')).toHaveLength(35))
    expect(screen.getByTestId('aia-lines-over').textContent).toContain('holds 34 rows and this application has 35')

    // With one line taken off it fits, and Generate is handed the 34.
    fireEvent.click(screen.getByRole('button', { name: 'Remove line 035' }))
    expect(screen.queryByTestId('aia-lines-over')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    await waitFor(() => expect(fillSpy).toHaveBeenCalledTimes(1))
    expect(fillSpy.mock.calls[0]![2]).toHaveLength(34)
    expect(fillSpy.mock.calls[0]![3]).toEqual({ splitLaborMaterial: false })
  })

  it('shows the labor and material switch only when a line carries a split', async () => {
    setWide(true)
    const w = payApplicationWriteFromForm('job-x', {
      values: { g702_n5_project: '1', g702_c28_retainage_percent: 10 },
      lines: [{ id: 'a', label: 'Top-out', scheduledValue: 28800, labor: 12960, stage: 'top_out', fromPrevious: 14400, thisPeriod: 11520, stored: 0 }],
      splitLaborMaterial: false,
    })
    if (!w.ok) throw new Error(w.reason)
    onJob = [savedPayApplicationFromRow({ id: 'app-1', updated_at: null, ...w.row } as PayApplicationRow)]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" initialApplicationNumber={1} />)
    await waitFor(() => expect(lineField('label', 'a').value).toBe('Top-out'))

    const sheet = screen.getByLabelText('G703 continuation sheet')
    expect(sheet.querySelectorAll('[data-aia-row]')).toHaveLength(1)
    fireEvent.click(screen.getByLabelText('Labor and material on their own rows'))
    expect(sheet.querySelectorAll('[data-aia-row]')).toHaveLength(2)
    expect(sheet.textContent).toContain('Top-out, labor')
    expect(sheet.textContent).toContain('Top-out, material')
    expect(screen.getByTestId('aia-lines').textContent).toContain('2 of 34 rows')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1))
    expect(saveSpy.mock.calls[0]![0].split_labor_material).toBe(true)
  })
})
