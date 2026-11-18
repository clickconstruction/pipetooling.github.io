// @vitest-environment jsdom
/**
 * What both customer lines end with (the Stages map's step 12): the GC and development row, the Account-Man chip and
 * the Not in Customers badge, drawn by one helper. The desktop row adds the GC's portal globe and the card leaves it
 * out, and each line keeps its own rule for the badge. Made-up names throughout.
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
// The portal globe as a marker that names its customer, so a case can count the globes a line draws.
vi.mock('../customers/CustomerPortalGlobeButton', () => ({
  default: ({ customerId }: { customerId: string }) => <span data-testid="globe-stub" data-customer={customerId} />,
}))

import { renderJobCustomerAndAddressLine, renderJobCustomerLine } from './jobsStagesRowShared'

const LINES = [
  ['the desktop line', renderJobCustomerLine],
  ['the card line', renderJobCustomerAndAddressLine],
] as const
const ctxWith = (over: Partial<StagesRowRenderContext> = {}) =>
  ({ authRole: 'dev', customers: [], loadJobs: vi.fn(), showToast: vi.fn(), openEditJobAndCreateCustomerFlow: vi.fn(), ...over }) as unknown as StagesRowRenderContext
/** The GC and development row's own box, by the gap only it has. */
const ROLL_UP_ROW = 'span[style*="gap: 0.6rem"]'
const globesFor = (customerId: string) => screen.queryAllByTestId('globe-stub').filter((g) => g.getAttribute('data-customer') === customerId)

beforeAll(installDomShims)
afterEach(cleanup)

describe('the tail both customer lines share', () => {
  const gcJob = makeJob({ customer_id: 'c-owner', customer_name: 'Lee Park', gc_customer_id: 'c-gc', gcCustomer: { id: 'c-gc', name: 'Ridgeway Builders' } })

  it('the desktop line draws the GC’s portal globe beside the GC’s name; the card line draws none', () => {
    renderWithProviders(<>{renderJobCustomerLine(ctxWith(), gcJob)}</>)
    expect(screen.getByTitle('GC/Builder for this job').textContent).toContain('Ridgeway Builders')
    expect(globesFor('c-gc')).toHaveLength(1)
    cleanup()
    renderWithProviders(<>{renderJobCustomerAndAddressLine(ctxWith(), gcJob)}</>)
    expect(screen.getByTitle('GC/Builder for this job').textContent).toContain('Ridgeway Builders')
    expect(globesFor('c-gc')).toHaveLength(0)
  })

  it('a GC with no customer row gets no globe on either line', () => {
    const job = makeJob({ customer_id: 'c-owner', customer_name: 'Lee Park', gcCustomer: { id: null, name: 'Loose Name Builders' } })
    for (const [, render] of LINES) {
      renderWithProviders(<>{render(ctxWith(), job)}</>)
      expect(screen.getByText('Loose Name Builders')).toBeTruthy()
      expect(screen.queryAllByTestId('globe-stub').filter((g) => g.getAttribute('data-customer') !== 'c-owner')).toHaveLength(0)
      cleanup()
    }
  })

  for (const [name, render] of LINES) {
    it(`${name}: a development with a page is a link to it, and one without is plain words`, () => {
      const linked = makeJob({ customer_id: 'c-owner', customer_name: 'Lee Park', development: { id: 'dev-7', name: 'Pretend Acres' } })
      renderWithProviders(<>{render(ctxWith(), linked)}</>)
      const link = screen.getByRole('link', { name: "Open the development's page" })
      expect(link.getAttribute('href')).toBe('/developments/dev-7')
      expect(link.getAttribute('data-nav')).toBe('development-page')
      expect(link.textContent).toBe('Pretend Acres')
      cleanup()
      const loose = makeJob({ customer_id: 'c-owner', customer_name: 'Lee Park', development: { id: null, name: 'Pretend Acres' } })
      renderWithProviders(<>{render(ctxWith(), loose)}</>)
      expect(screen.queryByRole('link', { name: "Open the development's page" })).toBeNull()
      expect(screen.getByTitle('Development for this job').textContent).toBe('Pretend Acres')
    })

    it(`${name}: no GC and no development draws no roll-up row`, () => {
      const bare = renderWithProviders(<>{render(ctxWith(), makeJob({ customer_id: 'c-owner', customer_name: 'Lee Park' }))}</>)
      expect(screen.queryByTitle('GC/Builder for this job')).toBeNull()
      expect(screen.queryByTitle('Development for this job')).toBeNull()
      expect(screen.queryByRole('link', { name: "Open the development's page" })).toBeNull()
      // Not even the row's empty box.
      expect(bare.container.querySelectorAll(ROLL_UP_ROW)).toHaveLength(0)
      cleanup()
      const full = renderWithProviders(<>{render(ctxWith(), gcJob)}</>)
      expect(full.container.querySelectorAll(ROLL_UP_ROW)).toHaveLength(1)
    })

    it(`${name}: a named customer with no customer row wears Not in Customers, and the badge opens the create flow on that job`, () => {
      const open = vi.fn()
      const job = makeJob({ customer_id: null, customer_name: 'Walk In Person' })
      renderWithProviders(<>{render(ctxWith({ openEditJobAndCreateCustomerFlow: open }), job)}</>)
      fireEvent.click(screen.getByRole('button', { name: 'Open Edit Job and create customer from job' }))
      expect(open).toHaveBeenCalledTimes(1)
      expect(open).toHaveBeenCalledWith(job)
    })

    it(`${name}: a linked customer wears no badge`, () => {
      renderWithProviders(<>{render(ctxWith(), makeJob({ customer_id: 'c-owner', customer_name: 'Lee Park' }))}</>)
      expect(screen.queryByRole('button', { name: 'Open Edit Job and create customer from job' })).toBeNull()
    })
  }

  it('a job with a GC and no customer details: the desktop line wears the badge and the card line does not (each keeps its own rule)', () => {
    const job = makeJob({ customer_id: null, customer_name: '', customer_email: '', customer_phone: '', gcCustomer: { id: 'c-gc', name: 'Ridgeway Builders' } })
    renderWithProviders(<>{renderJobCustomerLine(ctxWith(), job)}</>)
    expect(screen.getByRole('button', { name: 'Open Edit Job and create customer from job' })).toBeTruthy()
    cleanup()
    renderWithProviders(<>{renderJobCustomerAndAddressLine(ctxWith(), job)}</>)
    expect(screen.getByText('Ridgeway Builders')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Open Edit Job and create customer from job' })).toBeNull()
  })
})
