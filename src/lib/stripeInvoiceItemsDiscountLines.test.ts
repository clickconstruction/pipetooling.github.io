/**
 * Discount lines on bills (v2.3252+ PR 3): the shared Stripe composer, its
 * client scoping mirror, and the physical (PDF) presentation all print a
 * discount as its own negative line on the bills of the work it follows, and
 * read every work row NET of its shares everywhere else.
 */
import { describe, expect, it } from 'vitest'
import {
  buildStripeInvoiceItemsFromFixtures,
  scopeFixturesToInvoice,
  type JobFixtureForStripe,
} from '../../supabase/functions/_shared/stripeInvoiceItemsFromFixtures'
import { fixturesForInvoiceBill } from './invoiceScopedFixtures'
import { discountServiceLinesForFixtures, resolvePhysicalInvoiceLinePresentation } from './physicalInvoiceLineItems'
import { physicalPreviewRowsAreDbBacked } from './billCustomerPreviewLineRefs'
import type { Database } from '../types/database'

type Row = Database['public']['Tables']['jobs_ledger_fixtures']['Row']

/** Job 892 with a 10% negotiated discount over all three stages. */
const row = (o: Partial<Row> & { id: string; sequence_order: number }): Row => ({
  job_id: 'job',
  bill_to_party: null,
  name: 'Rough In',
  count: 1,
  line_unit_price: 15098,
  line_description: null,
  invoice_id: null,
  created_at: null,
  progress_at: null,
  progress_by: null,
  progress_pct: null,
  progress_report_id: null,
  shared_with_gc: false,
  stage_kind: 'order',
  line_kind: 'work',
  discount_pct: null,
  discount_basis_positions: null,
  discount_reason: null,
  ...o,
})
const job892 = (): Row[] => [
  row({ id: 'a', sequence_order: 0 }),
  row({ id: 'b', sequence_order: 1, name: 'Top Out' }),
  row({ id: 'c', sequence_order: 2, name: 'Trim Set', line_unit_price: 7549 }),
  row({ id: 'd', sequence_order: 3, name: 'Negotiated discount', line_kind: 'discount', discount_pct: 10, line_unit_price: -3774.5, stage_kind: null, discount_reason: 'Negotiated' }),
]
const asStripe = (rows: Row[]): JobFixtureForStripe[] =>
  rows.map((r) => ({
    id: r.id,
    name: r.name,
    count: r.count,
    line_unit_price: r.line_unit_price,
    line_description: r.line_description,
    sequence_order: r.sequence_order,
    invoice_id: r.invoice_id,
    line_kind: r.line_kind,
    discount_pct: r.discount_pct,
    discount_basis_positions: r.discount_basis_positions,
  }))
const build = (fixtures: JobFixtureForStripe[], all: JobFixtureForStripe[], targetAmountCents: number) =>
  buildStripeInvoiceItemsFromFixtures({ fixtures, allFixtures: all, targetAmountCents, customerName: 'Megan', jobName: 'Megan Connell', hcpNumber: '892' })

describe('Stripe composer — a draw that bills one stage', () => {
  it('prints the stage at its real price and the discount share as a negative line, summing to the draw', () => {
    const all = asStripe(job892().map((r) => (r.id === 'a' ? { ...r, invoice_id: 'inv-1' } : r)))
    const scoped = scopeFixturesToInvoice(all, 'inv-1')
    expect(scoped.map((r) => r.id)).toEqual(['a'])
    const built = build(scoped, all, 1358820)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.items).toEqual([
      { amount: 1509800, description: 'Rough In', source: { kind: 'fixture', jobs_ledger_fixture_id: 'a' } },
      { amount: -150980, description: 'Negotiated discount (10%)', source: { kind: 'discount', jobs_ledger_fixture_id: 'd' } },
    ])
    expect(built.items.reduce((s, i) => s + i.amount, 0)).toBe(1358820)
  })
  it('the three draws together print the whole discount exactly once', () => {
    const all = asStripe(job892())
    const shares = ['a', 'b', 'c'].map((id) => {
      const scoped = all.filter((r) => r.id === id)
      const target = Math.round(Number(scoped[0]!.line_unit_price) * 100) - (id === 'c' ? 75490 : 150980)
      const built = build(scoped, all, target)
      if (!built.ok) throw new Error(built.error)
      return built.items.find((i) => i.source?.kind === 'discount')!.amount
    })
    expect(shares.reduce((s, c) => s + c, 0)).toBe(-377450)
  })
  it('a target that is not the net work (a payment took a bite) prorates over NET cents with no discount line', () => {
    const all = asStripe(job892())
    const scoped = all.filter((r) => r.id === 'a')
    const built = build(scoped, all, 1000000)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.items).toEqual([{ amount: 1000000, description: 'Rough In', source: { kind: 'fixture', jobs_ledger_fixture_id: 'a' } }])
  })
  it('a job with no discount rows builds exactly as before', () => {
    const all = asStripe(job892().slice(0, 3))
    const built = build(all, all, 3774500)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.items.map((i) => i.amount)).toEqual([1509800, 1509800, 754900])
    expect(built.items.every((i) => i.source?.kind === 'fixture')).toBe(true)
  })
})

describe('the auto remainder bundle on a discounted job', () => {
  it('composes when the still-unlinked work NET of discounts equals the bundle (edge and client agree)', () => {
    const all = job892().map((r) => (r.id === 'a' ? { ...r, invoice_id: 'inv-1' } : r))
    const edge = scopeFixturesToInvoice(asStripe(all), 'auto', { isPrimaryRtbBundle: true, targetAmountCents: 1358820 + 679410 })
    expect(edge.map((r) => r.id)).toEqual(['b', 'c'])
    const client = fixturesForInvoiceBill(all, 'auto', { is_primary_rtb_bundle: true, amount: 20382.3 })
    expect(client.map((r) => r.id)).toEqual(['b', 'c'])
    const built = build(edge, asStripe(all), 2038230)
    if (!built.ok) throw new Error(built.error)
    expect(built.items.map((i) => [i.amount, i.description])).toEqual([
      [1509800, 'Top Out'],
      [754900, 'Trim Set'],
      [-226470, 'Negotiated discount (10%)'],
    ])
  })
  it('never lists the discount row itself, even unscoped', () => {
    expect(fixturesForInvoiceBill(job892(), null).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('physical (PDF / email) lines', () => {
  const all = job892()
  it('draw 1 prints the stage and a negative Services row; the preview is DB-backed', () => {
    const scoped = [all[0]!]
    const r = resolvePhysicalInvoiceLinePresentation(13588.2, '', 'Services', scoped, [], all)
    expect(r.breakdownMatches).toBe(true)
    expect(r.serviceLines).toEqual([
      { description: 'Rough In', qty: 1, unitPrice: 15098, amount: 15098 },
      { description: 'Negotiated discount (10%)', qty: 1, unitPrice: -1509.8, amount: -1509.8 },
    ])
    expect(physicalPreviewRowsAreDbBacked(scoped, [], 13588.2, all)).toBe(true)
    expect(physicalPreviewRowsAreDbBacked(scoped, [], 13588.2)).toBe(false)
  })
  it('a different amount prorates over the net row and prints no discount line', () => {
    const r = resolvePhysicalInvoiceLinePresentation(10000, '', 'Services', [all[0]!], [], all)
    expect(r.breakdownMatches).toBe(false)
    expect(r.serviceLines).toEqual([{ description: 'Rough In', qty: 1, unitPrice: 10000, amount: 10000 }])
  })
  it('discountServiceLinesForFixtures is empty without discount rows', () => {
    expect(discountServiceLinesForFixtures(all.slice(0, 3), [all[0]!])).toEqual([])
  })
})
