import { describe, expect, it } from 'vitest'
import {
  buildGcReviewShareAllEmailHtml,
  buildGcReviewShareAllEmailText,
  buildGcStatementEmailHtml,
  buildGcStatementEmailText,
  gcStatementEmailSubject,
} from './gcStatementEmail'
import {
  gcStatementSubject,
  renderGcShareAllHtml,
  renderGcShareAllText,
  renderGcStatementHtml,
  renderGcStatementText,
  type GcStatementPayload,
  type GcStatementPayloadGroup,
} from '../../../supabase/functions/gc-statement-email-dispatch/render'
import type { GcReviewGroup } from '../gcReviewRollup'

/**
 * Journey-map #46: three lanes build the GC's statement — Draft Message
 * (client HTML + text, also what Copy for email pastes and what Preview
 * shows) and the scheduled dispatcher (render.ts from the RPC payload). They
 * are hand-mirrored files; this test is the seam that keeps them one email.
 */

const DATE = 'Sep 5, 2026'
const PHONE = '(512) 360-0599'
const PORTAL = 'https://my.clickplumbing.com/knight'
const INTRO = 'Hi there — here is where things stand this week.\nThanks for your business.'

/** The same three jobs in both shapes: address-led, address-less (name leads once), number-less. */
const clientGroup: GcReviewGroup = {
  key: 'gc-1',
  gcId: 'gc-1',
  gcName: 'Knight & Sons <Contracting>',
  isNoGc: false,
  jobCount: 3,
  subtotal: 5_650,
  oldestAgeDays: 45,
  rows: [
    { key: 'a', jobId: 'j1', hcp: '916', jobName: 'SVP Manor', jobAddress: '11915 Ring Dr, Manor TX', customerName: 'Knight', referenceDateDisplay: 'Jul 21, 2026', ageDays: 45, remaining: 450, inCollections: false },
    { key: 'b', jobId: 'j2', hcp: '948', jobName: 'Water Heater', jobAddress: '', customerName: 'Knight', referenceDateDisplay: 'Aug 2, 2026 (est.)', ageDays: 30, remaining: 1_200, inCollections: false },
    { key: 'c', jobId: 'j3', hcp: '—', jobName: 'Connect sink', jobAddress: '12803 El Dorado, Universal City TX', customerName: 'Knight', referenceDateDisplay: 'Aug 30, 2026', ageDays: 6, remaining: 4_000, inCollections: false },
  ],
}

const payloadGroup: GcStatementPayloadGroup = {
  entity_id: 'gc-1',
  entity_name: 'Knight & Sons <Contracting>',
  is_no_entity: false,
  job_count: 3,
  subtotal: 5_650,
  oldest_age_days: 45,
  rows: [
    { job_id: 'j1', display_number: '916', job_name: 'SVP Manor', job_address: '11915 Ring Dr, Manor TX', customer_name: 'Knight', ref_date: '2026-07-21', ref_is_estimate: false, age_days: 45, remaining: 450, in_collections: false },
    { job_id: 'j2', display_number: '948', job_name: 'Water Heater', job_address: null, customer_name: 'Knight', ref_date: '2026-08-02', ref_is_estimate: true, age_days: 30, remaining: 1_200, in_collections: false },
    { job_id: 'j3', display_number: null, job_name: 'Connect sink', job_address: '12803 El Dorado, Universal City TX', customer_name: 'Knight', ref_date: '2026-08-30', ref_is_estimate: false, age_days: 6, remaining: 4_000, in_collections: false },
  ],
}

const PAY_LINE_HTML = 'Pay online any time at <a href="https://my.clickplumbing.com/knight?src=gc-statement"'
const PAY_LINE_TEXT = 'Pay online any time at https://my.clickplumbing.com/knight?src=gc-statement — this statement stays current there.'

describe('GC statement — the client builders and the dispatcher render the same email', () => {
  it('HTML: Draft Message / Copy for email == scheduled dispatcher, intro + portal + phone', () => {
    const client = buildGcStatementEmailHtml(clientGroup, { dateStr: DATE, officePhone: PHONE, portalUrl: PORTAL, introText: INTRO })
    const server = renderGcStatementHtml(payloadGroup, DATE, PHONE, PORTAL, INTRO)
    expect(client).toBe(server)
  })

  it('text: the plain-text twins match too', () => {
    const client = buildGcStatementEmailText(clientGroup, { dateStr: DATE, officePhone: PHONE, portalUrl: PORTAL, introText: INTRO })
    const server = renderGcStatementText(payloadGroup, DATE, PHONE, PORTAL, INTRO)
    expect(client).toBe(server)
  })

  it('without intro or portal (the personal Copy lane) they still match', () => {
    expect(buildGcStatementEmailHtml(clientGroup, { dateStr: DATE, officePhone: null })).toBe(renderGcStatementHtml(payloadGroup, DATE, null, null, null))
    expect(buildGcStatementEmailText(clientGroup, { dateStr: DATE })).toBe(renderGcStatementText(payloadGroup, DATE))
  })

  it('subjects agree', () => {
    expect(gcStatementEmailSubject(clientGroup, DATE)).toBe(gcStatementSubject(DATE))
  })

  it('every lane carries exactly one pay line, tagged for attribution, and it is the same line', () => {
    const html = buildGcStatementEmailHtml(clientGroup, { dateStr: DATE, portalUrl: PORTAL })
    const text = buildGcStatementEmailText(clientGroup, { dateStr: DATE, portalUrl: PORTAL })
    const serverHtml = renderGcStatementHtml(payloadGroup, DATE, null, PORTAL)
    const serverText = renderGcStatementText(payloadGroup, DATE, null, PORTAL)
    for (const h of [html, serverHtml]) {
      expect(h.split(PAY_LINE_HTML).length - 1).toBe(1)
      expect(h).toContain('my.clickplumbing.com/knight</a> — this statement stays current there.')
      expect(h).not.toContain('This statement stays current at')
    }
    for (const t of [text, serverText]) {
      expect(t.split(PAY_LINE_TEXT).length - 1).toBe(1)
    }
    // A token-style portal URL keeps its own query and appends the tag.
    const tokenHtml = buildGcStatementEmailHtml(clientGroup, { dateStr: DATE, portalUrl: 'https://pipetooling.com/portal?t=abc' })
    expect(tokenHtml).toContain('href="https://pipetooling.com/portal?t=abc&amp;src=gc-statement"')
    expect(tokenHtml).toContain('>pipetooling.com/portal?t=abc</a>')
  })

  it('no portal → no pay line anywhere; the footer still says how to reach the office', () => {
    for (const body of [
      buildGcStatementEmailHtml(clientGroup, { dateStr: DATE, officePhone: PHONE }),
      buildGcStatementEmailText(clientGroup, { dateStr: DATE, officePhone: PHONE }),
      renderGcStatementHtml(payloadGroup, DATE, PHONE, null),
      renderGcStatementText(payloadGroup, DATE, PHONE, null),
    ]) {
      expect(body).not.toContain('Pay online')
      expect(body).toContain('call the office at')
    }
  })

  it('address-less job prints its name once (J20-F8), in both lanes', () => {
    for (const body of [buildGcStatementEmailHtml(clientGroup, { dateStr: DATE }), renderGcStatementHtml(payloadGroup, DATE)]) {
      expect(body.split('Water Heater').length - 1).toBe(1)
      expect(body).toContain('Water Heater<br /><span style="font-size:11px;color:#6b7280">Job 948</span>')
      // Address-led rows keep the name on the sub-line; a number-less row drops "Job —".
      expect(body).toContain('Job 916 · SVP Manor')
      expect(body).toContain('12803 El Dorado, Universal City TX<br /><span style="font-size:11px;color:#6b7280">Connect sink</span>')
      expect(body).not.toContain('Job —')
    }
    for (const body of [buildGcStatementEmailText(clientGroup, { dateStr: DATE }), renderGcStatementText(payloadGroup, DATE)]) {
      expect(body).toContain('- Water Heater (Job 948) — billed Aug 2, 2026 (est.) — $1,200.00')
      expect(body).toContain('- 12803 El Dorado, Universal City TX (Connect sink) — billed Aug 30, 2026 — $4,000.00')
    }
  })

  it('the intro sits inside the statement, escaped, with line breaks', () => {
    const html = buildGcStatementEmailHtml(clientGroup, { dateStr: DATE, introText: 'Line <one>\nLine two' })
    expect(html).toContain('<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px">\n  <p style="margin:0 0 12px;font-size:14px;color:#111827;line-height:1.45">Line &lt;one&gt;<br>Line two</p>')
    const text = buildGcStatementEmailText(clientGroup, { dateStr: DATE, introText: ' Line one ' })
    expect(text.startsWith('Line one\n\nClick Plumbing and Electrical\n')).toBe(true)
    // Blank intro → no paragraph at all.
    expect(buildGcStatementEmailHtml(clientGroup, { dateStr: DATE, introText: '  ' })).toBe(buildGcStatementEmailHtml(clientGroup, { dateStr: DATE }))
  })

  it('whole-report (Share all) twins match as well', () => {
    const payload: GcStatementPayload = { generated_at: '2026-09-05T12:00:00Z', group_by: 'gc', include_collections: true, grand_total: 5_650, groups: [payloadGroup] }
    const report = { groups: [clientGroup], grandTotal: 5_650 }
    expect(buildGcReviewShareAllEmailHtml(report, { dateStr: DATE, groupBy: 'gc', officePhone: PHONE, introText: INTRO })).toBe(renderGcShareAllHtml(payload, DATE, PHONE, INTRO))
    expect(buildGcReviewShareAllEmailText(report, { dateStr: DATE, groupBy: 'gc', officePhone: PHONE, introText: INTRO })).toBe(renderGcShareAllText(payload, DATE, PHONE, INTRO))
  })
})
