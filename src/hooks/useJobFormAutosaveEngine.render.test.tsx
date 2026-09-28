// @vitest-environment jsdom
/**
 * The job form's save engine as a hook, on a fake clock over a client that records every call.
 * Pins what the form relies on: opening a job saves nothing; an edit saves after its debounce
 * and not before; the identity slice waits for its required fields; the four slices stay in
 * their order; a failed save says so and the next edit tries again; a flush does not wait for
 * the clock; and what the engine hands back for hydration moves on with each save.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useJobFormAutosaveEngine, type JobFormAutosaveEngineArgs } from './useJobFormAutosaveEngine'
import type { JobIdentityFormFields } from '../lib/jobs/jobFormAutosaveSlices'
import type { FixtureRow, PaymentRow } from '../lib/jobs/jobFormTypes'
import type { JobWithDetails } from '../types/jobWithDetails'

type Step = { op: string; table: string; payload?: unknown; filters?: unknown[] }

const db = vi.hoisted(() => ({
  steps: [] as Array<{ op: string; table: string; payload?: unknown; filters?: unknown[] }>,
  fail: null as string | null,
  team: [] as string[],
  bidReads: [] as Array<{ outcome: unknown; bid_number: string | null; project_name: string | null } | null>,
  closedRequests: [] as Array<{ id: string; from_user_id: string; title: string }>,
  found: null as unknown,
}))
const ui = vi.hoisted(() => ({ showToast: vi.fn(), dispatchChanged: vi.fn(), dispatchClosure: vi.fn() }))

vi.mock('../lib/supabase', () => {
  const answer = (op: string, table: string) => ({ error: db.fail === `${op}:${table}` ? { message: `${op}:${table} refused` } : null })
  const from = (table: string) => {
    const chain = (op: string, payload?: unknown) => {
      const filters: unknown[] = []
      const b: Record<string, unknown> = {}
      let reads = op
      for (const m of ['eq', 'in']) {
        b[m] = (...a: unknown[]) => {
          filters.push(m, ...a)
          return b
        }
      }
      b.select = () => {
        if (op !== 'select') reads = `${op}+select`
        return b
      }
      b.maybeSingle = () => {
        db.steps.push({ op: 'read-one', table, filters })
        return Promise.resolve({ data: table === 'bids' ? (db.bidReads.shift() ?? null) : null, error: null })
      }
      b.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
        db.steps.push({ op, table, payload, filters })
        const base = answer(op, table)
        const res = reads === 'select' ? { data: db.team.map((user_id) => ({ user_id })), ...base } : reads === 'update+select' ? { data: db.closedRequests, ...base } : base
        return Promise.resolve(res).then(onFulfilled, onRejected)
      }
      return b
    }
    return {
      update: (payload: unknown) => chain('update', payload),
      delete: () => chain('delete'),
      upsert: (payload: unknown) => chain('upsert', payload),
      insert: (payload: unknown) => chain('insert', payload),
      select: () => chain('select'),
    }
  }
  return { supabase: { from, rpc: (name: string, params: unknown) => { db.steps.push({ op: 'rpc', table: name, payload: params }); return Promise.resolve(answer('rpc', name)) } } }
})
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => PromiseLike<{ data: unknown; error: unknown }>) => {
    const r = await op()
    if (r.error) throw r.error
    return r.data
  },
}))
vi.mock('../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast: ui.showToast }) }))
vi.mock('../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => db.found }))
vi.mock('../lib/dispatchRequestHelpers', () => ({ notifyDispatchRequestsChanged: () => ui.dispatchChanged() }))
vi.mock('../lib/dispatchRequestClosure', () => ({ notifyDispatchRequestClosure: (a: unknown) => ui.dispatchClosure(a) }))

const fixture = (id: string, name: string, price: number | null): FixtureRow => ({ id, name, count: 1, line_unit_price: price, line_description: '', invoice_id: null })
const pay = (id: string, amount: number): PaymentRow => ({ id, amount, paid_on: '2026-09-01', sent_on: null, note: null, payment_type: 'check', reference_number: null, invoice_id: null, mercury_transaction_id: null })
const identity = (over: Partial<JobIdentityFormFields> = {}): JobIdentityFormFields => ({
  hcpNumber: '1042',
  clickNumber: '',
  jobName: 'Oak Ridge',
  jobAddress: '12 Main St',
  customerId: null,
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  gcCustomerId: null,
  billToParty: 'customer',
  billCopyOtherParty: false,
  developmentId: null,
  googleDriveLink: '',
  jobPicturesLink: '',
  jobPlansLink: '',
  projectId: '',
  bidId: '',
  serviceTypeId: 'st-1',
  accountManagerUserId: null,
  customerAddressId: null,
  accountManagerRelationship: null,
  ...over,
})
const job = { id: 'job-1', master_user_id: 'master-1', status: 'working' } as unknown as JobWithDetails

function mount(over: Partial<JobFormAutosaveEngineArgs> = {}) {
  const spies = { setEditing: vi.fn(), setFixtures: vi.fn(), onSaved: vi.fn() }
  const args: JobFormAutosaveEngineArgs = {
    editing: job,
    setEditing: spies.setEditing,
    authUser: { id: 'user-1' },
    authRole: 'dev',
    fixtures: [fixture('f1', 'Rough-in', 1_000)],
    setFixtures: spies.setFixtures,
    payments: [pay('p1', 300)],
    riderFeesDollars: 0,
    materials: [{ id: 'm1', description: 'Copper', amount: 120 }],
    teamMemberIds: ['u-1'],
    identityFields: identity(),
    projects: [],
    customers: [],
    developments: [],
    onSavedRef: { current: spies.onSaved },
    ...over,
  }
  const hook = renderHook((a: JobFormAutosaveEngineArgs) => useJobFormAutosaveEngine(a), { initialProps: args })
  return { ...hook, spies, args }
}

const seq = () => db.steps.map((s: Step) => `${s.op}:${s.table}`)
const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
const statuses = (r: { current: ReturnType<typeof useJobFormAutosaveEngine> }) => r.current.editAutosaveSlices.map((s) => s.status)

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
  db.steps.length = 0
  db.fail = null
  db.team = []
  db.bidReads = []
  db.closedRequests = []
  db.found = null
})

describe('useJobFormAutosaveEngine — opening a job', () => {
  it('saves nothing: what the form opens with is what is saved', async () => {
    const { result } = mount()
    await tick(5_000)
    expect(db.steps).toEqual([])
    expect(statuses(result)).toEqual(['idle', 'idle', 'idle', 'idle'])
    expect(result.current.editAutosaveSlices.some((s) => s.isDirty())).toBe(false)
  })

  it('with no job open, an edit saves nothing', async () => {
    const { rerender, args } = mount({ editing: null })
    rerender({ ...args, fixtures: [fixture('f1', 'Rough-in', 2_000)], teamMemberIds: ['u-1', 'u-2'] })
    await tick(5_000)
    expect(db.steps).toEqual([])
  })

  it('hands back the four slices in close-flush order, and each slice’s picture of the form', () => {
    const { result } = mount()
    expect(result.current.editAutosaveSlices).toHaveLength(4)
    expect(result.current.editAutosaveSlices[0]).toBe(result.current.billingAutosave)
    expect(result.current.editAutosaveSlices[1]).toBe(result.current.identityAutosave)
    expect(result.current.autosaveFixturesRef.current.map((f) => f.id)).toEqual(['f1'])
    expect(result.current.autosaveTeamIdsRef.current).toEqual(['u-1'])
    expect(JSON.parse(result.current.identitySliceJson).jn).toBe('Oak Ridge')
  })
})

describe('useJobFormAutosaveEngine — the billing slice', () => {
  it('saves a changed line item after 1.2 s, not before, and moves its record of what is saved on', async () => {
    const { result, rerender, args, spies } = mount()
    rerender({ ...args, fixtures: [fixture('f1', 'Rough-in', 1_500)], riderFeesDollars: 75 })
    expect(result.current.billingAutosave.isDirty()).toBe(true)
    await tick(1_199)
    expect(db.steps).toEqual([])
    await tick(1)
    expect(seq()).toEqual(['update:jobs_ledger', 'upsert:jobs_ledger_payments', 'delete:jobs_ledger_fixtures', 'insert:jobs_ledger_fixtures'])
    expect(db.steps[0]?.payload).toEqual({ revenue: 1_575 })
    expect(result.current.hydratedPaymentIdsRef.current).toEqual(['p1'])
    expect(result.current.billingAutosaveStatus).toBe('saved')
    expect(result.current.billingAutosave.isDirty()).toBe(false)
    expect(spies.onSaved).toHaveBeenCalledTimes(1)
  })

  it('deletes a payment the form owned and dropped, by the ids hydration gave it', async () => {
    const { result, rerender, args } = mount({ payments: [pay('p1', 300), pay('p2', 200)] })
    result.current.hydratedPaymentIdsRef.current = ['p1', 'p2']
    rerender({ ...args, payments: [pay('p1', 300)] })
    await tick(1_200)
    expect(db.steps.find((s: Step) => s.op === 'delete' && s.table === 'jobs_ledger_payments')?.filters).toEqual(['in', 'id', ['p2'], 'eq', 'job_id', 'job-1'])
    expect(result.current.hydratedPaymentIdsRef.current).toEqual(['p1'])
  })

  it('keeps typing from saving: each edit restarts the wait', async () => {
    const { rerender, args } = mount()
    rerender({ ...args, fixtures: [fixture('f1', 'Rough-in', 1_100)] })
    await tick(1_000)
    rerender({ ...args, fixtures: [fixture('f1', 'Rough-in', 1_200)] })
    await tick(1_000)
    expect(db.steps).toEqual([])
    await tick(200)
    expect(db.steps[0]?.payload).toEqual({ revenue: 1_200 })
  })

  it('a failed save says so, marks the slice, leaves it dirty, and the next edit tries again', async () => {
    db.fail = 'delete:jobs_ledger_fixtures'
    const { result, rerender, args, spies } = mount()
    rerender({ ...args, fixtures: [fixture('f1', 'Rough-in', 1_500)] })
    await tick(1_200)
    expect(ui.showToast).toHaveBeenCalledWith('Autosave failed: [object Object]', 'error')
    expect(result.current.billingAutosaveStatus).toBe('error')
    expect(result.current.billingAutosave.isDirty()).toBe(true)
    expect(spies.onSaved).not.toHaveBeenCalled()
    db.fail = null
    db.steps.length = 0
    rerender({ ...args, fixtures: [fixture('f1', 'Rough-in', 1_600)] })
    await tick(1_200)
    expect(seq()).toContain('insert:jobs_ledger_fixtures')
    expect(result.current.billingAutosaveStatus).toBe('saved')
  })

  it('a flush saves what is pending without waiting for the clock', async () => {
    const { result, rerender, args } = mount()
    rerender({ ...args, fixtures: [fixture('f1', 'Rough-in', 1_500)] })
    await act(() => result.current.flushBillingAutosave())
    expect(seq()[0]).toBe('update:jobs_ledger')
    db.steps.length = 0
    await tick(5_000)
    expect(db.steps).toEqual([])
  })
})

describe('useJobFormAutosaveEngine — the identity slice', () => {
  it('saves one update of the job row', async () => {
    const { result, rerender, args } = mount()
    rerender({ ...args, identityFields: identity({ jobName: 'Oak Ridge II' }) })
    await tick(1_200)
    expect(seq()).toEqual(['update:jobs_ledger'])
    expect(db.steps[0]?.payload).toMatchObject({ job_name: 'Oak Ridge II', master_user_id: 'master-1' })
    expect(db.steps[0]?.filters).toEqual(['eq', 'id', 'job-1'])
    expect(result.current.identityAutosave.status).toBe('saved')
  })

  it('waits while a required field is blank, and saves once it is back', async () => {
    const { result, rerender, args } = mount()
    rerender({ ...args, identityFields: identity({ jobName: '  ' }) })
    await tick(5_000)
    expect(db.steps).toEqual([])
    expect(result.current.identityAutosave.isDirty()).toBe(true)
    rerender({ ...args, identityFields: identity({ jobName: 'Oak Ridge II' }) })
    await tick(1_200)
    expect(seq()).toEqual(['update:jobs_ledger'])
  })

  it('reads a newly linked bid before and after the save, and says so when the link moved it', async () => {
    db.bidReads = [
      { outcome: 'won', bid_number: '482', project_name: 'Oak Ridge' },
      { outcome: 'started_or_complete', bid_number: '482', project_name: 'Oak Ridge' },
    ]
    const { result, rerender, args } = mount()
    rerender({ ...args, identityFields: identity({ bidId: 'bid-1' }) })
    await tick(1_200)
    expect(seq()).toEqual(['read-one:bids', 'update:jobs_ledger', 'read-one:bids'])
    expect(ui.showToast).toHaveBeenCalledWith(expect.stringContaining('Bid #482 · Oak Ridge is now'), 'success', expect.any(Number))
    expect(result.current.persistedBidIdRef.current).toBe('bid-1')
  })

  it('a pictures link that goes from blank to set closes the job’s open request and tells who asked', async () => {
    db.closedRequests = [{ id: 'req-1', from_user_id: 'user-9', title: 'Link job pictures' }]
    const { result, rerender, args } = mount()
    rerender({ ...args, identityFields: identity({ jobPicturesLink: 'https://photos/1' }) })
    await tick(1_200)
    expect(seq()).toEqual(['update:jobs_ledger', 'update:dispatch_requests'])
    expect(db.steps[1]?.filters).toEqual(['eq', 'job_ledger_id', 'job-1', 'eq', 'pending_action', 'link_job_pictures', 'eq', 'status', 'open'])
    expect(ui.dispatchChanged).toHaveBeenCalledTimes(1)
    expect(ui.dispatchClosure).toHaveBeenCalledWith(expect.objectContaining({ request: db.closedRequests[0], mode: 'closed', userId: 'user-1' }))
    expect(result.current.persistedPicturesLinkRef.current).toBe('https://photos/1')
    db.steps.length = 0
    rerender({ ...args, identityFields: identity({ jobPicturesLink: 'https://photos/2' }) })
    await tick(1_200)
    expect(seq()).toEqual(['update:jobs_ledger'])
  })
})

describe('useJobFormAutosaveEngine — materials, team, and all four together', () => {
  it('materials: delete, then re-insert, after 1.2 s', async () => {
    const { rerender, args } = mount()
    rerender({ ...args, materials: [{ id: 'm1', description: 'Copper', amount: 150 }] })
    await tick(1_200)
    expect(seq()).toEqual(['delete:jobs_ledger_materials', 'insert:jobs_ledger_materials'])
  })

  it('team: saves after 0.4 s — read, add, remove', async () => {
    db.team = ['u-1']
    const { rerender, args } = mount()
    rerender({ ...args, teamMemberIds: ['u-2'] })
    await tick(399)
    expect(db.steps).toEqual([])
    await tick(1)
    expect(seq()).toEqual(['select:jobs_ledger_team_members', 'insert:jobs_ledger_team_members', 'delete:jobs_ledger_team_members'])
  })

  it('when everything changes at once: team first, then billing, identity and materials begin in that order', async () => {
    db.team = ['u-1']
    const { rerender, args } = mount()
    rerender({
      ...args,
      fixtures: [fixture('f1', 'Rough-in', 1_500)],
      identityFields: identity({ jobName: 'Oak Ridge II' }),
      materials: [{ id: 'm1', description: 'Copper', amount: 150 }],
      teamMemberIds: ['u-1', 'u-2'],
    })
    await tick(400)
    expect(seq()).toEqual(['select:jobs_ledger_team_members', 'insert:jobs_ledger_team_members'])
    db.steps.length = 0
    await tick(800)
    const first = (needle: (s: Step) => boolean) => db.steps.findIndex(needle)
    const billingStarts = first((s) => s.op === 'update' && s.table === 'jobs_ledger' && 'revenue' in (s.payload as object))
    const identityStarts = first((s) => s.op === 'update' && s.table === 'jobs_ledger' && 'job_name' in (s.payload as object))
    const materialsStarts = first((s) => s.table === 'jobs_ledger_materials')
    expect(billingStarts).toBe(0)
    expect(identityStarts).toBeGreaterThan(billingStarts)
    expect(materialsStarts).toBeGreaterThan(identityStarts)
  })

  it('flushing every slice runs them in close-flush order, each to its end before the next', async () => {
    db.team = ['u-1']
    const { result, rerender, args } = mount()
    rerender({
      ...args,
      fixtures: [fixture('f1', 'Rough-in', 1_500)],
      identityFields: identity({ jobName: 'Oak Ridge II' }),
      materials: [{ id: 'm1', description: 'Copper', amount: 150 }],
      teamMemberIds: ['u-1', 'u-2'],
    })
    await act(() => result.current.flushAllAutosaveSlicesRef.current())
    expect(seq()).toEqual([
      'update:jobs_ledger',
      'upsert:jobs_ledger_payments',
      'delete:jobs_ledger_fixtures',
      'insert:jobs_ledger_fixtures',
      'update:jobs_ledger',
      'delete:jobs_ledger_materials',
      'insert:jobs_ledger_materials',
      'select:jobs_ledger_team_members',
      'insert:jobs_ledger_team_members',
    ])
    expect(statuses(result)).toEqual(['saved', 'saved', 'saved', 'saved'])
  })
})

describe('useJobFormAutosaveEngine — re-reading the line items', () => {
  it('takes the rows the database has, and the billing slice treats them as saved', async () => {
    db.found = { id: 'job-1', master_user_id: 'master-1', fixtures: [{ id: 'f1', name: 'Rough-in', count: 1, line_unit_price: 1_000, line_description: '', invoice_id: null, sequence_order: 0 }, { id: 'd1', name: 'Discount', count: 1, line_unit_price: -100, line_description: '', invoice_id: null, sequence_order: 1, line_kind: 'discount' }] }
    // The form holds the rows in state, so the new rows and the re-baseline land in one render.
    const setEditing = vi.fn()
    const base = mount().args
    cleanup()
    const { result } = renderHook(() => {
      const [fixtures, setFixtures] = useState(base.fixtures)
      return { engine: useJobFormAutosaveEngine({ ...base, setEditing, fixtures, setFixtures }), fixtures }
    })
    await act(() => result.current.engine.rehydrateFixturesFromDb('job-1'))
    expect(setEditing).toHaveBeenCalledWith(db.found)
    expect(result.current.fixtures.map((r) => r.id)).toEqual(['f1', 'd1'])
    expect(result.current.engine.persistedDiscountSnapshotRef.current.length).toBe(1)
    expect(result.current.engine.billingAutosave.isDirty()).toBe(false)
    expect(result.current.engine.billingAutosaveStatus).toBe('idle')
    // The re-baseline drops the debounce the new rows started: nothing is written back.
    db.steps.length = 0
    await tick(5_000)
    expect(db.steps).toEqual([])
    expect(result.current.engine.billingAutosaveStatus).toBe('idle')
  })

  it('an edit made after the re-read saves as any edit does', async () => {
    db.found = { id: 'job-1', master_user_id: 'master-1', fixtures: [{ id: 'f1', name: 'Rough-in', count: 1, line_unit_price: 1_000, line_description: '', invoice_id: null, sequence_order: 0 }] }
    const base = mount().args
    cleanup()
    const { result } = renderHook(() => {
      const [fixtures, setFixtures] = useState(base.fixtures)
      return { engine: useJobFormAutosaveEngine({ ...base, fixtures, setFixtures }), setFixtures }
    })
    await act(() => result.current.engine.rehydrateFixturesFromDb('job-1'))
    await tick(5_000)
    expect(db.steps).toEqual([])
    act(() => result.current.setFixtures([fixture('f1', 'Rough-in', 1_250)]))
    await tick(1_200)
    expect(db.steps[0]?.payload).toEqual({ revenue: 1_250 })
  })

  it('keeps the save an unsaved edit is owed: a payment typed just before the re-read is still written', async () => {
    db.found = { id: 'job-1', master_user_id: 'master-1', fixtures: [{ id: 'f1', name: 'Rough-in', count: 1, line_unit_price: 1_000, line_description: '', invoice_id: null, sequence_order: 0 }, { id: 'd1', name: 'Discount', count: 1, line_unit_price: -100, line_description: '', invoice_id: null, sequence_order: 1, line_kind: 'discount' }] }
    const base = mount().args
    cleanup()
    const { result } = renderHook(() => {
      const [fixtures, setFixtures] = useState(base.fixtures)
      const [payments, setPayments] = useState(base.payments)
      return { engine: useJobFormAutosaveEngine({ ...base, fixtures, setFixtures, payments }), setPayments }
    })
    act(() => result.current.setPayments([pay('p1', 300), pay('p2', 50)]))
    await tick(600)
    expect(result.current.engine.billingAutosave.isDirty()).toBe(true)
    await act(() => result.current.engine.rehydrateFixturesFromDb('job-1'))
    expect(result.current.engine.billingAutosave.isDirty()).toBe(true)
    await tick(1_199)
    expect(db.steps).toEqual([])
    await tick(1)
    expect(seq()).toEqual(['update:jobs_ledger', 'upsert:jobs_ledger_payments', 'delete:jobs_ledger_fixtures', 'insert:jobs_ledger_fixtures', 'insert:jobs_ledger_fixtures'])
    expect((db.steps[1]?.payload as Array<{ id: string }>).map((r) => r.id)).toEqual(['p1', 'p2'])
    expect(result.current.engine.billingAutosave.isDirty()).toBe(false)
    expect(result.current.engine.billingAutosaveStatus).toBe('saved')
  })

  it('does nothing when the job cannot be read', async () => {
    const { result, spies } = mount()
    await act(() => result.current.rehydrateFixturesFromDb('job-1'))
    expect(spies.setEditing).not.toHaveBeenCalled()
    expect(spies.setFixtures).not.toHaveBeenCalled()
  })
})
