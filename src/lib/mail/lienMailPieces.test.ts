import { describe, expect, it } from 'vitest'
import { filingMailCostWords, filingMailLines, filingMailTail, jobsWithMailPieces, mailCostDollars, mailNeedsYouRows, mailPieceWords, mailPiecesByFiling, mailPiecesNeedingYou, type LienMailPieceRow } from './lienMailPieces'

const base: LienMailPieceRow = { id: 'p1', kind: 'lien_notice_53_056', recipient: 'owner', status: 'in_transit', usps_tracking: '9407 1118', mailed_at: '2026-10-14T00:30:00Z', delivered_at: null, signed_by: null, delivery_status: 'In Transit', source_ids: ['f1'] }
const fmt = (d: string) => d

describe('the desk reads the mail pieces behind a sent notice (the Docsmit train, 6b)', () => {
  it('keys the pieces by the filings inside them', () => {
    const by = mailPiecesByFiling([base, { ...base, id: 'p2', recipient: 'original_contractor', source_ids: ['f1', 'f2'] }])
    expect(Object.keys(by).sort()).toEqual(['f1', 'f2'])
    expect(by.f1!.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(by.f2!.map((p) => p.id)).toEqual(['p2'])
  })

  it('words each state, with Central days', () => {
    expect(mailPieceWords(base, fmt)).toBe('in transit, mailed 2026-10-13')
    expect(mailPieceWords({ ...base, status: 'delivered', delivered_at: '2026-10-16T17:02:00Z', signed_by: 'R SMITH' }, fmt)).toBe('delivered 2026-10-16, signed R SMITH')
    expect(mailPieceWords({ ...base, status: 'returned' }, fmt)).toBe('returned to sender')
    expect(mailPieceWords({ ...base, status: 'notice_left' }, fmt)).toBe('notice left, unclaimed so far')
    expect(mailPieceWords({ ...base, status: 'mailed' }, fmt)).toBe('mailed 2026-10-13')
    expect(mailPieceWords({ ...base, status: 'sent', mailed_at: null }, fmt)).toBe('with Docsmit, not yet accepted by USPS')
    expect(mailPieceWords({ ...base, status: 'failed', problem: 'credit short' }, fmt)).toBe('Docsmit refused it: credit short')
    expect(mailPieceWords({ ...base, status: 'unknown', delivery_status: 'Something new' }, fmt)).toBe('USPS says "Something new"')
  })

  it('the Sent row’s tail says one state when the pieces agree, else each recipient’s; nothing with no pieces', () => {
    expect(filingMailTail([], fmt)).toBe('')
    expect(filingMailTail([base, { ...base, id: 'p2', recipient: 'original_contractor' }], fmt)).toBe(' · mailed through Docsmit · in transit, mailed 2026-10-13')
    expect(filingMailTail([base, { ...base, id: 'p2', recipient: 'original_contractor', status: 'delivered', delivered_at: '2026-10-16T17:02:00Z' }], fmt)).toBe(' · mailed through Docsmit · owner of record in transit, mailed 2026-10-13; original contractor delivered 2026-10-16')
  })

  it('the footer’s lines carry the recipient, the words, the number and a tone; the ones needing a person are picked out', () => {
    const lines = filingMailLines([base, { ...base, id: 'p2', recipient: 'original_contractor', status: 'returned', usps_tracking: null }], fmt)
    expect(lines).toEqual([
      { id: 'p1', who: 'Owner of record', words: 'in transit, mailed 2026-10-13', tracking: '9407 1118', cost: '', tone: 'muted' },
      { id: 'p2', who: 'Original contractor', words: 'returned to sender', tracking: '', cost: '', tone: 'red' },
    ])
    expect(mailPiecesNeedingYou([base, { ...base, id: 'p2', status: 'notice_left' }, { ...base, id: 'p3', status: 'delivered' }]).map((p) => p.id)).toEqual(['p2'])
  })

  it('the cost: a line carries the charge once the poll read it, and the footer sums the pieces read, naming the ones not read yet (6b, the cost line)', () => {
    expect(mailCostDollars(9.85)).toBe('$9.85')
    expect(mailCostDollars(null)).toBe('')
    expect(filingMailLines([{ ...base, price: 9.85 }], fmt)[0]!.cost).toBe('$9.85')
    expect(filingMailCostWords([base, { ...base, id: 'p2' }])).toBe('')
    expect(filingMailCostWords([{ ...base, price: 9.85 }, { ...base, id: 'p2', recipient: 'original_contractor', price: 2.49 }])).toBe('Docsmit cost $12.34')
    expect(filingMailCostWords([{ ...base, price: 9.85 }, { ...base, id: 'p2', recipient: 'original_contractor' }])).toBe('Docsmit cost $9.85 · 1 not read yet')
  })

  it('the Do now rows for the envelopes that want a person, keyed to their jobs, each piece once; and the jobs the Deliveries filter keeps (6b-2)', () => {
    const by = { f1: [base, { ...base, id: 'p2', recipient: 'original_contractor', status: 'returned' as const }], f2: [{ ...base, id: 'p2', recipient: 'original_contractor', status: 'returned' as const }, { ...base, id: 'p3', status: 'notice_left' as const }] }
    expect(mailNeedsYouRows({ j1: [{ id: 'f1' }, { id: 'f2' }], j2: [{ id: 'f9' }] }, by, fmt)).toEqual([
      { jobId: 'j1', pieceId: 'p2', who: 'Original contractor', words: 'returned to sender' },
      { jobId: 'j1', pieceId: 'p3', who: 'Owner of record', words: 'notice left, unclaimed so far' },
    ])
    expect(mailNeedsYouRows({}, by)).toEqual([])
    const jobs = jobsWithMailPieces([{ jobId: 'j1', item: { sent_filing_id: 'f1' } }, { jobId: 'j2', item: { sent_filing_id: 'f9' } }, { jobId: 'j3', item: null }], by)
    expect([...jobs]).toEqual(['j1'])
  })
})
