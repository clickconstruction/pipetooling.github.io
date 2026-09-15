// @vitest-environment jsdom
/**
 * Render smoke for the contract question on a new job (Contract sweep PR 0c):
 * a GC job leads with "File <builder>'s subcontract", a direct job with
 * "Send our agreement"; a covered job asks nothing and closes itself.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import JobContractAfterCreatePrompt from './JobContractAfterCreatePrompt'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }),
}))

let mockJob: Record<string, unknown> | null = null
vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: () => Promise.resolve(mockJob),
}))

let mockCoverage: { kind: string } = { kind: 'none' }
vi.mock('../../hooks/useJobContractCoverage', () => ({
  useJobContractCoverage: (job: unknown) => ({ coverage: job ? mockCoverage : null, rows: [], reload: () => Promise.resolve() }),
}))

let mockFloor = 0
vi.mock('../../lib/jobs/jobContractFloor', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobs/jobContractFloor')>('../../lib/jobs/jobContractFloor')
  return { ...actual, fetchJobContractFloorCents: () => Promise.resolve(mockFloor) }
})

const markSpy = vi.fn(() => Promise.resolve({ at: '2026-09-14T00:00:00Z', reason: 'Service call' }))
vi.mock('../../lib/jobs/jobContractNotNeeded', () => ({
  markJobContractNotNeeded: (...args: unknown[]) => markSpy(...(args as [])),
  dispatchJobContractChanged: () => undefined,
}))

vi.mock('./JobContractModal', () => ({
  default: ({ initialFilingOpen }: { initialFilingOpen?: boolean }) => <div data-testid="contract-modal">{initialFilingOpen ? 'filing' : 'sending'}</div>,
}))

// Owner of record (PR 2): the builder read, the roll, and the ledger write behind "Yes — they are the builder".
const builderMock = vi.fn<(id: string) => Promise<boolean>>(() => Promise.resolve(false))
const lookupMock = vi.fn()
vi.mock('../../lib/jobs/ownerConfirmJobFormClient', () => ({
  fetchIsBuilderCustomer: (id: string) => builderMock(id),
  lookupPropertyRecordCached: (address: string) => lookupMock(address),
  fetchJobsAtProperty: (_a: string, self: unknown) => Promise.resolve([self]),
  fetchCustomerAddressRow: () => Promise.resolve(null),
}))
const updateSpy = vi.fn()
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  return {
    supabase: {
      ...stub,
      from: (table: string) => {
        const b = stub.from() as Record<string, unknown>
        if (table === 'jobs_ledger') {
          b.update = (patch: unknown) => {
            updateSpy(patch)
            return b
          }
        }
        return b
      },
    },
  }
})
import { proposalFromLookupPayload } from '../../lib/customers/propertyLookupClient'

beforeEach(() => {
  builderMock.mockReset().mockResolvedValue(false)
  lookupMock.mockReset().mockImplementation(async (a: string) => proposalFromLookupPayload(a, { ok: true, county_geocoder: '', parcel: null }))
  updateSpy.mockReset()
})

function job(p: Record<string, unknown>): Record<string, unknown> {
  return { id: 'j1', hcp_number: '523', click_number: '', job_name: 'Mission Hills', customer_name: 'TF Harper', revenue: 123600, gc_customer_id: null, gcCustomer: null, bid_id: null, ...p }
}

describe('JobContractAfterCreatePrompt', () => {
  it('a GC job leads with filing the builder’s subcontract and opens the Contract modal on the filing sheet', async () => {
    mockJob = job({ gc_customer_id: 'gc1', gcCustomer: { id: 'gc1', name: 'Summit GC' }, customer_name: 'Auto Zone' })
    mockCoverage = { kind: 'none' }
    const onClose = vi.fn()
    renderWithProviders(<JobContractAfterCreatePrompt jobId="j1" onClose={onClose} />)
    await waitFor(() => expect(screen.getByText('Does J523 need a contract?')).toBeTruthy())
    expect(screen.getByText("File Summit GC's subcontract")).toBeTruthy()
    fireEvent.click(screen.getByTestId('contract-prompt-file'))
    await waitFor(() => expect(screen.getByTestId('contract-modal').textContent).toBe('filing'))
  })

  it('a direct customer job leads with sending our agreement; Not needed writes the reason and closes', async () => {
    mockJob = job({})
    mockCoverage = { kind: 'none' }
    const onClose = vi.fn()
    renderWithProviders(<JobContractAfterCreatePrompt jobId="j1" onClose={onClose} />)
    await waitFor(() => expect(screen.getByText('Does J523 need a contract?')).toBeTruthy())
    expect(screen.getByText('Send our agreement')).toBeTruthy()
    fireEvent.click(screen.getByText('Not needed…'))
    fireEvent.click(screen.getByText('Service call'))
    fireEvent.click(screen.getByText('Mark not needed'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(markSpy).toHaveBeenCalledWith('j1', 'Service call', 'u1')
  })

  it('a job already covered by a signature, or under the floor, asks nothing and closes itself', async () => {
    mockJob = job({})
    mockCoverage = { kind: 'signed' }
    const onClose = vi.fn()
    const { container, unmount } = renderWithProviders(<JobContractAfterCreatePrompt jobId="j1" onClose={onClose} />)
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(container.textContent).toBe('')
    unmount()

    mockJob = job({ revenue: 450 })
    mockCoverage = { kind: 'none' }
    mockFloor = 250000
    const onClose2 = vi.fn()
    renderWithProviders(<JobContractAfterCreatePrompt jobId="j1" onClose={onClose2} />)
    await waitFor(() => expect(onClose2).toHaveBeenCalled())
    expect(screen.queryByText('Does J523 need a contract?')).toBeNull()
  })

  it('a builder in the customer row with no GC is asked "building this for someone?"; Yes sets the GC and the owner box looks the site up (owner of record, PR 2)', async () => {
    mockJob = job({ customer_id: 'c-sp', customer_name: 'Southern Post Construction', job_address: '380 TX-123, Seguin, TX', gc_customer_id: null })
    mockCoverage = { kind: 'none' }
    mockFloor = 0
    builderMock.mockResolvedValue(true)
    lookupMock.mockImplementation(async (a: string) =>
      proposalFromLookupPayload(a, {
        ok: true,
        county_geocoder: 'Guadalupe',
        parcel: { propId: '9', ownerName: 'TC/JP SEGUIN 2019 LLC', nameCare: '', legalDescription: 'ABS 1', situsAddress: '380 TX-123, SEGUIN, TX', mailingAddress: '1 MAIN ST, AUSTIN, TX', county: 'Guadalupe', source: 'Guadalupe Appraisal District', taxYear: '2025' },
      }),
    )
    renderWithProviders(<JobContractAfterCreatePrompt jobId="j1" onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('builder-question')).toBeTruthy())
    expect(screen.getByText('Is Southern Post Construction building this for someone?')).toBeTruthy()
    // No box while the question is open, and no lookup yet.
    expect(screen.queryByTestId('owner-lookup-box')).toBeNull()
    fireEvent.click(screen.getByTestId('builder-question-builder'))
    await waitFor(() => expect(screen.queryByTestId('builder-question')).toBeNull())
    expect(updateSpy).toHaveBeenCalledWith({ gc_customer_id: 'c-sp' })
    await waitFor(() => expect(screen.getByTestId('owner-lookup-box').getAttribute('data-state')).toBe('found'))
    expect(screen.getByTestId('owner-lookup-owner').textContent).toContain('Seguin 2019')
    // The contract doors are still there beneath.
    expect(screen.getByText('Send our agreement')).toBeTruthy()
  })

  it('"No — they own the site" records nothing and closes the question; a direct customer that is not a builder is never asked', async () => {
    mockJob = job({ customer_id: 'c-sp', customer_name: 'Southern Post Construction', job_address: '380 TX-123, Seguin, TX', gc_customer_id: null })
    mockCoverage = { kind: 'none' }
    mockFloor = 0
    builderMock.mockResolvedValue(true)
    const { unmount } = renderWithProviders(<JobContractAfterCreatePrompt jobId="j1" onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('builder-question')).toBeTruthy())
    fireEvent.click(screen.getByTestId('builder-question-owner'))
    await waitFor(() => expect(screen.queryByTestId('builder-question')).toBeNull())
    expect(updateSpy).not.toHaveBeenCalled()
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByTestId('owner-lookup-box')).toBeNull()
    expect(lookupMock).not.toHaveBeenCalled()
    unmount()

    builderMock.mockResolvedValue(false)
    mockJob = job({ customer_id: 'c-maria', customer_name: 'Maria Delgado', job_address: '4410 Prue Rd, San Antonio, TX', gc_customer_id: null })
    renderWithProviders(<JobContractAfterCreatePrompt jobId="j1" onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('Does J523 need a contract?')).toBeTruthy())
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByTestId('builder-question')).toBeNull()
    expect(screen.queryByTestId('owner-lookup-box')).toBeNull()
  })
})
