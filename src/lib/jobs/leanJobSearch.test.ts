import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildLeanJobNumberOr,
  buildLeanJobSearchOr,
  fetchLeanJobSearchIds,
  LEAN_DEVELOPMENT_MATCH_LIMIT,
  LEAN_JOB_SEARCH_LIMIT,
  sanitizeLeanSearchTerm,
} from './leanJobSearch'

describe('sanitizeLeanSearchTerm', () => {
  it('strips PostgREST breakers and squeezes whitespace', () => {
    expect(sanitizeLeanSearchTerm('  Franlow, (Water) "Heater" *  ')).toBe('Franlow Water Heater')
    expect(sanitizeLeanSearchTerm('plain')).toBe('plain')
  })
})

describe('buildLeanJobSearchOr', () => {
  it('covers the five flat columns with contains patterns', () => {
    const or = buildLeanJobSearchOr('tavin')
    expect(or).toBe(
      'hcp_number.ilike.*tavin*,click_number.ilike.*tavin*,job_name.ilike.*tavin*,job_address.ilike.*tavin*,customer_name.ilike.*tavin*',
    )
  })

  it('sanitized input cannot smuggle extra clauses', () => {
    const or = buildLeanJobSearchOr('a,status.eq.paid')
    expect(or.includes(',status.eq.paid')).toBe(false)
    expect(or).toContain('*a status.eq.paid*')
  })
})

describe('buildLeanJobNumberOr', () => {
  it('prefix-matches both number columns, digits only', () => {
    expect(buildLeanJobNumberOr(' 56x1 ')).toBe('hcp_number.ilike.561*,click_number.ilike.561*')
  })
})

/**
 * The server-side search behind the Pipeline box (v2.1825) covered the five flat
 * `jobs_ledger` columns only, so a development's name reached a job the board had
 * not loaded only when one of those columns also held it. The search now reads the
 * developments whose name matches and asks for their jobs in the same `or`.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => { data: unknown; error: unknown } = () => ({ data: [], error: null })
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') {
              return (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
                try {
                  resolve(route(table, steps))
                } catch (e) {
                  reject(e)
                }
              }
            }
            return (...a: unknown[]) => {
              steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
  },
}))

const stepArg = (steps: Step[], method: string, i = 0) => steps.find((s) => s.method === method)?.args[i]

describe('fetchLeanJobSearchIds by development name', () => {
  beforeEach(() => {
    queries.length = 0
    route = (table, steps) => {
      if (table === 'developments') {
        // The server's ilike is case-blind; the mock lowercases to say the same.
        const pattern = String(stepArg(steps, 'ilike', 1) ?? '').toLowerCase()
        return { data: pattern === '%sagemoor%' ? [{ id: 'dev-1' }] : [], error: null }
      }
      if (table === 'jobs_ledger') {
        const or = String(stepArg(steps, 'or', 0) ?? '')
        const hits: Array<{ id: string }> = []
        if (or.includes('job_name.ilike.*Lot 12*')) hits.push({ id: 'job-by-name' })
        if (or.includes('development_id.in.(dev-1)')) hits.push({ id: 'job-paid-house' })
        return { data: hits, error: null }
      }
      return { data: [], error: null }
    }
  })

  it("a development's name finds its jobs the board has not loaded", async () => {
    const res = await fetchLeanJobSearchIds('Sagemoor', 'cust-9')
    expect(res).toEqual({ ok: true, ids: ['job-paid-house'] })
    const devQ = queries.find((q) => q.table === 'developments')!
    expect(stepArg(devQ.steps, 'select', 0)).toBe('id')
    expect(stepArg(devQ.steps, 'ilike', 0)).toBe('name')
    expect(stepArg(devQ.steps, 'limit', 0)).toBe(LEAN_DEVELOPMENT_MATCH_LIMIT)
    const jobsQ = queries.find((q) => q.table === 'jobs_ledger')!
    // The flat columns still lead the same `or`; the development clause rides after them.
    expect(stepArg(jobsQ.steps, 'or', 0)).toBe(
      'hcp_number.ilike.*Sagemoor*,click_number.ilike.*Sagemoor*,job_name.ilike.*Sagemoor*,job_address.ilike.*Sagemoor*,customer_name.ilike.*Sagemoor*,development_id.in.(dev-1)',
    )
    // The customer filter and the row cap are as before.
    expect(stepArg(jobsQ.steps, 'eq', 0)).toBe('customer_id')
    expect(stepArg(jobsQ.steps, 'eq', 1)).toBe('cust-9')
    expect(stepArg(jobsQ.steps, 'limit', 0)).toBe(LEAN_JOB_SEARCH_LIMIT)
  })

  it('a term no development carries searches the flat columns alone', async () => {
    const res = await fetchLeanJobSearchIds('Lot 12', null)
    expect(res).toEqual({ ok: true, ids: ['job-by-name'] })
    const jobsQ = queries.find((q) => q.table === 'jobs_ledger')!
    expect(String(stepArg(jobsQ.steps, 'or', 0))).not.toContain('development_id')
    expect(jobsQ.steps.some((s) => s.method === 'eq')).toBe(false)
  })

  it('a refusal comes back with its reason and its kind, so the board can say why and offer no Retry', async () => {
    route = (table) =>
      table === 'jobs_ledger'
        ? { data: null, error: { message: 'permission denied for table jobs_ledger', code: '42501' } }
        : { data: [], error: null }
    const res = await fetchLeanJobSearchIds('Sagemoor', null)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.errorKind).toBe('server')
    expect(res.error.length).toBeGreaterThan(0)
  })

  it('one letter asks the server nothing, as before', async () => {
    expect(await fetchLeanJobSearchIds('s', null)).toEqual({ ok: true, ids: [] })
    expect(queries).toHaveLength(0)
  })
})

describe('buildLeanJobSearchOr with development ids', () => {
  it('adds one in-clause for the matched developments and drops an id that would break the or', () => {
    const or = buildLeanJobSearchOr('tavin', ['2a9f7b10-5b6e-4e1c-9d8a-1f2e3c4d5e6f', 'bad,id', 'dev-2'])
    expect(or.endsWith(',development_id.in.(2a9f7b10-5b6e-4e1c-9d8a-1f2e3c4d5e6f,dev-2)')).toBe(true)
    expect(buildLeanJobSearchOr('tavin', [])).toBe(buildLeanJobSearchOr('tavin'))
    expect(buildLeanJobSearchOr('tavin')).not.toContain('development_id')
  })
})
