// @vitest-environment jsdom
/**
 * The customer's door on a Pipeline row (v2.5626, punch list #123): with the door in the row's context, the speech
 * bubble beside the customer's name opens it with the job instead of leaving for the Messages page; without it, the
 * bubble keeps its own press. Both customer lines, the desktop's and the card's.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent } from '@testing-library/react'
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
const contactForCustomer = vi.fn(() => Promise.resolve('c-dana'))
vi.mock('../../lib/messages/messagesIo', async () => {
  const real = await vi.importActual<typeof import('../../lib/messages/messagesIo')>('../../lib/messages/messagesIo')
  return { ...real, contactForCustomer: (id: string) => contactForCustomer(id) }
})

import { renderJobCustomerAndAddressLine, renderJobCustomerLine } from './jobsStagesRowShared'

const job = makeJob({ customer_id: 'cust-dana', customer_name: 'Dana Whitfield', customer_phone: '(210) 555-0188' })
const ctxWith = (onOpenCustomerDoor?: StagesRowRenderContext['onOpenCustomerDoor']) =>
  ({ authRole: 'dev', loadJobs: vi.fn(), showToast: vi.fn(), onOpenCustomerDoor }) as unknown as StagesRowRenderContext

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  contactForCustomer.mockClear()
})

describe('the speech bubble on a row', () => {
  it('opens the customer’s door with the job from both customer lines, reading nothing', () => {
    const open = vi.fn()
    for (const render of [renderJobCustomerLine, renderJobCustomerAndAddressLine]) {
      renderWithProviders(<>{render(ctxWith(open), job)}</>)
      fireEvent.click(document.querySelector('[data-messages-button="cust-dana"]') as HTMLElement)
      expect(open).toHaveBeenLastCalledWith(job)
      cleanup()
    }
    expect(open).toHaveBeenCalledTimes(2)
    expect(contactForCustomer).not.toHaveBeenCalled()
  })

  it('keeps its own press where no door is given', () => {
    renderWithProviders(<>{renderJobCustomerLine(ctxWith(undefined), job)}</>)
    fireEvent.click(document.querySelector('[data-messages-button="cust-dana"]') as HTMLElement)
    expect(contactForCustomer).toHaveBeenCalledWith('cust-dana')
  })
})
