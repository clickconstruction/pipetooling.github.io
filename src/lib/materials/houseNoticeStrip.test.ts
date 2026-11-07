/**
 * A house's notice window as a strip (punch list #217, people-docs-8): the estimate from two
 * invoice months draws a bar from the oldest month's first notice day to the soonest open
 * deadline with the invoices as ticks and a *guessed* mark; a told day draws its own tick and a
 * *they said* mark with who; both houses share one calendar.
 */
import { describe, expect, it } from 'vitest'
import { buildLienSupplierJobs, type LienSupplierInvoiceInput } from '../jobs/lienJobSuppliers'
import { houseNoticeStrip } from './houseNoticeStrip'

const TODAY = '2026-10-30'

function invoice(id: string, house: string, date: string, amount: number, over: Partial<LienSupplierInvoiceInput> = {}): LienSupplierInvoiceInput {
  return { id, supply_house_id: house, amount, is_paid: false, invoice_date: date, paidYmd: null, on_job_account: false, invoice_number: id.toUpperCase(), ...over }
}

const HOUSES = [
  { id: 'h-blue', name: 'Bluebonnet Supply' },
  { id: 'h-oak', name: 'Lone Oak Plumbing' },
]

function jobWith(invoices: LienSupplierInvoiceInput[], words: Array<{ houseId: string; noticeYmd: string | null; saidBy: string; notedYmd: string }> = []) {
  return buildLienSupplierJobs({
    invoices,
    allocations: invoices.map((inv) => ({ invoice_id: inv.id, job_id: 'j1', pct: 100 })),
    houses: HOUSES,
    wordsByJob: new Map([['j1', words.map((w) => ({ houseId: w.houseId, balance: null, noticeYmd: w.noticeYmd, saidBy: w.saidBy, note: '', notedByName: 'Grace', notedYmd: w.notedYmd }))]]),
  }).get('j1')!
}

describe('houseNoticeStrip', () => {
  it('an estimate from two invoice months: a bar from the oldest month’s first notice day to the soonest open deadline, two ticks, a guessed mark', () => {
    // Residential: an August invoice's notice is due by Oct 15 (closed), September's by Nov 16 (open).
    const strip = houseNoticeStrip(jobWith([invoice('a', 'h-blue', '2026-08-12', 3120.1), invoice('b', 'h-blue', '2026-09-03', 2984)]), 'residential', TODAY, true)!
    expect(strip.rows).toHaveLength(1)
    const row = strip.rows[0]!
    expect(row.label).toBe('Bluebonnet Supply · $6,104')
    expect(row.ticks.map((t) => t.ymd)).toEqual(['2026-08-12', '2026-09-03'])
    expect(row.ticks[0]!.words).toBe('unpaid invoice Aug 12 · $3,120')
    expect(row.bar).toEqual({ start: '2026-09-01', end: '2026-11-16', tone: 'soon', words: 'notice window · by Nov 16', hatchTo: TODAY })
    expect(row.told).toBeNull()
    expect(row.source).toEqual({ kind: 'guessed', words: 'Bluebonnet Supply · by Nov 16 · guessed from the invoice months' })
    expect(row.ahead).toBe(true)
    expect(row.title).toBe('Bluebonnet Supply is owed $6,104. 2 unpaid invoices: Aug 12, Sep 3. By our count it can send its own notice from Sep 1 to Nov 16.')
    expect(strip.chips).toEqual([
      { key: 'paid', text: 'paid in full', tone: 'ok' },
      { key: 'ahead', text: '1 house can still notice', tone: 'warn' },
    ])
    // The axis holds the August invoice and the November deadline, whole months.
    expect(strip.axis.first).toBe('2026-08-01')
    expect(strip.axis.last).toBe('2026-11-30')
    expect(strip.legend).toEqual(['│ today', '▏an unpaid invoice', '▬ the window, by our count', '▨ days already gone'])
  })

  it('a told day: the estimate still draws as the bar, the house’s day as its own tick, and the mark says who said it and when', () => {
    // Commercial: a September invoice's notice is due by Dec 15; the house said Nov 20.
    const strip = houseNoticeStrip(jobWith([invoice('c', 'h-oak', '2026-09-20', 2817.63)], [{ houseId: 'h-oak', noticeYmd: '2026-11-20', saidBy: 'Marisol', notedYmd: '2026-10-21' }]), 'non_residential', TODAY, false)!
    const row = strip.rows[0]!
    expect(row.bar).toEqual({ start: '2026-10-01', end: '2026-12-15', tone: 'open', words: 'notice window · by Dec 15', hatchTo: TODAY })
    expect(row.told).toEqual({ ymd: '2026-11-20', who: 'Marisol', notedYmd: '2026-10-21', past: false })
    expect(row.source).toEqual({ kind: 'said', words: 'Lone Oak Plumbing · goes out Nov 20 · they said · Marisol, Oct 21' })
    expect(row.ahead).toBe(true)
    expect(row.title).toContain('Marisol said its notice goes out Nov 20.')
    expect(strip.chips).toEqual([{ key: 'ahead', text: '1 house can still notice', tone: 'warn' }])
    expect(strip.legend).toContain('◆ the day the house gave')
  })

  it('both houses on one calendar: two rows, two marks, the count of houses that can still notice', () => {
    const strip = houseNoticeStrip(
      jobWith([invoice('a', 'h-blue', '2026-08-12', 3120.1), invoice('b', 'h-blue', '2026-09-03', 2984), invoice('c', 'h-oak', '2026-09-20', 2817.63)], [{ houseId: 'h-oak', noticeYmd: '2026-11-20', saidBy: 'Marisol', notedYmd: '2026-10-21' }]),
      'residential',
      TODAY,
      true,
    )!
    expect(strip.rows.map((r) => r.name)).toEqual(['Bluebonnet Supply', 'Lone Oak Plumbing'])
    expect(strip.rows.map((r) => r.source.kind)).toEqual(['guessed', 'said'])
    expect(strip.chips.map((c) => c.text)).toEqual(['paid in full', '2 houses can still notice'])
    expect(strip.axis.first).toBe('2026-08-01')
    expect(strip.axis.last).toBe('2026-11-30')
    expect(strip.words).toBe(
      '2 houses owed on this job, the customer paid in full. 2 houses can still send a notice. Bluebonnet Supply · by Nov 16 · guessed from the invoice months. Lone Oak Plumbing · goes out Nov 20 · they said · Marisol, Oct 21.',
    )
  })

  it('a closed window draws a closed bar and counts no house as able to notice; a told day already gone reads went out', () => {
    const strip = houseNoticeStrip(
      jobWith([invoice('a', 'h-blue', '2026-06-12', 500), invoice('c', 'h-oak', '2026-09-20', 900)], [{ houseId: 'h-oak', noticeYmd: '2026-10-20', saidBy: '', notedYmd: '' }]),
      'residential',
      TODAY,
      false,
    )!
    // Rows follow the desk's order, owed first: Lone Oak ($900) before Bluebonnet ($500).
    expect(strip.rows.map((r) => r.name)).toEqual(['Lone Oak Plumbing', 'Bluebonnet Supply'])
    const blue = strip.rows.find((r) => r.houseId === 'h-blue')
    const oak = strip.rows.find((r) => r.houseId === 'h-oak')
    expect(blue!.bar).toEqual({ start: '2026-07-01', end: '2026-08-17', tone: 'closed', words: 'window closed Aug 17', hatchTo: '' })
    expect(blue!.source.kind).toBe('closed')
    expect(blue!.ahead).toBe(false)
    expect(oak!.told).toEqual({ ymd: '2026-10-20', who: 'Lone Oak Plumbing', notedYmd: '', past: true })
    expect(oak!.source.words).toBe('Lone Oak Plumbing · went out Oct 20 · they said · Lone Oak Plumbing')
    expect(strip.chips).toEqual([])
    expect(strip.words).toContain('No house can still send a notice, by our count.')
    expect(strip.legend).toContain('▭ a window that closed')
  })

  it('a paid-up house is not a row, and a job with nothing owed draws nothing', () => {
    const strip = houseNoticeStrip(jobWith([invoice('a', 'h-blue', '2026-09-03', 2984), invoice('p', 'h-oak', '2026-09-20', 900, { is_paid: true, paidYmd: '2026-10-01' })]), 'residential', TODAY, false)!
    expect(strip.rows.map((r) => r.name)).toEqual(['Bluebonnet Supply'])
    expect(houseNoticeStrip(jobWith([invoice('p', 'h-oak', '2026-09-20', 900, { is_paid: true, paidYmd: '2026-10-01' })]), 'residential', TODAY, true)).toBeNull()
    expect(houseNoticeStrip(null, 'residential', TODAY, true)).toBeNull()
  })
})
