import { describe, expect, it } from 'vitest'
import { makeFakeRowCapSupabase } from '../../../test/fakeRowCapSupabase'
import { SUPABASE_IN_CHUNK_SIZE } from '../../supabasePaging'
import { supabasePaperIo } from './paperIo'

/** `bills` papers, one per bill, each with `linesEach` lines. Made-up ids throughout. */
function tables(bills: number, linesEach: number) {
  const supply_papers = Array.from({ length: bills }, (_, b) => ({
    id: `paper-${b}`,
    invoice_id: `bill-${b}`,
    kind: 'invoice',
    number: `N-${b}`,
    check_state: 'adds_up',
    check_note: '',
  }))
  const supply_paper_lines = supply_papers.flatMap((p) =>
    Array.from({ length: linesEach }, (_, i) => ({
      paper_id: p.id,
      line_no: i + 1,
      line_kind: 'part',
      description: `Made-up part ${i + 1}`,
      extended_cents: 100,
    })),
  )
  return { supply_papers, supply_paper_lines }
}

const billIds = (count: number) => Array.from({ length: count }, (_, b) => `bill-${b}`)

describe('supabasePaperIo.loadForInvoices', () => {
  it('reads every line of every bill when the lines pass 1,000 rows', async () => {
    // 30 bills of 50 lines: 1,500 lines, so the last ten bills sit past the cap of a read with no range.
    const { client, calls } = makeFakeRowCapSupabase(tables(30, 50))
    const papers = await supabasePaperIo(client).loadForInvoices(billIds(30))
    expect(papers.size).toBe(30)
    for (const id of billIds(30)) expect(papers.get(id)?.lines).toHaveLength(50)
    expect(papers.get('bill-29')?.lines[49]?.lineNo).toBe(50)
    const lineReads = calls.filter((c) => c.table === 'supply_paper_lines')
    expect(lineReads.map((c) => c.range)).toEqual([[0, 999], [1000, 1999]])
  })

  it('pages each read in a stable order, on a fresh query per page', async () => {
    const { client, calls } = makeFakeRowCapSupabase(tables(30, 50))
    await supabasePaperIo(client).loadForInvoices(billIds(30))
    for (const c of calls) expect(c.range).not.toBeNull()
    expect(calls.filter((c) => c.table === 'supply_papers').map((c) => c.order)).toEqual([['id']])
    for (const c of calls.filter((x) => x.table === 'supply_paper_lines')) expect(c.order).toEqual(['paper_id', 'line_no'])
  })

  it('sends a house of many bills in chunks of ids, never one long list', async () => {
    const count = SUPABASE_IN_CHUNK_SIZE * 2 + 20
    const { client, calls } = makeFakeRowCapSupabase(tables(count, 4))
    const papers = await supabasePaperIo(client).loadForInvoices(billIds(count))
    expect(papers.size).toBe(count)
    expect(papers.get(`bill-${count - 1}`)?.lines).toHaveLength(4)
    for (const c of calls) expect(c.in?.[1].length).toBeLessThanOrEqual(SUPABASE_IN_CHUNK_SIZE)
    expect(calls.filter((c) => c.table === 'supply_papers').map((c) => c.in?.[0])).toEqual(['invoice_id', 'invoice_id', 'invoice_id'])
    // 320 papers of 4 lines: three chunks, the first two of 600 lines each and the last of 80, one page each.
    expect(calls.filter((c) => c.table === 'supply_paper_lines').map((c) => c.in?.[0])).toEqual(['paper_id', 'paper_id', 'paper_id'])
  })

  it('keeps a bill with no paper out of the map, and a paper with no lines in it', async () => {
    const t = tables(2, 3)
    t.supply_paper_lines = t.supply_paper_lines.filter((l) => l.paper_id !== 'paper-1')
    const { client } = makeFakeRowCapSupabase(t)
    const papers = await supabasePaperIo(client).loadForInvoices(['bill-0', 'bill-1', 'bill-none'])
    expect([...papers.keys()].sort()).toEqual(['bill-0', 'bill-1'])
    expect(papers.get('bill-0')?.lines.map((l) => l.lineNo)).toEqual([1, 2, 3])
    expect(papers.get('bill-1')?.lines).toEqual([])
  })

  it('asks nothing for no bills, and nothing of the lines when no bill has a paper', async () => {
    const none = makeFakeRowCapSupabase(tables(2, 3))
    expect((await supabasePaperIo(none.client).loadForInvoices([])).size).toBe(0)
    expect(none.calls).toHaveLength(0)
    const strangers = makeFakeRowCapSupabase(tables(2, 3))
    expect((await supabasePaperIo(strangers.client).loadForInvoices(['bill-none'])).size).toBe(0)
    expect(strangers.calls.map((c) => c.table)).toEqual(['supply_papers'])
  })

  it('answers the empty map when the papers read fails', async () => {
    const { client } = makeFakeRowCapSupabase(tables(3, 3), { failOnCall: 1 })
    expect((await supabasePaperIo(client).loadForInvoices(billIds(3))).size).toBe(0)
  })

  it('answers the empty map when a page of lines fails, never a paper with some of its lines', async () => {
    // Call 1 reads the papers, call 2 the first page of lines, call 3 the second page.
    const { client, calls } = makeFakeRowCapSupabase(tables(30, 50), { failOnCall: 3 })
    const papers = await supabasePaperIo(client).loadForInvoices(billIds(30))
    expect(calls).toHaveLength(3)
    expect(papers.size).toBe(0)
  })
})
