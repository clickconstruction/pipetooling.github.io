import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The read-back's one batch: both reads called once with the customers asked for (each id once), put together by
 * `customerPaperViews`, and a refusal surfacing in words rather than as an empty page that looks "never opened".
 */
const calls: Array<{ fn: string; args: unknown }> = []
let answer: (fn: string) => { data: unknown; error: { message: string; code?: string } | null } = () => ({ data: [], error: null })
vi.mock('../supabase', () => ({
  supabase: {
    rpc: (fn: string, args: unknown) => {
      calls.push({ fn, args })
      return Promise.resolve(answer(fn))
    },
  },
}))

const { loadCustomerPortalReadBack } = await import('./customerPortalViewsIo')

beforeEach(() => {
  calls.length = 0
  answer = () => ({ data: [], error: null })
})

describe('the read-back of customers’ pages', () => {
  it('asks both reads once for the customers named, and puts them together', async () => {
    answer = (fn) =>
      fn === 'customer_portal_views'
        ? { data: [{ customer_id: 'c1', paper_kind: null, paper_id: null, first_opened_at: '2026-09-20T13:00:00Z', last_opened_at: '2026-09-29T14:14:00Z', opens: 3 }], error: null }
        : {
            data: [
              { customer_id: 'c1', project_id: 'p1', job: 'Clinic', paper_kind: 'change_order', paper_id: 'co-2', number: 2, description: 'a sink', sent_on: '2026-09-30', answered: false, first_opened_at: null },
            ],
            error: null,
          }
    const back = await loadCustomerPortalReadBack(['c1', 'c2', 'c1'])
    expect(calls).toEqual([
      { fn: 'customer_portal_views', args: { p_customer_ids: ['c1', 'c2'] } },
      { fn: 'customer_portal_papers', args: { p_customer_ids: ['c1', 'c2'] } },
    ])
    expect(back.get('c1')).toMatchObject({ lastOpenedAt: '2026-09-29T14:14:00Z', opens: 3, papers: [{ kind: 'changeOrder', title: 'Change order 2', detail: 'a sink', viewedAt: null }] })
    expect(back.get('c2')).toEqual({ lastOpenedAt: null, opens: 0, papers: [] })
  })

  it('asks nothing for no customers', async () => {
    expect(await loadCustomerPortalReadBack([])).toEqual(new Map())
    expect(calls).toEqual([])
  })

  it('says why a read was refused, never an empty page', async () => {
    answer = (fn) => (fn === 'customer_portal_papers' ? { data: null, error: { message: 'function customer_portal_papers does not exist', code: 'P0001' } } : { data: [], error: null })
    await expect(loadCustomerPortalReadBack(['c1'])).rejects.toThrow(/customer_portal_papers does not exist/)
  })
})
