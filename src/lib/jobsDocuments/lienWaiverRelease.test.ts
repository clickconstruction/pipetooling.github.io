import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  buildLienWaiverEmailText,
  buildLienWaiverParagraphs,
  buildLienWaiverPdfModel,
  buildLienWaiverPrefill,
  buildLienWaiverSignatureLines,
  lienWaiverDate,
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

describe('signature block', () => {
  it('renders date/contractor/by/title, empty signer values stay blank for wet signing', () => {
    const lines = buildLienWaiverSignatureLines({ ...FIELDS, signerName: '', signerTitle: '' })
    expect(lines.map((l) => l.label)).toEqual(['Date', 'Contractor', 'By', 'Title'])
    expect(lines[0]?.value).toBe('September 1, 2026')
    expect(lines[1]?.value).toBe('ClickConstruction LLC')
    expect(lines[2]?.value).toBe('')
    expect(lines[3]?.value).toBe('')
  })
  it('text builder renders blank signature slots as fill-in lines', () => {
    const text = buildLienWaiverEmailText('conditional_progress', { ...FIELDS, signerTitle: '' })
    expect(text).toContain('By: Robert Douglas')
    expect(text).toContain('Title: ______________________')
    expect(text.startsWith('CONDITIONAL WAIVER AND RELEASE ON PROGRESS PAYMENT')).toBe(true)
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
  it('model is title, paragraphs, then four signature blocks', () => {
    const model = buildLienWaiverPdfModel('conditional_progress', FIELDS)
    expect(model[0]).toEqual({ kind: 'title', text: 'Conditional Waiver and Release on Progress Payment' })
    expect(model.filter((b) => b.kind === 'paragraph')).toHaveLength(4)
    expect(model.filter((b) => b.kind === 'signature')).toHaveLength(4)
  })
  it('filename slugs the form type and job number', () => {
    expect(lienWaiverPdfFilename('conditional_progress', 'JP650')).toBe('lien-release-conditional-progress-JP650.pdf')
    expect(lienWaiverPdfFilename('unconditional_final', '')).toBe('lien-release-unconditional-final-job.pdf')
  })
})
