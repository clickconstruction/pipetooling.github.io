import { describe, expect, it } from 'vitest'
import { filingDocHtml } from '../jobsDocuments/lienFilingDocuments'
import { PAY_PAGE_ON_GC_COPY, PAY_PAGE_TITLE, payPageAppliesTo, payPageBlocks, payPageOwnerRule, payPageRows, payPageSummary, type PayPageRow } from './lienNoticePayPage'
import type { NoticeInvoiceDoc } from './noticeInvoiceEnclosure'
import type { PhysicalInvoiceDocument } from '../physicalInvoiceDocument'

const doc = (over: Partial<NoticeInvoiceDoc>): NoticeInvoiceDoc => ({
  invoiceId: 'inv-1',
  title: 'Invoice #273-1, May 5, 2026',
  doc: {} as PhysicalInvoiceDocument,
  stripeInvoiceId: 'in_1',
  openAmount: 13420,
  description: 'Install and finish plumbing fixture trim.',
  ...over,
})

const rows: PayPageRow[] = payPageRows([
  doc({}),
  doc({ invoiceId: 'inv-2', title: 'Invoice #273-2, June 12, 2026', openAmount: 665, description: 'Change Order: Moved the washing machine connections.' }),
  doc({ invoiceId: 'inv-3', title: 'Invoice #273-3, July 3, 2026', openAmount: 3500, stripeInvoiceId: null, description: '' }),
])
const assets = { 'inv-1': { svg: '<svg data-code="1"></svg>', png: 'data:image/png;base64,AAA' }, 'inv-2': { svg: '<svg data-code="2"></svg>', png: null } }
const base = {
  rows,
  assets,
  copyLabel: 'Owner of record',
  gcName: 'RMC-Dudley Mason',
  claimantName: 'Click Plumbing and Electrical',
  contactPerson: 'Malachi Whites, Master Plumber (#RMP41130)',
  phone: '(512) 360-0599',
  extras: { letterhead: { company: 'Click Plumbing and Electrical', licenseLine: '', contactLines: ['5501 Balcones Dr A141, Austin, TX 78731'] }, refItems: ['Job #273', 'Work months April, June, July and August 2026', 'September 22, 2026'] },
}

describe('the pay page — rows from the enclosed bills', () => {
  it('one row per unpaid bill: the label, the line, what is still owed, and whether it has a payment page', () => {
    expect(rows).toEqual([
      { invoiceId: 'inv-1', label: 'Invoice #273-1, May 5, 2026', description: 'Install and finish plumbing fixture trim.', openAmount: 13420, payable: true },
      { invoiceId: 'inv-2', label: 'Invoice #273-2, June 12, 2026', description: 'Change Order: Moved the washing machine connections.', openAmount: 665, payable: true },
      { invoiceId: 'inv-3', label: 'Invoice #273-3, July 3, 2026', description: '', openAmount: 3500, payable: false },
    ])
    expect(payPageSummary(rows)).toBe('3 bills · $17,585.00 still owed')
    expect(payPageSummary([rows[0]!])).toBe('1 bill · $13,420.00 still owed')
    expect(payPageSummary([])).toBe('')
  })
})

describe("the pay page — the owner's copy", () => {
  const blocks = payPageBlocks({ ...base, copy: 'owner' })

  it("opens with the letterhead and the notice's reference strip naming the copy, then the office's sentence", () => {
    expect(blocks[0]).toMatchObject({ kind: 'letterhead', company: 'Click Plumbing and Electrical' })
    expect(blocks[1]).toEqual({ kind: 'refstrip', items: ['Job #273', 'Work months April, June, July and August 2026', 'September 22, 2026', 'Copy for: Owner of record'] })
    expect(blocks[2]).toEqual({ kind: 'title', lines: [PAY_PAGE_TITLE] })
  })

  it("repeats the cover letter's rule in a box, so the page never contradicts the letter it follows", () => {
    const callout = blocks.find((b) => b.kind === 'callout')
    expect(callout).toEqual({ kind: 'callout', text: 'Please pay these only if RMC-Dudley Mason has told you in writing that you may pay Click Plumbing and Electrical directly. Otherwise hold the amount back from RMC-Dudley Mason, as the cover letter asks.' })
    expect(payPageOwnerRule('', 'Click')).toBe('')
  })

  it('a row per bill: the code and the address for a Stripe bill, a note instead for a paper one', () => {
    const payRows = blocks.filter((b) => b.kind === 'payRow')
    expect(payRows).toEqual([
      { kind: 'payRow', label: 'Invoice #273-1, May 5, 2026', description: 'Install and finish plumbing fixture trim.', amountLine: 'Still owed: $13,420.00', address: 'clicktooling.com/pay/inv-1', note: '', svg: '<svg data-code="1"></svg>', png: 'data:image/png;base64,AAA' },
      { kind: 'payRow', label: 'Invoice #273-2, June 12, 2026', description: 'Change Order: Moved the washing machine connections.', amountLine: 'Still owed: $665.00', address: 'clicktooling.com/pay/inv-2', note: '', svg: '<svg data-code="2"></svg>', png: null },
      { kind: 'payRow', label: 'Invoice #273-3, July 3, 2026', description: '', amountLine: 'Still owed: $3,500.00', address: '', note: 'No online payment page for this bill — pay by check to the address above.', svg: null, png: null },
    ])
  })

  it('closes with the count and the total, and who to call', () => {
    const paragraphs = blocks.filter((b) => b.kind === 'paragraph').map((b) => (b as { text: string }).text)
    expect(paragraphs[paragraphs.length - 2]).toBe('3 bills enclosed behind this page · $17,585.00 still owed on them.')
    expect(paragraphs[paragraphs.length - 1]).toBe("A code opens the bill in your phone's browser; nothing is installed. A bill already paid says so instead of asking again. Questions: Malachi Whites, Master Plumber (#RMP41130), (512) 360-0599.")
  })

  it('renders through the shared document renderer — the code inline, the paper bill with a dashed box', () => {
    const html = filingDocHtml(blocks)
    expect(html).toContain('<svg data-code="1"></svg>')
    expect(html.split('data-pay-row').length - 1).toBe(3)
    expect(html).toContain('border:1px dashed')
    expect(html).toContain('clicktooling.com/pay/inv-1')
    expect(html).toContain(PAY_PAGE_TITLE)
  })
})

describe("the pay page — the GC's copy and the empty cases", () => {
  it("is the owner's call: off by default, one line to turn on", () => {
    expect(PAY_PAGE_ON_GC_COPY).toBe(false)
    expect(payPageAppliesTo('owner')).toBe(true)
    expect(payPageAppliesTo('original_contractor')).toBe(PAY_PAGE_ON_GC_COPY)
    expect(payPageBlocks({ ...base, copy: 'original_contractor' })).toEqual([])
  })

  it('a job with no unpaid bill has no page; a page with no copy label keeps the strip as the notice has it', () => {
    expect(payPageBlocks({ ...base, copy: 'owner', rows: [] })).toEqual([])
    const blocks = payPageBlocks({ ...base, copy: 'owner', copyLabel: '' })
    expect(blocks[1]).toEqual({ kind: 'refstrip', items: ['Job #273', 'Work months April, June, July and August 2026', 'September 22, 2026'] })
  })
})
