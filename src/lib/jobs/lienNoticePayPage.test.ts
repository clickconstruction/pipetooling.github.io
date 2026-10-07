import { describe, expect, it } from 'vitest'
import { filingDocHtml } from '../jobsDocuments/lienFilingDocuments'
import { PAY_PAGE_ON_GC_COPY, PAY_PAGE_TITLE, applyPayLines, changedPayLines, payLineField, payLineInvoiceId, payPageAppliesTo, payPageBlocks, payPageOwnerRule, payPageRows, payPageSummary, type PayPageRow } from './lienNoticePayPage'
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
      { kind: 'payRow', field: 'payLine:inv-1', label: 'Invoice #273-1, May 5, 2026', description: 'Install and finish plumbing fixture trim.', amountLine: 'Still owed: $13,420.00', address: 'clicktooling.com/pay/inv-1', note: '', svg: '<svg data-code="1"></svg>', png: 'data:image/png;base64,AAA' },
      { kind: 'payRow', field: 'payLine:inv-2', label: 'Invoice #273-2, June 12, 2026', description: 'Change Order: Moved the washing machine connections.', amountLine: 'Still owed: $665.00', address: 'clicktooling.com/pay/inv-2', note: '', svg: '<svg data-code="2"></svg>', png: null },
      { kind: 'payRow', field: 'payLine:inv-3', label: 'Invoice #273-3, July 3, 2026', description: '', amountLine: 'Still owed: $3,500.00', address: '', note: 'No online payment page for this bill — pay by check to the address above.', svg: null, png: null },
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

  it('a job with no unpaid bill, or with paper bills only, has no page; a page with no copy label keeps the strip as the notice has it', () => {
    expect(payPageBlocks({ ...base, copy: 'owner', rows: [] })).toEqual([])
    expect(payPageBlocks({ ...base, copy: 'owner', rows: [rows[2]!] })).toEqual([])
    const blocks = payPageBlocks({ ...base, copy: 'owner', copyLabel: '' })
    expect(blocks[1]).toEqual({ kind: 'refstrip', items: ['Job #273', 'Work months April, June, July and August 2026', 'September 22, 2026'] })
  })
})

describe('the pay page — the pay offer (v2.4713)', () => {
  const offer = { pct: 10, by: '2026-11-15' }
  it('puts the boxed sentence under the title, both amounts on every Stripe row, the payer on the rule line and the lower total at the end', () => {
    const blocks = payPageBlocks({ ...base, copy: 'owner', offer })
    const title = blocks.findIndex((b) => b.kind === 'title')
    expect(blocks[title + 1]).toEqual({ kind: 'callout', text: 'Pay any of these bills in full by November 15, 2026 and it is 10% less. The lower amount is on the page the code opens. Pay all of them and no lien is filed.' })
    const rule = blocks.filter((b) => b.kind === 'callout')[1]
    expect(rule && rule.kind === 'callout' ? rule.text : '').toMatch(/Whoever pays, you or RMC-Dudley Mason, gets the same amount off\.$/)
    const rows = blocks.filter((b): b is Extract<typeof b, { kind: 'payRow' }> => b.kind === 'payRow')
    expect(rows.map((r) => r.amountLine)).toEqual(['Still owed: $13,420.00 · $12,078.00 if paid in full by November 15', 'Still owed: $665.00 · $598.50 if paid in full by November 15', 'Still owed: $3,500.00'])
    const close = blocks.filter((b) => b.kind === 'paragraph').slice(-2)[0]
    expect(close && close.kind === 'paragraph' ? close.text : '').toBe('3 bills enclosed behind this page · $17,585.00 still owed on them · $12,676.50 if both are paid in full by November 15.')
  })
  it('with no offer the page reads exactly as before', () => {
    expect(payPageBlocks({ ...base, copy: 'owner', offer: null })).toEqual(payPageBlocks({ ...base, copy: 'owner' }))
    expect(payPageBlocks({ ...base, copy: 'owner' }).filter((b) => b.kind === 'callout')).toHaveLength(1)
  })
})

describe('the pay page lines the office types (v2.4724)', () => {
  const rows: PayPageRow[] = [
    { invoiceId: 'a', label: 'Invoice #273, March 16, 2026', description: '', openAmount: 13_420, payable: true },
    { invoiceId: 'b', label: 'Invoice #2, August 21, 2026', description: 'CHANGE ORDER: Added gas to fire features at pool', openAmount: 3_500, payable: true },
  ]
  it('puts a typed line in place of the bill’s, ignores bills no longer enclosed, and counts only real changes', () => {
    const lines = { a: '  Plumbing for the Lennox house  ', b: 'CHANGE ORDER: Added gas to fire features at pool', gone: 'x' }
    expect(applyPayLines(rows, lines).map((r) => r.description)).toEqual(['Plumbing for the Lennox house', 'CHANGE ORDER: Added gas to fire features at pool'])
    expect(changedPayLines(rows, lines)).toEqual({ a: 'Plumbing for the Lennox house' })
    expect(changedPayLines(rows, { b: '' })).toEqual({ b: '' })
    expect(applyPayLines(rows, null)).toEqual(rows)
    expect(payLineInvoiceId(payLineField('a'))).toBe('a')
    expect(payLineInvoiceId('claimAmount')).toBeNull()
  })
  it('prints the typed line plain on paper, and as a box with its note on the desk', () => {
    const blocks = payPageBlocks({ rows, assets: {}, copy: 'owner', copyLabel: '', gcName: 'RMC- Dudley Mason', claimantName: 'Click Plumbing and Electrical', contactPerson: '', phone: '', extras: {}, lines: { a: 'Plumbing for the Lennox house' } })
    const printed = filingDocHtml(blocks)
    expect(printed).toContain('Plumbing for the Lennox house')
    expect(printed).not.toContain('data-field')
    const desk = filingDocHtml(blocks, { marks: { [payLineField('a')]: { kind: 'typed', changed: true }, [payLineField('b')]: { kind: 'typed' } } })
    expect(desk).toContain('data-field="payLine:a"')
    expect(desk).toContain('changed on this page only · the bill keeps its own line')
    expect(desk).toContain('data-reset="payLine:a"')
    const locked = filingDocHtml(blocks, { marks: { [payLineField('a')]: { kind: 'locked', changed: true } } })
    expect(locked).not.toContain('data-reset')
    const empty = filingDocHtml(payPageBlocks({ rows, assets: {}, copy: 'owner', copyLabel: '', gcName: '', claimantName: '', contactPerson: '', phone: '', extras: {} }), { marks: { [payLineField('a')]: { kind: 'typed' } } })
    expect(empty).toContain('no line · click to add one')
  })
})

