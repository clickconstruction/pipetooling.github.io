// @vitest-environment jsdom
/**
 * The field collect queue's invoice read (v2.5986): `get-stripe-invoice-details` goes through
 * `supabase.functions.invoke`, whose lost signal arrives as a `FunctionsFetchError`. It reads the
 * offline copy with Retry beside the saved total, and Retry reads the invoice again. A refusal the
 * function words itself is shown as it is, with no Retry.
 */
import { FunctionsFetchError } from '@supabase/supabase-js'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OFFLINE_ERROR_MESSAGE } from '../../lib/networkErrorMessage'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { FieldQueueLineItemsSection } from './DashboardFieldCollectPaymentQueue'

const edge = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: { ...makeSupabaseStub(), functions: { invoke: edge.invoke } } }
})
vi.mock('../../lib/supabaseAccessTokenForEdge', () => ({ getAccessTokenForEdgeFunctions: async () => 'token' }))

afterEach(() => {
  cleanup()
  edge.invoke.mockReset()
})

function renderSection() {
  return renderWithProviders(
    <FieldQueueLineItemsSection
      jobsLedgerInvoiceId="inv-ridgeway-1"
      stripeModeForBilling="test"
      fallbackAmountLabel="$1,250.00"
      detailCacheRef={{ current: new Map() }}
      namedFixtures={[]}
      fixtureJobTotal={0}
    />,
  )
}

describe('FieldQueueLineItemsSection', () => {
  it('a lost signal reads the offline copy with Retry, and Retry reads the invoice again', async () => {
    edge.invoke
      .mockResolvedValueOnce({ data: null, error: new FunctionsFetchError(new TypeError('Load failed')) })
      .mockResolvedValueOnce({ data: { error: 'This invoice is not on Stripe yet.' }, error: null })
    renderSection()

    expect(await screen.findByText(OFFLINE_ERROR_MESSAGE)).toBeTruthy()
    expect(screen.queryByText(/Failed to send a request to the Edge Function/)).toBeNull()
    expect(screen.getByText('Saved total: $1,250.00.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(await screen.findByText('This invoice is not on Stripe yet.')).toBeTruthy()
    await waitFor(() => expect(edge.invoke).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()
    expect(screen.getByText('Saved total: $1,250.00.')).toBeTruthy()
  })
})
