// @vitest-environment jsdom
/**
 * Render smokes for the GC's name on a Pipeline row (punch list #97, PR 3): a door to the GC's
 * timeline where the window can open, plain text where it cannot.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import type { StagesRowRenderContext } from './jobsStagesRowShared'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import { renderJobCustomerAndAddressLine, renderJobCustomerLine } from './jobsStagesRowShared'

const job = makeJob({ customer_id: 'c-owner', customer_name: 'Lee Park', gc_customer_id: 'c-gc', gcCustomer: { id: 'c-gc', name: 'Ridgeway Builders' } })
const ctxWith = (openCustomerProfile?: StagesRowRenderContext['openCustomerProfile']) =>
  ({ authRole: 'dev', loadJobs: vi.fn(), showToast: vi.fn(), openCustomerProfile }) as unknown as StagesRowRenderContext

beforeAll(installDomShims)
afterEach(cleanup)

describe('the GC name on a row', () => {
  it('opens the GC’s timeline from both customer lines', () => {
    const open = vi.fn()
    for (const render of [renderJobCustomerLine, renderJobCustomerAndAddressLine]) {
      renderWithProviders(<>{render(ctxWith(open), job)}</>)
      fireEvent.click(screen.getByRole('button', { name: 'Open the timeline for Ridgeway Builders' }))
      expect(open).toHaveBeenLastCalledWith('c-gc', { view: 'timeline' })
      cleanup()
    }
    expect(open).toHaveBeenCalledTimes(2)
  })

  it('stays plain text where the window cannot open', () => {
    renderWithProviders(<>{renderJobCustomerLine(ctxWith(undefined), job)}</>)
    expect(screen.queryByRole('button', { name: 'Open the timeline for Ridgeway Builders' })).toBeNull()
    expect(screen.getByText('Ridgeway Builders')).toBeTruthy()
  })
})
