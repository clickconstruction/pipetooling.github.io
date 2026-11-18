// @vitest-environment jsdom
/**
 * The Bill region's header, on the form itself (the Job form map's second pass, cut 2). `JobFormBillingHeader`
 * has its own render test; this pins the wiring: the form hands it the mode, the open job and the billing
 * slice's status. The engine is the real one. A case may set the status it reports, which is the one value
 * the header reads from it, so the autosave line is seen without racing a debounce.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

const db = vi.hoisted(() => ({ job: null as unknown }))
const forced = vi.hoisted(() => ({ status: null as string | null }))

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => db.job }))
vi.mock('../../hooks/useJobFormAutosaveEngine', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../hooks/useJobFormAutosaveEngine')>()
  return {
    ...real,
    useJobFormAutosaveEngine: (args: Parameters<typeof real.useJobFormAutosaveEngine>[0]) => {
      const engine = real.useJobFormAutosaveEngine(args)
      return forced.status ? { ...engine, billingAutosaveStatus: forced.status as typeof engine.billingAutosaveStatus } : engine
    },
  }
})

import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobFormModal from './JobFormModal'

const line = (id: string, name: string, price: number, seq: number) => ({ id, job_id: 'job-oak', name, count: 1, line_unit_price: price, line_description: null, invoice_id: null, sequence_order: seq, line_kind: 'work', stage_kind: null, shared_with_gc: false })
const formProps = { initialJob: null, billingCustomerHighlightInitial: false, fixturesSectionHighlightInitial: false, jobPicturesLinkHighlightInitial: false, alsoOpenCreateCustomerModal: false, onClose: () => {}, onSaved: null }

beforeEach(() => {
  forced.status = null
})

async function openOakHollow(embeddedRegion: 'bill' | null = null) {
  db.job = makeJob({ id: 'job-oak', hcp_number: '951', job_name: 'Oak Hollow', status: 'working', revenue: 2_000, fixtures: [line('f-rough', 'Rough-in', 1_200, 0), line('f-final', 'Final', 800, 1)] })
  renderWithProviders(<JobFormModal mode="edit" editJobId="job-oak" embeddedRegion={embeddedRegion} {...formProps} />)
  await settle()
  await screen.findByDisplayValue('Oak Hollow')
}

async function openNewJob() {
  renderWithProviders(<JobFormModal mode="new" editJobId={null} {...formProps} />)
  await settle()
  await screen.findByText('Billing')
}

describe('Edit Job and New Job: the Bill region’s header', () => {
  it('New Job titles the section Billing and draws the money bar, with no autosave line', async () => {
    forced.status = 'saving'
    await openNewJob()
    expect(screen.getByText('Paid')).toBeTruthy()
    expect(screen.getByText('Billed')).toBeTruthy()
    expect(screen.getByText('Remaining to bill')).toBeTruthy()
    expect(screen.queryByText('Saving…')).toBeNull()
  })

  it('New Job: a priced line reaches the bar, each slice with its share and the whole price remaining', async () => {
    await openNewJob()
    fireEvent.change(screen.getAllByPlaceholderText('Specific work or materials')[0]!, { target: { value: 'Rough-in' } })
    await settle()
    fireEvent.change(screen.getAllByLabelText('Unit price')[0]!, { target: { value: '2000' } })
    await settle()
    expect(screen.getByText('0% Paid')).toBeTruthy()
    expect(screen.getByText('0% Billed')).toBeTruthy()
    const remaining = screen.getByText('Remaining to bill').parentElement as HTMLElement
    expect(remaining.textContent).toContain('2,000')
  })

  it('an open job keeps the Billing title and draws no bar: its money is the ② card', async () => {
    await openOakHollow()
    expect(screen.getByText('Billing')).toBeTruthy()
    expect(screen.queryByText('Remaining to bill')).toBeNull()
    expect(screen.getByTestId('money-card')).toBeTruthy()
    expect(screen.queryByText('Saving…')).toBeNull()
    expect(screen.queryByText(/Autosave failed — edit again to retry/)).toBeNull()
  })

  it('the billing slice saving shows beside the title', async () => {
    forced.status = 'saving'
    await openOakHollow()
    expect(screen.getByText('Billing').parentElement?.textContent).toBe('BillingSaving…')
  })

  it('the billing slice failing shows beside the title, in red', async () => {
    forced.status = 'error'
    await openOakHollow()
    const failed = screen.getByText('Autosave failed — edit again to retry')
    expect(failed.parentElement?.textContent).toBe('BillingAutosave failed — edit again to retry')
    expect(failed.style.color).toBe('var(--text-red-600)')
  })

  it('in the Job window there is no title, and a failed save still shows on the Bill tab', async () => {
    forced.status = 'error'
    await openOakHollow('bill')
    expect(screen.queryByText('Billing')).toBeNull()
    expect(screen.getByText('Autosave failed — edit again to retry').style.textAlign).toBe('right')
  })

  it('in the Job window a quiet save shows nothing', async () => {
    await openOakHollow('bill')
    expect(screen.queryByText('Billing')).toBeNull()
    expect(screen.queryByText('Saving…')).toBeNull()
    expect(screen.queryByText(/Autosave failed — edit again to retry/)).toBeNull()
  })
})
