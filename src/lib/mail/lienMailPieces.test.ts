import { describe, expect, it } from 'vitest'
import { filingMailLines, filingMailTail, mailPieceWords, mailPiecesByFiling, mailPiecesNeedingYou, type LienMailPieceRow } from './lienMailPieces'

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
      { id: 'p1', who: 'Owner of record', words: 'in transit, mailed 2026-10-13', tracking: '9407 1118', tone: 'muted' },
      { id: 'p2', who: 'Original contractor', words: 'returned to sender', tracking: '', tone: 'red' },
    ])
    expect(mailPiecesNeedingYou([base, { ...base, id: 'p2', status: 'notice_left' }, { ...base, id: 'p3', status: 'delivered' }]).map((p) => p.id)).toEqual(['p2'])
  })
})
