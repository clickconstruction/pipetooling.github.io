import { describe, expect, it } from 'vitest'
import { sampleCustomerPortalResponse, samplePortalMoneyRows } from '../../../supabase/functions/_shared/customerSampleFixtures'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { buildPortalBills, buildPortalSharedBills } from '../../../supabase/functions/_shared/portalMergedBills'
import { buildPortalWaivers } from '../../../supabase/functions/_shared/portalWaivers'
import { buildPortalChecks } from '../../../supabase/functions/_shared/portalChecks'
import { parsePortalPayload } from './portalPayload'
import type { SampleState } from '../../../supabase/functions/_shared/customerSample'

/**
 * The sample portals' money, through the builders a real portal runs (What customers see #103,
 * PR 2). Each sample's bills, shared bills, waivers, checks and balance are the builders' output
 * on the sample's own rows, called as `customer-portal` calls them, and the page reads them.
 */
const today = '2026-10-09'
const origin = 'https://app.example'
const answer = (state: SampleState) => sampleCustomerPortalResponse(PORTAL_COMPANY, state, today, origin)

/** The builders on the rows, called the way customer-portal calls them for a real viewer. */
function throughBuilders(state: SampleState) {
  const r = samplePortalMoneyRows(state, today, origin)
  const open = r.sentInvoices.filter((i) => i.status === 'billed' && r.jobs.some((j) => j.id === i.job_id && j.status !== 'paid'))
  const payments = r.payments.filter((p) => open.some((i) => i.job_id === p.job_id))
  const ownerNames = r.audience === 'all' ? Object.fromEntries(r.jobs.filter((j) => j.customer_id && j.customer_id !== r.viewerCustomerId && r.partyNames[j.customer_id]).map((j) => [j.customer_id!, r.partyNames[j.customer_id!]!])) : {}
  const bills = buildPortalBills({ jobs: r.jobs, invoices: open, payments, viewerCustomerId: r.viewerCustomerId, markGcRows: r.audience === 'all', ownerNames, sentBills: r.sentInvoices })
  return {
    bills,
    sharedBills: buildPortalSharedBills({ jobs: r.jobs, invoices: open, payments, viewerCustomerId: r.viewerCustomerId, partyNames: r.partyNames, sentBills: r.sentInvoices }),
    waivers: buildPortalWaivers({ jobs: r.jobs, invoices: r.sentInvoices, payments: r.payments, releases: r.releases, viewerCustomerId: r.viewerCustomerId }),
    checks: buildPortalChecks({ jobs: r.jobs, invoices: r.sentInvoices, payments: r.payments, events: r.events, viewerCustomerId: r.viewerCustomerId }),
    totalDue: Math.round(bills.reduce((s, b) => s + b.amount, 0) * 100) / 100,
  }
}

describe('the sample portals’ money, through the portal’s own builders (#103 PR 2)', () => {
  it.each(['live', 'done', 'gc', 'owner'] as const)('%s: every bill, shared bill, waiver, check and the balance is the builders’ output', (state) => {
    const a = answer(state)
    const k = throughBuilders(state)
    expect(a.bills).toEqual(k.bills)
    expect(a.sharedBills).toEqual(k.sharedBills)
    expect(a.checks).toEqual(k.checks)
    expect(a.totalDue).toBe(k.totalDue)
    // The page gets each waiver with its PDF signed into a link; a sample has no file behind it.
    expect(a.waivers).toEqual(k.waivers.map((w) => ({ ...w, conditional: { ...w.conditional, pdfUrl: null, pdfPath: null }, unconditional: { ...w.unconditional, pdfUrl: null, pdfPath: null } })))
  })

  it('the homeowner: a fresh bill and one partly paid by card, the same figures as the hand-written sample', () => {
    const k = throughBuilders('live')
    expect(k.bills.map((b) => [b.jobLabel, b.amount, b.totalPaid, b.checkRef, b.asGc])).toEqual([
      ['Water heater replacement · Job 1001', 4_380, 0, '1001', false],
      ['Kitchen faucet and disposal · Job 0994', 560, 640, '0994', false],
    ])
    expect(k.bills[1]!.payments).toEqual([{ date: '2026-09-08', method: 'card', amount: 640 }])
    expect(k.totalDue).toBe(4_940)
    expect(k.sharedBills).toEqual([])
    expect(k.waivers).toEqual([])
    expect(k.checks.jobs.flatMap((j) => j.payments.map((p) => p.amount))).toEqual([640])
  })

  it('the GC: its two bills, a scoped link that tags none as GC, the owner’s change order on the shared card only', () => {
    const k = throughBuilders('gc')
    expect(k.bills.map((b) => [b.jobLabel, b.amount, b.totalPaid, b.checkRef, b.asGc, b.ownerName])).toEqual([
      ['Cedar Bend Apartments · Job 1002', 18_200, 0, '1002', false, null],
      ['Hunter Road Studios · Job 0998', 2_560, 9_640, '0998', false, null],
    ])
    expect(k.bills[1]!.payments).toEqual([{ date: '2026-09-08', method: 'check #4398', amount: 9_640 }])
    expect(k.totalDue).toBe(20_760)
    expect(k.sharedBills.map((b) => [b.jobLabel, b.amount, b.billedTo, b.viewerRole])).toEqual([['Cedar Bend Apartments · Job 1002', 1_850, 'Cedar Bend Owner LLC', 'gc']])
  })

  it('the GC’s waivers: the place of each bill among the job’s sent bills, paid and final as the builder reads them', () => {
    const k = throughBuilders('gc')
    expect(k.waivers.map((w) => [w.jobLabel, w.billLabel, w.amount, w.paid, w.final, w.conditional.state, w.conditional.formType, w.unconditional.state])).toEqual([
      ['1002 · Cedar Bend Apartments', 'Bill 2 of 3', 18_200, false, false, 'signed', 'conditional_progress', 'none'],
      ['0998 · Hunter Road Studios', 'Bill', 12_200, false, true, 'sent', 'conditional_final', 'none'],
      ['1002 · Cedar Bend Apartments', 'Bill 1 of 3', 14_050, true, false, 'sent', 'conditional_progress', 'sent'],
    ])
    // The owner's change order is the owner's to pay: no waiver row for the GC.
    expect(k.waivers.some((w) => w.invoiceId === 'sample-inv-open-co')).toBe(false)
  })

  it('the GC’s checks: the two it wrote, and only its own bills', () => {
    const k = throughBuilders('gc')
    expect(k.checks.jobs.flatMap((j) => j.payments.map((p) => [p.reference_number, p.amount]))).toEqual([
      ['4417', 14_050],
      ['4398', 9_640],
    ])
    expect(k.checks.jobs.flatMap((j) => j.invoices.map((i) => i.id))).not.toContain('sample-inv-open-co')
  })

  it('the GC-mode owner: our pay application to pay, nothing paid yet', () => {
    const k = throughBuilders('owner')
    expect(k.bills.map((b) => [b.jobLabel, b.amount, b.checkRef])).toEqual([['Sample Retail Shell (GC) · Job 1010', 45_000, '1010']])
    expect(k.totalDue).toBe(45_000)
    expect(k.checks.jobs.map((j) => [j.invoices.length, j.payments.length])).toEqual([[1, 0]])
  })

  it('the page reads each sample: its shared bills and its checks parse', () => {
    const gc = parsePortalPayload(answer('gc'))!
    expect(gc.sharedBills.map((b) => b.amount)).toEqual([1_850])
    expect(gc.checks?.jobs.length).toBe(2)
    expect(gc.waivers.map((w) => w.billLabel)).toEqual(['Bill 2 of 3', 'Bill', 'Bill 1 of 3'])
    expect(parsePortalPayload(answer('live'))!.totalDue).toBe(4_940)
    expect(parsePortalPayload(answer('owner'))!.bills.length).toBe(1)
  })
})
