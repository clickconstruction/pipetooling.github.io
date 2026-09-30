import { describe, expect, it } from 'vitest'
import {
  buildStatementModel,
  renderStatementByPropertyHtml,
  renderStatementByPropertyText,
  statementJobName,
  statementSentWords,
  statementYearOf,
  type StatementBillIn,
} from '../../../supabase/functions/_shared/gcStatementByProperty'

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
