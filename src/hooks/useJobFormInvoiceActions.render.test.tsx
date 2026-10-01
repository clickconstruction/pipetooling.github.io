// @vitest-environment jsdom
/**
 * The job form's invoice doors as a hook. Pins the seam over a client that records every write:
 * what each door refuses before anything is written, what it writes and in which order, what it
 * hands back to the form (the refetched job, the mirrored links, the cleared selection, the
 * Bill-to editor), and that each busy flag comes back down.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { SetStateAction } from 'react'
import { useJobFormInvoiceActions, type JobFormInvoiceActionsArgs } from './useJobFormInvoiceActions'
import { buildJobSegmentsBar, dollarCoverageForSegments } from '../lib/jobs/jobSegmentsCoverage'
import type { FixtureRow } from '../lib/jobs/jobFormTypes'
import type { JobWithDetails } from '../types/jobWithDetails'
import type { JobHazmatIncidentRow } from '../lib/hazmatIncidents'

const db = vi.hoisted(() => ({
  writes: [] as Array<{ step: string; target: string; payload?: unknown; filters?: unknown[] }>,
  insertError: null as unknown,
  linkError: null as unknown,
  partyError: null as unknown,
  rpc: {} as Record<string, { data: unknown; error: unknown }>,
  found: null as unknown,
  prep: { ok: true } as { ok: true } | { ok: false; message: string },
  hazmatLink: { ok: true } as { ok: boolean; error?: string },
  token: 'tok' as string | null,
}))
const ui = vi.hoisted(() => ({ showToast: vi.fn(), openBillCustomer: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (payload: unknown) => ({
        select: () => ({
          single: async () => {
            db.writes.push({ step: 'insert', target: table, payload })
            return db.insertError ? { data: null, error: db.insertError } : { data: { id: `inv-${db.writes.filter((w) => w.step === 'insert').length}` }, error: null }
          },
        }),
      }),
      update: (payload: unknown) => ({
        eq: (col: string, val: unknown) => {
          const stamp = { step: 'update', target: table, payload, filters: [col, val] as unknown[] }
          return {
            in: async (inCol: string, vals: unknown) => {
              db.writes.push({ ...stamp, step: 'link', filters: [col, val, inCol, vals] })
              return { error: db.linkError }
            },
            then: (onFulfilled: (v: { error: unknown }) => unknown) => {
              db.writes.push(stamp)
              return Promise.resolve({ error: db.partyError }).then(onFulfilled)
            },
          }
        },
      }),
    }),
    rpc: async (name: string, params: unknown) => {
      db.writes.push({ step: 'rpc', target: name, payload: params })
      return db.rpc[name] ?? { data: { ok: true }, error: null }
    },
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => PromiseLike<{ data: unknown; error: unknown }>) => {
    const r = await op()
    if (r.error) throw r.error
    return r.data
  },
}))
vi.mock('../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast: ui.showToast }) }))
vi.mock('../contexts/BillCustomerModalContext', () => ({ useBillCustomerModal: () => ({ openBillCustomer: ui.openBillCustomer }) }))
vi.mock('../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => db.found }))
vi.mock('../lib/supabaseAccessTokenForEdge', () => ({ getAccessTokenForEdgeFunctions: async () => db.token }))
vi.mock('../lib/voidStripeInvoiceForRevert', () => ({ prepareBilledInvoicesBeforeJobRevertToReadyToBill: async () => db.prep }))
vi.mock('../lib/hazmatFeeEdit', () => ({
  linkHazmatFeeIncidentToInvoice: async (incidentId: string, invoiceId: string) => {
    db.writes.push({ step: 'hazmat-link', target: incidentId, payload: invoiceId })
    return db.hazmatLink
  },
}))

const fixture = (id: string, name: string, price: number, extra: Partial<FixtureRow> = {}): FixtureRow => ({ id, name, count: 1, line_unit_price: price, line_description: '', invoice_id: null, ...extra })
/** Two stages, $1,000 and $500: a $1,500 job with nothing paid or billed. */
const twoStages = [fixture('f1', 'Rough-in', 1_000), fixture('f2', 'Top-out', 500)]

const job = (over: Record<string, unknown> = {}) =>
  ({ id: 'job-1', status: 'working', customer_id: 'cust-1', revenue: 1_500, invoices: [], payments: [], ...over }) as unknown as JobWithDetails

function mount(over: Partial<JobFormInvoiceActionsArgs> & { fixtures?: FixtureRow[] } = {}) {
  const { fixtures = twoStages, ...rest } = over
  const total = fixtures.reduce((s, f) => s + (f.line_unit_price ?? 0) * f.count, 0)
  const editing = rest.editing === undefined ? job() : rest.editing
  const mirrored = { rows: fixtures }
  const spies = {
    setEditing: vi.fn(),
    setFixtures: vi.fn((action: SetStateAction<FixtureRow[]>) => {
      mirrored.rows = typeof action === 'function' ? action(mirrored.rows) : action
    }),
    flushBillingAutosave: vi.fn(async () => {
      db.writes.push({ step: 'flush', target: 'billing' })
    }),
    setNewInvoiceAmount: vi.fn(),
    setNewInvoiceAmountInputFocused: vi.fn(),
    setSelectedSegmentIds: vi.fn(),
    setBillToEditorInvoice: vi.fn(),
    setError: vi.fn(),
    onSaved: vi.fn(),
    refreshHazmatIncidents: vi.fn(),
    refreshEditingJobAndHydratePayments: vi.fn(),
  }
  const args: JobFormInvoiceActionsArgs = {
    editing,
    authRole: 'dev',
    payments: [],
    jobTotalWithRidersDollars: total,
    segmentCoverage: dollarCoverageForSegments({
      segments: buildJobSegmentsBar({ fixtures, riderFeesDollars: 0, invoiceStatusById: {} }),
      grossDollars: total,
      paidDollars: 0,
      invoices: editing?.invoices,
      payments: [],
    }),
    autosaveFixturesRef: { current: fixtures },
    newInvoiceAmount: '',
    selectedSegmentIds: new Set<string>(),
    onSavedRef: { current: spies.onSaved },
    setEditing: spies.setEditing,
    setFixtures: spies.setFixtures,
    flushBillingAutosave: spies.flushBillingAutosave,
    setNewInvoiceAmount: spies.setNewInvoiceAmount,
    setNewInvoiceAmountInputFocused: spies.setNewInvoiceAmountInputFocused,
    setSelectedSegmentIds: spies.setSelectedSegmentIds,
    setBillToEditorInvoice: spies.setBillToEditorInvoice,
    setError: spies.setError,
    refreshHazmatIncidents: spies.refreshHazmatIncidents,
    refreshEditingJobAndHydratePayments: spies.refreshEditingJobAndHydratePayments,
    ...rest,
  }
  const hook = renderHook((a: JobFormInvoiceActionsArgs) => useJobFormInvoiceActions(a), { initialProps: args })
  return { ...hook, spies, mirrored }
}

const steps = () => db.writes.map((w) => (w.step === 'rpc' ? `rpc:${w.target}` : w.step))
const lastError = (setError: ReturnType<typeof vi.fn>) => setError.mock.calls[setError.mock.calls.length - 1]?.[0]

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  db.writes.length = 0
  db.insertError = null
  db.linkError = null
  db.partyError = null
  db.rpc = {}
  db.found = null
  db.prep = { ok: true }
  db.hazmatLink = { ok: true }
  db.token = 'tok'
})

describe('useJobFormInvoiceActions — a typed amount (createInvoice)', () => {
  it('refuses an amount that is not above zero, after the flush and before any write', async () => {
    const { result, spies } = mount({ newInvoiceAmount: '0' })
    await act(() => result.current.createInvoice())
    expect(lastError(spies.setError)).toBe('Enter a valid amount greater than 0')
    expect(steps()).toEqual(['flush'])
  })

  it('writes a draft for part of the remainder; on a Working job there is no re-sync', async () => {
    db.found = job({ invoices: [{ id: 'inv-1', status: 'ready_to_bill', amount: 300 }] })
    const { result, spies } = mount({ newInvoiceAmount: '300' })
    await act(() => result.current.createInvoice())
    expect(steps()).toEqual(['flush', 'insert'])
    expect(db.writes[1]).toEqual({
      step: 'insert',
      target: 'jobs_ledger_invoices',
      payload: { job_id: 'job-1', amount: 300, status: 'ready_to_bill', sequence_order: 0, estimated_bill_date: null, is_primary_rtb_bundle: false },
    })
    expect(spies.setEditing).toHaveBeenCalledWith(db.found)
    expect(spies.onSaved).toHaveBeenCalledTimes(1)
    expect(lastError(spies.setError)).toBeNull()
    expect(result.current.creatingInvoice).toBe(false)
  })

  it('cuts an amount past the remainder back to it, and says so', async () => {
    const { result, spies } = mount({ newInvoiceAmount: '2000' })
    await act(() => result.current.createInvoice())
    expect(ui.showToast).toHaveBeenCalledWith('Adjusted to remaining unallocated ($1,500.00)', 'info')
    expect(spies.setNewInvoiceAmount).toHaveBeenCalledWith('1500')
    expect((db.writes.find((w) => w.step === 'insert')?.payload as { amount: number }).amount).toBe(1_500)
  })

  it('an amount that is exactly one stage is attached to that stage and mirrored on screen', async () => {
    const { result, spies, mirrored } = mount({ newInvoiceAmount: '500' })
    await act(() => result.current.createInvoice())
    expect(steps()).toEqual(['flush', 'insert', 'link'])
    expect(db.writes[2]).toEqual({ step: 'link', target: 'jobs_ledger_fixtures', payload: { invoice_id: 'inv-1' }, filters: ['job_id', 'job-1', 'sequence_order', [1]] })
    expect(mirrored.rows.map((r) => r.invoice_id)).toEqual([null, 'inv-1'])
    expect(spies.setFixtures).toHaveBeenCalledTimes(1)
    expect(ui.showToast).toHaveBeenCalledWith(expect.stringContaining('Billed as "Top-out"'), 'success')
  })

  it('a failed attach is a toast, not a failure: the draft stands and nothing is mirrored', async () => {
    db.linkError = { message: 'nope' }
    const { result, spies } = mount({ newInvoiceAmount: '500' })
    await act(() => result.current.createInvoice())
    expect(ui.showToast).toHaveBeenCalledWith(expect.stringContaining('could not be attached to "Top-out"'), 'error')
    expect(spies.setFixtures).not.toHaveBeenCalled()
    expect(spies.onSaved).toHaveBeenCalledTimes(1)
  })

  it('on a Ready to Bill job a part draft re-syncs the remainder, and a failed re-sync is reported beside the invoice', async () => {
    db.rpc.ensure_single_ready_to_bill_invoice_for_job = { data: { error: 'Job not found' }, error: null }
    const { result, spies } = mount({ editing: job({ status: 'ready_to_bill' }), newInvoiceAmount: '300' })
    await act(() => result.current.createInvoice())
    expect(steps()).toEqual(['flush', 'insert', 'rpc:ensure_single_ready_to_bill_invoice_for_job'])
    expect(lastError(spies.setError)).toBe('Invoice created, but the remainder draft did not re-sync: Job not found')
    expect(spies.onSaved).toHaveBeenCalledTimes(1)
  })

  it('the whole remainder of a Ready to Bill job opens Bill Customer and writes nothing', async () => {
    const { result } = mount({ editing: job({ status: 'ready_to_bill' }), newInvoiceAmount: '1500' })
    await act(() => result.current.createInvoice())
    expect(steps()).toEqual(['flush'])
    expect(ui.openBillCustomer).toHaveBeenCalledTimes(1)
    expect(ui.openBillCustomer.mock.calls[0]?.[0].payload).toMatchObject({ kind: 'job', job: { id: 'job-1', customer_id: 'cust-1' } })
  })

  it('v2.4307: Make a bill passes the whole remainder itself — an empty amount box still opens Bill Customer', async () => {
    const { result } = mount({ editing: job({ status: 'ready_to_bill' }), newInvoiceAmount: '' })
    await act(() => result.current.createInvoice(1500))
    expect(steps()).toEqual(['flush'])
    expect(ui.openBillCustomer).toHaveBeenCalledTimes(1)
  })

  it('…unless the job has no customer to bill', async () => {
    const { result } = mount({ editing: job({ status: 'ready_to_bill', customer_id: null }), newInvoiceAmount: '1500' })
    await act(() => result.current.createInvoice())
    expect(ui.openBillCustomer).not.toHaveBeenCalled()
    expect(ui.showToast).toHaveBeenCalledWith('Link this job to a customer before billing.', 'error')
    expect(steps()).toEqual(['flush'])
  })

  it('a failed insert shows the database’s words and brings the busy flag down', async () => {
    db.insertError = { message: 'Denied', details: 'row-level security' }
    const { result, spies } = mount({ newInvoiceAmount: '300' })
    await act(() => result.current.createInvoice())
    expect(lastError(spies.setError)).toBe('Denied. row-level security')
    expect(spies.onSaved).not.toHaveBeenCalled()
    expect(result.current.creatingInvoice).toBe(false)
  })

  it('with no job open it does nothing at all', async () => {
    const { result, spies } = mount({ editing: null, newInvoiceAmount: '300' })
    await act(() => result.current.createInvoice())
    expect(steps()).toEqual([])
    expect(spies.setError).not.toHaveBeenCalled()
  })
})

describe('useJobFormInvoiceActions — a selection and a stage row', () => {
  it('refuses an empty selection before the flush', async () => {
    const { result, spies } = mount()
    let id: string | null = 'unset'
    await act(async () => {
      id = await result.current.createInvoiceFromSelectedSegments()
    })
    expect(id).toBeNull()
    expect(lastError(spies.setError)).toBe('Select at least one unbilled segment first')
    expect(steps()).toEqual([])
  })

  it('bills the selection: flush → insert → link → mirror, then clears the selection', async () => {
    const { result, spies, mirrored } = mount({ selectedSegmentIds: new Set(['f1', 'f2']) })
    let id: string | null = null
    await act(async () => {
      id = await result.current.createInvoiceFromSelectedSegments()
    })
    expect(id).toBe('inv-1')
    expect(steps()).toEqual(['flush', 'insert', 'link'])
    expect((db.writes[1]?.payload as { amount: number }).amount).toBe(1_500)
    expect(db.writes[2]?.filters).toEqual(['job_id', 'job-1', 'sequence_order', [0, 1]])
    expect(mirrored.rows.map((r) => r.invoice_id)).toEqual(['inv-1', 'inv-1'])
    expect(spies.setSelectedSegmentIds).toHaveBeenLastCalledWith(new Set())
    expect(ui.showToast).toHaveBeenCalledWith('Invoice created for the remaining $1,500.00 on 2 segments', 'success')
    expect(result.current.creatingSegmentInvoice).toBe(false)
  })

  it('refuses a selection that would bill past what is left, before the flush', async () => {
    // The line items as the autosave holds them ($1,000) against a remainder of $400.
    const { result, spies } = mount({ selectedSegmentIds: new Set(['f1']), segmentCoverage: { unattributedDollars: 1_100, remainingDollars: 400, bySegmentKey: {} } })
    let id: string | null = 'unset'
    await act(async () => {
      id = await result.current.createInvoiceFromSelectedSegments()
    })
    expect(id).toBeNull()
    expect(lastError(spies.setError)).toBe('This selection would bill more than the $400.00 left on the job — void or delete an existing bill first.')
    expect(steps()).toEqual([])
  })

  it('bills a partly covered stage for what is left on it, and says what was subtracted', async () => {
    const { result } = mount({
      selectedSegmentIds: new Set(['f1']),
      segmentCoverage: { unattributedDollars: 300, remainingDollars: 1_200, bySegmentKey: { f1: { coveredDollars: 300, fullyCovered: false } } },
    })
    await act(async () => {
      await result.current.createInvoiceFromSelectedSegments()
    })
    expect((db.writes.find((w) => w.step === 'insert')?.payload as { amount: number }).amount).toBe(700)
    expect(ui.showToast).toHaveBeenCalledWith('Invoice created for the remaining $700.00 on 1 segment ($300.00 already covered was subtracted)', 'success')
  })

  it('a failed link is a failure here: the error shows and nothing is mirrored', async () => {
    db.linkError = { message: 'link failed' }
    const { result, spies } = mount({ selectedSegmentIds: new Set(['f1']) })
    let id: string | null = 'unset'
    await act(async () => {
      id = await result.current.createInvoiceFromSelectedSegments()
    })
    expect(id).toBeNull()
    expect(lastError(spies.setError)).toBe('link failed')
    expect(spies.setFixtures).not.toHaveBeenCalled()
    expect(steps()).toEqual(['flush', 'insert', 'link'])
    expect(result.current.creatingSegmentInvoice).toBe(false)
  })

  it('"Bill it" on a stage row picks that row alone and clears its busy id after', async () => {
    const { result, spies } = mount({ editing: job({ status: 'ready_to_bill' }) })
    await act(() => result.current.billStageRow('f2'))
    expect(spies.setSelectedSegmentIds.mock.calls[0]?.[0]).toEqual(new Set(['f2']))
    expect(steps()).toEqual(['flush', 'insert', 'link', 'rpc:ensure_single_ready_to_bill_invoice_for_job'])
    expect((db.writes[1]?.payload as { amount: number }).amount).toBe(500)
    expect(db.writes[2]?.filters).toEqual(['job_id', 'job-1', 'sequence_order', [1]])
    expect(result.current.billingStageFixtureId).toBeNull()
  })
})

describe('useJobFormInvoiceActions — a draft per payer', () => {
  it('writes the GC’s draft, then the customer’s, stamps each with its party and refetches once', async () => {
    const split = [fixture('f1', 'Rough-in', 1_000, { bill_to_party: 'gc' } as Partial<FixtureRow>), fixture('f2', 'Fixtures', 500, { bill_to_party: 'customer' } as Partial<FixtureRow>)]
    db.found = job()
    const { result, spies } = mount({ fixtures: split })
    await act(() => result.current.carveInvoicesByPayer())
    expect(steps()).toEqual(['flush', 'insert', 'link', 'update', 'flush', 'insert', 'link', 'update'])
    const stamps = db.writes.filter((w) => w.step === 'update')
    expect(stamps.map((w) => w.payload)).toEqual([{ bill_to_party: 'gc' }, { bill_to_party: 'customer' }])
    expect(stamps.map((w) => w.filters)).toEqual([['id', 'inv-1'], ['id', 'inv-2']])
    expect(db.writes.filter((w) => w.step === 'insert').map((w) => (w.payload as { amount: number }).amount)).toEqual([1_000, 500])
    expect(spies.setEditing).toHaveBeenCalled()
    expect(result.current.carvingByPayer).toBe(false)
  })

  it('stops at the first draft that fails', async () => {
    const split = [fixture('f1', 'Rough-in', 1_000, { bill_to_party: 'gc' } as Partial<FixtureRow>), fixture('f2', 'Fixtures', 500, { bill_to_party: 'customer' } as Partial<FixtureRow>)]
    db.insertError = { message: 'Denied' }
    const { result } = mount({ fixtures: split })
    await act(() => result.current.carveInvoicesByPayer())
    expect(steps()).toEqual(['flush', 'insert'])
    expect(result.current.carvingByPayer).toBe(false)
  })
})

describe('useJobFormInvoiceActions — Working → Ready to Bill', () => {
  it('takes the full unallocated amount only', async () => {
    const { result, spies } = mount({ newInvoiceAmount: '1000' })
    await act(() => result.current.moveWorkingJobToReadyToBillFromEdit())
    expect(lastError(spies.setError)).toBe('Enter the full unallocated amount to move this job to Ready to Bill.')
    expect(steps()).toEqual(['flush'])
  })

  it('moves the job, says so and refetches', async () => {
    db.found = job({ status: 'ready_to_bill' })
    const { result, spies } = mount({ newInvoiceAmount: '1500' })
    await act(() => result.current.moveWorkingJobToReadyToBillFromEdit())
    expect(steps()).toEqual(['flush', 'rpc:update_job_status'])
    expect(db.writes[1]?.payload).toEqual({ p_job_id: 'job-1', p_to_status: 'ready_to_bill' })
    expect(ui.showToast).toHaveBeenCalledWith('Job moved to Ready to Bill', 'success')
    expect(spies.setEditing).toHaveBeenCalledWith(db.found)
    expect(spies.onSaved).toHaveBeenCalledTimes(1)
    expect(result.current.movingJobToReadyToBill).toBe(false)
  })

  it('v2.4307: Make a bill passes the remainder itself, so an empty amount box still moves the job', async () => {
    db.found = job({ status: 'ready_to_bill' })
    const { result } = mount({ newInvoiceAmount: '' })
    await act(() => result.current.moveWorkingJobToReadyToBillFromEdit(1500))
    expect(steps()).toEqual(['flush', 'rpc:update_job_status'])
  })

  it('v2.4307: a passed amount that is not the whole remainder is refused like a typed one', async () => {
    const { result, spies } = mount({ newInvoiceAmount: '1500' })
    await act(() => result.current.moveWorkingJobToReadyToBillFromEdit(900))
    expect(lastError(spies.setError)).toBe('Enter the full unallocated amount to move this job to Ready to Bill.')
    expect(steps()).toEqual(['flush'])
  })

  it('shows what the status change refused, a failed bill prep, or a missing sign-in — and writes no further', async () => {
    db.rpc.update_job_status = { data: { error: 'Job has open bills' }, error: null }
    const refused = mount({ newInvoiceAmount: '1500' })
    await act(() => refused.result.current.moveWorkingJobToReadyToBillFromEdit())
    expect(lastError(refused.spies.setError)).toBe('Job has open bills')
    expect(refused.spies.onSaved).not.toHaveBeenCalled()
    cleanup()
    db.writes.length = 0
    db.prep = { ok: false, message: 'Could not void the Stripe bill' }
    const prep = mount({ newInvoiceAmount: '1500' })
    await act(() => prep.result.current.moveWorkingJobToReadyToBillFromEdit())
    expect(lastError(prep.spies.setError)).toBe('Could not void the Stripe bill')
    expect(steps()).toEqual(['flush'])
    cleanup()
    db.writes.length = 0
    db.token = null
    const signedOut = mount({ newInvoiceAmount: '1500' })
    await act(() => signedOut.result.current.moveWorkingJobToReadyToBillFromEdit())
    expect(lastError(signedOut.spies.setError)).toBe('Not signed in')
    expect(steps()).toEqual(['flush'])
  })

  it('does nothing on a job that is not Working', async () => {
    const { result, spies } = mount({ editing: job({ status: 'billed' }), newInvoiceAmount: '1500' })
    await act(() => result.current.moveWorkingJobToReadyToBillFromEdit())
    expect(steps()).toEqual([])
    expect(spies.setError).not.toHaveBeenCalled()
  })
})

describe('useJobFormInvoiceActions — a hazmat fee billed separately', () => {
  const incident = (over: Record<string, unknown> = {}) => ({ id: 'haz-1', fee_amount: 250, incident_at: '2026-09-14T15:00:00Z', invoice_id: null, ...over }) as unknown as JobHazmatIncidentRow

  it('refuses a fee with no amount', async () => {
    const { result, spies } = mount()
    await act(() => result.current.billHazmatFeeSeparately(incident({ fee_amount: 0 })))
    expect(lastError(spies.setError)).toBe('This fee has no amount to bill')
    expect(steps()).toEqual([])
  })

  it('writes the fee’s own draft with its memo, repoints the incident, re-syncs, then opens the Bill-to editor', async () => {
    db.found = job({ status: 'ready_to_bill' })
    const { result, spies } = mount({ editing: job({ status: 'ready_to_bill', invoices: [{ id: 'inv-0', status: 'ready_to_bill', amount: 1_500, is_primary_rtb_bundle: true }] }) })
    await act(() => result.current.billHazmatFeeSeparately(incident()))
    expect(steps()).toEqual(['flush', 'insert', 'hazmat-link', 'rpc:ensure_single_ready_to_bill_invoice_for_job'])
    expect(db.writes[1]?.payload).toEqual({
      job_id: 'job-1',
      amount: 250,
      status: 'ready_to_bill',
      sequence_order: 1,
      estimated_bill_date: null,
      is_primary_rtb_bundle: false,
      stripe_invoice_memo: 'Biohazard remediation fee — incident 09/14/2026',
    })
    expect(db.writes[2]).toEqual({ step: 'hazmat-link', target: 'haz-1', payload: 'inv-1' })
    expect(spies.refreshHazmatIncidents).toHaveBeenCalledTimes(1)
    expect(spies.setBillToEditorInvoice).toHaveBeenCalledWith({ id: 'inv-1', amount: 250, bill_to_name: null, bill_to_email: null, bill_to_phone: null })
    expect(ui.showToast).toHaveBeenCalledWith('Fee split to its own invoice ($250.00). Now choose who pays it.', 'success')
    expect(result.current.billingFeeSeparatelyId).toBeNull()
  })

  it('a fee already on its own unsent draft goes straight to the editor', async () => {
    const own = { id: 'inv-7', status: 'ready_to_bill', amount: 250, is_primary_rtb_bundle: false, stripe_invoice_id: null, sent_to_customer_at: null, external_send_channel: null }
    const { result, spies } = mount({ editing: job({ invoices: [own] }) })
    await act(() => result.current.billHazmatFeeSeparately(incident({ invoice_id: 'inv-7' })))
    expect(steps()).toEqual([])
    expect(spies.setBillToEditorInvoice).toHaveBeenCalledWith(own)
  })

  it('a failed repoint is a failure: the editor does not open', async () => {
    db.hazmatLink = { ok: false, error: 'Incident is locked' }
    const { result, spies } = mount()
    await act(() => result.current.billHazmatFeeSeparately(incident()))
    expect(lastError(spies.setError)).toBe('Incident is locked')
    expect(spies.setBillToEditorInvoice).not.toHaveBeenCalled()
    expect(steps()).toEqual(['flush', 'insert', 'hazmat-link'])
    expect(result.current.billingFeeSeparatelyId).toBeNull()
  })
})
