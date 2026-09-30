import { describe, expect, it } from 'vitest'
import {
  buildStatementModel,
  renderStatementByPropertyHtml,
  renderStatementByPropertyText,
  statementJobName,
  statementReceivedFromChecks,
  statementReceivedIntro,
  statementSentWords,
  statementYearOf,
  type StatementBillIn,
} from '../../../supabase/functions/_shared/gcStatementByProperty'
import { buildGcChecksReport } from '../../../supabase/functions/_shared/gcChecksApplied'

/** One open bill; every field a test does not name is the plain case. */
function bill(over: Partial<StatementBillIn> & Pick<StatementBillIn, 'key'>): StatementBillIn {
  return {
    jobId: `job-${over.key}`,
    jobNumber: over.key,
    jobName: '',
    jobAddress: '628 Terrell Rd, San Antonio, TX 78209',
    customerName: 'Dudley Mason',
    propertyId: null,
    sentYmd: '2026-08-18',
    sentIsEstimate: false,
    billed: 1000,
    owed: 1000,
    payments: [],
    ...over,
  }
}

const OPTS = { payerName: 'RMC- Dudley Mason', statementYear: 2026 }

describe('buildStatementModel — what counts as one property', () => {
  it('one address typed the same way is one block, with its own subtotal', () => {
    const m = buildStatementModel([bill({ key: '890', owed: 285, billed: 285 }), bill({ key: '867', owed: 1710, billed: 1710 })], OPTS)
    expect(m.properties).toHaveLength(1)
    expect(m.properties[0]).toMatchObject({ street: '628 Terrell Rd', city: 'San Antonio', owed: 1995 })
    expect(m.properties[0]!.bills.map((b) => b.job)).toEqual(['Job 867', 'Job 890'])
  })

  it('comma and ZIP variants of one address merge — the portal’s cleaned-address rule', () => {
    const m = buildStatementModel(
      [
        bill({ key: '1008', jobAddress: '1875 Co Rd 777, Devine, TX' }),
        bill({ key: '868', jobAddress: '1875 Co Rd 777, Devine, TX 78016' }),
        bill({ key: '881', jobAddress: '9703 Lenox Hl San Antonio, TX' }),
        bill({ key: '858', jobAddress: '9703 Lenox Hl, San Antonio, TX' }),
      ],
      OPTS,
    )
    expect(m.properties.map((p) => [p.street, p.city, p.bills.length])).toEqual([
      ['1875 Co Rd 777', 'Devine', 2],
      // The heading is the spelling that names a city, not the one that runs street and city together.
      ['9703 Lenox Hl', 'San Antonio', 2],
    ])
  })

  it('a different spelling joins the block only through the property record', () => {
    const hill = bill({ key: '1009', jobAddress: '9703 Lenox Hill, San Antonio, TX' })
    const hl = bill({ key: '273', jobAddress: '9703 Lenox Hl San Antonio, TX 78255' })
    expect(buildStatementModel([hill, hl], OPTS).properties).toHaveLength(2)
    const linked = buildStatementModel([{ ...hill, propertyId: 'prop-1' }, { ...hl, propertyId: 'prop-1' }], OPTS)
    expect(linked.properties).toHaveLength(1)
    expect(linked.properties[0]!.bills).toHaveLength(2)
  })

  it('an unlinked job joins a linked one that stands at its address', () => {
    const m = buildStatementModel(
      [
        bill({ key: '1009', jobAddress: '9703 Lenox Hill, San Antonio, TX', propertyId: 'prop-1' }),
        bill({ key: '273', jobAddress: '9703 Lenox Hl San Antonio, TX 78255', propertyId: 'prop-1' }),
        bill({ key: '858', jobAddress: '9703 Lenox Hl, San Antonio, TX', propertyId: null }),
      ],
      OPTS,
    )
    expect(m.properties).toHaveLength(1)
    expect(m.properties[0]!.bills).toHaveLength(3)
  })

  it('suites stay apart — the grouping is never fuzzy', () => {
    const m = buildStatementModel(
      [bill({ key: '1', jobAddress: '150 E Sonterra Blvd 200A, San Antonio, TX' }), bill({ key: '2', jobAddress: '150 E Sonterra Blvd 200B, San Antonio, TX' })],
      OPTS,
    )
    expect(m.properties).toHaveLength(2)
  })

  it('properties read A→Z; a job with no address stands alone, last, under its name', () => {
    const m = buildStatementModel(
      [
        bill({ key: '948', jobAddress: '', jobName: 'Water Heater', owed: 1200, billed: 1200 }),
        bill({ key: '186', jobAddress: '574 Co Rd 660, Devine TX 78016' }),
        bill({ key: '372', jobAddress: '1780 FM 1343, Castroville, TX 78009' }),
      ],
      OPTS,
    )
    expect(m.properties.map((p) => p.street)).toEqual(['1780 FM 1343', '574 Co Rd 660', 'Water Heater'])
    const last = m.properties[2]!
    expect(last.hasAddress).toBe(false)
    // The name is the heading; the line under it does not print it again.
    expect(last.bills[0]).toMatchObject({ job: 'Job 948', name: '' })
  })

  it('inside a property the oldest bill comes first', () => {
    const m = buildStatementModel(
      [bill({ key: 'c', sentYmd: '2026-08-24' }), bill({ key: 'a', sentYmd: '2026-07-15' }), bill({ key: 'b', sentYmd: null })],
      OPTS,
    )
    expect(m.properties[0]!.bills.map((b) => b.key)).toEqual(['a', 'c', 'b'])
  })
})

describe('statementJobName — the name only when it says something', () => {
  const ctx = { streets: ['628 Terrell Rd'], knownNames: ['RMC- Dudley Mason', 'Dudley Mason'] }
  it('drops a repeat of the GC’s or the customer’s own name', () => {
    expect(statementJobName('Dudley Mason', ctx)).toBe('')
    expect(statementJobName('dudley  mason', ctx)).toBe('')
    expect(statementJobName('RMC- Dudley Mason', ctx)).toBe('')
  })
  it('keeps a name that adds something', () => {
    expect(statementJobName('Trip Charges', ctx)).toBe('Trip Charges')
    expect(statementJobName('Dudley (Lennox)', ctx)).toBe('Dudley (Lennox)')
    expect(statementJobName('Lenox Check PU (reissued a bad check)', ctx)).toBe('Lenox Check PU (reissued a bad check)')
  })
  it('cuts the address and the HCP number off the end', () => {
    expect(statementJobName('Service Visit — 628 Terrell Rd (HCP 867)', ctx)).toBe('Service Visit')
    expect(statementJobName('Service Visit - 628 Terrell Rd', ctx)).toBe('Service Visit')
    expect(statementJobName('628 Terrell Rd', ctx)).toBe('')
    // A dash that does not lead into the address is part of the name.
    expect(statementJobName('Rough-in — Bldg 3', ctx)).toBe('Rough-in — Bldg 3')
  })
})

describe('statementSentWords', () => {
  it('is short inside the statement’s own year and carries the year otherwise', () => {
    expect(statementYearOf('Sep 30, 2026')).toBe(2026)
    expect(statementSentWords('2026-08-18', false, 2026)).toBe('Aug 18')
    expect(statementSentWords('2025-12-19', false, 2026)).toBe('Dec 19, 2025')
    expect(statementSentWords('2026-08-02', true, 2026)).toBe('Aug 2 (est.)')
    expect(statementSentWords(null, false, 2026)).toBe('—')
    expect(statementSentWords('2026-08-18', false, null)).toBe('Aug 18, 2026')
  })
})

describe('the line under a bill — paid and owed always add up to the bill', () => {
  const check = { invoice_id: 'b', amount: 5000, paid_on: '2026-09-08', payment_type: 'check', reference_number: '4417', sequence_order: 1 }

  it('names the payment recorded against the bill', () => {
    const m = buildStatementModel([bill({ key: 'b', billed: 14800, owed: 9800, payments: [check] })], OPTS)
    expect(m.properties[0]!.bills[0]).toMatchObject({ billed: 14800, paid: 5000, owed: 9800, paidWords: '$5,000.00 paid by #4417 on Sep 8, of $14,800.00 billed' })
    expect(m.summary).toBe('1 open bill at 1 property. $14,800.00 billed, $5,000.00 paid so far.')
  })

  it('a bill with nothing paid has no line, and the summary says only how many', () => {
    const m = buildStatementModel([bill({ key: 'a' }), bill({ key: 'b', jobAddress: '574 Co Rd 660, Devine, TX' })], OPTS)
    expect(m.properties.flatMap((p) => p.bills).every((b) => b.paidWords === '')).toBe(true)
    expect(m.summary).toBe('2 open bills at 2 properties.')
    expect(m).toMatchObject({ billed: 2000, paid: 0, owed: 2000 })
  })

  it('names no payment when the rows cannot account for what is paid', () => {
    const m = buildStatementModel([bill({ key: 'b', billed: 14800, owed: 9800, payments: [{ ...check, amount: 4000 }] })], OPTS)
    expect(m.properties[0]!.bills[0]!.paidWords).toBe('$5,000.00 paid so far, of $14,800.00 billed')
  })

  it('says when what is left is the retainage the GC holds', () => {
    const m = buildStatementModel([bill({ key: 'b', billed: 13333, owed: 1333, retainageHeld: 1333, payments: [{ ...check, amount: 12000 }] })], OPTS)
    expect(m.properties[0]!.bills[0]!.paidWords).toBe('$12,000.00 paid by #4417 on Sep 8, of $13,333.00 billed · what is left is the retainage you hold')
  })

  it('a job balance with no bill is what is owed plus what the job has been paid', () => {
    const m = buildStatementModel([bill({ key: 'shell', billed: null, owed: 3000, payments: [{ ...check, invoice_id: null, amount: 2000 }] })], OPTS)
    expect(m.properties[0]!.bills[0]).toMatchObject({ billed: 5000, paid: 2000, owed: 3000, paidWords: '$2,000.00 paid by #4417 on Sep 8, of $5,000.00 billed' })
  })

  it('a payment that is not on the row is not counted — the owed figure is the board’s', () => {
    // Job 273's case: money on the job that no bill carries. The row still reads owed in full.
    const m = buildStatementModel([bill({ key: '273', billed: 13420, owed: 13420, payments: [] })], OPTS)
    expect(m.properties[0]!.bills[0]).toMatchObject({ paid: 0, owed: 13420, paidWords: '' })
  })
})

describe('renderStatementByProperty', () => {
  const bills = [
    bill({ key: '890', sentYmd: '2026-07-15', billed: 285, owed: 285, jobName: 'Dudley Mason' }),
    bill({ key: '867', billed: 1710, owed: 1710, jobName: 'Service Visit — 628 Terrell Rd (HCP 867)' }),
    bill({ key: '372', jobAddress: '1780 FM 1343, Castroville, TX 78009', sentYmd: '2026-09-14', billed: 35200, owed: 17600, payments: [{ invoice_id: '372', amount: 17600, paid_on: '2026-09-22', payment_type: 'check', reference_number: '#4402', sequence_order: 1 }] }),
  ]
  const input = { payerName: 'RMC- Dudley Mason', dateStr: 'Sep 30, 2026', bills }

  it('HTML: the total first, a heading per property printed once, one line per bill', () => {
    const html = renderStatementByPropertyHtml(input)
    expect(html).toContain('Statement for RMC- Dudley Mason · Sep 30, 2026')
    expect(html).toContain('Owed now')
    expect(html).toContain('3 open bills at 2 properties. $37,195.00 billed, $17,600.00 paid so far.')
    expect(html.split('628 Terrell Rd').length - 1).toBe(1)
    expect(html).toContain('<strong>628 Terrell Rd</strong> <span style="font-size:12.5px;color:#5b6676">San Antonio · 2 open bills</span>')
    expect(html).toContain('<strong>1780 FM 1343</strong> <span style="font-size:12.5px;color:#5b6676">Castroville · 1 open bill</span>')
    expect(html).toContain('Job 867<span style="color:#5b6676"> · Service Visit</span>')
    expect(html).toContain('$17,600.00 paid by #4402 on Sep 22, of $35,200.00 billed')
    expect(html).not.toContain('Dudley Mason</span>')
    expect(html).not.toContain('nothing applied yet')
    expect(html.indexOf('Owed now')).toBeLessThan(html.indexOf('1780 FM 1343'))
    expect(html.indexOf('1780 FM 1343')).toBeLessThan(html.indexOf('628 Terrell Rd'))
    // The total is the rows' own sum.
    expect(html.split('$19,595.00').length - 1).toBe(2)
    // GC-facing: no internal pressure language.
    expect(html).not.toContain('days past')
    expect(html).not.toContain('Collections')
  })

  it('HTML: the account card carries the code, the address in words and the tagged link', () => {
    const html = renderStatementByPropertyHtml({ ...input, portalUrl: 'https://my.clickplumbing.com/rmc-dudley-mason', qrImgSrc: 'cid:portal-qr' })
    expect(html).toContain('Your account, any time')
    expect(html).toContain('<img src="cid:portal-qr" width="120" height="120"')
    expect(html).toContain('href="https://my.clickplumbing.com/rmc-dudley-mason?src=gc-statement"')
    expect(html).toContain('>my.clickplumbing.com/rmc-dudley-mason</a>')
    expect(html).toContain('Pay online and see every open bill and payment, with no login. Scan the code with your phone camera.')
    // Without a code the card still stands, and does not ask anyone to scan.
    const plain = renderStatementByPropertyHtml({ ...input, portalUrl: 'https://my.clickplumbing.com/rmc-dudley-mason' })
    expect(plain).toContain('>my.clickplumbing.com/rmc-dudley-mason</a>')
    expect(plain).not.toContain('<img')
    expect(plain).not.toContain('Scan the code')
    // No portal, no card.
    expect(renderStatementByPropertyHtml(input)).not.toContain('Your account, any time')
  })

  it('HTML: a token address is a link by name, and keeps its own query', () => {
    const html = renderStatementByPropertyHtml({ ...input, portalUrl: 'https://pipetooling.com/portal?t=abc' })
    expect(html).toContain('href="https://pipetooling.com/portal?t=abc&amp;src=gc-statement"')
    expect(html).toContain('>Open your statement</a>')
  })

  it('HTML escapes what the office typed', () => {
    const html = renderStatementByPropertyHtml({ payerName: 'A&B <Builders>', dateStr: 'Sep 30, 2026', bills: [bill({ key: '1', jobAddress: '', jobName: '<Spec House>' })], introText: 'Line <one>\nLine two' })
    expect(html).toContain('A&amp;B &lt;Builders&gt;')
    expect(html).toContain('<strong>&lt;Spec House&gt;</strong>')
    expect(html).not.toContain('<Spec House>')
    expect(html).toContain('Line &lt;one&gt;<br>Line two')
  })

  it('text: the same facts, a property at a time', () => {
    const text = renderStatementByPropertyText({ ...input, portalUrl: 'https://my.clickplumbing.com/rmc-dudley-mason', officePhone: '(210) 555-0100', introText: ' Hello. ' })
    expect(text).toBe(
      [
        'Hello.',
        '',
        'Click Plumbing and Electrical',
        'Statement for RMC- Dudley Mason · Sep 30, 2026',
        '',
        'Owed now: $19,595.00',
        '3 open bills at 2 properties. $37,195.00 billed, $17,600.00 paid so far.',
        '',
        '1780 FM 1343, Castroville — $17,600.00',
        '- Job 372 — sent Sep 14 — $17,600.00 ($17,600.00 paid by #4402 on Sep 22, of $35,200.00 billed)',
        '',
        '628 Terrell Rd, San Antonio — $1,995.00',
        '- Job 890 — sent Jul 15 — $285.00',
        '- Job 867 · Service Visit — sent Aug 18 — $1,710.00',
        '',
        'Total owed: $19,595.00',
        '',
        'Pay online any time at https://my.clickplumbing.com/rmc-dudley-mason?src=gc-statement — this statement stays current there.',
        '',
        'Questions about a bill? Reply to this email or call the office at (210) 555-0100.',
      ].join('\n'),
    )
  })

  it('a statement with no rows still renders a total', () => {
    const html = renderStatementByPropertyHtml({ payerName: 'X', dateStr: 'Sep 30, 2026', bills: [], officePhone: '(512) 360-0599' })
    expect(html).toContain('$0.00')
    expect(html).toContain('href="tel:+15123600599"')
    expect(html).not.toContain('open bill')
  })
})

describe('Payments we have received (v2.4260)', () => {
  const jobs = [
    {
      id: 'j372', hcp_number: '372', click_number: null, job_name: 'Dudley Mason', job_address: '1780 FM 1343, Castroville, TX 78009', customer_id: 'owner-1', gc_customer_id: 'gc', bill_to_party: 'gc',
      invoices: [{ id: 'i372', job_id: 'j372', sequence_order: 1, amount: 35200, status: 'billed', billed_at: '2026-09-14' }],
      payments: [{ id: 'p1', job_id: 'j372', invoice_id: 'i372', amount: 17600, paid_on: '2026-09-22', payment_type: 'check', reference_number: '4402', sequence_order: 1 }],
    },
    {
      // A job paid off in the window: the statement's own rows cannot see it, the block can.
      id: 'j868', hcp_number: '868', click_number: null, job_name: 'Service Visit', job_address: '1875 Co Rd 777, Devine, TX 78016', customer_id: 'owner-2', gc_customer_id: 'gc', bill_to_party: 'gc',
      invoices: [{ id: 'i868', job_id: 'j868', sequence_order: 1, amount: 1200, status: 'paid', billed_at: '2026-08-18' }],
      payments: [{ id: 'p2', job_id: 'j868', invoice_id: null, amount: 1200, paid_on: '2026-09-02', payment_type: 'check', reference_number: '4390', sequence_order: 1 }],
    },
    {
      // Older than the window, and one the owner pays — neither is the GC's business here.
      id: 'j900', hcp_number: '900', click_number: null, job_name: 'Old', job_address: '1 Old Rd, Devine, TX', customer_id: 'owner-3', gc_customer_id: 'gc', bill_to_party: 'customer',
      invoices: [{ id: 'i900', job_id: 'j900', sequence_order: 1, amount: 500, status: 'paid', billed_at: '2026-06-01' }],
      payments: [{ id: 'p3', job_id: 'j900', invoice_id: 'i900', amount: 500, paid_on: '2026-06-20', payment_type: 'check', reference_number: '4001', sequence_order: 1 }],
    },
  ]
  const report = buildGcChecksReport({ gcId: 'gc', jobs, sinceYmd: '2026-08-31' })
  const byJob = new Map(jobs.map((j) => [j.id, { address: j.job_address, number: j.hcp_number }]))
  const received = statementReceivedFromChecks(report.checks, byJob)

  it('lists every check the GC sent in the window, newest first, with where it landed', () => {
    expect(received).toEqual([
      { key: expect.any(String), onYmd: '2026-09-22', label: 'Check #4402', amount: 17600, where: ['1780 FM 1343 · Job 372'] },
      { key: expect.any(String), onYmd: '2026-09-02', label: 'Check #4390', amount: 1200, where: ['1875 Co Rd 777 · Job 868, now paid in full'] },
    ])
  })

  it('words the heading line for a list, one payment and none', () => {
    expect(statementReceivedIntro('2026-08-31', 2)).toBe('2 payments since Aug 31, 2026, newest first. If one you sent is missing, reply and we will find it.')
    expect(statementReceivedIntro('2026-08-31', 1)).toBe('One payment since Aug 31, 2026, newest first. If one you sent is missing, reply and we will find it.')
    expect(statementReceivedIntro('2026-08-31', 0)).toBe('No payments received since Aug 31, 2026. If you sent one, reply and we will find it.')
    expect(statementReceivedIntro(null, 0)).toBe('No payments received on record. If you sent one, reply and we will find it.')
  })

  const input = { payerName: 'RMC- Dudley Mason', dateStr: 'Sep 30, 2026', bills: [bill({ key: '372', billed: 35200, owed: 17600 })] }

  it('HTML: the block sits between the total and the account card, and only when the lane brought it', () => {
    const html = renderStatementByPropertyHtml({ ...input, received, receivedSinceYmd: '2026-08-31', portalUrl: 'https://my.clickplumbing.com/rmc' })
    expect(html).toContain('Payments we have received')
    expect(html).toContain('2 payments since Aug 31, 2026, newest first.')
    expect(html).toContain('Check #4402<span style="color:#5b6676"> to 1780 FM 1343 · Job 372</span>')
    expect(html).toContain('Check #4390<span style="color:#5b6676"> to 1875 Co Rd 777 · Job 868, now paid in full</span>')
    expect(html.indexOf('Total owed')).toBeLessThan(html.indexOf('Payments we have received'))
    expect(html.indexOf('Payments we have received')).toBeLessThan(html.indexOf('Your account, any time'))
    expect(renderStatementByPropertyHtml(input)).not.toContain('Payments we have received')
    const none = renderStatementByPropertyHtml({ ...input, received: [], receivedSinceYmd: '2026-08-31' })
    expect(none).toContain('No payments received since Aug 31, 2026. If you sent one, reply and we will find it.')
    expect(none).not.toContain('<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse">\n    </table>')
  })

  it('text: the same block', () => {
    const text = renderStatementByPropertyText({ ...input, received, receivedSinceYmd: '2026-08-31' })
    expect(text).toContain(
      ['Total owed: $17,600.00', '', 'Payments we have received', '2 payments since Aug 31, 2026, newest first. If one you sent is missing, reply and we will find it.', '- Sep 22 — Check #4402 to 1780 FM 1343 · Job 372 — $17,600.00', '- Sep 2 — Check #4390 to 1875 Co Rd 777 · Job 868, now paid in full — $1,200.00', ''].join('\n'),
    )
    expect(renderStatementByPropertyText(input)).not.toContain('Payments we have received')
  })
})
