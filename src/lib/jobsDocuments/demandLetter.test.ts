import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  addBusinessDays,
  addCalendarDays,
  courtLineText,
  feeClockDate,
  interestBasisFor,
  lienLineBlockedReason,
  buildDemandLetterEmailHtml,
  buildDemandLetterModel,
  buildDemandLetterPrefill,
  jobHasAnyPayment,
  paymentsAppliedToInvoice,
  buildDemandLetterText,
  buildDemandStatement,
  letterheadContactLines,
  demandDebtorParty,
  demandInvoicesPhrase,
  demandLetterPdfFilename,
  demandMoney,
  lienFilingDeadlineForMonth,
  statementRows,
  type DemandInvoiceSource,
  type DemandLetterFields,
  type DemandStatementInvoice,
} from './demandLetter'
import type { PhysicalInvoiceDocument } from '../physicalInvoiceDocument'

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
  it('letterhead contact column is the return address line for line — no sender name, nothing joined (v2.3474)', () => {
    const sender = model[0]
    if (sender?.kind !== 'senderBlock') throw new Error('expected senderBlock')
    expect(sender.company).toBe('Click Plumbing and Electrical')
    expect(sender.contactLines).toEqual(['5501 Balcones Dr Ste A141', 'Austin, TX 78731', '+1 512 360 0599', 'office@clickplumbing.com'])
    expect(sender.contactLines.join('\n')).not.toContain('Malachi')
    // The sender still signs the letter.
    const sig = model[model.length - 1]
    if (sig?.kind !== 'signature') throw new Error('expected signature')
    expect(sig.lines).toContain('Malachi Whites, Master Plumber (#RMP41130)')
    // Blanks and CRLF drop cleanly.
    expect(letterheadContactLines('1 Main St\r\n\r\nAustin, TX', ' ', 'a@b.c')).toEqual(['1 Main St', 'Austin, TX', 'a@b.c'])
    expect(letterheadContactLines('', '', '')).toEqual([])
  })
  it('email html keeps the contact column on one unbroken line each', () => {
    const html = buildDemandLetterEmailHtml(FIELDS, '2026-09-02')
    expect(html).toContain('white-space:nowrap')
    expect(html).toContain('5501 Balcones Dr Ste A141<br/>Austin, TX 78731<br/>+1 512 360 0599<br/>office@clickplumbing.com')
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

// ---------- v2.3425: the letter reads the bill ----------

const STMT_867: DemandStatementInvoice = {
  invoiceNumber: '#867-2608180928',
  sentYmd: '2026-08-18',
  dueYmd: '2026-09-05',
  lines: [{ description: 'Service Visit (HCP #867) Additional gas install and sidewalk bore under patio.', qty: '', amount: '1710.00' }],
  total: '1710.00',
  paid: '0.00',
  balance: '1710.00',
}

describe('statement of account (v2.3425)', () => {
  const withStatement: DemandLetterFields = {
    ...FIELDS,
    recipientName: 'RMC- Dudley Mason',
    debtorParty: 'gc',
    statement: [STMT_867],
    serviceAddress: '628 Terrell Rd, San Antonio, TX 78209',
    invoiceTotal: '1710.00',
    paymentsReceived: '0.00',
    outstanding: '1710.00',
  }

  it('the Re line carries the number the customer saw and the balance; the body reads the bill', () => {
    const text = buildDemandLetterText(withStatement, '2026-09-14')
    expect(text).toContain('Re: Final Demand for Payment — Invoice #867-2608180928 · $1,710.00')
    expect(text).toContain('You were billed $1,710.00 on August 18, 2026 for the work below at 628 Terrell Rd, San Antonio, TX 78209. The bill was due September 5, 2026.')
    expect(text).toContain('Nothing has been paid.')
    expect(text).toContain('Statement of account')
    expect(text).toContain('Service Visit (HCP #867) Additional gas install and sidewalk bore under patio.')
    expect(text).toContain('All payments and credits have been allowed.')
    expect(text).not.toContain('Details of Debt')
    expect(text).not.toContain('Service provided:')
    const kinds = buildDemandLetterModel(withStatement, '2026-09-14').map((b) => b.kind)
    expect(kinds).toContain('statement')
  })

  it('names its exhibits under the statement and as enclosures at the foot (v2.3429)', () => {
    const text = buildDemandLetterText(
      { ...withStatement, enclosures: [{ label: 'A', title: 'Invoice #867-2608180928, as sent August 18, 2026', pages: 1 }, { label: 'C', title: 'Delivery record', pages: 1 }] },
      '2026-09-14',
    )
    expect(text).toContain('The invoice is enclosed as Exhibit A and the delivery record as Exhibit C. All payments and credits have been allowed.')
    expect(text.trim().endsWith('Enclosures: Exhibit A — Invoice #867-2608180928, as sent August 18, 2026 (1 page) · Exhibit C — Delivery record (1 page)')).toBe(true)
    const plain = buildDemandLetterText(withStatement, '2026-09-14')
    expect(plain).not.toContain('Exhibit')
  })

  it('a snapshot recorded before the statement still renders the four-line debt block', () => {
    const text = buildDemandLetterText({ ...FIELDS, statement: undefined }, '2026-09-02')
    expect(text).toContain('Details of Debt')
    expect(text).toContain('Service provided: Reliant Health — plumbing')
    expect(text).toContain('Re: Final Demand for Payment — Invoice #915')
  })

  it('two invoices: one block each, a total row, the phrase names both', () => {
    const second: DemandStatementInvoice = { ...STMT_867, invoiceNumber: '#867-2609010800', sentYmd: '2026-09-01', dueYmd: '2026-09-15', lines: [{ description: 'Trim set', qty: '2', amount: '400.00' }], total: '400.00', paid: '100.00', balance: '300.00' }
    const rows = statementRows({ invoices: [STMT_867, second], balance: '2010.00' })
    expect(rows.map((r) => r.kind)).toEqual(['invoice', 'line', 'paid', 'balance', 'invoice', 'line', 'paid', 'balance', 'total'])
    expect(rows[1]).toEqual({ kind: 'line', left: 'Service Visit (HCP #867) Additional gas install and sidewalk bore under patio.', right: '$1,710.00' })
    expect(rows[5]?.left).toBe('Trim set · Qty 2')
    expect(rows[6]?.right).toBe('−$100.00')
    expect(rows[7]).toEqual({ kind: 'balance', left: 'Balance on this invoice', right: '$300.00' })
    expect(rows[8]).toEqual({ kind: 'total', left: 'Balance due', right: '$2,010.00' })
    expect(demandInvoicesPhrase([STMT_867, second])).toBe('Invoices #867-2608180928 and #867-2609010800')
    const text = buildDemandLetterText({ ...withStatement, statement: [STMT_867, second], outstanding: '2010.00' }, '2026-09-14')
    expect(text).toContain('You were billed 2 invoices totaling $2,110.00 between August 18, 2026 and September 1, 2026')
    expect(text).toContain('$100.00 has been paid and $2,010.00 remains.')
  })

  it('a single invoice reads "Balance due" with no total row', () => {
    const rows = statementRows({ invoices: [STMT_867], balance: '1710.00' })
    expect(rows.map((r) => r.kind)).toEqual(['invoice', 'line', 'paid', 'balance'])
    expect(rows[0]?.left).toBe('#867-2608180928 — sent August 18, 2026 · due September 5, 2026')
    expect(rows[3]).toEqual({ kind: 'balance', left: 'Balance due', right: '$1,710.00' })
  })
})

describe('buildDemandStatement — read from the bill, never typed', () => {
  const inv = (over: Partial<DemandInvoiceSource['inv']>) =>
    ({
      id: 'inv-1',
      amount: 1710,
      sequence_order: 1,
      status: 'billed',
      billed_at: '2026-08-18T14:28:00Z',
      sent_to_customer_at: '2026-08-18T14:28:10Z',
      created_at: '2026-08-18T14:27:00Z',
      estimated_bill_date: '2026-09-05',
      stripe_invoice_id: 'in_1',
      stripe_invoice_memo: 'Service Visit (HCP #867) Additional gas install and sidewalk bore under patio.',
      bill_to_party: null,
      bill_to_email: null,
      ...over,
    }) as unknown as DemandInvoiceSource['inv']
  const job = {
    id: 'j867',
    hcp_number: '867',
    job_name: 'Service Visit — 628 Terrell Rd (HCP 867)',
    job_address: '628 Terrell Rd, San Antonio, TX 78209',
    customer_id: 'cust-rizvi',
    gc_customer_id: 'cust-rmc',
    bill_to_party: 'gc',
    payments: [{ invoice_id: 'inv-1', amount: 0 }],
    invoices: [],
  } as unknown as JobWithDetails
  const doc = (over: Partial<PhysicalInvoiceDocument>) =>
    ({
      layout: 'simple',
      invoiceNumberDisplay: '#1',
      lineDescription: 'Service Visit (HCP #867) Additional gas install and sidewalk bore under patio.',
      serviceLines: [],
      materialLines: [],
      ...over,
    }) as unknown as PhysicalInvoiceDocument

  it('prefers what Stripe rendered: the number the customer saw and the lines as they saw them', () => {
    const [st] = buildDemandStatement(job, [
      { inv: inv({}), doc: doc({}), stripe: { invoiceNumber: '867-2608180928', lines: [{ description: 'Service Visit (HCP #867) Additional gas install and sidewalk bore under patio.', quantity: 1, amount: 171000 }] } },
    ])
    expect(st).toEqual(STMT_867)
  })

  it('falls back to the app\'s own document lines, then to the memo and the amount', () => {
    const [detailed] = buildDemandStatement(job, [
      {
        inv: inv({ stripe_invoice_id: null }),
        doc: doc({ layout: 'detailed', invoiceNumberDisplay: '#2', serviceLines: [{ description: 'Rough-in labor', qty: 1, unitPrice: 1200, amount: 1200 }], materialLines: [{ description: 'PEX, fittings', qty: 3, unitPrice: 170, amount: 510 }] }),
        stripe: null,
      },
    ])
    expect(detailed?.invoiceNumber).toBe('#2')
    expect(detailed?.lines).toEqual([
      { description: 'Rough-in labor', qty: '', amount: '1200.00' },
      { description: 'PEX, fittings', qty: '3', amount: '510.00' },
    ])
    const [bare] = buildDemandStatement(job, [{ inv: inv({ stripe_invoice_id: null, sequence_order: 3 }), doc: null, stripe: null }])
    expect(bare?.invoiceNumber).toBe('#3')
    expect(bare?.lines).toEqual([{ description: 'Service Visit (HCP #867) Additional gas install and sidewalk bore under patio.', qty: '', amount: '1710.00' }])
    expect(bare?.invoiceNumber).not.toMatch(/^[0-9a-f]{8}$/)
  })

  it('dates: the bill date over the delivery date; the due date from Stripe when the row has none; never "#0" for the primary bill (v2.3445)', () => {
    const [st] = buildDemandStatement(job, [{ inv: inv({ billed_at: '2026-08-18T14:28:00Z', sent_to_customer_at: '2026-09-04T09:28:00Z', estimated_bill_date: null, sequence_order: 0, stripe_invoice_id: null }), doc: doc({ invoiceNumberDisplay: '#0' }), stripe: { invoiceNumber: null, lines: [], dueYmd: '2026-09-05' } }])
    expect(st?.sentYmd).toBe('2026-08-18')
    expect(st?.dueYmd).toBe('2026-09-05')
    expect(st?.invoiceNumber).toBe('#867')
    const text = buildDemandLetterText({ ...FIELDS, statement: [STMT_867], outstanding: '1710.00' }, '2026-09-14')
    expect(text).toContain("This letter is Click Plumbing and Electrical's final formal demand")
  })

  it('paid and balance come from the payments applied to that invoice', () => {
    const paidJob = { ...job, payments: [{ invoice_id: 'inv-1', amount: 500 }, { invoice_id: 'other', amount: 999 }] } as unknown as JobWithDetails
    const [st] = buildDemandStatement(paidJob, [{ inv: inv({}), doc: null, stripe: null }])
    expect(st?.paid).toBe('500.00')
    expect(st?.balance).toBe('1210.00')
  })

  it('the debtor is the party the bill was addressed to, by the invoice\'s own rule', () => {
    expect(demandDebtorParty(job, [inv({})])).toBe('gc')
    expect(demandDebtorParty(job, [inv({ bill_to_party: 'customer' })])).toBe('customer')
    expect(demandDebtorParty(job, [inv({ bill_to_email: 'tenant@x.com' })])).toBe('other')
    expect(demandDebtorParty({ ...job, gc_customer_id: null } as unknown as JobWithDetails, [inv({})])).toBe('customer')
  })

  it('prefill with sources: the statement rides the fields and the invoice number is never an id fragment', () => {
    const f = buildDemandLetterPrefill({
      job,
      invoices: [inv({})],
      sources: [{ inv: inv({}), doc: doc({}), stripe: { invoiceNumber: '867-2608180928', lines: [] } }],
      issuer: { companyName: 'Click Plumbing and Electrical', addressText: '5501 Balcones Dr', phone: '', email: '', tagline: '', licenseLine: '' },
      senderName: 'Malachi',
      senderEmailFallback: 'office@x.com',
      recipient: { name: 'RMC- Dudley Mason', email: 'ap@rmc.com', address: '' },
      priorNotices: [],
      propertyKind: '',
      todayYmd: '2026-09-14',
    })
    expect(f.statement?.[0]?.invoiceNumber).toBe('#867-2608180928')
    expect(f.invoiceNumber).toBe('#867-2608180928')
    expect(f.debtorParty).toBe('gc')
    expect(f.serviceAddress).toBe('628 Terrell Rd, San Antonio, TX 78209')
    expect(f.outstanding).toBe('1710.00')
  })
})

// ---------- v2.3433: every line names its basis ----------

describe('the legal lines (v2.3433)', () => {
  it('fee clock: 30 calendar days after the letter (CPRC § 38.002)', () => {
    expect(feeClockDate('2026-09-14')).toBe('2026-10-14')
    expect(addCalendarDays('2026-12-25', 10)).toBe('2027-01-04')
  })

  it('interest: ch. 28 from the 36th day after the bill went out; the legal rate from the 30th day after due when it never went out; none otherwise', () => {
    expect(interestBasisFor([STMT_867])).toEqual({ basis: 'ch28', fromYmd: '2026-09-23' })
    expect(interestBasisFor([{ ...STMT_867, sentYmd: '' }])).toEqual({ basis: 'legal_rate', fromYmd: '2026-10-05' })
    expect(interestBasisFor([{ ...STMT_867, sentYmd: '', dueYmd: '' }])).toEqual({ basis: 'none', fromYmd: '' })
    // Several invoices: the earliest send sets the date.
    expect(interestBasisFor([STMT_867, { ...STMT_867, sentYmd: '2026-07-01' }]).fromYmd).toBe('2026-08-06')
  })

  it('court: justice court to $20,000, county or district court above', () => {
    expect(courtLineText('1710.00')).toBe('Filing suit in justice court, which hears claims to $20,000')
    expect(courtLineText('20000')).toContain('justice court')
    expect(courtLineText('20000.01')).toBe('Filing suit in county or district court')
  })

  it('the Chapter 53 line is offered only while a lien can be filed', () => {
    expect(lienLineBlockedReason({ lienFilingDeadline: '2027-01-15', todayYmd: '2026-09-14', homestead: false, hasWorkMonth: true })).toBe('')
    expect(lienLineBlockedReason({ lienFilingDeadline: '2026-09-01', todayYmd: '2026-09-14', homestead: false, hasWorkMonth: true })).toBe('the filing window closed September 1, 2026')
    expect(lienLineBlockedReason({ lienFilingDeadline: '2027-01-15', todayYmd: '2026-09-14', homestead: true, hasWorkMonth: true })).toContain('homestead')
    expect(lienLineBlockedReason({ lienFilingDeadline: '', todayYmd: '2026-09-14', homestead: false, hasWorkMonth: false })).toContain('no approved work month')
  })

  it('the letter names each basis, and drops a blocked lien line even when the switch is on', () => {
    const f: DemandLetterFields = {
      ...FIELDS,
      statement: [STMT_867],
      outstanding: '1710.00',
      feeClockYmd: '2026-10-14',
      interestBasis: 'ch28',
      interestFromYmd: '2026-09-23',
      lienFilingDeadline: '2027-01-15',
      lienBlockedReason: '',
    }
    const text = buildDemandLetterText(f, '2026-09-14')
    expect(text).toContain('Filing suit in justice court, which hears claims to $20,000')
    expect(text).toContain("Filing a mechanic's lien under Chapter 53 of the Texas Property Code (our filing window for this work runs through January 15, 2027)")
    expect(text).toContain('If the claim remains unpaid 30 days after this letter, on October 14, 2026, we will also seek our attorney\'s fees under Texas Civil Practice and Remedies Code § 38.001.')
    expect(text).toContain('bears interest at 1.5 percent per month from September 23, 2026 under § 28.004')
    expect(text).not.toContain('late fees and interest may continue')
    expect(text).not.toContain('will be added')

    const blocked = buildDemandLetterText({ ...f, lienBlockedReason: 'the filing window closed September 1, 2026' }, '2026-09-14')
    expect(blocked).not.toContain("mechanic's lien")

    const legal = buildDemandLetterText({ ...f, interestBasis: 'legal_rate', interestFromYmd: '2026-10-05' }, '2026-09-14')
    expect(legal).toContain('legal rate of 6 percent a year from October 5, 2026 under Texas Finance Code § 302.002')
    const none = buildDemandLetterText({ ...f, interestBasis: 'none', interestFromYmd: '' }, '2026-09-14')
    expect(none).not.toContain('interest')
  })

  it('a snapshot from before v2.3433 keeps its old lines', () => {
    const text = buildDemandLetterText(FIELDS, '2026-09-02')
    expect(text).toContain('Initiating a small claims lawsuit')
    expect(text).toContain('late fees and interest may continue to accrue')
    expect(text).not.toContain('§ 38.001')
  })

  it('prefill sets the fee clock, the interest basis and the lien availability from the job', () => {
    const base = {
      job: { id: 'j', hcp_number: '867', job_name: 'x', job_address: '', last_work_date: '2026-06-28', payments: [], invoices: [] } as unknown as JobWithDetails,
      invoices: [],
      issuer: null,
      senderName: 'M',
      senderEmailFallback: '',
      recipient: { name: '', email: '', address: '' },
      priorNotices: [],
      propertyKind: 'non_residential',
      todayYmd: '2026-09-14',
    }
    const f = buildDemandLetterPrefill(base)
    expect(f.feeClockYmd).toBe('2026-10-14')
    expect(f.lienFilingDeadline).toBe('2026-10-15')
    expect(f.lienBlockedReason).toBe('')
    expect(f.includeLien).toBe(true)
    expect(f.interestBasis).toBe('none')
    expect(f.includeLateFees).toBe(false)
    const home = buildDemandLetterPrefill({ ...base, homestead: true })
    expect(home.includeLien).toBe(false)
    expect(home.lienBlockedReason).toContain('homestead')
    const closed = buildDemandLetterPrefill({ ...base, todayYmd: '2026-11-01' })
    expect(closed.lienBlockedReason).toBe('the filing window closed October 15, 2026')
  })
})

// ---------- v2.3515: what one bill has been paid, and whether the job has been paid at all ----------

describe('paymentsAppliedToInvoice (v2.3515)', () => {
  const inv = (id: string, amount: number, status = 'billed') => ({ id, amount, status, sequence_order: 0 }) as unknown as JobWithDetails['invoices'][number]
  const pay = (amount: number, invoice_id: string | null) => ({ amount, invoice_id }) as unknown as JobWithDetails['payments'][number]

  // Job 102: one $5,355 bill, one unlinked $3,000 check. The exhibit already read $2,355 due;
  // the letter around it said "Nothing has been paid" and demanded $5,355.
  it('on a job with exactly one sent bill, a job-level payment counts against it', () => {
    const job = { invoices: [inv('a', 5355)], payments: [pay(3000, null)] }
    expect(paymentsAppliedToInvoice(job, 'a')).toBe(3000)
  })

  it('a ready-to-bill draft is not a bill the customer could have paid, so it does not make the job multi-bill', () => {
    const job = { invoices: [inv('a', 5355), inv('draft', 900, 'ready_to_bill')], payments: [pay(3000, null)] }
    expect(paymentsAppliedToInvoice(job, 'a')).toBe(3000)
    expect(paymentsAppliedToInvoice(job, 'draft')).toBe(0)
  })

  // Job 258: three bills, the $8,000 check linked to seq 1, the letter covers seq 2.
  // Unlinked money on a multi-bill job is NOT smeared (the owner's rule is still open).
  it('on a multi-bill job, only payments linked to this bill count — never another bill\'s, never unlinked', () => {
    const job = { invoices: [inv('s0', 8900, 'paid'), inv('s1', 8000, 'paid'), inv('s2', 9800)], payments: [pay(8000, 's1'), pay(500, null)] }
    expect(paymentsAppliedToInvoice(job, 's2')).toBe(0)
    expect(paymentsAppliedToInvoice(job, 's1')).toBe(8000)
  })

  it('a single-bill job with several unlinked payments sums them, and a linked one adds', () => {
    const job = { invoices: [inv('a', 1000)], payments: [pay(100, null), pay(250, null), pay(50, 'a')] }
    expect(paymentsAppliedToInvoice(job, 'a')).toBe(400)
  })
})

describe('jobHasAnyPayment (v2.3515)', () => {
  const pay = (amount: number, invoice_id: string | null) => ({ amount, invoice_id }) as unknown as JobWithDetails['payments'][number]
  it('any positive payment on the job, linked to any bill or to none, defeats § 31.04', () => {
    expect(jobHasAnyPayment({ payments: [pay(8000, 'other-bill')] })).toBe(true)
    expect(jobHasAnyPayment({ payments: [pay(3000, null)] })).toBe(true)
  })
  it('no payments, or only zero rows, leaves it available', () => {
    expect(jobHasAnyPayment({ payments: [] })).toBe(false)
    expect(jobHasAnyPayment({ payments: [pay(0, null)] })).toBe(false)
  })
})

describe('prefill reads the same rule (v2.3515)', () => {
  const inv = (id: string, amount: number, billed: string, status = 'billed') =>
    ({ id, amount, billed_at: billed, created_at: billed, status, sequence_order: 0 }) as unknown as JobWithDetails['invoices'][number]
  const ctx = (job: JobWithDetails, invoices: JobWithDetails['invoices']) => ({
    job,
    invoices,
    sources: invoices.map((inv) => ({ inv, doc: null, stripe: null })),
    issuer: { companyName: 'Click Plumbing and Electrical', addressText: '', phone: '', email: '', tagline: '', licenseLine: '' },
    senderName: 'Malachi',
    senderEmailFallback: 'office@x.com',
    recipient: { name: 'Sam Coyle', email: 'sam@x.com', address: '' },
    priorNotices: [],
    propertyKind: 'residential',
    todayYmd: '2026-09-16',
  })

  it('job 102: the letter claims $2,355, the statement shows $3,000 paid, and the sentence says so', () => {
    const bill = inv('a', 5355, '2026-08-04T15:43:00Z')
    const job = { id: 'j102', hcp_number: '102', job_name: 'Samantha Coyle', last_work_date: null, payments: [{ invoice_id: null, amount: 3000 }], invoices: [bill] } as unknown as JobWithDetails
    const f = buildDemandLetterPrefill(ctx(job, [bill]))
    expect(f.paymentsReceived).toBe('3000.00')
    expect(f.outstanding).toBe('2355.00')
    expect(f.statement?.[0]?.paid).toBe('3000.00')
    expect(f.statement?.[0]?.balance).toBe('2355.00')
    expect(buildDemandLetterText(f, '2026-09-16')).toContain('$3,000.00 has been paid and $2,355.00 remains.')
  })

  it('job 258: a multi-bill job still claims the covered bill in full when its own payments are nil', () => {
    const s1 = inv('s1', 8000, '2026-05-20T10:00:00Z', 'paid')
    const s2 = inv('s2', 9800, '2026-08-20T15:58:00Z')
    const job = { id: 'j258', hcp_number: '258', job_name: 'Dudley Mason', last_work_date: '2026-08-11', payments: [{ invoice_id: 's1', amount: 8000 }], invoices: [inv('s0', 8900, '2026-04-01T10:00:00Z', 'paid'), s1, s2] } as unknown as JobWithDetails
    const f = buildDemandLetterPrefill(ctx(job, [s2]))
    expect(f.paymentsReceived).toBe('0.00')
    expect(f.outstanding).toBe('9800.00')
  })
})
