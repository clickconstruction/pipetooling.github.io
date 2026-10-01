import { describe, expect, it } from 'vitest'
// Deno edge module (supabase/functions/_shared) — tested here.
import { buildPortalWaivers, type PortalWaiverReleaseRow } from '../../../supabase/functions/_shared/portalWaivers'

const GC = 'gc-knight'
const OWNER = 'owner-1'
const job = (id: string, over: Record<string, unknown> = {}) => ({ id, hcp_number: id, click_number: null, job_name: `Job ${id}`, job_address: `${id} St`, customer_id: OWNER, gc_customer_id: GC, bill_to_party: 'gc', ...over })
const inv = (id: string, job_id: string, n: number, amount: number, over: Record<string, unknown> = {}) => ({ id, job_id, amount, status: 'billed', billed_at: `2026-09-0${n}T15:00:00Z`, sequence_order: n, ...over })
const rel = (id: string, job_id: string, form_type: string, invoice_ids: string[], over: Partial<PortalWaiverReleaseRow> = {}): PortalWaiverReleaseRow => ({ id, job_id, form_type, status: 'signed', invoice_ids, created_at: '2026-09-30T15:00:00Z', signed_at: '2026-09-30T16:00:00Z', sent_to_customer_at: null, signed_pdf_path: null, voided_at: null, signer_printed_name: 'Malachi Whites', ...over })

describe('buildPortalWaivers (v2.4278, v2.4304)', () => {
  it('the payer sees a bill once a waiver on it is signed; a waiver still being signed shows nothing', () => {
    const rows = buildPortalWaivers({
      jobs: [job('977')],
      invoices: [inv('a', '977', 1, 11240, { status: 'paid' }), inv('b', '977', 2, 15406), inv('c', '977', 3, 9354, { status: 'ready_to_bill' })],
      payments: [{ invoice_id: 'a', amount: 11240 }],
      releases: [
        rel('c1', '977', 'conditional_progress', ['a'], { sent_to_customer_at: '2026-08-12T10:00:00Z', signed_pdf_path: 'c1/signed.pdf', created_at: '2026-08-12T09:00:00Z' }),
        rel('u1', '977', 'unconditional_progress', ['a'], { sent_to_customer_at: '2026-09-06T10:00:00Z', signed_pdf_path: 'u1/signed.pdf', created_at: '2026-09-06T09:00:00Z' }),
        rel('c2', '977', 'conditional_progress', ['b'], { status: 'awaiting_signature', signed_at: null }),
      ],
      viewerCustomerId: GC,
    })
    expect(rows.map((r) => [r.audience, r.billLabel, r.paid, r.conditional.state, r.unconditional.state])).toEqual([['payer', 'Bill 1 of 2', true, 'sent', 'sent']])
    expect(rows[0]!.conditional).toMatchObject({ ymd: '2026-08-12', pdfPath: 'c1/signed.pdf', releaseId: 'c1', formType: 'conditional_progress', signerName: 'Malachi Whites' })
    expect(rows[0]!.jobLabel).toBe('977 · Job 977')
  })

  it('signed but not emailed shows as signed, dated the day it was signed; the newest signed row decides', () => {
    const rows = buildPortalWaivers({
      jobs: [job('650')],
      invoices: [inv('a', '650', 1, 100)],
      payments: [],
      releases: [rel('old', '650', 'conditional_final', ['a'], { created_at: '2026-09-01T00:00:00Z', signer_printed_name: null }), rel('new', '650', 'conditional_final', ['a'], { signed_pdf_path: 'new/signed.pdf' })],
      viewerCustomerId: GC,
    })
    expect(rows[0]!.conditional).toMatchObject({ state: 'signed', releaseId: 'new', pdfPath: 'new/signed.pdf', ymd: '2026-09-30', formType: 'conditional_final' })
    expect(rows[0]!.final).toBe(true)
  })

  it('the owner sees the waivers on bills the office shared with them, open or paid; an unshared bill stays hidden', () => {
    const args = {
      jobs: [job('977')],
      invoices: [inv('a', '977', 1, 1000, { status: 'paid', shown_to_party: 'customer' }), inv('b', '977', 2, 2000, { shown_to_party: 'customer' }), inv('c', '977', 3, 3000)],
      payments: [{ invoice_id: 'a', amount: 1000 }],
      releases: [rel('u1', '977', 'unconditional_progress', ['a']), rel('c2', '977', 'conditional_progress', ['b']), rel('c3', '977', 'conditional_progress', ['c'])],
    }
    const owner = buildPortalWaivers({ ...args, viewerCustomerId: OWNER })
    expect(owner.map((r) => [r.audience, r.invoiceId, r.paid])).toEqual([
      ['owner', 'b', false],
      ['owner', 'a', true],
    ])
    // The GC pays all three, so the GC sees all three as its own.
    expect(buildPortalWaivers({ ...args, viewerCustomerId: GC }).map((r) => [r.audience, r.invoiceId])).toEqual([
      ['payer', 'c'],
      ['payer', 'b'],
      ['payer', 'a'],
    ])
  })

  it('a customer-paid bill shown to the GC gives the GC no waiver; a homeowner job with a signed waiver shows it to the homeowner; voided rows do not count', () => {
    const rows = buildPortalWaivers({
      jobs: [job('977'), job('12', { gc_customer_id: null, bill_to_party: null, customer_id: GC })],
      invoices: [inv('a', '977', 1, 100, { bill_to_party: 'customer', shown_to_party: 'gc' }), inv('h1', '12', 1, 500), inv('h2', '12', 2, 700)],
      payments: [],
      releases: [rel('c', '977', 'conditional_progress', ['a']), rel('v', '12', 'conditional_progress', ['h1'], { voided_at: '2026-09-30T00:00:00Z' }), rel('hc', '12', 'conditional_progress', ['h2'], { sent_to_customer_at: '2026-09-20T10:00:00Z' })],
      viewerCustomerId: GC,
    })
    expect(rows.map((r) => [r.audience, r.jobId, r.invoiceId, r.conditional.state])).toEqual([['payer', '12', 'h2', 'sent']])
  })
})
