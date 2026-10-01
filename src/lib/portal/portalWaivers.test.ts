import { describe, expect, it } from 'vitest'
// Deno edge module (supabase/functions/_shared) — tested here.
import { buildPortalWaivers, type PortalWaiverReleaseRow } from '../../../supabase/functions/_shared/portalWaivers'

const GC = 'gc-knight'
const job = (id: string, over: Record<string, unknown> = {}) => ({ id, hcp_number: id, click_number: null, job_name: `Job ${id}`, job_address: `${id} St`, customer_id: 'owner-1', gc_customer_id: GC, bill_to_party: 'gc', ...over })
const inv = (id: string, job_id: string, n: number, amount: number, over: Record<string, unknown> = {}) => ({ id, job_id, amount, status: 'billed', billed_at: `2026-09-0${n}T15:00:00Z`, sequence_order: n, ...over })
const rel = (id: string, job_id: string, form_type: string, invoice_ids: string[], over: Partial<PortalWaiverReleaseRow> = {}): PortalWaiverReleaseRow => ({ id, job_id, form_type, status: 'signed', invoice_ids, created_at: '2026-09-30T15:00:00Z', signed_at: '2026-09-30T16:00:00Z', sent_to_customer_at: null, signed_pdf_path: null, voided_at: null, ...over })

describe('buildPortalWaivers (v2.4278)', () => {
  it('one row per sent bill the viewer pays, under a GC: the conditional that came with it and the unconditional that follows', () => {
    const rows = buildPortalWaivers({
      jobs: [job('977')],
      invoices: [inv('a', '977', 1, 11240, { status: 'paid' }), inv('b', '977', 2, 15406), inv('c', '977', 3, 9354, { status: 'ready_to_bill' })],
      payments: [{ invoice_id: 'a', amount: 11240 }],
      releases: [
        rel('c1', '977', 'conditional_progress', ['a'], { sent_to_customer_at: '2026-08-12T10:00:00Z', signed_pdf_path: 'c1/signed.pdf', created_at: '2026-08-12T09:00:00Z' }),
        rel('u1', '977', 'unconditional_progress', ['a'], { sent_to_customer_at: '2026-09-06T10:00:00Z', signed_pdf_path: 'u1/signed.pdf', created_at: '2026-09-06T09:00:00Z' }),
        rel('c2', '977', 'conditional_progress', ['b'], { status: 'awaiting_signature', signed_at: null, created_at: '2026-09-30T15:00:00Z' }),
      ],
      viewerCustomerId: GC,
    })
    expect(rows.map((r) => [r.billLabel, r.amount, r.paid, r.final, r.conditional.state, r.unconditional.state])).toEqual([
      ['Bill 2 of 2', 15406, false, true, 'signing', 'none'],
      ['Bill 1 of 2', 11240, true, false, 'sent', 'sent'],
    ])
    expect(rows[1]!.conditional).toMatchObject({ ymd: '2026-08-12', pdfPath: 'c1/signed.pdf', releaseId: 'c1' })
    expect(rows[0]!.jobLabel).toBe('977 · Job 977')
  })
  it('a bill the viewer does not pay is not theirs; a homeowner job shows only bills that carry a waiver; voided rows do not count', () => {
    const rows = buildPortalWaivers({
      jobs: [job('977'), job('12', { gc_customer_id: null, bill_to_party: null, customer_id: GC })],
      invoices: [inv('a', '977', 1, 100, { bill_to_party: 'customer' }), inv('h1', '12', 1, 500), inv('h2', '12', 2, 700)],
      payments: [],
      releases: [rel('v', '977', 'conditional_progress', ['a'], { voided_at: '2026-09-30T00:00:00Z' }), rel('hc', '12', 'conditional_progress', ['h2'], { sent_to_customer_at: '2026-09-20T10:00:00Z' })],
      viewerCustomerId: GC,
    })
    expect(rows.map((r) => [r.jobId, r.invoiceId, r.conditional.state])).toEqual([['12', 'h2', 'sent']])
  })
  it('the newest, furthest-along row decides a half; a signed-not-sent conditional reads signed', () => {
    const rows = buildPortalWaivers({
      jobs: [job('977')],
      invoices: [inv('a', '977', 1, 100)],
      payments: [],
      releases: [rel('old', '977', 'conditional_progress', ['a'], { status: 'issued', signed_at: null, created_at: '2026-09-01T00:00:00Z' }), rel('new', '977', 'conditional_progress', ['a'], { signed_pdf_path: 'new/signed.pdf' })],
      viewerCustomerId: GC,
    })
    expect(rows[0]!.conditional).toMatchObject({ state: 'signed', releaseId: 'new', pdfPath: 'new/signed.pdf', ymd: '2026-09-30' })
  })
})
