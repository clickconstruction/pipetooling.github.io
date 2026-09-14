// @vitest-environment jsdom
/**
 * Render smoke for the contract question on a new job (Contract sweep PR 0c):
 * a GC job leads with "File <builder>'s subcontract", a direct job with
 * "Send our agreement"; a covered job asks nothing and closes itself.
 */
import { describe, expect, it, vi } from 'vitest'
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
})
