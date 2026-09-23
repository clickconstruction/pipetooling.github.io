// @vitest-environment jsdom
/**
 * Record a notice that already went out (#35 PR 2): the pane takes the paper
 * as printed, offers the other unpaid jobs at the property, words the
 * difference, and writes one filing per covered job through the IO.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LienNoticeByHandPane from './LienNoticeByHandPane'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const recordMock = vi.fn(async () => ({ packetId: 'p1', filingIds: ['f1', 'f2'] }))
vi.mock('../../lib/jobs/lienNoticeByHandIo', () => ({
  loadJobsAtProperty: async () => [
    { id: 'j858', hcp_number: '', click_number: '858', job_name: 'Service visit', job_address: '9703 Lenox Hl', customer_address_id: 'a1', revenue: 7902, payments_made: 0, status: 'billed', itemId: null },
    { id: 'j866', hcp_number: '', click_number: '866', job_name: 'Omar Khan- Lennox', job_address: '9703 Lenox Hl', customer_address_id: 'a1', revenue: 3500, payments_made: 0, status: 'billed', itemId: 'it866' },
  ],
  recordLienNoticeByHand: (...args: unknown[]) => recordMock(...(args as [])),
}))

const fields = { noticeDate: '2026-09-22', projectDescription: 'Dudley (Lennox) — 9703 Lenox Hl', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'RMC-Dudley Mason', contractedWithIfDifferent: '', claimAmount: '17585.00', contactPerson: 'Malachi Whites', claimantAddress: '5501 Balcones Dr' }
const job = { id: 'j273', label: '273 · Dudley (Lennox)', jobAddress: '9703 Lenox Hl', customerAddressId: 'a1', amount: 17_585, itemId: 'it273' }

describe('LienNoticeByHandPane', () => {
  it('prefills the app’s claim and months, lists the other jobs at the property, words the paper’s difference, and records on every ticked job', async () => {
    const onRecorded = vi.fn()
    renderWithProviders(<LienNoticeByHandPane job={job} fields={fields} appClaim={9_802} appClaimIsTimely defaultMonths={['2026-08']} todayYmd="2026-09-23" userId="u1" onClose={() => {}} onRecorded={onRecorded} />)
    expect((screen.getByLabelText('Claim as printed') as HTMLInputElement).value).toBe('9802')
    expect((screen.getByLabelText('Months as printed') as HTMLInputElement).value).toBe('2026-08')
    await waitFor(() => expect(screen.getByTestId('by-hand-other-jobs')).toBeTruthy())
    expect(screen.getByTestId('by-hand-other-jobs').textContent).toContain('858 · Service visit')
    expect(screen.getByTestId('by-hand-other-jobs').textContent).toContain('on the desk')
    // The paper as Taunya printed it.
    fireEvent.change(screen.getByLabelText('Sent on'), { target: { value: '2026-09-22' } })
    fireEvent.change(screen.getByLabelText('How it went'), { target: { value: 'mail' } })
    fireEvent.change(screen.getByLabelText('Claim as printed'), { target: { value: '28,987' } })
    fireEvent.change(screen.getByLabelText('Months as printed'), { target: { value: 'April, June, July and August 2026' } })
    expect(screen.getByText(/Months read as Apr, Jun, Jul, Aug/)).toBeTruthy()
    expect(screen.getByTestId('by-hand-claim-diff').textContent).toContain("printed $28,987 · the app's timely claim would have been $9,802")
    fireEvent.click(screen.getByLabelText('Also covers 858'))
    fireEvent.click(screen.getByLabelText('Also covers 866'))
    expect(screen.getByText(/3 jobs · \$28,987 open between them/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Saved copy — link'), { target: { value: 'drive.google.com/file/d/lenox/view' } })
    fireEvent.click(screen.getByTestId('by-hand-record'))
    await waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1))
    const [input, opts] = recordMock.mock.calls[0] as unknown as [{ jobs: { jobId: string; itemId: string | null }[]; printedClaim: number; printedMonths: string[]; method: string; sentOn: string; documentUrl: string }, { fields: typeof fields }]
    expect(input.jobs.map((j) => [j.jobId, j.itemId])).toEqual([['j273', 'it273'], ['j858', null], ['j866', 'it866']])
    expect(input).toMatchObject({ printedClaim: 28_987, printedMonths: ['2026-04', '2026-06', '2026-07', '2026-08'], method: 'mail', sentOn: '2026-09-22', documentUrl: 'drive.google.com/file/d/lenox/view' })
    expect(opts.fields.claimantName).toBe('Click Plumbing and Electrical')
    await waitFor(() => expect(onRecorded).toHaveBeenCalledWith({ filingIds: ['f1', 'f2'], jobs: 3 }))
  })
  it('a future date or no recipient blocks the record and says what is missing', () => {
    renderWithProviders(<LienNoticeByHandPane job={job} fields={fields} appClaim={17_585} appClaimIsTimely={false} defaultMonths={['2026-08']} todayYmd="2026-09-23" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    expect(screen.queryByTestId('by-hand-problems')).toBeNull()
    fireEvent.change(screen.getByLabelText('Sent on'), { target: { value: '2026-10-01' } })
    expect(screen.getByTestId('by-hand-problems').textContent).toContain('The send date is in the future')
    expect((screen.getByTestId('by-hand-record') as HTMLButtonElement).disabled).toBe(true)
  })
})
