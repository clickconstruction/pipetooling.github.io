import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  addBusinessDays,
  buildDemandLetterModel,
  buildDemandLetterPrefill,
  buildDemandLetterText,
  demandLetterPdfFilename,
  demandMoney,
  lienFilingDeadlineForMonth,
  type DemandLetterFields,
} from './demandLetter'

const FIELDS: DemandLetterFields = {
  businessName: 'Click Plumbing and Electrical',
  senderName: 'Malachi Whites, Master Plumber (#RMP41130)',
  businessAddress: '5501 Balcones Dr Ste A141\nAustin, TX 78731',
  businessPhone: '+1 512 360 0599',
  businessEmail: 'office@clickplumbing.com',
  recipientName: 'Knight Contracting',
  recipientEmail: 'ap@knight.example',
  recipientAddress: '2904 Corporate CR Ste 114, Flower Mound, TX 75028',
  invoiceNumber: '915',
  invoiceDate: '2026-07-15',
  serviceDescription: 'Reliant Health — plumbing',
  invoiceTotal: '3850',
  paymentsReceived: '1138.50',
  outstanding: '2711.50',
  deadlineDate: '2026-09-16',
  paymentMethod: 'Checks payable to Click Plumbing and Electrical.',
  includeSmallClaims: true,
  includeLien: true,
  lienFilingDeadline: '2026-10-15',
  includeTheftOfServices: false,
  includeLateFees: true,
  includeNotarial: false,
  priorNotices: [
    { date: '2026-07-15', label: 'Invoice sent' },
    { date: '2026-08-05', label: 'Invoice re-sent by email' },
    { date: '2026-08-26', label: 'Collection call — no answer' },
  ],
}

describe('date math', () => {
  it('addBusinessDays skips weekends', () => {
    // 2026-09-02 is a Wednesday; +10 business days = Wed Sep 16.
    expect(addBusinessDays('2026-09-02', 10)).toBe('2026-09-16')
    // Friday +1 business day = Monday.
    expect(addBusinessDays('2026-09-04', 1)).toBe('2026-09-07')
  })
  it('lienFilingDeadlineForMonth: 15th of the 4th (non-res) / 3rd (res) month after, weekend-rolled', () => {
    // June 2026 work, non-res → Oct 15 2026 (Thursday).
    expect(lienFilingDeadlineForMonth('2026-06-28', 'non_residential')).toBe('2026-10-15')
    // June 2026 work, residential → Sep 15 2026 (Tuesday).
    expect(lienFilingDeadlineForMonth('2026-06-02', 'residential')).toBe('2026-09-15')
    // July 2026 res → Oct 15 (Thursday); Aug 2026 non-res → Dec 15 (Tuesday).
    expect(lienFilingDeadlineForMonth('2026-07-31', 'residential')).toBe('2026-10-15')
    // 2026-11-15 is a Sunday: res deadline for Aug work rolls to Monday Nov 16.
    expect(lienFilingDeadlineForMonth('2026-08-10', 'residential')).toBe('2026-11-16')
    expect(lienFilingDeadlineForMonth('', 'residential')).toBe('')
  })
})

describe('buildDemandLetterModel', () => {
  const model = buildDemandLetterModel(FIELDS, '2026-09-02')
  const text = buildDemandLetterText(FIELDS, '2026-09-02')

  it('carries the demand, the dated notice history, and the Chapter 53 deadline', () => {
    expect(text).toContain('final formal demand for payment in the amount of $2,711.50')
    expect(text).toContain('August 5, 2026 — Invoice re-sent by email')
    expect(text).toContain('August 26, 2026 — Collection call — no answer')
    expect(text).toContain('Unless payment in full is received by September 16, 2026')
    expect(text).toContain("mechanic's lien under Chapter 53")
    expect(text).toContain('filing window for this work runs through October 15, 2026')
  })
  it('§ 31.04 stays out unless toggled on; notarial block likewise', () => {
    expect(text).not.toContain('31.04')
    expect(text).not.toContain('NOTARY')
    const withBoth = buildDemandLetterText({ ...FIELDS, includeTheftOfServices: true, includeNotarial: true }, '2026-09-02')
    expect(withBoth).toContain('Texas Penal Code § 31.04')
    expect(withBoth).toContain('Notary Public, State of Texas')
  })
  it('no lien deadline → the Chapter 53 line drops the parenthetical', () => {
    const t = buildDemandLetterText({ ...FIELDS, lienFilingDeadline: '' }, '2026-09-02')
    expect(t).toContain("mechanic's lien under Chapter 53 of the Texas Property Code")
    expect(t).not.toContain('filing window')
  })
  it('model starts with the sender block and ends with signature', () => {
    expect(model[0]?.kind).toBe('senderBlock')
    expect(model[model.length - 1]?.kind).toBe('signature')
  })
})

describe('prefill', () => {
  const inv = (id: string, amount: number, billed: string) =>
    ({ id, amount, billed_at: billed, created_at: billed, status: 'billed' }) as unknown as JobWithDetails['invoices'][number]
  const job = {
    id: 'j1',
    hcp_number: '915',
    job_name: 'Reliant Health',
    last_work_date: '2026-06-28',
    payments: [{ invoice_id: 'a', amount: 1138.5 }],
    invoices: [],
  } as unknown as JobWithDetails

  it('totals from the covered lines; deadline +10 business days; lien deadline from last work month', () => {
    const f = buildDemandLetterPrefill({
      job,
      invoices: [inv('a', 3850, '2026-07-15T10:00:00Z')],
      issuer: { companyName: 'Click Plumbing and Electrical', addressText: '5501 Balcones Dr', phone: '', email: '', tagline: '', licenseLine: '' },
      senderName: 'Malachi',
      senderEmailFallback: 'office@x.com',
      recipient: { name: 'Knight Contracting', email: 'ap@k.com', address: 'Flower Mound' },
      priorNotices: [{ date: '2026-07-15', label: 'Invoice sent' }],
      propertyKind: 'non_residential',
      todayYmd: '2026-09-02',
    })
    expect(f.invoiceTotal).toBe('3850.00')
    expect(f.paymentsReceived).toBe('1138.50')
    expect(f.outstanding).toBe('2711.50')
    expect(f.deadlineDate).toBe('2026-09-16')
    expect(f.lienFilingDeadline).toBe('2026-10-15')
    expect(f.includeTheftOfServices).toBe(false)
    expect(f.invoiceDate).toBe('2026-07-15')
  })
})

describe('misc', () => {
  it('money + filename', () => {
    expect(demandMoney('2711.5')).toBe('$2,711.50')
    expect(demandLetterPdfFilename('915')).toBe('final-demand-letter-915.pdf')
  })
})
