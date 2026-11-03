/**
 * Follow up's Nudges from the flow, its batch read (`loadNudgeBatch`) over a stubbed database: each kind's people
 * from `flow_rows_kind`, each person handed only their own holds, reminders, notes, lines and owed rows, a customer's
 * page read back and nobody else's, and a read that fails giving an empty list rather than hiding everyone. The names
 * follow the boards' rule: a person's first name, else the company. Nothing here is a real row.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FlowRowsKindAnswer } from './boardRead'
import type { PersonInputs } from './person'
import { NO_PIPELINE_ROWS, type PipelineRows } from './residentialRows'
import { SEED_FLOWS } from './seed'

const TABLES: Record<string, unknown[]> = {}
const failing = new Set<string>()
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'in', 'is', 'not', 'gte']) chain[m] = () => chain
      chain.then = (resolve: (v: unknown) => void) =>
        resolve(failing.has(table) ? { data: null, error: { message: `${table} is not there`, code: '42P01' } } : { data: TABLES[table] ?? [], error: null })
      return chain
    },
  },
}))

const card = (name: string, company: string | null, ids: { customer?: string; gc?: string; type?: string } = {}) => ({
  name,
  goes_by: null,
  company,
  trades: [],
  gc_company_id: ids.gc ?? null,
  customer_id: ids.customer ?? null,
  customer_type: ids.type ?? null,
})
const entry = (kind: string, c: ReturnType<typeof card>) => ({ contact: { kind }, card: c })
const ANSWERS: Record<string, FlowRowsKindAnswer> = {
  customer: { priya: entry('customer', card('Dr. Priya Raman', null, { customer: 'cust-priya' })) } as unknown as FlowRowsKindAnswer,
  trade: {
    greg: entry('trade', card('Greg Paulk', 'Hillside Excavation', { gc: 'co-hillside' })),
    kerr: entry('trade', card('Kerr Electric', 'Kerr Electric', { gc: 'co-kerr' })),
  } as unknown as FlowRowsKindAnswer,
  arch: { jonah: entry('arch', card('Jonah Pratt', 'Pratt Studio', { customer: 'cust-pratt' })) } as unknown as FlowRowsKindAnswer,
}
vi.mock('./flowsIo', () => ({
  loadFlowDef: async (kind: 'customer' | 'trade' | 'arch') => SEED_FLOWS[kind],
  loadFlowRowsKind: async (kind: string) => ANSWERS[kind] ?? {},
}))

const readBack = vi.fn(async (_ids: readonly string[]) => new Map([['cust-priya', { lastOpenedAt: '2026-10-01T14:00:00Z', opens: 2, papers: [] }]]))
vi.mock('../portal/customerPortalViewsIo', () => ({ loadCustomerPortalReadBack: (ids: readonly string[]) => readBack(ids) }))
/** Dana Whitfield's water heater job, the one Pipeline read a homeowner's steps come from (v2.6394). */
const DANA_PIPELINE: PipelineRows = {
  ...NO_PIPELINE_ROWS,
  jobs: [{ id: 'job-1312', created_at: '2026-09-28T13:00:00Z', status: 'waiting', revenue: 1850, customer_id: 'cust-dana', gc_customer_id: null, bill_to_party: 'customer', customer_name: 'Dana Whitfield', job_name: 'the water heater' }],
  blocks: [{ job_id: 'job-1312', work_date: '2026-10-05', created_at: '2026-09-30T13:10:00Z', created_by: 'u-rosa' }],
}
const readPipelineRows = vi.fn(async (_who: { customerIds: readonly (string | null | undefined)[]; contactIds: readonly string[] }) => DANA_PIPELINE)
vi.mock('./residentialRowsIo', () => ({ readPipelineRows: (who: { customerIds: readonly (string | null | undefined)[]; contactIds: readonly string[] }) => readPipelineRows(who) }))

const inputs: PersonInputs[] = []
vi.mock('./person', () => ({
  personFlowFrom: (i: PersonInputs) => {
    inputs.push(i)
    return { id: i.id }
  },
}))

const { loadNudgeBatch, nudgeNamesOf } = await import('./flowNudgesIo')
const NOW = new Date('2026-10-02T16:45:00Z')
const inputOf = (id: string): PersonInputs => {
  const found = inputs.find((i) => i.id === id)
  if (!found) throw new Error(`no inputs for ${id}`)
  return found
}

beforeEach(() => {
  inputs.length = 0
  failing.clear()
  readBack.mockClear()
  readPipelineRows.mockClear()
  TABLES.nudge_holds = [
    { id: 'h1', contact_id: 'greg', step_key: 'ask', project_id: 'boerne', until_on: '2026-10-05', released_at: null },
    { id: 'h2', contact_id: 'jonah', step_key: 'certify', project_id: 'boerne', until_on: '2026-10-05', released_at: null },
  ]
  TABLES.nudge_sent = [{ contact_id: 'greg', step_key: 'ask', project_id: 'boerne', sent_at: '2026-09-30T15:00:00Z', sent_by: 'person' }]
  TABLES.messages = [{ contact_id: 'priya', step_key: 'co', project_id: 'helotes', who_user_id: 'u-rosa', body: 'She is reading it.', at: '2026-10-01T15:00:00Z', direction: 'in' }]
  TABLES.contact_owed = [{ contact_id: 'priya', done_at: null }]
})

describe('loadNudgeBatch', () => {
  it('reads each kind once and hands each person only their own rows', async () => {
    const batch = await loadNudgeBatch(NOW)
    expect(inputs.map((i) => i.id)).toEqual(['priya', 'greg', 'kerr', 'jonah'])
    expect(batch.people.map((p) => p.id)).toEqual(['priya', 'greg', 'kerr', 'jonah'])
    expect(inputOf('greg').holds).toEqual([{ id: 'h1', step_key: 'ask', project_id: 'boerne', until_on: '2026-10-05', released_at: null }])
    expect(inputOf('greg').sent).toEqual([{ step_key: 'ask', project_id: 'boerne', sent_at: '2026-09-30T15:00:00Z', sent_by: 'person' }])
    expect(inputOf('kerr').holds).toEqual([])
    expect(inputOf('priya').owed).toEqual([{ contact_id: 'priya', done_at: null }])
    expect(inputOf('greg').owed).toEqual([])
    expect(inputOf('jonah').flow).toBe(SEED_FLOWS.arch)
    expect(inputOf('greg').now).toBe(NOW)
  })

  it("reads back a customer's page for the customer alone", async () => {
    await loadNudgeBatch(NOW)
    expect(readBack).toHaveBeenCalledWith(['cust-priya'])
    expect(inputOf('priya').portal).toEqual({ lastOpenedAt: '2026-10-01T14:00:00Z', opens: 2, papers: [] })
    for (const id of ['greg', 'kerr', 'jonah']) expect(inputOf(id).portal).toBeNull()
  })

  it('gives an empty list for a read that fails, so one table behind hides nobody', async () => {
    failing.add('nudge_holds')
    readBack.mockRejectedValueOnce(new Error('customer_portal_papers is not there'))
    await loadNudgeBatch(NOW)
    expect(inputs).toHaveLength(4)
    expect(inputOf('greg').holds).toEqual([])
    expect(inputOf('greg').sent).toHaveLength(1)
    expect(inputOf('priya').portal).toBeNull()
  })

  it("names a person by their first name and a company with nobody named by the company, as the boards do", async () => {
    const batch = await loadNudgeBatch(NOW)
    expect(batch.names.get('greg')).toEqual({ name: 'Hillside Excavation', first: 'Greg', kind: 'trade' })
    expect(batch.names.get('kerr')).toEqual({ name: 'Kerr Electric', first: 'Kerr Electric', kind: 'trade' })
    expect(batch.names.get('priya')).toEqual({ name: 'Dr. Priya Raman', first: 'Dr. Raman', kind: 'customer' })
    expect(inputOf('kerr').first).toBe('Kerr Electric')
    expect(nudgeNamesOf({ name: '', goes_by: null, company: null })).toEqual({ name: 'No name yet', first: 'them' })
  })

  it('reads no Pipeline rows while no homeowner is on the flows, and hands the four flows', async () => {
    const batch = await loadNudgeBatch(NOW)
    expect(readPipelineRows).not.toHaveBeenCalled()
    expect(Object.keys(batch.flows).sort()).toEqual(['arch', 'customer', 'residential', 'trade'])
  })
})

// v2.6394: a homeowner's contact is kind customer, so the customer read answers with them; the card's customer_type puts
// them on the residential flow, with their Pipeline rows read once for everyone, as the morning run reads them.
describe('loadNudgeBatch, a homeowner among the customers', () => {
  const priya = ANSWERS.customer!
  beforeEach(() => {
    ANSWERS.customer = {
      ...priya,
      dana: { ...entry('customer', card('Dana Whitfield', null, { customer: 'cust-dana', type: 'residential' })), contact: { id: 'dana', kind: 'customer' }, userNames: { 'u-rosa': 'Rosa' } },
      evan: { ...entry('customer', card('Evan Ortiz', null, { customer: 'cust-evan', type: 'residential' })), contact: { id: 'evan', kind: 'customer' } },
    } as unknown as FlowRowsKindAnswer
  })
  afterEach(() => {
    ANSWERS.customer = priya
  })

  it('puts the homeowners on the residential flow, their steps from their own Pipeline rows, and reads those once', async () => {
    const batch = await loadNudgeBatch(NOW)
    expect(batch.people.map((p) => p.id)).toEqual(['priya', 'dana', 'evan', 'greg', 'kerr', 'jonah'])
    expect(readPipelineRows).toHaveBeenCalledTimes(1)
    expect(readPipelineRows).toHaveBeenCalledWith({ customerIds: ['cust-dana', 'cust-evan'], contactIds: ['dana', 'evan'] })
    expect(inputOf('dana').flow).toBe(SEED_FLOWS.residential)
    expect(inputOf('dana').rows.residential?.jobs.map((j) => j.id)).toEqual(['job-1312'])
    expect(inputOf('dana').rows.residential?.firstName).toBe('Dana')
    // Evan is the customer on none of the jobs read, so his rows hold no job: Dana's water heater is never his.
    expect(inputOf('evan').rows.residential?.jobs).toEqual([])
    expect(inputOf('dana').portal).toBeNull()
    expect(batch.names.get('dana')).toEqual({ name: 'Dana Whitfield', first: 'Dana', kind: 'residential' })
    // Dr. Raman's card names no customer type, so she is the GC customer she was.
    expect(inputOf('priya').flow).toBe(SEED_FLOWS.customer)
    expect(readBack).toHaveBeenCalledWith(['cust-priya'])
  })

  it('reads a homeowner’s lanes empty when the Pipeline read fails, and hides nobody', async () => {
    readPipelineRows.mockRejectedValueOnce(new Error('jobs_ledger is not there'))
    const batch = await loadNudgeBatch(NOW)
    expect(batch.people).toHaveLength(6)
    expect(inputOf('dana').rows.residential?.jobs).toEqual([])
  })
})
