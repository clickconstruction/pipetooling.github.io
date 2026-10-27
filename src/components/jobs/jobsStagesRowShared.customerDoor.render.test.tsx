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
const contactForCustomer = vi.fn((_id: string) => Promise.resolve('c-dana'))
vi.mock('../../lib/messages/messagesIo', async () => {
  const real = await vi.importActual<typeof import('../../lib/messages/messagesIo')>('../../lib/messages/messagesIo')
  return { ...real, contactForCustomer: (id: string) => contactForCustomer(id) }
})

import { renderJobCustomerAndAddressLine, renderJobCustomerLine } from './jobsStagesRowShared'
import { navButtonName } from '../../lib/navClickTelemetry'

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

describe('the waiting dot on the bubble (v2.5632)', () => {
  const hover = { who: 'Dana', channel: 'text', when: '9:05 AM', line: 'Can you do Thursday?', status: 'Nobody has answered.' as const }

  it('draws the dot with its hover when the board’s map holds the job, on both customer lines', () => {
    for (const render of [renderJobCustomerLine, renderJobCustomerAndAddressLine]) {
      const ctx = { ...ctxWith(vi.fn()), boardDotByJobId: new Map([[job.id, hover]]) } as StagesRowRenderContext
      renderWithProviders(<>{render(ctx, job)}</>)
      const bubble = document.querySelector('[data-messages-button="cust-dana"]') as HTMLButtonElement
      expect(bubble.querySelector('[data-messages-dot]')).not.toBeNull()
      expect(bubble.title).toBe('Open Dana Whitfield’s messages · Dana · text · 9:05 AM · Can you do Thursday? · Nobody has answered.')
      expect(bubble.getAttribute('aria-label')).toBe(bubble.title)
      cleanup()
    }
  })

  it('draws none for a job off the map, or with no map at all', () => {
    const ctx = { ...ctxWith(vi.fn()), boardDotByJobId: new Map([['another-job', hover]]) } as StagesRowRenderContext
    renderWithProviders(<>{renderJobCustomerLine(ctx, job)}</>)
    expect(document.querySelector('[data-messages-dot]')).toBeNull()
    expect((document.querySelector('[data-messages-button="cust-dana"]') as HTMLButtonElement).title).toBe('Open Dana Whitfield’s messages')
    cleanup()
    renderWithProviders(<>{renderJobCustomerLine(ctxWith(vi.fn()), job)}</>)
    expect(document.querySelector('[data-messages-dot]')).toBeNull()
  })
})

describe('the ledger names on the customer lines (v2.5904)', () => {
  it('every button names itself without the customer, the GC or the development, so one button is one target', () => {
    const named = makeJob({
      customer_id: 'cust-dana',
      customer_name: 'Dana Whitfield',
      customer_phone: '(210) 555-0188',
      gcCustomer: { id: 'gc-ridgeway', name: 'Ridgeway Builders' },
      development: { id: 'dev-cedar', name: 'Cedar Loop' },
    })
    const ctx = { ...ctxWith(vi.fn()), onDevelopmentFilter: vi.fn() } as StagesRowRenderContext
    for (const render of [renderJobCustomerLine, renderJobCustomerAndAddressLine]) {
      renderWithProviders(<>{render(ctx, named)}</>)
      const names = [...document.querySelectorAll('button, [role="button"]')].map((b) => navButtonName(b)).filter((n): n is string => !!n)
      expect(names).toContain('customer-messages')
      expect(names).toContain('development-filter')
      for (const n of names) expect(n).not.toMatch(/Dana|Whitfield|Ridgeway|Cedar|555/)
      cleanup()
    }
  })
})
