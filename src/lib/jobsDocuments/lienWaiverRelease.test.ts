import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  buildLienWaiverEmailText,
  buildLienWaiverParagraphs,
  buildLienWaiverPdfModel,
  buildLienWaiverPrefill,
  buildLienWaiverPrintHtml,
  buildLienWaiverFoot,
  buildLienWaiverFootHtml,
  lienWaiverFootLines,
  LIEN_WAIVER_ESIGN_LINE,
  lienWaiverDate,
  lienWaiverDatesUnfinished,
  lienWaiverUnfinishedDateBlocksIssue,
  lienWaiverUnfinishedDates,
  lienWaiverInvoiceOpenRemaining,
  lienWaiverMoney,
  lienWaiverPdfFilename,
  lienWaiverPrefillAmount,
  lienWaiverTitle,
  lienWaiverUsesField,
  type LienWaiverFields,
} from './lienWaiverRelease'

const FIELDS: LienWaiverFields = {
  companyName: 'ClickConstruction LLC',
  checkFrom: 'Knight Contracting',
  amount: '2200',
  projectDescription: 'Knight Springtown Vet — 415 Springtown Way, San Marcos, TX 7866',
  throughDate: '2026-08-29',
  signedDate: '2026-09-01',
  signerName: 'Robert Douglas',
  signerTitle: 'Managing Member',
}

type InvoiceLike = { id: string; amount: number; billed_at: string | null; created_at: string }
function inv(partial: Partial<InvoiceLike> & { id: string; amount: number }): JobWithDetails['invoices'][number] {
  return {
    id: partial.id,
    amount: partial.amount,
    billed_at: partial.billed_at ?? null,
    created_at: partial.created_at ?? '2026-08-01T12:00:00Z',
  } as JobWithDetails['invoices'][number]
}

function jobWith(overrides: Partial<JobWithDetails>): JobWithDetails {
  return {
    id: 'job-1',
    job_name: 'Knight Springtown Vet',
    job_address: '415 Springtown Way, San Marcos, TX 7866',
    customer_name: 'Knight Contracting',
    revenue: 6762,
    payments_made: 0,
    last_work_date: '2026-08-28',
    payments: [],
    invoices: [],
    materials: [],
    fixtures: [],
    team_members: [],
    ...overrides,
  } as unknown as JobWithDetails
}

describe('lienWaiverMoney / lienWaiverDate', () => {
  it('formats dollar strings and passes junk through', () => {
    expect(lienWaiverMoney('2200')).toBe('$2,200.00')
    expect(lienWaiverMoney('$2,200.5')).toBe('$2,200.50')
    expect(lienWaiverMoney('')).toBe('$—')
    expect(lienWaiverMoney('TBD')).toBe('TBD')
  })
  it('formats ymd long-form and passes non-ymd through', () => {
    expect(lienWaiverDate('2026-08-29')).toBe('August 29, 2026')
    expect(lienWaiverDate('')).toBe('—')
    expect(lienWaiverDate('Aug 29')).toBe('Aug 29')
  })
})

describe('titles and field visibility', () => {
  it('titles match the drafted doc', () => {
    expect(lienWaiverTitle('conditional_progress')).toBe('Conditional Waiver and Release on Progress Payment')
    expect(lienWaiverTitle('unconditional_progress')).toBe('Unconditional Waiver and Release on Progress Payment')
    expect(lienWaiverTitle('unconditional_final')).toBe('Unconditional Waiver and Release on Final Payment')
  })
  it('checkFrom is conditional-only; throughDate hidden on final', () => {
    expect(lienWaiverUsesField('conditional_progress', 'checkFrom')).toBe(true)
    expect(lienWaiverUsesField('unconditional_progress', 'checkFrom')).toBe(false)
    expect(lienWaiverUsesField('unconditional_final', 'throughDate')).toBe(false)
    expect(lienWaiverUsesField('conditional_progress', 'throughDate')).toBe(true)
    expect(lienWaiverUsesField('unconditional_final', 'amount')).toBe(true)
  })
  it('the dates are unfinished while either year is half typed; an empty date is finished', () => {
    expect(lienWaiverDatesUnfinished('conditional_progress', FIELDS)).toBe(false)
    expect(lienWaiverDatesUnfinished('conditional_progress', { throughDate: '', signedDate: '' })).toBe(false)
    expect(lienWaiverDatesUnfinished('conditional_progress', { ...FIELDS, signedDate: '0002-09-01' })).toBe(true)
    expect(lienWaiverDatesUnfinished('unconditional_progress', { ...FIELDS, throughDate: '0202-08-29' })).toBe(true)
  })
  it('a final waiver has no through date, so one left half typed under another form type does not hold it', () => {
    expect(lienWaiverDatesUnfinished('unconditional_final', { ...FIELDS, throughDate: '0202-08-29' })).toBe(false)
    expect(lienWaiverDatesUnfinished('unconditional_final', { ...FIELDS, signedDate: '0026-09-01' })).toBe(true)
  })
  it('a half-typed date stops the waiver being issued, and the line names the first such box on the form', () => {
    expect(lienWaiverUnfinishedDateBlocksIssue('conditional_progress', FIELDS, 2026)).toBeNull()
    expect(lienWaiverUnfinishedDateBlocksIssue('conditional_progress', { throughDate: '', signedDate: '' }, 2026)).toBeNull()
    expect(lienWaiverUnfinishedDates('conditional_progress', { throughDate: '0020-08-29', signedDate: '0026-09-01' })).toEqual(['throughDate', 'signedDate'])
    expect(lienWaiverUnfinishedDateBlocksIssue('conditional_progress', { throughDate: '0020-08-29', signedDate: '0026-09-01' }, 2026)).toBe(
      'Finish the “Progress payments through” date before this is issued. Type the year in full, like 2026.',
    )
    expect(lienWaiverUnfinishedDateBlocksIssue('unconditional_progress', { ...FIELDS, signedDate: '0026-09-01' }, 2026)).toBe('Finish the “Signature” date before this is issued. Type the year in full, like 2026.')
    // A final waiver has no through date: one left half typed under another form type does not stop it.
    expect(lienWaiverUnfinishedDateBlocksIssue('unconditional_final', { ...FIELDS, throughDate: '0020-08-29' }, 2026)).toBeNull()
  })
})

describe('buildLienWaiverParagraphs', () => {
  it('conditional progress carries the drafted conditional language with values inline', () => {
    const paras = buildLienWaiverParagraphs('conditional_progress', FIELDS)
    expect(paras).toHaveLength(4)
    expect(paras[0]).toContain('Upon receipt by the undersigned of a check from Knight Contracting')
    expect(paras[0]).toContain('$2,200.00 payable to ClickConstruction LLC')
    expect(paras[0]).toContain('has cleared the bank')
    expect(paras[1]).toContain('Knight Springtown Vet — 415 Springtown Way')
    expect(paras[2]).toContain('progress payments through: August 29, 2026')
    expect(paras[2]).toContain('does not cover any retentions')
    expect(paras[3]).toContain('conditional upon actual receipt and clearance')
  })
  it('unconditional progress waives for the paid portion and keeps retainage carve-out', () => {
    const paras = buildLienWaiverParagraphs('unconditional_progress', FIELDS)
    expect(paras).toHaveLength(3)
    expect(paras[0]).toContain('has been paid and has received progress payment(s) totaling $2,200.00')
    expect(paras[1]).toContain('through August 29, 2026')
    expect(paras[1]).toContain("mechanic's lien, stop notice, or claim on any bond")
    expect(paras[2]).toContain('does not affect any retainage')
  })
  it('unconditional final fully discharges', () => {
    const paras = buildLienWaiverParagraphs('unconditional_final', FIELDS)
    expect(paras).toHaveLength(4)
    expect(paras[0]).toContain('paid in full for all work, labor, materials, and services')
    expect(paras[2]).toContain('final payment of $2,200.00')
    expect(paras[2]).toContain('fully and unconditionally waives, releases, and discharges')
    expect(paras[3]).toContain('all contractual obligations are satisfied')
  })
  it('blank fields render as em-dash placeholders, never empty holes', () => {
    const blank: LienWaiverFields = { ...FIELDS, checkFrom: '', amount: '', projectDescription: '', throughDate: '' }
    const paras = buildLienWaiverParagraphs('conditional_progress', blank)
    expect(paras[0]).toContain('a check from —')
    expect(paras[0]).toContain('sum of $—')
    expect(paras[2]).toContain('through: —')
  })
})

describe('the foot of the page (v2.4285)', () => {
  it('unsigned: the signer and company on one line, the title, and a blank for the day signed', () => {
    const foot = buildLienWaiverFoot(FIELDS, null)
    expect(foot).toEqual({ name: 'Robert Douglas', company: 'ClickConstruction LLC', title: 'Managing Member', signed: null })
    expect(lienWaiverFootLines(foot)).toEqual(['Robert Douglas, ClickConstruction LLC', 'Managing Member', 'Signed ______________________'])
  })
  it('no title: the line is left out, never a blank', () => {
    const foot = buildLienWaiverFoot({ ...FIELDS, signerTitle: '  ' }, null)
    expect(foot.title).toBeNull()
    expect(lienWaiverFootLines(foot)).toHaveLength(2)
    expect(buildLienWaiverFootHtml({ ...FIELDS, signerTitle: '' }, null)).not.toContain('Title')
  })
  it('signed: the signature’s printed name is the signer of record and the day signed is the signature’s, not the draft’s', () => {
    const foot = buildLienWaiverFoot({ ...FIELDS, signerName: 'Robert' }, { printedName: 'Malachi Whites', signedYmd: '2026-09-30' })
    expect(foot.name).toBe('Malachi Whites')
    expect(foot.signed).toBe('Signed September 30, 2026')
    // Without a signed day the fields' signature date stands in.
    expect(buildLienWaiverFoot(FIELDS, { printedName: 'Malachi Whites' }).signed).toBe('Signed September 1, 2026')
  })
  it('never prints By: or Title: label lines; the text copy carries the foot under a rule', () => {
    const text = buildLienWaiverEmailText('conditional_progress', { ...FIELDS, signerTitle: '' })
    expect(text).not.toContain('By:')
    expect(text).not.toContain('Title:')
    expect(text).toContain('Robert Douglas, ClickConstruction LLC')
    expect(text).toContain('Signed ______________________')
    expect(text.startsWith('CONDITIONAL WAIVER AND RELEASE ON PROGRESS PAYMENT')).toBe(true)
    const html = buildLienWaiverPrintHtml('conditional_progress', FIELDS, '650')
    expect(html).not.toContain('By:')
    expect(html).not.toContain('Contractor:')
    expect(html).toContain('<strong>Robert Douglas</strong>, ClickConstruction LLC')
  })
})

describe('prefill amounts', () => {
  const invoices = [inv({ id: 'a', amount: 2200, billed_at: '2026-08-29T10:00:00Z' }), inv({ id: 'b', amount: 1560 })]
  it('conditional releases the open remaining on the selection', () => {
    const job = jobWith({
      invoices,
      payments: [{ invoice_id: 'a', amount: 200 } as JobWithDetails['payments'][number]],
    })
    expect(lienWaiverPrefillAmount('conditional_progress', job, [invoices[0]!])).toBe(2000)
    expect(lienWaiverPrefillAmount('conditional_progress', job, invoices)).toBe(3560)
  })
  it('unconditional progress acknowledges applied payments, falling back to line amounts', () => {
    const paid = jobWith({
      invoices,
      payments: [{ invoice_id: 'a', amount: 2200 } as JobWithDetails['payments'][number]],
    })
    expect(lienWaiverPrefillAmount('unconditional_progress', paid, [invoices[0]!])).toBe(2200)
    const unpaid = jobWith({ invoices })
    expect(lienWaiverPrefillAmount('unconditional_progress', unpaid, [invoices[1]!])).toBe(1560)
  })
  it('empty selection falls back to job totals', () => {
    const job = jobWith({ revenue: 6762, payments_made: 3000 })
    expect(lienWaiverPrefillAmount('conditional_progress', job, [])).toBe(3762)
    expect(lienWaiverPrefillAmount('unconditional_progress', job, [])).toBe(3000)
  })
  it('open remaining never goes negative', () => {
    const job = jobWith({
      invoices,
      payments: [{ invoice_id: 'a', amount: 9999 } as JobWithDetails['payments'][number]],
    })
    expect(lienWaiverInvoiceOpenRemaining(job, invoices[0]!)).toBe(0)
  })
})

describe('buildLienWaiverPrefill', () => {
  it('maps job/invoice/issuer/owner into fields', () => {
    const job = jobWith({ invoices: [inv({ id: 'a', amount: 2200, billed_at: '2026-08-29T10:00:00Z' })] })
    const f = buildLienWaiverPrefill('conditional_progress', {
      job,
      invoices: job.invoices,
      issuer: { companyName: 'Click Plumbing and Electrical', addressText: '', phone: '', email: '', tagline: '', licenseLine: '' },
      ownerName: 'Knight Contracting (owner row)',
      signerName: 'Robert Douglas',
    })
    expect(f.companyName).toBe('Click Plumbing and Electrical')
    expect(f.checkFrom).toBe('Knight Contracting (owner row)')
    expect(f.amount).toBe('2200.00')
    expect(f.projectDescription).toBe('Knight Springtown Vet — 415 Springtown Way, San Marcos, TX 7866')
    expect(f.throughDate).toBe('2026-08-29')
    expect(f.signerName).toBe('Robert Douglas')
  })
  it('the through date is the last bill\'s day in the company zone, evenings included', () => {
    // 7:30 pm CDT on Oct 2 (+00:00 shape); 6:30 pm CST on Dec 1 from created_at when there is no billed_at.
    const ctx = (invoices: JobWithDetails['invoices']) => ({ job: jobWith({ invoices }), invoices, issuer: null, ownerName: null, signerName: '' })
    expect(buildLienWaiverPrefill('conditional_progress', ctx([inv({ id: 'a', amount: 1, billed_at: '2026-10-03T00:30:00+00:00' })])).throughDate).toBe('2026-10-02')
    expect(buildLienWaiverPrefill('conditional_progress', ctx([inv({ id: 'a', amount: 1, billed_at: '2026-10-01T15:00:00Z' }), inv({ id: 'b', amount: 1, created_at: '2026-12-02T00:30:00Z' })])).throughDate).toBe('2026-12-01')
    expect(buildLienWaiverPrefill('conditional_progress', ctx([inv({ id: 'a', amount: 1, billed_at: '2026-10-03T12:00:00Z' })])).throughDate).toBe('2026-10-03')
  })

  it('falls back: issuer→ClickConstruction, owner→GC→customer, through→last_work_date', () => {
    const job = jobWith({ gcCustomer: { id: 'gc', name: 'GC Fallback Inc' } })
    const f = buildLienWaiverPrefill('unconditional_final', {
      job,
      invoices: [],
      issuer: null,
      ownerName: null,
      signerName: '',
    })
    expect(f.companyName).toBe('ClickConstruction LLC')
    expect(f.checkFrom).toBe('GC Fallback Inc')
    expect(f.throughDate).toBe('2026-08-28')
  })
})

describe('pdf model + filename', () => {
  it('model is title, paragraphs, then the one foot block (v2.4285)', () => {
    const model = buildLienWaiverPdfModel('conditional_progress', FIELDS)
    expect(model[0]).toEqual({ kind: 'title', text: 'Conditional Waiver and Release on Progress Payment' })
    expect(model.filter((b) => b.kind === 'paragraph')).toHaveLength(4)
    expect(model[model.length - 1]).toEqual({ kind: 'foot', foot: { name: 'Robert Douglas', company: 'ClickConstruction LLC', title: 'Managing Member', signed: null } })
    const signed = buildLienWaiverPdfModel('conditional_progress', FIELDS, { mode: 'draw', printedName: 'Malachi Whites', auditLine: 'x', signedYmd: '2026-09-30' })
    expect(signed[signed.length - 1]).toEqual({ kind: 'foot', foot: { name: 'Malachi Whites', company: 'ClickConstruction LLC', title: 'Managing Member', signed: 'Signed September 30, 2026' } })
  })
  it('filename slugs the form type and job number', () => {
    expect(lienWaiverPdfFilename('conditional_progress', 'JP650')).toBe('lien-release-conditional-progress-JP650.pdf')
    expect(lienWaiverPdfFilename('unconditional_final', '')).toBe('lien-release-unconditional-final-job.pdf')
  })
})

describe('electronic signature rendering (v2.2619)', () => {
  const SIG_TYPED = {
    mode: 'type' as const,
    printedName: 'Malachi Whites',
    auditLine: 'Typed by Malachi Whites in ClickTooling on Sep 1, 2026 at 3:41 PM CT, consent recorded.',
    signedYmd: '2026-09-01',
  }

  it('typed signature renders the cursive name above the rule, the name and company under it, the audit sentence and the statute line', () => {
    const html = buildLienWaiverFootHtml(FIELDS, SIG_TYPED)
    expect(html).toContain('Great Vibes')
    expect(html).toContain('<strong>Malachi Whites</strong>, ClickConstruction LLC')
    expect(html).toContain('Signed September 1, 2026')
    expect(html).toContain('Typed by Malachi Whites in ClickTooling')
    expect(html).toContain(LIEN_WAIVER_ESIGN_LINE.replace('&', '&amp;'))
    expect(html).not.toContain('<img')
  })

  it('drawn signature embeds the PNG and never the cursive block', () => {
    const html = buildLienWaiverFootHtml(FIELDS, { ...SIG_TYPED, mode: 'draw', pngDataUrl: 'data:image/png;base64,AAAA' })
    expect(html).toContain('<img src="data:image/png;base64,AAAA"')
    expect(html).not.toContain('Great Vibes')
  })

  it('print HTML carries the signature block and the webfont only when the name is typed', () => {
    const signed = buildLienWaiverPrintHtml('unconditional_final', FIELDS, '1003', SIG_TYPED)
    expect(signed).toContain('fonts.googleapis.com')
    expect(signed).toContain('Typed by Malachi Whites in ClickTooling')
    const unsigned = buildLienWaiverPrintHtml('unconditional_final', FIELDS, '1003')
    expect(unsigned).not.toContain('fonts.googleapis.com')
    expect(unsigned).not.toContain('in ClickTooling')
    expect(unsigned).not.toContain('ESIGN')
    const drawn = buildLienWaiverPrintHtml('unconditional_final', FIELDS, '1003', {
      ...SIG_TYPED,
      mode: 'draw',
      pngDataUrl: 'data:image/png;base64,AAAA',
    })
    expect(drawn).not.toContain('fonts.googleapis.com')
    expect(drawn).toContain('<img src="data:image/png;base64,AAAA"')
  })

  it('escapes markup in the printed name and audit line', () => {
    const html = buildLienWaiverFootHtml(FIELDS, { ...SIG_TYPED, printedName: 'A <b>bold</b> & co', auditLine: 'x < y' })
    expect(html).not.toContain('<b>bold</b>')
    expect(html).toContain('&lt;b&gt;')
    expect(html).toContain('x &lt; y')
  })
})

// ---- v2.4274: the fourth form, the two toggles, the bill pick ----
import { LIEN_WAIVER_FORM_CITES, LIEN_WAIVER_FORM_SHORT_LABELS, LIEN_WAIVER_FORM_TYPES, lienWaiverFormFrom, lienWaiverIsConditional, lienWaiverToggles, lienWaiverTickForBill, lienWaiverWhy, pickLienWaiverForBill } from './lienWaiverRelease'

type BillLike = { id: string; amount: number; sequence_order: number; status: string }
const bill = (b: BillLike) => b as unknown as JobWithDetails['invoices'][number]

describe('the four forms as two questions (v2.4274)', () => {
  it('toggles ↔ form types, both ways', () => {
    expect(lienWaiverFormFrom({ conditional: true, final: false })).toBe('conditional_progress')
    expect(lienWaiverFormFrom({ conditional: true, final: true })).toBe('conditional_final')
    expect(lienWaiverFormFrom({ conditional: false, final: true })).toBe('unconditional_final')
    for (const t of LIEN_WAIVER_FORM_TYPES) expect(lienWaiverFormFrom(lienWaiverToggles(t))).toBe(t)
    expect(lienWaiverIsConditional('conditional_final')).toBe(true)
    expect(lienWaiverIsConditional('unconditional_progress')).toBe(false)
  })
  it('conditional final: titled, cited § 53.284(d), asks who the check is from, has no through date, releases on clearance', () => {
    expect(lienWaiverTitle('conditional_final')).toBe('Conditional Waiver and Release on Final Payment')
    expect(LIEN_WAIVER_FORM_CITES.conditional_final).toBe('§ 53.284(d)')
    expect(lienWaiverUsesField('conditional_final', 'checkFrom')).toBe(true)
    expect(lienWaiverUsesField('conditional_final', 'throughDate')).toBe(false)
    const paras = buildLienWaiverParagraphs('conditional_final', { ...FIELDS, amount: '4800' })
    expect(paras[0]).toContain('check from Knight Contracting in the sum of $4,800.00')
    expect(paras[2]).toContain('This is the final payment')
    expect(paras[3]).toContain('conditional upon actual receipt and clearance')
    expect(LIEN_WAIVER_FORM_SHORT_LABELS.conditional_final).toBe('Conditional · final')
  })
  it('the why line names the payor and warns on the unconditional forms', () => {
    expect(lienWaiverWhy('conditional_progress', 'Knight Contracting')).toBe('Takes effect when Knight Contracting’s check clears. Safe to sign now; the unconditional follows when the payment settles.')
    expect(lienWaiverWhy('unconditional_progress', 'Knight')).toContain('Texas forbids requiring it before payment')
    expect(lienWaiverWhy('conditional_final', '')).toContain('The last bill')
  })
  it('v2.4330: a bill settled by a check that has not cleared says when it clears; the form stays the unconditional', () => {
    const inv1 = bill({ id: 'a', amount: 4478, sequence_order: 0, status: 'billed' })
    const inv2 = bill({ id: 'b', amount: 2000, sequence_order: 1, status: 'billed' })
    const job = jobWith({ invoices: [inv1, inv2], payments: [{ invoice_id: 'a', amount: 4478, paid_on: '2026-10-01', payment_type: 'Check' }] as never, revenue: 6478 })
    expect(pickLienWaiverForBill(job, inv1, '2026-10-02')).toMatchObject({ formType: 'unconditional_progress', settled: true, clearsYmd: '2026-10-08', facts: ['Settled · the check clears about Oct 8', 'Bill 1 of 2 · not the last'] })
    expect(pickLienWaiverForBill(job, inv1, '2026-10-09')).toMatchObject({ clearsYmd: null, facts: ['Settled', 'Bill 1 of 2 · not the last'] })
    const byCard = jobWith({ invoices: [inv1, inv2], payments: [{ invoice_id: 'a', amount: 4478, paid_on: '2026-10-01', payment_type: 'Card (external)' }] as never, revenue: 6478 })
    expect(pickLienWaiverForBill(byCard, inv1, '2026-10-02').clearsYmd).toBeNull()
  })
  it('picks the waiver from the bill: unsettled progress bill → conditional progress; the settled last bill → unconditional final', () => {
    const inv1 = bill({ id: 'a', amount: 11240, sequence_order: 0, status: 'billed' })
    const inv2 = bill({ id: 'b', amount: 15406, sequence_order: 1, status: 'billed' })
    const inv3 = bill({ id: 'c', amount: 9354, sequence_order: 2, status: 'ready_to_bill' })
    const job = jobWith({ invoices: [inv1, inv2, inv3], payments: [{ invoice_id: 'a', amount: 11240 }] as never, revenue: 36000 })
    expect(pickLienWaiverForBill(job, inv2)).toMatchObject({ formType: 'conditional_progress', settled: false, final: false, facts: ['Not settled yet', 'Bill 2 of 3 · not the last'] })
    expect(pickLienWaiverForBill(job, inv1)).toMatchObject({ formType: 'unconditional_progress', settled: true, final: false })
    const paidAll = jobWith({ invoices: [inv1, inv2, inv3], payments: [{ invoice_id: 'a', amount: 11240 }, { invoice_id: 'b', amount: 15406 }, { invoice_id: 'c', amount: 9354 }] as never, revenue: 36000 })
    expect(pickLienWaiverForBill(paidAll, inv3)).toMatchObject({ formType: 'unconditional_final', settled: true, final: true, facts: ['Settled', 'Bill 3 of 3 · the last'] })
    expect(pickLienWaiverForBill(job, inv3)).toMatchObject({ formType: 'conditional_final', final: true })
    // v2.4318: marked paid with the payment on no bill (job 251) → settled, so the unconditional
    const markedPaid = bill({ id: 'p', amount: 9440, sequence_order: 0, status: 'paid' })
    expect(pickLienWaiverForBill(jobWith({ invoices: [markedPaid, inv2], payments: [{ invoice_id: null, amount: 9440 }] as never, revenue: 36000 }), markedPaid)).toMatchObject({ formType: 'unconditional_progress', settled: true })
    // more still to bill than the minted lines cover → the "last" line is still a progress payment
    const moreToBill = jobWith({ invoices: [inv1, inv2], payments: [], revenue: 36000 })
    expect(pickLienWaiverForBill(moreToBill, inv2)).toMatchObject({ formType: 'conditional_progress', final: false })
  })
  it('unconditional final prefills the whole covered amount, not the open remainder', () => {
    const one = bill({ id: 'a', amount: 4800, sequence_order: 0, status: 'billed' })
    const job = jobWith({ invoices: [one], payments: [{ invoice_id: 'a', amount: 4800 }] as never, revenue: 4800, payments_made: 4800 })
    expect(lienWaiverPrefillAmount('unconditional_final', job, [one])).toBe(4800)
    expect(lienWaiverPrefillAmount('conditional_final', job, [one])).toBe(0)
  })
})

describe('lienWaiverTickForBill', () => {
  const inv = { id: 'inv-1', amount: 500, sequence_order: 0, status: 'ready_to_bill' }
  const gcJob = { gc_customer_id: 'gc-1', invoices: [inv], payments: [], revenue: 1000 } as unknown as Parameters<typeof lienWaiverTickForBill>[0]
  it('a GC job billing one of its bills draws the tick', () => {
    expect(lienWaiverTickForBill(gcJob, 'inv-1', '2026-10-05')?.formType).toBe('conditional_progress')
  })
  it('no tick with no bill named, a bill not on the job, a direct job, or no job', () => {
    expect(lienWaiverTickForBill(gcJob, null)).toBeNull()
    expect(lienWaiverTickForBill(gcJob, 'inv-other')).toBeNull()
    expect(lienWaiverTickForBill({ ...gcJob!, gc_customer_id: null }, 'inv-1')).toBeNull()
    expect(lienWaiverTickForBill(null, 'inv-1')).toBeNull()
  })
})
