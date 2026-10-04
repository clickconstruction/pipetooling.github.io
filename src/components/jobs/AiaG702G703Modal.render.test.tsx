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
vi.mock('../../lib/fillAiaG702G703Workbook', () => ({ fetchAndFillAiaTemplate: () => Promise.resolve(new ArrayBuffer(8)) }))

/** Application 1 as it was saved: 19,400 of a 48,500 contract at 10%. */
function savedOne(): SavedPayApplication {
  const w = payApplicationWriteFromForm('job-x', {
    g702_n5_project: '1',
    g702_n6_period_to: '09/30/2026',
    g702_h6_project_name: 'Water Sample Test',
    g702_d6_owner_name: 'Heron Construction Group',
    g702_h18_original_contract_sum: 48500,
    g702_c28_retainage_percent: 10,
    g703_d13_scheduled_value: 48500,
    g703_f13_this_period: 19400,
  })
  if (!w.ok) throw new Error(w.reason)
  return savedPayApplicationFromRow({ id: 'app-1', updated_at: '2026-10-02T15:00:00Z', ...w.row } as PayApplicationRow)
}

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

beforeEach(() => {
  onJob = []
  saveSpy.mockClear()
  deleteSpy.mockClear()
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
    expect(field('g703_e13_from_previous').value).toBe('19400')
    expect(field('g702_h40_less_previous_certificates').value).toBe('17460')
    expect(field('g703_f13_this_period').value).toBe('9700')
    // 29,100 to date less 10% is 26,190 earned; 17,460 was certified before.
    expect(screen.getByLabelText('G702 page').textContent).toContain('CURRENT PAYMENT DUE$8,730.00')

    // The saved one opens as it was saved.
    fireEvent.click(screen.getByRole('button', { name: /^1 · 09\/30\/2026/ }))
    await waitFor(() => expect(field('g702_n5_project').value).toBe('1'))
    expect(field('g703_e13_from_previous').value).toBe('')
    expect(screen.getByLabelText('G702 page').textContent).toContain('CURRENT PAYMENT DUE$17,460.00')
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
})
