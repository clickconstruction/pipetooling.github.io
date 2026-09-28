// @vitest-environment jsdom
/**
 * New Job's imports as a hook. Pins the seam over a client that answers per table and records
 * every write: what a bid import asks and in which order, what it fills in and what it writes on
 * the bid, when it hands the choice to the picker, what a pick records; and what an estimate
 * fills in, with a customer from the cache or read for the occasion.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { SetStateAction } from 'react'
import { useJobFormImport, type JobFormImportArgs, type JobImportWinningGcPick } from './useJobFormImport'
import type { FixtureRow } from '../lib/jobs/jobFormTypes'

const db = vi.hoisted(() => ({
  /** What a list read of each table answers. */
  lists: {} as Record<string, { data: unknown; error: unknown }>,
  /** What a `.maybeSingle()` read of each table answers. */
  singles: {} as Record<string, { data: unknown; error: unknown }>,
  reads: [] as string[],
  updates: [] as Array<{ table: string; patch: unknown; filters: unknown[] }>,
  outcomeCalls: [] as unknown[],
  outcomeResult: { error: null as string | null, bidOutcomeSet: 'won' as const, autoLost: [] as string[] },
}))
const ui = vi.hoisted(() => ({ showToast: vi.fn(), confirmDialog: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const filters: unknown[] = []
      const list = (): Promise<{ data: unknown; error: unknown }> => {
        db.reads.push(table)
        return Promise.resolve(db.lists[table] ?? { data: [], error: null })
      }
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'order', 'limit']) builder[m] = () => builder
      for (const m of ['eq', 'in', 'is']) {
        builder[m] = (...a: unknown[]) => {
          filters.push(m, ...a)
          return builder
        }
      }
      builder.maybeSingle = () => {
        db.reads.push(`${table}:one`)
        return Promise.resolve(db.singles[table] ?? { data: null, error: null })
      }
      builder.then = (onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected?: (e: unknown) => unknown) => list().then(onFulfilled, onRejected)
      builder.update = (patch: unknown) => {
        const u: Record<string, unknown> = {}
        const uf: unknown[] = []
        for (const m of ['eq', 'is']) {
          u[m] = (...a: unknown[]) => {
            uf.push(m, ...a)
            return u
          }
        }
        u.then = (onFulfilled: (v: { error: unknown }) => unknown) => {
          db.updates.push({ table, patch, filters: uf })
          return Promise.resolve({ error: null }).then(onFulfilled)
        }
        return u
      }
      return builder
    },
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => PromiseLike<{ data: unknown; error: unknown }>) => {
    const r = await op()
    if (r.error) throw r.error
    return r.data
  },
  formatPostgrestOrUnknownError: (e: unknown, fallback: string) => `${fallback}: ${(e as { message?: string })?.message ?? 'unknown'}`,
}))
vi.mock('../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast: ui.showToast }) }))
vi.mock('../contexts/ConfirmDialogContext', () => ({ useConfirmDialog: () => ui.confirmDialog }))
vi.mock('../lib/bids/gcPacketOutcome', () => ({
  setGcPacketOutcome: async (args: unknown) => {
    db.outcomeCalls.push(args)
    return db.outcomeResult
  },
}))

const bidRow = (over: Record<string, unknown> = {}) => ({
  id: 'bid-1',
  project_name: 'Oak Ridge',
  bid_number: '482',
  service_type_id: null,
  customer_id: 'gc-own',
  address: ' 12 Main St ',
  drive_link: 'https://drive/own',
  plans_link: null,
  outcome: null,
  bid_date_sent: '2026-08-20',
  agreed_value: null,
  customers: { name: 'Own GC', address: null, contact_info: null, date_met: null },
  ...over,
})
const versionRow = (id: string, customerId: string | null, outcome: string | null = null) => ({ id, name: id, customer_id: customerId, sort_order: 0, created_at: '2026-08-01', outcome })
const sendRow = (versionId: string, value: number) => ({ bid_version_id: versionId, sent_on: '2026-08-20', value, is_alternate: false, created_at: '2026-08-20' })

function mount(over: Partial<JobFormImportArgs> = {}) {
  const held = { fixtures: [] as FixtureRow[], drive: '', plans: '', customers: (over.customers ?? []) as JobFormImportArgs['customers'] }
  const apply = <T,>(action: SetStateAction<T>, prev: T): T => (typeof action === 'function' ? (action as (p: T) => T)(prev) : action)
  const spies = {
    setWinningGcPick: vi.fn(),
    closeForm: vi.fn(async () => true),
    setFixtures: vi.fn((a: SetStateAction<FixtureRow[]>) => {
      held.fixtures = apply(a, held.fixtures)
    }),
    setFixtureScopeExpandedById: vi.fn(),
    setSelectedSegmentIds: vi.fn(),
    setBidId: vi.fn(),
    setBids: vi.fn(),
    setLinkedBidSummary: vi.fn(),
    setLinkedBidGc: vi.fn(),
    pickGcCustomerId: vi.fn(),
    setBillToParty: vi.fn(),
    setFormServiceTypeId: vi.fn(),
    setJobName: vi.fn(),
    setJobAddress: vi.fn(),
    setGoogleDriveLink: vi.fn((a: SetStateAction<string>) => {
      held.drive = apply(a, held.drive)
    }),
    setJobPlansLink: vi.fn((a: SetStateAction<string>) => {
      held.plans = apply(a, held.plans)
    }),
    setCustomerId: vi.fn(),
    setCustomers: vi.fn((a: SetStateAction<JobFormImportArgs['customers']>) => {
      held.customers = apply(a, held.customers)
    }),
    setCustomerName: vi.fn(),
    setCustomerEmail: vi.fn(),
    setCustomerPhone: vi.fn(),
    setDateMet: vi.fn(),
  }
  const armed = { current: false }
  const args: JobFormImportArgs = {
    authUserId: 'user-1',
    authRole: 'dev',
    customers: [],
    serviceTypes: [],
    meServiceTypeColumns: null,
    winningGcPick: null,
    closeFormRef: { current: spies.closeForm },
    newJobSnapshotArmedRef: armed,
    ...spies,
    ...over,
  }
  const hook = renderHook((a: JobFormImportArgs) => useJobFormImport(a), { initialProps: args })
  return { ...hook, spies, held, armed }
}

const toasts = () => ui.showToast.mock.calls.map((c) => c[0] as string)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  db.lists = {}
  db.singles = {}
  db.reads.length = 0
  db.updates.length = 0
  db.outcomeCalls.length = 0
  db.outcomeResult = { error: null, bidOutcomeSet: 'won', autoLost: [] }
})

describe('useJobFormImport — cancelBidImport', () => {
  it('says what happened, and closes the form only when it was opened for the import', () => {
    const { result, spies } = mount()
    act(() => result.current.cancelBidImport(false, 'Import cancelled'))
    expect(ui.showToast).toHaveBeenCalledWith('Import cancelled', 'info')
    expect(spies.closeForm).not.toHaveBeenCalled()
    act(() => result.current.cancelBidImport(true, 'Import cancelled'))
    expect(spies.closeForm).toHaveBeenCalledTimes(1)
  })
})

describe('useJobFormImport — a bid', () => {
  it('a bid that is not there fills nothing in', async () => {
    const { result, spies } = mount()
    await act(() => result.current.applyPrefillFromBid('bid-x'))
    expect(ui.showToast).toHaveBeenCalledWith('Bid not found.', 'error')
    expect(spies.setBidId).not.toHaveBeenCalled()
  })

  it('a read that fails says so', async () => {
    db.singles.bids = { data: null, error: { message: 'timeout' } }
    const { result, spies } = mount()
    await act(() => result.current.applyPrefillFromBid('bid-1'))
    expect(ui.showToast).toHaveBeenCalledWith('Could not load bid: timeout', 'error')
    expect(spies.setBidId).not.toHaveBeenCalled()
  })

  it('warns when a job already exists from the bid; Cancel fills nothing in and closes a form opened for the import', async () => {
    db.singles.bids = { data: bidRow(), error: null }
    db.lists.jobs_ledger = { data: [{ id: 'job-9', hcp_number: '1042', created_at: '2026-09-01' }], error: null }
    ui.confirmDialog.mockResolvedValueOnce(false)
    const { result, spies } = mount()
    await act(() => result.current.applyPrefillFromBid('bid-1', undefined, { closeOnCancel: true }))
    expect(ui.confirmDialog.mock.calls[0]?.[0]).toMatchObject({ title: 'A job already exists from this bid', confirmLabel: 'Create another job' })
    expect(toasts()[0]).toMatch(/^Nothing created — /)
    expect(spies.closeForm).toHaveBeenCalledTimes(1)
    expect(spies.setBidId).not.toHaveBeenCalled()
    expect(db.reads).not.toContain('bid_versions')
  })

  it('one GC, nothing sent: fills the form in with no question, as a GC job', async () => {
    db.singles.bids = { data: bidRow(), error: null }
    const { result, spies, held, armed } = mount()
    await act(() => result.current.applyPrefillFromBid('bid-1'))
    expect(ui.confirmDialog).not.toHaveBeenCalled()
    expect(spies.setFixtures).not.toHaveBeenCalled()
    expect(spies.setBidId).toHaveBeenCalledWith('bid-1')
    expect(spies.setJobName).toHaveBeenCalledWith('Oak Ridge')
    expect(spies.setJobAddress).toHaveBeenCalledWith('12 Main St')
    expect(spies.setLinkedBidSummary).toHaveBeenCalledWith({ project_name: 'Oak Ridge', bid_number: '482', service_type_id: null })
    expect(spies.setLinkedBidGc).toHaveBeenCalledWith({ id: 'gc-own', name: 'Own GC' })
    expect(spies.pickGcCustomerId).toHaveBeenCalledWith('gc-own')
    expect(spies.setBillToParty).toHaveBeenCalledWith('gc')
    expect(held.drive).toBe('https://drive/own')
    expect(held.plans).toBe('')
    expect(toasts()).toContain('Imported from bid.')
    expect(armed.current).toBe(true)
    expect(db.updates).toEqual([])
  })

  it('an agreed value is offered; Yes makes it the first line item and writes nothing on the bid', async () => {
    db.singles.bids = { data: bidRow({ agreed_value: '15000' }), error: null }
    ui.confirmDialog.mockResolvedValueOnce(true)
    const { result, held, spies } = mount()
    await act(() => result.current.applyPrefillFromBid('bid-1'))
    expect(ui.confirmDialog.mock.calls[0]?.[0]).toMatchObject({ title: 'Start the job at $15,000.00?', cancelLabel: 'Start at $0' })
    expect(held.fixtures).toHaveLength(1)
    expect(held.fixtures[0]).toMatchObject({ name: 'Bid price', count: 1, line_unit_price: 15_000, line_description: 'B482 · Oak Ridge — agreed value', invoice_id: null })
    expect(typeof held.fixtures[0]?.id).toBe('string')
    expect(spies.setFixtureScopeExpandedById).toHaveBeenCalledWith({})
    expect(db.updates).toEqual([])
  })

  it('with no agreed value, what the GC was sent is offered; Yes also records it on the bid, only where none is set', async () => {
    db.singles.bids = { data: bidRow(), error: null }
    db.lists.bid_versions = { data: [versionRow('v1', null)], error: null }
    db.lists.bid_version_sends = { data: [sendRow('v1', 12_000)], error: null }
    ui.confirmDialog.mockResolvedValueOnce(true)
    const { result, held } = mount()
    await act(() => result.current.applyPrefillFromBid('bid-1'))
    expect(ui.confirmDialog.mock.calls[0]?.[0].message).toContain("That's what Own GC was sent on B482 · Oak Ridge.")
    expect(held.fixtures[0]).toMatchObject({ line_unit_price: 12_000, line_description: 'B482 · Oak Ridge — as sent' })
    expect(db.updates).toEqual([{ table: 'bids', patch: { agreed_value: 12_000 }, filters: ['eq', 'id', 'bid-1', 'is', 'agreed_value', null] }])
  })

  it('No starts the job at $0 and writes nothing anywhere', async () => {
    db.singles.bids = { data: bidRow(), error: null }
    db.lists.bid_versions = { data: [versionRow('v1', null)], error: null }
    db.lists.bid_version_sends = { data: [sendRow('v1', 12_000)], error: null }
    ui.confirmDialog.mockResolvedValueOnce(false)
    const { result, spies } = mount()
    await act(() => result.current.applyPrefillFromBid('bid-1'))
    expect(spies.setFixtures).not.toHaveBeenCalled()
    expect(db.updates).toEqual([])
    expect(spies.setBidId).toHaveBeenCalledWith('bid-1')
  })

  it('several GCs and no recorded winner: hands the choice to the picker and fills nothing in', async () => {
    db.singles.bids = { data: bidRow(), error: null }
    db.lists.bid_versions = { data: [versionRow('v1', null), versionRow('v2', 'gc-a')], error: null }
    db.lists.bid_version_sends = { data: [sendRow('v1', 12_000), sendRow('v2', 11_000)], error: null }
    db.lists.customers = { data: [{ id: 'gc-a', name: 'Acme' }], error: null }
    const { result, spies } = mount()
    await act(() => result.current.applyPrefillFromBid('bid-1', undefined, { closeOnCancel: true }))
    expect(spies.setWinningGcPick).toHaveBeenCalledTimes(1)
    const pick = spies.setWinningGcPick.mock.calls[0]?.[0] as JobImportWinningGcPick
    expect(pick).toMatchObject({ bidId: 'bid-1', bidName: 'Oak Ridge', writesWin: true, bidOutcome: null, closeOnCancel: true })
    expect(pick.options.map((o) => [o.key, o.name, o.value])).toEqual([
      ['', 'Own GC', 12_000],
      ['gc-a', 'Acme', 11_000],
    ])
    expect(ui.confirmDialog).not.toHaveBeenCalled()
    expect(spies.setBidId).not.toHaveBeenCalled()
  })

  it('several GCs with one recorded winner: imports silently as that GC, at what it was sent', async () => {
    db.singles.bids = { data: bidRow(), error: null }
    db.lists.bid_versions = { data: [versionRow('v1', null, 'lost'), versionRow('v2', 'gc-a', 'won')], error: null }
    db.lists.bid_version_sends = { data: [sendRow('v1', 12_000), sendRow('v2', 11_000)], error: null }
    db.lists.customers = { data: [{ id: 'gc-a', name: 'Acme' }], error: null }
    ui.confirmDialog.mockResolvedValueOnce(false)
    const { result, spies } = mount()
    await act(() => result.current.applyPrefillFromBid('bid-1'))
    expect(spies.setWinningGcPick).not.toHaveBeenCalled()
    expect(ui.confirmDialog.mock.calls[0]?.[0].title).toBe('Start the job at $11,000.00?')
    expect(spies.setLinkedBidGc).toHaveBeenCalledWith({ id: 'gc-a', name: 'Acme' })
    expect(spies.pickGcCustomerId).toHaveBeenCalledWith('gc-a')
  })

  it('a forced GC (the picker’s pick) skips the second-conversion check and the packet reads', async () => {
    db.singles.bids = { data: bidRow(), error: null }
    db.lists.jobs_ledger = { data: [{ id: 'job-9', hcp_number: '1042' }], error: null }
    ui.confirmDialog.mockResolvedValueOnce(true)
    const { result, spies } = mount({ customers: [{ id: 'gc-a', name: 'Acme (cached)' }] as unknown as JobFormImportArgs['customers'] })
    await act(() => result.current.applyPrefillFromBid('bid-1', { key: 'gc-a', customerId: 'gc-a', name: 'Acme', sentOn: null, value: 9_000, outcome: null, sharedLetter: false }))
    expect(db.reads).toEqual(['bids:one'])
    expect(ui.confirmDialog).toHaveBeenCalledTimes(1)
    expect(ui.confirmDialog.mock.calls[0]?.[0].title).toBe('Start the job at $9,000.00?')
    expect(spies.setLinkedBidGc).toHaveBeenCalledWith({ id: 'gc-a', name: 'Acme (cached)' })
  })

  it('a trade the form does not offer this role is left unset, with a note; an offered one is set', async () => {
    db.singles.bids = { data: bidRow({ service_type_id: 'st-hidden' }), error: null }
    const hidden = mount({ serviceTypes: [{ id: 'st-1', name: 'Plumbing', color: null }] })
    await act(() => hidden.result.current.applyPrefillFromBid('bid-1'))
    expect(hidden.spies.setFormServiceTypeId).not.toHaveBeenCalled()
    expect(toasts()).toContain('Bid trade is not available for your role in this form; choose a service type.')
    cleanup()
    db.singles.bids = { data: bidRow({ service_type_id: 'st-1' }), error: null }
    const offered = mount({ serviceTypes: [{ id: 'st-1', name: 'Plumbing', color: null }] })
    await act(() => offered.result.current.applyPrefillFromBid('bid-1'))
    expect(offered.spies.setFormServiceTypeId).toHaveBeenCalledWith('st-1')
  })

  it('never overwrites a Drive or plans link the office already typed', async () => {
    db.singles.bids = { data: bidRow({ plans_link: 'https://plans/bid' }), error: null }
    const { result, held } = mount()
    held.drive = 'https://drive/typed'
    await act(() => result.current.applyPrefillFromBid('bid-1'))
    expect(held.drive).toBe('https://drive/typed')
    expect(held.plans).toBe('https://plans/bid')
  })
})

describe('useJobFormImport — the picker’s pick', () => {
  const pick = (over: Partial<JobImportWinningGcPick> = {}): JobImportWinningGcPick => ({
    bidId: 'bid-1',
    bidName: 'Oak Ridge',
    options: [],
    writesWin: true,
    bidOutcome: null,
    closeOnCancel: false,
    packets: [
      { key: '', gcId: null, name: 'Own GC', versions: [versionRow('v1', null)], sentOn: '2026-08-20', sentValue: 12_000, outcome: null },
      { key: 'gc-a', gcId: 'gc-a', name: 'Acme', versions: [versionRow('v2', 'gc-a')], sentOn: '2026-08-20', sentValue: 11_000, outcome: 'lost' },
    ],
    ...over,
  })
  const acme = { key: 'gc-a', customerId: 'gc-a', name: 'Acme', sentOn: '2026-08-20', value: 11_000, outcome: 'lost', sharedLetter: false }

  it('records the Won on the bid, tells the page, then imports as that GC', async () => {
    db.singles.bids = { data: bidRow(), error: null }
    db.outcomeResult = { error: null, bidOutcomeSet: 'won', autoLost: ['Own GC'] }
    ui.confirmDialog.mockResolvedValueOnce(false)
    const heard = vi.fn()
    window.addEventListener('bid-gc-outcome-changed', heard)
    const { result, spies } = mount({ winningGcPick: pick() })
    await act(async () => {
      await result.current.handleWinningGcPick(acme)
      await Promise.resolve()
    })
    window.removeEventListener('bid-gc-outcome-changed', heard)
    expect(spies.setWinningGcPick).toHaveBeenCalledWith(null)
    expect(db.outcomeCalls).toHaveLength(1)
    expect(db.outcomeCalls[0]).toMatchObject({ bidId: 'bid-1', versionIds: ['v2'], outcome: 'won', previousOutcome: 'lost', actor: { userId: 'user-1', role: 'dev', path: 'job-import' } })
    expect(heard).toHaveBeenCalledTimes(1)
    expect(toasts()).toContain('Acme marked won on the bid — Own GC marked lost (GC lost the project).')
    await vi.waitFor(() => expect(spies.setLinkedBidGc).toHaveBeenCalledWith({ id: 'gc-a', name: 'Acme' }))
  })

  it('a refused write is shown, and the import still goes on', async () => {
    db.singles.bids = { data: bidRow(), error: null }
    db.outcomeResult = { error: 'Not allowed', bidOutcomeSet: 'won', autoLost: [] }
    ui.confirmDialog.mockResolvedValueOnce(false)
    const { result, spies } = mount({ winningGcPick: pick() })
    await act(async () => {
      await result.current.handleWinningGcPick(acme)
    })
    expect(ui.showToast).toHaveBeenCalledWith('Not allowed', 'error')
    await vi.waitFor(() => expect(spies.setBidId).toHaveBeenCalledWith('bid-1'))
  })

  it('records nothing when the outcomes were ambiguous, or for a GC that rode the shared letter', async () => {
    db.singles.bids = { data: bidRow(), error: null }
    ui.confirmDialog.mockResolvedValue(false)
    const ambiguous = mount({ winningGcPick: pick({ writesWin: false }) })
    await act(async () => {
      await ambiguous.result.current.handleWinningGcPick(acme)
    })
    expect(db.outcomeCalls).toEqual([])
    cleanup()
    const shared = mount({ winningGcPick: pick() })
    await act(async () => {
      await shared.result.current.handleWinningGcPick({ key: 'shared:gc-b', customerId: 'gc-b', name: 'Bravo', sentOn: null, value: null, outcome: null, sharedLetter: true })
    })
    expect(db.outcomeCalls).toEqual([])
    expect(toasts()).toContain('Bravo rode the shared letter — nothing recorded on the bid.')
  })

  it('does nothing with no pick open', async () => {
    const { result, spies } = mount({ winningGcPick: null })
    await act(async () => {
      await result.current.handleWinningGcPick(acme)
    })
    expect(spies.setWinningGcPick).toHaveBeenCalledWith(null)
    expect(db.reads).toEqual([])
    expect(db.outcomeCalls).toEqual([])
  })
})

describe('useJobFormImport — an estimate', () => {
  const estimate = (over: Record<string, unknown> = {}) => ({
    id: 'est-1',
    customer_id: 'cust-1',
    for_address: ' 9 Elm St ',
    title: ' Water heater swap ',
    line_items_snapshot: [{ line_item: 'Water heater', description: '50 gal', quantity: 1, unit_price_cents: 120_000, amount_cents: 120_000 }],
    job_ledger_id: null,
    customer_email: 'est@example.com',
    ...over,
  })
  const pat = { id: 'cust-1', name: 'Pat Doe', date_met: '2026-03-04T12:00:00Z', contact_info: { phone: '555-0100', email: 'pat@example.com' } }

  it('an estimate that is not there, or already on a job, fills nothing in', async () => {
    const missing = mount()
    await act(() => missing.result.current.applyPrefillFromEstimate('est-x'))
    expect(ui.showToast).toHaveBeenCalledWith('Estimate not found.', 'error')
    cleanup()
    db.singles.estimates = { data: estimate({ job_ledger_id: 'job-3' }), error: null }
    const linked = mount()
    await act(() => linked.result.current.applyPrefillFromEstimate('est-1'))
    expect(ui.showToast).toHaveBeenCalledWith('This estimate is already linked to a job.', 'warning')
    expect(linked.spies.setJobName).not.toHaveBeenCalled()
  })

  it('clears the bid link, fills the lines and the customer from the cache', async () => {
    db.singles.estimates = { data: estimate(), error: null }
    const { result, spies, held } = mount({ customers: [pat] as unknown as JobFormImportArgs['customers'] })
    await act(() => result.current.applyPrefillFromEstimate('est-1'))
    expect(spies.setBidId).toHaveBeenCalledWith(null)
    expect(spies.setLinkedBidSummary).toHaveBeenCalledWith(null)
    expect(spies.setLinkedBidGc).toHaveBeenCalledWith(null)
    expect(spies.setJobName).toHaveBeenCalledWith('Water heater swap')
    expect(spies.setJobAddress).toHaveBeenCalledWith('9 Elm St')
    expect(held.fixtures).toHaveLength(1)
    expect(held.fixtures[0]).toMatchObject({ name: 'Water heater', count: 1, line_unit_price: 1_200, invoice_id: null })
    expect(spies.setSelectedSegmentIds).toHaveBeenCalledWith(new Set())
    expect(spies.setCustomerId).toHaveBeenCalledWith('cust-1')
    expect(spies.setCustomerName).toHaveBeenCalledWith('Pat Doe')
    expect(spies.setCustomerEmail).toHaveBeenCalledWith('pat@example.com')
    expect(spies.setCustomerPhone).toHaveBeenCalledWith('555-0100')
    expect(spies.setDateMet).toHaveBeenCalledWith('2026-03-04')
    expect(db.reads).toEqual(['estimates:one'])
    expect(toasts()).toContain('Imported from estimate.')
  })

  it('reads a customer the cache does not hold, and adds the row to it', async () => {
    db.singles.estimates = { data: estimate(), error: null }
    db.singles.customers = { data: pat, error: null }
    const { result, spies, held } = mount()
    await act(() => result.current.applyPrefillFromEstimate('est-1'))
    expect(db.reads).toEqual(['estimates:one', 'customers:one'])
    expect(held.customers.map((c) => c.id)).toEqual(['cust-1'])
    expect(spies.setCustomerName).toHaveBeenCalledWith('Pat Doe')
  })

  it('with no customer, or one that cannot be read, keeps only the estimate’s email', async () => {
    db.singles.estimates = { data: estimate({ customer_id: null }), error: null }
    const none = mount()
    await act(() => none.result.current.applyPrefillFromEstimate('est-1'))
    expect(none.spies.setCustomerId).toHaveBeenCalledWith(null)
    expect(none.spies.setCustomerName).toHaveBeenCalledWith('')
    expect(none.spies.setCustomerEmail).toHaveBeenCalledWith('est@example.com')
    expect(none.spies.setDateMet).toHaveBeenCalledWith('')
    cleanup()
    vi.clearAllMocks()
    db.singles.estimates = { data: estimate(), error: null }
    const unreadable = mount()
    await act(() => unreadable.result.current.applyPrefillFromEstimate('est-1'))
    expect(unreadable.spies.setCustomerId).toHaveBeenCalledWith('cust-1')
    expect(unreadable.spies.setCustomerName).toHaveBeenCalledWith('')
    expect(unreadable.spies.setCustomerEmail).toHaveBeenCalledWith('est@example.com')
  })

  it('an estimate with no lines opens with one blank row', async () => {
    db.singles.estimates = { data: estimate({ line_items_snapshot: [] }), error: null }
    const { result, held } = mount()
    await act(() => result.current.applyPrefillFromEstimate('est-1'))
    expect(held.fixtures).toHaveLength(1)
    expect(held.fixtures[0]).toMatchObject({ name: '', count: 1, line_unit_price: null })
  })
})
