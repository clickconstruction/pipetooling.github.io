import { describe, expect, it } from 'vitest'
import { PORTAL_WAIVER_GROUP_WORDS, portalWaiverNote, portalWaiverPaperRows } from './portalWaiverPapers'
import type { PortalWaiverHalf, PortalWaiverRow } from './portalPayload'

const none: PortalWaiverHalf = { state: 'none', ymd: null, pdfUrl: null, formType: null, signerName: null }
const half = (over: Partial<PortalWaiverHalf>): PortalWaiverHalf => ({ state: 'signed', ymd: '2026-09-29', pdfUrl: 'https://x.test/c.pdf', formType: 'conditional_progress', signerName: 'Malachi Whites', ...over })
const row = (over: Partial<PortalWaiverRow>): PortalWaiverRow => ({
  audience: 'payer',
  jobId: 'j',
  jobLabel: '1002 · Cedar Bend',
  jobAddress: '2530 Hunter Rd, San Marcos, TX 78666',
  invoiceId: 'b2',
  billLabel: 'Bill 2 of 3',
  amount: 18200,
  billedYmd: '2026-09-28',
  paid: false,
  final: false,
  conditional: half({}),
  unconditional: none,
  ...over,
})
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

describe('portalWaiverNote (v2.4304)', () => {
  it('the bill’s note names its furthest signed waiver and links the PDF', () => {
    expect(portalWaiverNote([row({})], 'b2')).toEqual({ words: 'conditional, signed Sep 29', href: 'https://x.test/c.pdf' })
    expect(portalWaiverNote([row({ final: true, conditional: half({ state: 'sent', ymd: '2026-08-22', formType: 'conditional_final' }) })], 'b2')!.words).toBe('conditional final, sent Aug 22')
    const paid = row({ paid: true, unconditional: half({ state: 'sent', ymd: '2026-10-04', formType: 'unconditional_progress', pdfUrl: 'https://x.test/u.pdf' }) })
    expect(portalWaiverNote([paid], 'b2')).toEqual({ words: 'unconditional, sent Oct 4', href: 'https://x.test/u.pdf' })
  })
  it('no bill id, another bill, or nothing signed: no note', () => {
    expect(portalWaiverNote([row({})], null)).toBeNull()
    expect(portalWaiverNote([row({})], 'b9')).toBeNull()
    expect(portalWaiverNote([row({ conditional: none })], 'b2')).toBeNull()
  })
  it('an old function with no form says what the bill implies', () => {
    expect(portalWaiverNote([row({ final: true, conditional: half({ formType: null }) })], 'b2')!.words).toBe('conditional final, signed Sep 29')
  })
})

describe('portalWaiverPaperRows (v2.4304)', () => {
  it('one row per signed waiver, newest first; a conditional reads SIGNED, an unconditional PAID IN FULL', () => {
    const rows = portalWaiverPaperRows(
      [
        row({}),
        row({ invoiceId: 'b1', billLabel: 'Bill 1 of 3', amount: 14050, paid: true, conditional: half({ state: 'sent', ymd: '2026-09-02' }), unconditional: half({ state: 'sent', ymd: '2026-09-18', formType: 'unconditional_progress', signerName: null }) }),
      ],
      usd,
    )
    expect(rows.map((r) => [r.key, r.status, r.ymd, r.line])).toEqual([
      ['b2:conditional', 'SIGNED', '2026-09-29', 'Conditional progress · Bill 2 of 3 · $18,200.00 · signed by Malachi Whites'],
      ['b1:unconditional', 'PAID IN FULL', '2026-09-18', 'Unconditional progress · Bill 1 of 3 · $14,050.00'],
      ['b1:conditional', 'SIGNED', '2026-09-02', 'Conditional progress · Bill 1 of 3 · $14,050.00 · signed by Malachi Whites'],
    ])
  })
  it('the group words keep the plain-words marks out', () => {
    for (const w of Object.values(PORTAL_WAIVER_GROUP_WORDS)) expect(w.lead).not.toMatch(/[—–;()]/)
  })
})
