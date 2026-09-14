// @vitest-environment jsdom
/**
 * Render smoke for the Contract sweep list (Contract sweep PR 1): the header
 * counts the pile, rows wear their readiness, the row's button follows its
 * state, To send · Needs a look · All splits the list, and Send all lives
 * under ⋯, counts customers, and takes only Ready rows.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { JobWithDetails } from '../../types/jobWithDetails'
import JobsContractSweepModal from './JobsContractSweepModal'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }),
}))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const sendSpy = vi.fn((_input: { job: { id: string } }) => Promise.resolve({ ok: true, emailed: true, signUrl: 'https://x' }))
vi.mock('../../lib/jobs/jobContractQuickSend', () => ({
  quickSendJobContract: (input: { job: { id: string } }) => sendSpy(input),
}))

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
  job({ id: 'j683', hcp_number: '683', job_name: 'Job', customer_name: 'The Learning Experience', customer_email: 'may@corewellpartners.com', revenue: null, fixtures: [] }),
  job({ id: 'j778', hcp_number: '778', job_name: 'Austin Real Estate', customer_email: null, revenue: null }),
  job({ id: 'j804', hcp_number: '804', job_name: 'Auto Zone', customer_name: 'Summit GC', customer_email: 'estimating@summitgc.net', customer_id: 'c9', gc_customer_id: 'gc1', revenue: 32600 }),
  job({ id: 'jpaid', hcp_number: '900', status: 'paid' }),
]
const COVERAGE = new Map(JOBS.map((j) => [j.id, { kind: 'none' as const }]))

describe('JobsContractSweepModal', () => {
  it('counts the pile, shows the Ready row first, and the row buttons follow the state', async () => {
    renderWithProviders(<JobsContractSweepModal open onClose={() => undefined} jobs={JOBS} coverage={COVERAGE} onEditJob={() => undefined} onSent={() => undefined} />)
    await waitFor(() => expect(screen.getByTestId('sweep-summary').textContent).toContain('4 without a contract'))
    expect(screen.getByTestId('sweep-summary').textContent).toContain('3 need a look')
    expect(screen.getByRole('button', { name: /^To send · 1$/ }).getAttribute('aria-pressed')).toBe('true')
    const rows = screen.getAllByTestId('sweep-row')
    expect(rows.map((r) => r.getAttribute('data-job'))).toEqual(['523'])
    expect(within(rows[0]!).getByText('Ready')).toBeTruthy()
    expect(within(rows[0]!).getByRole('button', { name: 'Send' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^Needs a look · 3$/ }))
    const look = screen.getAllByTestId('sweep-row')
    expect(look.map((r) => r.getAttribute('data-job'))).toEqual(['683', '778', '804'])
    expect(within(look[0]!).getByText('Scope is just the name')).toBeTruthy()
    expect(within(look[0]!).getByText('No amount')).toBeTruthy()
    expect(within(look[0]!).getByRole('button', { name: 'Add scope' })).toBeTruthy()
    expect(within(look[1]!).getByText('No email')).toBeTruthy()
    expect(within(look[1]!).getByRole('button', { name: 'Fix email' })).toBeTruthy()
    expect(within(look[2]!).getByText('GC job · file theirs')).toBeTruthy()
    fireEvent.click(within(look[2]!).getByRole('button', { name: 'File theirs' }))
    expect(screen.getByTestId('contract-modal').textContent).toBe('filing')
  })

  it('Send all lives under ⋯, names the customers, and sends only the Ready rows after a confirm', async () => {
    sendSpy.mockClear()
    const onSent = vi.fn()
    renderWithProviders(<JobsContractSweepModal open onClose={() => undefined} jobs={JOBS} coverage={COVERAGE} onEditJob={() => undefined} onSent={onSent} />)
    await waitFor(() => expect(screen.getByTestId('sweep-summary')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Contract sweep tools' }))
    const item = screen.getByRole('menuitem', { name: /Send all 1 ready…/ })
    expect(item.textContent).toContain('1 customer')
    fireEvent.click(item)
    const confirm = screen.getByTestId('sweep-send-all-confirm')
    expect(confirm.textContent).toContain('Email 1 customer (1 agreement)')
    fireEvent.click(within(confirm).getByRole('button', { name: /Confirm — send 1 now/ }))
    await waitFor(() => expect(onSent).toHaveBeenCalled())
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy.mock.calls[0]![0].job.id).toBe('j523')
  })
})
