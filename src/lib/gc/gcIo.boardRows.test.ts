/**
 * The board's reads that take no job's ids (the Board's B2b-ii-b and the papers' switch): the companies' papers come from
 * `gc_company_paper_states` (v2.5179), never from `person_contract_documents` itself, and every one of these reads pages
 * past PostgREST's 1,000-row cap. The client is a stub: each table read answers no rows, the papers' function its rows a
 * page at a time.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompanyPaperRow } from './companyPapers'

type Range = [number, number]
const seen = vi.hoisted(() => ({
  tables: [] as { table: string; range: [number, number] | null }[],
  rpcs: [] as { fn: string; args: unknown; range: [number, number] | null }[],
  papers: [] as unknown[],
}))

vi.mock('../supabase', () => {
  // A query that records its range and answers `rows()` cut to it.
  const query = (call: { range: Range | null }, rows: () => unknown[]) => {
    const q: Record<string | symbol, unknown> = new Proxy(
      {},
      {
        get: (_t, key) => {
          if (key === 'range')
            return (from: number, to: number) => {
              call.range = [from, to]
              return q
            }
          if (key === 'then')
            return (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
              Promise.resolve({ data: call.range ? rows().slice(call.range[0], call.range[1] + 1) : rows(), error: null }).then(ok, bad)
          return () => q
        },
      },
    )
    return q
  }
  return {
    supabase: {
      from: (table: string) => {
        const call = { table, range: null as Range | null }
        seen.tables.push(call)
        return query(call, () => [])
      },
      rpc: (fn: string, args: unknown) => {
        const call = { fn, args, range: null as Range | null }
        seen.rpcs.push(call)
        return query(call, () => (fn === 'gc_company_paper_states' ? seen.papers : []))
      },
    },
  }
})

import { loadGcBoardRows } from './gcIo'

const paper = (n: number): CompanyPaperRow => ({
  id: `d${n}`,
  company_id: `c${n % 7}`,
  doc_type: (['agreement', 'w9', 'coi'] as const)[n % 3]!,
  status: 'signed',
  sent_at: null,
  signed_at: '2026-09-01',
  expires_at: '2027-09-01',
  created_at: `2026-09-01T00:00:${String(n % 60).padStart(2, '0')}Z`,
})

beforeEach(() => {
  seen.tables.length = 0
  seen.rpcs.length = 0
  seen.papers = []
})

describe('the board’s reads on no job’s ids', () => {
  it('reads the companies’ papers through gc_company_paper_states, for every company, never the table', async () => {
    seen.papers = [paper(1), paper(2)]
    const rows = await loadGcBoardRows([], '2026-10-10')
    expect(rows.papers).toEqual(seen.papers)
    expect(seen.rpcs.filter((c) => c.fn === 'gc_company_paper_states').map((c) => c.args)).toEqual([{}])
    expect(seen.tables.map((t) => t.table)).not.toContain('person_contract_documents')
  })

  it('pages the papers past the 1,000-row cap', async () => {
    seen.papers = Array.from({ length: 1001 }, (_, n) => paper(n))
    const rows = await loadGcBoardRows([], '2026-10-10')
    expect(rows.papers).toHaveLength(1001)
    expect(seen.rpcs.filter((c) => c.fn === 'gc_company_paper_states').map((c) => c.range)).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  it('pages the companies, the promises, the papers sent and the call log', async () => {
    await loadGcBoardRows([], '2026-10-10')
    for (const table of ['gc_companies', 'gc_trade_promises', 'gc_paper_sends', 'gc_company_contacts']) {
      expect(seen.tables.find((t) => t.table === table)?.range, table).toEqual([0, 999])
    }
  })
})
