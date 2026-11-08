import { describe, expect, it } from 'vitest'
import {
  CLAIM_TYPED_EMPTY_WORDS,
  claimAmountOf,
  claimEvidenceWords,
  claimLineDraftOf,
  claimLineDraftProblem,
  claimLineKindWords,
  claimLinesFromRows,
  claimTable,
  claimTotalWords,
  claimTyped,
  emptyClaimLineDraft,
  type LegalClaimLineLike,
  type LegalClaimLineRow,
} from './legalClaimLines'
import { plainWordsFailures } from '../plainWords'

const row = (id: string, over: Partial<LegalClaimLineRow> = {}): LegalClaimLineRow => ({ id, kind: 'materials', title: 'Materials left on site', amount: '5310.00', basis: 'contract ¶ 9 · counted on walk-off', document_id: 'd1', added_at: '2026-10-26T15:00:00Z', document: { title: 'Materials on site — count.pdf' }, ...over })
const line = (id: string, amount: number, over: Partial<LegalClaimLineLike> = {}): LegalClaimLineLike => ({ id, kind: 'damages', title: 'Demobilization damages', amount, basis: 'contract ¶ 14', documentId: null, documentTitle: '', ...over })
const labelOf = (jobId: string) => ({ j1: 'C1412', j2: 'C1419' })[jobId] ?? jobId

describe('claim lines from rows (punch list #171, v2.6679)', () => {
  it('reads the rows in the order added, the amount as a number, the document title resolved, an unknown kind as other', () => {
    const lines = claimLinesFromRows([row('b', { added_at: '2026-10-27T00:00:00Z', kind: 'fees', document: [{ title: 'Fee letter' }] }), row('a'), row('c', { kind: 'bogus', document_id: null, document: null, amount: 12.345, added_at: '2026-10-28T00:00:00Z' })])
    expect(lines.map((l) => l.id)).toEqual(['a', 'b', 'c'])
    expect(lines[0]).toEqual({ id: 'a', kind: 'materials', title: 'Materials left on site', amount: 5310, basis: 'contract ¶ 9 · counted on walk-off', documentId: 'd1', documentTitle: 'Materials on site — count.pdf' })
    expect(lines[1]).toMatchObject({ kind: 'fees', documentTitle: 'Fee letter' })
    expect(lines[2]).toMatchObject({ kind: 'other', amount: 12.35, documentId: null, documentTitle: '' })
  })
  it('adds the typed lines up, never a line below zero', () => {
    expect(claimTyped([line('a', 5310), line('b', 2800), line('c', -4)])).toBe(8110)
    expect(claimTyped([])).toBe(0)
  })
  it('words every kind', () => {
    expect(['materials', 'damages', 'interest', 'fees', 'other'].map((k) => claimLineKindWords(k as never))).toEqual(['Materials left on site', 'Damages', 'Interest', 'Attorney fees', 'Other'])
  })
})

describe('the Add form', () => {
  it('reads dollars with or without the sign and the commas, and refuses words', () => {
    expect(claimAmountOf('$5,310.00')).toBe(5310)
    expect(claimAmountOf('1074.5')).toBe(1074.5)
    expect(claimAmountOf(' 2800 ')).toBe(2800)
    expect(claimAmountOf('five')).toBeNull()
    expect(claimAmountOf('1.234')).toBeNull()
    expect(claimAmountOf('')).toBeNull()
  })
  it('names the one thing wrong, in the RPC’s order', () => {
    const ok = { kind: 'materials' as const, title: 'Materials left on site', amount: '5310', basis: 'contract ¶ 9', documentId: null }
    expect(claimLineDraftProblem(ok)).toBeNull()
    expect(claimLineDraftProblem({ ...ok, kind: 'rent' as never })).toBe('Pick what part of the claim this is.')
    expect(claimLineDraftProblem({ ...ok, title: '  ' })).toBe('Name the line.')
    expect(claimLineDraftProblem({ ...ok, title: 'x'.repeat(121) })).toBe('Keep the name under 120 characters.')
    expect(claimLineDraftProblem({ ...ok, amount: 'lots' })).toBe('Type the amount in dollars.')
    expect(claimLineDraftProblem({ ...ok, amount: '0' })).toBe('The amount must be more than zero.')
    expect(claimLineDraftProblem({ ...ok, basis: 'b'.repeat(301) })).toBe('Keep the basis under 300 characters.')
  })
  it('starts a new line named by its kind, other blank, and puts a line back into the form', () => {
    expect(emptyClaimLineDraft()).toEqual({ kind: 'materials', title: 'Materials left on site', amount: '', basis: '', documentId: null })
    expect(emptyClaimLineDraft('other').title).toBe('')
    expect(claimLineDraftOf(line('a', 2800, { documentId: 'd2' }))).toEqual({ kind: 'damages', title: 'Demobilization damages', amount: '2800.00', basis: 'contract ¶ 14', documentId: 'd2' })
  })
})

describe('the claim table', () => {
  it('draws the bills row, the retainage row when a job holds some, the typed rows, and the total', () => {
    const t = claimTable({ balance: 14980, retainageHeldByJob: { j1: 6420 }, retainageAdded: 6420, retainageOnBills: 0, openBills: [{ jobLabel: 'C1412' }, { jobLabel: 'C1419' }], claimLines: [line('a', 5310, { kind: 'materials', title: 'Materials left on site', basis: 'contract ¶ 9', documentId: 'd1', documentTitle: 'Materials on site — count.pdf' }), line('b', 2800)] }, labelOf)
    expect(t.rows.map((r) => [r.source, r.part, r.basis, claimEvidenceWords(r.evidence), r.amount])).toEqual([
      ['bills', 'Open bills', '2 billed lines, from AR', 'the ledger below', 14980],
      ['retainage', 'Retainage held', 'C1412 · Our contract on this job', 'the job record', 6420],
      ['typed', 'Materials left on site', 'contract ¶ 9', 'Materials on site — count.pdf', 5310],
      ['typed', 'Demobilization damages', 'contract ¶ 14', '—', 2800],
    ])
    expect(t.typed).toBe(8110)
    expect(t.total).toBe(29510)
    expect(t.note).toBe('')
    expect(claimTotalWords(t)).toBe('The claim')
  })
  it('with nothing held and nothing typed, one row and the bills alone', () => {
    const t = claimTable({ balance: 2028.04, retainageHeldByJob: {}, retainageAdded: 0, retainageOnBills: 0, openBills: [{ jobLabel: '891' }], claimLines: [] }, labelOf)
    expect(t.rows).toHaveLength(1)
    expect(t.rows[0]).toMatchObject({ basis: 'one billed line, from AR', amount: 2028.04 })
    expect(t.total).toBe(2028.04)
    expect(claimTotalWords(t)).toBe('The claim, the open bills alone')
    expect(plainWordsFailures(CLAIM_TYPED_EMPTY_WORDS)).toEqual([])
  })
  it('says where the retainage sits when a bill already carries it (v2.6103)', () => {
    const part = claimTable({ balance: 2028.04, retainageHeldByJob: { j1: 1678.04 }, retainageAdded: 678.04, retainageOnBills: 1000, openBills: [{ jobLabel: '891' }], claimLines: [] }, labelOf)
    expect(part.rows[1]).toMatchObject({ source: 'retainage', amount: 678.04 })
    expect(part.note).toBe('Another $1,000.00 of the retainage held is already on a bill, inside the open bills.')
    expect(part.total).toBe(2706.08)
    const all = claimTable({ balance: 1509.8, retainageHeldByJob: { j1: 1509.8, j2: 0 }, retainageAdded: 0, retainageOnBills: 1509.8, openBills: [{ jobLabel: '891' }], claimLines: [] }, labelOf)
    expect(all.rows[1]).toMatchObject({ source: 'retainage', amount: 0, basis: 'C1412 · Our contract on this job' })
    expect(all.note).toBe('The retainage held $1,509.80 is already inside the open bills, so the row adds nothing.')
    expect(claimTotalWords(all)).toBe('The claim, the open bills alone')
    for (const words of [part.note, all.note]) expect(plainWordsFailures(words)).toEqual([])
  })
  it('a line with no open bill still draws the bills row at zero', () => {
    const t = claimTable({ balance: 0, retainageHeldByJob: {}, retainageAdded: 0, retainageOnBills: 0, openBills: [], claimLines: [line('a', 500)] }, labelOf)
    expect(t.rows[0]).toMatchObject({ source: 'bills', basis: 'nothing open on the ledger', amount: 0 })
    expect(t.total).toBe(500)
  })
})
