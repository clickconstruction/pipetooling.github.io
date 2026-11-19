// @vitest-environment jsdom
/**
 * Render smokes for the bill a waiting sheet rides on, on its row in Jobs → Subs (v2.7835, punch list
 * #388, step 1): a sheet waiting on the customer names its bill or says it has none, a sheet on another
 * stage says nothing, and the line opens Which bill does this sheet ride on? and reloads the ledger after
 * a save. Every name and amount is made up.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

const { io } = vi.hoisted(() => ({ io: { loadDrawTieSheet: vi.fn(), loadDrawTies: vi.fn(), saveDrawBill: vi.fn() } }))

vi.mock('../../hooks/useIsNarrowScreen', () => ({ useIsNarrowScreen: () => false }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../dispatchMode/DispatchModeFooter', () => ({ DISPATCH_MODE_FOOTER_HEIGHT_PX: 56 }))
vi.mock('../../lib/subWorkOrders/drawTieIo', () => io)

import { installDomShims, makeLaborJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import JobsSubLaborTab from './JobsSubLaborTab'

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  localStorage.clear()
})
beforeEach(() => {
  io.loadDrawTieSheet.mockReset()
  io.saveDrawBill.mockReset()
  io.saveDrawBill.mockResolvedValue(undefined)
})

const BILLS = [
  { id: 'b1', status: 'billed', sequence_order: 0, amount: 3000, billed_at: '2026-10-21T17:00:00Z', created_at: '2026-10-01T12:00:00Z' },
  { id: 'b2', status: 'ready_to_bill', sequence_order: 1, amount: 1200, billed_at: null, created_at: '2026-10-02T12:00:00Z' },
]
const JOB = { id: 'job-1', hcp_number: 'S-212', job_name: 'Cedar Hollow Clinic', invoices: BILLS }

function props(over: Record<string, unknown> = {}) {
  return {
    error: null,
    subLaborSearch: '',
    onSubLaborSearchChange: () => {},
    laborJobs: [],
    laborJobsLoading: false,
    laborJobNamesByJobId: {},
    jobs: [JOB],
    authUserId: 'u-1',
    laborJobAssigneesByJobId: new Map(),
    subLaborDueTotal: 0,
    onNewLaborJob: () => {},
    onEditLaborJob: vi.fn(),
    onPrintJobSubSheet: vi.fn(),
    onUpdateLaborJobDate: () => {},
    onSetLaborJobStage: () => {},
    onOpenMakePayment: vi.fn(),
    onOpenBackcharge: vi.fn(),
    hideToolbar: true,
    ...over,
  } as unknown as Parameters<typeof JobsSubLaborTab>[0]
}

const sheet = (over: Record<string, unknown>) => makeLaborJob({ id: 'sheet-1', assigned_to_name: 'Harlan Pruitt', job_number: 'S-212', job_ledger_id: 'job-1', ...over })

describe('JobsSubLaborTab · the bill a waiting sheet rides on', () => {
  it('names the bill on a sheet waiting on the customer', async () => {
    renderWithProviders(<JobsSubLaborTab {...props({ laborJobs: [sheet({ stage: 'customer_pay', draw_invoice_id: 'b1' })] })} />)
    await settle()
    const line = screen.getByTestId('sheet-draw-tie')
    expect(line.textContent).toBe('Rides on bill 1 of 2')
    expect(line.getAttribute('aria-label')).toBe('Rides on bill 1 of 2. Change the bill this sheet rides on')
  })

  it('names the bill from the bills read with the ledger, when the page holds no job for the sheet (v2.7843)', async () => {
    renderWithProviders(<JobsSubLaborTab {...props({ jobs: [], laborJobs: [sheet({ stage: 'customer_pay', draw_invoice_id: 'b2', draw_bills: BILLS })] })} />)
    await settle()
    expect(screen.getByTestId('sheet-draw-tie').textContent).toBe('Rides on bill 2 of 2')
  })

  it('still says tied when neither holds the bills', async () => {
    renderWithProviders(<JobsSubLaborTab {...props({ jobs: [], laborJobs: [sheet({ stage: 'customer_pay', draw_invoice_id: 'b2' })] })} />)
    await settle()
    expect(screen.getByTestId('sheet-draw-tie').textContent).toBe('Rides on a bill')
  })

  it('says nothing on a sheet that is not waiting on the customer', async () => {
    renderWithProviders(<JobsSubLaborTab {...props({ laborJobs: [sheet({ stage: 'walkthrough', draw_invoice_id: null })] })} />)
    await settle()
    expect(screen.queryByTestId('sheet-draw-tie')).toBeNull()
  })

  it('says what the sub reads once the customer paid the tied bill, and turns amber past two days unqueued (step 2)', async () => {
    const today = todayYmdInAppTz()
    const daysAgo = (n: number) => {
      const d = new Date(`${today}T12:00:00Z`)
      d.setUTCDate(d.getUTCDate() - n)
      return d.toISOString().slice(0, 10)
    }
    renderWithProviders(
      <JobsSubLaborTab
        {...props({
          laborJobs: [
            sheet({ id: 'fresh', stage: 'customer_pay', draw_invoice_id: 'b1', customer_paid_on: daysAgo(1) }),
            sheet({ id: 'late', stage: 'customer_pay', draw_invoice_id: 'b1', customer_paid_on: daysAgo(5) }),
            sheet({ id: 'held', stage: 'customer_pay', draw_invoice_id: 'b1', customer_paid_on: daysAgo(5), pay_hold_reason: 'Insurance certificate ran out' }),
            sheet({ id: 'queued', stage: 'customer_pay', draw_invoice_id: 'b1', customer_paid_on: daysAgo(5), payable_after: today }),
            sheet({ id: 'unpaid', stage: 'customer_pay', draw_invoice_id: 'b1', customer_paid_on: null }),
          ],
        })}
      />,
    )
    await settle()
    const lines = screen.getAllByTestId('sheet-sub-sees')
    // One line each for the fresh, the late and the held sheet. The queued and the unpaid sheets say nothing new.
    expect(lines).toHaveLength(3)
    const byTone = (tone: string) => lines.filter((l) => l.getAttribute('data-tone') === tone).map((l) => l.textContent ?? '')
    expect(byTone('amber')).toHaveLength(1)
    expect(byTone('amber')[0]).toMatch(/^Customer paid .+ · not queued, 5 days$/)
    expect(byTone('grey')).toHaveLength(2)
    expect(byTone('grey').some((t) => /^Sub sees: Customer paid [A-Z][a-z]+ \d+$/.test(t))).toBe(true)
    expect(byTone('grey').some((t) => t.endsWith('· on hold'))).toBe(true)
  })

  it('offers the pick on a waiting sheet with no tie, and reloads the ledger after the save', async () => {
    const onReloadLaborJobs = vi.fn()
    io.loadDrawTieSheet.mockResolvedValue({ sheetId: 'sheet-1', jobId: 'job-1', stage: 'customer_pay', drawInvoiceId: null, bills: BILLS })
    renderWithProviders(<JobsSubLaborTab {...props({ laborJobs: [sheet({ stage: 'customer_pay', draw_invoice_id: null })], onReloadLaborJobs })} />)
    await settle()
    const line = screen.getByTestId('sheet-draw-tie')
    expect(line.textContent).toBe('No bill tied')
    fireEvent.click(line)
    const dialog = await screen.findByTestId('sub-sheet-draw-bill-modal')
    expect(dialog.textContent).toContain('Which bill does this sheet ride on?')
    expect(io.loadDrawTieSheet).toHaveBeenCalledWith(expect.anything(), 'sheet-1')
    // Nothing is picked for a sheet with no tie, so the save waits for a pick.
    const save = screen.getByRole('button', { name: 'Save the bill' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.click(screen.getAllByRole('radio')[0]!)
    fireEvent.click(save)
    await waitFor(() => expect(io.saveDrawBill).toHaveBeenCalledWith(expect.anything(), 'sheet-1', 'b1'))
    await waitFor(() => expect(onReloadLaborJobs).toHaveBeenCalledTimes(1))
    expect(screen.queryByTestId('sub-sheet-draw-bill-modal')).toBeNull()
  })
})
