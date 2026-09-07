import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

/**
 * Create a job from an accepted estimate (the Estimate detail modal and the
 * Edit Job "from estimate" path): the fixture rows the RPC receives, the bid
 * dollars the modal shows, and the submit's gates, argument shaping, customer
 * link and error mapping. The line normaliser has its own suite and is mocked
 * to pass rows through.
 */
const normalize = vi.fn((raw: unknown, _opts?: { allowNegative?: boolean }) => (Array.isArray(raw) ? raw : []) as never)
vi.mock('./estimateLineItemNormalize', () => ({ normalizeEstimateLineItemsFromJson: (raw: unknown, opts?: { allowNegative?: boolean }) => normalize(raw, opts) }))
const resolveMaster = vi.fn(async (_s: unknown, _u: string, _p: string | null) => 'master-1')
vi.mock('./resolveEffectiveJobMasterUserId', () => ({ resolveEffectiveJobMasterUserId: (s: unknown, u: string, p: string | null) => resolveMaster(s, u, p) }))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
  formatErrorMessage: (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback),
}))

import {
  computeCreateJobBidDisplayDollars,
  fixturesPayloadForCreateJobFromEstimate,
  submitCreateJobFromEstimate,
  type EstimateForCreateJob,
} from './createJobFromEstimateSubmit'
import type { EstimateLineItemNormalized } from './estimateLineItemNormalize'

const line = (over: Partial<EstimateLineItemNormalized>): EstimateLineItemNormalized => ({ line_item: '', description: '', quantity: 1, unit_price_cents: 0, amount_cents: 0, ...over })
const rpc = vi.fn(async (_name: string, _args: unknown): Promise<{ data: unknown; error: { message: string } | null }> => ({ data: 'job-1', error: null }))
const supabase = { rpc: (name: string, args: unknown) => rpc(name, args) } as unknown as SupabaseClient<Database>
const estimate = (over: Partial<EstimateForCreateJob> = {}): EstimateForCreateJob => ({
  id: 'e1',
  status: 'customer_accepted',
  project_id: null,
  customer_id: null,
  job_ledger_id: null,
  title: 'Water heater',
  for_address: '1 Main',
  total_cents: 123456,
  line_items_snapshot: [line({ line_item: 'Heater', quantity: 1, unit_price_cents: 120000, amount_cents: 120000 })] as never,
  doc_kind: 'estimate',
  estimate_number: 7,
  bid_id: null,
  ...over,
})
const customers = [
  { id: 'c1', name: 'Acme', master_user_id: 'master-1' },
  { id: 'c2', name: 'Bravo', master_user_id: 'master-1' },
]
const form = { hcp: ' 1842 ', jobName: ' Riverside ', jobAddress: ' 9 Elm ' }

beforeEach(() => {
  rpc.mockClear()
  rpc.mockResolvedValue({ data: 'job-1', error: null })
  normalize.mockClear()
  resolveMaster.mockClear()
  resolveMaster.mockResolvedValue('master-1')
})

describe('fixturesPayloadForCreateJobFromEstimate', () => {
  it('names a row by its line item, else its description, else "Item" when it carries money; skips empty rows; keeps the original index as sequence', () => {
    const rows = [
      line({ line_item: ' Heater ', description: ' 50 gal ', quantity: 1, unit_price_cents: 120050 }),
      line({ description: 'Labor', quantity: 2, unit_price_cents: 8000 }),
      line({ amount_cents: 500, unit_price_cents: 500 }),
      line({}), // nothing to name, no money: skipped
      line({ line_item: 'Fee', unit_price_cents: 12.345 as never, quantity: 1 }),
    ]
    expect(fixturesPayloadForCreateJobFromEstimate(rows)).toEqual([
      { name: 'Heater', count: 1, line_unit_price: 1200.5, line_description: '50 gal', sequence_order: 0 },
      { name: 'Labor', count: 2, line_unit_price: 80, line_description: null, sequence_order: 1 }, // description-named rows carry no separate description
      { name: 'Item', count: 1, line_unit_price: 5, line_description: null, sequence_order: 2 },
      { name: 'Fee', count: 1, line_unit_price: 0.12, line_description: null, sequence_order: 4 },
    ])
    expect(fixturesPayloadForCreateJobFromEstimate([])).toEqual([])
  })
})

describe('computeCreateJobBidDisplayDollars', () => {
  it('sums count × unit price over the fixtures, or falls back to the estimate total when there are none', () => {
    expect(computeCreateJobBidDisplayDollars([line({ line_item: 'A', quantity: 2, unit_price_cents: 1050 }), line({ line_item: 'B', quantity: 1, unit_price_cents: 99 })], 999999)).toBe(21.99)
    expect(computeCreateJobBidDisplayDollars([], 123456)).toBe(1234.56)
    expect(computeCreateJobBidDisplayDollars([], null)).toBe(0)
    expect(computeCreateJobBidDisplayDollars([line({})], 500)).toBe(5) // the only row is skipped → total fallback
  })
})

describe('submitCreateJobFromEstimate', () => {
  it('refuses an estimate that is not accepted, one already linked to a job, or a blank HCP — before touching anything', async () => {
    expect(await submitCreateJobFromEstimate(supabase, 'u1', estimate({ status: 'draft' as never }), null, customers, form)).toEqual({ ok: false, error: 'Only accepted estimates can create a job.' })
    expect(await submitCreateJobFromEstimate(supabase, 'u1', estimate({ job_ledger_id: 'j-existing' }), null, customers, form)).toEqual({ ok: false, error: 'This estimate is already linked to a job.' })
    expect(await submitCreateJobFromEstimate(supabase, 'u1', estimate(), null, customers, { ...form, hcp: '   ' })).toEqual({ ok: false, error: 'HCP # is required.' })
    expect(rpc).not.toHaveBeenCalled()
    expect(resolveMaster).not.toHaveBeenCalled()
  })

  it('calls create_job_from_estimate with the trimmed form, the fixture rows and the chosen customer, and returns the new job id', async () => {
    expect(await submitCreateJobFromEstimate(supabase, 'u1', estimate({ project_id: 'p1' }), 'c2', customers, form)).toEqual({ ok: true, jobId: 'job-1' })
    expect(resolveMaster).toHaveBeenCalledWith(supabase, 'u1', 'p1')
    expect(normalize).toHaveBeenCalledWith(expect.anything(), { allowNegative: false })
    expect(rpc).toHaveBeenCalledWith('create_job_from_estimate', {
      p_estimate_id: 'e1',
      p_hcp_number: '1842',
      p_job_name: 'Riverside',
      p_job_address: '9 Elm',
      p_fixtures: [{ name: 'Heater', count: 1, line_unit_price: 1200, line_description: null, sequence_order: 0 }],
      p_customer_id: 'c2',
    })
  })

  it('blank name and address are omitted, no customer means no customer arg, and a change order lets credit lines stay negative', async () => {
    await submitCreateJobFromEstimate(supabase, 'u1', estimate({ doc_kind: 'change_order', line_items_snapshot: [] as never }), null, customers, { hcp: '1842', jobName: '  ', jobAddress: '' })
    expect(normalize).toHaveBeenCalledWith(expect.anything(), { allowNegative: true })
    expect(rpc.mock.calls[0]![1]).toEqual({ p_estimate_id: 'e1', p_hcp_number: '1842', p_job_name: undefined, p_job_address: undefined, p_fixtures: [] })
  })

  it('maps a missing id, an RPC error and a failed master lookup to errors', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await submitCreateJobFromEstimate(supabase, 'u1', estimate(), null, customers, form)).toEqual({ ok: false, error: 'Job was not created.' })
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'duplicate HCP' } })
    expect(await submitCreateJobFromEstimate(supabase, 'u1', estimate(), null, customers, form)).toEqual({ ok: false, error: 'duplicate HCP' })
    resolveMaster.mockRejectedValueOnce(new Error('no master'))
    expect(await submitCreateJobFromEstimate(supabase, 'u1', estimate(), null, customers, form)).toEqual({ ok: false, error: 'no master' })
    resolveMaster.mockRejectedValueOnce('weird')
    expect(await submitCreateJobFromEstimate(supabase, 'u1', estimate(), null, customers, form)).toEqual({ ok: false, error: 'Could not create job' })
  })
})
