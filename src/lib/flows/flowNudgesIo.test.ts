/**
 * Follow up's Nudges from the flow, its batch read (`loadNudgeBatch`) over a stubbed database: each kind's people
 * from `flow_rows_kind`, each person handed only their own holds, reminders, notes, lines and owed rows, a customer's
 * page read back and nobody else's, and a read that fails giving an empty list rather than hiding everyone. The names
 * follow the boards' rule: a person's first name, else the company. Nothing here is a real row.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FlowRowsKindAnswer } from './boardRead'
import type { PersonInputs } from './person'
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

const card = (name: string, company: string | null, ids: { customer?: string; gc?: string } = {}) => ({
  name,
  goes_by: null,
  company,
  trades: [],
  gc_company_id: ids.gc ?? null,
  customer_id: ids.customer ?? null,
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
})
