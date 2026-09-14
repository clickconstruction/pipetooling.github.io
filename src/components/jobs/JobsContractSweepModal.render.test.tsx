// @vitest-environment jsdom
/**
 * Render smoke for the Contract sweep (Contract sweep PR 1 / PR 2): the
 * header counts the pile, rows wear their readiness, the selected job's
 * agreement renders in the pane with a footer that follows its state, Send &
 * next lands on the next row, and Send all lives under ⋯, counts customers,
 * and takes only Ready rows.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { JobWithDetails } from '../../types/jobWithDetails'
import JobsContractSweepModal from './JobsContractSweepModal'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }),
}))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/physicalInvoiceIssuer', () => ({
  fetchPhysicalInvoiceIssuerFromAppSettings: () => Promise.resolve(),
  getPhysicalInvoiceIssuerForDocument: () => ({ companyName: 'ClickTooling Plumbing', addressText: '', phone: '', email: '', tagline: '', licenseLine: '' }),
}))

const sendSpy = vi.fn((_input: { job: { id: string } }) => Promise.resolve({ ok: true, emailed: true, signUrl: 'https://x' }))
vi.mock('../../lib/jobs/jobContractQuickSend', () => ({
  quickSendJobContract: (input: { job: { id: string } }) => sendSpy(input),
}))

const saveSpy = vi.fn((input: { existing: unknown; payload: { job_id: string; fields: { scope_lines: string[]; amount_cents: number | null } } }) =>
  Promise.resolve({ id: 'd1', job_id: input.payload.job_id, status: 'draft', revision: 1, fields: input.payload.fields, body_html: 'terms', body_format: 'plain', template_name: 'Built-in service agreement terms', recipient_name: null, recipient_email: null, created_at: '2026-09-14T00:00:00Z', updated_at: null, last_sent_at: null }),
)
vi.mock('../../lib/jobs/jobContractDraftWrite', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobs/jobContractDraftWrite')>('../../lib/jobs/jobContractDraftWrite')
  return { ...actual, saveJobContractDraft: (input: never) => saveSpy(input) }
})

vi.mock('./JobContractModal', () => ({
  default: ({ open, initialFilingOpen }: { open: boolean; initialFilingOpen?: boolean }) => (open ? <div data-testid="contract-modal">{initialFilingOpen ? 'filing' : 'sending'}</div> : null),
}))

function job(p: Partial<JobWithDetails> & { id: string; hcp_number: string }): JobWithDetails {
  return {
    click_number: '',
    job_name: 'Mission Hills',
    job_address: '2100 Independence Dr, New Braunfels, TX',
    customer_name: 'TF Harper',
    customer_email: 'kcallison@tfharper.com',
    customer_phone: null,
    customer_id: 'c1',
    gc_customer_id: null,
    status: 'working',
    revenue: 123600,
    created_at: '2026-09-01T00:00:00Z',
    bid_id: null,
    fixtures: [{ name: 'Water closet', count: 14, line_description: null } as never],
    materials: [],
    payments: [],
    invoices: [],
    team_members: [],
    ...p,
  } as unknown as JobWithDetails
}

const JOBS: JobWithDetails[] = [
  job({ id: 'j523', hcp_number: '523' }),
  job({ id: 'j363', hcp_number: '363', job_name: 'Michael Palmer', customer_name: 'Michael Palmer', customer_email: 'palmertexashomes@gmail.com', revenue: 31400, created_at: '2026-09-02T00:00:00Z' }),
  job({ id: 'j683', hcp_number: '683', job_name: 'Job', customer_name: 'The Learning Experience', customer_email: 'may@corewellpartners.com', revenue: null, fixtures: [] }),
  job({ id: 'j778', hcp_number: '778', job_name: 'Austin Real Estate', customer_email: null, revenue: null }),
  job({ id: 'j804', hcp_number: '804', job_name: 'Auto Zone', customer_name: 'Summit GC', customer_email: 'estimating@summitgc.net', customer_id: 'c9', gc_customer_id: 'gc1', gcCustomer: { id: 'gc1', name: 'Summit GC' }, revenue: 32600 }),
  job({ id: 'jpaid', hcp_number: '900', status: 'paid' }),
]
const COVERAGE = new Map(JOBS.map((j) => [j.id, { kind: 'none' as const }]))

function mount(onSent = vi.fn()) {
  return renderWithProviders(<JobsContractSweepModal open onClose={() => undefined} jobs={JOBS} coverage={COVERAGE} onEditJob={() => undefined} onSent={onSent} />)
}

describe('JobsContractSweepModal', () => {
  it('counts the pile, selects the first Ready row, and shows its agreement with a footer that says what Send will do', async () => {
    mount()
    await waitFor(() => expect(screen.getByTestId('sweep-summary').textContent).toContain('5 without a contract'))
    expect(screen.getByTestId('sweep-summary').textContent).toContain('3 need a look')
    expect(screen.getByRole('button', { name: /^To send · 2$/ }).getAttribute('aria-pressed')).toBe('true')
    const rows = screen.getAllByTestId('sweep-row')
    expect(rows.map((r) => r.getAttribute('data-job'))).toEqual(['523', '363'])
    expect(rows[0]!.getAttribute('aria-pressed')).toBe('true')
    expect(within(rows[0]!).getByText('Ready')).toBeTruthy()
    const frame = screen.getByTitle('The agreement as the customer will see it') as HTMLIFrameElement
    expect(frame.getAttribute('srcdoc')).toContain('Service agreement for 2100 Independence Dr')
    expect(frame.getAttribute('srcdoc')).toContain('14 × Water closet')
    expect(frame.getAttribute('srcdoc')).toContain('$123,600.00')
    expect(screen.getByTestId('sweep-footer-sentence').textContent).toBe('Emails kcallison@tfharper.com · then J363')
    expect(screen.getByRole('button', { name: 'Send & next' })).toBeTruthy()
  })

  it('the footer follows the state: a thin row dims the primary, a GC job leads with filing, no email asks for a fix', async () => {
    mount()
    await waitFor(() => expect(screen.getByTestId('sweep-summary')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /^Needs a look · 3$/ }))
    const look = screen.getAllByTestId('sweep-row')
    expect(look.map((r) => r.getAttribute('data-job'))).toEqual(['683', '778', '804'])
    // The first row of the new list is selected: thin scope + no amount.
    expect(screen.getByTestId('sweep-footer-sentence').textContent).toContain("Work we'll do: Job")
    expect(screen.getByRole('button', { name: 'Send anyway' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Send & next' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(look[1]!)
    expect(screen.getByRole('button', { name: 'Fix email on the job' })).toBeTruthy()
    fireEvent.click(look[2]!)
    expect(screen.getByTestId('sweep-footer-sentence').textContent).toBe("GC job · Summit GC's subcontract is the agreement")
    fireEvent.click(screen.getByRole('button', { name: 'File their subcontract' }))
    expect(screen.getByTestId('contract-file-sheet')).toBeTruthy()
    expect(screen.getByText("File Summit GC's subcontract")).toBeTruthy()
  })

  it('Send & next sends the selected job and lands on the next row', async () => {
    sendSpy.mockClear()
    const onSent = vi.fn()
    mount(onSent)
    await waitFor(() => expect(screen.getByTestId('sweep-summary')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Send & next' }))
    await waitFor(() => expect(onSent).toHaveBeenCalled())
    expect(sendSpy.mock.calls[0]![0].job.id).toBe('j523')
    await waitFor(() => expect(screen.getAllByTestId('sweep-row').map((r) => r.getAttribute('data-job'))).toEqual(['363']))
    expect(screen.getAllByTestId('sweep-row')[0]!.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('sweep-summary').textContent).toContain('1 sent this sweep')
  })

  it('typing a scope and an amount for a thin row saves the draft, redraws the document, and makes the row Ready (PR 3)', async () => {
    saveSpy.mockClear()
    mount()
    await waitFor(() => expect(screen.getByTestId('sweep-summary')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /^Needs a look · 3$/ }))
    await waitFor(() => expect(screen.getByTestId('sweep-pane-edit')).toBeTruthy())
    expect((screen.getByLabelText('Scope — one line per item') as HTMLTextAreaElement).value).toBe('Job')
    fireEvent.change(screen.getByLabelText('Scope — one line per item'), { target: { value: 'Water heater swap\nHaul away the old unit' } })
    fireEvent.change(screen.getByLabelText('Contract amount'), { target: { value: '2,400' } })
    const frame = screen.getByTitle('The agreement as the customer will see it') as HTMLIFrameElement
    expect(frame.getAttribute('srcdoc')).toContain('Water heater swap')
    expect(frame.getAttribute('srcdoc')).toContain('$2,400.00')
    await waitFor(() => expect(saveSpy).toHaveBeenCalled(), { timeout: 2000 })
    const payload = saveSpy.mock.calls[0]![0].payload
    expect(payload.job_id).toBe('j683')
    expect(payload.fields.scope_lines).toEqual(['Water heater swap', 'Haul away the old unit'])
    expect(payload.fields.amount_cents).toBe(240000)
    await waitFor(() => expect(screen.getByTestId('sweep-save-state').textContent).toBe('Saved to the job’s draft'))
    expect(screen.getByTestId('sweep-footer-sentence').textContent).toBe('Emails may@corewellpartners.com · then J778')
    expect((screen.getByRole('button', { name: 'Send & next' }) as HTMLButtonElement).disabled).toBe(false)
    expect(within(screen.getAllByTestId('sweep-row')[0]!).getByText('Ready')).toBeTruthy()
  })

  it('filing happens in the pane: Already signed? File it opens the sheet, and a file dropped on a row opens it with the file (PR 4)', async () => {
    mount()
    await waitFor(() => expect(screen.getByTestId('sweep-summary')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Already signed? File it' }))
    expect(screen.getByTestId('contract-file-sheet')).toBeTruthy()
    expect(screen.getByTestId('sweep-pane-footer').textContent).toContain('Filing replaces the send')
    expect(screen.queryByTestId('sweep-pane-edit')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByTestId('contract-file-sheet')).toBeNull()

    const rows = screen.getAllByTestId('sweep-row')
    const file = new File(['%PDF'], 'Palmer subcontract (signed).pdf', { type: 'application/pdf' })
    fireEvent.drop(rows[1]!, { dataTransfer: { files: [file], types: ['Files'] } })
    await waitFor(() => expect(screen.getByTestId('contract-file-chosen').textContent).toContain('Palmer subcontract (signed).pdf'))
    expect(screen.getAllByTestId('sweep-row')[1]!.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('File a signed contract')).toBeTruthy()
  })

  it('Send all lives under ⋯, names the customers, and sends only the Ready rows after a confirm', async () => {
    sendSpy.mockClear()
    const onSent = vi.fn()
    mount(onSent)
    await waitFor(() => expect(screen.getByTestId('sweep-summary')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Contract sweep tools' }))
    const item = screen.getByRole('menuitem', { name: /Send all 2 ready…/ })
    expect(item.textContent).toContain('2 customers')
    fireEvent.click(item)
    const confirm = screen.getByTestId('sweep-send-all-confirm')
    expect(confirm.textContent).toContain('Email 2 customers (2 agreements)')
    fireEvent.click(within(confirm).getByRole('button', { name: /Confirm — send 2 now/ }))
    await waitFor(() => expect(onSent).toHaveBeenCalled())
    expect(sendSpy.mock.calls.map((c) => c[0].job.id)).toEqual(['j523', 'j363'])
  })
})
