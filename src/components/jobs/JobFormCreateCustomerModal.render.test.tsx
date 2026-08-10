// @vitest-environment jsdom
/**
 * Repro (2026-08-10): clicking a "Possible matches – link instead?" row looked
 * dead — the row offered a customer owned by a DIFFERENT master, the
 * jobs_ledger_customer_master_match trigger rejected the link, and only a
 * fleeting error toast hinted why. Covers: rows are click-wired to
 * onLinkSimilar, and cross-master customers never make the list.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { JobFormCreateCustomerModal } from './JobFormCreateCustomerModal'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const CUSTOMERS = [
  {
    id: 'cust-mine',
    name: 'Alpha Builders',
    address: '1 Main St',
    contact_info: null,
    date_met: null,
    master_user_id: 'job-master-1',
    customer_type: 'commercial',
    archived_at: null,
  },
  {
    id: 'cust-other-master',
    name: 'Alpha Builders LLC',
    address: '2 Side St',
    contact_info: null,
    date_met: null,
    master_user_id: 'someone-elses-master',
    customer_type: 'commercial',
    archived_at: null,
  },
]

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown>
  const baseFrom = stub.from as (table: string) => Record<string, unknown>
  stub.from = (table: string) => {
    const builder = baseFrom(table)
    if (table === 'customers') {
      builder.then = (
        onFulfilled?: (v: unknown) => unknown,
        onRejected?: (e: unknown) => unknown,
      ) => Promise.resolve({ data: CUSTOMERS, error: null, count: CUSTOMERS.length }).then(onFulfilled, onRejected)
    }
    return builder
  }
  return { supabase: stub }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

afterEach(cleanup)

function renderModal(overrides: Partial<Parameters<typeof JobFormCreateCustomerModal>[0]> = {}) {
  const onLinkSimilar = vi.fn()
  const utils = renderWithProviders(
    <JobFormCreateCustomerModal
      open
      onClose={() => {}}
      customerName="Alpha Builders"
      jobAddress="123 Job Site Rd"
      customerEmail=""
      customerPhone=""
      creatingCustomerFromJob={false}
      onCreate={() => {}}
      onLinkSimilar={onLinkSimilar}
      resolveJobMasterUserId={async () => 'job-master-1'}
      overlayZIndex={1011}
      {...overrides}
    />,
  )
  return { onLinkSimilar, ...utils }
}

describe('Create-customer-from-job modal — possible matches', () => {
  it('clicking a match row fires onLinkSimilar with that customer', async () => {
    const { onLinkSimilar } = renderModal()
    const row = await screen.findByText('Alpha Builders')
    fireEvent.click(row)
    expect(onLinkSimilar).toHaveBeenCalledTimes(1)
    expect(onLinkSimilar.mock.calls[0]?.[0]?.id).toBe('cust-mine')
  })

  it("never offers another master's customer — the DB would reject the link", async () => {
    renderModal()
    await screen.findByText('Alpha Builders')
    expect(screen.queryByText('Alpha Builders LLC')).toBeNull()
  })

  it('offers every visible match when the job master cannot be resolved', async () => {
    renderModal({ resolveJobMasterUserId: async () => null })
    await screen.findByText('Alpha Builders')
    await waitFor(() => expect(screen.getByText('Alpha Builders LLC')).toBeTruthy())
  })
})
