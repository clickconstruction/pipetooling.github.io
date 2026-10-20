import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flowRows } from './editor'
import { SEED_FLOWS } from './seed'

/** What the select answers: set by each test. */
let reply: { data: unknown; error: unknown } | Error = { data: [], error: null }
const selects: { cols: string; eq: [string, string] }[] = []
vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      select: (cols: string) => ({
        eq: (col: string, v: string) => {
          selects.push({ cols, eq: [col, v] })
          return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply)
        },
      }),
    }),
  },
}))

const { clearFlowDefCache, loadFlowDef } = await import('./flowsIo')

describe('loadFlowDef', () => {
  beforeEach(() => {
    clearFlowDefCache()
    selects.length = 0
  })

  it('reads the office’s flow from its steps, joined to its kind', async () => {
    const edited = flowRows(SEED_FLOWS.trade).map((r) => (r.step_key === 'papers' ? { ...r, name: 'Papers back' } : r))
    reply = { data: edited, error: null }
    const flow = await loadFlowDef('trade')
    expect(flow.lanes[0]?.steps.find((s) => s.id === 'papers')?.name).toBe('Papers back')
    expect(selects[0]?.eq).toEqual(['flows.kind', 'trade'])
    expect(selects[0]?.cols).toContain('flows!inner(kind)')
  })

  it('keeps a kind’s flow once read, until the cache is cleared', async () => {
    reply = { data: flowRows(SEED_FLOWS.customer), error: null }
    await loadFlowDef('customer')
    await loadFlowDef('customer')
    expect(selects).toHaveLength(1)
    clearFlowDefCache('customer')
    await loadFlowDef('customer')
    expect(selects).toHaveLength(2)
  })

  it('reads the seed’s flow when none is kept, the read fails, or it throws, and keeps none of those', async () => {
    reply = { data: [], error: null }
    expect(await loadFlowDef('arch')).toBe(SEED_FLOWS.arch)
    reply = { data: null, error: { message: 'relation "flow_steps" does not exist' } }
    expect(await loadFlowDef('arch')).toBe(SEED_FLOWS.arch)
    reply = new Error('offline')
    expect(await loadFlowDef('arch')).toBe(SEED_FLOWS.arch)
    expect(selects).toHaveLength(3)
  })
})
