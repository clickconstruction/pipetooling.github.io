import { describe, expect, it } from 'vitest'
import {
  buildGcReviewShareAllEmailHtml,
  buildGcReviewShareAllEmailText,
  buildGcStatementEmailHtml,
  buildGcStatementEmailPreviewHtml,
  buildGcStatementEmailText,
  gcReviewShareAllEmailSubject,
  gcStatementEmailSubject,
  gcStatementFooterLine,
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

  it('HTML leads with job address, bill-sent date, and amount owed, plus a total row', () => {
    const html = buildGcStatementEmailHtml(group(), { dateStr: 'Jul 31, 2026' })
    expect(html).toContain('Job address')
    expect(html).toContain('Bill sent')
    expect(html).toContain('Amount owed')
    expect(html).toContain('11915 Ring Dr, Manor TX')
    expect(html).toContain('Job 916 · SVP Manor')
    expect(html).toContain('Jul 21, 2026')
    expect(html).toContain('$450.00')
    expect(html).toContain('Total owed')
    // GC-facing: no internal pressure language
    expect(html).not.toContain('days past')
    expect(html).not.toContain('Collections')
  })

  it('falls back to job name when the address is blank — printed once (J20-F8) — and escapes HTML', () => {
    const g = group({
      gcName: 'A&B <Builders>',
      rows: [{ ...group().rows[0]!, jobAddress: '', jobName: '<Spec House>' }],
    })
    const html = buildGcStatementEmailHtml(g, { dateStr: 'Jul 31, 2026' })
    expect(html).toContain('A&amp;B &lt;Builders&gt;')
    expect(html.split('&lt;Spec House&gt;').length - 1).toBe(1)
    expect(html).toContain('&lt;Spec House&gt;<br /><span style="font-size:11px;color:#6b7280">Job 916</span>')
    expect(html).not.toContain('<Spec House>')
    const text = buildGcStatementEmailText(g, { dateStr: 'Jul 31, 2026' })
    expect(text).toContain('- <Spec House> (Job 916) — billed Jul 21, 2026 — $450.00')
  })

  it('plain-text variant carries the same facts', () => {
    const text = buildGcStatementEmailText(group(), { dateStr: 'Jul 31, 2026' })
    expect(text).toContain('Statement for Knight Contracting · Jul 31, 2026')
    expect(text).toContain('11915 Ring Dr, Manor TX')
    expect(text).toContain('billed Jul 21, 2026')
    expect(text).toContain('Total owed: $450.00')
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

describe('portal card (v2.2151)', () => {
  it('renders the card + text line only when a portal URL is given', async () => {
    const mod = await import('./gcStatementEmail')
    expect(mod.gcStatementPortalCardHtml(null)).toBe('')
    expect(mod.gcStatementPortalCardHtml('  ')).toBe('')
    const html = mod.gcStatementPortalCardHtml('https://my.clickplumbing.com/rmc-dudley-mason')
    expect(html).toContain('Your account, any time')
    // Journey-map #46: the card says how to pay, and the link carries the statement's attribution tag.
    expect(html).toContain('Pay online any time at <a href="https://my.clickplumbing.com/rmc-dudley-mason?src=gc-statement"')
    expect(html).toContain('my.clickplumbing.com/rmc-dudley-mason</a> — this statement stays current there.')
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
