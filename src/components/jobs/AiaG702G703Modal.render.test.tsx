// @vitest-environment jsdom
/**
 * Render smoke for the AIA G702-G703 window with its paper preview: wide, the paper sits left of
 * the form and follows it as you type; a box left empty is empty; a box pressed on
 * the paper puts the cursor in its field; narrow, Form / Preview swap the two.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import AiaG702G703Modal from './AiaG702G703Modal'
import { payApplicationWriteFromForm, savedPayApplicationFromRow, type PayApplicationRow, type PayApplicationWrite, type SavedPayApplication } from '../../lib/aiaPayApplications'
import type { PayApplicationLine } from '../../lib/aiaPayApplicationLines'
import type { BidSchedule } from '../../lib/aiaBidSchedule'
import type { SentCopy } from '../../lib/sent/sentCopies'
import { payApplicationSnapshot } from '../../lib/aiaPayApplicationHistory'

// v2.5032 · a test may sign in as a role that cannot write the applications.
let authRole = 'dev'
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: authRole }) }))
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

// The bid's schedule of values, when a test gives the job one.
let schedule: BidSchedule | null = null
const scheduleSpy = vi.fn((_bidId: string, _price: number) => Promise.resolve(schedule))
vi.mock('../../lib/aiaBidScheduleIo', () => ({ loadBidScheduleForJob: (bidId: string, price: number) => scheduleSpy(bidId, price) }))

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
// The applications taken off the job (v2.4715): a list the tests set; Delete reads it again.
let deletedOnJob: SavedPayApplication[] = []
// Put it back (#92): refused when a live application holds the number, else the row moves back to the live list.
const restoreSpy = vi.fn((app: SavedPayApplication) => {
  if (onJob.some((a) => a.applicationNumber === app.applicationNumber)) return Promise.reject(new TakenError(app.applicationNumber))
  deletedOnJob = deletedOnJob.filter((a) => a.id !== app.id)
  onJob = [...onJob, { ...app, deletedAt: null, deletedByName: '' }]
  return Promise.resolve()
})
// v2.5032 · tie an application to a bill: the row moves to that bill on the next read.
const tieSpy = vi.fn((appId: string, invoiceId: string | null) => {
  onJob = onJob.map((a) => (a.id === appId ? { ...a, invoiceId } : a))
  return Promise.resolve()
})
vi.mock('../../lib/aiaPayApplicationsIo', () => ({
  PayApplicationNumberTaken: TakenError,
  tiePayApplicationBill: (appId: string, invoiceId: string | null) => tieSpy(appId, invoiceId),
  loadPayApplications: () => Promise.resolve(onJob),
  loadDeletedPayApplications: () => Promise.resolve(deletedOnJob),
  savePayApplication: (write: PayApplicationWrite, id: string | null) => saveSpy(write, id),
  deletePayApplication: (id: string) => deleteSpy(id),
  restorePayApplication: (app: SavedPayApplication) => restoreSpy(app),
}))
// Sent copies (v2.4575): the workbook that was downloaded is filed; the stub keeps what was filed.
// The history (v2.4710) reads the job's copies back and opens a kept workbook.
const filedSpy = vi.fn((_filing: Record<string, unknown>, _body: { fileName: string; contentType: string; blob: Blob }) => Promise.resolve(true))
let sentOnJob: SentCopy[] = []
const openFileSpy = vi.fn((_path: string) => Promise.resolve(true))
vi.mock('../../lib/sent/sentCopiesIo', () => ({
  fileSentCopy: (filing: Record<string, unknown>, body: { fileName: string; contentType: string; blob: Blob }) => filedSpy(filing, body),
  loadSentCopiesForJob: () => Promise.resolve(sentOnJob),
  openSentFile: (path: string) => openFileSpy(path),
}))

/** A workbook filed on an application, as the sent copies table reads it. */
function workbook(p: Partial<SentCopy>): SentCopy {
  return {
    id: 'copy-1',
    kind: 'pay_application',
    title: 'Pay application 1 · AIA G702-G703',
    how: 'download',
    recipientName: '',
    recipientEmails: [],
    subject: '',
    sourceTable: 'job_pay_applications',
    sourceId: 'app-1',
    copyPath: 'copy-1/J1023-App1.xlsx',
    copyType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    copyHash: 'h1',
    attachments: [],
    sentAt: '2026-10-02T15:12:00Z',
    sentByName: 'Taunya',
    sourceSnapshot: null,
    ...p,
  }
}
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
/** The history opens first on a job with saved applications: these press through it. */
const openNew = async () => fireEvent.click(await screen.findByRole('button', { name: /^New application · \d+$/ }))
const openSaved = async (no: number) => fireEvent.click(await screen.findByRole('button', { name: `Open application ${no}` }))
const toHistory = () => fireEvent.click(screen.getByRole('button', { name: '← Pay applications' }))

beforeEach(() => {
  authRole = 'dev'
  tieSpy.mockClear()
  onJob = []
  sentOnJob = []
  deletedOnJob = []
  schedule = null
  scheduleSpy.mockClear()
  filedSpy.mockClear()
  openFileSpy.mockClear()
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
    // It is now the application that is open, and the job has a history to go back to.
    expect(screen.getByTestId('aia-applications').textContent).toContain('Application 1')
    expect(screen.getByRole('button', { name: '← Pay applications' })).toBeTruthy()
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

  it('names a saved application, shows the name in the list, and renames or clears it on a later save', async () => {
    setWide(true)
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await waitFor(() => expect(field('g702_h18_original_contract_sum').value).toBe('48500'))
    const nameBox = screen.getByLabelText(/^NAME/) as HTMLInputElement

    // A save with no name leaves the column alone.
    fireEvent.change(field('g702_n5_project'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1))
    expect('name' in saveSpy.mock.calls[0]![0]).toBe(false)

    // Typing a name makes the form unsaved; Save writes it and the list shows it.
    fireEvent.change(nameBox, { target: { value: 'Sent to the GC' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(2))
    expect(saveSpy.mock.calls[1]![0].name).toBe('Sent to the GC')
    expect(saveSpy.mock.calls[1]![1]).toBe('new-1')
    await waitFor(() => expect(screen.getByTestId('aia-applications').textContent).toContain('Application 1 · Sent to the GC'))

    // Renaming is the same box and Save.
    fireEvent.change(nameBox, { target: { value: 'Revised after the walk' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(3))
    expect(saveSpy.mock.calls[2]![0].name).toBe('Revised after the walk')
    await waitFor(() => expect(screen.getByTestId('aia-applications').textContent).toContain('Application 1 · Revised after the walk'))

    // Clearing it writes the empty name, so the old one does not stay.
    fireEvent.change(nameBox, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(4))
    expect(saveSpy.mock.calls[3]![0].name).toBe('')
  })

  it('opens a new application with no name, whatever the last one was called', async () => {
    setWide(true)
    onJob = [{ ...savedOne(), name: 'Sent to the GC' }]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await openNew()
    await waitFor(() => expect(field('g702_n5_project').value).toBe('2'))
    expect((screen.getByLabelText(/^NAME/) as HTMLInputElement).value).toBe('')
    toHistory()
    expect((await screen.findByTestId('aia-history-pane')).textContent).toContain('1 · Sent to the GC')
    await openSaved(1)
    await waitFor(() => expect((screen.getByLabelText(/^NAME/) as HTMLInputElement).value).toBe('Sent to the GC'))
  })

  it('starts the next application from the last one saved', async () => {
    setWide(true)
    onJob = [savedOne()]
    // The job today: 60% of 48,500 is 29,100 created.
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={{ ...job, pct_complete: 60 }} hcpForFilename="1023" />)
    await openNew()
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
    toHistory()
    await openSaved(1)
    await waitFor(() => expect(field('g702_n5_project').value).toBe('1'))
    expect(lineField('from').value).toBe('')
    expect(screen.getByLabelText('G702 page').textContent).toContain('CURRENT PAYMENT DUE$17,460.00')
  })

  it('offers 5% retainage once the job is past halfway, and Use 5% takes it', async () => {
    setWide(true)
    onJob = [savedOne()]
    // 60% of 48,500 created: application 2 opens with 19,400 before and 9,700 now.
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={{ ...job, pct_complete: 60 }} hcpForFilename="1023" />)
    await openNew()
    await waitFor(() => expect(field('g702_n5_project').value).toBe('2'))

    const offer = screen.getByTestId('aia-retainage-drop')
    expect(offer.textContent).toContain('This job is 60% complete.')
    expect(offer.textContent).toContain('Held would go from $2,910.00 to $1,455.00, and $1,455.00 more would be due.')
    fireEvent.click(screen.getByRole('button', { name: 'Use 5%' }))
    expect(field('g702_c28_retainage_percent').value).toBe('5')
    expect(screen.queryByTestId('aia-retainage-drop')).toBeNull()
    // 29,100 at 5% leaves 27,645 earned; 17,460 was certified before.
    expect(screen.getByLabelText('G702 page').textContent).toContain('CURRENT PAYMENT DUE$10,185.00')

    // Application 1 was 40% complete: no offer there. Going back asks about the 5% that was typed.
    toHistory()
    fireEvent.click(await screen.findByRole('button', { name: 'Leave' }))
    await openSaved(1)
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
    // Its line in the history carries the mark; application 1's does not.
    toHistory()
    expect((await screen.findAllByTestId('aia-history-flag')).map((f) => f.textContent)).toEqual(['⚠ No longer matches application 1. No reason given yet.'])
    await openSaved(2)
    await waitFor(() => expect(field('g702_n5_project').value).toBe('2'))

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
    await openNew()
    await waitFor(() => expect(field('g702_n5_project').value).toBe('2'))

    fireEvent.change(field('g702_n6_period_to'), { target: { value: '10/31/2026' } })
    toHistory()
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
    await openNew()
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
    // Each download files the workbook itself: the first with no saved application to point at, the second on its row.
    expect(filedSpy).toHaveBeenCalledTimes(2)
    expect(filedSpy.mock.calls[0]![0]).toMatchObject({ kind: 'pay_application', how: 'download', jobIds: [job.id], source: null, sourceSnapshot: null })
    const [filing, body] = filedSpy.mock.calls[1]!
    expect(filing).toMatchObject({ kind: 'pay_application', title: 'Pay application 1 · AIA G702-G703', how: 'download', jobIds: [job.id] })
    expect((filing.source as { table: string }).table).toBe('job_pay_applications')
    // What the application said goes with the workbook, so a later save can be named against it.
    expect(filing.sourceSnapshot).toMatchObject({ applicationNumber: 1, totalCompletedAndStored: 19400, currentPaymentDue: 17460 })
    expect((filing.sourceSnapshot as { lines: unknown[] }).lines).toHaveLength(1)
    expect(body.fileName).toMatch(/\.xlsx$/)
    expect(body.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(body.blob.size).toBe(8)
  })

  it('deletes a saved application after asking', async () => {
    setWide(true)
    onJob = [savedOne()]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await openSaved(1)
    await waitFor(() => expect(field('g702_n5_project').value).toBe('1'))

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Delete application 1?')).toBeTruthy()
    const buttons = screen.getAllByRole('button', { name: 'Delete' })
    fireEvent.click(buttons[buttons.length - 1]!)
    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('app-1'))
    // With nothing saved there is no history to go back to: the new application is the first again.
    await waitFor(() => expect(screen.getByTestId('aia-applications').textContent).toContain('New application 1'))
    expect(screen.queryByRole('button', { name: '← Pay applications' })).toBeNull()
    expect(field('g702_n5_project').value).toBe('')
  })

  it('opens on the job\'s history: where it stands, each application\'s stops, the workbooks that went out, and the door to the next', async () => {
    setWide(true)
    const one = { ...savedOne(), createdAt: '2026-10-02T15:00:00Z', createdByName: 'Taunya', updatedByName: 'Taunya' }
    const two = { ...savedTwo(), createdAt: '2026-11-02T15:00:00Z', updatedAt: '2026-11-05T20:31:00Z', createdByName: 'Taunya', updatedByName: 'Robert' }
    onJob = [one, two]
    sentOnJob = [
      workbook({ id: 'copy-1', sentAt: '2026-10-02T15:12:00Z' }),
      workbook({ id: 'copy-1b', sentAt: '2026-10-02T15:40:00Z', copyPath: 'copy-1b/J1023-App1.xlsx' }),
      workbook({ id: 'copy-2', sourceId: 'app-2', sentAt: '2026-11-02T15:05:00Z', copyPath: 'copy-2/J1023-App2.xlsx', sentByName: 'Taunya' }),
      // A copy that could not be kept, and a bill sent from the job: the first is said, the second is another paper.
      workbook({ id: 'copy-3', sourceId: null, sentAt: '2026-10-01T15:05:00Z', copyPath: null }),
      workbook({ id: 'copy-4', kind: 'bill', sourceId: null, sentAt: '2026-10-01T16:05:00Z' }),
    ]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)

    const pane = await screen.findByTestId('aia-history-pane')
    // The paper and the form wait: no field is drawn yet, and the Form / Preview switch is not offered.
    expect(screen.queryByTestId('aia-preview-pane')).toBeNull()
    expect(document.getElementById('aia-field-g702_n5_project')).toBeNull()
    expect(pane.textContent).toContain('2 saved · $26,190.00 certified · 60% complete')
    // 29,100 of 48,500 to date, 2,910 held, 19,400 of work left.
    const summary = screen.getByTestId('aia-history-summary')
    expect(summary.textContent).toContain('CONTRACT TO DATE$48,500.00')
    expect(summary.textContent).toContain('COMPLETED AND STORED$29,100.00 60%')
    expect(summary.textContent).toContain('HELD AS RETAINAGE$2,910.00')
    expect(summary.textContent).toContain('WORK LEFT$19,400.00')

    const lines = screen.getAllByTestId('aia-history-line')
    expect(lines).toHaveLength(2)
    expect(lines[0]!.textContent).toContain('1 · period to 09/30/2026')
    expect(lines[0]!.textContent).toContain('$17,460.00 due')
    expect(lines[0]!.textContent).toContain('Saved Oct 2 by Taunya')
    expect(lines[1]!.textContent).toContain('Saved Nov 2 by Taunya · saved again Nov 5 by Robert')
    // Each workbook that went out, newest first, with the file to open.
    const wentOut = screen.getAllByTestId('aia-history-went-out')
    expect(wentOut.map((w) => w.textContent)).toEqual([
      'Went out Oct 2, 10:40 AM by Taunyaas J1023-App1.xlsx',
      'Went out Oct 2, 10:12 AM by Taunyaas J1023-App1.xlsx',
      'Went out Nov 2, 9:05 AM by Taunyaas J1023-App2.xlsx',
      'Went out Oct 1, 10:05 AM by TaunyaThe copy was not kept.',
    ])
    expect(screen.getByTestId('aia-history-unsaved').textContent).toContain('Downloaded with no number typed')
    fireEvent.click(screen.getByRole('button', { name: 'J1023-App2.xlsx' }))
    await waitFor(() => expect(openFileSpy).toHaveBeenCalledWith('copy-2/J1023-App2.xlsx'))

    // The door to the next application: it starts from 2 and the form opens on it.
    expect(pane.textContent).toContain('Starts from application 2 as it is saved now.')
    await openNew()
    await waitFor(() => expect(field('g702_n5_project').value).toBe('3'))
    expect(screen.getByTestId('aia-preview-pane')).toBeTruthy()
    expect(screen.getByTestId('aia-applications').textContent).toContain('New application 3')
    // And back, with nothing typed, straight away.
    toHistory()
    expect(await screen.findByTestId('aia-history-pane')).toBeTruthy()
    // Open puts a saved application in the form, saying who saved it.
    await openSaved(2)
    await waitFor(() => expect(field('g702_n5_project').value).toBe('2'))
    expect(screen.getByTestId('aia-applications').textContent).toContain('Application 2')
    expect(screen.getByTestId('aia-applications').textContent).toContain('Saved Nov 2 by Taunya · saved again Nov 5 by Robert. You can change it and save it again.')
  })

  it('names what moved since the workbook went out, against the figures filed with it', async () => {
    setWide(true)
    // Application 1 went out at 19,400 this period and was then saved again at 21,000.
    const went = payApplicationSnapshot(savedOne())
    onJob = [savedOneChanged()]
    sentOnJob = [workbook({ id: 'copy-1', sourceSnapshot: went as unknown as Record<string, unknown>, sentAt: '2026-10-02T15:12:00Z' })]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    const flag = await screen.findByTestId('aia-history-changed')
    expect(flag.textContent).toContain('Changed after it went out Oct 2: Plumbing this period $19,400.00 → $21,000.00 · completed and stored $19,400.00 → $21,000.00 · retainage held $1,940.00 → $2,100.00 · payment due $17,460.00 → $18,900.00.')
    expect(flag.textContent).toContain('The GC has the Oct 2 workbook. Generate it again to send the change, or open it and put the amounts back.')
  })

  it('in the form, names what moved since it went out and puts the amounts back, unsaved; Save keeps them (#92)', async () => {
    setWide(true)
    const went = payApplicationSnapshot(savedOne())
    onJob = [savedOneChanged()]
    sentOnJob = [workbook({ id: 'copy-1', sourceSnapshot: went as unknown as Record<string, unknown>, sentAt: '2026-10-02T15:12:00Z' })]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await openSaved(1)
    const note = await screen.findByTestId('aia-changed-after')
    expect(note.textContent).toContain('Changed after it went out Oct 2.')
    expect(note.textContent).toContain('Plumbing this period: $19,400.00 went out, $21,000.00 now.')
    expect(note.textContent).toContain('payment due: $17,460.00 went out, $18,900.00 now.')
    fireEvent.click(screen.getByRole('button', { name: 'Put the amounts back' }))
    expect(await screen.findByText('The amounts are back as they went out Oct 2. Save to keep them.')).toBeTruthy()
    // The form now says what the GC has, so there is nothing left to name; it is not saved until Save.
    expect(screen.queryByTestId('aia-changed-after')).toBeNull()
    expect(saveSpy).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1))
    const [write, id] = saveSpy.mock.calls[0]!
    expect(id).toBe(onJob[0]!.id)
    expect(write.lines).toEqual([expect.objectContaining({ thisPeriod: 19400 })])
    expect(write.current_payment_due).toBe(17460)
  })

  it('a form that matches the workbook shows no changed-after note (#92)', async () => {
    setWide(true)
    onJob = [savedOne()]
    sentOnJob = [workbook({ id: 'copy-1', sourceSnapshot: payApplicationSnapshot(savedOne()) as unknown as Record<string, unknown>, sentAt: '2026-10-02T15:12:00Z' })]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await openSaved(1)
    await waitFor(() => expect(field('g702_n5_project').value).toBe('1'))
    expect(screen.queryByTestId('aia-changed-after')).toBeNull()
  })

  it('starts on a new application when asked to, and offers no Form / Preview switch on a narrow history', async () => {
    setWide(true)
    onJob = [savedOne()]
    const { unmount } = renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" startOn="new" />)
    await waitFor(() => expect(field('g702_n5_project').value).toBe('2'))
    expect(screen.queryByTestId('aia-history-pane')).toBeNull()
    unmount()

    setWide(false)
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await screen.findByTestId('aia-history-pane')
    expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull()
    await openNew()
    expect(await screen.findByRole('button', { name: 'Preview' })).toBeTruthy()
  })

  it('lists the workbook Generate filed once the history is read again', async () => {
    setWide(true)
    onJob = [savedOne()]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await openNew()
    await waitFor(() => expect(field('g702_n5_project').value).toBe('2'))
    expect(screen.queryByTestId('aia-history-went-out')).toBeNull()

    // The filing lands in the table; the read after it brings the workbook back.
    sentOnJob = [workbook({ id: 'copy-2', sourceId: 'new-2', title: 'Pay application 2 · AIA G702-G703', copyPath: 'copy-2/J1023-App2.xlsx', sentAt: '2026-11-02T15:05:00Z' })]
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    expect(await screen.findByText('Workbook downloaded. Application 2 saved on the job.')).toBeTruthy()
    await waitFor(() => expect(filedSpy).toHaveBeenCalledTimes(1))
    toHistory()
    await screen.findByTestId('aia-history-pane')
    await waitFor(() => expect(screen.getAllByTestId('aia-history-line')).toHaveLength(2))
    expect(screen.getAllByTestId('aia-history-went-out').map((w) => w.textContent)).toEqual(['Went out Nov 2, 9:05 AM by Taunyaas J1023-App2.xlsx'])
  })

  it('deletes from the form and lands on the history when applications remain', async () => {
    setWide(true)
    onJob = [savedOne(), savedTwo()]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await openSaved(2)
    await waitFor(() => expect(field('g702_n5_project').value).toBe('2'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const buttons = await screen.findAllByRole('button', { name: 'Delete' })
    // The row is marked, not gone: the read after the delete brings it back as a deleted line.
    deletedOnJob = [{ ...savedTwo(), deletedAt: '2026-11-06T15:00:00Z', deletedByName: 'Robert' }]
    fireEvent.click(buttons[buttons.length - 1]!)
    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('app-2'))
    expect(await screen.findByTestId('aia-history-pane')).toBeTruthy()
    expect(screen.getAllByTestId('aia-history-line')).toHaveLength(1)
    const gone = await screen.findByTestId('aia-history-deleted')
    expect(gone.textContent).toContain('2 · period to 10/31/2026 · deleted')
    expect(gone.textContent).toContain('$8,730.00 due')
    expect(gone.textContent).toContain('Deleted Nov 6 by Robert')
    expect(screen.queryByRole('button', { name: 'Open application 2' })).toBeNull()
    // The next application starts from the live one.
    expect(screen.getByRole('button', { name: 'New application · 2' })).toBeTruthy()
  })

  it('lists an application taken off the job after the live ones, with its workbooks and no door', async () => {
    setWide(true)
    onJob = [savedOne()]
    deletedOnJob = [{ ...savedTwo(), id: 'app-2-old', deletedAt: '2026-11-06T15:00:00Z', deletedByName: 'Robert' }]
    sentOnJob = [workbook({ id: 'copy-2', sourceId: 'app-2-old', copyPath: 'copy-2/J1023-App2.xlsx', sentAt: '2026-11-02T15:05:00Z' })]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await screen.findByTestId('aia-history-pane')
    expect(screen.getAllByTestId('aia-history-line')).toHaveLength(1)
    const gone = screen.getByTestId('aia-history-deleted')
    expect(gone.textContent).toContain('Deleted Nov 6 by Robert')
    expect(gone.textContent).toContain('Went out Nov 2, 9:05 AM by Taunyaas J1023-App2.xlsx')
    expect(screen.queryByRole('button', { name: 'Open application 2' })).toBeNull()
    // The standing and the next number come from the live application alone.
    expect(screen.getByTestId('aia-history-pane').textContent).toContain('1 saved · $17,460.00 certified · 40% complete')
    expect(screen.getByRole('button', { name: 'New application · 2' })).toBeTruthy()
  })

  it('Put it back returns a deleted application to the job: a live line again, and the next number moves (#92)', async () => {
    setWide(true)
    onJob = [savedOne()]
    deletedOnJob = [{ ...savedTwo(), id: 'app-2-old', deletedAt: '2026-11-06T15:00:00Z', deletedByName: 'Robert' }]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await screen.findByTestId('aia-history-pane')
    fireEvent.click(screen.getByRole('button', { name: 'Put application 2 back' }))
    expect(await screen.findByText('Application 2 is back on the job.')).toBeTruthy()
    expect(restoreSpy).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'app-2-old', applicationNumber: 2 }))
    expect(screen.getAllByTestId('aia-history-line')).toHaveLength(2)
    expect(screen.queryByTestId('aia-history-deleted')).toBeNull()
    expect(screen.getByRole('button', { name: 'Open application 2' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New application · 3' })).toBeTruthy()
  })

  it('deleting the last application lands on the history, where Put it back undoes it (#92)', async () => {
    setWide(true)
    onJob = [savedOne()]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await openSaved(1)
    await waitFor(() => expect(field('g702_n5_project').value).toBe('1'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const buttons = await screen.findAllByRole('button', { name: 'Delete' })
    deletedOnJob = [{ ...savedOne(), deletedAt: '2026-11-06T15:00:00Z', deletedByName: 'Robert' }]
    onJob = []
    fireEvent.click(buttons[buttons.length - 1]!)
    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('app-1'))
    expect(await screen.findByTestId('aia-history-deleted')).toBeTruthy()
    expect(screen.getByTestId('aia-history-pane').textContent).toContain('Nothing is saved on this job yet.')
    expect(screen.getByRole('button', { name: 'New application · 1' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Put application 1 back' }))
    expect(await screen.findByText('Application 1 is back on the job.')).toBeTruthy()
    expect(screen.getAllByTestId('aia-history-line')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'New application · 2' })).toBeTruthy()
  })

  it('Put it back onto a number another application now holds says what to do and changes nothing (#92)', async () => {
    setWide(true)
    onJob = [savedOne(), savedTwo()]
    deletedOnJob = [{ ...savedTwo(), id: 'app-2-old', deletedAt: '2026-11-06T15:00:00Z', deletedByName: 'Robert' }]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await screen.findByTestId('aia-history-pane')
    fireEvent.click(screen.getByRole('button', { name: 'Put application 2 back' }))
    expect(await screen.findByText('Another application 2 is live on this job. Delete it, or open it and give it another number, then put this one back.')).toBeTruthy()
    expect(screen.getAllByTestId('aia-history-line')).toHaveLength(2)
    expect(screen.getByTestId('aia-history-deleted')).toBeTruthy()
  })

  it('takes a percent done for a line and works out this period, and the other way round', async () => {
    setWide(true)
    onJob = [savedOne()]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await openNew()
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

  /** A bid left on the three stages, spread over a 96,000 job, with labor and material apart. */
  const stageSchedule = (): BidSchedule => ({
    shape: 'stage',
    splitLaborMaterial: true,
    lines: [
      { id: 'stage-rough_in', label: 'Rough In', scheduledValue: 33600, labor: 15120, stage: 'rough_in', fromPrevious: 0, thisPeriod: 0, stored: 0 },
      { id: 'stage-top_out', label: 'Top Out', scheduledValue: 38400, labor: 17280, stage: 'top_out', fromPrevious: 0, thisPeriod: 0, stored: 0 },
      { id: 'stage-trim_set', label: 'Trim Set', scheduledValue: 24000, labor: 10800, stage: 'trim_set', fromPrevious: 0, thisPeriod: 0, stored: 0 },
    ],
  })
  /** The job of that bid: its own stage lines carry what the crew reported. */
  const bidJob = (revenue = 96000) =>
    makeJob({
      job_name: 'Cedar Ridge Clubhouse',
      bid_id: 'bid-9',
      revenue,
      fixtures: [
        { id: 'f1', name: 'Rough In', count: 1, line_unit_price: 33600, progress_pct: 100 },
        { id: 'f2', name: 'Top Out', count: 1, line_unit_price: 38400, progress_pct: 90 },
        { id: 'f3', name: 'Trim Set', count: 1, line_unit_price: 24000, progress_pct: null },
      ],
    })

  it('starts application 1 from the bid\'s schedule of values, split as the bid prints it', async () => {
    setWide(true)
    schedule = stageSchedule()
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={bidJob()} hcpForFilename="1041" />)
    await waitFor(() => expect(screen.getAllByTestId('aia-line')).toHaveLength(3))
    expect(scheduleSpy).toHaveBeenCalledWith('bid-9', 96000)
    expect(screen.getByTestId('aia-applications').textContent).toContain("The lines come from the bid's schedule of values.")
    expect(lineField('label', 'stage-top_out').value).toBe('Top Out')
    expect(lineField('scheduled', 'stage-top_out').value).toBe('38400')
    // The bid prints labor and material apart, so the job starts that way: six rows.
    expect((screen.getByLabelText('Labor and material on their own rows') as HTMLInputElement).checked).toBe(true)
    expect(screen.getByLabelText('G703 continuation sheet').querySelectorAll('[data-aia-row]')).toHaveLength(6)
    // The lines add to the job's price: nothing to scale.
    expect(screen.queryByTestId('aia-lines-gap')).toBeNull()
  })

  it('offers the crew\'s percent on a line of its stage, and Use takes it', async () => {
    setWide(true)
    schedule = stageSchedule()
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={bidJob()} hcpForFilename="1041" />)
    await waitFor(() => expect(screen.getAllByTestId('aia-line')).toHaveLength(3))

    // Rough In at 100% and Top Out at 90% were reported; Trim Set has no report.
    expect(screen.getAllByTestId('aia-line-offer').map((o) => o.textContent)).toEqual(['The crew reported Rough In at 100%.Use 100%', 'The crew reported Top Out at 90%.Use 90%'])
    fireEvent.click(screen.getByRole('button', { name: 'Use 90%' }))
    // 90% of 38,400.
    expect(lineField('this', 'stage-top_out').value).toBe('34560')
    expect(lineField('pct', 'stage-top_out').value).toBe('90')
    fireEvent.click(screen.getByRole('button', { name: 'Use 100%' }))
    expect(screen.queryByTestId('aia-line-offer')).toBeNull()
    // 33,600 + 34,560 = 68,160, less 10%.
    expect(screen.getByLabelText('G702 page').textContent).toContain('CURRENT PAYMENT DUE$61,344.00')
  })

  it('says when the lines do not add to the contract, and scales them to it', async () => {
    setWide(true)
    schedule = stageSchedule()
    // The job was sold at 99,200; the lines add to 96,000.
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={bidJob(99200)} hcpForFilename="1041" />)
    await waitFor(() => expect(screen.getAllByTestId('aia-line')).toHaveLength(3))
    const gap = screen.getByTestId('aia-lines-gap')
    expect(gap.textContent).toContain('The lines add to $96,000.00. The contract to date is $99,200.00. They are $3,200.00 short.')

    fireEvent.click(screen.getByRole('button', { name: 'Scale the lines to $99,200.00' }))
    expect(screen.queryByTestId('aia-lines-gap')).toBeNull()
    expect(['stage-rough_in', 'stage-top_out', 'stage-trim_set'].map((id) => lineField('scheduled', id).value)).toEqual(['34720', '39680', '24800'])
  })

  it('does not go back to the bid once the job has a saved application', async () => {
    setWide(true)
    schedule = stageSchedule()
    onJob = [savedOne()]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={bidJob()} hcpForFilename="1041" />)
    await openNew()
    await waitFor(() => expect(field('g702_n5_project').value).toBe('2'))
    expect(scheduleSpy).not.toHaveBeenCalled()
    // Application 2 carries application 1's one line.
    expect(screen.getAllByTestId('aia-line')).toHaveLength(1)
    expect(lineField('from').value).toBe('19400')
  })

  /** Job 892's shape: three stage Line Items that add to the job's price, and no bid schedule. */
  const stageItemsJob = (fixtures?: Array<Record<string, unknown>>) =>
    makeJob({
      job_name: 'Megan Connell',
      revenue: 37745,
      fixtures: fixtures ?? [
        { id: 'f1', name: 'Rough In', count: 1, line_unit_price: 15098, progress_pct: 100, sequence_order: 0 },
        { id: 'f2', name: 'Top Out', count: 1, line_unit_price: 15098, progress_pct: null, sequence_order: 1 },
        { id: 'f3', name: 'Trim Set', count: 1, line_unit_price: 7549, progress_pct: null, sequence_order: 2 },
      ],
    })
  const sourceRadio = (key: string) => document.getElementById(`aia-line-source-${key}`) as HTMLInputElement

  it('offers one row or a row per Line Item on a first application, one row picked, and the paper follows the choice', async () => {
    setWide(true)
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={stageItemsJob()} hcpForFilename="892" />)
    await waitFor(() => expect(field('g702_h18_original_contract_sum').value).toBe('37745'))
    const chooser = screen.getByTestId('aia-line-source')
    expect(chooser.textContent).toContain('START THE ROWS FROM')
    expect(chooser.textContent).toContain('One rowThe whole contract, $37,745.00')
    expect(chooser.textContent).toContain('A row per Line Item3 rows: Rough In, Top Out, Trim Set')
    expect(sourceRadio('bid')).toBeNull()
    expect([sourceRadio('one').checked, sourceRadio('items').checked]).toEqual([true, false])
    expect(screen.getAllByTestId('aia-line')).toHaveLength(1)

    // Nothing typed in the row yet, so the switch does not ask.
    fireEvent.click(sourceRadio('items'))
    await waitFor(() => expect(screen.getAllByTestId('aia-line')).toHaveLength(3))
    expect(screen.queryByText('Replace the rows?')).toBeNull()
    expect(['item-f1', 'item-f2', 'item-f3'].map((id) => [lineField('label', id).value, lineField('scheduled', id).value])).toEqual([
      ['Rough In', '15098'],
      ['Top Out', '15098'],
      ['Trim Set', '7549'],
    ])
    expect(screen.getByLabelText('G703 continuation sheet').querySelectorAll('[data-aia-row]')).toHaveLength(3)
    // The rows add to the job's price, and the crew's report on Rough In is offered on its row.
    expect(screen.queryByTestId('aia-lines-gap')).toBeNull()
    expect(screen.getAllByTestId('aia-line-offer').map((o) => o.textContent)).toEqual(['The crew reported Rough In at 100%.Use 100%'])

    // Saved, the rows are the job's and the choice is closed.
    fireEvent.change(field('g702_n5_project'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1))
    expect((saveSpy.mock.calls[0]![0].lines as PayApplicationLine[]).map((l) => [l.id, l.scheduledValue, l.stage])).toEqual([
      ['item-f1', 15098, 'rough_in'],
      ['item-f2', 15098, 'top_out'],
      ['item-f3', 7549, 'trim_set'],
    ])
    await waitFor(() => expect(screen.queryByTestId('aia-line-source')).toBeNull())
  })

  it('does not offer the choice until the job has been read, so a quick press is not undone', async () => {
    setWide(true)
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={stageItemsJob()} hcpForFilename="892" />)
    // First paint: the saved applications and the bid are still being read.
    expect(screen.queryByTestId('aia-line-source')).toBeNull()
    expect(await screen.findByTestId('aia-line-source')).toBeTruthy()
    expect(field('g702_h18_original_contract_sum').value).toBe('37745')
  })

  it('asks before a switch replaces rows that were typed in, and keeps them on Keep', async () => {
    setWide(true)
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={stageItemsJob()} hcpForFilename="892" />)
    await waitFor(() => expect(field('g702_h18_original_contract_sum').value).toBe('37745'))
    fireEvent.change(lineField('label'), { target: { value: 'Plumbing, all of it' } })

    fireEvent.click(sourceRadio('items'))
    expect(await screen.findByText('Replace the rows?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(screen.queryByText('Replace the rows?')).toBeNull())
    expect(lineField('label').value).toBe('Plumbing, all of it')
    expect(sourceRadio('one').checked).toBe(true)

    fireEvent.click(sourceRadio('items'))
    fireEvent.click(await screen.findByRole('button', { name: 'Replace' }))
    await waitFor(() => expect(screen.getAllByTestId('aia-line')).toHaveLength(3))
    expect(sourceRadio('items').checked).toBe(true)

    // Back to one row: the three rows were not typed in, so it does not ask.
    fireEvent.click(sourceRadio('one'))
    await waitFor(() => expect(screen.getAllByTestId('aia-line')).toHaveLength(1))
    expect(lineField('scheduled').value).toBe('37745')
  })

  it('turns a row per Line Item off, and says why, when a Line Item has no price', async () => {
    setWide(true)
    const job = stageItemsJob([
      { id: 'f1', name: 'Rough In', count: 1, line_unit_price: 15098, progress_pct: null },
      { id: 'f2', name: 'Top Out', count: 1, line_unit_price: null, progress_pct: null },
    ])
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="892" />)
    await waitFor(() => expect(field('g702_h18_original_contract_sum').value).toBe('37745'))
    expect(sourceRadio('items').disabled).toBe(true)
    expect(screen.getByTestId('aia-line-source').textContent).toContain('1 Line Item has no price. Price it on the Bill tab to use this.')
  })

  it('has nothing to choose on a job with one Line Item, or once the job has a saved application', async () => {
    setWide(true)
    const { unmount } = renderWithProviders(
      <AiaG702G703Modal open onClose={() => undefined} job={stageItemsJob([{ id: 'f1', name: 'Water heater', count: 1, line_unit_price: 37745, progress_pct: null }])} hcpForFilename="892" />,
    )
    await waitFor(() => expect(field('g702_h18_original_contract_sum').value).toBe('37745'))
    expect(screen.queryByTestId('aia-line-source')).toBeNull()
    unmount()

    onJob = [savedOne()]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={stageItemsJob()} hcpForFilename="892" />)
    await openNew()
    await waitFor(() => expect(field('g702_n5_project').value).toBe('2'))
    expect(screen.queryByTestId('aia-line-source')).toBeNull()
  })

  it('lists the bid\'s schedule as a third start, picked when the job has one, and one row takes its place on a press', async () => {
    setWide(true)
    schedule = stageSchedule()
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={bidJob()} hcpForFilename="1041" />)
    await waitFor(() => expect(screen.getAllByTestId('aia-line')).toHaveLength(3))
    expect([sourceRadio('one').checked, sourceRadio('items').checked, sourceRadio('bid').checked]).toEqual([false, false, true])
    expect(screen.getByTestId('aia-line-source').textContent).toContain("The bid's schedule3 rows: Rough In, Top Out, Trim Set")

    fireEvent.click(sourceRadio('one'))
    await waitFor(() => expect(screen.getAllByTestId('aia-line')).toHaveLength(1))
    expect(lineField('scheduled').value).toBe('96000')
    // One row has no labor part, so the split and the bid's note go with it.
    expect(screen.queryByLabelText('Labor and material on their own rows')).toBeNull()
    expect(screen.getByTestId('aia-applications').textContent).not.toContain("The lines come from the bid's schedule of values.")

    fireEvent.click(sourceRadio('bid'))
    await waitFor(() => expect(screen.getAllByTestId('aia-line')).toHaveLength(3))
    expect((screen.getByLabelText('Labor and material on their own rows') as HTMLInputElement).checked).toBe(true)
  })
})

describe('AiaG702G703Modal · v2.5032 the bill an application became', () => {
  // Application 1 asks for $17,460.00: 19,400 of work less 10% held.
  const billOne = makeInvoice({ id: 'bill-1', amount: 17460, status: 'billed', sequence_order: 1, billed_at: '2026-10-03T15:00:00Z' })
  const billTwo = makeInvoice({ id: 'bill-2', amount: 9000, status: 'billed', sequence_order: 2, billed_at: '2026-10-20T15:00:00Z' })
  const payment = { id: 'p1', job_id: 'job-1', invoice_id: 'bill-1', amount: 17460, paid_on: '2026-10-22', sequence_order: 1, created_at: null, created_by: null, linked_at: null, linked_by: null, mercury_transaction_id: null, note: null, payment_type: 'check', reference_number: null, sent_on: null, stripe_credit_note_id: null }
  const withBills = (payments: unknown[] = []) => makeJob({ job_name: 'Water Sample Test', revenue: 48500, hcp_number: '1023', invoices: [billOne, billTwo], payments })

  it('a tied application reads its bill’s payments the way the job window does', async () => {
    onJob = [{ ...savedOne(), invoiceId: 'bill-1' }]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={withBills([payment])} hcpForFilename="1023" />)
    expect((await screen.findByTestId('aia-history-paid')).textContent).toBe('Paid $17,460.00 · Oct 22')
    expect(screen.getByRole('button', { name: 'Change the bill for application 1' })).toBeTruthy()
  })

  it('an untied one says so; Tie a bill… is pre-filled with the bill of that amount, and Tie it writes it', async () => {
    onJob = [{ ...savedOne(), invoiceId: null }]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={withBills()} hcpForFilename="1023" />)
    expect((await screen.findByTestId('aia-history-paid')).textContent).toBe('Bill not yet tied')
    fireEvent.click(screen.getByRole('button', { name: 'Tie a bill to application 1' }))
    const pick = screen.getByLabelText('Bill for application 1') as HTMLSelectElement
    expect(pick.value).toBe('bill-1')
    expect([...pick.options].map((o) => o.textContent)).toEqual(['No bill', '#1 · $17,460.00 · sent Oct 3', '#2 · $9,000.00 · sent Oct 20'])
    expect(screen.getByTestId('aia-history-bill-pick').textContent).toContain('This bill is the payment due, to the cent.')
    fireEvent.click(screen.getByRole('button', { name: 'Tie it' }))
    await waitFor(() => expect(tieSpy).toHaveBeenCalledWith('app-1', 'bill-1'))
    expect((await screen.findByText('Billed $17,460.00 · nothing paid yet')).getAttribute('data-testid')).toBe('aia-history-paid')
    expect(screen.queryByTestId('aia-history-bill-pick')).toBeNull()
  })

  it('a role that cannot write the applications reads the line and gets no pick', async () => {
    authRole = 'primary'
    onJob = [{ ...savedOne(), invoiceId: null }]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={withBills()} hcpForFilename="1023" />)
    expect((await screen.findByTestId('aia-history-paid')).textContent).toBe('Bill not yet tied')
    expect(screen.queryByRole('button', { name: 'Tie a bill to application 1' })).toBeNull()
  })

  it('no bill line when the read could not ask for the column', async () => {
    onJob = [savedOne()]
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={withBills()} hcpForFilename="1023" />)
    await screen.findAllByTestId('aia-history-line')
    expect(screen.queryByTestId('aia-history-bill')).toBeNull()
  })
})
