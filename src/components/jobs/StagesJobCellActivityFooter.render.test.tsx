// @vitest-environment jsdom
/**
 * Render smokes for the Job cell's activity footer (the Stages map's step 9, v2.5109: moved
 * out of jobsStagesRowShared as a component) — the invoice jump chips, the contract and legal
 * chips, the bill emailed / Resend line and the See all pill.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import type { JobContractCoverage } from '../../lib/jobs/jobContractCoverage'
import type { LegalMatterRow } from '../../lib/legal/legalMatters'
import type { StagesRowRenderContext } from './jobsStagesRowShared'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import { StagesJobCellActivityFooter } from './StagesJobCellActivityFooter'

const ctxWith = (over: Partial<StagesRowRenderContext> = {}) =>
  ({
    applyStagesInvoiceFocus: vi.fn(() => true),
    authRole: 'dev',
    loadJobs: vi.fn(async () => {}),
    openJobActivityExpand: vi.fn(),
    stagesUpcomingByJobId: {},
    stagesWorkedByJobId: {},
    ...over,
  }) as unknown as StagesRowRenderContext

const inv = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  job_id: 'j',
  amount: 5000,
  status: 'ready_to_bill',
  sequence_order: 1,
  billed_at: null,
  sent_to_customer_at: null,
  external_send_channel: null,
  stripe_invoice_id: null,
  stripe_invoice_status: null,
  ...over,
})

beforeAll(installDomShims)
afterEach(cleanup)

describe('StagesJobCellActivityFooter', () => {
  it('a job with two open bills gets a chip for each, and a chip goes to its row', () => {
    const ctx = ctxWith()
    const job = makeJob({ invoices: [inv('inv-a', { amount: 5000, sequence_order: 1 }), inv('inv-b', { amount: 1200, sequence_order: 2, status: 'billed' })] })
    renderWithProviders(<StagesJobCellActivityFooter ctx={ctx} job={job} />)
    expect(screen.getByText('Open Invoices:')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Go to invoice 2 for $1,200, Unpaid, on Stages' }))
    expect(ctx.applyStagesInvoiceFocus).toHaveBeenCalledWith('inv-b')
    expect(screen.getByRole('button', { name: 'Go to invoice 1 for $5,000, Unpaid, on Stages' })).toBeTruthy()
  })

  it('a paid bill carries no chip; one open bill reads Open Invoice', () => {
    const job = makeJob({ invoices: [inv('inv-a'), inv('inv-paid', { status: 'paid' })] })
    renderWithProviders(<StagesJobCellActivityFooter ctx={ctxWith()} job={job} />)
    expect(screen.getByText('Open Invoice:')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^Go to invoice/ })).toHaveLength(1)
  })

  it('the See all pill opens the job’s activity, unless the row draws its own door', () => {
    const ctx = ctxWith()
    const job = makeJob()
    renderWithProviders(<StagesJobCellActivityFooter ctx={ctx} job={job} />)
    fireEvent.click(screen.getByRole('button', { name: 'Expand job activity' }))
    expect(ctx.openJobActivityExpand).toHaveBeenCalledWith(job)
    cleanup()
    renderWithProviders(<StagesJobCellActivityFooter ctx={ctx} job={job} hideSeeAllButton />)
    expect(screen.queryByRole('button', { name: 'Expand job activity' })).toBeNull()
  })

  it('a Stripe bill emailed to the customer shows Resend and Email sent; without the line, nothing', () => {
    const line = inv('inv-s', { status: 'billed', external_send_channel: 'stripe', stripe_invoice_id: 'in_123', sent_to_customer_at: '2026-10-08T15:36:00Z' })
    const job = makeJob({ customer_email: 'pat@example.com' })
    renderWithProviders(<StagesJobCellActivityFooter ctx={ctxWith()} job={job} billingLineForStripeHint={line as never} />)
    expect(screen.getByText('Email sent')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Resend/ })).toBeTruthy()
    cleanup()
    renderWithProviders(<StagesJobCellActivityFooter ctx={ctxWith()} job={job} billingLineForStripeHint={{ ...line, sent_to_customer_at: null } as never} />)
    expect(screen.queryByText('Email sent')).toBeNull()
  })

  it('a job whose matter asks for review shows the legal chip; with no contract feed there is neither chip', () => {
    const job = makeJob({ status: 'billed' })
    const matter = { id: 'm-1', stage: null, closed_at: null, review_requested_at: '2026-10-01T00:00:00Z' } as unknown as LegalMatterRow
    const legalMatterByJobId = new Map([[job.id, matter]])
    const LEGAL_TITLE = "Legal desk — the account's standing with counsel"
    renderWithProviders(<StagesJobCellActivityFooter ctx={ctxWith({ jobContractCoverageByJobId: new Map<string, JobContractCoverage>(), legalMatterByJobId })} job={job} />)
    expect(screen.getByTitle(LEGAL_TITLE).textContent).toBe('⚖ review requested')
    cleanup()
    renderWithProviders(<StagesJobCellActivityFooter ctx={ctxWith({ legalMatterByJobId })} job={job} />)
    expect(screen.queryByTitle(LEGAL_TITLE)).toBeNull()
  })
})
