import { describe, expect, it } from 'vitest'
import {
  buildGcReviewShareAllEmailHtml,
  buildGcReviewShareAllEmailText,
  buildGcStatementEmailHtml,
  buildGcStatementEmailPreviewHtml,
  buildGcStatementEmailText,
  GC_STATEMENT_QR_CID_SRC,
  gcReviewShareAllEmailSubject,
  gcStatementBillsOf,
  gcStatementEmailSubject,
  gcStatementFooterLine,
  gcStatementQrDataUrl,
  gcStatementReceived,
  gcStatementUnmatchedPayments,
  gcStatementUnmatchedWords,
} from './gcStatementEmail'
import type { GcReviewGroup } from '../gcReviewRollup'

function group(over: Partial<GcReviewGroup> = {}): GcReviewGroup {
  return {
    key: 'gc-1',
    gcId: 'gc-1',
    gcName: 'Knight Contracting',
    isNoGc: false,
    rows: [
      {
        key: 'i1',
        jobId: 'j1',
        hcp: '916',
        jobName: 'SVP Manor',
        jobAddress: '11915 Ring Dr, Manor TX',
        customerName: 'Knight Contracting',
        referenceDateDisplay: 'Jul 21, 2026',
        referenceYmd: '2026-07-21',
        ageDays: 10,
        remaining: 450,
        inCollections: false,
      },
    ],
    subtotal: 450,
    jobCount: 1,
    oldestAgeDays: 10,
    ...over,
  }
}

describe('gcStatementEmail', () => {
  it('subject names the company and date, not the GC (works pasted to any recipient)', () => {
    expect(gcStatementEmailSubject(group(), 'Jul 31, 2026')).toBe('Click Plumbing open balances: Jul 31, 2026')
  })

  it('HTML leads with what is owed, then the property, the bill, the day it was sent and the amount', () => {
    const html = buildGcStatementEmailHtml(group(), { dateStr: 'Jul 31, 2026' })
    expect(html).toContain('Statement for Knight Contracting · Jul 31, 2026')
    expect(html).toContain('Owed now')
    expect(html).toContain('1 open bill at 1 property.')
    expect(html).toContain('<strong>11915 Ring Dr</strong>')
    expect(html).toContain('Manor · 1 open bill')
    expect(html).toContain('Job 916<span style="color:#5b6676"> · SVP Manor</span>')
    expect(html).toContain('Jul 21')
    expect(html).toContain('$450.00')
    expect(html).toContain('Total owed')
    // GC-facing: no internal pressure language
    expect(html).not.toContain('days past')
    expect(html).not.toContain('Collections')
  })

  it('a job with no address is headed by its name — printed once (J20-F8) — and escapes HTML', () => {
    const g = group({
      gcName: 'A&B <Builders>',
      rows: [{ ...group().rows[0]!, jobAddress: '', jobName: '<Spec House>' }],
    })
    const html = buildGcStatementEmailHtml(g, { dateStr: 'Jul 31, 2026' })
    expect(html).toContain('A&amp;B &lt;Builders&gt;')
    expect(html.split('&lt;Spec House&gt;').length - 1).toBe(1)
    expect(html).toContain('<strong>&lt;Spec House&gt;</strong>')
    expect(html).not.toContain('<Spec House>')
    const text = buildGcStatementEmailText(g, { dateStr: 'Jul 31, 2026' })
    expect(text).toContain('<Spec House> — $450.00\n- Job 916 — sent Jul 21 — $450.00')
  })

  it('plain-text variant carries the same facts', () => {
    const text = buildGcStatementEmailText(group(), { dateStr: 'Jul 31, 2026' })
    expect(text).toContain('Statement for Knight Contracting · Jul 31, 2026')
    expect(text).toContain('11915 Ring Dr, Manor — $450.00')
    expect(text).toContain('- Job 916 · SVP Manor — sent Jul 21 — $450.00')
    expect(text).toContain('Total owed: $450.00')
  })

  it('a row carries its bill and the payments on it; one built without them reads owed in full', () => {
    const paid = group({
      rows: [{ ...group().rows[0]!, remaining: 450, billed: 1450, propertyId: 'prop-9', billPayments: [{ invoice_id: 'i1', amount: 1000, paid_on: '2026-07-28', payment_type: 'check', reference_number: '4821', sequence_order: 1 }] }],
    })
    expect(gcStatementBillsOf(paid)[0]).toMatchObject({ key: 'i1', jobNumber: '916', propertyId: 'prop-9', sentYmd: '2026-07-21', billed: 1450, owed: 450 })
    expect(buildGcStatementEmailHtml(paid, { dateStr: 'Jul 31, 2026' })).toContain('$1,000.00 paid by #4821 on Jul 28, of $1,450.00 billed')
    expect(gcStatementBillsOf(group())[0]).toMatchObject({ billed: 450, owed: 450, payments: [] })
    expect(buildGcStatementEmailHtml(group(), { dateStr: 'Jul 31, 2026' })).not.toContain('paid')
  })
})

describe('money on the job that no bill carries — the office is told before it sends', () => {
  it('lists each such job once, largest first, and words one sentence', () => {
    const row = group().rows[0]!
    const g = group({
      rows: [
        { ...row, key: 'a', jobId: 'j273', hcp: '273', unmatchedOnJob: 38780 },
        { ...row, key: 'b', jobId: 'j273', hcp: '273', unmatchedOnJob: 38780 },
        { ...row, key: 'c', jobId: 'j881', hcp: '881', unmatchedOnJob: 500 },
        { ...row, key: 'd', jobId: 'j900', hcp: '900', unmatchedOnJob: 0 },
      ],
    })
    expect(gcStatementUnmatchedPayments(g)).toEqual([
      { jobId: 'j273', hcp: '273', amount: 38780 },
      { jobId: 'j881', hcp: '881', amount: 500 },
    ])
    expect(gcStatementUnmatchedWords(g)).toBe(
      'Paid on the job with no bill picked: Job 273 $38,780.00 · Job 881 $500.00. The statement counts it as the portal does, first for the work on no bill, then for the oldest bills. To put it on a different bill, pick the bill in Edit Job → Payments.',
    )
    expect(gcStatementUnmatchedWords(group())).toBe('')
  })
})

describe('gcReviewShareAllEmail', () => {
  const second = group({
    key: 'gc-2',
    gcId: 'gc-2',
    gcName: 'H & I Construction',
    rows: [
      {
        ...group().rows[0]!,
        key: 'i2',
        jobId: 'j2',
        hcp: '948',
        jobName: 'Connect sink',
        jobAddress: '12803 El Dorado, Universal City TX',
        remaining: 1200,
      },
    ],
    subtotal: 1200,
  })
  const report = { groups: [group(), second], grandTotal: 1650 }

  it('subject names the scope, company and date', () => {
    expect(gcReviewShareAllEmailSubject('gc', 'Aug 6, 2026')).toBe(
      'Open balances (all GCs) — Click Plumbing and Electrical — Aug 6, 2026',
    )
    expect(gcReviewShareAllEmailSubject('development', 'Aug 6, 2026')).toBe(
      'Open balances (all developments) — Click Plumbing and Electrical — Aug 6, 2026',
    )
  })

  it('HTML renders every group as its own section plus one grand total', () => {
    const html = buildGcReviewShareAllEmailHtml(report, { dateStr: 'Aug 6, 2026' })
    expect(html).toContain('Open balances by GC · Aug 6, 2026')
    expect(html).toContain('Knight Contracting')
    expect(html).toContain('H &amp; I Construction')
    expect(html).toContain('11915 Ring Dr, Manor TX')
    expect(html).toContain('12803 El Dorado, Universal City TX')
    expect(html).toContain('$450.00')
    expect(html).toContain('$1,200.00')
    expect(html).toContain('Total owed')
    expect(html).toContain('$1,650.00')
    // Recipient-safe: same vocabulary as the per-GC statement
    expect(html).not.toContain('days past')
    expect(html).not.toContain('Collections')
  })

  it('development grouping relabels the header scope', () => {
    const html = buildGcReviewShareAllEmailHtml(report, { dateStr: 'Aug 6, 2026', groupBy: 'development' })
    expect(html).toContain('Open balances by development · Aug 6, 2026')
  })

  it('plain-text variant lists each section and the grand total', () => {
    const text = buildGcReviewShareAllEmailText(report, { dateStr: 'Aug 6, 2026' })
    expect(text).toContain('Open balances by GC · Aug 6, 2026')
    expect(text).toContain('Knight Contracting · 1 job · $450.00')
    expect(text).toContain('H & I Construction · 1 job · $1,200.00')
    expect(text).toContain('Total owed: $1,650.00')
  })
})

describe('buildGcStatementEmailPreviewHtml', () => {
  it('wraps the exact email body in a standalone document headed by the subject', () => {
    const g = group()
    const html = buildGcStatementEmailPreviewHtml(g, 'Open balances — Aug 21, 2026', { dateStr: 'Aug 21, 2026' })
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('Preview — what the recipient sees')
    expect(html).toContain('<strong>Subject:</strong> Open balances — Aug 21, 2026')
    expect(html).toContain(buildGcStatementEmailHtml(g, { dateStr: 'Aug 21, 2026' }))
  })

  it('escapes the subject and GC name', () => {
    const html = buildGcStatementEmailPreviewHtml(group({ gcName: 'A & B <Builders>' }), 'Re: <script>', {})
    expect(html).not.toContain('<script>')
    expect(html).toContain('A &amp; B &lt;Builders&gt;')
  })

  it('draws the QR code itself — a browser cannot load the cid a real send carries', () => {
    const portalUrl = 'https://my.clickplumbing.com/rmc-dudley-mason'
    const dataUrl = gcStatementQrDataUrl(portalUrl)
    expect(dataUrl).toMatch(/^data:image\/png;base64,/)
    const html = buildGcStatementEmailPreviewHtml(group(), 'Subject', { dateStr: 'Aug 21, 2026', portalUrl })
    expect(html).toContain(`<img src="${dataUrl}"`)
    expect(html).not.toContain(GC_STATEMENT_QR_CID_SRC)
    // No portal, no code; and the builder itself draws no code unless handed one (Copy for email).
    expect(gcStatementQrDataUrl(null)).toBeNull()
    expect(buildGcStatementEmailHtml(group(), { dateStr: 'Aug 21, 2026', portalUrl })).not.toContain('<img')
    expect(buildGcStatementEmailHtml(group(), { dateStr: 'Aug 21, 2026', portalUrl, qrImgSrc: GC_STATEMENT_QR_CID_SRC })).toContain('<img src="cid:portal-qr"')
  })
})

describe('gcStatementFooterLine (v2.2133)', () => {
  it('names the office number from Settings when configured', () => {
    expect(gcStatementFooterLine('(210) 555-0100')).toBe('Questions about a bill? Reply to this email or call the office at (210) 555-0100.')
    // HTML links the number as tap-to-call (v2.2158); text stays plain.
    expect(buildGcStatementEmailHtml(group(), { dateStr: 'Jul 31, 2026', officePhone: ' 210-555-0100 ' })).toContain('call the office at <a href="tel:+12105550100"')
    expect(buildGcStatementEmailText(group(), { dateStr: 'Jul 31, 2026', officePhone: '210-555-0100' })).toContain('call the office at 210-555-0100.')
  })
  it('falls back to the bare line when no number is set', () => {
    expect(gcStatementFooterLine('')).toBe('Questions about a bill? Reply to this email or call the office.')
    expect(gcStatementFooterLine(null)).toBe('Questions about a bill? Reply to this email or call the office.')
    expect(buildGcStatementEmailHtml(group(), { dateStr: 'Jul 31, 2026' })).toContain('call the office.')
  })
})

describe('account card (v2.2151; the shared card since v2.4255)', () => {
  it('stands only when a portal URL is given, says how to pay, and its link carries the statement’s tag', async () => {
    const mod = await import('./gcStatementEmail')
    const without = mod.buildGcStatementEmailHtml(group(), { dateStr: 'Jul 31, 2026' })
    expect(without).not.toContain('Your account, any time')
    const html = mod.buildGcStatementEmailHtml(group(), { dateStr: 'Jul 31, 2026', portalUrl: 'https://my.clickplumbing.com/rmc-dudley-mason' })
    expect(html).toContain('Your account, any time')
    // Journey-map #46: the card says how to pay, and the link carries the statement's attribution tag.
    expect(html).toContain('<a href="https://my.clickplumbing.com/rmc-dudley-mason?src=gc-statement"')
    expect(html).toContain('>my.clickplumbing.com/rmc-dudley-mason</a>')
    expect(html).toContain('Pay online and see every open bill and payment, with no login.')
    expect(mod.gcStatementPayLineText('https://x/y')).toBe('Pay online any time at https://x/y?src=gc-statement — this statement stays current there.')
    expect(mod.gcStatementPayLineText(null)).toBeNull()
    expect(mod.gcStatementPayUrl('https://pipetooling.com/portal?t=abc')).toBe('https://pipetooling.com/portal?t=abc&src=gc-statement')
  })
})

describe('gcStatementFooterHtml (v2.2158)', () => {
  it('links the office number as tel: (US 10-digit → +1)', async () => {
    const mod = await import('./gcStatementEmail')
    expect(mod.officePhoneTelHref('(512) 360-0599')).toBe('tel:+15123600599')
    expect(mod.officePhoneTelHref('1 (512) 360-0599')).toBe('tel:+15123600599')
    expect(mod.officePhoneTelHref('+44 20 7946 0958')).toBe('tel:+442079460958')
    expect(mod.officePhoneTelHref('')).toBeNull()
    const html = mod.gcStatementFooterHtml('(512) 360-0599')
    expect(html).toContain('<a href="tel:+15123600599"')
    expect(html).toContain('>(512) 360-0599</a>.')
    expect(mod.gcStatementFooterHtml(null)).toBe('Questions about a bill? Reply to this email or call the office.')
    expect(mod.buildGcStatementEmailHtml({ key: 'k', gcId: 'g', gcName: 'X', isNoGc: false, rows: [], subtotal: 0, jobCount: 0, oldestAgeDays: null }, { officePhone: '(512) 360-0599' })).toContain('href="tel:+15123600599"')
  })
})

describe('gcStatementReceived — the payments block from the rows Find a check reads', () => {
  it('counts back 30 days from today and names where each check landed', () => {
    const inputs = {
      jobs: [
        {
          id: 'j1', hcp_number: '916', click_number: null, job_name: 'SVP Manor', job_address: '11915 Ring Dr, Manor TX', customer_id: 'o1', gc_customer_id: 'gc-1', bill_to_party: 'gc',
          invoices: [{ id: 'i1', job_id: 'j1', sequence_order: 1, amount: 1450, status: 'billed', billed_at: '2026-07-21' }],
          payments: [
            { id: 'p1', job_id: 'j1', invoice_id: 'i1', amount: 1000, paid_on: '2026-08-15', payment_type: 'check', reference_number: '4821', sequence_order: 1 },
            { id: 'p0', job_id: 'j1', invoice_id: null, amount: 200, paid_on: '2026-07-01', payment_type: 'check', reference_number: '4700', sequence_order: 0 },
          ],
        },
      ],
      events: [],
      deposits: [],
    }
    const out = gcStatementReceived(inputs, 'gc-1', '2026-09-05')
    expect(out.receivedSinceYmd).toBe('2026-08-06')
    expect(out.received).toEqual([{ key: expect.any(String), onYmd: '2026-08-15', label: 'Check #4821', amount: 1000, where: ['11915 Ring Dr · Job 916'] }])
    expect(buildGcStatementEmailHtml(group(), { dateStr: 'Sep 5, 2026', ...out })).toContain('One payment since Aug 6, 2026, newest first.')
  })
})
