import { describe, expect, it } from 'vitest'
// Deno edge module (supabase/functions/_shared) — tested here.
import { PORTAL_CHECKS_VIEWER, buildPortalChecks } from '../../../supabase/functions/_shared/portalChecks'
import { buildGcChecksReport } from '../jobs/gcChecksApplied'

const V = 'viewer-1'

const job = (id: string, over: Record<string, unknown> = {}) => ({ id, hcp_number: null, click_number: id, job_name: `Job ${id}`, job_address: `${id} St`, customer_id: V, gc_customer_id: null, bill_to_party: null, lien_retainage_held: null, ...over })
const inv = (id: string, job_id: string, n: number, amount: number, over: Record<string, unknown> = {}) => ({ id, job_id, amount, status: 'billed', billed_at: `2026-0${n}-01T00:00:00Z`, sequence_order: n, ...over })
const pay = (id: string, job_id: string, invoice_id: string | null, amount: number, over: Record<string, unknown> = {}) => ({ id, job_id, invoice_id, amount, paid_on: '2026-09-24', payment_type: 'check', reference_number: '48211', ...over })

describe('buildPortalChecks', () => {
  it('keeps the viewer’s bills and their payments, stamped as the viewer’s, and the moves that name them', () => {
    const r = buildPortalChecks({
      jobs: [job('a'), job('b', { customer_id: 'owner', gc_customer_id: V, bill_to_party: 'gc' })],
      invoices: [inv('a1', 'a', 1, 500, { status: 'paid' }), inv('b1', 'b', 1, 900), inv('b-draft', 'b', 2, 100, { status: 'ready_to_bill' })],
      payments: [pay('p1', 'a', 'a1', 500), pay('p2', 'b', null, 400, { reference_number: null, payment_type: 'ach', paid_on: '2026-09-20', sent_on: '2026-09-18T00:00:00Z' })],
      events: [
        { id: 'e1', kind: 'moved', payment_id: 'p2', from_job_id: 'a', to_job_id: 'b', amount: 400, created_at: '2026-09-26T00:00:00Z' },
        { id: 'e2', kind: 'removed', payment_id: 'p1', from_job_id: 'a', to_job_id: null, amount: 500, created_at: '2026-09-27T00:00:00Z' },
      ],
      viewerCustomerId: V,
    })
    expect(r.jobs.map((j) => [j.id, j.customer_id, j.invoices.map((i) => i.id), j.payments.map((p) => p.id)])).toEqual([
      ['a', PORTAL_CHECKS_VIEWER, ['a1'], ['p1']],
      ['b', PORTAL_CHECKS_VIEWER, ['b1'], ['p2']],
    ])
    expect(r.jobs[1]!.payments[0]).toEqual({ id: 'p2', job_id: 'b', invoice_id: null, amount: 400, paid_on: '2026-09-20', sent_on: '2026-09-18', payment_type: 'ach', reference_number: null, sequence_order: null })
    expect(r.events).toEqual([{ id: 'e1', kind: 'moved', payment_id: 'p2', from_job_id: 'a', to_job_id: 'b', amount: 400, created_at: '2026-09-26T00:00:00Z' }])
    // The page's kernel reads the result as the viewer's.
    const report = buildGcChecksReport({ gcId: PORTAL_CHECKS_VIEWER, jobs: r.jobs, events: r.events })
    expect(report.checks.map((c) => [c.label, c.amount])).toEqual([
      ['#48211', 500],
      ['ACH', 400],
    ])
  })

  it('2026-10-02 · a bill’s day is its day in the company’s zone, so the page orders bills by it', () => {
    const billedOn = (billed_at: string | null) =>
      buildPortalChecks({ jobs: [job('a')], invoices: [inv('a1', 'a', 1, 500, { billed_at })], payments: [pay('p1', 'a', 'a1', 500)], events: [], viewerCustomerId: V }).jobs[0]!.invoices[0]!.billed_at
    expect(billedOn('2026-10-03T00:30:00Z')).toBe('2026-10-02')
    expect(billedOn('2026-12-02T00:30:00+00:00')).toBe('2026-12-01')
    expect(billedOn('2026-10-02T12:00:00Z')).toBe('2026-10-02')
    expect(billedOn(null)).toBeNull()
  })

  it('leaves out the other party’s bills, and an unlinked payment on a job the viewer only partly pays', () => {
    const r = buildPortalChecks({
      jobs: [job('s', { customer_id: 'owner', gc_customer_id: V, bill_to_party: 'customer' })],
      invoices: [inv('s1', 's', 1, 1000, { bill_to_party: 'gc' }), inv('s2', 's', 2, 2000)],
      payments: [pay('pa', 's', 's1', 1000), pay('pb', 's', 's2', 2000), pay('pc', 's', null, 300)],
      events: [],
      viewerCustomerId: V,
    })
    expect(r.jobs).toHaveLength(1)
    expect(r.jobs[0]!.invoices.map((i) => i.id)).toEqual(['s1'])
    expect(r.jobs[0]!.payments.map((p) => p.id)).toEqual(['pa'])
  })

  it('drops a job with nothing of the viewer’s, and keeps an unbilled job’s payment when the viewer would pay it', () => {
    const r = buildPortalChecks({
      jobs: [job('x', { customer_id: 'owner' }), job('y')],
      invoices: [inv('x1', 'x', 1, 50)],
      payments: [pay('px', 'x', 'x1', 50), pay('py', 'y', null, 75)],
      events: [],
      viewerCustomerId: V,
    })
    expect(r.jobs.map((j) => [j.id, j.payments.map((p) => p.id)])).toEqual([['y', ['py']]])
  })
})
