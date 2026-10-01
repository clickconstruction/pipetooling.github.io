// @vitest-environment jsdom
/**
 * Render smoke for Add the contract (v2.4301): the sheet lists the customer's other jobs, the
 * anchor job is always on it, a tick adds a job, the sentence and the button count the jobs,
 * and File sends exactly the ticked jobs with the pasted link. Edit mode starts from the jobs
 * the paper covers and saves the difference.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import AddJobContractSheet from './AddJobContractSheet'
import type { CoversPaper } from '../../lib/jobs/jobContractCovers'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }) }))

const JOBS = [
  { id: 'j251', hcp_number: '251', click_number: null, job_name: 'Michael Palmer', job_address: '180 Go Away Rd, Blanco, TX', status: 'billed', customer_id: null, gc_customer_id: 'p', bid_id: null, contract_not_needed_at: null, contract_not_needed_reason: null },
  { id: 'j825', hcp_number: '825', click_number: null, job_name: 'x', job_address: '121 North Calvin Barrett, Blanco', status: 'billed', customer_id: null, gc_customer_id: 'p', bid_id: null, contract_not_needed_at: null, contract_not_needed_reason: null },
  { id: 'j843', hcp_number: '843', click_number: null, job_name: 'y', job_address: '102 Jacob Roberts, Blanco', status: 'billed', customer_id: null, gc_customer_id: 'p', bid_id: null, contract_not_needed_at: null, contract_not_needed_reason: null },
  { id: 'j620', hcp_number: '620', click_number: null, job_name: 'z', job_address: '180 Go Away Rd, Blanco', status: 'paid', customer_id: 'p', gc_customer_id: null, bid_id: null, contract_not_needed_at: null, contract_not_needed_reason: null },
]

const fileSpy = vi.fn((_input: { jobIds: string[]; link: string; signerName: string }) => Promise.resolve({ filed: _input.jobIds.length, uploadError: null }))
const saveSpy = vi.fn((_input: { add: readonly string[]; remove: readonly string[] }) => Promise.resolve())
vi.mock('../../lib/jobs/jobContractCoversWrite', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobs/jobContractCoversWrite')>('../../lib/jobs/jobContractCoversWrite')
  return {
    ...actual,
    loadPartyJobs: () => Promise.resolve(JOBS),
    loadContractRowsForJobs: () => Promise.resolve([]),
    fileContractForJobs: (input: { jobIds: string[]; link: string; signerName: string }) => fileSpy(input),
    saveCoveredJobs: (input: { add: readonly string[]; remove: readonly string[] }) => saveSpy(input),
  }
})

describe('AddJobContractSheet', () => {
  it('files one paper for the anchor job and the jobs ticked, with the pasted link', async () => {
    const onDone = vi.fn()
    renderWithProviders(
      <AddJobContractSheet open mode="add" onClose={() => undefined} onDone={onDone} anchorJob={{ id: 'j251', num: '251', where: '180 Go Away Rd' }} partyIds={['p']} signerName="Michael Palmer" subtitle="Job 251 · Michael Palmer is the GC on this job" />,
    )
    const rows = await screen.findAllByTestId('contract-covers-job')
    expect(rows.map((r) => r.textContent)).toEqual(['825 · 121 North Calvin BarrettBilled', '843 · 102 Jacob RobertsBilled'])
    expect(screen.getByText('Show their 1 paid job')).toBeTruthy()
    const submit = screen.getByTestId('add-contract-submit') as HTMLButtonElement
    expect(submit.textContent).toBe('File for this job')
    expect(submit.disabled).toBe(true)

    fireEvent.click(rows[0]!.querySelector('input')!)
    await waitFor(() => expect(submit.textContent).toBe('File for 2 jobs'))
    expect(screen.getByTestId('add-contract-summary').textContent).toContain('Jobs 251 and 825 will read signed and on file.')

    fireEvent.change(screen.getByLabelText('Link to the signed contract'), { target: { value: 'https://docs.google.com/document/d/abc' } })
    await waitFor(() => expect(submit.disabled).toBe(false))
    fireEvent.click(submit)
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(fileSpy.mock.calls[0]![0]).toMatchObject({ jobIds: ['j251', 'j825'], link: 'https://docs.google.com/document/d/abc', signerName: 'Michael Palmer' })
  })

  it('edit mode starts from the jobs the paper covers and saves only the change', async () => {
    const paper: CoversPaper = {
      key: 'g1',
      source: { id: 'g1', job_id: 'j251', status: 'signed', voided_at: null, signer_mode: 'paper', signed_at: null, signer_printed_name: 'Michael Palmer', signed_document_url: 'https://docs.google.com/document/d/abc', paper_upload_path: null, covers_group_id: 'g1' },
      jobIds: ['j251', 'j825'],
      signedAt: null,
      signerName: 'Michael Palmer',
      documentUrl: 'https://docs.google.com/document/d/abc',
      hasUpload: false,
    }
    renderWithProviders(<AddJobContractSheet open mode="edit" paper={paper} onClose={() => undefined} anchorJob={null} partyIds={['p']} signerName="Michael Palmer" subtitle="Michael Palmer" />)
    const rows = await screen.findAllByTestId('contract-covers-job')
    const box = (num: string) => rows.find((r) => r.textContent?.startsWith(num))!.querySelector('input') as HTMLInputElement
    expect(box('251').checked).toBe(true)
    expect(box('825').checked).toBe(true)
    expect(box('843').checked).toBe(false)
    fireEvent.click(box('825'))
    fireEvent.click(box('843'))
    const submit = screen.getByTestId('add-contract-submit') as HTMLButtonElement
    await waitFor(() => expect(screen.getByTestId('add-contract-summary').textContent).toBe('The paper will cover jobs 251 and 843.'))
    fireEvent.click(submit)
    await waitFor(() => expect(saveSpy).toHaveBeenCalled())
    expect(saveSpy.mock.calls[0]![0]).toMatchObject({ add: ['j843'], remove: ['j825'] })
  })
})
