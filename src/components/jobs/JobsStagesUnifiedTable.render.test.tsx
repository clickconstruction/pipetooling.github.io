// @vitest-environment jsdom
/**
 * Render-smoke tests for JobsStagesUnifiedTable — the mixed job/invoice-row
 * Stages section table (Ready to Bill / Billed / Collections), extracted from
 * Jobs.tsx in v2.830.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import JobsStagesUnifiedTable, { type JobsStagesUnifiedTableProps } from './JobsStagesUnifiedTable'
import { JobsStagesUnifiedCardList } from './JobsStagesCardList'
import { makeInvoice, makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { StageRow } from '../../lib/jobsStagesBoard'

function makeProps(overrides: Partial<JobsStagesUnifiedTableProps> = {}): JobsStagesUnifiedTableProps {
  return {
    rows: [],
    actionLabel: 'Bill Customer',
    onJobAction: vi.fn(),
    onInvoiceAction: vi.fn(),
    onViewBill: vi.fn(),
    onJobSendBack: vi.fn(),
    onInvoiceSendBack: vi.fn(),
    showRemaining: true,
    showTimeOpen: false,
    sendBackBelowRemaining: false,
    showCreatePartialInvoice: true,
    flashInvoiceId: null,
    stagesJobFlashId: null,
    stagesHamMode: false,
    stagesEditMode: false,
    renderStagesOpenDetailJobName: (j) => <div>{j.job_name ?? '—'}</div>,
    stagesStatusUpdatingId: null,
    pctCompleteSavingId: null,
    updateJobPctComplete: vi.fn(async () => {}),
    commitStagesPctWithNote: vi.fn(async () => {}),
    setCreatePartialInvoiceAmount: vi.fn(),
    setCreatePartialInvoiceJob: vi.fn(),
    openEdit: vi.fn(),
    openStagesDetailJobModal: vi.fn(),
    setAiaG702StagesJob: vi.fn(),
    canCreateHazmatFee: false,
    openHazmatFee: vi.fn(),
    canEditJobPctComplete: true,
    canManageJobPeople: true,
    setManageJobPeople: vi.fn(),
    jobThreadNotesLoadingId: null,
    jobThreadDraft: '',
    jobThreadSubmittingId: null,
    setJobThreadDraft: vi.fn(),
    submitJobThreadNote: vi.fn(async () => {}),
    authUser: { id: 'smoke-auth-user-1' } as JobsStagesUnifiedTableProps['authUser'],
    showToast: vi.fn(),
    customers: [],
    openEditJobAndCreateCustomerFlow: vi.fn(),
    stagesManHoursByJobId: new Map(),
    stagesManHoursLoading: false,
    crewByJobId: new Map(),
    stagesLaborBreakdownByJobId: new Map(),
    expandedJobThreadId: null,
    toggleStagesJobThreadExpanded: vi.fn(),
    jobThreadStatsByJobId: {},
    jobThreadActivityByJobId: {},
    openJobThreadFullscreen: vi.fn(),
    openJobActivityExpand: vi.fn(),
    openJobCalendar: vi.fn(),
    stagesUpcomingByJobId: {},
    stagesWorkedByJobId: {},
    jobThreadFullscreen: false,
    setJobThreadFullscreen: vi.fn(),
    applyStagesInvoiceFocus: vi.fn(() => true),
    canOpenJobScheduleModal: true,
    setScheduleModalJob: vi.fn(),
    openQuickAssignForJob: vi.fn(),
    authRole: 'dev',
    loadJobs: vi.fn(async () => []),
    stagesInvoiceUpdatingId: null,
    invoiceEstimatedBillDateSavingId: null,
    bumpInvoiceEstimatedBillDate: vi.fn(async () => {}),
    setWhenInvoiceBillModal: vi.fn(),
    setWhenInvoiceBillModalDate: vi.fn(),
    ...overrides,
  }
}

describe('JobsStagesUnifiedTable render smoke', () => {
  it('renders the empty-group row with no rows', async () => {
    renderWithProviders(<JobsStagesUnifiedTable {...makeProps()} />)
    await settle()
    expect(screen.getByText('No jobs or invoices in this group')).toBeTruthy()
  })

  it('renders a bare job row, a standalone invoice row, and a merged-billed row', async () => {
    const bareJob = makeJob({ job_name: 'RTB Bare Job', status: 'ready_to_bill' })
    const invoiceJob = makeJob({ job_name: 'RTB Invoice Job', status: 'ready_to_bill' })
    const invoice = makeInvoice({ job_id: invoiceJob.id, amount: 250, status: 'ready_to_bill' })
    const billedJob = makeJob({ job_name: 'Billed Merged Job', status: 'billed' })
    const billedInvoice = makeInvoice({ job_id: billedJob.id, amount: 900, status: 'billed' })
    const rows: StageRow[] = [
      { kind: 'job', job: bareJob },
      { kind: 'invoice', inv: invoice, job: invoiceJob },
      { kind: 'job_with_merged_billed', job: billedJob, inv: billedInvoice },
    ]
    renderWithProviders(<JobsStagesUnifiedTable {...makeProps({ rows })} />)
    await settle()
    expect(screen.getByText('RTB Bare Job')).toBeTruthy()
    expect(screen.getByText('Billed Merged Job')).toBeTruthy()
    // Job-shaped rows carry data-stages-job-id; invoice-bearing rows carry data-stages-invoice-id
    expect(document.querySelector(`tr[data-stages-job-id="${bareJob.id}"]`)).toBeTruthy()
    expect(document.querySelector(`tr[data-stages-invoice-id="${invoice.id}"]`)).toBeTruthy()
    const mergedRow = document.querySelector(`tr[data-stages-invoice-id="${billedInvoice.id}"]`)
    expect(mergedRow).toBeTruthy()
    expect(mergedRow!.getAttribute('data-stages-job-id')).toBe(billedJob.id)
  })

  it('the Progress & payment header sorts by % complete when the tab hands it a toggle (v2.3408)', async () => {
    const onToggleProgressSort = vi.fn()
    const rows: StageRow[] = [{ kind: 'job', job: makeJob({ job_name: 'RTB Sortable', status: 'ready_to_bill' }) }]
    renderWithProviders(<JobsStagesUnifiedTable {...makeProps({ rows, onToggleProgressSort, stagesSortMode: 'progress' })} />)
    await settle()
    const header = screen.getByRole('button', { name: /Progress & payment/ })
    expect(header.getAttribute('aria-pressed')).toBe('true')
    expect(header.closest('th')!.getAttribute('aria-sort')).toBe('ascending')
    fireEvent.click(header)
    expect(onToggleProgressSort).toHaveBeenCalledTimes(1)
  })

  it('applies the flash styling branch to the row matching flashInvoiceId', () => {
    const billedJob = makeJob({ job_name: 'Flash Job', status: 'billed' })
    const billedInvoice = makeInvoice({ job_id: billedJob.id, amount: 500, status: 'billed' })
    const rows: StageRow[] = [{ kind: 'job_with_merged_billed', job: billedJob, inv: billedInvoice }]
    renderWithProviders(
      <JobsStagesUnifiedTable {...makeProps({ rows, flashInvoiceId: billedInvoice.id })} />,
    )
    const row = document.querySelector(`tr[data-stages-invoice-id="${billedInvoice.id}"]`) as HTMLElement
    expect(row).toBeTruthy()
    expect(row.style.backgroundColor).toBe('var(--bg-amber-100)')
    expect(row.style.outline).toContain('#f59e0b')
  })

  it('does not apply flash styling when flashInvoiceId targets another invoice', () => {
    const billedJob = makeJob({ job_name: 'No Flash Job', status: 'billed' })
    const billedInvoice = makeInvoice({ job_id: billedJob.id, amount: 500, status: 'billed' })
    const rows: StageRow[] = [{ kind: 'job_with_merged_billed', job: billedJob, inv: billedInvoice }]
    renderWithProviders(
      <JobsStagesUnifiedTable {...makeProps({ rows, flashInvoiceId: 'some-other-invoice' })} />,
    )
    const row = document.querySelector(`tr[data-stages-invoice-id="${billedInvoice.id}"]`) as HTMLElement
    expect(row.style.backgroundColor).toBe('')
  })

  it('green invoice accent marks standalone invoice rows only (v2.1828)', () => {
    const floaterJob = makeJob({ job_name: 'Floater Job', status: 'working' })
    const floaterInvoice = makeInvoice({ job_id: floaterJob.id, amount: 250, status: 'billed' })
    const bareJob = makeJob({ job_name: 'Bare Job', status: 'ready_to_bill' })
    const billedJob = makeJob({ job_name: 'Merged Job', status: 'billed' })
    const billedInvoice = makeInvoice({ job_id: billedJob.id, amount: 900, status: 'billed' })
    const rows: StageRow[] = [
      { kind: 'invoice', inv: floaterInvoice, job: floaterJob },
      { kind: 'job', job: bareJob },
      { kind: 'job_with_merged_billed', job: billedJob, inv: billedInvoice },
    ]
    renderWithProviders(<JobsStagesUnifiedTable {...makeProps({ rows })} />)
    const standalone = document.querySelector(`tr[data-stages-invoice-id="${floaterInvoice.id}"]`) as HTMLElement
    expect(standalone.style.backgroundColor).toBe('var(--bg-green-tint)')
    expect((standalone.querySelector('td') as HTMLElement).style.borderLeft).toContain('rgb(22, 163, 74)')
    const merged = document.querySelector(`tr[data-stages-invoice-id="${billedInvoice.id}"]`) as HTMLElement
    expect(merged.style.backgroundColor).toBe('')
    const jobRow = document.querySelector(`tr[data-stages-job-id="${bareJob.id}"]`) as HTMLElement
    expect(jobRow.style.backgroundColor).toBe('')
  })

  it('flash styling wins over the green invoice accent (spread order)', () => {
    const floaterJob = makeJob({ job_name: 'Flash Floater', status: 'working' })
    const floaterInvoice = makeInvoice({ job_id: floaterJob.id, amount: 250, status: 'billed' })
    const rows: StageRow[] = [{ kind: 'invoice', inv: floaterInvoice, job: floaterJob }]
    renderWithProviders(
      <JobsStagesUnifiedTable {...makeProps({ rows, flashInvoiceId: floaterInvoice.id })} />,
    )
    const row = document.querySelector(`tr[data-stages-invoice-id="${floaterInvoice.id}"]`) as HTMLElement
    expect(row.style.backgroundColor).toBe('var(--bg-amber-100)')
  })

  it('a job with two sent bills: each bill row says what is paid and left on its own bill; a draft keeps its draft note (table + cards, v2.4349)', async () => {
    // Springtown's shape: bill 2 part-paid by a linked payment, bill 3 nothing paid.
    const job = makeJob({ job_name: 'Two Bills Job', status: 'billed', revenue: 40000, payments_made: 11181.78 })
    const bill2 = makeInvoice({ job_id: job.id, amount: 11770.3, status: 'billed', sequence_order: 1, billed_at: '2026-09-01T15:00:00Z' })
    const bill3 = makeInvoice({ job_id: job.id, amount: 3635.92, status: 'billed', sequence_order: 2, billed_at: '2026-09-23T15:00:00Z' })
    ;(job as unknown as { invoices: unknown[]; payments: unknown[] }).invoices = [bill2, bill3]
    ;(job as unknown as { invoices: unknown[]; payments: unknown[] }).payments = [{ id: 'pay-1', job_id: job.id, invoice_id: bill2.id, amount: 11181.78 }]
    const draftJob = makeJob({ job_name: 'Draft Bill Job', status: 'ready_to_bill' })
    const draft = makeInvoice({ job_id: draftJob.id, amount: 250, status: 'ready_to_bill' })
    const rows: StageRow[] = [
      { kind: 'invoice', inv: bill2, job },
      { kind: 'invoice', inv: bill3, job },
      { kind: 'invoice', inv: draft, job: draftJob },
    ]
    for (const View of [JobsStagesUnifiedTable, JobsStagesUnifiedCardList]) {
      document.body.innerHTML = ''
      renderWithProviders(<View {...makeProps({ rows })} />)
      await settle()
      const lines = screen.getAllByTestId('stages-bill-row-line')
      expect(lines).toHaveLength(2)
      expect(lines[0]!.textContent).toBe('This bill · $11,182 paid$589 left')
      expect(lines[0]!.getAttribute('title')).toBe("This row's bill: $11,770 sent Sep 1. $11,182 is paid on it, and $589 is left.")
      expect(lines[1]!.textContent).toBe('This bill · nothing paid$3,636 left')
      const sentRows = [bill2, bill3].map((b) => document.querySelector(`[data-stages-invoice-id="${b.id}"]`) as HTMLElement)
      for (const r of sentRows) {
        // A sent bill is never called a draft, and the job-level "unallocated" note is gone from it.
        expect(r.textContent).not.toMatch(/draft/)
        expect(r.textContent).not.toMatch(/unallocated/)
        expect(r.textContent).not.toMatch(/Invoice \$/)
      }
      const draftRow = document.querySelector(`[data-stages-invoice-id="${draft.id}"]`) as HTMLElement
      expect(within(draftRow).queryByTestId('stages-bill-row-line')).toBeNull()
    }
    // The table's Ready to Bill draft still reads as a draft.
    document.body.innerHTML = ''
    renderWithProviders(<JobsStagesUnifiedTable {...makeProps({ rows })} />)
    await settle()
    const draftRow = document.querySelector(`tr[data-stages-invoice-id="${draft.id}"]`) as HTMLElement
    expect(draftRow.textContent).toMatch(/\$250 draft/)
  })

  it('mobile unified cards: the standalone invoice card carries the green accent', () => {
    const floaterJob = makeJob({ job_name: 'Card Floater', status: 'working' })
    const floaterInvoice = makeInvoice({ job_id: floaterJob.id, amount: 250, status: 'billed' })
    const plainJob = makeJob({ job_name: 'Plain Card Job', status: 'billed' })
    const rows: StageRow[] = [
      { kind: 'invoice', inv: floaterInvoice, job: floaterJob },
      { kind: 'job', job: plainJob },
    ]
    renderWithProviders(<JobsStagesUnifiedCardList {...makeProps({ rows })} />)
    const card = document.querySelector(`[data-stages-invoice-id="${floaterInvoice.id}"]`) as HTMLElement
    expect(card.style.backgroundColor).toBe('var(--bg-green-tint)')
    expect(card.style.borderLeft).toContain('rgb(22, 163, 74)')
    const plainCard = document.querySelector(`[data-stages-job-id="${plainJob.id}"]`) as HTMLElement
    expect(plainCard.style.borderLeft).toBe('')
  })

  it('Send back and Collections sit in the action column, not the Progress cell (v2.4147)', async () => {
    const billedJob = makeJob({ job_name: 'Move Merged Job', status: 'billed' })
    const billedInvoice = makeInvoice({ job_id: billedJob.id, amount: 900, status: 'billed' })
    const floaterJob = makeJob({ job_name: 'Move Floater Job', status: 'billed' })
    const floaterInvoice = makeInvoice({ job_id: floaterJob.id, amount: 250, status: 'billed' })
    const rows: StageRow[] = [
      { kind: 'job_with_merged_billed', job: billedJob, inv: billedInvoice },
      { kind: 'invoice', inv: floaterInvoice, job: floaterJob },
    ]
    const onJobMoveToCollections = vi.fn()
    renderWithProviders(<JobsStagesUnifiedTable {...makeProps({ rows, sendBackBelowRemaining: true, onJobMoveToCollections })} />)
    await settle()
    const collections = screen.getAllByRole('button', { name: 'Collections' })
    expect(collections).toHaveLength(2)
    for (const btn of collections) {
      const tr = btn.closest('tr') as HTMLElement
      // The button's cell is the row's last one — the action column — and the
      // Progress cell (the one before it) carries no Send back / Collections.
      expect(btn.closest('td')).toBe(tr.lastElementChild)
      const progress = tr.children[tr.children.length - 2] as HTMLElement
      expect(within(progress).queryByRole('button', { name: 'Collections' })).toBeNull()
      expect(within(progress).queryByRole('button', { name: /send back/i })).toBeNull()
    }
    fireEvent.click(collections[0] as HTMLElement)
    expect(onJobMoveToCollections).toHaveBeenCalledWith(billedJob)
  })

  it('renders the bill line\'s extras under the cell on invoice-bearing rows, and no words under the bar (table + cards, v2.4130 / v2.4351)', async () => {
    const billedJob = makeJob({ job_name: 'Chip Merged Job', status: 'billed' })
    const billedInvoice = makeInvoice({ job_id: billedJob.id, amount: 900, status: 'billed' })
    const floaterJob = makeJob({ job_name: 'Chip Floater Job', status: 'billed' })
    const floaterInvoice = makeInvoice({ job_id: floaterJob.id, amount: 250, status: 'billed' })
    const bareJob = makeJob({ job_name: 'Chip Bare Job', status: 'billed' })
    const rows: StageRow[] = [
      { kind: 'job_with_merged_billed', job: billedJob, inv: billedInvoice },
      { kind: 'invoice', inv: floaterInvoice, job: floaterJob },
      { kind: 'job', job: bareJob },
    ]
    const chip = vi.fn((row: StageRow) => (row.kind === 'job' ? null : { extras: <span data-testid="bill-extras">Pays in 9–41d</span> }))
    for (const View of [JobsStagesUnifiedTable, JobsStagesUnifiedCardList]) {
      document.body.innerHTML = ''
      renderWithProviders(<View {...makeProps({ rows, billedBillLine: chip })} />)
      await settle()
      expect(screen.getAllByTestId('bill-extras')).toHaveLength(2)
      // v2.4351: the bar prints nothing under itself on any row.
      expect(document.querySelector('[data-progress-words]')).toBeNull()
    }
    expect(chip).toHaveBeenCalledWith(rows[0])
    expect(chip).toHaveBeenCalledWith(rows[1])
  })

  it('wraps the hazmat button in a green box only for jobs with a live fee (v2.1040)', async () => {
    const withFee = makeJob({ job_name: 'Fee Job', status: 'ready_to_bill' })
    const without = makeJob({ job_name: 'Plain Job', status: 'ready_to_bill' })
    const rows: StageRow[] = [
      { kind: 'job', job: withFee },
      { kind: 'job', job: without },
    ]
    renderWithProviders(
      <JobsStagesUnifiedTable
        {...makeProps({ rows, canCreateHazmatFee: true, hazmatFeeJobIds: new Set([withFee.id]) })}
      />,
    )
    await settle()
    const buttons = screen.getAllByLabelText('Create a hazmat fee for this job')
    expect(buttons).toHaveLength(2)
    const boxed = buttons.filter((b) => (b as HTMLElement).style.border.includes('rgb(34, 197, 94)'))
    expect(boxed).toHaveLength(1)
    expect(boxed[0]?.title).toContain('has a hazmat fee')
  })
})

describe('one door for each thing on the row (v2.4324)', () => {
  function billedRow(overrides: { report_count?: number; billedAt?: string } = {}) {
    const job = makeJob({ job_name: 'Door Merged Job', status: 'billed', report_count: overrides.report_count ?? 0 })
    const inv = makeInvoice({ job_id: job.id, amount: 350, status: 'billed', billed_at: overrides.billedAt ?? '2026-09-03T15:00:00+00:00' })
    job.invoices = [inv]
    const rows: StageRow[] = [{ kind: 'job_with_merged_billed', job, inv }]
    return { job, inv, rows }
  }
  function crewLineLabels(): string[] {
    return Array.from(document.querySelectorAll('.stagesWhenLine b')).map((b) => (b.textContent ?? '').trim())
  }
  function withWideScreen(run: () => Promise<void>) {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query === '(min-width: 1100px)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
    return run().finally(() => {
      window.matchMedia = original
    })
  }

  it('under 1100 px the Job column has one See all pill, no Reports and no Sessions', async () => {
    const { rows } = billedRow()
    const openJobActivityExpand = vi.fn()
    renderWithProviders(<JobsStagesUnifiedTable {...makeProps({ rows, openJobActivityExpand })} />)
    await settle()
    const pill = screen.getByRole('button', { name: 'Expand job activity' })
    expect(pill.textContent).toBe('See all')
    expect(screen.queryByRole('button', { name: /^\d* ?Reports?$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Sessions|Session notes/ })).toBeNull()
    fireEvent.click(pill)
    expect(openJobActivityExpand).toHaveBeenCalledTimes(1)
  })

  it('the pill carries the report count the Reports pill used to show', async () => {
    const { rows } = billedRow({ report_count: 2 })
    renderWithProviders(<JobsStagesUnifiedTable {...makeProps({ rows })} />)
    await settle()
    expect(screen.getByRole('button', { name: 'Expand job activity' }).textContent).toBe('See all · 2 reports')
  })

  it('on a wide screen the activity box is the door: no pill in the Job column', async () => {
    await withWideScreen(async () => {
      const { rows } = billedRow({ report_count: 1 })
      renderWithProviders(<JobsStagesUnifiedTable {...makeProps({ rows })} />)
      await settle()
      expect(document.querySelector('[data-stages-see-all]')).toBeNull()
    })
  })

  it('the contract chip is the one contract door: no ✍ in the quick-action stack', async () => {
    const { job, rows } = billedRow()
    const onOpenJobContract = vi.fn()
    renderWithProviders(
      <JobsStagesUnifiedTable
        {...makeProps({ rows, onOpenJobContract, jobContractCoverageByJobId: new Map([[job.id, { kind: 'none' as const }]]) })}
      />,
    )
    await settle()
    expect(screen.queryByRole('button', { name: 'Open the job contract' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /No contract/ }))
    expect(onOpenJobContract).toHaveBeenCalledWith(job, 'contract')
  })

  it('v2.4342 · a GC job reads No subcontract on file and opens the GC paper door', async () => {
    const { job, rows } = billedRow()
    job.gc_customer_id = 'gc-dudley'
    // No id on the GC: its 🌐 portal button reads useAuth, which this file does not mock.
    job.gcCustomer = { name: 'RMC- Dudley Mason' } as never
    const onOpenJobContract = vi.fn()
    renderWithProviders(
      <JobsStagesUnifiedTable
        {...makeProps({ rows, onOpenJobContract, jobContractCoverageByJobId: new Map([[job.id, { kind: 'none' as const }]]) })}
      />,
    )
    await settle()
    const chip = screen.getByRole('button', { name: /No subcontract on file/ })
    expect(chip.getAttribute('title')).toContain('RMC- Dudley Mason')
    fireEvent.click(chip)
    expect(onOpenJobContract).toHaveBeenCalledWith(job, 'gc-paper')
  })

  it('v2.4342 · a priced Ready to Bill job with a crew booked and nothing on file asks by that day', async () => {
    const job = makeJob({ job_name: 'Booked Ask Job', status: 'ready_to_bill', revenue: 350 })
    const rows: StageRow[] = [{ kind: 'job', job }]
    renderWithProviders(
      <JobsStagesUnifiedTable
        {...makeProps({
          rows,
          onOpenJobContract: vi.fn(),
          jobContractCoverageByJobId: new Map([[job.id, { kind: 'none' as const }]]),
          stagesUpcomingByJobId: { [job.id]: { ymd: '2099-01-02', timeStart: '08:00', timeEnd: '12:00', assigneeNames: [], note: null, bookedYmds: ['2099-01-02'], lastYmd: '2099-01-02', visitCount: 1 } },
        })}
      />,
    )
    await settle()
    const chip = screen.getByRole('button', { name: /Contract by Fri Jan 2/ })
    expect(chip.textContent).toMatch(/^Contract by Fri Jan 2 · \d+d$/)
  })

  it('a billed row with a dates block does not repeat Billed under the crew', async () => {
    const { rows } = billedRow()
    renderWithProviders(<JobsStagesUnifiedTable {...makeProps({ rows, billedLienRunway: () => <span data-testid="dates-block" /> })} />)
    await settle()
    expect(screen.getByTestId('dates-block')).toBeTruthy()
    expect(crewLineLabels()).not.toContain('Billed')
  })

  it('without a dates block the Billed line stays, and a Paid line always stays', async () => {
    const { rows } = billedRow()
    renderWithProviders(<JobsStagesUnifiedTable {...makeProps({ rows })} />)
    await settle()
    expect(crewLineLabels()).toContain('Billed')
    document.body.innerHTML = ''
    const paid = billedRow()
    paid.job.payments = [{ ...({} as (typeof paid.job.payments)[number]), id: 'pay-1', job_id: paid.job.id, paid_on: '2026-09-20', amount: 100 }]
    renderWithProviders(<JobsStagesUnifiedTable {...makeProps({ rows: paid.rows, billedLienRunway: () => null })} />)
    await settle()
    expect(crewLineLabels()).toContain('Paid')
  })
})
